// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title UTLHook — PancakeSwap v4 afterSwap Fee Hook
 * @notice Intercepts every swap on registered KENO pools and routes 0.09% of
 *         swap output to the UTL Protocol fee pipeline (UTLFeeCollector).
 *         FeeCollector then splits: 60% → KENO stakers, 40% → Treasury.
 *
 * @dev    PancakeSwap v4 hook address requirements:
 *         Bit 6 (0x0040) of the lower 2 bytes of this contract's address MUST be set.
 *         Deploy via CREATE2 using the salt miner script: scripts/mineHookSalt.js
 *
 * Deployment order:
 *   1. Mine a CREATE2 salt that yields an address with bit 0x0040 set.
 *   2. Deploy UTLHook using that salt.
 *   3. Register UTLHook in the PoolKey when creating the KENO/USDC CLPool.
 *
 * @author Kenostod Blockchain Academy LLC — T.D.I.R. Foundation
 */

// ─── PancakeSwap v4 Interfaces (inlined — no external package required) ───────

interface IPoolManager {
    struct SwapParams {
        bool   zeroForOne;
        int256 amountSpecified;
        uint160 sqrtPriceLimitX96;
    }

    function take(address currency, address to, uint256 amount) external;
    function sync(address currency) external;
    function settle() external payable returns (uint256 paid);
}

// BalanceDelta is packed as int128 amount0 | int128 amount1
type BalanceDelta is int256;

library BalanceDeltaLib {
    function amount0(BalanceDelta delta) internal pure returns (int128) {
        return int128(int256(BalanceDelta.unwrap(delta) >> 128));
    }
    function amount1(BalanceDelta delta) internal pure returns (int128) {
        return int128(int256(BalanceDelta.unwrap(delta)));
    }
}

struct PoolKey {
    address currency0;
    address currency1;
    uint24  fee;
    int24   tickSpacing;
    address hooks;
}

// Hook return selector constants
bytes4 constant AFTER_SWAP_SELECTOR = IUTLHook.afterSwap.selector;

interface IUTLHook {
    function afterSwap(
        address sender,
        PoolKey calldata key,
        IPoolManager.SwapParams calldata params,
        BalanceDelta delta,
        bytes calldata hookData
    ) external returns (bytes4 selector, int128 hookDeltaUnspecified);
}

// ─── ERC-20 minimal interface ─────────────────────────────────────────────────

interface IERC20Min {
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

// ─── UTLHook ──────────────────────────────────────────────────────────────────

contract UTLHook {
    using BalanceDeltaLib for BalanceDelta;

    // ── Constants ─────────────────────────────────────────────────────────────

    uint256 public constant FEE_DENOMINATOR = 100_000;
    uint256 public constant DEFAULT_HOOK_FEE = 90;      // 0.09% = 90 / 100_000

    // BSC USDC (18 decimals on BSC)
    address public constant USDC = 0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d;

    // KENO token
    address public constant KENO = 0x65791E0B5Cbac5F40c76cDe31bf4F074D982FD0E;

    // ── State ─────────────────────────────────────────────────────────────────

    address public immutable poolManager;
    address public feeCollector;
    address public owner;

    uint256 public hookFeeRate = DEFAULT_HOOK_FEE;

    bool public paused;

    // Lifetime stats
    uint256 public totalFeesCollectedUsdc;
    uint256 public totalFeesCollectedKeno;
    uint256 public totalSwapsIntercepted;

    // Per-pool opt-in: only registered pool IDs trigger fee collection
    mapping(bytes32 => bool) public registeredPools;

    // ── Events ────────────────────────────────────────────────────────────────

    event PoolRegistered(bytes32 indexed poolId, address currency0, address currency1);
    event PoolDeregistered(bytes32 indexed poolId);
    event FeeCollected(
        bytes32 indexed poolId,
        address indexed token,
        uint256 amount,
        uint256 timestamp
    );
    event FeeRateUpdated(uint256 oldRate, uint256 newRate);
    event FeeCollectorUpdated(address oldCollector, address newCollector);
    event Paused(bool state);
    event OwnershipTransferred(address indexed oldOwner, address indexed newOwner);

    // ── Modifiers ─────────────────────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "UTLHook: not owner");
        _;
    }

    modifier onlyPoolManager() {
        require(msg.sender == poolManager, "UTLHook: not pool manager");
        _;
    }

    modifier notPaused() {
        require(!paused, "UTLHook: paused");
        _;
    }

    // ── Constructor ───────────────────────────────────────────────────────────

    /**
     * @param _poolManager   PancakeSwap v4 CLPoolManager on BSC
     *                       Mainnet: 0x28e2Ea090877bE573591Cba87A5fEB42AC4Ed9aF
     * @param _feeCollector  Deployed UTLFeeCollector address
     *                       Mainnet: 0xfE537c43d202C455Cedc141B882c808287BB662f
     */
    constructor(address _poolManager, address _feeCollector) {
        require(_poolManager  != address(0), "UTLHook: zero poolManager");
        require(_feeCollector != address(0), "UTLHook: zero feeCollector");
        poolManager  = _poolManager;
        feeCollector = _feeCollector;
        // Use tx.origin so safe wallet is owner even when deployed via CREATE2 factory
        owner        = tx.origin;
    }

    // ── PancakeSwap v4 Hook Callback ──────────────────────────────────────────

