// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// ─────────────────────────────────────────────────────────────────────────────
//
//  UTL 1inch Router — Universal Transaction Layer × 1inch Aggregator
//
//  Wraps 1inch's Aggregation Router v6 to collect a micro-fee on every swap
//  routed through UTL, then forwards the net output to the user.
//
//  HOW THE INJECTION WORKS:
//  ─────────────────────────
//  1inch generates a SwapDescription off-chain that includes a `dstReceiver`
//  field — the address that receives the output token after the swap.
//  UTL1inchRouter sets ITSELF as the dstReceiver.
//  After 1inch delivers the output here, UTL deducts its fee and forwards
//  the net amount to the original intended recipient.
//
//  USER FLOW:
//  ──────────
//  1. User calls 1inch API → gets swap calldata (executor, desc, data)
//  2. User calls UTL1inchRouter.swap() instead of calling 1inch directly
//     • Pass the original dstReceiver as finalRecipient
//     • UTL1inchRouter patches desc.dstReceiver = address(this)
//  3. UTL1inchRouter calls 1inch → output lands here
//  4. UTL deducts 0.07% fee → routes to UTL FeeCollector
//  5. Net output sent to finalRecipient
//  6. User earns UTL loyalty points
//
//  FUSION RESOLVER:
//  ────────────────
//  UTL1inchRouter also participates as a 1inch Fusion resolver.
//  Fusion resolvers compete to fill limit orders at the best price.
//  When UTL resolves an order, it earns the spread AND charges the UTL fee.
//  This is passive income on top of arbitrage profits.
//
//  Author: Kenostod Blockchain Academy LLC — T.D.I.R. Foundation
//  Network: BSC Mainnet (chainId 56)
//
// ─────────────────────────────────────────────────────────────────────────────

import "../interfaces/I1inch.sol";
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
    function balanceOf(address account) external view returns (uint256);
}

