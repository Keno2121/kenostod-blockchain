// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// ─────────────────────────────────────────────────────────────────────────────
// PancakeSwap v4 — Minimal interface subset required by UTLHook
// Full spec: https://github.com/pancakeswap/pancake-v4-core
// ─────────────────────────────────────────────────────────────────────────────

struct PoolKey {
    address currency0;          // token0 (lower address)
    address currency1;          // token1 (higher address)
    uint24  fee;                // pool fee tier (e.g. 2500 = 0.25%)
    int24   tickSpacing;        // tick granularity
    address hooks;              // hook contract address — must encode permissions in address bits
}

struct SwapParams {
    bool    zeroForOne;         // true = currency0 → currency1
    int256  amountSpecified;    // positive = exact-in, negative = exact-out
    uint160 sqrtPriceLimitX96;  // price cap
}

// BalanceDelta: packed int128 (amount0Delta, amount1Delta)
// Positive = pool owes caller.  Negative = caller owes pool.
type BalanceDelta is int256;

library BalanceDeltaLib {
    function amount0(BalanceDelta delta) internal pure returns (int128) {
        return int128(int256(BalanceDelta.unwrap(delta)) >> 128);
    }
    function amount1(BalanceDelta delta) internal pure returns (int128) {
        return int128(int256(BalanceDelta.unwrap(delta)));
    }
}

interface IPoolManager {
    function take(address currency, address to, uint256 amount) external;
    function sync(address currency) external returns (uint256 balance);
    function settle(address currency) external payable returns (uint256 paid);
}

// Hook permission flags — encoded into the hook contract address bits
// The pool manager checks the hook address against these flags at pool creation
library Hooks {
    uint160 constant BEFORE_INITIALIZE_FLAG     = 1 << 13;
    uint160 constant AFTER_INITIALIZE_FLAG      = 1 << 12;
    uint160 constant BEFORE_ADD_LIQUIDITY_FLAG  = 1 << 11;
    uint160 constant AFTER_ADD_LIQUIDITY_FLAG   = 1 << 10;
    uint160 constant BEFORE_REMOVE_LIQUIDITY_FLAG = 1 << 9;
    uint160 constant AFTER_REMOVE_LIQUIDITY_FLAG  = 1 << 8;
    uint160 constant BEFORE_SWAP_FLAG           = 1 << 7;
    uint160 constant AFTER_SWAP_FLAG            = 1 << 6;   // ← UTLHook uses this
    uint160 constant BEFORE_DONATE_FLAG         = 1 << 5;
    uint160 constant AFTER_DONATE_FLAG          = 1 << 4;
}

interface ICLHooks {
    function beforeInitialize(address sender, PoolKey calldata key, uint160 sqrtPriceX96, bytes calldata hookData)
        external returns (bytes4);

    function afterInitialize(address sender, PoolKey calldata key, uint160 sqrtPriceX96, int24 tick, bytes calldata hookData)
        external returns (bytes4);

    function beforeAddLiquidity(address sender, PoolKey calldata key, bytes calldata hookData)
        external returns (bytes4);

    function afterAddLiquidity(address sender, PoolKey calldata key, BalanceDelta delta, bytes calldata hookData)
        external returns (bytes4);

    function beforeRemoveLiquidity(address sender, PoolKey calldata key, bytes calldata hookData)
        external returns (bytes4);

    function afterRemoveLiquidity(address sender, PoolKey calldata key, BalanceDelta delta, bytes calldata hookData)
        external returns (bytes4);

    function beforeSwap(address sender, PoolKey calldata key, SwapParams calldata params, bytes calldata hookData)
        external returns (bytes4);

    // ← The one that matters for UTL
    function afterSwap(address sender, PoolKey calldata key, SwapParams calldata params, BalanceDelta delta, bytes calldata hookData)
        external returns (bytes4);

    function beforeDonate(address sender, PoolKey calldata key, uint256 amount0, uint256 amount1, bytes calldata hookData)
        external returns (bytes4);

    function afterDonate(address sender, PoolKey calldata key, uint256 amount0, uint256 amount1, bytes calldata hookData)
        external returns (bytes4);
}
