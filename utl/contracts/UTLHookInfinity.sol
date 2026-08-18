// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title UTLHookInfinity — PancakeSwap Infinity (v4) afterSwap Fee Hook
 * @notice Intercepts every swap on registered KENO pools and routes 0.09% of
 *         swap output to the UTL Protocol fee pipeline (UTLFeeCollector).
 *         FeeCollector then splits: 60% → KENO stakers, 40% → Treasury.
 *
 * @dev    PancakeSwap Infinity uses getHooksRegistrationBitmap() — no address
 *         bit mining required. Deploy at any address.
 *
 *         Deployment order:
 *           1. Deploy UTLHookInfinity (pass vault + clPoolManager + feeCollector)
 *           2. Initialize KENO/WBNB CL pool via CLPoolManager with hook in PoolKey
 *           3. Call registerPool() on this hook with the PoolKey
 *           4. Add initial liquidity via CLPositionManager
 *
 * @author Kenostod Blockchain Academy LLC — T.D.I.R. Foundation
 */

// ─── PancakeSwap Infinity Interfaces (inlined) ────────────────────────────────

// Currency is address under the hood
type Currency is address;

// BalanceDelta is packed int128 amount0 | int128 amount1
type BalanceDelta is int256;

library BalanceDeltaLib {
    function amount0(BalanceDelta delta) internal pure returns (int128) {
        return int128(int256(BalanceDelta.unwrap(delta) >> 128));
    }
    function amount1(BalanceDelta delta) internal pure returns (int128) {
        return int128(int256(BalanceDelta.unwrap(delta)));
    }
}

/**
 * @notice PancakeSwap Infinity PoolKey
 * @dev currency0 < currency1 (sorted by address)
 *      parameters for CL pools encodes tickSpacing as uint24 at bits 0–23:
 *        bytes32(uint256(uint24(tickSpacing)))
 */
struct PoolKey {
    Currency currency0;
    Currency currency1;
    address  hooks;       // this contract
    address  poolManager; // CLPoolManager
    uint24   fee;
    bytes32  parameters;  // encodes tickSpacing
}

struct SwapParams {
    bool    zeroForOne;
    int256  amountSpecified;
    uint160 sqrtPriceLimitX96;
}

interface IVault {
    function take(Currency currency, address to, uint256 amount) external;
}

// ─── ERC-20 minimal ───────────────────────────────────────────────────────────

