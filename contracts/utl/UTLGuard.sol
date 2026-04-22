// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// ─────────────────────────────────────────────────────────────────────────────
//
//  UTL Guard — Universal Transaction Layer × Gnosis Safe
//
//  A Safe Guard that intercepts every multisig transaction after execution
//  and routes a micro-fee to the UTL Protocol FeeCollector.
//
//  HOW IT WORKS:
//  ─────────────
//  1. Safe owner installs this contract as their Guard via Safe UI
//     (Settings → Advanced → Guard)
//  2. Safe pre-funds the guard with a small BNB reserve
//  3. Every time owners execute a Safe transaction, checkAfterExecution()
//     fires automatically
//  4. UTL fee is deducted from the guard's reserve and sent to FeeCollector
//  5. FeeCollector splits: 60% stakers / 25% T.D.I.R. / 15% treasury
//  6. Safe owner tops up the reserve periodically (or enables auto-top-up)
//
//  FEE MODEL:
//  ──────────
//  • If the Safe transaction sends BNB (value > 0):  0.09% of that value
//  • If the Safe transaction is a contract call (value = 0): flat 0.0001 BNB
//  • Minimum fee floor enforced to prevent dust
//  • If reserve is empty, guard is non-blocking (fee skipped, event emitted)
//
//  INSTALLATION STEPS:
//  ───────────────────
//  1. Deploy UTLGuard (one deployment works for all Safes)
//  2. In Safe UI: Settings → Guard → set to UTLGuard address
//  3. Call registerSafe() from the Safe to activate fee collection
//  4. Send BNB reserve to the guard via fundReserve()
//  5. Done — every Safe tx now contributes to UTL staker rewards
//
//  Author: Kenostod Blockchain Academy LLC — T.D.I.R. Foundation
//  Network: BSC Mainnet (chainId 56)
//
// ─────────────────────────────────────────────────────────────────────────────

import "../interfaces/IGnosisSafe.sol";
import "../interfaces/IUTLFeeCollector.sol";