    /**
     * @notice Called by PoolManager after every swap on a registered pool.
     * @dev    Returns (selector, hookDeltaUnspecified).
     *         hookDeltaUnspecified < 0 means the hook is taking |amount| from the
     *         output side, reducing what the swapper receives.
     *         The PoolManager will enforce the accounting; we then call take() to
     *         physically receive the tokens and forward them to FeeCollector.
     */
    function afterSwap(
        address,                              // sender (unused)
        PoolKey calldata key,
        IPoolManager.SwapParams calldata params,
        BalanceDelta delta,
        bytes calldata                        // hookData (unused)
    )
        external
        onlyPoolManager
        notPaused
        returns (bytes4 selector, int128 hookDeltaUnspecified)
    {
        bytes32 poolId = _poolId(key);

        if (!registeredPools[poolId]) {
            return (AFTER_SWAP_SELECTOR, 0);
        }

        totalSwapsIntercepted++;

        // Determine output token and output amount from BalanceDelta.
        // delta.amount0 > 0 means pool is sending currency0 out (user receives currency0).
        // delta.amount1 > 0 means pool is sending currency1 out (user receives currency1).
        // For zeroForOne swaps: user sends currency0 in, receives currency1 out.
        // For oneForZero swaps: user sends currency1 in, receives currency0 out.

        address outputToken;
        uint256 outputAmount;

        if (params.zeroForOne) {
            // currency1 is the output
            int128 amt1 = delta.amount1();
            if (amt1 <= 0) return (AFTER_SWAP_SELECTOR, 0);
            outputToken  = key.currency1;
            outputAmount = uint256(uint128(amt1));
        } else {
            // currency0 is the output
            int128 amt0 = delta.amount0();
            if (amt0 <= 0) return (AFTER_SWAP_SELECTOR, 0);
            outputToken  = key.currency0;
            outputAmount = uint256(uint128(amt0));
        }

        // Calculate 0.09% hook fee
        uint256 feeAmount = (outputAmount * hookFeeRate) / FEE_DENOMINATOR;
        if (feeAmount == 0) return (AFTER_SWAP_SELECTOR, 0);

        // Signal to PoolManager that the hook is taking feeAmount from the output
        // (negative = hook reduces what the swapper receives)
        hookDeltaUnspecified = -int128(int256(feeAmount));

        // Physically pull the fee tokens from PoolManager to this contract
        IPoolManager(poolManager).take(outputToken, address(this), feeAmount);

        // Forward to UTLFeeCollector — accumulate then forward in batch via forwardTokenFees()
        // For immediate forwarding, transfer directly here
        bool sent = IERC20Min(outputToken).transfer(feeCollector, feeAmount);
        require(sent, "UTLHook: fee transfer failed");

        // Track stats
        if (outputToken == USDC) {
            totalFeesCollectedUsdc += feeAmount;
        } else if (outputToken == KENO) {
            totalFeesCollectedKeno += feeAmount;
        }

        emit FeeCollected(poolId, outputToken, feeAmount, block.timestamp);

        return (AFTER_SWAP_SELECTOR, hookDeltaUnspecified);
    }

    // ── Admin — Pool Registration ─────────────────────────────────────────────

    /**
     * @notice Register a pool so the hook activates for its swaps.
     * @dev    Pool must have this contract set as its hooks address.
     */
    function registerPool(PoolKey calldata key) external onlyOwner {
        bytes32 pid = _poolId(key);
        registeredPools[pid] = true;
        emit PoolRegistered(pid, key.currency0, key.currency1);
    }

    function deregisterPool(PoolKey calldata key) external onlyOwner {
        bytes32 pid = _poolId(key);
        registeredPools[pid] = false;
        emit PoolDeregistered(pid);
    }

    // ── Admin — Configuration ─────────────────────────────────────────────────

    function setFeeRate(uint256 newRate) external onlyOwner {
        require(newRate <= 500, "UTLHook: fee too high"); // max 0.5%
        emit FeeRateUpdated(hookFeeRate, newRate);
        hookFeeRate = newRate;
    }

    function setFeeCollector(address newCollector) external onlyOwner {
        require(newCollector != address(0), "UTLHook: zero address");
        emit FeeCollectorUpdated(feeCollector, newCollector);
        feeCollector = newCollector;
    }

    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit Paused(_paused);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "UTLHook: zero address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    // ── Emergency Token Recovery ──────────────────────────────────────────────

    /**
     * @notice Recover any tokens stuck in this contract (e.g. failed transfers).
     */
    function recoverToken(address token, uint256 amount) external onlyOwner {
        bool ok = IERC20Min(token).transfer(owner, amount);
        require(ok, "UTLHook: recovery failed");
    }

    // ── View ──────────────────────────────────────────────────────────────────

    function getStats() external view returns (
        uint256 swapsIntercepted,
        uint256 usdcCollected,
        uint256 kenoCollected,
        uint256 currentFeeRate,
        bool    isPaused
    ) {
        return (
            totalSwapsIntercepted,
            totalFeesCollectedUsdc,
            totalFeesCollectedKeno,
            hookFeeRate,
            paused
        );
    }

    function isPoolRegistered(PoolKey calldata key) external view returns (bool) {
        return registeredPools[_poolId(key)];
    }

    /**
     * @notice Validate that this contract's address has bit 0x0040 set.
     *         Required by PancakeSwap v4 for afterSwap hooks.
     *         Call this after deployment to confirm the address is valid.
     */
    function validateHookAddress() external view returns (bool valid) {
        uint160 addr = uint160(address(this));
        return (addr & 0x0040) != 0;
    }

    // ── Internal ──────────────────────────────────────────────────────────────

    function _poolId(PoolKey calldata key) internal pure returns (bytes32) {
        return keccak256(abi.encode(
            key.currency0,
            key.currency1,
            key.fee,
            key.tickSpacing,
            key.hooks
        ));
    }
}
