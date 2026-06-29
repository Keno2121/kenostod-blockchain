// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// ─────────────────────────────────────────────────────────────────────────────
//
//  UTL Venus Wrapper — Universal Transaction Layer × Venus Protocol
//
//  A router contract that wraps Venus Protocol's core lending operations.
//  Users interact with this contract instead of Venus directly.
//  UTL collects a micro-fee on each operation and routes it to the
//  UTL FeeCollector (60% stakers / 25% T.D.I.R. / 15% treasury).
//
//  WHY USERS USE THE WRAPPER:
//  ──────────────────────────
//  • UTL Loyalty Points — every wrapped Venus interaction accrues points
//    that advance the user's staker tier (Observer → Contributor → Architect)
//  • KENO Rewards — users who interact via UTL are eligible for periodic
//    KENO token distributions from the T.D.I.R. Foundation
//  • Unified history — all UTL-wrapped operations appear in one dashboard
//  • Same Venus transaction, just 0.05–0.15% extra fee routed to stakers
//
//  SUPPORTED OPERATIONS:
//  ─────────────────────
//  supply()         — deposit ERC-20 into Venus, get vTokens   (fee: 0.05%)
//  supplyBNB()      — deposit native BNB into vBNB             (fee: 0.05%)
//  withdraw()       — redeem vTokens for underlying            (fee: 0.05%)
//  borrow()         — take a Venus loan                        (fee: 0.09%)
//  repay()          — repay a Venus loan                       (fee: 0.09%)
//  liquidate()      — liquidate undercollateralized position   (fee: 0.15%)
//
//  Author: Kenostod Blockchain Academy LLC — T.D.I.R. Foundation
//  Network: BSC Mainnet (chainId 56)
//
// ─────────────────────────────────────────────────────────────────────────────

import "../interfaces/IVenus.sol";
import "../interfaces/IUTLFeeCollector.sol";

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
}

interface IWBNB {
    function deposit() external payable;
    function approve(address spender, uint256 amount) external returns (bool);
}

