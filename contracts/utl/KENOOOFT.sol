// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// ─────────────────────────────────────────────────────────────────────────────
//
//  KENO OFT — Destination Chain Contract
//
//  Deploy this on every chain where you want KENO to exist natively:
//  Ethereum, Arbitrum, Base, Polygon, Optimism, Avalanche, etc.
//
//  This contract MINTS KENO when tokens arrive from BSC via LayerZero.
//  This contract BURNS KENO when tokens are sent back to BSC via LayerZero.
//
//  There is NO fixed supply here — supply is controlled by the BSC OFTAdapter
//  which holds the locked KENO. Every mint here equals a lock on BSC.
//  Every burn here equals an unlock on BSC. Total supply is always preserved.
//
//  BRIDGE FLOW (BSC → This Chain):
//  1. BSC OFTAdapter locks KENO and sends LZ message
//  2. This contract's lzReceive() is called by the LZ endpoint
//  3. KENO is minted to the recipient here
//
//  RETURN FLOW (This Chain → BSC):
//  1. User calls sendBack() — KENO is burned
//  2. LZ message sent to BSC OFTAdapter
//  3. OFTAdapter releases locked KENO to recipient on BSC
//
//  LZ Endpoint: 0x1a44076050125825900e736c501f859c50fE728c (same all chains)
//  BSC EID:     30102 (peer that must be set after deployment)
//
//  Author: Kenostod Blockchain Academy LLC — T.D.I.R. Foundation
//
// ─────────────────────────────────────────────────────────────────────────────

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

