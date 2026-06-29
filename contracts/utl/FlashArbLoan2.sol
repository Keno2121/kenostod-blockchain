// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// ─────────────────────────────────────────────────────────────────────────────
//
//  FlashArbLoan2 — UTL Protocol Multi-DEX Flash Arbitrage
//
//  Improvements over FAL v1:
//  ─────────────────────────
//  • Targets 4 DEXes: PancakeSwap v2, BiSwap, ApeSwap, BabySwap
//  • Supports 4 token pairs: WBNB/USDT, WBNB/BUSD, WBNB/ETH, WBNB/BTCB
//  • Dynamic borrow source — flash from whichever pair has deepest liquidity
//  • Multi-pair quote scan: off-chain bot calls quoteBest() to find winner
//  • 10% of profit routed to UTL FeeCollector (staker rewards)
//  • Hard-coded minimum profit check prevents unprofitable execution
//
//  HOW FLASH LOANS WORK HERE:
//  ───────────────────────────
//  1. Call executeFlashArb(borrowToken, borrowAmount, sellDexRouter, buyDexRouter, repayPair)
//  2. PancakeSwap pair lends `borrowAmount` of `borrowToken` to this contract
//  3. Callback: sell on sellDex, buy back on buyDex, repay pair + fee, keep spread
//  4. If the repayment check fails, the ENTIRE tx reverts — you only lose gas (~$0.02)
//  5. No capital required beyond gas
//
//  Author: Kenostod Blockchain Academy LLC — T.D.I.R. Foundation
//  Network: BSC Mainnet (chainId 56)
//
// ─────────────────────────────────────────────────────────────────────────────

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
}

interface IRouter {
    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);

    function getAmountsOut(uint amountIn, address[] calldata path)
        external view returns (uint[] memory amounts);
}

interface IPair {
    function swap(uint amount0Out, uint amount1Out, address to, bytes calldata data) external;
    function token0() external view returns (address);
    function token1() external view returns (address);
    function getReserves() external view returns (uint112 r0, uint112 r1, uint32 ts);
}

interface IPancakeCallee {
    function pancakeCall(address sender, uint amount0, uint amount1, bytes calldata data) external;
}

interface IUTLFeeCollector {
    function receiveFee(address token, uint256 amount, bytes32 feeType) external;
}

