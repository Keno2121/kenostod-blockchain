// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// ─────────────────────────────────────────────────────────────────────────────
//
//  KENO OFT Adapter — BSC Mainnet (Home Chain)
//
//  Wraps the existing KENO BEP-20 token (already deployed, supply fixed at 1B)
//  to enable cross-chain transfers via LayerZero V2.
//
//  HOW IT WORKS:
//  ─────────────
//  BSC is the "home" chain. KENO is locked here when bridging OUT.
//  KENO is released here when bridging BACK from another chain.
//
//  On destination chains (Ethereum, Arbitrum, Base, etc.) a KENOOOFT contract
//  mints/burns KENO. The two contracts communicate via LayerZero messages.
//
//  BRIDGE FLOW (BSC → Arbitrum example):
//  1. User approves this adapter to spend their KENO
//  2. User calls sendKENO() with destination EID + recipient + amount
//  3. Adapter locks KENO in escrow (transferFrom)
//  4. Adapter sends LayerZero message to KENO OFT on Arbitrum
//  5. Arbitrum OFT mints equivalent KENO to recipient
//
//  RETURN FLOW (Arbitrum → BSC):
//  1. User calls KENO OFT on Arbitrum — it burns tokens + sends LZ message
//  2. This adapter receives message, releases locked KENO to recipient
//
//  KENO Token:  0x65791E0B5Cbac5F40c76cDe31bf4F074D982FD0E  (BSC Mainnet)
//  LZ Endpoint: 0x1a44076050125825900e736c501f859c50fE728c  (same all chains)
//  BSC EID:     30102
//
//  Author: Kenostod Blockchain Academy LLC — T.D.I.R. Foundation
//
// ─────────────────────────────────────────────────────────────────────────────

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function decimals() external view returns (uint8);
}

struct MessagingFee {
    uint256 nativeFee;
    uint256 lzTokenFee;
}

struct MessagingReceipt {
    bytes32 guid;
    uint64  nonce;
    MessagingFee fee;
}

struct MessagingParams {
    uint32  dstEid;
    bytes32 receiver;
    bytes   message;
    bytes   options;
    bool    payInLzToken;
}

struct Origin {
    uint32  srcEid;
    bytes32 sender;
    uint64  nonce;
}

interface ILZEndpoint {
    function send(MessagingParams calldata params, address refundAddress)
        external payable returns (MessagingReceipt memory);
    function quote(MessagingParams calldata params, address sender)
        external view returns (MessagingFee memory);
    function setDelegate(address delegate) external;
    function eid() external view returns (uint32);
}

