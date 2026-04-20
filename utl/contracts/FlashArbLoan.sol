// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IPancakeRouter02 {
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

interface IPancakePair {
    function swap(uint amount0Out, uint amount1Out, address to, bytes calldata data) external;
    function token0() external view returns (address);
    function token1() external view returns (address);
    function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
}

interface IPancakeCallee {
    function pancakeCall(address sender, uint amount0, uint amount1, bytes calldata data) external;
}

/**
 * @title FlashArbLoan
 * @notice Real on-chain flash arbitrage using PancakeSwap flash swaps + BiSwap execution
 *         Borrows WBNB from PancakeSwap → sells on BiSwap → repays PancakeSwap → keeps profit
 * @dev    Part of the Kenostod UTL Protocol — T.D.I.R. Foundation
 */
contract FlashArbLoan is IPancakeCallee {
    address public owner;
    bool public paused;

    // BSC Mainnet — PancakeSwap V2
    address public constant PANCAKE_ROUTER   = 0x10ED43C718714eb63d5aA57B78B54704E256024E;
    // BSC Mainnet — BiSwap V2
    address public constant BISWAP_ROUTER    = 0x3a6d8cA21D1CF76F653A67577FA0D27453350dD8;
    // PancakeSwap V2 WBNB/USDT pair (token0 = USDT, token1 = WBNB)
    address public constant PANCAKE_PAIR     = 0x16b9a82891338f9bA80E2D6970FddA79D1eb0daE;

    address public constant WBNB = 0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c;
    address public constant USDT = 0x55d398326f99059fF775485246999027B3197955;

    uint256 public totalProfitWBNB;
    uint256 public totalArbs;

    event ArbExecuted(uint256 borrowedWBNB, uint256 profitWBNB, uint256 timestamp);
    event Withdrawn(address token, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "FAL: not owner");
        _;
    }

    modifier notPaused() {
        require(!paused, "FAL: paused");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    // ─────────────────────────────────────────────────────────────
    // EXTERNAL — INITIATE FLASH ARB
    // ─────────────────────────────────────────────────────────────

    /**
     * @notice Execute a flash arbitrage. Borrows `wbnbAmount` WBNB from PancakeSwap pair,
     *         sells on BiSwap (higher rate), repays PancakeSwap, keeps the spread.
     * @param wbnbAmount  Amount of WBNB to borrow (18 decimals)
     */
    function executeFlashArb(uint256 wbnbAmount) external onlyOwner notPaused {
        require(wbnbAmount > 0, "FAL: zero amount");
        // PANCAKE_PAIR: token0 = USDT, token1 = WBNB — we borrow token1
        bytes memory data = abi.encode(wbnbAmount);
        IPancakePair(PANCAKE_PAIR).swap(0, wbnbAmount, address(this), data);
    }

    // ─────────────────────────────────────────────────────────────
    // PANCAKESWAP CALLBACK
    // ─────────────────────────────────────────────────────────────

    function pancakeCall(
        address sender,
        uint256 /*amount0*/,
        uint256 amount1,
        bytes calldata data
    ) external override {
        require(msg.sender == PANCAKE_PAIR, "FAL: caller not pair");
        require(sender == address(this), "FAL: sender not self");

        uint256 borrowedWBNB = abi.decode(data, (uint256));
        require(amount1 == borrowedWBNB, "FAL: amount mismatch");

        // ── Step 1: Sell WBNB → USDT on BiSwap (better price) ──
        IERC20(WBNB).approve(BISWAP_ROUTER, borrowedWBNB);
        address[] memory pathSell = new address[](2);
        pathSell[0] = WBNB;
        pathSell[1] = USDT;

        uint256[] memory sellAmounts = IPancakeRouter02(BISWAP_ROUTER).swapExactTokensForTokens(
            borrowedWBNB,
            0,
            pathSell,
            address(this),
            block.timestamp + 300
        );
        uint256 usdtReceived = sellAmounts[sellAmounts.length - 1];

        // ── Step 2: Repayment amount = borrowed * 10000/9975 (0.25% PancakeSwap fee) ──
        uint256 repayWBNB = (borrowedWBNB * 10000 + 9974) / 9975;

        // ── Step 3: Buy repayWBNB worth of WBNB using USDT on PancakeSwap router ──
        IERC20(USDT).approve(PANCAKE_ROUTER, usdtReceived);
        address[] memory pathBuy = new address[](2);
        pathBuy[0] = USDT;
        pathBuy[1] = WBNB;

        IPancakeRouter02(PANCAKE_ROUTER).swapExactTokensForTokens(
            usdtReceived,
            repayWBNB,          // minimum — reverts if can't cover repayment
            pathBuy,
            address(this),
            block.timestamp + 300
        );

        uint256 wbnbBalance = IERC20(WBNB).balanceOf(address(this));
        require(wbnbBalance >= repayWBNB, "FAL: insufficient for repayment");

        // ── Step 4: Repay PancakeSwap pair directly ──
        IERC20(WBNB).transfer(PANCAKE_PAIR, repayWBNB);

        // ── Step 5: Profit to owner ──
        uint256 profit = IERC20(WBNB).balanceOf(address(this));
        if (profit > 0) {
            IERC20(WBNB).transfer(owner, profit);
            totalProfitWBNB += profit;
        }
        totalArbs++;
        emit ArbExecuted(borrowedWBNB, profit, block.timestamp);
    }

    // ─────────────────────────────────────────────────────────────
    // VIEW — QUOTE OPPORTUNITY
    // ─────────────────────────────────────────────────────────────

    /**
     * @notice Returns expected profit (in WBNB) for a given borrow amount.
     *         Negative result = not profitable. Call off-chain before executing.
     * @param wbnbAmount  Amount to simulate borrowing
     */
    function quoteArb(uint256 wbnbAmount)
        external view
        returns (uint256 usdtOut, uint256 wbnbBack, uint256 repayAmount, bool profitable)
    {
        address[] memory pathSell = new address[](2);
        pathSell[0] = WBNB;
        pathSell[1] = USDT;
        uint256[] memory s = IPancakeRouter02(BISWAP_ROUTER).getAmountsOut(wbnbAmount, pathSell);
        usdtOut = s[s.length - 1];

        address[] memory pathBuy = new address[](2);
        pathBuy[0] = USDT;
        pathBuy[1] = WBNB;
        uint256[] memory b = IPancakeRouter02(PANCAKE_ROUTER).getAmountsOut(usdtOut, pathBuy);
        wbnbBack = b[b.length - 1];

        repayAmount = (wbnbAmount * 10000 + 9974) / 9975;
        profitable = wbnbBack > repayAmount;
    }

    // ─────────────────────────────────────────────────────────────
    // ADMIN
    // ─────────────────────────────────────────────────────────────

    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "FAL: zero address");
        owner = newOwner;
    }

    function withdraw(address token) external onlyOwner {
        uint256 balance = IERC20(token).balanceOf(address(this));
        require(balance > 0, "FAL: nothing to withdraw");
        IERC20(token).transfer(owner, balance);
        emit Withdrawn(token, balance);
    }

    function withdrawBNB() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "FAL: no BNB");
        payable(owner).transfer(balance);
    }

    receive() external payable {}
}
