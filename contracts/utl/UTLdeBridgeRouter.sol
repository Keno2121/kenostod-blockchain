// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// ─────────────────────────────────────────────────────────────────────────────
//
//  UTL deBridge Router — Universal Transaction Layer × deBridge DLN
//
//  The cleanest injection on the list.
//
//  deBridge has a built-in AFFILIATE FEE system — when you create a DLN order,
//  you specify an affiliate address and basis points. deBridge deducts that
//  from the protocol's own fee pool and forwards it to your address.
//  Cost to the user: ZERO extra. UTL earns from deBridge's existing fee revenue.
//
//  IN ADDITION, UTL operates as a DLN MAKER — a market maker that fills
//  cross-chain orders on the destination chain. Makers earn the spread
//  (difference between giveAmount and takeAmount). UTL takes a 0.05% cut
//  of each fill it executes.
//
//  TWO REVENUE STREAMS:
//  ─────────────────────
//  1. AFFILIATE FEES (passive, zero user cost)
//     Every order created through UTL includes UTL's affiliate address.
//     deBridge pays UTL from their protocol fee. Users pay the same as normal.
//
//  2. MAKER FILLS (active, execution-based)
//     UTL holds destination-chain liquidity and fills DLN orders.
//     Earns the maker spread MINUS a 0.05% UTL fee to stakers.
//
//  HOW AFFILIATE FEES WORK:
//  ─────────────────────────
//  deBridge's protocol fee on a $1000 bridge is ~0.1% ($1.00).
//  UTL's affiliate split is 50% of that fee = $0.50 per $1000 bridged.
//  This flows automatically to UTL FeeCollector → 60% to USDC stakers.
//
//  Author: Kenostod Blockchain Academy LLC — T.D.I.R. Foundation
//  Network: BSC Mainnet (chainId 56) — deploy on all supported chains
//
// ─────────────────────────────────────────────────────────────────────────────

import "../interfaces/IdeBridge.sol";
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

