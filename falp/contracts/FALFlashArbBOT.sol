// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║    KENOSTOD — FAL Flash Arbitrage Bot (BOT Chain / BDEX)        ║
 * ║                                                                  ║
 * ║  Executes flash-swap arbitrage across BDEX V3 pools.            ║
 * ║  5% of every net profit auto-routes to FALPool stakers.         ║
 * ║                                                                  ║
 * ║  Arb flow (two-pool cross-arb):                                 ║
 * ║    1. Flash borrow flashToken from flashPool                     ║
 * ║    2. Swap flashToken → swapToken on swapPool (cheaper side)    ║
 * ║    3. Swap swapToken → flashToken on flashPool (dearer side)    ║
 * ║    4. Repay flashPool principal + fee                            ║
 * ║    5. Unwrap profit WBOT → BOT; 5% → FALPool, 95% → owner      ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

// ─── BDEX / Uniswap V3 interfaces ────────────────────────────────────────────

interface IBDEXPool {
    function flash(
        address recipient,
        uint256 amount0,
        uint256 amount1,
        bytes calldata data
    ) external;

    function swap(
        address recipient,
        bool zeroForOne,
        int256 amountSpecified,
        uint160 sqrtPriceLimitX96,
        bytes calldata data
    ) external returns (int256 amount0, int256 amount1);

    function token0() external view returns (address);
    function token1() external view returns (address);
    function fee() external view returns (uint24);
}

interface IWBOT {
    function deposit() external payable;
    function withdraw(uint256 wad) external;
    function balanceOf(address) external view returns (uint256);
}

interface IFALPool {
    function depositProfit() external payable;
    function totalEffectiveStake() external view returns (uint256);
}

// ─── Contract ─────────────────────────────────────────────────────────────────

