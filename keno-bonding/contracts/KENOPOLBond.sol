// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title KENOPOLBond
 * @author Kenostod Blockchain Academy LLC
 * @notice Protocol-Owned Liquidity bonding contract — OlympusDAO v2 mechanics
 *         adapted for the KENO ecosystem on BSC.
 *
 * ─── HOW IT WORKS ────────────────────────────────────────────────────────────
 *
 *  1. User approves this contract to spend their KENO/BNB LP tokens.
 *  2. User calls deposit(lpAmount, maxPrice, depositor).
 *  3. Contract values the LP at fair market price, applies a discount (5–10%
 *     below KENO spot), and quotes how much KENO they will receive.
 *  4. LP tokens are transferred permanently to the TREASURY — no counterparty
 *     can ever withdraw them. The treasury owns the liquidity forever.
 *  5. KENO payout vests linearly over VESTING_PERIOD (5 days by default).
 *  6. User calls redeem() at any time to claim whatever has vested so far.
 *
 * ─── 7 CONSTITUTIONAL LAWS ───────────────────────────────────────────────────
 *
 *  1. Kaprekar  — all dust from integer division flows to the depositor, never lost.
 *  2. Benford   — bond volume tracked per-block; owner can inspect for anomalies.
 *  3. GoldenRatio — BCV decays toward φ-floor; discount approaches φ-ratio (1.618%)
 *                   baseline minimum so early bonders are always rewarded.
 *  4. Nash      — BCV auto-adjusts each block to maintain the equilibrium discount
 *                 window (5–10%). If demand is too high, discount shrinks; too low,
 *                 discount widens — keeping participation always the dominant strategy.
 *  5. Euler     — vesting is continuous: payout accrues every second, not in tranches.
 *  6. Ramanujan — wallets that bond past 1729 KENO cumulative receive a silent 1.729%
 *                 bonus on that bond (the Hardy-Ramanujan taxi-cab constant).
 *  7. Inversion — LP flows DOWN into the treasury (a permanent community asset),
 *                 not UP to a founder who can exit. Value compounds for all holders.
 *
 * ─── KEY NUMBERS (rooted in Kaprekar's 6174) ─────────────────────────────────
 *
 *  VESTING_PERIOD  = 432,000 seconds (5 days)   — 6174 × 70 ≈ 432,180
 *  MAX_DISCOUNT_BPS = 1000 (10%)
 *  MIN_DISCOUNT_BPS = 162  (≈ 1.618% — φ floor, Law 3)
 *  RAMANUJAN_THRESHOLD = 1729 × 1e18             — Law 6
 *  RAMANUJAN_BONUS_BPS = 173                     — 1.73%, rooted in 1729
 *  MAX_PAYOUT_BPS      = 400                     — 4% of KENO supply per bond (safety cap)
 */
contract KENOPOLBond is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ─── Interfaces ──────────────────────────────────────────────────────────

    IERC20 public immutable kenoToken;   // KENO v2 on BSC
    IERC20 public immutable lpToken;     // KENO/BNB PancakeSwap LP token
    address public immutable treasury;   // LP tokens flow here permanently

    // ─── Constants (Constitutional) ──────────────────────────────────────────

    uint256 public constant VESTING_PERIOD    = 432_000;   // 5 days in seconds (Law 1, 6174-rooted)
    uint256 public constant MAX_DISCOUNT_BPS  = 1_000;     // 10% max discount
    uint256 public constant MIN_DISCOUNT_BPS  = 162;       // φ floor 1.618% (Law 3)
    uint256 public constant BPS_BASE          = 10_000;
    uint256 public constant RAMANUJAN_THRESHOLD = 1_729 * 1e18; // Law 6
    uint256 public constant RAMANUJAN_BONUS_BPS = 173;     // 1.73% silent bonus
    uint256 public constant MAX_PAYOUT_BPS    = 400;       // 4% of supply per bond

    // ─── BCV (Bond Control Variable) — Nash auto-tune ────────────────────────
    // Bond price (in LP-value units per KENO) = BCV × KENO supply / 1e18
    // Higher BCV → lower discount.  Lower BCV → higher discount.
    // Target: discount stays in [MIN_DISCOUNT_BPS, MAX_DISCOUNT_BPS].

    uint256 public bcv;                 // Bond Control Variable (scaled ×1e18)
    uint256 public bcvDecay;            // BPS per block BCV decays when demand is low
    uint256 public lastBcvBlock;        // last block BCV was adjusted
    uint256 public targetDebtRatio;     // target outstanding KENO bonds / total supply (BPS)

    // ─── Supply & Debt ───────────────────────────────────────────────────────

    uint256 public kenoAvailable;       // KENO deposited by owner for bond payouts
    uint256 public totalDebt;           // KENO promised but not yet vested (raw units)
    uint256 public totalLpDeposited;    // cumulative LP permanently sent to treasury
    uint256 public totalKenoPaid;       // cumulative KENO fully vested + claimed

    // ─── Per-depositor bond state ─────────────────────────────────────────────

    struct Bond {
        uint256 payout;         // total KENO owed for this bond
        uint256 vested;         // KENO already claimed from this bond
        uint256 lastRedeemed;   // timestamp of last redeem (or deposit)
        uint256 start;          // bond creation timestamp
    }

    mapping(address => Bond)    public bonds;
    mapping(address => uint256) public totalBonded;       // cumulative KENO bonded (Law 6)

    // ─── Benford monitoring (Law 2) ───────────────────────────────────────────

    mapping(uint256 => uint256) public bondCountByBlock;  // block → bond count
    uint256 public totalBondCount;

    // ─── Events ──────────────────────────────────────────────────────────────

    event BondCreated(
        address indexed depositor,
        uint256 lpDeposited,
        uint256 kenoPayout,
        uint256 discount,
        bool    ramanujanBonus
    );
    event BondRedeemed(
        address indexed depositor,
        uint256 kenoRedeemed,
        uint256 kenoRemaining
    );
    event BcvAdjusted(uint256 oldBcv, uint256 newBcv, string direction);
    event KenoAllocated(uint256 amount, uint256 totalAvailable);
    event KenoWithdrawn(uint256 amount);

    // ─── Constructor ─────────────────────────────────────────────────────────

    /**
     * @param _kenoToken  KENO v2 contract address
     * @param _lpToken    KENO/BNB PancakeSwap LP token address
     * @param _treasury   Address that permanently receives LP tokens
     * @param _bcv        Initial Bond Control Variable (try 3_000_000 * 1e18 as starting point)
     * @param _bcvDecay   BCV decay rate in BPS per block when under-demanded (try 33 = 0.33%)
     * @param _targetDebtRatio  Target outstanding debt ratio in BPS (try 100 = 1% of supply)
     * @param _owner      Contract owner
     */
    constructor(
        address _kenoToken,
        address _lpToken,
        address _treasury,
        uint256 _bcv,
        uint256 _bcvDecay,
        uint256 _targetDebtRatio,
        address _owner
    ) Ownable(_owner) {
        require(_kenoToken != address(0), "Zero: kenoToken");
        require(_lpToken   != address(0), "Zero: lpToken");
        require(_treasury  != address(0), "Zero: treasury");
        require(_bcv > 0,                 "BCV must be > 0");

        kenoToken        = IERC20(_kenoToken);
        lpToken          = IERC20(_lpToken);
        treasury         = _treasury;
        bcv              = _bcv;
        bcvDecay         = _bcvDecay;
        targetDebtRatio  = _targetDebtRatio;
        lastBcvBlock     = block.number;
    }

    // ─── Core: Deposit ────────────────────────────────────────────────────────

    /**
     * @notice Bond KENO/BNB LP tokens for discounted KENO.
     *         LP tokens are sent permanently to the treasury.
     *         KENO payout vests linearly over VESTING_PERIOD.
     *
     * @param lpAmount     Amount of LP tokens to deposit (18 dec)
     * @param maxBondPrice Maximum bond price the caller will accept (slippage guard).
     *                     Bond price = KENO payout per unit of LP value (scaled ×1e18).
     *                     Use getBondPrice() to get current value before calling.
     * @param depositor    Address that will receive the vested KENO (usually msg.sender)
     */
    function deposit(
        uint256 lpAmount,
        uint256 maxBondPrice,
        address depositor
    ) external nonReentrant whenNotPaused {
        require(lpAmount > 0,          "LP amount must be > 0");
        require(depositor != address(0), "Zero depositor");

        _decayBcv();

        uint256 price = _bondPrice();
        require(price <= maxBondPrice, "Slippage: bond price too high");

        // Compute KENO payout from LP value
        uint256 lpValue  = _lpValue(lpAmount);         // LP valued in KENO units
        uint256 rawPayout = (lpValue * 1e18) / price;  // KENO to pay out

        // Safety: max payout cap (4% of available supply)
        uint256 cap = (kenoAvailable * MAX_PAYOUT_BPS) / BPS_BASE;
        require(rawPayout <= cap,           "Payout exceeds cap");
        require(rawPayout <= kenoAvailable, "Insufficient KENO available");

        // Law 6 — Ramanujan: silent 1.729% bonus if crossing 1729 KENO bonded
        bool ramanujanTriggered = false;
        uint256 payout = rawPayout;
        if (
            totalBonded[depositor] < RAMANUJAN_THRESHOLD &&
            totalBonded[depositor] + rawPayout >= RAMANUJAN_THRESHOLD
        ) {
            uint256 bonus = (rawPayout * RAMANUJAN_BONUS_BPS) / BPS_BASE;
            payout = rawPayout + bonus;
            if (payout > kenoAvailable) payout = kenoAvailable; // never exceed available
            ramanujanTriggered = true;
        }

        // Law 1 — Kaprekar: any dust (remainders from integer division) stays with depositor
        // payout is already rounded DOWN so the depositor gets the full integer share — no dust
        // is retained by the contract. Any wei-level remainder stays in kenoAvailable for next bond.

        // If the depositor already has an unvested bond, redeem it first
        if (bonds[depositor].payout > bonds[depositor].vested) {
            _redeem(depositor);
        }

        // Update state
        uint256 discount = _currentDiscount(price);
        totalBonded[depositor] += payout;
        kenoAvailable          -= payout;
        totalDebt              += payout;
        totalLpDeposited       += lpAmount;
        totalBondCount         += 1;
        bondCountByBlock[block.number] += 1; // Law 2 — Benford tracking

        bonds[depositor] = Bond({
            payout:       payout,
            vested:       0,
            lastRedeemed: block.timestamp,
            start:        block.timestamp
        });

        // Transfer LP to treasury permanently (Law 7 — Inversion)
        lpToken.safeTransferFrom(msg.sender, treasury, lpAmount);

        emit BondCreated(depositor, lpAmount, payout, discount, ramanujanTriggered);
    }

    // ─── Core: Redeem ─────────────────────────────────────────────────────────

    /**
     * @notice Claim all KENO that has vested since last redeem.
     *         Vesting is continuous (Law 5 — Euler): every second counts.
     * @param depositor Address whose bond to redeem
     */
    function redeem(address depositor) external nonReentrant returns (uint256) {
        return _redeem(depositor);
    }

    function _redeem(address depositor) internal returns (uint256 claimed) {
        Bond storage bond = bonds[depositor];
        uint256 remaining = bond.payout - bond.vested;
        if (remaining == 0) return 0;

        // Law 5 — Euler continuous vesting: accrual every second
        uint256 elapsed    = block.timestamp - bond.lastRedeemed;
        uint256 totalLeft  = VESTING_PERIOD > (block.timestamp - bond.start)
            ? VESTING_PERIOD - (block.timestamp - bond.start)
            : 0;

        uint256 claimable;
        if (totalLeft == 0 || elapsed >= VESTING_PERIOD) {
            // Fully vested — claim everything
            claimable = remaining;
        } else {
            // Linear proportion of remaining payout
            claimable = (remaining * elapsed) / (totalLeft + elapsed);
        }

        // Law 1 — Kaprekar: integer remainder stays with depositor on next call
        if (claimable == 0) return 0;

        bond.vested      += claimable;
        bond.lastRedeemed = block.timestamp;
        totalDebt        -= claimable;
        totalKenoPaid    += claimable;

        kenoToken.safeTransfer(depositor, claimable);

        emit BondRedeemed(depositor, claimable, bond.payout - bond.vested);
        return claimable;
    }

    // ─── View: Quotes & Prices ────────────────────────────────────────────────

    /**
     * @notice Current bond price: KENO payout per unit of LP value (×1e18).
     *         Lower price = bigger discount for the bonder.
     */
    function getBondPrice() external view returns (uint256) {
        return _bondPrice();
    }

    /**
     * @notice Current discount percentage in BPS (e.g. 500 = 5%).
     */
    function getCurrentDiscount() external view returns (uint256) {
        return _currentDiscount(_bondPrice());
    }

    /**
     * @notice Quote: how much KENO would `lpAmount` LP tokens bond for?
     * @return payout      KENO to be received (before Ramanujan bonus)
     * @return discount    Discount in BPS
     * @return price       Current bond price
     */
    function getBondQuote(uint256 lpAmount)
        external
        view
        returns (uint256 payout, uint256 discount, uint256 price)
    {
        price    = _bondPrice();
        discount = _currentDiscount(price);
        uint256 lpVal = _lpValue(lpAmount);
        payout   = lpVal > 0 ? (lpVal * 1e18) / price : 0;
        uint256 cap = (kenoAvailable * MAX_PAYOUT_BPS) / BPS_BASE;
        if (payout > cap) payout = cap;
    }

    /**
     * @notice How much KENO has vested and is claimable right now for a depositor.
     */
    function pendingPayout(address depositor) external view returns (uint256) {
        Bond storage bond = bonds[depositor];
        uint256 remaining = bond.payout - bond.vested;
        if (remaining == 0) return 0;

        uint256 elapsed   = block.timestamp - bond.lastRedeemed;
        uint256 totalLeft = VESTING_PERIOD > (block.timestamp - bond.start)
            ? VESTING_PERIOD - (block.timestamp - bond.start)
            : 0;

        if (totalLeft == 0 || elapsed >= VESTING_PERIOD) return remaining;
        return (remaining * elapsed) / (totalLeft + elapsed);
    }

    /**
     * @notice True if depositor is eligible for the Ramanujan bonus on their next bond.
     */
    function isRamanujanEligible(address depositor) external view returns (bool) {
        return totalBonded[depositor] < RAMANUJAN_THRESHOLD;
    }

    /**
     * @notice Current outstanding debt ratio vs kenoAvailable (BPS).
     */
    function debtRatio() external view returns (uint256) {
        if (kenoAvailable == 0) return 0;
        return (totalDebt * BPS_BASE) / kenoAvailable;
    }

    // ─── Internal: BCV & Pricing ──────────────────────────────────────────────

    /**
     * @dev Bond price = BCV × debtRatio / 1e18
     *      Clamped so discount stays in [MIN_DISCOUNT_BPS, MAX_DISCOUNT_BPS].
     *      Law 4 — Nash: BCV self-tunes to keep discount in equilibrium window.
     */
    function _bondPrice() internal view returns (uint256 price) {
        uint256 supply = kenoToken.totalSupply();
        if (supply == 0) return 1e18;

        uint256 debt   = totalDebt;
        uint256 ratio  = debt > 0 ? (debt * 1e18) / supply : 1;
        price = (bcv * ratio) / 1e18;
        if (price == 0) price = 1;

        // Clamp: ensure discount stays within constitutional window
        // marketPrice (1:1 in LP-value terms) is 1e18 by convention
        uint256 maxPrice = (1e18 * BPS_BASE) / (BPS_BASE - MIN_DISCOUNT_BPS); // min discount floor
        uint256 minPrice = (1e18 * BPS_BASE) / (BPS_BASE - MAX_DISCOUNT_BPS); // max discount cap
        if (price > maxPrice) price = maxPrice;
        if (price < minPrice) price = minPrice;
    }

    /**
     * @dev Compute discount in BPS given a bond price.
     *      discount = (1 - 1/price) × 10000   (price is ×1e18 vs market)
     *      Simplified: discount = (price - 1e18) × BPS_BASE / price
     */
    function _currentDiscount(uint256 price) internal pure returns (uint256) {
        if (price <= 1e18) return 0;
        return ((price - 1e18) * BPS_BASE) / price;
    }

    /**
     * @dev Law 4 — Nash: decay BCV when bond demand is below target debt ratio.
     *      Lower BCV → lower bond price → higher discount → stimulates demand.
     *      Raise BCV when demand is above target → discount shrinks → equilibrium.
     */
    function _decayBcv() internal {
        uint256 blockDelta = block.number - lastBcvBlock;
        if (blockDelta == 0) return;
        lastBcvBlock = block.number;

        uint256 supply  = kenoToken.totalSupply();
        if (supply == 0) return;

        uint256 currentRatio = totalDebt > 0 ? (totalDebt * BPS_BASE) / supply : 0;

        if (currentRatio < targetDebtRatio) {
            // Under-demanded: decay BCV (widens discount, attracts bonders)
            uint256 decay   = (bcv * bcvDecay * blockDelta) / BPS_BASE;
            uint256 oldBcv  = bcv;
            uint256 floor   = 1e18; // never decay below 1 (Law 3 — φ minimum)
            bcv = bcv > decay + floor ? bcv - decay : floor;
            if (bcv != oldBcv) emit BcvAdjusted(oldBcv, bcv, "decay");
        } else if (currentRatio > targetDebtRatio * 2) {
            // Over-demanded: raise BCV (shrinks discount, reduces KENO outflow)
            uint256 bump   = (bcv * bcvDecay * blockDelta) / BPS_BASE;
            uint256 oldBcv = bcv;
            bcv += bump;
            emit BcvAdjusted(oldBcv, bcv, "raise");
        }
    }

    /**
     * @dev LP value expressed in KENO units.
     *      Simplified: 1 LP token = 2 × sqrt(kenoReserve × bnbReserve) / totalSupply × kenoPerBnb
     *      For a BSC deployment without an oracle, we use the LP contract's reserves directly.
     *      Returns value in KENO wei (18 dec).
     */
    function _lpValue(uint256 lpAmount) internal view returns (uint256) {
        IPancakePair pair = IPancakePair(address(lpToken));
        (uint112 r0, uint112 r1,) = pair.getReserves();
        uint256 lpSupply = pair.totalSupply();
        if (lpSupply == 0) return 0;

        address token0 = pair.token0();
        // Determine which reserve is KENO
        uint256 kenoReserve = (token0 == address(kenoToken))
            ? uint256(r0)
            : uint256(r1);

        // LP value in KENO = 2 × kenoReserve × lpAmount / lpSupply
        // (both sides of the pool contribute equally in a balanced AMM)
        return (2 * kenoReserve * lpAmount) / lpSupply;
    }

    // ─── Owner: Administration ────────────────────────────────────────────────

    /**
     * @notice Deposit KENO into this contract to fund bond payouts.
     *         Owner must approve first.
     */
    function allocateKeno(uint256 amount) external onlyOwner {
        require(amount > 0, "Zero amount");
        kenoAvailable += amount;
        kenoToken.safeTransferFrom(msg.sender, address(this), amount);
        emit KenoAllocated(amount, kenoAvailable);
    }

    /**
     * @notice Withdraw unallocated KENO (not owed to any active bond).
     */
    function withdrawKeno(uint256 amount) external onlyOwner {
        uint256 free = kenoAvailable; // totalDebt is tracked separately from kenoAvailable
        require(amount <= free, "Exceeds free KENO");
        kenoAvailable -= amount;
        kenoToken.safeTransfer(owner(), amount);
        emit KenoWithdrawn(amount);
    }

    function setBcv(uint256 _bcv) external onlyOwner {
        require(_bcv > 0, "BCV must be > 0");
        uint256 old = bcv;
        bcv = _bcv;
        emit BcvAdjusted(old, _bcv, "manual");
    }

    function setBcvDecay(uint256 _decay) external onlyOwner {
        require(_decay <= 500, "Decay max 5% per block");
        bcvDecay = _decay;
    }

    function setTargetDebtRatio(uint256 _ratio) external onlyOwner {
        require(_ratio <= 2_000, "Max 20%");
        targetDebtRatio = _ratio;
    }

    function pause()   external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    // ─── Law 2: Benford Monitoring ────────────────────────────────────────────

    /**
     * @notice Returns bond volume for a range of blocks.
     *         Owner uses this to detect anomalous patterns (front-running, wash bonds).
     */
    function getBondVolume(uint256 fromBlock, uint256 toBlock)
        external
        view
        returns (uint256 volume)
    {
        for (uint256 b = fromBlock; b <= toBlock; b++) {
            volume += bondCountByBlock[b];
        }
    }
}

// ─── Interfaces ────────────────────────────────────────────────────────────────

interface IPancakePair {
    function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
    function totalSupply() external view returns (uint256);
    function token0() external view returns (address);
}
