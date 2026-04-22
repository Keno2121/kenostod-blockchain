// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// ─────────────────────────────────────────────────────────────────────────────
// Venus Protocol v2 — Minimal interfaces required by UTLVenusWrapper
// Full docs: https://docs-v2.venus.io
//
// Venus is BSC's largest lending protocol (~$500M TVL).
// It follows the Compound v2 architecture — vTokens represent deposited assets.
//
// BSC Mainnet contract addresses:
//   Comptroller:   0xfD36E2c2a6789Db23113685031d7F16329158384
//   vBNB:          0xA07c5b74C9B40447a954e1466938b865b6BBea36
//   vUSDC:         0xecA88125a5ADbe82614ffC12D0DB554E2e2867C8
//   vBUSD:         0x95c78222B3D6e262426483D42CfA53685A67Ab9D
//   vUSDT:         0xfD5840Cd36d94D7229439859C0112a4185BC0255
//   vETH:          0xf508fCD89b8bd15579dc79A6827cB4686A3592c8
//   vBTC:          0x882C173bC7Ff3b7786CA16dfeD3DFFfb9Ee7847
// ─────────────────────────────────────────────────────────────────────────────

interface IVToken {

    // ── Supply side ──────────────────────────────────────────────────────────
    // Deposit ERC-20 underlying asset, receive vTokens
    // Returns 0 on success, error code otherwise
    function mint(uint256 mintAmount) external returns (uint256);

    // Deposit BNB (native), receive vBNB — value is sent as msg.value
    function mint() external payable;

    // Redeem vTokens, receive underlying asset back
    function redeem(uint256 redeemTokens) external returns (uint256);

    // Redeem a specific amount of underlying asset (not vTokens)
    function redeemUnderlying(uint256 redeemAmount) external returns (uint256);

    // ── Borrow side ──────────────────────────────────────────────────────────
    // Borrow underlying asset. Caller must have supplied collateral first.
    function borrow(uint256 borrowAmount) external returns (uint256);

    // Repay your own borrow
    function repayBorrow(uint256 repayAmount) external returns (uint256);

    // Repay borrow on behalf of another account
    function repayBorrowBehalf(address borrower, uint256 repayAmount) external returns (uint256);

    // ── Liquidation ───────────────────────────────────────────────────────────
    // Liquidate an undercollateralized borrower.
    // Repay up to close factor of their debt, seize their vToken collateral.
    function liquidateBorrow(
        address borrower,
        uint256 repayAmount,
        address vTokenCollateral     // which collateral vToken to seize
    ) external returns (uint256);

    // ── View functions ────────────────────────────────────────────────────────
    function balanceOf(address owner) external view returns (uint256);
    function balanceOfUnderlying(address owner) external returns (uint256);
    function borrowBalanceCurrent(address account) external returns (uint256);
    function exchangeRateCurrent() external returns (uint256);
    function underlying() external view returns (address);   // NOT available on vBNB
    function symbol() external view returns (string memory);
    function decimals() external view returns (uint8);
}

interface IComptroller {
    // Enter markets to use as collateral
    function enterMarkets(address[] calldata vTokens) external returns (uint256[] memory);

    // Exit a market (remove as collateral)
    function exitMarket(address vToken) external returns (uint256);

    // Returns (error, liquidity, shortfall) for an account
    function getAccountLiquidity(address account) external view returns (uint256, uint256, uint256);

    // Returns the list of markets an account has entered
    function getAssetsIn(address account) external view returns (address[] memory);

    // Returns whether a market is listed
    function markets(address vToken) external view returns (bool isListed, uint256 collateralFactorMantissa);

    // Close factor — max fraction of borrow that can be liquidated in one tx
    function closeFactorMantissa() external view returns (uint256);

    // Liquidation incentive — bonus collateral a liquidator receives
    function liquidationIncentiveMantissa() external view returns (uint256);
}
