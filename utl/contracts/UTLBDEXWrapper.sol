// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * UTL BDEX Wrapper — BOT Chain Mainnet
 * ══════════════════════════════════════
 * Wraps swaps on BDEX (BOT Chain V3 DEX) so that every swap
 * automatically routes a 0.1 % UTL fee to the UTL FeeCollector.
 *
 * Revenue split (configured in FeeCollector):
 *   40 % → operational treasury
 *   60 % → UTL staker / distribution contract
 *
 * Supported swap flows
 *   • swapExactBOTForTokens  — native BOT in, any token out
 *   • swapExactTokensForBOT  — any token in, native BOT out
 *   • swapExactTokensForTokens — token in, different token out
 *
 * All fees are collected in the INPUT asset before the swap executes,
 * so users always see the exact output amount from the DEX.
 *
 * Security
 *   • nonReentrant on all swap functions
 *   • owner can update the feeCollector address
 *   • owner can update the UTL_FEE_BPS (max 100 = 1 %)
 *   • no custody: all funds route through in a single transaction
 */

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IWBOT {
    function deposit() external payable;
    function withdraw(uint256) external;
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address) external view returns (uint256);
}

interface IBDEXRouter {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24  fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }
    function exactInputSingle(ExactInputSingleParams calldata params)
        external payable returns (uint256 amountOut);
}