interface IWBNB {
    function deposit() external payable;
    function approve(address spender, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}

contract UTLGuard is IGuard, IERC165 {

    // ── UTL Protocol addresses (BSC Mainnet) ─────────────────────────────
    address public constant UTL_FEE_COLLECTOR =
        0xfE537c43d202C455Cedc141B882c808287BB662f;

    address public constant WBNB =
        0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c;

    // ── Fee parameters ────────────────────────────────────────────────────
    uint256 public constant VALUE_FEE_BPS   = 9;               // 0.09% on BNB transfers
    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint256 public constant FLAT_FEE        = 0.0001 ether;    // flat fee per contract call
    uint256 public constant MIN_FEE         = 0.00001 ether;   // dust floor

    bytes32 public constant FEE_TYPE_VALUE  = keccak256("SAFE_BNB_TRANSFER_FEE");
    bytes32 public constant FEE_TYPE_CALL   = keccak256("SAFE_CONTRACT_CALL_FEE");

    // ── Per-Safe state ────────────────────────────────────────────────────
    struct SafeRecord {
        bool     active;          // guard is registered for this safe
        uint256  reserve;         // BNB reserve held by this guard for this safe
        uint256  txCount;         // number of txs processed
        uint256  totalFeesBNB;    // cumulative fees collected in BNB
        uint256  lastTxValue;     // value captured in checkTransaction, used in checkAfterExecution
    }

    mapping(address => SafeRecord) public safes;

    // Pending tx value — captured in checkTransaction, consumed in checkAfterExecution
    // keyed by msg.sender (the Safe address)
    mapping(address => uint256) private _pendingValue;

    // ── Global accounting ─────────────────────────────────────────────────
    uint256 public totalFeesCollectedBNB;
    uint256 public totalSafesRegistered;

    // ── Access control ────────────────────────────────────────────────────
    address public owner;

    // ── Events ────────────────────────────────────────────────────────────
    event SafeRegistered(address indexed safe);
    event SafeDeregistered(address indexed safe);
    event ReserveFunded(address indexed safe, uint256 amount, uint256 newBalance);
    event ReserveWithdrawn(address indexed safe, uint256 amount);
    event FeeCollected(address indexed safe, bytes32 feeType, uint256 feeBNB);
    event FeeSkipped(address indexed safe, string reason);
    event OwnershipTransferred(address indexed previous, address indexed next);

    // ── Errors ────────────────────────────────────────────────────────────
    error OnlyOwner();
    error SafeNotRegistered();
    error SafeAlreadyRegistered();
    error InsufficientReserve();
    error ZeroAddress();
    error WBNBConversionFailed();
    error TransferFailed();

    // ─────────────────────────────────────────────────────────────────────
    constructor() {
        owner = msg.sender;
    }

    receive() external payable {}

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    // ─────────────────────────────────────────────────────────────────────
    // EIP-165 — Safe checks this before installing the guard
    // ─────────────────────────────────────────────────────────────────────

    function supportsInterface(bytes4 interfaceId) external pure override returns (bool) {
        return
            interfaceId == type(IGuard).interfaceId ||
            interfaceId == type(IERC165).interfaceId;
    }

    // ─────────────────────────────────────────────────────────────────────
    // Safe registration
    // ─────────────────────────────────────────────────────────────────────

    // Called by the Safe (or its owner) to opt into UTL fee collection.
    // Must be called AFTER the guard is set in the Safe UI.
    function registerSafe(address safe) external {
        if (safes[safe].active) revert SafeAlreadyRegistered();
        safes[safe].active = true;
        totalSafesRegistered++;
        emit SafeRegistered(safe);
    }

    // Called by Safe owner to deregister and withdraw remaining reserve
    function deregisterSafe(address safe) external {
        SafeRecord storage record = safes[safe];
        if (!record.active) revert SafeNotRegistered();
        uint256 remaining = record.reserve;
        record.active  = false;
        record.reserve = 0;
        if (remaining > 0) {
            (bool ok,) = payable(msg.sender).call{value: remaining}("");
            if (!ok) revert TransferFailed();
        }
        emit SafeDeregistered(safe);
    }

    // ─────────────────────────────────────────────────────────────────────
    // Reserve management
    // ─────────────────────────────────────────────────────────────────────

    // Fund the BNB reserve for a specific Safe.
    // Anyone can top up any registered Safe's reserve.
    function fundReserve(address safe) external payable {
        if (!safes[safe].active) revert SafeNotRegistered();
        safes[safe].reserve += msg.value;
        emit ReserveFunded(safe, msg.value, safes[safe].reserve);
    }

    // Safe owner withdraws unused reserve
    function withdrawReserve(address safe, uint256 amount) external {
        SafeRecord storage record = safes[safe];
        if (!record.active) revert SafeNotRegistered();
        if (record.reserve < amount) revert InsufficientReserve();
        record.reserve -= amount;
        (bool ok,) = payable(msg.sender).call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit ReserveWithdrawn(safe, amount);
    }

    // ─────────────────────────────────────────────────────────────────────
    // Safe Guard callbacks
    // ─────────────────────────────────────────────────────────────────────

    // Called BEFORE every Safe transaction
    // We capture the transaction value here so checkAfterExecution can use it
    function checkTransaction(
        address,                // to
        uint256 value,
        bytes calldata,         // data
        Operation,              // operation
        uint256,                // safeTxGas
        uint256,                // baseGas
        uint256,                // gasPrice
        address,                // gasToken
        address payable,        // refundReceiver
        bytes calldata,         // signatures
        address                 // msgSender
    ) external override {
        // Store the BNB value being sent — used in checkAfterExecution
        _pendingValue[msg.sender] = value;
    }

    // Called AFTER every Safe transaction (cannot revert the tx)
    // This is where UTL collects its fee
    function checkAfterExecution(bytes32, bool success) external override {
        address safe = msg.sender;
        SafeRecord storage record = safes[safe];

        // Non-blocking: if safe isn't registered or tx failed, skip silently
        if (!record.active) {
            emit FeeSkipped(safe, "not registered");
            return;
        }
        if (!success) {
            _pendingValue[safe] = 0;
            emit FeeSkipped(safe, "tx failed");
            return;
        }

        uint256 txValue = _pendingValue[safe];
        _pendingValue[safe] = 0;

        // Calculate fee
        bytes32 feeType;
        uint256 fee;

        if (txValue > 0) {
            // BNB transfer — charge 0.09% of value
            fee     = (txValue * VALUE_FEE_BPS) / BPS_DENOMINATOR;
            feeType = FEE_TYPE_VALUE;
        } else {
            // Contract call — charge flat fee
            fee     = FLAT_FEE;
            feeType = FEE_TYPE_CALL;
        }

        // Enforce minimum
        if (fee < MIN_FEE) fee = MIN_FEE;

        // Non-blocking if reserve is insufficient
        if (record.reserve < fee) {
            emit FeeSkipped(safe, "insufficient reserve");
            return;
        }

        // Deduct from reserve
        record.reserve     -= fee;
        record.txCount     += 1;
        record.totalFeesBNB += fee;
        totalFeesCollectedBNB += fee;

        // Wrap BNB → WBNB for FeeCollector (UTL FeeCollector works with ERC-20)
        IWBNB(WBNB).deposit{value: fee}();
        IWBNB(WBNB).approve(UTL_FEE_COLLECTOR, fee);

        // Route to UTL FeeCollector — 60% stakers / 25% foundation / 15% treasury
        IUTLFeeCollector(UTL_FEE_COLLECTOR).receiveFee(WBNB, fee, feeType);

        emit FeeCollected(safe, feeType, fee);
    }

    // ─────────────────────────────────────────────────────────────────────
    // View helpers
    // ─────────────────────────────────────────────────────────────────────

    function getReserve(address safe) external view returns (uint256) {
        return safes[safe].reserve;
    }

    function getSafeStats(address safe) external view returns (
        bool active,
        uint256 reserve,
        uint256 txCount,
        uint256 totalFeesBNB
    ) {
        SafeRecord memory r = safes[safe];
        return (r.active, r.reserve, r.txCount, r.totalFeesBNB);
    }

    // Estimate how many more transactions the reserve can cover
    function estimateTxsRemaining(address safe) external view returns (uint256) {
        uint256 reserve = safes[safe].reserve;
        if (reserve < FLAT_FEE) return 0;
        return reserve / FLAT_FEE;
    }

    // ─────────────────────────────────────────────────────────────────────
    // Admin
    // ─────────────────────────────────────────────────────────────────────

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }
}