contract KENOOFTAdapter {

    // ── Constants ─────────────────────────────────────────────────────────────
    address public constant KENO   = 0x65791E0B5Cbac5F40c76cDe31bf4F074D982FD0E;
    address public constant LZ_EP  = 0x1a44076050125825900e736c501f859c50fE728c;
    uint32  public constant BSC_EID = 30102;

    // Shared decimal precision — LZ OFT standard uses 6 decimals for the
    // cross-chain amount to normalize across chains with different decimals
    uint8 public constant SHARED_DECIMALS = 6;

    // ── State ─────────────────────────────────────────────────────────────────
    address public owner;

    // dstEid → peer OFT contract address (as bytes32)
    mapping(uint32 => bytes32) public peers;

    // Total KENO locked in escrow by this adapter
    uint256 public totalLocked;

    // ── Events ────────────────────────────────────────────────────────────────
    event PeerSet(uint32 indexed dstEid, bytes32 peer);
    event KENOSent(address indexed from, uint32 indexed dstEid, bytes32 indexed to, uint256 amount, bytes32 guid);
    event KENOReceived(uint32 indexed srcEid, bytes32 indexed from, address indexed to, uint256 amount);
    event Swept(address token, uint256 amount);

    // ── Modifiers ─────────────────────────────────────────────────────────────
    modifier onlyOwner() {
        require(msg.sender == owner, "OFTAdapter: not owner");
        _;
    }

    modifier onlyEndpoint() {
        require(msg.sender == LZ_EP, "OFTAdapter: only LZ endpoint");
        _;
    }

    // ── Constructor ───────────────────────────────────────────────────────────
    constructor() {
        owner = msg.sender;
        ILZEndpoint(LZ_EP).setDelegate(msg.sender);
    }

    // ── Admin ─────────────────────────────────────────────────────────────────

    // Register a peer KENO OFT contract on a destination chain.
    // Must be called before any bridging to that chain.
    function setPeer(uint32 dstEid, bytes32 peer) external onlyOwner {
        require(dstEid != BSC_EID, "OFTAdapter: cannot peer with home chain");
        require(peer != bytes32(0), "OFTAdapter: zero peer");
        peers[dstEid] = peer;
        emit PeerSet(dstEid, peer);
    }

    // Convenience: set peer with an address instead of bytes32
    function setPeerAddress(uint32 dstEid, address peer) external onlyOwner {
        this.setPeer(dstEid, _addressToBytes32(peer));
    }

    // Transfer ownership
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "zero address");
        owner = newOwner;
    }

    // Register as delegate on the LZ endpoint (re-callable after ownership transfer)
    function setDelegate() external onlyOwner {
        ILZEndpoint(LZ_EP).setDelegate(msg.sender);
    }

    // Emergency sweep — only for non-KENO tokens accidentally sent here
    // KENO cannot be swept; it is the escrow
    function sweep(address token) external onlyOwner {
        require(token != KENO, "OFTAdapter: cannot sweep KENO escrow");
        uint256 bal = IERC20(token).balanceOf(address(this));
        require(bal > 0, "nothing to sweep");
        IERC20(token).transfer(owner, bal);
        emit Swept(token, bal);
    }

    // Sweep excess native BNB (from overpaid fees)
    function sweepBNB() external onlyOwner {
        uint256 bal = address(this).balance;
        require(bal > 0, "nothing");
        payable(owner).transfer(bal);
    }

    // ── Quoting ───────────────────────────────────────────────────────────────

    // Get the LayerZero fee required to bridge `amount` KENO to `dstEid`.
    // Call this off-chain before calling sendKENO() to know how much BNB to send.
    function quoteSend(
        uint32  dstEid,
        bytes32 recipient,
        uint256 amount,
        bytes calldata options
    ) external view returns (uint256 nativeFee) {
        bytes memory payload = _encodePayload(recipient, _toShared(amount));
        MessagingParams memory params = MessagingParams({
            dstEid:      dstEid,
            receiver:    peers[dstEid],
            message:     payload,
            options:     options,
            payInLzToken: false
        });
        MessagingFee memory fee = ILZEndpoint(LZ_EP).quote(params, address(this));
        return fee.nativeFee;
    }

    // Same as above but takes address instead of bytes32
    function quoteSendTo(
        uint32 dstEid,
        address recipient,
        uint256 amount,
        bytes calldata options
    ) external view returns (uint256 nativeFee) {
        return this.quoteSend(dstEid, _addressToBytes32(recipient), amount, options);
    }

    // ── Sending ───────────────────────────────────────────────────────────────

    // Bridge KENO from BSC to a destination chain.
    //
    // @param dstEid     LayerZero endpoint ID of the destination chain
    //                   (e.g. 30101 = Ethereum, 30110 = Arbitrum, 30184 = Base)
    // @param recipient  The address to receive KENO on the destination chain
    // @param amount     Amount of KENO to bridge (in 18-decimal KENO units)
    // @param options    LayerZero executor options (gas limit for lzReceive on dst)
    //                   Use defaultOptions() for a sensible default
    //
    // msg.value must be >= quoteSend() — excess is refunded to msg.sender
    function sendKENO(
        uint32  dstEid,
        address recipient,
        uint256 amount,
        bytes calldata options
    ) external payable returns (bytes32 guid) {
        require(amount > 0, "OFTAdapter: zero amount");
        bytes32 peer = peers[dstEid];
        require(peer != bytes32(0), "OFTAdapter: no peer for dst chain");

        // Lock KENO in this contract (user must have approved first)
        bool ok = IERC20(KENO).transferFrom(msg.sender, address(this), amount);
        require(ok, "OFTAdapter: KENO transfer failed");
        totalLocked += amount;

        // Encode payload: [recipient (bytes32), amountSD (uint64)]
        bytes32 recipientBytes = _addressToBytes32(recipient);
        uint64  amountSD       = _toShared(amount);
        bytes memory payload   = _encodePayload(recipientBytes, amountSD);

        // Send the LayerZero message
        MessagingParams memory params = MessagingParams({
            dstEid:      dstEid,
            receiver:    peer,
            message:     payload,
            options:     options,
            payInLzToken: false
        });
        MessagingReceipt memory receipt = ILZEndpoint(LZ_EP).send{value: msg.value}(params, msg.sender);

        emit KENOSent(msg.sender, dstEid, recipientBytes, amount, receipt.guid);
        return receipt.guid;
    }

    // ── Receiving ─────────────────────────────────────────────────────────────

    // Called by the LayerZero endpoint when KENO arrives from another chain.
    // Releases locked KENO to the recipient.
    function lzReceive(
        Origin calldata origin,
        bytes32 guid,
        bytes calldata message,
        address /*executor*/,
        bytes calldata /*extraData*/
    ) external payable onlyEndpoint {
        // Verify message is from the trusted peer on source chain
        require(peers[origin.srcEid] == origin.sender, "OFTAdapter: untrusted peer");

        // Decode: recipient + amount
        (bytes32 recipientBytes, uint64 amountSD) = _decodePayload(message);
        address recipient = _bytes32ToAddress(recipientBytes);
        uint256 amount    = _fromShared(amountSD);

        // Release KENO from escrow
        require(totalLocked >= amount, "OFTAdapter: insufficient escrow");
        totalLocked -= amount;
        bool ok = IERC20(KENO).transfer(recipient, amount);
        require(ok, "OFTAdapter: KENO release failed");

        emit KENOReceived(origin.srcEid, origin.sender, recipient, amount);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    // Default executor options: 200,000 gas for lzReceive, 0 msg.value
    function defaultOptions() external pure returns (bytes memory) {
        return abi.encodePacked(uint16(3), uint8(1), uint16(17), uint128(200000), uint128(0));
    }

    function _encodePayload(bytes32 recipient, uint64 amountSD) internal pure returns (bytes memory) {
        return abi.encodePacked(recipient, amountSD);
    }

    function _decodePayload(bytes calldata payload) internal pure returns (bytes32 recipient, uint64 amountSD) {
        require(payload.length == 40, "OFTAdapter: bad payload length");
        recipient = bytes32(payload[0:32]);
        amountSD  = uint64(bytes8(payload[32:40]));
    }

    // Convert 18-decimal KENO amount to 6-decimal shared units
    function _toShared(uint256 amount) internal pure returns (uint64) {
        uint256 sd = amount / (10 ** (18 - SHARED_DECIMALS));
        require(sd <= type(uint64).max, "OFTAdapter: amount overflow");
        return uint64(sd);
    }

    // Convert 6-decimal shared units back to 18-decimal KENO
    function _fromShared(uint64 amountSD) internal pure returns (uint256) {
        return uint256(amountSD) * (10 ** (18 - SHARED_DECIMALS));
    }

    function _addressToBytes32(address addr) internal pure returns (bytes32) {
        return bytes32(uint256(uint160(addr)));
    }

    function _bytes32ToAddress(bytes32 b) internal pure returns (address) {
        return address(uint160(uint256(b)));
    }

    receive() external payable {}
}
