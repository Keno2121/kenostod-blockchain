// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// ─────────────────────────────────────────────────────────────────────────────
//
//  UTL Hook — Universal Transaction Layer × PancakeSwap v4
//
//  Every swap on a UTL-enabled pool triggers this hook.
//  afterSwap() extracts a micro-fee and routes it to the UTL FeeCollector.
//  Stakers earn 60% of every fee collected.  T.D.I.R. Foundation earns 25%.
//  UTL Treasury earns 15%.
//
//  Deployment requirement:
//  The contract address MUST have bit 6 set (AFTER_SWAP_FLAG = 1 << 6 = 64).
//  Use the HookMiner helper during deployment to find a valid salt.
//
//  Author: Kenostod Blockchain Academy LLC — T.D.I.R. Foundation
//  Network: BSC Mainnet (chainId 56)
//
// ─────────────────────────────────────────────────────────────────────────────

import "../interfaces/IPancakeV4.sol";
import "../interfaces/IUTLFeeCollector.sol";

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract UTLHook is ICLHooks {

    // ── Selector constants (returned from hook callbacks) ─────────────────
    bytes4 constant AFTER_SWAP_SELECTOR = ICLHooks.afterSwap.selector;
    bytes4 constant NOOP_SELECTOR       = 0x00000000;

    // ── UTL Protocol addresses (BSC Mainnet) ─────────────────────────────
    address public constant UTL_FEE_COLLECTOR =
        0xfE537c43d202C455Cedc141B882c808287BB662f;

    address public constant TDIR_FOUNDATION =
        0x3B3538b955647d811D42400084e9409e6593bE97;

    // USDC on BSC
    address public constant USDC =
        0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d;

    // WBNB on BSC
    address public constant WBNB =
        0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c;

    // ── Pool manager (set at construction) ────────────────────────────────
    IPoolManager public immutable poolManager;

    // ── Fee configuration ─────────────────────────────────────────────────
    // UTL charges 0.09% on the output amount of every swap.
    // This sits ON TOP of the PancakeSwap pool fee — traders pay both.
    uint256 public constant UTL_FEE_BPS = 9;          // 9 basis points = 0.09%
    uint256 public constant BPS_DENOMINATOR = 10_000;

    bytes32 public constant FEE_TYPE = keccak256("PANCAKE_SWAP_HOOK_FEE");

    // ── Access control ────────────────────────────────────────────────────
    address public owner;

    // ── Fee accounting ────────────────────────────────────────────────────
    // Tracks cumulative gross fees collected per token
    mapping(address => uint256) public totalFeesCollected;

    // Tracks which pool keys (by hash) are authorized to use this hook
    mapping(bytes32 => bool) public authorizedPools;

    // ── Events ────────────────────────────────────────────────────────────
    event SwapFeeCollected(
        bytes32 indexed poolId,
        address indexed token,
        uint256 grossFee,
        address swapper
    );

    event PoolAuthorized(bytes32 indexed poolId, address indexed currency0, address indexed currency1);
    event OwnershipTransferred(address indexed previous, address indexed next);

    // ── Errors ────────────────────────────────────────────────────────────
    error OnlyPoolManager();
    error OnlyOwner();
    error ZeroAddress();
    error PoolNotAuthorized();
    error FeeTransferFailed();

    // ─────────────────────────────────────────────────────────────────────
    constructor(address _poolManager) {
        if (_poolManager == address(0)) revert ZeroAddress();
        poolManager = IPoolManager(_poolManager);
        owner = msg.sender;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    modifier onlyPoolManager() {
        if (msg.sender != address(poolManager)) revert OnlyPoolManager();
        _;
    }

    // ─────────────────────────────────────────────────────────────────────
    // Admin
    // ─────────────────────────────────────────────────────────────────────

    function authorizePool(PoolKey calldata key) external onlyOwner {
        bytes32 poolId = keccak256(abi.encode(key));
        authorizedPools[poolId] = true;
        emit PoolAuthorized(poolId, key.currency0, key.currency1);
    }

    function revokePool(PoolKey calldata key) external onlyOwner {
        bytes32 poolId = keccak256(abi.encode(key));
        authorizedPools[poolId] = false;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    // Emergency rescue — in case tokens get stuck
    function rescueTokens(address token, uint256 amount) external onlyOwner {
        IERC20(token).transfer(owner, amount);
    }

    // ─────────────────────────────────────────────────────────────────────
    // Core hook — afterSwap
    // ─────────────────────────────────────────────────────────────────────

    function afterSwap(
        address sender,
        PoolKey calldata key,
        SwapParams calldata params,
        BalanceDelta delta,
        bytes calldata
    ) external override onlyPoolManager returns (bytes4) {

        bytes32 poolId = keccak256(abi.encode(key));
        if (!authorizedPools[poolId]) revert PoolNotAuthorized();

        // Determine which token flowed OUT of the pool to the swapper
        // (that's the token we denominate the UTL fee in)
        (address feeToken, uint256 outputAmount) = _resolveOutput(key, params, delta);

        if (outputAmount == 0) return AFTER_SWAP_SELECTOR;

        // Calculate UTL fee: 0.09% of output
        uint256 fee = (outputAmount * UTL_FEE_BPS) / BPS_DENOMINATOR;
        if (fee == 0) return AFTER_SWAP_SELECTOR;

        // Pull the fee from the swapper (sender) — they must have approved this hook
        // Note: In a production deployment this can be handled via the pool manager's
        // settle/take flow for atomic, trust-minimised fee extraction
        bool ok = IERC20(feeToken).transferFrom(sender, address(this), fee);
        if (!ok) revert FeeTransferFailed();

        // Forward to UTL FeeCollector — it handles 60/25/15 split on-chain
        IERC20(feeToken).approve(UTL_FEE_COLLECTOR, fee);
        IUTLFeeCollector(UTL_FEE_COLLECTOR).receiveFee(feeToken, fee, FEE_TYPE);

        // Accounting
        totalFeesCollected[feeToken] += fee;
        emit SwapFeeCollected(poolId, feeToken, fee, sender);

        return AFTER_SWAP_SELECTOR;
    }

    // ─────────────────────────────────────────────────────────────────────
    // Internal helpers
    // ─────────────────────────────────────────────────────────────────────

    // Determine the output token and gross output amount from a swap
    function _resolveOutput(
        PoolKey calldata key,
        SwapParams calldata params,
        BalanceDelta delta
    ) internal pure returns (address token, uint256 amount) {
        int128 amt0 = BalanceDeltaLib.amount0(delta);
        int128 amt1 = BalanceDeltaLib.amount1(delta);

        if (params.zeroForOne) {
            // currency0 in → currency1 out
            // amount1 is positive (pool owes swapper currency1)
            token = key.currency1;
            amount = amt1 > 0 ? uint256(uint128(amt1)) : 0;
        } else {
            // currency1 in → currency0 out
            // amount0 is positive (pool owes swapper currency0)
            token = key.currency0;
            amount = amt0 > 0 ? uint256(uint128(amt0)) : 0;
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // Unused hook callbacks — must exist to satisfy interface
    // Return NOOP to tell the pool manager these hooks are not active
    // ─────────────────────────────────────────────────────────────────────

    function beforeInitialize(address, PoolKey calldata, uint160, bytes calldata)
        external pure override returns (bytes4) { return NOOP_SELECTOR; }

    function afterInitialize(address, PoolKey calldata, uint160, int24, bytes calldata)
        external pure override returns (bytes4) { return NOOP_SELECTOR; }

    function beforeAddLiquidity(address, PoolKey calldata, bytes calldata)
        external pure override returns (bytes4) { return NOOP_SELECTOR; }

    function afterAddLiquidity(address, PoolKey calldata, BalanceDelta, bytes calldata)
        external pure override returns (bytes4) { return NOOP_SELECTOR; }

    function beforeRemoveLiquidity(address, PoolKey calldata, bytes calldata)
        external pure override returns (bytes4) { return NOOP_SELECTOR; }

    function afterRemoveLiquidity(address, PoolKey calldata, BalanceDelta, bytes calldata)
        external pure override returns (bytes4) { return NOOP_SELECTOR; }

    function beforeSwap(address, PoolKey calldata, SwapParams calldata, bytes calldata)
        external pure override returns (bytes4) { return NOOP_SELECTOR; }

    function beforeDonate(address, PoolKey calldata, uint256, uint256, bytes calldata)
        external pure override returns (bytes4) { return NOOP_SELECTOR; }

    function afterDonate(address, PoolKey calldata, uint256, uint256, bytes calldata)
        external pure override returns (bytes4) { return NOOP_SELECTOR; }
}