contract KENOOOFT {

    // ── Token Metadata ────────────────────────────────────────────────────────
    string  public constant name     = "KENO Token";
    string  public constant symbol   = "KENO";
    uint8   public constant decimals = 18;

    // ── LayerZero ─────────────────────────────────────────────────────────────
    address public constant LZ_EP = 0x1a44076050125825900e736c501f859c50fE728c;
    uint8   public constant SHARED_DECIMALS = 6;

    // ── State ─────────────────────────────────────────────────────────────────
    address public owner;

    // Total supply minted on this chain (always mirrors locked amount on BSC)
    uint256 public totalSupply;

    // ERC-20 balances and allowances
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    // Trusted peer contracts: srcEid → peer address (bytes32)
    // Must include BSC OFTAdapter (EID 30102) after deployment
    mapping(uint32 => bytes32) public peers;

    // ── Events ────────────────────────────────────────────────────────────────
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event PeerSet(uint32 indexed eid, bytes32 peer);
    event KENOBridgedOut(address indexed from, uint32 indexed dstEid, bytes32 indexed to, uint256 amount, bytes32 guid);
    event KENOBridgedIn(uint32 indexed srcEid, bytes32 indexed from, address indexed to, uint256 amount);

    // ── Modifiers ─────────────────────────────────────────────────────────────
    modifier onlyOwner() {
        require(msg.sender == owner, "KENOOOFT: not owner");
        _;
    }

    modifier onlyEndpoint() {
        require(msg.sender == LZ_EP, "KENOOOFT: only LZ endpoint");
        _;
    }

    // ── Constructor ───────────────────────────────────────────────────────────
    constructor() {
        owner = msg.sender;
        ILZEndpoint(LZ_EP).setDelegate(msg.sender);
    }

    // ── Admin ─────────────────────────────────────────────────────────────────

    function setPeer(uint32 eid, bytes32 peer) external onlyOwner {
        require(peer != bytes32(0), "KENOOOFT: zero peer");
        peers[eid] = peer;
        emit PeerSet(eid, peer);
    }

    function setPeerAddress(uint32 eid, address peer) external onlyOwner {
        peers[eid] = _addressToBytes32(peer);
        emit PeerSet(eid, _addressToBytes32(peer));
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "zero address");
        owner = newOwner;
    }

    function setDelegate() external onlyOwner {
        ILZEndpoint(LZ_EP).setDelegate(msg.sender);
    }

    function sweepNative() external onlyOwner {
        uint256 bal = address(this).balance;
        require(bal > 0, "nothing");
        payable(owner).transfer(bal);
    }

    // ── ERC-20 ────────────────────────────────────────────────────────────────

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            require(allowed >= amount, "KENOOOFT: insufficient allowance");
            allowance[from][msg.sender] = allowed - amount;
        }
        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        require(to != address(0), "KENOOOFT: transfer to zero");
        require(balanceOf[from] >= amount, "KENOOOFT: insufficient balance");
        balanceOf[from] -= amount;
        balanceOf[to]   += amount;
        emit Transfer(from, to, amount);
    }

    function _mint(address to, uint256 amount) internal {
        totalSupply     += amount;
        balanceOf[to]   += amount;
        emit Transfer(address(0), to, amount);
    }

    function _burn(address from, uint256 amount) internal {
        require(balanceOf[from] >= amount, "KENOOOFT: burn exceeds balance");
        balanceOf[from] -= amount;
        totalSupply     -= amount;
        emit Transfer(from, address(0), amount);
    }

    // ── Quoting ───────────────────────────────────────────────────────────────

    // Quote the fee to bridge `amount` KENO to `dstEid`.
    // Typically dstEid = 30102 (BSC) to bridge back home.
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

    function quoteSendTo(
        uint32  dstEid,
        address recipient,
        uint256 amount,
        bytes calldata options
    ) external view returns (uint256 nativeFee) {
        return this.quoteSend(dstEid, _addressToBytes32(recipient), amount, options);
    }

    // ── Sending ───────────────────────────────────────────────────────────────

    // Bridge KENO from this chain to another (typically back to BSC at EID 30102).
    // Burns KENO here and sends a LayerZero message to the OFTAdapter/peer.
    //
    // @param dstEid     Destination chain EID (30102 = BSC, etc.)
    // @param recipient  Recipient address on the destination chain
    // @param amount     Amount of KENO to send (18 decimals)
    // @param options    Executor options — use defaultOptions() for standard config
    //
    // msg.value must be >= quoteSend() result
    function sendKENO(
        uint32  dstEid,
        address recipient,
        uint256 amount,
        bytes calldata options
    ) external payable returns (bytes32 guid) {
        require(amount > 0, "KENOOOFT: zero amount");
        bytes32 peer = peers[dstEid];
        require(peer != bytes32(0), "KENOOOFT: no peer for dst chain");

        // Burn KENO on this chain
        _burn(msg.sender, amount);

        // Build and send LZ message
        bytes32 recipientBytes = _addressToBytes32(recipient);
        uint64  amountSD       = _toShared(amount);
        bytes memory payload   = _encodePayload(recipientBytes, amountSD);

        MessagingParams memory params = MessagingParams({
            dstEid:      dstEid,
            receiver:    peer,
            message:     payload,
            options:     options,
            payInLzToken: false
        });
        MessagingReceipt memory receipt = ILZEndpoint(LZ_EP).send{value: msg.value}(params, msg.sender);

        emit KENOBridgedOut(msg.sender, dstEid, recipientBytes, amount, receipt.guid);
        return receipt.guid;
    }

    // ── Receiving ─────────────────────────────────────────────────────────────

    // Called by the LayerZero endpoint when KENO arrives from another chain.
    // Mints KENO to the recipient.
    function lzReceive(
        Origin calldata origin,
        bytes32 /*guid*/,
        bytes calldata message,
        address /*executor*/,
        bytes calldata /*extraData*/
    ) external payable onlyEndpoint {
        require(peers[origin.srcEid] == origin.sender, "KENOOOFT: untrusted peer");

        (bytes32 recipientBytes, uint64 amountSD) = _decodePayload(message);
        address recipient = _bytes32ToAddress(recipientBytes);
        uint256 amount    = _fromShared(amountSD);

        _mint(recipient, amount);

        emit KENOBridgedIn(origin.srcEid, origin.sender, recipient, amount);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    function defaultOptions() external pure returns (bytes memory) {
        return abi.encodePacked(uint16(3), uint8(1), uint16(17), uint128(200000), uint128(0));
    }

    function _encodePayload(bytes32 recipient, uint64 amountSD) internal pure returns (bytes memory) {
        return abi.encodePacked(recipient, amountSD);
    }

    function _decodePayload(bytes calldata payload) internal pure returns (bytes32 recipient, uint64 amountSD) {
        require(payload.length == 40, "KENOOOFT: bad payload length");
        recipient = bytes32(payload[0:32]);
        amountSD  = uint64(bytes8(payload[32:40]));
    }

    function _toShared(uint256 amount) internal pure returns (uint64) {
        uint256 sd = amount / (10 ** (18 - SHARED_DECIMALS));
        require(sd <= type(uint64).max, "KENOOOFT: amount overflow");
        return uint64(sd);
    }

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
