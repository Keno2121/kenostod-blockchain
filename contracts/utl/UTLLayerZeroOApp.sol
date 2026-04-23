// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// ─────────────────────────────────────────────────────────────────────────────
//
//  UTL LayerZero OApp — Universal Transaction Layer × LayerZero v2
//
//  UTL becomes an omnichain operator — a cross-chain middleware that sits
//  between protocols and the LayerZero endpoint. Every cross-chain message
//  or token transfer routed through UTL generates a fee for USDC stakers.
//
//  TWO MODES:
//  ──────────
//  1. CROSS-CHAIN MESSAGE ROUTING
//     Any protocol routes their LayerZero messages through this OApp.
//     UTL charges 0.05% of the native fee paid + collects a flat micro-toll.
//     Message is forwarded to the real destination via the LZ endpoint.
//
//  2. CROSS-CHAIN TOKEN BRIDGE (OFT-compatible)
//     UTL wraps any OFT token transfer. User sends tokens to UTL on the
//     source chain, UTL takes its fee, then initiates the LayerZero bridge
//     to the destination chain. On arrival, UTL's lzReceive delivers the
//     net tokens to the recipient.
//
//  SUPPORTED SOURCE CHAINS (any chain where UTL is deployed):
//  ───────────────────────────────────────────────────────────
//  BSC (30102), Ethereum (30101), Polygon (30109), Arbitrum (30110),
//  Optimism (30111), Base (30184), Avalanche (30106)
//
//  UTL KENO CROSS-CHAIN:
//  ─────────────────────
//  UTL enables KENO token to travel omnichain through this contract.
//  Users send KENO to UTL on BSC, and UTL bridges it to any destination.
//  This makes KENO a true omnichain token through the UTL infrastructure.
//
//  Author: Kenostod Blockchain Academy LLC — T.D.I.R. Foundation
//  BSC Home EID: 30102
//
// ─────────────────────────────────────────────────────────────────────────────

import "../interfaces/ILayerZero.sol";
import "../interfaces/IUTLFeeCollector.sol";

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IWBNB {
    function deposit() external payable;
    function approve(address spender, uint256 amount) external returns (bool);
}

// Minimal OFT interface for bridging tokens via LayerZero
interface IOFT {
    struct SendParam {
        uint32  dstEid;
        bytes32 to;
        uint256 amountLD;
        uint256 minAmountLD;
        bytes   extraOptions;
        bytes   composeMsg;
        bytes   oftCmd;
    }
    function send(
        SendParam calldata sendParam,
        MessagingFee calldata fee,
        address refundAddress
    ) external payable returns (MessagingReceipt memory, bytes memory);

    function quoteSend(SendParam calldata sendParam, bool payInLzToken)
        external view returns (MessagingFee memory);
}