contract UTL1inchRouter {

    // ── 1inch addresses (BSC Mainnet) ─────────────────────────────────────
    address public constant ONEINCH_ROUTER_V6  = 0x111111125421cA6dc452d289314280a0f8842A65;
    address public constant ONEINCH_ROUTER_V5  = 0x1111111254EEB25477B68fb85Ed929f73A960582;

    // ── UTL Protocol addresses (BSC Mainnet) ─────────────────────────────
    address public constant UTL_FEE_COLLECTOR  = 0xfE537c43d202C455Cedc141B882c808287BB662f;
    address public constant WBNB               = 0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c;

    // Native BNB sentinel
    address public constant NATIVE             = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    // ── Fee config ────────────────────────────────────────────────────────
    // 0.07% on swap output — competitive with 1inch's own fee (0.05–0.30%)
    // Users still get a better net price via 1inch's routing vs any single DEX
    uint256 public constant SWAP_FEE_BPS    = 7;
    uint256 public constant FUSION_FEE_BPS  = 5;   // 0.05% on Fusion fills (lower — resolver makes spread)
    uint256 public constant BPS_DENOMINATOR = 10_000;

    bytes32 public constant FEE_SWAP_ERC20  = keccak256("ONEINCH_SWAP_ERC20_FEE");
    bytes32 public constant FEE_SWAP_BNB    = keccak256("ONEINCH_SWAP_BNB_FEE");
    bytes32 public constant FEE_FUSION      = keccak256("ONEINCH_FUSION_RESOLVER_FEE");

    // ── Reentrancy guard ──────────────────────────────────────────────────
    uint256 private _locked = 1;
    modifier nonReentrant() {
        require(_locked == 1, "UTL: reentrant call");
        _locked = 2;
        _;
        _locked = 1;
    }

    // ── Loyalty tracking ──────────────────────────────────────────────────
    struct UserStats {
        uint256 swapCount;
        uint256 totalVolumeIn;
        uint256 totalFeesGenerated;
        uint256 loyaltyPoints;
    }
    mapping(address => UserStats) public userStats;

    uint256 public totalSwaps;
    uint256 public totalFeesCollected;

    // ── Access control ────────────────────────────────────────────────────
    address public owner;

    // ── Authorized Fusion resolvers (whitelisted callers for resolveOrder) ─
    mapping(address => bool) public authorizedResolvers;

    // ── Events ────────────────────────────────────────────────────────────
    event UTLSwap(
        address indexed user,
        address indexed srcToken,
        address indexed dstToken,
        uint256 amountIn,
        uint256 amountOut,
        uint256 fee
    );
    event UTLSwapBNB(
        address indexed user,
        address indexed dstToken,
        uint256 bnbIn,
        uint256 amountOut,
        uint256 fee
    );
    event UTLFusionFill(
        address indexed resolver,
        bytes32 indexed orderHash,
        address indexed dstToken,
        uint256 filledAmount,
        uint256 fee
    );
    event LoyaltyPointsEarned(address indexed user, uint256 points, uint256 total);
    event OwnershipTransferred(address indexed prev, address indexed next);

    // ── Errors ────────────────────────────────────────────────────────────
    error OnlyOwner();
    error ZeroAddress();
    error ZeroAmount();
    error SlippageExceeded(uint256 received, uint256 minimum);
    error TransferFailed();
    error NotAuthorizedResolver();
    error OneInchCallFailed();

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
    // CORE: ERC-20 → ERC-20 swap via 1inch
    // ─────────────────────────────────────────────────────────────────────

    // @param executor       From 1inch API response
    // @param desc           SwapDescription — pass dstReceiver as your wallet address;
    //                       this contract will patch it to itself before forwarding
    // @param data           Execution calldata from 1inch API
    // @param finalRecipient Who ultimately receives the output tokens (your wallet)
    // @param minNetReturn   Minimum net output AFTER UTL fee is deducted
    function swap(
        address executor,
        SwapDescription calldata desc,
        bytes calldata data,
        address finalRecipient,
        uint256 minNetReturn
    ) external nonReentrant returns (uint256 netReturn) {
        if (finalRecipient == address(0)) revert ZeroAddress();
        if (desc.amount    == 0)          revert ZeroAmount();

        // Pull source tokens from user
        bool ok = IERC20(desc.srcToken).transferFrom(msg.sender, address(this), desc.amount);
        if (!ok) revert TransferFailed();

        // Approve 1inch router to spend srcToken
        IERC20(desc.srcToken).approve(ONEINCH_ROUTER_V6, desc.amount);

        // Patch dstReceiver → this contract so we intercept the output
        SwapDescription memory patchedDesc = desc;
        patchedDesc.dstReceiver = payable(address(this));

        // Record pre-balance of dstToken
        uint256 balBefore = IERC20(desc.dstToken).balanceOf(address(this));

        // Execute 1inch swap
        (bool success,) = ONEINCH_ROUTER_V6.call(
            abi.encodeWithSelector(
                IAggregationRouterV6.swap.selector,
                executor,
                patchedDesc,
                data
            )
        );
        if (!success) revert OneInchCallFailed();

        // Measure actual output received
        uint256 balAfter  = IERC20(desc.dstToken).balanceOf(address(this));
        uint256 received  = balAfter - balBefore;

        // Deduct UTL fee from output
        uint256 fee = (received * SWAP_FEE_BPS) / BPS_DENOMINATOR;
        netReturn   = received - fee;

        // Slippage check on NET amount
        if (netReturn < minNetReturn) revert SlippageExceeded(netReturn, minNetReturn);

        // Route fee to UTL FeeCollector
        _routeERC20Fee(desc.dstToken, fee, FEE_SWAP_ERC20);

        // Send net output to final recipient
        IERC20(desc.dstToken).transfer(finalRecipient, netReturn);

        // Loyalty tracking
        _recordSwap(msg.sender, desc.amount, fee);
        emit UTLSwap(msg.sender, desc.srcToken, desc.dstToken, desc.amount, netReturn, fee);
    }

    // ─────────────────────────────────────────────────────────────────────
    // CORE: Native BNB → ERC-20 swap via 1inch
    // ─────────────────────────────────────────────────────────────────────

    // @param executor        From 1inch API response
    // @param desc            SwapDescription (srcToken should be NATIVE sentinel)
    // @param data            Execution calldata from 1inch API
    // @param finalRecipient  Who receives the output ERC-20
    // @param minNetReturn    Minimum net output after UTL fee
    function swapBNB(
        address executor,
        SwapDescription calldata desc,
        bytes calldata data,
        address finalRecipient,
        uint256 minNetReturn
    ) external payable nonReentrant returns (uint256 netReturn) {
        if (finalRecipient == address(0)) revert ZeroAddress();
        if (msg.value      == 0)          revert ZeroAmount();

        uint256 bnbAmount = msg.value;

        // Patch dstReceiver → this contract
        SwapDescription memory patchedDesc = desc;
        patchedDesc.dstReceiver = payable(address(this));
        patchedDesc.amount      = bnbAmount;

        uint256 balBefore = IERC20(desc.dstToken).balanceOf(address(this));

        // Execute 1inch swap with BNB value
        (bool success,) = ONEINCH_ROUTER_V6.call{value: bnbAmount}(
            abi.encodeWithSelector(
                IAggregationRouterV6.swap.selector,
                executor,
                patchedDesc,
                data
            )
        );
        if (!success) revert OneInchCallFailed();

        uint256 received = IERC20(desc.dstToken).balanceOf(address(this)) - balBefore;
        uint256 fee      = (received * SWAP_FEE_BPS) / BPS_DENOMINATOR;
        netReturn        = received - fee;

        if (netReturn < minNetReturn) revert SlippageExceeded(netReturn, minNetReturn);

        _routeERC20Fee(desc.dstToken, fee, FEE_SWAP_BNB);
        IERC20(desc.dstToken).transfer(finalRecipient, netReturn);

        _recordSwap(msg.sender, bnbAmount, fee);
        emit UTLSwapBNB(msg.sender, desc.dstToken, bnbAmount, netReturn, fee);
    }

    // ─────────────────────────────────────────────────────────────────────
    // CORE: ERC-20 → Native BNB swap via 1inch
    // ─────────────────────────────────────────────────────────────────────

    function swapToBNB(
        address executor,
        SwapDescription calldata desc,
        bytes calldata data,
        address payable finalRecipient,
        uint256 minNetReturn
    ) external nonReentrant returns (uint256 netReturn) {
        if (finalRecipient == address(0)) revert ZeroAddress();
        if (desc.amount    == 0)          revert ZeroAmount();

        IERC20(desc.srcToken).transferFrom(msg.sender, address(this), desc.amount);
        IERC20(desc.srcToken).approve(ONEINCH_ROUTER_V6, desc.amount);

        SwapDescription memory patchedDesc = desc;
        patchedDesc.dstReceiver = payable(address(this));

        uint256 bnbBefore = address(this).balance;

        (bool success,) = ONEINCH_ROUTER_V6.call(
            abi.encodeWithSelector(
                IAggregationRouterV6.swap.selector,
                executor,
                patchedDesc,
                data
            )
        );
        if (!success) revert OneInchCallFailed();

        uint256 received = address(this).balance - bnbBefore;
        uint256 fee      = (received * SWAP_FEE_BPS) / BPS_DENOMINATOR;
        netReturn        = received - fee;

        if (netReturn < minNetReturn) revert SlippageExceeded(netReturn, minNetReturn);

        // Wrap fee to WBNB for FeeCollector
        IWBNB(WBNB).deposit{value: fee}();
        IWBNB(WBNB).approve(UTL_FEE_COLLECTOR, fee);
        IUTLFeeCollector(UTL_FEE_COLLECTOR).receiveFee(WBNB, fee, FEE_SWAP_BNB);

        // Send net BNB to user
        (bool sent,) = finalRecipient.call{value: netReturn}("");
        if (!sent) revert TransferFailed();

        _recordSwap(msg.sender, desc.amount, fee);
        emit UTLSwap(msg.sender, desc.srcToken, NATIVE, desc.amount, netReturn, fee);
    }

    // ─────────────────────────────────────────────────────────────────────
    // FUSION RESOLVER — Fill 1inch Fusion orders, earn spread + UTL fee
    // ─────────────────────────────────────────────────────────────────────
    // This contract can be whitelisted as a 1inch Fusion resolver.
    // Resolvers fill user limit orders at a price better than market.
    // UTL earns fee on each fill on top of the resolver spread.

    function resolveOrder(
        address fusionSettlement,
        bytes calldata settlementData,
        address outputToken,
        uint256 expectedOutput,
        bytes32 orderHash
    ) external nonReentrant {
        if (!authorizedResolvers[msg.sender]) revert NotAuthorizedResolver();

        uint256 balBefore = IERC20(outputToken).balanceOf(address(this));

        // Execute the Fusion settlement
        (bool ok,) = fusionSettlement.call(settlementData);
        if (!ok) revert OneInchCallFailed();

        uint256 received = IERC20(outputToken).balanceOf(address(this)) - balBefore;
        if (received == 0) return;

        uint256 fee   = (received * FUSION_FEE_BPS) / BPS_DENOMINATOR;
        uint256 net   = received - fee;

        _routeERC20Fee(outputToken, fee, FEE_FUSION);

        // Net resolver earnings stay in this contract (withdrawable by owner)
        emit UTLFusionFill(msg.sender, orderHash, outputToken, received, fee);
    }

    // Withdraw accumulated resolver profits
    function withdrawResolverProfit(address token, uint256 amount) external onlyOwner {
        IERC20(token).transfer(owner, amount);
    }

    // ─────────────────────────────────────────────────────────────────────
    // Internal helpers
    // ─────────────────────────────────────────────────────────────────────

    function _routeERC20Fee(address token, uint256 fee, bytes32 feeType) internal {
        if (fee == 0) return;
        IERC20(token).approve(UTL_FEE_COLLECTOR, fee);
        IUTLFeeCollector(UTL_FEE_COLLECTOR).receiveFee(token, fee, feeType);
        totalFeesCollected += fee;
    }

    function _recordSwap(address user, uint256 volume, uint256 fee) internal {
        UserStats storage s = userStats[user];
        s.swapCount          += 1;
        s.totalVolumeIn      += volume;
        s.totalFeesGenerated += fee;
        uint256 pts           = fee * 150;  // 1.5x multiplier — 1inch users are high-volume
        s.loyaltyPoints      += pts;
        totalSwaps           += 1;
        emit LoyaltyPointsEarned(user, pts, s.loyaltyPoints);
    }

    // ─────────────────────────────────────────────────────────────────────
    // View
    // ─────────────────────────────────────────────────────────────────────

    function getUserStats(address user) external view returns (
        uint256 swapCount,
        uint256 totalVolumeIn,
        uint256 totalFeesGenerated,
        uint256 loyaltyPoints,
        string memory tier
    ) {
        UserStats memory s = userStats[user];
        string memory t;
        if      (s.loyaltyPoints >= 1_000_000) t = "Architect";
        else if (s.loyaltyPoints >= 100_000)   t = "Builder";
        else if (s.loyaltyPoints >= 10_000)    t = "Contributor";
        else                                   t = "Observer";
        return (s.swapCount, s.totalVolumeIn, s.totalFeesGenerated, s.loyaltyPoints, t);
    }

    // ─────────────────────────────────────────────────────────────────────
    // Admin
    // ─────────────────────────────────────────────────────────────────────

    function setAuthorizedResolver(address resolver, bool authorized) external onlyOwner {
        authorizedResolvers[resolver] = authorized;
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