contract FALFlashArbBOT is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ── Constants ─────────────────────────────────────────────────
    uint256 public constant STAKER_SHARE_BPS = 500;  // 5% to FALPool stakers
    uint256 public constant BPS_DENOM        = 10000;

    // Uniswap V3 / BDEX sqrt price limits (prevent unbounded slippage)
    uint160 private constant MIN_SQRT_RATIO = 4295128739;
    uint160 private constant MAX_SQRT_RATIO = 1461446703485210103287273052203988822378723970342;

    // ── Config ────────────────────────────────────────────────────
    address public immutable WBOT;
    address public falPool;

    // ── Stats ─────────────────────────────────────────────────────
    uint256 public totalProfitBOT;
    uint256 public totalArbsExecuted;
    uint256 public totalStakerPaid;

    // ── Events ────────────────────────────────────────────────────
    event ArbExecuted(
        address indexed flashPool,
        address indexed swapPool,
        address indexed flashToken,
        uint256 flashAmount,
        uint256 grossProfitWBOT,
        uint256 stakerCutBOT,
        uint256 ownerCutBOT
    );
    event ProfitInjected(
        address indexed sender,
        uint256 totalBOT,
        uint256 stakerCutBOT
    );
    event FALPoolUpdated(address indexed oldPool, address indexed newPool);

    // ── Flash arb params (ABI-encoded, threaded through callback) ─
    struct ArbParams {
        address flashPool;      // pool we borrowed from — we swap back here
        address swapPool;       // pool we swap to first (the cheaper side)
        address flashToken;     // token we borrow (usually WBOT)
        address swapToken;      // token we receive from first swap (e.g. KENO)
        uint256 flashAmount;    // amount borrowed
        bool    zeroForOneA;    // direction on flashPool for return-swap (swapToken→flashToken)
        bool    zeroForOneB;    // direction on swapPool for initial swap (flashToken→swapToken)
        uint256 minProfitBOT;   // minimum net profit in BOT — reverts if not met
    }

    // ─────────────────────────────────────────────────────────────

    constructor(address _wbot, address _falPool) Ownable(msg.sender) {
        require(_wbot    != address(0), "FALFlashArbBOT: zero WBOT");
        require(_falPool != address(0), "FALFlashArbBOT: zero FALPool");
        WBOT    = _wbot;
        falPool = _falPool;
    }

    // ────────────────────────────────────────────────────────────────────────
    //  Execute cross-pool flash arb
    //
    //  flashPool  : V3 pool to borrow from (and return-swap on)
    //  swapPool   : V3 pool to swap on first (the cheaper/better-priced pool)
    //  zeroForOneB: swap direction on swapPool  (flashToken→swapToken)
    //               true  = token0 in → token1 out on swapPool
    //               false = token1 in → token0 out on swapPool
    //  flashAmount: WBOT (or token0/token1) to borrow
    //  minProfit  : minimum BOT profit after all fees (reverts if below)
    // ────────────────────────────────────────────────────────────────────────
    function executeArb(
        address flashPool,
        address swapPool,
        bool    zeroForOneB,
        uint256 flashAmount,
        uint256 minProfitBOT
    ) external onlyOwner nonReentrant {
        require(flashPool != address(0) && swapPool != address(0), "FALFlashArbBOT: zero pool");
        require(flashAmount > 0, "FALFlashArbBOT: zero amount");

        IBDEXPool fp = IBDEXPool(flashPool);
        address token0 = fp.token0();
        address token1 = fp.token1();

        // We borrow token0 if zeroForOneB (we'll swap token0→token1 on swapPool first)
        bool    borrowToken0 = zeroForOneB;
        address flashToken   = borrowToken0 ? token0 : token1;
        address swapToken    = borrowToken0 ? token1 : token0;

        // On flashPool the return-swap is swapToken → flashToken (opposite direction)
        bool zeroForOneA = !zeroForOneB;

        bytes memory data = abi.encode(ArbParams({
            flashPool:    flashPool,
            swapPool:     swapPool,
            flashToken:   flashToken,
            swapToken:    swapToken,
            flashAmount:  flashAmount,
            zeroForOneA:  zeroForOneA,
            zeroForOneB:  zeroForOneB,
            minProfitBOT: minProfitBOT
        }));

        uint256 amount0 = borrowToken0 ? flashAmount : 0;
        uint256 amount1 = borrowToken0 ? 0 : flashAmount;

        IBDEXPool(flashPool).flash(address(this), amount0, amount1, data);
    }

    // ────────────────────────────────────────────────────────────────────────
    //  BDEX V3 flash callback
    //  Called by the flash pool after transferring borrowed tokens.
    // ────────────────────────────────────────────────────────────────────────
    function uniswapV3FlashCallback(
        uint256 fee0,
        uint256 fee1,
        bytes calldata data
    ) external nonReentrant {
        ArbParams memory p = abi.decode(data, (ArbParams));
        require(msg.sender == p.flashPool, "FALFlashArbBOT: untrusted caller");

        uint256 flashFee    = p.zeroForOneB ? fee0 : fee1;
        uint256 repayAmount = p.flashAmount + flashFee;

        // Step 1 — swap flashToken → swapToken on swapPool (the cheaper pool)
        uint256 swapTokenOut = _swap(
            p.swapPool,
            p.flashToken,
            p.flashAmount,
            p.zeroForOneB
        );

        // Step 2 — swap swapToken → flashToken on flashPool (the dearer pool)
        uint256 flashTokenBack = _swap(
            p.flashPool,
            p.swapToken,
            swapTokenOut,
            p.zeroForOneA
        );

        // Step 3 — must be profitable after fee
        require(flashTokenBack >= repayAmount, "FALFlashArbBOT: unprofitable arb");

        uint256 grossProfit = flashTokenBack - repayAmount;

        // Step 4 — repay the flash pool
        IERC20(p.flashToken).safeTransfer(p.flashPool, repayAmount);

        // Step 5 — convert profit to BOT and distribute
        uint256 botProfit = _wbotToBOT(p.flashToken, grossProfit);
        require(botProfit >= p.minProfitBOT, "FALFlashArbBOT: below min profit");

        uint256 stakerCut = _distribute(botProfit);

        totalArbsExecuted++;
        totalProfitBOT += botProfit;

        emit ArbExecuted(
            p.flashPool,
            p.swapPool,
            p.flashToken,
            p.flashAmount,
            grossProfit,
            stakerCut,
            botProfit - stakerCut
        );
    }

    // ────────────────────────────────────────────────────────────────────────
    //  BDEX V3 swap callback — called by pools during _swap()
    // ────────────────────────────────────────────────────────────────────────
    function uniswapV3SwapCallback(
        int256 amount0Delta,
        int256 amount1Delta,
        bytes calldata data
    ) external {
        // Pay the pool the positive delta (the amount we owe)
        address tokenIn = abi.decode(data, (address));
        uint256 amountToPay = amount0Delta > 0
            ? uint256(amount0Delta)
            : uint256(amount1Delta);
        IERC20(tokenIn).safeTransfer(msg.sender, amountToPay);
    }

    // ────────────────────────────────────────────────────────────────────────
    //  Manual profit injection
    //  Owner sends BOT directly; 5% → FALPool stakers, 95% back to owner.
    //  Use this to seed staker rewards before active arb is running.
    // ────────────────────────────────────────────────────────────────────────
    function injectProfit() external payable onlyOwner {
        require(msg.value > 0, "FALFlashArbBOT: no BOT sent");
        uint256 stakerCut = _distribute(msg.value);
        totalProfitBOT   += msg.value;
        emit ProfitInjected(msg.sender, msg.value, stakerCut);
    }

    // ────────────────────────────────────────────────────────────────────────
    //  Admin
    // ────────────────────────────────────────────────────────────────────────
    function setFALPool(address _falPool) external onlyOwner {
        require(_falPool != address(0), "FALFlashArbBOT: zero address");
        emit FALPoolUpdated(falPool, _falPool);
        falPool = _falPool;
    }

    /// @notice Recover ERC-20 tokens accidentally sent to this contract
    function recoverToken(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }

    /// @notice Recover native BOT
    function recoverBOT() external onlyOwner {
        (bool sent, ) = owner().call{value: address(this).balance}("");
        require(sent, "FALFlashArbBOT: BOT transfer failed");
    }

    // ────────────────────────────────────────────────────────────────────────
    //  Read helpers
    // ────────────────────────────────────────────────────────────────────────
    function getStats() external view returns (
        uint256 _totalProfitBOT,
        uint256 _totalArbsExecuted,
        uint256 _totalStakerPaid,
        uint256 _botBalance
    ) {
        return (totalProfitBOT, totalArbsExecuted, totalStakerPaid, address(this).balance);
    }

    // ────────────────────────────────────────────────────────────────────────
    //  Internals
    // ────────────────────────────────────────────────────────────────────────

    /// @dev Execute an exact-input single swap on a BDEX V3 pool.
    function _swap(
        address pool,
        address tokenIn,
        uint256 amountIn,
        bool    zeroForOne
    ) internal returns (uint256 amountOut) {
        uint160 limit = zeroForOne ? MIN_SQRT_RATIO + 1 : MAX_SQRT_RATIO - 1;
        (int256 d0, int256 d1) = IBDEXPool(pool).swap(
            address(this),
            zeroForOne,
            int256(amountIn),
            limit,
            abi.encode(tokenIn)
        );
        // The output is the negative delta of the output token
        amountOut = uint256(zeroForOne ? -d1 : -d0);
    }

    /// @dev If the profit token is WBOT, unwrap it to native BOT. Otherwise return as-is.
    function _wbotToBOT(address token, uint256 amount) internal returns (uint256) {
        if (token == WBOT) {
            IWBOT(WBOT).withdraw(amount);
            return amount;
        }
        // Non-WBOT profit: keep as token (caller must ensure WBOT-denominated arb)
        return amount;
    }

    /// @dev Split botAmount 5%/95% between FALPool stakers and owner.
    ///      Skips FALPool distribution if no stakers yet (avoids revert).
    function _distribute(uint256 botAmount) internal returns (uint256 stakerCut) {
        stakerCut = (botAmount * STAKER_SHARE_BPS) / BPS_DENOM;
        uint256 ownerCut = botAmount - stakerCut;

        if (stakerCut > 0) {
            // Only forward to FALPool if there are stakers (avoid depositProfit revert)
            try IFALPool(falPool).totalEffectiveStake() returns (uint256 stake) {
                if (stake > 0) {
                    IFALPool(falPool).depositProfit{value: stakerCut}();
                    totalStakerPaid += stakerCut;
                } else {
                    // No stakers yet: roll staker cut to owner
                    ownerCut += stakerCut;
                    stakerCut = 0;
                }
            } catch {
                ownerCut += stakerCut;
                stakerCut = 0;
            }
        }

        if (ownerCut > 0) {
            (bool sent, ) = owner().call{value: ownerCut}("");
            require(sent, "FALFlashArbBOT: owner transfer failed");
        }
    }

    receive() external payable {}
}
