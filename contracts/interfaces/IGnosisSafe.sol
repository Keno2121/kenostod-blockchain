// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// ─────────────────────────────────────────────────────────────────────────────
// Gnosis Safe v1.4 — Minimal interfaces required by UTLGuard
// Full spec: https://github.com/safe-global/safe-contracts
// ─────────────────────────────────────────────────────────────────────────────

enum Operation {
    Call,           // 0 — standard call
    DelegateCall    // 1 — delegate call (runs in Safe's context)
}

// ── Safe Guard interface ──────────────────────────────────────────────────────
// Implement this and set it via Safe.setGuard(address) to intercept every tx.
// Guards are called BEFORE and AFTER every Safe transaction execution.
interface IGuard {

    // Called BEFORE the Safe executes a transaction.
    // Revert here to block the transaction entirely.
    function checkTransaction(
        address to,
        uint256 value,
        bytes calldata data,
        Operation operation,
        uint256 safeTxGas,
        uint256 baseGas,
        uint256 gasPrice,
        address gasToken,
        address payable refundReceiver,
        bytes calldata signatures,
        address msgSender
    ) external;

    // Called AFTER the Safe transaction executes (success or failure).
    // Cannot revert the transaction — used for post-execution accounting.
    function checkAfterExecution(bytes32 txHash, bool success) external;
}

// EIP-165 — Safe checks supportsInterface before installing a guard
interface IERC165 {
    function supportsInterface(bytes4 interfaceId) external view returns (bool);
}

// ── ISafe — minimal Safe interface ────────────────────────────────────────────
interface ISafe {
    // Returns the list of owners of the Safe
    function getOwners() external view returns (address[] memory);

    // Returns the current guard address (address(0) if none)
    function getGuard() external view returns (address);

    // Executes a transaction from within a module
    function execTransactionFromModule(
        address to,
        uint256 value,
        bytes calldata data,
        Operation operation
    ) external returns (bool success);

    // Returns the nonce (tx count) of the Safe
    function nonce() external view returns (uint256);

    // Returns threshold (number of required signatures)
    function getThreshold() external view returns (uint256);
}
