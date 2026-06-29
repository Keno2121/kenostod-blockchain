// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// ─────────────────────────────────────────────────────────────────────────────
// 1inch Network — Interfaces for UTL1inchRouter
//
// BSC Mainnet addresses:
//   Aggregation Router v6:  0x111111125421cA6dc452d289314280a0f8842A65
//   Aggregation Router v5:  0x1111111254EEB25477B68fb85Ed929f73A960582
//   Limit Order Protocol v3: 0x1111111254EEB25477B68fb85Ed929f73A960582
//
// Full spec: https://docs.1inch.io/docs/aggregation-protocol/smart-contract/AggregationRouterV6
// ─────────────────────────────────────────────────────────────────────────────

// ── Aggregation Router v6 ─────────────────────────────────────────────────────

struct SwapDescription {
    address srcToken;           // token being sold (address(0xEeEe...) for native BNB)
    address dstToken;           // token being bought
    address payable srcReceiver; // who receives the srcToken from the user (executor or router)
    address payable dstReceiver; // ← UTL sets this to UTL1inchRouter to intercept output
    uint256 amount;             // amount of srcToken to sell
    uint256 minReturnAmount;    // minimum dstToken to receive (slippage guard)
    uint256 flags;              // packed option flags
}

interface IAggregationRouterV6 {
    // Main swap — routes through the best DEX path found by 1inch API
    // executor: 1inch's executor contract address (from API response)
    // desc:     SwapDescription — UTL sets dstReceiver to itself here
    // data:     execution calldata from the 1inch API
    // Returns: returnAmount (actual dstToken received), spentAmount (srcToken spent)
    function swap(
        address executor,
        SwapDescription calldata desc,
        bytes calldata data
    ) external payable returns (uint256 returnAmount, uint256 spentAmount);

    // Unoswap — optimized single-pool swap (cheaper gas than full swap)
    // token:  source token
    // amount: source amount
    // minReturn: minimum output
    // pools: packed pool addresses to route through
    function unoswap(
        address token,
        uint256 amount,
        uint256 minReturn,
        uint256[] calldata pools
    ) external returns (uint256 returnAmount);

    // ETH/BNB → token swap
    function ethUnoswap(
        uint256 minReturn,
        uint256[] calldata pools
    ) external payable returns (uint256 returnAmount);
}

// ── 1inch Fusion (v2) — Limit Order / Resolver Protocol ───────────────────────
// Fusion lets resolvers fill orders and earn the spread.
// UTL resolver earns the spread AND charges a UTL fee on each fill.

struct Order {
    uint256 salt;
    address makerAsset;
    address takerAsset;
    address maker;
    address receiver;       // who receives the filled order output
    address allowedSender;  // address(0) = anyone can fill
    uint256 makingAmount;
    uint256 takingAmount;
    uint256 offsets;
    bytes interactions;     // pre/post interaction calldata
}

interface IFusionSettlement {
    // Called by a resolver to settle a batch of Fusion orders
    function settleOrders(bytes calldata data) external;
}

// ── 1inch Limit Order Protocol v3 ────────────────────────────────────────────

interface ILimitOrderProtocol {
    // Fill a limit order
    // order:       the Order struct
    // signature:   maker's EIP-712 signature
    // interaction: calldata to run before/after fill (UTL hook point)
    // makingAmount: amount to fill
    // takingAmount: amount to take
    // skipPermitAndThresholdAmount: packed flags
    function fillOrder(
        Order calldata order,
        bytes calldata signature,
        bytes calldata interaction,
        uint256 makingAmount,
        uint256 takingAmount,
        uint256 skipPermitAndThresholdAmount
    ) external payable returns (uint256, uint256, bytes32);
}

// Native BNB sentinel address used by 1inch
address constant NATIVE_TOKEN = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