contract UTLdeBridgeRouter {

    // ── deBridge addresses (BSC Mainnet) ──────────────────────────────────
    address public constant DLN_SOURCE      = 0xeF4fB24aD0916217251F553c0596F8Edc630EB66;
    address public constant DLN_DESTINATION = 0xE7351Fd770A37282b91D153Ee690B63579D6dd7f;
    address public constant DEBRIDGE_GATE   = 0x43dE2d77BF8027e25dBD179B491e8d64f38398aA;

    // ── UTL Protocol (BSC Mainnet) ────────────────────────────────────────
    address public constant UTL_FEE_COLLECTOR =
        0xfE537c43d202C455Cedc141B882c808287BB662f;

    address public constant WBNB =
        0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c;

    // ── Affiliate config ──────────────────────────────────────────────────
    // deBridge affiliate fee: UTL earns this % of deBridge's protocol fee
    // on every order routed through UTL. Users pay nothing extra.
    // 5000 bps = 50% of deBridge's protocol fee goes to UTL
    uint256 public affiliateFeeBps = 5000;

    // UTL's registered deBridge referral code — registered April 2025
    // Wallet: 0x4AA73FadfFd71E6549867a37455EA957A52Cf849
    // Verify: app.debridge.finance/statistics/0x4AA73FadfFd71E6549867a37455EA957A52Cf849
    uint32  public referralCode = 32946;

    // ── Maker fill fee ────────────────────────────────────────────────────
    // When UTL fills an order as a maker, it takes this cut of the fill amount
    uint256 public constant MAKER_FEE_BPS  = 5;    // 0.05% — makers make spread anyway
    uint256 public constant BPS_DENOMINATOR = 10_000;

    bytes32 public constant FEE_AFFILIATE  = keccak256("DEBRIDGE_AFFILIATE_FEE");
    bytes32 public constant FEE_MAKER_FILL = keccak256("DEBRIDGE_MAKER_FILL_FEE");
    bytes32 public constant FEE_GATE_MSG   = keccak256("DEBRIDGE_GATE_MESSAGE_FEE");

    // ── Maker liquidity pools ─────────────────────────────────────────────
    // UTL holds destination-chain tokens to fill orders.
    // Anyone can add liquidity; liquidity providers share maker earnings.
    struct MakerPool {
        uint256 totalLiquidity;     // total tokens in pool
        uint256 totalFeesEarned;    // cumulative maker fees collected
        uint256 totalFillsExecuted; // number of orders filled from this pool
    }
    mapping(address => MakerPool) public makerPools; // token → pool stats

    // Liquidity provider tracking
    mapping(address => mapping(address => uint256)) public lpBalance; // token → user → balance

    // ── Order tracking ────────────────────────────────────────────────────
    struct OrderRecord {
        address maker;
        address giveToken;
        uint256 giveAmount;
        address takeToken;
        uint256 takeAmount;
        uint256 dstChainId;
        bytes32 orderId;
        bool    filled;
        uint256 utlFeeCollected;
    }
    mapping(bytes32 => OrderRecord) public orders;

    // ── Global stats ──────────────────────────────────────────────────────
    uint256 public totalOrdersCreated;
    uint256 public totalOrdersFilled;
    uint256 public totalAffiliateFeesEarned;
    uint256 public totalMakerFeesEarned;

    // ── Access control ────────────────────────────────────────────────────
    address public owner;
    mapping(address => bool) public authorizedFillers; // bots that can call fulfillAsUTLMaker

    // ── Reentrancy ────────────────────────────────────────────────────────
    uint256 private _locked = 1;
    modifier nonReentrant() {
        require(_locked == 1, "UTL: reentrant");
        _locked = 2;
        _;
        _locked = 1;
    }

    // ── Events ────────────────────────────────────────────────────────────
    event OrderCreatedViaUTL(
        bytes32 indexed orderId,
        address indexed maker,
        address giveToken,
        uint256 giveAmount,
        uint256 dstChainId
    );
    event OrderFilledByUTL(
        bytes32 indexed orderId,
        address indexed filler,
        address takeToken,
        uint256 fillAmount,
        uint256 makerFee
    );
    event AffiliateFeeClaimed(
        address indexed token,
        uint256 amount
    );
    event LiquidityAdded(address indexed token, address indexed provider, uint256 amount);
    event LiquidityRemoved(address indexed token, address indexed provider, uint256 amount);
    event ReferralCodeSet(uint32 code);
    event OwnershipTransferred(address indexed prev, address indexed next);

    // ── Errors ────────────────────────────────────────────────────────────
    error OnlyOwner();
    error NotAuthorizedFiller();
    error ZeroAmount();
    error ZeroAddress();
    error InsufficientPoolLiquidity();
    error OrderAlreadyFilled();
    error TransferFailed();
    error InsufficientNativeFee();

    // ─────────────────────────────────────────────────────────────────────
    constructor(uint32 _referralCode) {
        owner        = msg.sender;
        referralCode = _referralCode;
    }

    receive() external payable {}

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    // ─────────────────────────────────────────────────────────────────────
    // REVENUE STREAM 1: Create orders with UTL affiliate fee
    // ─────────────────────────────────────────────────────────────────────
    // Users call this instead of DLN Source directly.
    // UTL is injected as the affiliate — deBridge pays UTL from its own fee.
    // User experience is IDENTICAL to using deBridge directly.
    //
    // @param orderCreation  DLN order parameters
    // @param permitEnvelope Optional ERC-2612 permit (pass bytes("") to skip)
    function createOrder(
        DlnOrderLib.OrderCreation calldata orderCreation,
        bytes calldata permitEnvelope
    ) external payable nonReentrant returns (bytes32 orderId) {

        // Pull give tokens from user if not native
        if (orderCreation.giveTokenAddress != address(0)) {
            bool ok = IERC20(orderCreation.giveTokenAddress)
                .transferFrom(msg.sender, address(this), orderCreation.giveAmount);
            if (!ok) revert TransferFailed();
            IERC20(orderCreation.giveTokenAddress).approve(DLN_SOURCE, orderCreation.giveAmount);
        }

        // Encode UTL affiliate fee: UTL FeeCollector gets affiliateFeeBps of deBridge's fee
        // deBridge deducts this from THEIR protocol fee, not from the user's give amount
        bytes memory affiliateFeeData = abi.encode(UTL_FEE_COLLECTOR, affiliateFeeBps);

        // Forward to deBridge DLN Source
        orderId = IDlnSource(DLN_SOURCE).createOrder{value: msg.value}(
            orderCreation,
            affiliateFeeData,
            referralCode,
            permitEnvelope
        );

        // Record order for tracking
        orders[orderId] = OrderRecord({
            maker:             msg.sender,
            giveToken:         orderCreation.giveTokenAddress,
            giveAmount:        orderCreation.giveAmount,
            takeToken:         address(0),          // destination token — not known on source
            takeAmount:        orderCreation.takeAmount,
            dstChainId:        orderCreation.takeChainId,
            orderId:           orderId,
            filled:            false,
            utlFeeCollected:   0
        });

        totalOrdersCreated++;
        emit OrderCreatedViaUTL(
            orderId, msg.sender,
            orderCreation.giveTokenAddress,
            orderCreation.giveAmount,
            orderCreation.takeChainId
        );
    }

    // ─────────────────────────────────────────────────────────────────────
    // REVENUE STREAM 2: Fill orders as UTL Maker
    // ─────────────────────────────────────────────────────────────────────
    // UTL's bot monitors DLN Source events for profitable orders.
    // When spread > 0.05%, UTL fills the order and earns the net spread.
    // 0.05% of fill amount → UTL FeeCollector → stakers.
    //
    // Caller must be an authorized filler (UTL's arb bot wallet).
    //
    // @param order            Full DLN Order struct (from deBridge events)
    // @param orderId          Order hash
    // @param fulfilledAmount  Amount to fulfill
    function fulfillAsUTLMaker(
        DlnOrderLib.Order calldata order,
        bytes32 orderId,
        uint256 fulfilledAmount
    ) external payable nonReentrant {
        if (!authorizedFillers[msg.sender]) revert NotAuthorizedFiller();
        if (fulfilledAmount == 0)            revert ZeroAmount();

        OrderRecord storage rec = orders[orderId];
        if (rec.filled) revert OrderAlreadyFilled();

        // Determine take token (EVM address from bytes)
        address takeToken = _bytesToAddress(order.takeTokenAddress);

        // Check UTL pool has enough liquidity to fill
        MakerPool storage pool = makerPools[takeToken];
        if (pool.totalLiquidity < fulfilledAmount) revert InsufficientPoolLiquidity();

        // Deduct UTL maker fee from fill amount
        uint256 makerFee = (fulfilledAmount * MAKER_FEE_BPS) / BPS_DENOMINATOR;
        uint256 netFill  = fulfilledAmount - makerFee;

        // Approve DLN Destination to pull fill amount from this contract
        pool.totalLiquidity -= fulfilledAmount;
        IERC20(takeToken).approve(DLN_DESTINATION, netFill);

        // Execute the fill — delivers netFill to the order recipient
        IDlnDestination(DLN_DESTINATION).fulfillOrder{value: msg.value}(
            order,
            orderId,
            netFill,
            bytes("")
        );

        // Route maker fee to UTL FeeCollector
        IERC20(takeToken).approve(UTL_FEE_COLLECTOR, makerFee);
        IUTLFeeCollector(UTL_FEE_COLLECTOR).receiveFee(takeToken, makerFee, FEE_MAKER_FILL);

        // Update records
        rec.filled           = true;
        rec.utlFeeCollected  = makerFee;
        pool.totalFeesEarned    += makerFee;
        pool.totalFillsExecuted += 1;
        totalOrdersFilled++;
        totalMakerFeesEarned += makerFee;

        emit OrderFilledByUTL(orderId, msg.sender, takeToken, fulfilledAmount, makerFee);
    }

    // ─────────────────────────────────────────────────────────────────────
    // Maker liquidity management
    // ─────────────────────────────────────────────────────────────────────
    // Anyone can deposit tokens into UTL's maker pools.
    // Liquidity earns proportional maker fees minus UTL's 0.05% cut.

    function addLiquidity(address token, uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        bool ok = IERC20(token).transferFrom(msg.sender, address(this), amount);
        if (!ok) revert TransferFailed();
        makerPools[token].totalLiquidity += amount;
        lpBalance[token][msg.sender]     += amount;
        emit LiquidityAdded(token, msg.sender, amount);
    }

    function removeLiquidity(address token, uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (lpBalance[token][msg.sender] < amount) revert InsufficientPoolLiquidity();
        lpBalance[token][msg.sender]     -= amount;
        makerPools[token].totalLiquidity -= amount;
        bool ok = IERC20(token).transfer(msg.sender, amount);
        if (!ok) revert TransferFailed();
        emit LiquidityRemoved(token, msg.sender, amount);
    }

    // ─────────────────────────────────────────────────────────────────────
    // Claim affiliate fees that deBridge has sent to this contract
    // ─────────────────────────────────────────────────────────────────────
    // deBridge forwards affiliate fees to UTL_FEE_COLLECTOR directly.
    // This function handles any tokens that land here instead.
    function claimAffiliateTokens(address token, uint256 amount) external onlyOwner {
        uint256 bal = IERC20(token).balanceOf(address(this));
        uint256 claimable = amount > bal ? bal : amount;
        IERC20(token).approve(UTL_FEE_COLLECTOR, claimable);
        IUTLFeeCollector(UTL_FEE_COLLECTOR).receiveFee(token, claimable, FEE_AFFILIATE);
        totalAffiliateFeesEarned += claimable;
        emit AffiliateFeeClaimed(token, claimable);
    }

    // Claim native BNB affiliate fees
    function claimAffiliateBNB() external onlyOwner {
        uint256 bal = address(this).balance;
        if (bal == 0) return;
        IWBNB(WBNB).deposit{value: bal}();
        IWBNB(WBNB).approve(UTL_FEE_COLLECTOR, bal);
        IUTLFeeCollector(UTL_FEE_COLLECTOR).receiveFee(WBNB, bal, FEE_AFFILIATE);
        totalAffiliateFeesEarned += bal;
        emit AffiliateFeeClaimed(WBNB, bal);
    }

    // ─────────────────────────────────────────────────────────────────────
    // View helpers
    // ─────────────────────────────────────────────────────────────────────

    function getPoolStats(address token) external view returns (
        uint256 totalLiquidity,
        uint256 totalFeesEarned,
        uint256 totalFillsExecuted
    ) {
        MakerPool memory p = makerPools[token];
        return (p.totalLiquidity, p.totalFeesEarned, p.totalFillsExecuted);
    }

    function getOrderRecord(bytes32 orderId) external view returns (OrderRecord memory) {
        return orders[orderId];
    }

    // Global protocol summary
    function getStats() external view returns (
        uint256 ordersCreated,
        uint256 ordersFilled,
        uint256 affiliateFees,
        uint256 makerFees
    ) {
        return (
            totalOrdersCreated,
            totalOrdersFilled,
            totalAffiliateFeesEarned,
            totalMakerFeesEarned
        );
    }

    // ─────────────────────────────────────────────────────────────────────
    // Internal
    // ─────────────────────────────────────────────────────────────────────

    function _bytesToAddress(bytes memory b) internal pure returns (address addr) {
        require(b.length >= 20, "invalid address bytes");
        assembly { addr := mload(add(b, 20)) }
    }

    // ─────────────────────────────────────────────────────────────────────
    // Admin
    // ─────────────────────────────────────────────────────────────────────

    function setReferralCode(uint32 code) external onlyOwner {
        referralCode = code;
        emit ReferralCodeSet(code);
    }

    function setAffiliateFeeBps(uint256 bps) external onlyOwner {
        require(bps <= 10_000, "exceeds 100%");
        affiliateFeeBps = bps;
    }

    function setAuthorizedFiller(address filler, bool authorized) external onlyOwner {
        authorizedFillers[filler] = authorized;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function rescueTokens(address token, uint256 amount) external onlyOwner {
        IERC20(token).transfer(owner, amount);
    }

    function rescueBNB(uint256 amount) external onlyOwner {
        (bool ok,) = payable(owner).call{value: amount}("");
        if (!ok) revert TransferFailed();
    }
}