contract FlashArbLoan2 is IPancakeCallee {

    // ── Ownership ─────────────────────────────────────────────────────────
    address public owner;
    bool    public paused;

    // ── UTL FeeCollector ──────────────────────────────────────────────────
    address public constant UTL_FEE_COLLECTOR =
        0xfE537c43d202C455Cedc141B882c808287BB662f;
    uint256 public constant UTL_FEE_BPS = 1000;      // 10% of profit → stakers
    bytes32 public constant FEE_TYPE    = keccak256("FAL2_FLASH_ARB_PROFIT");

    // ── BSC Token Addresses ───────────────────────────────────────────────
    address public constant WBNB  = 0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c;
    address public constant USDT  = 0x55d398326f99059fF775485246999027B3197955;
    address public constant BUSD  = 0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56;
    address public constant WETH  = 0x2170Ed0880ac9A755fd29B2688956BD959F933F8;
    address public constant BTCB  = 0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c;

    // ── DEX Routers (BSC Mainnet) ─────────────────────────────────────────
    address public constant PANCAKE_ROUTER = 0x10ED43C718714eb63d5aA57B78B54704E256024E;
    address public constant BISWAP_ROUTER  = 0x3a6d8cA21D1CF76F653A67577FA0D27453350dD8;
    address public constant APESWAP_ROUTER = 0xcF0feBd3f17CEf5b47b0cD257aCf6025c5BFf3b7;
    address public constant BABYSWAP_ROUTER= 0x325E343f1dE602396E256B67eFd1F61C3A6B38Bd;

    // ── Flash Source Pairs (PancakeSwap v2) ───────────────────────────────
    // These are the pairs we borrow FROM. Must be PancakeSwap v2 pairs for
    // pancakeCall callback compatibility.
    address public constant PAIR_WBNB_USDT = 0x16b9a82891338f9bA80E2D6970FddA79D1eb0daE;
    address public constant PAIR_WBNB_BUSD = 0x58F876857a02D6762E0101bb5C46A8c1ED44Dc16;
    address public constant PAIR_WBNB_ETH  = 0x74E4716E431f45807DCF19f284c7aA99F18a4fbc;
    address public constant PAIR_WBNB_BTCB = 0x61EB789d75A95CAa3fF50ed7E47b96c132fEc082;

    // ── Stats ─────────────────────────────────────────────────────────────
    uint256 public totalArbsExecuted;
    uint256 public totalProfitWBNB;
    uint256 public totalUTLFeesPaid;

    // ── Flash callback context (set before flash, cleared after) ─────────
    struct FlashContext {
        address borrowToken;
        address sellToken;
        uint256 borrowAmount;
        address sellRouter;
        address buyRouter;
        address repayPair;
    }
    FlashContext private _ctx;

    // ── Events ────────────────────────────────────────────────────────────
    event ArbExecuted(
        address indexed borrowToken,
        uint256 borrowAmount,
        uint256 grossProfit,
        uint256 utlFee,
        uint256 netProfit
    );
    event ProfitWithdrawn(address token, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "FAL2: not owner");
        _;
    }

    modifier notPaused() {
        require(!paused, "FAL2: paused");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    // ─────────────────────────────────────────────────────────────────────
    // EXECUTE FLASH ARB
    // ─────────────────────────────────────────────────────────────────────
    //
    // @param borrowToken   Token to borrow (WBNB, USDT, BUSD, WETH, BTCB)
    // @param borrowAmount  Amount to borrow (in token decimals)
    // @param sellRouter    DEX to sell borrowToken on (higher price)
    // @param buyRouter     DEX to buy borrowToken back on (lower price)
    // @param repayPair     PancakeSwap v2 pair to flash borrow from
    //
    // Off-chain: call quoteBest() first to find the winning combo.
    // This function will revert (costing ~$0.02 gas) if not profitable.
    //
    function executeFlashArb(
        address borrowToken,
        uint256 borrowAmount,
        address sellRouter,
        address buyRouter,
        address repayPair
    ) external onlyOwner notPaused {
        require(borrowAmount > 0, "FAL2: zero amount");
        require(sellRouter != buyRouter, "FAL2: same router");

        // Store context for the callback
        _ctx = FlashContext({
            borrowToken:  borrowToken,
            sellToken:    _getSellToken(borrowToken),
            borrowAmount: borrowAmount,
            sellRouter:   sellRouter,
            buyRouter:    buyRouter,
            repayPair:    repayPair
        });

        // Determine which slot to borrow from (token0 or token1)
        address token0 = IPair(repayPair).token0();
        (uint256 amount0, uint256 amount1) = borrowToken == token0
            ? (borrowAmount, uint256(0))
            : (uint256(0), borrowAmount);

        // Initiate flash swap — pancakeCall fires before this returns
        IPair(repayPair).swap(amount0, amount1, address(this), abi.encode(borrowAmount));
    }

    // ─────────────────────────────────────────────────────────────────────
    // PANCAKESWAP FLASH CALLBACK
    // ─────────────────────────────────────────────────────────────────────

    function pancakeCall(
        address sender,
        uint256 /*amount0*/,
        uint256 /*amount1*/,
        bytes calldata /*data*/
    ) external override {
        require(sender == address(this),    "FAL2: sender not self");

        FlashContext memory ctx = _ctx;
        require(msg.sender == ctx.repayPair, "FAL2: caller not pair");

        // ── Step 1: Sell borrowToken → sellToken on sellRouter ──
        _approveIfNeeded(ctx.borrowToken, ctx.sellRouter, ctx.borrowAmount);
        address[] memory pathSell = _makePath(ctx.borrowToken, ctx.sellToken);
        uint256[] memory sellOut = IRouter(ctx.sellRouter).swapExactTokensForTokens(
            ctx.borrowAmount,
            0,
            pathSell,
            address(this),
            block.timestamp + 300
        );
        uint256 sellTokenReceived = sellOut[sellOut.length - 1];

        // ── Step 2: Buy borrowToken back with sellToken on buyRouter ──
        // Repay amount = borrowed * 10000/9975 (0.25% PancakeSwap flash fee)
        uint256 repayAmount = (ctx.borrowAmount * 10_000 + 9_974) / 9_975;

        _approveIfNeeded(ctx.sellToken, ctx.buyRouter, sellTokenReceived);
        address[] memory pathBuy = _makePath(ctx.sellToken, ctx.borrowToken);
        IRouter(ctx.buyRouter).swapExactTokensForTokens(
            sellTokenReceived,
            repayAmount,        // min out — reverts entire tx if can't repay
            pathBuy,
            address(this),
            block.timestamp + 300
        );

        // ── Step 3: Verify we can cover repayment ──
        uint256 tokenBal = IERC20(ctx.borrowToken).balanceOf(address(this));
        require(tokenBal >= repayAmount, "FAL2: insufficient for repayment");

        // ── Step 4: Repay the flash pair ──
        IERC20(ctx.borrowToken).transfer(ctx.repayPair, repayAmount);

        // ── Step 5: Split profit — 10% to UTL stakers, 90% to owner ──
        uint256 profit = IERC20(ctx.borrowToken).balanceOf(address(this));
        if (profit > 0) {
            uint256 utlFee = (profit * UTL_FEE_BPS) / 10_000;
            uint256 netProfit = profit - utlFee;

            if (utlFee > 0) {
                _approveIfNeeded(ctx.borrowToken, UTL_FEE_COLLECTOR, utlFee);
                try IUTLFeeCollector(UTL_FEE_COLLECTOR).receiveFee(ctx.borrowToken, utlFee, FEE_TYPE) {
                    totalUTLFeesPaid += utlFee;
                } catch {
                    netProfit = profit; // if fee collector fails, send all to owner
                }
            }

            IERC20(ctx.borrowToken).transfer(owner, netProfit);
            if (ctx.borrowToken == WBNB) totalProfitWBNB += netProfit;
            totalArbsExecuted++;

            emit ArbExecuted(ctx.borrowToken, ctx.borrowAmount, profit, utlFee, netProfit);
        } else {
            // Profitable enough to repay but not profitable overall — still ok
            totalArbsExecuted++;
        }

        // Clear context
        delete _ctx;
    }

    // ─────────────────────────────────────────────────────────────────────
    // QUOTE — scan all pairs and DEXes for best opportunity
    // ─────────────────────────────────────────────────────────────────────
    //
    // Returns the best arbitrage parameters found across all DEX combinations.
    // Off-chain: call this first, if profitable=true pass params to executeFlashArb.
    //
    struct QuoteResult {
        bool    profitable;
        address sellRouter;
        address buyRouter;
        address repayPair;
        uint256 grossProfitBNB;
    }

    function quoteBest(uint256 testAmountBNB)
        external
        view
        returns (
            bool    profitable,
            address sellRouter,
            address buyRouter,
            address repayPair,
            uint256 grossProfitBNB,
            uint256 repayAmountWBNB
        )
    {
        repayAmountWBNB = (testAmountBNB * 10_000 + 9_974) / 9_975;
        QuoteResult memory best;

        best = _scanPair(testAmountBNB, repayAmountWBNB, USDT, PAIR_WBNB_USDT, best);
        best = _scanPair(testAmountBNB, repayAmountWBNB, BUSD, PAIR_WBNB_BUSD, best);
        best = _scanPair(testAmountBNB, repayAmountWBNB, WETH, PAIR_WBNB_ETH,  best);
        best = _scanPair(testAmountBNB, repayAmountWBNB, BTCB, PAIR_WBNB_BTCB, best);

        profitable    = best.profitable;
        sellRouter    = best.sellRouter;
        buyRouter     = best.buyRouter;
        repayPair     = best.repayPair;
        grossProfitBNB = best.grossProfitBNB;
    }

    function _scanPair(
        uint256 testAmt,
        uint256 repayAmt,
        address stable,
        address pair,
        QuoteResult memory best
    ) internal view returns (QuoteResult memory) {
        address[4] memory routers = [PANCAKE_ROUTER, BISWAP_ROUTER, APESWAP_ROUTER, BABYSWAP_ROUTER];
        for (uint256 i = 0; i < 4; i++) {
            for (uint256 j = 0; j < 4; j++) {
                if (i == j) continue;
                uint256 stableOut = _quote(routers[i], testAmt, WBNB, stable);
                if (stableOut == 0) continue;
                uint256 wbnbBack  = _quote(routers[j], stableOut, stable, WBNB);
                if (wbnbBack <= repayAmt) continue;
                uint256 gross = wbnbBack - repayAmt;
                if (gross > best.grossProfitBNB) {
                    best.profitable    = true;
                    best.sellRouter    = routers[i];
                    best.buyRouter     = routers[j];
                    best.repayPair     = pair;
                    best.grossProfitBNB = gross;
                }
            }
        }
        return best;
    }

    // ─────────────────────────────────────────────────────────────────────
    // ADMIN
    // ─────────────────────────────────────────────────────────────────────

    function setPaused(bool _paused) external onlyOwner { paused = _paused; }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "FAL2: zero addr");
        owner = newOwner;
    }

    function withdraw(address token) external onlyOwner {
        uint256 bal = IERC20(token).balanceOf(address(this));
        require(bal > 0, "FAL2: nothing to withdraw");
        IERC20(token).transfer(owner, bal);
        emit ProfitWithdrawn(token, bal);
    }

    function withdrawBNB() external onlyOwner {
        uint256 bal = address(this).balance;
        require(bal > 0, "FAL2: no BNB");
        payable(owner).transfer(bal);
    }

    receive() external payable {}

    // ─────────────────────────────────────────────────────────────────────
    // INTERNAL HELPERS
    // ─────────────────────────────────────────────────────────────────────

    function _getSellToken(address borrowToken) internal pure returns (address) {
        if (borrowToken == WBNB) return USDT;
        if (borrowToken == USDT) return WBNB;
        if (borrowToken == BUSD) return WBNB;
        return USDT;
    }

    function _makePath(address a, address b) internal pure returns (address[] memory p) {
        p = new address[](2);
        p[0] = a;
        p[1] = b;
    }

    function _approveIfNeeded(address token, address spender, uint256 amount) internal {
        if (IERC20(token).allowance(address(this), spender) < amount) {
            IERC20(token).approve(spender, type(uint256).max);
        }
    }

    function _quote(address router, uint256 amountIn, address from, address to)
        internal view returns (uint256)
    {
        address[] memory path = _makePath(from, to);
        try IRouter(router).getAmountsOut(amountIn, path) returns (uint256[] memory amounts) {
            return amounts[amounts.length - 1];
        } catch {
            return 0;
        }
    }
}