interface IERC20Min {
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

// ─── UTLHookInfinity ─────────────────────────────────────────────────────────

contract UTLHookInfinity {
    using BalanceDeltaLib for BalanceDelta;

    // ── Constants ─────────────────────────────────────────────────────────────

    uint256 public constant FEE_DENOMINATOR = 100_000;
    uint256 public constant DEFAULT_HOOK_FEE = 90;  // 0.09% = 90 / 100_000

    // Hook registration bitmap offset for afterSwap (PancakeSwap Infinity spec)
    // HOOKS_AFTER_SWAP_OFFSET = 7  →  bitmap = 1 << 7 = 0x0080
    uint16 private constant AFTER_SWAP_BIT = uint16(1 << 7);

    // KENO v2 on BSC
    address public constant KENO = 0x48BB049Afe50B050b458624Dc6233acd51024AB4;

    // WBNB
    address public constant WBNB = 0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c;

    // ── Immutables ────────────────────────────────────────────────────────────

    /// @notice PancakeSwap Infinity Vault — holds tokens, exposes take()
    address public immutable vault;

    /// @notice PancakeSwap Infinity CLPoolManager — calls afterSwap on this hook
    address public immutable poolManager;

    // ── State ─────────────────────────────────────────────────────────────────

    address public feeCollector;
    address public owner;

    uint256 public hookFeeRate = DEFAULT_HOOK_FEE;
    bool    public paused;

    // Lifetime stats
    uint256 public totalFeesCollectedWbnb;
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
     * @param _vault         PancakeSwap Infinity Vault on BSC
     *                       Mainnet: 0x238a358808379702088667322f80aC48bAd5e6c4
     * @param _poolManager   PancakeSwap Infinity CLPoolManager on BSC
     *                       Mainnet: 0xa0FfB9c1CE1Fe56963B0321B32E7A0302114058b
     * @param _feeCollector  Deployed UTLFeeCollector address
     */
    constructor(address _vault, address _poolManager, address _feeCollector) {
        require(_vault        != address(0), "UTLHook: zero vault");
        require(_poolManager  != address(0), "UTLHook: zero poolManager");
        require(_feeCollector != address(0), "UTLHook: zero feeCollector");
        vault        = _vault;
        poolManager  = _poolManager;
        feeCollector = _feeCollector;
        owner        = tx.origin;
    }

    // ── PancakeSwap Infinity Hook Registration ────────────────────────────────

    /**
     * @notice Returns the bitmap of hook callbacks this contract implements.
     *         Bit 7 (HOOKS_AFTER_SWAP_OFFSET) = afterSwap.
     *         Called by CLPoolManager to determine which callbacks to invoke.
     */
    function getHooksRegistrationBitmap() external pure returns (uint16) {
        return AFTER_SWAP_BIT; // 0x0080
    }

    // ── PancakeSwap Infinity Hook Callback ────────────────────────────────────

    /**
     * @notice Called by CLPoolManager after every swap on a pool that has
     *         this hook registered in its PoolKey.
     * @dev    Returns (selector, hookDeltaUnspecified).
     *         hookDeltaUnspecified < 0 means the hook is taking |amount| from
     *         the output side, reducing what the swapper receives.
     *         We then call vault.take() to physically receive the tokens and
     *         forward them to FeeCollector.
     */
    function afterSwap(
        address,                              // sender (unused)
        PoolKey calldata key,
        SwapParams calldata params,
        BalanceDelta delta,
        bytes calldata                        // hookData (unused)
    )
        external
        onlyPoolManager
        notPaused
        returns (bytes4 selector, int128 hookDeltaUnspecified)
    {
        selector = this.afterSwap.selector;

        bytes32 poolId = _poolId(key);
        if (!registeredPools[poolId]) {
            return (selector, 0);
        }

        totalSwapsIntercepted++;

        // Determine output token and output amount from BalanceDelta.
        // For zeroForOne swaps: user sends currency0 in, receives currency1 out.
        // For oneForZero swaps: user sends currency1 in, receives currency0 out.
        // The output side has a positive delta (pool owes tokens to the swapper).

        address outputToken;
        uint256 outputAmount;

        if (params.zeroForOne) {
            // currency1 is the output
            int128 amt1 = delta.amount1();
            if (amt1 <= 0) return (selector, 0);
            outputToken  = Currency.unwrap(key.currency1);
            outputAmount = uint256(uint128(amt1));
        } else {
            // currency0 is the output
            int128 amt0 = delta.amount0();
            if (amt0 <= 0) return (selector, 0);
            outputToken  = Currency.unwrap(key.currency0);
            outputAmount = uint256(uint128(amt0));
        }

        // Calculate 0.09% hook fee
        uint256 feeAmount = (outputAmount * hookFeeRate) / FEE_DENOMINATOR;
        if (feeAmount == 0) return (selector, 0);

        // Signal to CLPoolManager that the hook is taking feeAmount from output
        // (negative = hook reduces what the swapper receives)
        hookDeltaUnspecified = -int128(int256(feeAmount));

        // Physically pull the fee tokens from the Vault to this contract
        IVault(vault).take(
            Currency.wrap(outputToken),
            address(this),
            feeAmount
        );

        // Forward to UTLFeeCollector
        bool sent = IERC20Min(outputToken).transfer(feeCollector, feeAmount);
        require(sent, "UTLHook: fee transfer failed");

        // Track stats
        if (outputToken == WBNB) {
            totalFeesCollectedWbnb += feeAmount;
        } else if (outputToken == KENO) {
            totalFeesCollectedKeno += feeAmount;
        }

        emit FeeCollected(poolId, outputToken, feeAmount, block.timestamp);
    }

    // ── Admin — Pool Registration ─────────────────────────────────────────────

    /**
     * @notice Register a pool so the hook activates for its swaps.
     * @dev    The PoolKey used here must exactly match the one used when the
     *         pool was initialized (same hooks address, same poolManager, etc.).
     */
    function registerPool(PoolKey calldata key) external onlyOwner {
        bytes32 pid = _poolId(key);
        registeredPools[pid] = true;
        emit PoolRegistered(pid, Currency.unwrap(key.currency0), Currency.unwrap(key.currency1));
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

    function recoverToken(address token, uint256 amount) external onlyOwner {
        bool ok = IERC20Min(token).transfer(owner, amount);
        require(ok, "UTLHook: recovery failed");
    }

    // ── View ──────────────────────────────────────────────────────────────────

    function getStats() external view returns (
        uint256 swapsIntercepted,
        uint256 wbnbCollected,
        uint256 kenoCollected,
        uint256 currentFeeRate,
        bool    isPaused
    ) {
        return (
            totalSwapsIntercepted,
            totalFeesCollectedWbnb,
            totalFeesCollectedKeno,
            hookFeeRate,
            paused
        );
    }

    function isPoolRegistered(PoolKey calldata key) external view returns (bool) {
        return registeredPools[_poolId(key)];
    }

    // ── Internal ──────────────────────────────────────────────────────────────

    function _poolId(PoolKey calldata key) internal pure returns (bytes32) {
        return keccak256(abi.encode(
            key.currency0,
            key.currency1,
            key.hooks,
            key.poolManager,
            key.fee,
            key.parameters
        ));
    }
}