contract UTLBDEXWrapper is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ── Immutable addresses ───────────────────────────────────────────────
    IWBOT   public immutable WBOT;
    IBDEXRouter public immutable bdexRouter;

    // ── Mutable config ────────────────────────────────────────────────────
    address public feeCollector;
    uint256 public utlFeeBps = 10;          // 0.1 % — 10 basis points
    uint256 public constant MAX_FEE_BPS = 100; // hard cap at 1 %

    // ── Events ────────────────────────────────────────────────────────────
    event SwapBOTForTokens(
        address indexed user,
        address indexed tokenOut,
        uint256 botIn,
        uint256 utlFee,
        uint256 amountOut
    );
    event SwapTokensForBOT(
        address indexed user,
        address indexed tokenIn,
        uint256 amountIn,
        uint256 botOut,
        uint256 utlFee
    );
    event SwapTokensForTokens(
        address indexed user,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 utlFee,
        uint256 amountOut
    );
    event FeeCollectorUpdated(address indexed newCollector);
    event FeeBpsUpdated(uint256 newBps);

    constructor(
        address _wbot,
        address _bdexRouter,
        address _feeCollector
    ) Ownable(msg.sender) {
        require(_wbot         != address(0), "WBOT zero");
        require(_bdexRouter   != address(0), "Router zero");
        require(_feeCollector != address(0), "FeeCollector zero");

        WBOT         = IWBOT(_wbot);
        bdexRouter   = IBDEXRouter(_bdexRouter);
        feeCollector = _feeCollector;
    }

    // ── Owner config ──────────────────────────────────────────────────────

    function setFeeCollector(address _fc) external onlyOwner {
        require(_fc != address(0), "Zero address");
        feeCollector = _fc;
        emit FeeCollectorUpdated(_fc);
    }

    function setFeeBps(uint256 _bps) external onlyOwner {
        require(_bps <= MAX_FEE_BPS, "Fee too high");
        utlFeeBps = _bps;
        emit FeeBpsUpdated(_bps);
    }

    // ── Public view ───────────────────────────────────────────────────────

    /// @notice Preview fee and net amount for any input
    function previewFee(uint256 amountIn) external view returns (
        uint256 fee,
        uint256 netAmount
    ) {
        fee       = (amountIn * utlFeeBps) / 10_000;
        netAmount = amountIn - fee;
    }

    // ── Swap: native BOT → token ──────────────────────────────────────────

    /**
     * @notice Swap native BOT for any token via BDEX.
     * @param tokenOut       Token to receive.
     * @param amountOutMin   Minimum tokens expected (slippage guard).
     * @param poolFee        BDEX pool fee tier (e.g. 3000 = 0.3 %).
     * @param deadline       Unix timestamp after which the TX reverts.
     */
    function swapExactBOTForTokens(
        address tokenOut,
        uint256 amountOutMin,
        uint24  poolFee,
        uint256 deadline
    ) external payable nonReentrant returns (uint256 amountOut) {
        require(msg.value > 0,           "No BOT sent");
        require(tokenOut != address(0),  "tokenOut zero");
        require(deadline >= block.timestamp, "Deadline passed");

        uint256 totalIn = msg.value;
        uint256 fee     = (totalIn * utlFeeBps) / 10_000;
        uint256 netIn   = totalIn - fee;

        // Collect UTL fee in native BOT
        if (fee > 0) {
            (bool sent, ) = feeCollector.call{value: fee}("");
            require(sent, "UTL fee transfer failed");
        }

        // Wrap remaining BOT → WBOT
        WBOT.deposit{value: netIn}();

        // Approve router for WBOT
        WBOT.approve(address(bdexRouter), netIn);

        // Execute swap on BDEX
        amountOut = bdexRouter.exactInputSingle(
            IBDEXRouter.ExactInputSingleParams({
                tokenIn:            address(WBOT),
                tokenOut:           tokenOut,
                fee:                poolFee,
                recipient:          msg.sender,
                deadline:           deadline,
                amountIn:           netIn,
                amountOutMinimum:   amountOutMin,
                sqrtPriceLimitX96:  0
            })
        );

        emit SwapBOTForTokens(msg.sender, tokenOut, totalIn, fee, amountOut);
    }

    // ── Swap: token → native BOT ──────────────────────────────────────────

    /**
     * @notice Swap any token for native BOT via BDEX.
     * @param tokenIn        Token to sell.
     * @param amountIn       Amount of tokenIn to sell.
     * @param amountOutMin   Minimum BOT expected after fee (slippage guard).
     * @param poolFee        BDEX pool fee tier.
     * @param deadline       Unix timestamp after which the TX reverts.
     */
    function swapExactTokensForBOT(
        address tokenIn,
        uint256 amountIn,
        uint256 amountOutMin,
        uint24  poolFee,
        uint256 deadline
    ) external nonReentrant returns (uint256 botOut) {
        require(amountIn > 0,           "No tokens");
        require(tokenIn != address(0),  "tokenIn zero");
        require(deadline >= block.timestamp, "Deadline passed");

        // Pull tokens from user
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);

        // Approve router
        IERC20(tokenIn).forceApprove(address(bdexRouter), amountIn);

        // Swap tokenIn → WBOT
        uint256 wbotOut = bdexRouter.exactInputSingle(
            IBDEXRouter.ExactInputSingleParams({
                tokenIn:            tokenIn,
                tokenOut:           address(WBOT),
                fee:                poolFee,
                recipient:          address(this),
                deadline:           deadline,
                amountIn:           amountIn,
                amountOutMinimum:   0,   // we enforce amountOutMin after fee
                sqrtPriceLimitX96:  0
            })
        );

        // Unwrap WBOT → native BOT
        WBOT.withdraw(wbotOut);

        // Collect UTL fee in native BOT
        uint256 fee    = (wbotOut * utlFeeBps) / 10_000;
        uint256 netBot = wbotOut - fee;

        require(netBot >= amountOutMin, "Insufficient output");

        if (fee > 0) {
            (bool feeSent, ) = feeCollector.call{value: fee}("");
            require(feeSent, "UTL fee transfer failed");
        }

        // Send remaining BOT to user
        (bool sent, ) = msg.sender.call{value: netBot}("");
        require(sent, "BOT transfer failed");

        botOut = netBot;
        emit SwapTokensForBOT(msg.sender, tokenIn, amountIn, netBot, fee);
    }

    // ── Swap: token → token ───────────────────────────────────────────────

    /**
     * @notice Swap any token for any other token via BDEX.
     *         UTL fee is taken from the input token.
     * @param tokenIn        Token to sell.
     * @param tokenOut       Token to receive.
     * @param amountIn       Amount of tokenIn to sell.
     * @param amountOutMin   Minimum tokenOut expected (slippage guard).
     * @param poolFee        BDEX pool fee tier.
     * @param deadline       Unix timestamp after which the TX reverts.
     */
    function swapExactTokensForTokens(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOutMin,
        uint24  poolFee,
        uint256 deadline
    ) external nonReentrant returns (uint256 amountOut) {
        require(amountIn > 0,           "No tokens");
        require(tokenIn  != address(0), "tokenIn zero");
        require(tokenOut != address(0), "tokenOut zero");
        require(deadline >= block.timestamp, "Deadline passed");

        // Pull tokens from user
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);

        // Collect UTL fee in tokenIn
        uint256 fee    = (amountIn * utlFeeBps) / 10_000;
        uint256 netIn  = amountIn - fee;

        if (fee > 0) {
            IERC20(tokenIn).safeTransfer(feeCollector, fee);
        }

        // Approve router for net amount
        IERC20(tokenIn).forceApprove(address(bdexRouter), netIn);

        // Execute swap
        amountOut = bdexRouter.exactInputSingle(
            IBDEXRouter.ExactInputSingleParams({
                tokenIn:            tokenIn,
                tokenOut:           tokenOut,
                fee:                poolFee,
                recipient:          msg.sender,
                deadline:           deadline,
                amountIn:           netIn,
                amountOutMinimum:   amountOutMin,
                sqrtPriceLimitX96:  0
            })
        );

        emit SwapTokensForTokens(msg.sender, tokenIn, tokenOut, amountIn, fee, amountOut);
    }

    // ── Receive native BOT (from WBOT.withdraw) ───────────────────────────
    receive() external payable {}

    // ── Emergency recovery (owner only) ──────────────────────────────────
    function recoverToken(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }

    function recoverBOT() external onlyOwner {
        (bool sent, ) = owner().call{value: address(this).balance}("");
        require(sent, "Transfer failed");
    }
}
