// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// ─────────────────────────────────────────────────────────────────────────────
// IUTLFeeCollector — On-chain interface for the UTL Protocol fee engine
// Deployed at: 0xfE537c43d202C455Cedc141B882c808287BB662f (BSC Mainnet)
// ─────────────────────────────────────────────────────────────────────────────

interface IUTLFeeCollector {

    // Emitted on every fee event routed through UTL
    event FeeCollected(
        address indexed source,         // hook / contract that sent the fee
        address indexed token,          // fee token (USDC, WBNB, etc.)
        uint256 amount,                 // gross fee collected
        uint256 stakersShare,           // 60% → stakers
        uint256 foundationShare,        // 25% → T.D.I.R. Foundation
        uint256 treasuryShare,          // 15% → UTL Treasury
        bytes32 feeType                 // e.g. keccak256("PANCAKE_SWAP_FEE")
    );

    // Called by UTLHook (and any other UTL-integrated contract) after collecting
    // the raw fee amount from a transaction.
    // @param token      ERC-20 token the fee is denominated in
    // @param amount     Gross fee amount (already transferred to this contract)
    // @param feeType    Category label — used for analytics and governance weight
    function receiveFee(
        address token,
        uint256 amount,
        bytes32 feeType
    ) external;

    // Returns total USDC staked across all stakers
    function totalStaked() external view returns (uint256);

    // Returns pending claimable rewards for a staker
    function pendingRewards(address staker) external view returns (uint256);

    // Returns cumulative fees collected by fee type (for dashboard display)
    function feesByType(bytes32 feeType) external view returns (uint256);
}
