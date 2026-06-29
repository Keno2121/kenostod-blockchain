// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * FlashOrbBot — Atomic Flash Arbitrage Contract
 * Kenostod Blockchain Academy LLC
 *
 * Uses PancakeSwap V2 flash swaps to borrow WBNB with zero capital,
 * arbitrage across DEX pairs, repay the loan + fee in one atomic tx.
 * If the trade is unprofitable the entire transaction reverts — no loss.
 */

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
}

interface IPancakePair {
    function swap(uint amount0Out, uint amount1Out, address to, bytes calldata data) external;
    function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
    function token0() external view returns (address);
    function token1() external view returns (address);
}

interface IPancakeRouter {
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

contract FlashOrbBot {
    address public owner;
    address public constant WBNB    = 0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c;
    address public constant BUSD    = 0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56;
    address public constant USDT    = 0x55d398326f99059fF775485246999027B3197955;
    address public constant KENO    = 0x65791E0B5Cbac5F40c76cDe31bf4F074D982FD0E;

    // PancakeSwap V2
    address public constant PC_ROUTER  = 0x10ED43C718714eb63d5aA57B78B54704E256024E;
    address public constant PC_FACTORY = 0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73;

    // BiSwap (alternative DEX for arb leg)
    address public constant BISWAP_ROUTER = 0x3a6d8cA21D1CF76F653A67577FA0D27453350dD8;

    uint256 public totalProfitWBNB;
    uint256 public totalExecutions;

    event FlashArbExecuted(
        uint256 borrowed,
        uint256 profit,
        uint256 direction,
        uint256 timestamp
    );
    event ProfitWithdrawn(address token, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "FlashOrbBot: NOT_OWNER");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /**
     * @dev Initiate a flash arb.
     * @param pair     PancakeSwap pair to borrow from
     * @param borrowWBNB  Amount of WBNB to borrow
     * @param direction   0 = PC->BiSwap, 1 = BiSwap->PC
     */
    function startFlashArb(
        address pair,
        uint256 borrowWBNB,
        uint256 direction
    ) external onlyOwner {
        bytes memory data = abi.encode(borrowWBNB, direction, pair);
        IPancakePair pairContract = IPancakePair(pair);

        address token0 = pairContract.token0();
        uint256 amount0Out = token0 == WBNB ? borrowWBNB : 0;
        uint256 amount1Out = token0 == WBNB ? 0 : borrowWBNB;

        pairContract.swap(amount0Out, amount1Out, address(this), data);
    }

    /**
     * @dev PancakeSwap flash swap callback
     */
    function pancakeCall(
        address sender,
        uint256 amount0,
        uint256 amount1,
        bytes calldata data
    ) external {
        (uint256 borrowedAmount, uint256 direction, address pair) =
            abi.decode(data, (uint256, uint256, address));

        require(sender == address(this), "FlashOrbBot: INVALID_SENDER");

        uint256 wbnbBalance = IERC20(WBNB).balanceOf(address(this));
        require(wbnbBalance >= borrowedAmount, "FlashOrbBot: BORROW_FAILED");

        uint256 profit;

        if (direction == 0) {
            // Sell WBNB for KENO on PancakeSwap, then sell KENO back for WBNB on BiSwap
            profit = _arbPCToBiSwap(borrowedAmount);
        } else {
            // Sell WBNB for KENO on BiSwap, then sell KENO back for WBNB on PancakeSwap
            profit = _arbBiSwapToPC(borrowedAmount);
        }

        // Calculate repayment (PancakeSwap fee = 0.25%)
        uint256 repayAmount = (borrowedAmount * 10025) / 10000;

        require(
            IERC20(WBNB).balanceOf(address(this)) >= repayAmount,
            "FlashOrb: UNPROFITABLE — transaction reverted"
        );

        // Repay flash loan
        IERC20(WBNB).transfer(pair, repayAmount);

        uint256 actualProfit = IERC20(WBNB).balanceOf(address(this));
        totalProfitWBNB += actualProfit;
        totalExecutions++;

        emit FlashArbExecuted(borrowedAmount, actualProfit, direction, block.timestamp);
    }

    function _arbPCToBiSwap(uint256 wbnbIn) internal returns (uint256) {
        // Step 1: WBNB → KENO on PancakeSwap
        IERC20(WBNB).approve(PC_ROUTER, wbnbIn);
        address[] memory path1 = new address[](2);
        path1[0] = WBNB;
        path1[1] = KENO;

        uint[] memory amounts1 = IPancakeRouter(PC_ROUTER).swapExactTokensForTokens(
            wbnbIn, 1, path1, address(this), block.timestamp + 300
        );
        uint256 kenoReceived = amounts1[amounts1.length - 1];

        // Step 2: KENO → WBNB on BiSwap
        IERC20(KENO).approve(BISWAP_ROUTER, kenoReceived);
        address[] memory path2 = new address[](2);
        path2[0] = KENO;
        path2[1] = WBNB;

        IPancakeRouter(BISWAP_ROUTER).swapExactTokensForTokens(
            kenoReceived, 1, path2, address(this), block.timestamp + 300
        );

        return IERC20(WBNB).balanceOf(address(this));
    }

    function _arbBiSwapToPC(uint256 wbnbIn) internal returns (uint256) {
        // Step 1: WBNB → KENO on BiSwap
        IERC20(WBNB).approve(BISWAP_ROUTER, wbnbIn);
        address[] memory path1 = new address[](2);
        path1[0] = WBNB;
        path1[1] = KENO;

        uint[] memory amounts1 = IPancakeRouter(BISWAP_ROUTER).swapExactTokensForTokens(
            wbnbIn, 1, path1, address(this), block.timestamp + 300
        );
        uint256 kenoReceived = amounts1[amounts1.length - 1];

        // Step 2: KENO → WBNB on PancakeSwap
        IERC20(KENO).approve(PC_ROUTER, kenoReceived);
        address[] memory path2 = new address[](2);
        path2[0] = KENO;
        path2[1] = WBNB;

        IPancakeRouter(PC_ROUTER).swapExactTokensForTokens(
            kenoReceived, 1, path2, address(this), block.timestamp + 300
        );

        return IERC20(WBNB).balanceOf(address(this));
    }

    /**
     * @dev Quote potential profit without spending gas
     */
    function quoteArb(uint256 wbnbAmount, uint256 direction)
        external view returns (int256 estimatedProfitWei)
    {
        address[] memory path1 = new address[](2);
        address[] memory path2 = new address[](2);
        path1[0] = WBNB; path1[1] = KENO;
        path2[0] = KENO; path2[1] = WBNB;

        address buyRouter  = direction == 0 ? PC_ROUTER : BISWAP_ROUTER;
        address sellRouter = direction == 0 ? BISWAP_ROUTER : PC_ROUTER;

        try IPancakeRouter(buyRouter).getAmountsOut(wbnbAmount, path1)
            returns (uint[] memory out1)
        {
            uint256 kenoOut = out1[1];
            try IPancakeRouter(sellRouter).getAmountsOut(kenoOut, path2)
                returns (uint[] memory out2)
            {
                uint256 wbnbOut = out2[1];
                uint256 repay  = (wbnbAmount * 10025) / 10000;
                return int256(wbnbOut) - int256(repay);
            } catch {
                return type(int256).min;
            }
        } catch {
            return type(int256).min;
        }
    }

    function withdrawToken(address token, uint256 amount) external onlyOwner {
        IERC20(token).transfer(owner, amount);
        emit ProfitWithdrawn(token, amount);
    }

    function withdrawBNB() external onlyOwner {
        payable(owner).transfer(address(this).balance);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "FlashOrbBot: ZERO_ADDRESS");
        owner = newOwner;
    }

    receive() external payable {}
}
