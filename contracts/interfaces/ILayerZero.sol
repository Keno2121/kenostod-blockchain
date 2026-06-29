// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// ─────────────────────────────────────────────────────────────────────────────
// LayerZero v2 — Interfaces required by UTLLayerZeroOApp
// Full spec: https://docs.layerzero.network/v2
//
// LayerZero Endpoint V2 — same address on EVERY chain:
//   0x1a44076050125825900e736c501f859c50fE728c
//
// Chain Endpoint IDs (EID):
//   BSC Mainnet:  30102   ← home chain for UTL
//   Ethereum:     30101
//   Polygon:      30109
//   Arbitrum:     30110
//   Optimism:     30111
//   Base:         30184
//   Avalanche:    30106
//   Fantom:       30112
// ─────────────────────────────────────────────────────────────────────────────

// Fee structure for a LayerZero message
struct MessagingFee {
    uint256 nativeFee;      // fee in native gas token (BNB on BSC)
    uint256 lzTokenFee;     // fee in ZRO token (optional, usually 0)
}

// Receipt returned after sending a message
struct MessagingReceipt {
    bytes32 guid;           // globally unique message ID
    uint64  nonce;          // message nonce on this pathway
    MessagingFee fee;       // actual fee paid
}

// Origin of an inbound message
struct Origin {
    uint32  srcEid;         // source chain EID
    bytes32 sender;         // sender address as bytes32 (left-padded)
    uint64  nonce;          // inbound nonce
}

// Messaging parameters for sending
struct MessagingParams {
    uint32  dstEid;         // destination chain EID
    bytes32 receiver;       // receiver address on dst chain (left-padded to bytes32)
    bytes   message;        // arbitrary payload
    bytes   options;        // execution options (gas limit, value, etc.)
    bool    payInLzToken;   // true to pay in ZRO, false for native
}

interface ILayerZeroEndpointV2 {

    // ── Sending ──────────────────────────────────────────────────────────────
    // Send a cross-chain message.
    // @param params   MessagingParams — destination, receiver, payload, options
    // @param refundAddress  Excess native fee refunded here
    // Returns MessagingReceipt with guid and nonce
    function send(
        MessagingParams calldata params,
        address refundAddress
    ) external payable returns (MessagingReceipt memory receipt);

    // Quote the fee for a message WITHOUT sending it
    function quote(
        MessagingParams calldata params,
        address sender
    ) external view returns (MessagingFee memory fee);

    // ── Receiving ────────────────────────────────────────────────────────────
    // Called by the LayerZero executor on the destination chain to deliver a msg
    function lzReceive(
        Origin calldata origin,
        address receiver,
        bytes32 guid,
        bytes calldata message,
        bytes calldata extraData
    ) external payable;

    // ── Configuration ────────────────────────────────────────────────────────
    // Set the delegate (OApp owner) who can configure send/receive libraries
    function setDelegate(address delegate) external;

    // Check if a pathway is initialized between two OApps
    function isRegisteredLibrary(address lib) external view returns (bool);

    // Returns the EID of the current chain
    function eid() external view returns (uint32);
}

// ── OApp Receiver interface ───────────────────────────────────────────────────
// Implement this on any contract that receives LayerZero messages
interface ILayerZeroReceiver {
    // Called by the LayerZero endpoint when a message arrives
    function lzReceive(
        Origin calldata origin,
        bytes32 guid,
        bytes calldata message,
        address executor,
        bytes calldata extraData
    ) external payable;
}

// ── Options builder helper ─────────────────────────────────────────────────────
// Execution options encode the gas limit and msg.value for the lzReceive call
library OptionsBuilder {
    uint16 constant TYPE_3 = 3;

    // Build options specifying gas limit on destination
    function newOptions() internal pure returns (bytes memory) {
        return abi.encodePacked(TYPE_3);
    }

    function addExecutorLzReceiveOption(
        bytes memory options,
        uint128 gas,
        uint128 value
    ) internal pure returns (bytes memory) {
        return abi.encodePacked(options, uint8(1), uint16(17), gas, value);
    }
}
