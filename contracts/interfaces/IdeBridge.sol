// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// ─────────────────────────────────────────────────────────────────────────────
// deBridge — DLN (deBridge Liquidity Network) interfaces for UTLdeBridgeRouter
// Full spec: https://docs.debridge.finance/dln-the-debridge-liquidity-network
//
// BSC Mainnet addresses:
//   DLN Source (order creation):      0xeF4fB24aD0916217251F553c0596F8Edc630EB66
//   DLN Destination (order filling):  0xe7351Fd770A37282b91D153Ee690B63579D6dd7F
//   deBridge Gate:                    0x43dE2d77BF8027e25dBD179B491e8d64f38398aA
//
// Chain IDs used by deBridge (NOT LayerZero EIDs — these are EVM chainIds):
//   BSC:       56
//   Ethereum:  1
//   Polygon:   137
//   Arbitrum:  42161
//   Optimism:  10
//   Base:      8453
//   Avalanche: 43114
//   Solana:    7565164101604922416 (special deBridge non-EVM ID)
// ─────────────────────────────────────────────────────────────────────────────

library DlnOrderLib {

    // Parameters for creating a cross-chain order on the DLN Source contract
    struct OrderCreation {
        address giveTokenAddress;       // token to sell on source chain
        uint256 giveAmount;             // amount of giveToken to lock
        bytes   takeTokenAddress;       // token to receive on destination (bytes for non-EVM)
        uint256 takeAmount;             // minimum amount to receive
        uint256 takeChainId;            // destination chain ID
        bytes   receiverDst;            // recipient address on destination (bytes for non-EVM)
        address givePatchAuthoritySrc;  // who can patch (reduce) the give amount
        bytes   orderAuthorityAddressDst; // authority on destination for order management
        bytes   allowedTakerDst;        // address(0) = anyone can fill this order
        bytes   externalCall;           // optional: calldata to execute on destination
    }

    // Fully constructed order — returned after creation, used for filling
    struct Order {
        uint64  makerOrderNonce;
        bytes   makerSrc;
        uint256 giveChainId;
        bytes   giveTokenAddress;
        uint256 giveAmount;
        uint256 takeChainId;
        bytes   takeTokenAddress;
        uint256 takeAmount;
        bytes   receiverDst;
        bytes   givePatchAuthoritySrc;
        bytes   orderAuthorityAddressDst;
        bytes   allowedTakerDst;
        bytes   allowedCancelBeneficiarySrc;
        bytes   externalCall;
    }
}

// ── DLN Source — order creation on source chain ───────────────────────────────
interface IDlnSource {

    // Create a cross-chain swap order.
    // @param _orderCreation   Order parameters (tokens, amounts, destination)
    // @param _affiliateFee    ABI-encoded (address beneficiary, uint feeBps)
    //                         UTL passes its FeeCollector address here to earn
    //                         deBridge's native protocol fee share
    // @param _referralCode    UTL's deBridge referral code (registered off-chain)
    // @param _permitEnvelope  Optional EIP-2612 permit (skip with bytes(""))
    // Returns orderId — the unique keccak256 hash identifying this order
    function createOrder(
        DlnOrderLib.OrderCreation calldata _orderCreation,
        bytes calldata _affiliateFee,
        uint32 _referralCode,
        bytes calldata _permitEnvelope
    ) external payable returns (bytes32 orderId);

    // Cancel an unfilled order and reclaim locked funds
    function cancelOrder(
        DlnOrderLib.Order calldata _order,
        bytes calldata _cancelBeneficiarySrc
    ) external;

    // Returns the global nonce for a maker address
    function getOrderNonce(address maker) external view returns (uint64);
}

// ── DLN Destination — order filling on destination chain ─────────────────────
interface IDlnDestination {

    // Fill (execute) an order on the destination chain.
    // Called by makers (market makers) who have the destination tokens ready.
    // @param _order       The full Order struct (must match source chain order)
    // @param _orderId     keccak256 hash of the order
    // @param _fulfilledAmount  Amount being fulfilled (can be partial)
    // @param _permitEnvelope   Optional EIP-2612 permit
    function fulfillOrder(
        DlnOrderLib.Order calldata _order,
        bytes32 _orderId,
        uint256 _fulfilledAmount,
        bytes calldata _permitEnvelope
    ) external payable;

    // Check if an order has been fulfilled
    function isOrderFulfilled(bytes32 orderId) external view returns (bool);
}

// ── deBridge Gate — the core bridge for arbitrary message passing ─────────────
interface IDebridgeGate {

    // Send a message cross-chain via deBridge
    // @param _chainIdTo     Destination chain ID
    // @param _receiver      Receiver address on destination
    // @param _data          Message payload
    // @param _flags         Execution flags
    function send(
        uint256 _chainIdTo,
        bytes memory _receiver,
        bytes memory _data,
        uint256 _flags,
        bytes memory _referralCode
    ) external payable returns (bytes32 submissionId);

    // Quote the fee for a cross-chain send
    function globalFixedNativeFee() external view returns (uint256);

    // Returns the fee for a specific chain pair
    function getChainToConfig(uint256 chainId)
        external view returns (uint256 transferFee, bool isSupported);
}