contract UTLLayerZeroOApp is ILayerZeroReceiver {

    // ── LayerZero ─────────────────────────────────────────────────────────
    ILayerZeroEndpointV2 public immutable endpoint;

    // Chain EID constants
    uint32 public constant EID_BSC       = 30102;
    uint32 public constant EID_ETHEREUM  = 30101;
    uint32 public constant EID_POLYGON   = 30109;
    uint32 public constant EID_ARBITRUM  = 30110;
    uint32 public constant EID_OPTIMISM  = 30111;
    uint32 public constant EID_BASE      = 30184;
    uint32 public constant EID_AVALANCHE = 30106;

    // ── UTL Protocol (BSC Mainnet) ────────────────────────────────────────
    address public constant UTL_FEE_COLLECTOR =
        0xfE537c43d202C455Cedc141B882c808287BB662f;

    address public constant WBNB =
        0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c;

    address public constant KENO =
        0x65791E0B5Cbac5F40c76cDe31bf4F074D982FD0E;

    address public constant USDC =
        0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d;

    // ── Fee config ────────────────────────────────────────────────────────
    // Cross-chain message relay: 5% of the LayerZero native fee paid
    uint256 public constant MSG_FEE_PCT     = 5;       // 5% of LZ gas fee
    // Token bridge fee: 0.07% of token amount bridged
    uint256 public constant BRIDGE_FEE_BPS  = 7;       // 0.07%
    uint256 public constant BPS_DENOMINATOR = 10_000;

    bytes32 public constant FEE_MSG_RELAY   = keccak256("LZ_MESSAGE_RELAY_FEE");
    bytes32 public constant FEE_TOKEN_BRIDGE = keccak256("LZ_TOKEN_BRIDGE_FEE");
    bytes32 public constant FEE_KENO_BRIDGE = keccak256("LZ_KENO_BRIDGE_FEE");

    // ── Peer OApp registry ─────────────────────────────────────────────────
    // Maps destination EID → UTL OApp address on that chain (bytes32 padded)
    mapping(uint32 => bytes32) public peers;

    // ── Message tracking ──────────────────────────────────────────────────
    // Tracks in-flight messages for delivery confirmation
    struct InFlight {
        address sender;
        address recipient;
        address token;
        uint256 netAmount;
        uint32  srcEid;
        uint64  nonce;
        bool    delivered;
    }
    mapping(bytes32 => InFlight) public inFlight; // keyed by guid

    // ── Global stats ──────────────────────────────────────────────────────
    uint256 public totalMessagesFee;    // cumulative BNB collected from message relay
    uint256 public totalBridgeFees;     // cumulative token fees collected
    uint256 public totalMessagesRelayed;
    uint256 public totalBridges;

    // ── Access control ────────────────────────────────────────────────────
    address public owner;

    // ── Reentrancy ────────────────────────────────────────────────────────
    uint256 private _locked = 1;
    modifier nonReentrant() {
        require(_locked == 1, "UTL: reentrant");
        _locked = 2;
        _;
        _locked = 1;
    }

    // ── Events ────────────────────────────────────────────────────────────
    event MessageRelayed(
        bytes32 indexed guid,
        uint32  indexed dstEid,
        address indexed sender,
        uint256 lzFeePaid,
        uint256 utlFee
    );
    event TokenBridged(
        bytes32 indexed guid,
        uint32  indexed dstEid,
        address indexed token,
        address sender,
        address recipient,
        uint256 grossAmount,
        uint256 utlFee,
        uint256 netAmount
    );
    event MessageReceived(
        bytes32 indexed guid,
        uint32  indexed srcEid,
        address recipient,
        address token,
        uint256 amount
    );
    event PeerSet(uint32 indexed eid, bytes32 peer);
    event OwnershipTransferred(address indexed prev, address indexed next);

    // ── Errors ────────────────────────────────────────────────────────────
    error OnlyOwner();
    error OnlyEndpoint();
    error ZeroAddress();
    error ZeroAmount();
    error NoPeerForChain(uint32 eid);
    error InsufficientNativeFee();
    error TransferFailed();
    error AlreadyDelivered();

    // ─────────────────────────────────────────────────────────────────────
    constructor(address _endpoint) {
        if (_endpoint == address(0)) revert ZeroAddress();
        endpoint = ILayerZeroEndpointV2(_endpoint);
        owner    = msg.sender;
        // Register self as delegate so owner can configure LZ libraries
        endpoint.setDelegate(msg.sender);
    }

    receive() external payable {}

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    modifier onlyEndpoint() {
        if (msg.sender != address(endpoint)) revert OnlyEndpoint();
        _;
    }

    // ─────────────────────────────────────────────────────────────────────
    // MODE 1: Cross-chain message relay
    // ─────────────────────────────────────────────────────────────────────
    // Protocols call this instead of endpoint.send() directly.
    // UTL takes 5% of the native LZ fee as its relay toll.
    //
    // @param dstEid    Destination chain EID
    // @param receiver  Receiver contract on destination (bytes32 padded)
    // @param message   Arbitrary message payload
    // @param options   LayerZero execution options (gas settings)
    function relayMessage(
        uint32  dstEid,
        bytes32 receiver,
        bytes calldata message,
        bytes calldata options
    ) external payable nonReentrant returns (MessagingReceipt memory receipt) {
        if (msg.value == 0) revert InsufficientNativeFee();

        // Quote the actual LZ fee
        MessagingParams memory params = MessagingParams({
            dstEid:       dstEid,
            receiver:     receiver,
            message:      message,
            options:      options,
            payInLzToken: false
        });
        MessagingFee memory quotedFee = endpoint.quote(params, address(this));

        if (msg.value < quotedFee.nativeFee) revert InsufficientNativeFee();

        // UTL toll = 5% of the LZ native fee
        uint256 utlFee  = (quotedFee.nativeFee * MSG_FEE_PCT) / 100;
        uint256 lzValue = msg.value - utlFee;

        // Wrap UTL fee → WBNB → FeeCollector
        IWBNB(WBNB).deposit{value: utlFee}();
        IWBNB(WBNB).approve(UTL_FEE_COLLECTOR, utlFee);
        IUTLFeeCollector(UTL_FEE_COLLECTOR).receiveFee(WBNB, utlFee, FEE_MSG_RELAY);

        // Forward message via LayerZero endpoint
        receipt = endpoint.send{value: lzValue}(params, msg.sender);

        totalMessagesFee    += utlFee;
        totalMessagesRelayed += 1;
        emit MessageRelayed(receipt.guid, dstEid, msg.sender, quotedFee.nativeFee, utlFee);
    }

    // ─────────────────────────────────────────────────────────────────────
    // MODE 2: Cross-chain ERC-20 token bridge via OFT
    // ─────────────────────────────────────────────────────────────────────
    // Wraps any OFT-compatible token bridge. UTL collects 0.07% on the
    // gross amount and forwards the rest across chains.
    //
    // @param oftToken    The OFT token contract on this chain
    // @param dstEid      Destination chain EID
    // @param recipient   Who receives tokens on the destination (bytes32 padded)
    // @param amount      Gross amount to bridge (UTL fee deducted before bridging)
    // @param extraOptions LZ execution options for the destination
    function bridgeToken(
        address oftToken,
        uint32  dstEid,
        bytes32 recipient,
        uint256 amount,
        bytes calldata extraOptions
    ) external payable nonReentrant returns (MessagingReceipt memory receipt) {
        if (amount == 0) revert ZeroAmount();

        // Pull tokens from user
        bool ok = IERC20(oftToken).transferFrom(msg.sender, address(this), amount);
        if (!ok) revert TransferFailed();

        // Deduct UTL fee
        bytes32 feeType = (oftToken == KENO) ? FEE_KENO_BRIDGE : FEE_TOKEN_BRIDGE;
        uint256 fee     = (amount * BRIDGE_FEE_BPS) / BPS_DENOMINATOR;
        uint256 netAmt  = amount - fee;

        // Route fee to UTL FeeCollector
        IERC20(oftToken).approve(UTL_FEE_COLLECTOR, fee);
        IUTLFeeCollector(UTL_FEE_COLLECTOR).receiveFee(oftToken, fee, feeType);

        // Quote LZ fee for the OFT send
        IOFT.SendParam memory sendParam = IOFT.SendParam({
            dstEid:       dstEid,
            to:           recipient,
            amountLD:     netAmt,
            minAmountLD:  (netAmt * 995) / 1000,  // 0.5% slippage tolerance
            extraOptions: extraOptions,
            composeMsg:   bytes(""),
            oftCmd:       bytes("")
        });

        MessagingFee memory lzFee = IOFT(oftToken).quoteSend(sendParam, false);
        if (msg.value < lzFee.nativeFee) revert InsufficientNativeFee();

        // Approve OFT to pull net amount
        IERC20(oftToken).approve(oftToken, netAmt);

        // Execute the OFT bridge send
        (receipt,) = IOFT(oftToken).send{value: lzFee.nativeFee}(
            sendParam,
            lzFee,
            msg.sender   // excess gas refunded to sender
        );

        totalBridgeFees += fee;
        totalBridges    += 1;

        emit TokenBridged(
            receipt.guid, dstEid, oftToken,
            msg.sender, address(uint160(uint256(recipient))),
            amount, fee, netAmt
        );
    }

    // ─────────────────────────────────────────────────────────────────────
    // lzReceive — handles inbound messages from other chains
    // ─────────────────────────────────────────────────────────────────────
    // When UTL is the receiver on the destination chain, LayerZero calls
    // this function to deliver the message. UTL decodes and delivers tokens.
    function lzReceive(
        Origin calldata origin,
        bytes32 guid,
        bytes calldata message,
        address,        // executor
        bytes calldata  // extraData
    ) external payable override onlyEndpoint {
        InFlight storage flight = inFlight[guid];
        if (flight.delivered) revert AlreadyDelivered();
        flight.delivered = true;

        // Decode the message: (recipient, token, netAmount)
        (address recipient, address token, uint256 netAmount) =
            abi.decode(message, (address, address, uint256));

        // Deliver tokens to recipient
        if (token == address(0)) {
            // Native token delivery
            (bool ok,) = payable(recipient).call{value: netAmount}("");
            if (!ok) revert TransferFailed();
        } else {
            IERC20(token).transfer(recipient, netAmount);
        }

        emit MessageReceived(guid, origin.srcEid, recipient, token, netAmount);
    }

    // ─────────────────────────────────────────────────────────────────────
    // Quote helpers — call off-chain to estimate fees before transacting
    // ─────────────────────────────────────────────────────────────────────

    // Quote message relay fee (LZ native fee + UTL toll)
    function quoteRelayMessage(
        uint32 dstEid,
        bytes32 receiver,
        bytes calldata message,
        bytes calldata options
    ) external view returns (uint256 totalNative, uint256 lzFee, uint256 utlFee) {
        MessagingParams memory params = MessagingParams({
            dstEid:       dstEid,
            receiver:     receiver,
            message:      message,
            options:      options,
            payInLzToken: false
        });
        MessagingFee memory fee = endpoint.quote(params, address(this));
        lzFee      = fee.nativeFee;
        utlFee     = (lzFee * MSG_FEE_PCT) / 100;
        totalNative = lzFee + utlFee;
    }

    // Quote bridge fee
    function quoteBridge(
        uint256 amount
    ) external pure returns (uint256 utlFee, uint256 netAmount) {
        utlFee    = (amount * BRIDGE_FEE_BPS) / BPS_DENOMINATOR;
        netAmount = amount - utlFee;
    }

    // ─────────────────────────────────────────────────────────────────────
    // Admin
    // ─────────────────────────────────────────────────────────────────────

    // Register peer UTL OApp on another chain
    function setPeer(uint32 eid, bytes32 peer) external onlyOwner {
        peers[eid] = peer;
        emit PeerSet(eid, peer);
    }

    // Helper: convert address to bytes32 (for peer registration)
    function addressToBytes32(address addr) external pure returns (bytes32) {
        return bytes32(uint256(uint160(addr)));
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner    = newOwner;
        endpoint.setDelegate(newOwner);
    }

    function rescueTokens(address token, uint256 amount) external onlyOwner {
        IERC20(token).transfer(owner, amount);
    }

    function rescueBNB(uint256 amount) external onlyOwner {
        (bool ok,) = payable(owner).call{value: amount}("");
        if (!ok) revert TransferFailed();
    }
}