contract UTLVenusWrapper {

    // ── Venus Protocol addresses (BSC Mainnet) ────────────────────────────
    address public constant COMPTROLLER = 0xfD36E2c2a6789Db23113685031d7F16329158384;
    address public constant V_BNB       = 0xA07c5b74C9B40447a954e1466938b865b6BBea36;
    address public constant V_USDC      = 0xecA88125a5ADbe82614ffC12D0DB554E2e2867C8;
    address public constant V_BUSD      = 0x95c78222B3D6e262426483D42CfA53685A67Ab9D;
    address public constant V_USDT      = 0xfD5840Cd36d94D7229439859C0112a4185BC0255;
    address public constant V_ETH       = 0xf508fCD89b8bd15579dc79A6827cB4686A3592c8;
    // V_BTC (vBTCB) address TBD — verify on BscScan before enabling

    // ── UTL Protocol addresses (BSC Mainnet) ─────────────────────────────
    address public constant UTL_FEE_COLLECTOR =
        0xfE537c43d202C455Cedc141B882c808287BB662f;

    address public constant WBNB =
        0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c;

    // ── Fee schedule (basis points) ───────────────────────────────────────
    uint256 public constant SUPPLY_FEE_BPS      = 5;    // 0.05% — supply/withdraw
    uint256 public constant BORROW_FEE_BPS      = 9;    // 0.09% — borrow/repay
    uint256 public constant LIQUIDATION_FEE_BPS = 15;   // 0.15% — liquidations
    uint256 public constant BPS_DENOMINATOR     = 10_000;

    bytes32 public constant FEE_SUPPLY      = keccak256("VENUS_SUPPLY_FEE");
    bytes32 public constant FEE_WITHDRAW    = keccak256("VENUS_WITHDRAW_FEE");
    bytes32 public constant FEE_BORROW      = keccak256("VENUS_BORROW_FEE");
    bytes32 public constant FEE_REPAY       = keccak256("VENUS_REPAY_FEE");
    bytes32 public constant FEE_LIQUIDATION = keccak256("VENUS_LIQUIDATION_FEE");
    bytes32 public constant FEE_SUPPLY_BNB  = keccak256("VENUS_SUPPLY_BNB_FEE");

    // ── UTL Loyalty tracking ──────────────────────────────────────────────
    struct UserStats {
        uint256 totalVolumeUSD;      // approximate USD volume routed through UTL
        uint256 totalFeesContributed; // total fees user has generated for stakers
        uint256 operationCount;       // number of Venus operations via UTL
        uint256 loyaltyPoints;        // UTL loyalty points (tier advancement)
    }
    mapping(address => UserStats) public userStats;

    // Global stats
    uint256 public totalVolumeProcessed;
    uint256 public totalFeesCollected;
    uint256 public totalOperations;

    // ── Access control ────────────────────────────────────────────────────
    address public owner;

    // ── Events ────────────────────────────────────────────────────────────
    event UTLSupply(address indexed user, address indexed vToken, uint256 amount, uint256 fee);
    event UTLSupplyBNB(address indexed user, uint256 amount, uint256 fee);
    event UTLWithdraw(address indexed user, address indexed vToken, uint256 vTokenAmount, uint256 fee);
    event UTLBorrow(address indexed user, address indexed vToken, uint256 amount, uint256 fee);
    event UTLRepay(address indexed user, address indexed vToken, uint256 amount, uint256 fee);
    event UTLLiquidate(address indexed liquidator, address indexed borrower, address indexed vToken, uint256 repayAmount, uint256 fee);
    event LoyaltyPointsEarned(address indexed user, uint256 points, uint256 newTotal);
    event OwnershipTransferred(address indexed previous, address indexed next);

    // ── Errors ────────────────────────────────────────────────────────────
    error ZeroAmount();
    error ZeroAddress();
    error OnlyOwner();
    error VenusError(uint256 errorCode);
    error TransferFailed();
    error UnsupportedVToken();

    // ─────────────────────────────────────────────────────────────────────
    constructor() {
        owner = msg.sender;
    }

    receive() external payable {}

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    modifier nonZeroAmount(uint256 amount) {
        if (amount == 0) revert ZeroAmount();
        _;
    }

    // ─────────────────────────────────────────────────────────────────────
    // SUPPLY — Deposit ERC-20 into Venus, receive vTokens
    // ─────────────────────────────────────────────────────────────────────

    // @param vToken   The Venus market to supply to (e.g. V_USDC, V_USDT)
    // @param amount   Amount of underlying ERC-20 to deposit
    function supply(address vToken, uint256 amount)
        external
        nonZeroAmount(amount)
    {
        _requireSupportedVToken(vToken);
        address underlying = IVToken(vToken).underlying();

        // Pull full amount from user
        bool ok = IERC20(underlying).transferFrom(msg.sender, address(this), amount);
        if (!ok) revert TransferFailed();

        // Deduct UTL fee
        uint256 fee    = (amount * SUPPLY_FEE_BPS) / BPS_DENOMINATOR;
        uint256 netAmt = amount - fee;

        // Route fee to UTL FeeCollector
        _routeERC20Fee(underlying, fee, FEE_SUPPLY);

        // Forward net amount to Venus
        IERC20(underlying).approve(vToken, netAmt);
        uint256 err = IVToken(vToken).mint(netAmt);
        if (err != 0) revert VenusError(err);

        // Transfer vTokens received back to user
        uint256 vBal = IERC20(vToken).balanceOf(address(this));
        IERC20(vToken).transfer(msg.sender, vBal);

        // Track UTL loyalty
        _recordActivity(msg.sender, amount, fee, 1);
        emit UTLSupply(msg.sender, vToken, amount, fee);
    }

    // ─────────────────────────────────────────────────────────────────────
    // SUPPLY BNB — Deposit native BNB into vBNB
    // ─────────────────────────────────────────────────────────────────────

    function supplyBNB() external payable nonZeroAmount(msg.value) {
        uint256 amount = msg.value;
        uint256 fee    = (amount * SUPPLY_FEE_BPS) / BPS_DENOMINATOR;
        uint256 netAmt = amount - fee;

        // Wrap fee portion → WBNB for FeeCollector
        IWBNB(WBNB).deposit{value: fee}();
        IWBNB(WBNB).approve(UTL_FEE_COLLECTOR, fee);
        IUTLFeeCollector(UTL_FEE_COLLECTOR).receiveFee(WBNB, fee, FEE_SUPPLY_BNB);

        // Forward net BNB to vBNB mint
        IVToken(V_BNB).mint{value: netAmt}();

        // Transfer vBNB back to user
        uint256 vBal = IERC20(V_BNB).balanceOf(address(this));
        IERC20(V_BNB).transfer(msg.sender, vBal);

        _recordActivity(msg.sender, amount, fee, 1);
        emit UTLSupplyBNB(msg.sender, amount, fee);
    }

    // ─────────────────────────────────────────────────────────────────────
    // WITHDRAW — Redeem vTokens, receive underlying back
    // ─────────────────────────────────────────────────────────────────────

    // @param vToken        Venus market
    // @param vTokenAmount  Amount of vTokens to redeem
    function withdraw(address vToken, uint256 vTokenAmount)
        external
        nonZeroAmount(vTokenAmount)
    {
        _requireSupportedVToken(vToken);

        // Pull vTokens from user
        bool ok = IERC20(vToken).transferFrom(msg.sender, address(this), vTokenAmount);
        if (!ok) revert TransferFailed();

        // Redeem with Venus
        uint256 err = IVToken(vToken).redeem(vTokenAmount);
        if (err != 0) revert VenusError(err);

        // The underlying asset is now in this contract
        address underlying = IVToken(vToken).underlying();
        uint256 received   = IERC20(underlying).balanceOf(address(this));

        // Deduct UTL fee from received underlying
        uint256 fee    = (received * SUPPLY_FEE_BPS) / BPS_DENOMINATOR;
        uint256 netAmt = received - fee;

        // Route fee
        _routeERC20Fee(underlying, fee, FEE_WITHDRAW);

        // Return net amount to user
        IERC20(underlying).transfer(msg.sender, netAmt);

        _recordActivity(msg.sender, received, fee, 1);
        emit UTLWithdraw(msg.sender, vToken, vTokenAmount, fee);
    }

    // ─────────────────────────────────────────────────────────────────────
    // BORROW — Take a Venus loan
    // ─────────────────────────────────────────────────────────────────────

    // NOTE: User must have supplied collateral and called Comptroller.enterMarkets()
    // before borrowing. This wrapper does not handle collateral entry.
    //
    // @param vToken  Venus market to borrow from
    // @param amount  Amount of underlying to borrow
    function borrow(address vToken, uint256 amount)
        external
        nonZeroAmount(amount)
    {
        _requireSupportedVToken(vToken);
        address underlying = IVToken(vToken).underlying();

        // Execute borrow on Venus — underlying comes to this contract
        uint256 err = IVToken(vToken).borrow(amount);
        if (err != 0) revert VenusError(err);

        // Deduct UTL fee from borrowed amount
        uint256 fee    = (amount * BORROW_FEE_BPS) / BPS_DENOMINATOR;
        uint256 netAmt = amount - fee;

        // Route fee
        _routeERC20Fee(underlying, fee, FEE_BORROW);

        // Send net borrow to user
        IERC20(underlying).transfer(msg.sender, netAmt);

        _recordActivity(msg.sender, amount, fee, 2); // borrows worth more loyalty
        emit UTLBorrow(msg.sender, vToken, amount, fee);
    }

    // ─────────────────────────────────────────────────────────────────────
    // REPAY — Repay a Venus loan
    // ─────────────────────────────────────────────────────────────────────

    // @param vToken      Venus market
    // @param repayAmount Amount of underlying to repay (use type(uint256).max for full repay)
    function repay(address vToken, uint256 repayAmount)
        external
        nonZeroAmount(repayAmount)
    {
        _requireSupportedVToken(vToken);
        address underlying = IVToken(vToken).underlying();

        // Calculate fee on repay amount
        uint256 fee       = (repayAmount * BORROW_FEE_BPS) / BPS_DENOMINATOR;
        uint256 totalPull = repayAmount + fee;

        // Pull repay + fee from user
        bool ok = IERC20(underlying).transferFrom(msg.sender, address(this), totalPull);
        if (!ok) revert TransferFailed();

        // Route fee to UTL
        _routeERC20Fee(underlying, fee, FEE_REPAY);

        // Approve Venus and repay
        IERC20(underlying).approve(vToken, repayAmount);
        uint256 err = IVToken(vToken).repayBorrowBehalf(msg.sender, repayAmount);
        if (err != 0) revert VenusError(err);

        _recordActivity(msg.sender, repayAmount, fee, 2);
        emit UTLRepay(msg.sender, vToken, repayAmount, fee);
    }

    // ─────────────────────────────────────────────────────────────────────
    // LIQUIDATE — Liquidate an undercollateralized borrower
    // ─────────────────────────────────────────────────────────────────────

    // Liquidators use this to earn the Venus liquidation bonus (8–15%) MINUS
    // the UTL fee (0.15%). They still profit — UTL just takes a small cut
    // of the lucrative liquidation event.
    //
    // @param vToken           Market where the debt is (e.g. vUSDC)
    // @param borrower         Address being liquidated
    // @param repayAmount      Debt amount to repay
    // @param vTokenCollateral Collateral market to seize (e.g. vBNB)
    function liquidate(
        address vToken,
        address borrower,
        uint256 repayAmount,
        address vTokenCollateral
    ) external nonZeroAmount(repayAmount) {
        _requireSupportedVToken(vToken);
        address underlying = IVToken(vToken).underlying();

        uint256 fee       = (repayAmount * LIQUIDATION_FEE_BPS) / BPS_DENOMINATOR;
        uint256 totalPull = repayAmount + fee;

        // Pull from liquidator
        bool ok = IERC20(underlying).transferFrom(msg.sender, address(this), totalPull);
        if (!ok) revert TransferFailed();

        // Route fee
        _routeERC20Fee(underlying, fee, FEE_LIQUIDATION);

        // Execute Venus liquidation
        IERC20(underlying).approve(vToken, repayAmount);
        uint256 err = IVToken(vToken).liquidateBorrow(borrower, repayAmount, vTokenCollateral);
        if (err != 0) revert VenusError(err);

        // Transfer seized vTokenCollateral to the liquidator
        uint256 collateralBal = IERC20(vTokenCollateral).balanceOf(address(this));
        if (collateralBal > 0) IERC20(vTokenCollateral).transfer(msg.sender, collateralBal);

        _recordActivity(msg.sender, repayAmount, fee, 5); // liquidations earn 5x loyalty
        emit UTLLiquidate(msg.sender, borrower, vToken, repayAmount, fee);
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

    function _recordActivity(
        address user,
        uint256 volume,
        uint256 fee,
        uint256 pointMultiplier
    ) internal {
        UserStats storage s = userStats[user];
        s.totalVolumeUSD      += volume;
        s.totalFeesContributed += fee;
        s.operationCount       += 1;
        uint256 points          = (fee * pointMultiplier * 100);
        s.loyaltyPoints        += points;
        totalVolumeProcessed   += volume;
        totalOperations        += 1;
        emit LoyaltyPointsEarned(user, points, s.loyaltyPoints);
    }

    // Validate that the vToken is a supported Venus market
    function _requireSupportedVToken(address vToken) internal pure {
        if (
            vToken != 0xecA88125a5ADbe82614ffC12D0DB554E2e2867C8 && // vUSDC
            vToken != 0x95c78222B3D6e262426483D42CfA53685A67Ab9D && // vBUSD
            vToken != 0xfD5840Cd36d94D7229439859C0112a4185BC0255 && // vUSDT
            vToken != 0xf508fCD89b8bd15579dc79A6827cB4686A3592c8    // vETH
        ) revert UnsupportedVToken();
    }

    // ─────────────────────────────────────────────────────────────────────
    // View — user loyalty dashboard
    // ─────────────────────────────────────────────────────────────────────

    function getUserStats(address user) external view returns (
        uint256 totalVolumeUSD,
        uint256 totalFeesContributed,
        uint256 operationCount,
        uint256 loyaltyPoints,
        string memory tier
    ) {
        UserStats memory s = userStats[user];
        string memory t;
        if      (s.loyaltyPoints >= 1_000_000) t = "Architect";
        else if (s.loyaltyPoints >= 100_000)   t = "Builder";
        else if (s.loyaltyPoints >= 10_000)    t = "Contributor";
        else                                   t = "Observer";
        return (s.totalVolumeUSD, s.totalFeesContributed, s.operationCount, s.loyaltyPoints, t);
    }

    // ─────────────────────────────────────────────────────────────────────
    // Admin
    // ─────────────────────────────────────────────────────────────────────

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    // Emergency rescue for stuck tokens
    function rescueTokens(address token, uint256 amount) external onlyOwner {
        IERC20(token).transfer(owner, amount);
    }

    function rescueBNB(uint256 amount) external onlyOwner {
        (bool ok,) = payable(owner).call{value: amount}("");
        if (!ok) revert TransferFailed();
    }
}
