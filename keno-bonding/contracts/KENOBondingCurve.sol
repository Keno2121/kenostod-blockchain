// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title KENOBondingCurve
 * @author Kenostod Blockchain Academy LLC
 * @notice Linear bonding curve for continuous KENO token distribution on BSC.
 *
 * Price Formula (Constitutional Law 3 — Golden Ratio scaling):
 *   price(sold) = BASE_PRICE + SLOPE * sold / 1e18
 *   where `sold` is total KENO distributed in wei (18 decimals)
 *
 * Buy cost for `amount` tokens when `sold` already distributed:
 *   cost = BASE_PRICE * amount / 1e18
 *        + SLOPE * (2 * sold * amount + amount²) / (2 * 1e36)
 *
 * Sell proceeds (inverse integral):
 *   proceeds = BASE_PRICE * amount / 1e18
 *            + SLOPE * amount * (2 * sold - amount) / (2 * 1e36)
 *
 * Fees:
 *   - Buy:  3% → 50% to UTL fee accumulator, 50% to treasury
 *   - Sell: 5% → 50% to UTL fee accumulator, 50% to treasury
 *
 * The contract holds a KENO allocation deposited by the owner.
 * BNB reserves back every token sold through the curve.
 */
contract KENOBondingCurve is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // -------------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------------

    /// @notice Starting price: 0.000001 BNB per KENO (~$0.0006 at $600/BNB)
    uint256 public constant BASE_PRICE = 1e12;

    /// @notice Slope: price rises 20000 wei BNB per full KENO of additional supply
    ///         At 50M KENO sold → price doubles. Derived from φ (Golden Ratio ≈ 1.618)
    ///         scaled to fit the target curve: SLOPE = floor(BASE_PRICE / (φ * 30_000_000))
    uint256 public constant SLOPE = 20_000;

    uint256 public constant BUY_FEE_BPS  = 300;   // 3.0%
    uint256 public constant SELL_FEE_BPS = 500;   // 5.0%
    uint256 public constant UTL_FEE_SHARE = 50;   // 50% of fee → UTL accumulator
    uint256 public constant BPS_BASE = 10_000;
    uint256 internal constant PREC = 1e18;

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    IERC20  public immutable kenoToken;

    /// @notice Receives 50% of all fees — accumulated in BNB for UTL Protocol
    address public utlFeeAccumulator;

    /// @notice Receives 50% of all fees — project treasury
    address public treasury;

    /// @notice Total KENO sold through this curve (wei, 18 dec)
    uint256 public tokensSold;

    /// @notice BNB locked as reserve backing sold tokens
    uint256 public bnbReserves;

    /// @notice Total KENO deposited into this contract for sale
    uint256 public allocation;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event TokensPurchased(
        address indexed buyer,
        uint256 bnbIn,
        uint256 kenoOut,
        uint256 newPrice,
        uint256 fee
    );
    event TokensSold(
        address indexed seller,
        uint256 kenoIn,
        uint256 bnbOut,
        uint256 newPrice,
        uint256 fee
    );
    event AllocationAdded(uint256 amount, uint256 totalAllocation);
    event UtlFeeAccumulatorUpdated(address newAccumulator);
    event TreasuryUpdated(address newTreasury);
    event ExcessBnbWithdrawn(uint256 amount);
    event ExcessKenoWithdrawn(uint256 amount);

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor(
        address _kenoToken,
        address _utlFeeAccumulator,
        address _treasury,
        address _owner
    ) Ownable(_owner) {
        require(_kenoToken          != address(0), "Zero: kenoToken");
        require(_utlFeeAccumulator  != address(0), "Zero: utlFeeAccumulator");
        require(_treasury           != address(0), "Zero: treasury");
        kenoToken          = IERC20(_kenoToken);
        utlFeeAccumulator  = _utlFeeAccumulator;
        treasury           = _treasury;
    }

    // -------------------------------------------------------------------------
    // Core: Buy
    // -------------------------------------------------------------------------

    /**
     * @notice Buy KENO with BNB.
     * @param minKenoOut Minimum KENO to receive (slippage guard).
     */
    function buy(uint256 minKenoOut) external payable nonReentrant whenNotPaused {
        require(msg.value > 0, "Send BNB to buy KENO");

        uint256 fee        = (msg.value * BUY_FEE_BPS) / BPS_BASE;
        uint256 bnbForCurve = msg.value - fee;

        uint256 available = allocation - tokensSold;
        require(available > 0, "No KENO available");

        uint256 kenoOut = _bnbToTokens(bnbForCurve, tokensSold, available);
        require(kenoOut > 0,          "Too little BNB");
        require(kenoOut >= minKenoOut, "Slippage: insufficient KENO out");

        tokensSold  += kenoOut;
        bnbReserves += bnbForCurve;

        _distributeFee(fee);
        kenoToken.safeTransfer(msg.sender, kenoOut);

        emit TokensPurchased(msg.sender, msg.value, kenoOut, _priceAt(tokensSold), fee);
    }

    // -------------------------------------------------------------------------
    // Core: Sell
    // -------------------------------------------------------------------------

    /**
     * @notice Sell KENO back to the curve for BNB.
     * @param kenoAmount Amount of KENO to sell (18 dec).
     * @param minBnbOut  Minimum BNB to receive (slippage guard).
     */
    function sell(uint256 kenoAmount, uint256 minBnbOut)
        external
        nonReentrant
        whenNotPaused
    {
        require(kenoAmount > 0,             "Amount must be > 0");
        require(kenoAmount <= tokensSold,   "Exceeds curve supply");

        uint256 grossBnb = _tokensToBnbSell(kenoAmount, tokensSold);
        uint256 fee      = (grossBnb * SELL_FEE_BPS) / BPS_BASE;
        uint256 bnbOut   = grossBnb - fee;

        require(bnbOut >= minBnbOut,             "Slippage: insufficient BNB out");
        require(address(this).balance >= grossBnb, "Insufficient BNB reserves");

        tokensSold  -= kenoAmount;
        bnbReserves -= grossBnb;

        kenoToken.safeTransferFrom(msg.sender, address(this), kenoAmount);
        _distributeFee(fee);

        (bool sent,) = payable(msg.sender).call{value: bnbOut}("");
        require(sent, "BNB transfer failed");

        emit TokensSold(msg.sender, kenoAmount, bnbOut, _priceAt(tokensSold), fee);
    }

    // -------------------------------------------------------------------------
    // View: Quotes
    // -------------------------------------------------------------------------

    /// @notice Current spot price in wei BNB per full KENO token.
    function currentPrice() external view returns (uint256) {
        return _priceAt(tokensSold);
    }

    /// @notice Quote KENO out and fee for a given BNB input.
    function getBuyQuote(uint256 bnbIn)
        external
        view
        returns (uint256 kenoOut, uint256 fee)
    {
        fee     = (bnbIn * BUY_FEE_BPS) / BPS_BASE;
        uint256 bnbForCurve = bnbIn - fee;
        uint256 available = allocation > tokensSold ? allocation - tokensSold : 0;
        kenoOut = _bnbToTokens(bnbForCurve, tokensSold, available);
    }

    /// @notice Quote BNB out and fee for a given KENO sell amount.
    function getSellQuote(uint256 kenoAmount)
        external
        view
        returns (uint256 bnbOut, uint256 fee)
    {
        if (kenoAmount > tokensSold) return (0, 0);
        uint256 gross = _tokensToBnbSell(kenoAmount, tokensSold);
        fee    = (gross * SELL_FEE_BPS) / BPS_BASE;
        bnbOut = gross - fee;
    }

    /// @notice How many KENO remain available to buy.
    function availableKeno() external view returns (uint256) {
        return allocation > tokensSold ? allocation - tokensSold : 0;
    }

    // -------------------------------------------------------------------------
    // Internal Math
    // -------------------------------------------------------------------------

    /// @dev price(sold) = BASE_PRICE + SLOPE * sold / 1e18
    function _priceAt(uint256 sold) internal pure returns (uint256) {
        return BASE_PRICE + (SLOPE * sold) / PREC;
    }

    /**
     * @dev BNB cost to buy `amount` tokens when `sold` already distributed.
     *      Integral of price from sold to sold+amount:
     *      = BASE_PRICE * amount / 1e18
     *      + SLOPE * (2*sold*amount + amount²) / (2 * 1e36)
     */
    function _tokensToBnbBuy(uint256 amount, uint256 sold)
        internal
        pure
        returns (uint256)
    {
        uint256 linear    = (BASE_PRICE * amount) / PREC;
        uint256 quadratic = (SLOPE * ((2 * sold * amount) / PREC + (amount * amount) / PREC))
                            / (2 * PREC);
        return linear + quadratic;
    }

    /**
     * @dev BNB proceeds from selling `amount` tokens when `sold` is current supply.
     *      Integral of price from sold-amount to sold:
     *      = BASE_PRICE * amount / 1e18
     *      + SLOPE * amount * (2*sold - amount) / (2 * 1e36)
     */
    function _tokensToBnbSell(uint256 amount, uint256 sold)
        internal
        pure
        returns (uint256)
    {
        uint256 linear    = (BASE_PRICE * amount) / PREC;
        uint256 quadratic = (SLOPE * amount * (2 * sold - amount)) / (2 * PREC * PREC);
        return linear + quadratic;
    }

    /**
     * @dev Binary search: given `bnb`, find max tokens purchasable.
     *      Upper bound capped at `available` to never exceed allocation.
     */
    function _bnbToTokens(
        uint256 bnb,
        uint256 sold,
        uint256 available
    ) internal pure returns (uint256) {
        if (available == 0 || bnb == 0) return 0;

        uint256 lo = 0;
        // rough upper bound: at base price, max tokens
        uint256 hi = (bnb * PREC) / BASE_PRICE;
        if (hi > available) hi = available;

        for (uint256 i = 0; i < 128; i++) {
            uint256 mid  = (lo + hi) / 2;
            if (mid == 0) break;
            uint256 cost = _tokensToBnbBuy(mid, sold);
            if (cost <= bnb) {
                lo = mid;
            } else {
                hi = mid;
            }
            if (hi <= lo + 1e9) break; // ~1 micro-KENO precision
        }
        return lo;
    }

    // -------------------------------------------------------------------------
    // Internal: Fee Distribution
    // -------------------------------------------------------------------------

    function _distributeFee(uint256 fee) internal {
        if (fee == 0) return;
        uint256 utlShare      = (fee * UTL_FEE_SHARE) / 100;
        uint256 treasuryShare = fee - utlShare;

        if (utlShare > 0 && utlFeeAccumulator != address(0)) {
            (bool s1,) = payable(utlFeeAccumulator).call{value: utlShare}("");
            if (!s1) treasuryShare += utlShare;
        }
        if (treasuryShare > 0) {
            (bool s2,) = payable(treasury).call{value: treasuryShare}("");
            require(s2, "Treasury transfer failed");
        }
    }

    // -------------------------------------------------------------------------
    // Owner: Administration
    // -------------------------------------------------------------------------

    /**
     * @notice Deposit KENO into the bonding curve for sale.
     *         Owner must approve this contract to transfer `amount` KENO first.
     */
    function addAllocation(uint256 amount) external onlyOwner {
        require(amount > 0, "Zero amount");
        allocation += amount;
        kenoToken.safeTransferFrom(msg.sender, address(this), amount);
        emit AllocationAdded(amount, allocation);
    }

    function setUtlFeeAccumulator(address _acc) external onlyOwner {
        require(_acc != address(0), "Zero address");
        utlFeeAccumulator = _acc;
        emit UtlFeeAccumulatorUpdated(_acc);
    }

    function setTreasury(address _t) external onlyOwner {
        require(_t != address(0), "Zero address");
        treasury = _t;
        emit TreasuryUpdated(_t);
    }

    function pause()   external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    /**
     * @notice Withdraw BNB in excess of reserves (e.g. direct donations).
     *         Never touches the BNB backing sold tokens.
     */
    function withdrawExcessBnb() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > bnbReserves, "No excess BNB");
        uint256 excess = balance - bnbReserves;
        (bool sent,) = payable(owner()).call{value: excess}("");
        require(sent, "Transfer failed");
        emit ExcessBnbWithdrawn(excess);
    }

    /**
     * @notice Withdraw KENO not yet sold (unsold allocation).
     */
    function withdrawExcessKeno() external onlyOwner {
        uint256 unsold = allocation - tokensSold;
        require(unsold > 0, "No unsold KENO");
        allocation -= unsold;
        kenoToken.safeTransfer(owner(), unsold);
        emit ExcessKenoWithdrawn(unsold);
    }

    receive() external payable {}
}
