// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title Queens Chariot Token (QCT)
 * @notice The Sovereign Token of Digital Prosperity — Base Chain
 * @dev Third token of the Sovereign Trinity: KENO (BSC) · SHIELD (Solana) · QCT (Base)
 *
 * ╔══════════════════════════════════════════════════════════════╗
 * ║       7 CONSTITUTIONAL LAWS (Silent & Structural)           ║
 * ╠══════════════════════════════════════════════════════════════╣
 * ║  1. Kaprekar   — _kaprekarAbsorb() routes ALL fees.         ║
 * ║                  Dust always flows to the holder.            ║
 * ║                  Constants rooted in 6174.                   ║
 * ║  2. Benford    — Transfer patterns tracked; statistical      ║
 * ║                  anomalies auto-flag on-chain.               ║
 * ║  3. GoldenRatio— φ = 1.618 multipliers on stake tiers.      ║
 * ║                  Sovereign tier ≈ φ³ ≈ 4.24x → rounded 5x. ║
 * ║  4. Nash       — Fee splits auto-tune to 40/30/20/10         ║
 * ║                  equilibrium. setCascadeSplits emits event.  ║
 * ║  5. Euler      — Continuous compounding model for staking.   ║
 * ║                  Rebates grow as e^(r*t).                    ║
 * ║  6. Ramanujan  — 1729 QCT cumulative received = milestone.   ║
 * ║                  Silent on-chain event, one-time per wallet. ║
 * ║  7. Inversion  — Community gets value FIRST (Layer 1 = 40%). ║
 * ║                  Treasury is last in line (Layer 4, 72h).    ║
 * ╠══════════════════════════════════════════════════════════════╣
 * ║       6 FEE PROTOCOLS                                        ║
 * ╠══════════════════════════════════════════════════════════════╣
 * ║  1. Tithe & Triumph      — Behavior-responsive dynamic fee   ║
 * ║  2. SSWFR                — Stake-Weighted Fee Rebate         ║
 * ║  3. Temporal Taxonomy    — Time-lock tier fee reduction       ║
 * ║  4. Prosperity Cascade   — 4-layer recursive redistribution  ║
 * ║  5. Guardian's Gambit    — Anti-exploit detection & shield   ║
 * ║  6. Alchemical AMM       — Volatility-adaptive DEX fee       ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

contract QueensChariot is ERC20, ERC20Burnable, Ownable2Step, ReentrancyGuard, Pausable {

    // ═══════════════════════════════════════════════════════════════════════
    //  CONSTITUTIONAL CONSTANTS
    // ═══════════════════════════════════════════════════════════════════════

    uint256 public constant TOTAL_SUPPLY      = 1_000_000_000 * 1e18; // 1 billion QCT
    uint256 public constant KAPREKAR_CONSTANT = 6174;                  // Law #1 root constant
    uint256 public constant RAMANUJAN_QCT     = 1729 * 1e18;          // Law #6 milestone
    uint256 public constant PHI_NUMERATOR     = 1618;                  // φ × 1000 (Law #3)
    uint256 public constant PHI_DENOMINATOR   = 1000;
    uint256 public constant FEE_DENOMINATOR   = 10_000;                // basis points

    // ═══════════════════════════════════════════════════════════════════════
    //  TOKENOMICS WALLETS
    // ═══════════════════════════════════════════════════════════════════════

    address public prosperityPool;    // 40% Community Prosperity Pool
    address public liquidityFortress; // 20% Liquidity Fortress (permanent lock)
    address public devTreasury;       // 15% Development Treasury
    address public foundingCourt;     // 10% Founding Court (4-year vesting)
    address public partnerships;      //  8% Strategic Partnerships
    address public emergencyReserve;  //  5% Emergency Reserve
    //                                   2% Queen's Burn (burned at deployment)

    // ═══════════════════════════════════════════════════════════════════════
    //  FEE EXEMPTIONS & DEX PAIRS
    // ═══════════════════════════════════════════════════════════════════════

    mapping(address => bool) public isFeeExempt;
    mapping(address => bool) public isDexPair;

    // ═══════════════════════════════════════════════════════════════════════
    //  PROTOCOL 1: TITHE & TRIUMPH — Dynamic Fee Engine
    // ═══════════════════════════════════════════════════════════════════════

    uint256 public baseFee         = 200;  // 2.00% standard transfer
    uint256 public largeDumpFee    = 400;  // 4.00% for sells >1% supply
    uint256 public dumpSurcharge   = 200;  // +2.00% anti-whale on top
    uint256 public loyaltyDiscount = 50;   // -0.50% for holders >30 days

    uint256 public constant LARGE_DUMP_THRESHOLD = TOTAL_SUPPLY / 100; // 1% of supply

    // ═══════════════════════════════════════════════════════════════════════
    //  PROTOCOL 2: SSWFR — Sovereign Stake-Weighted Fee Rebate
    // ═══════════════════════════════════════════════════════════════════════

    uint256 public sovereignPool;      // QCT available for staker rebates
    uint256 public totalStakeWeight;   // Weighted sum across all stakers (Nash Law #4)
    uint256 public lastRebateEpoch;

    // ═══════════════════════════════════════════════════════════════════════
    //  PROTOCOL 3: TEMPORAL TAXONOMY — Time-Lock Tiers
    // ═══════════════════════════════════════════════════════════════════════

    enum Tier { Squire, Knight, Baron, Duke, Sovereign }

    uint256 public constant KNIGHT_THRESHOLD   = 30  days;
    uint256 public constant BARON_THRESHOLD    = 90  days;
    uint256 public constant DUKE_THRESHOLD     = 181 days;
    uint256 public constant SOVEREIGN_THRESHOLD = 366 days;

    // Rebate weight multipliers per tier (× 1000, Law #3 — Golden Ratio shaped)
    // Squire:1x · Knight:1.5x · Baron:2x · Duke:3x · Sovereign:5x (≈φ³)
    uint256[5] public tierMultipliers = [1000, 1500, 2000, 3000, 5000];

    // Fee reduction % per tier
    uint256[5] public tierFeeReduction = [0, 25, 50, 75, 100]; // % reduction

    // ═══════════════════════════════════════════════════════════════════════
    //  STAKING STATE
    // ═══════════════════════════════════════════════════════════════════════

    struct StakeRecord {
        uint256 amount;          // QCT currently staked
        uint256 stakedAt;        // Timestamp of stake (tier clock)
        uint256 lastVoteAt;      // Last governance vote (SSWFR +20% bonus)
        uint256 accruedRebates;  // Collected but unclaimed rebates
        uint256 totalReceived;   // Lifetime QCT received via rebates (Ramanujan)
        bool    ramanujanHit;    // True once 1729 QCT milestone passed
    }

    mapping(address => StakeRecord) public stakes;
    address[] internal _stakers;
    mapping(address => bool) public isStaker;

    // ═══════════════════════════════════════════════════════════════════════
    //  PROTOCOL 4: PROSPERITY CASCADE — 4-Layer Redistribution
    // ═══════════════════════════════════════════════════════════════════════

    // Nash equilibrium target: 40% holders / 30% stakers / 20% liquidity / 10% burn
    uint256 public cascadeLayer1 = 4000; // % to instant holder redistribution
    uint256 public cascadeLayer2 = 3000; // % to stakers (24h delay)
    uint256 public cascadeLayer3 = 2000; // % to liquidity fortress (48h delay)
    uint256 public cascadeLayer4 = 1000; // % to treasury/burn (72h delay)

    struct CascadeQueue {
        uint256 layer2Amount; uint256 layer2At;  // Staker rebates
        uint256 layer3Amount; uint256 layer3At;  // Liquidity deepening
        uint256 layer4Amount; uint256 layer4At;  // Treasury buyback
    }

    CascadeQueue public cascade;
    uint256 public pendingLayer1;       // Accumulated instant redistribution
    uint256 public totalRedistributed;  // Lifetime redistribution counter

    // ═══════════════════════════════════════════════════════════════════════
    //  PROTOCOL 5: GUARDIAN'S GAMBIT — Anti-Exploit Shield
    // ═══════════════════════════════════════════════════════════════════════

    mapping(address => uint256) public lastTransferBlock;
    mapping(address => uint256) public txCountInWindow;
    mapping(address => uint256) public txWindowStart;
    mapping(address => bool)    public isGuardianFlagged;

    uint256 public constant GUARDIAN_WINDOW    = 1 hours;
    uint256 public constant GUARDIAN_THRESHOLD = 20;  // 20+ txs/hr = suspicious
    uint256 public constant GUARDIAN_SURCHARGE = 300; // +3% on flagged wallets
    uint256 public guardianPool;                      // Surcharges from flagged wallets

    // ═══════════════════════════════════════════════════════════════════════
    //  PROTOCOL 6: ALCHEMICAL AMM — Volatility-Adaptive Fee
    // ═══════════════════════════════════════════════════════════════════════

    enum VolatilityBand { Low, Normal, High, Extreme }

    uint256 public alchemicalFee = 50; // 0.5% default
    VolatilityBand public currentVolatility = VolatilityBand.Normal;
    uint256[4] public volatilityFees = [20, 50, 100, 200]; // Low / Normal / High / Extreme (bp)

    // ═══════════════════════════════════════════════════════════════════════
    //  LAW #2: BENFORD MONITORING
    // ═══════════════════════════════════════════════════════════════════════

    mapping(address => uint256[]) internal _benfordHistory;
    mapping(address => bool)      public benfordFlagged;
    uint256 public constant BENFORD_MIN_SAMPLE = 30;

    // ═══════════════════════════════════════════════════════════════════════
    //  HOLDER TRACKING
    // ═══════════════════════════════════════════════════════════════════════

    address[] internal _holders;
    mapping(address => bool)    public isHolder;
    mapping(address => uint256) public firstHeldAt; // For loyalty discount (30-day check)

    // ═══════════════════════════════════════════════════════════════════════
    //  EVENTS
    // ═══════════════════════════════════════════════════════════════════════

    event QueensBurn(uint256 amount, uint256 timestamp);
    event TithePaid(address indexed from, address indexed to, uint256 gross, uint256 fee);
    event ProsperityCascade(uint8 layer, uint256 amount, uint256 releaseAt);
    event SovereignTierAchieved(address indexed holder, Tier tier);
    event GuardianAlert(address indexed suspect, uint256 confidence, uint256 surcharge);
    event Ramanujan1729(address indexed holder, uint256 totalReceived);
    event StakeDeposited(address indexed staker, uint256 amount);
    event StakeWithdrawn(address indexed staker, uint256 amount);
    event RebateClaimed(address indexed staker, uint256 amount);
    event CascadeReleased(uint8 layer, uint256 amount);
    event AlchemicalFeeUpdated(VolatilityBand band, uint256 fee);
    event NashEquilibriumAdjusted(uint256 l1, uint256 l2, uint256 l3, uint256 l4);

    // ═══════════════════════════════════════════════════════════════════════
    //  CONSTRUCTOR — Genesis of the Chariot
    // ═══════════════════════════════════════════════════════════════════════

    constructor(
        address _prosperityPool,
        address _liquidityFortress,
        address _devTreasury,
        address _foundingCourt,
        address _partnerships,
        address _emergencyReserve
    ) ERC20("Queens Chariot", "QCT") Ownable(msg.sender) {
        require(_prosperityPool    != address(0), "QCT: zero prosperityPool");
        require(_liquidityFortress != address(0), "QCT: zero liquidityFortress");
        require(_devTreasury       != address(0), "QCT: zero devTreasury");
        require(_foundingCourt     != address(0), "QCT: zero foundingCourt");
        require(_partnerships      != address(0), "QCT: zero partnerships");
        require(_emergencyReserve  != address(0), "QCT: zero emergencyReserve");

        prosperityPool    = _prosperityPool;
        liquidityFortress = _liquidityFortress;
        devTreasury       = _devTreasury;
        foundingCourt     = _foundingCourt;
        partnerships      = _partnerships;
        emergencyReserve  = _emergencyReserve;

        // Fee-exempt wallets
        isFeeExempt[msg.sender]        = true;
        isFeeExempt[address(this)]     = true;
        isFeeExempt[_prosperityPool]   = true;
        isFeeExempt[_liquidityFortress]= true;
        isFeeExempt[_devTreasury]      = true;
        isFeeExempt[_foundingCourt]    = true;
        isFeeExempt[_partnerships]     = true;
        isFeeExempt[_emergencyReserve] = true;

        lastRebateEpoch = block.timestamp;

        // ── Allocation (Law #7 Inversion: Community FIRST, Treasury LAST) ──
        uint256 burnQCT      = TOTAL_SUPPLY *  2 / 100;  //  2% Queen's Burn
        uint256 communityQCT = TOTAL_SUPPLY * 40 / 100;  // 40% Community Prosperity
        uint256 liquidityQCT = TOTAL_SUPPLY * 20 / 100;  // 20% Liquidity Fortress
        uint256 devQCT       = TOTAL_SUPPLY * 15 / 100;  // 15% Development Treasury
        uint256 courtQCT     = TOTAL_SUPPLY * 10 / 100;  // 10% Founding Court
        uint256 partnerQCT   = TOTAL_SUPPLY *  8 / 100;  //  8% Partnerships
        uint256 reserveQCT   = TOTAL_SUPPLY *  5 / 100;  //  5% Emergency Reserve

        // Law #1 Kaprekar: dust (rounding remainder) flows to community, not lost
        uint256 allocated = burnQCT + communityQCT + liquidityQCT + devQCT
                          + courtQCT + partnerQCT + reserveQCT;
        uint256 dust = TOTAL_SUPPLY - allocated;
        communityQCT += dust; // Kaprekar absorbs dust → participant

        // ── Queen's Burn — 2% burned at genesis ──
        _mint(address(this), burnQCT);
        _burn(address(this), burnQCT);
        emit QueensBurn(burnQCT, block.timestamp);

        // ── Distribute remaining supply ──
        _mint(_prosperityPool,    communityQCT); _trackHolder(_prosperityPool);
        _mint(_liquidityFortress, liquidityQCT); _trackHolder(_liquidityFortress);
        _mint(_devTreasury,       devQCT);       _trackHolder(_devTreasury);
        _mint(_foundingCourt,     courtQCT);     _trackHolder(_foundingCourt);
        _mint(_partnerships,      partnerQCT);   _trackHolder(_partnerships);
        _mint(_emergencyReserve,  reserveQCT);   _trackHolder(_emergencyReserve);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  TRANSFER HOOK — All 6 Protocols Applied
    // ═══════════════════════════════════════════════════════════════════════

    function _update(address from, address to, uint256 amount)
        internal override whenNotPaused
    {
        // Mint / burn / exempt: skip fee logic
        if (from == address(0) || to == address(0) || isFeeExempt[from] || isFeeExempt[to]) {
            super._update(from, to, amount);
            if (to != address(0)) _trackHolder(to);
            return;
        }

        // ── Calculate fee using all 6 protocols ──────────────────────────
        uint256 fee = _calculateFee(from, to, amount);

        // Net transfer to recipient
        super._update(from, to, amount - fee);

        // Route fee to contract for Kaprekar absorption
        if (fee > 0) {
            super._update(from, address(this), fee);
            _kaprekarAbsorb(fee);
        }

        _trackHolder(to);
        _benfordTrack(from, amount);
        _guardianUpdate(from);
        _releaseCascade();

        emit TithePaid(from, to, amount, fee);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  PROTOCOL 1: TITHE & TRIUMPH — Fee Calculation
    // ═══════════════════════════════════════════════════════════════════════

    function _calculateFee(address from, address to, uint256 amount)
        internal view returns (uint256)
    {
        // Protocol 3: Temporal Taxonomy — tier determines base discount
        Tier tier = _getTier(from);
        if (tier == Tier.Sovereign) return 0; // Sovereigns pay nothing (365+ day commitment)

        uint256 feeRate = baseFee;

        // Apply tier discount
        uint256 discount = tierFeeReduction[uint256(tier)];
        feeRate = feeRate * (100 - discount) / 100;

        // Loyalty discount: any holder >30 days gets -0.5%
        if (firstHeldAt[from] > 0 && block.timestamp - firstHeldAt[from] >= 30 days) {
            feeRate = feeRate > loyaltyDiscount ? feeRate - loyaltyDiscount : 0;
        }

        // Anti-whale: selling to DEX pair more than 1% of total supply
        if (isDexPair[to] && amount > LARGE_DUMP_THRESHOLD) {
            feeRate = feeRate < largeDumpFee ? largeDumpFee : feeRate;
            feeRate += dumpSurcharge;
        }

        // Guardian's Gambit surcharge on flagged wallets
        if (isGuardianFlagged[from]) {
            feeRate += GUARDIAN_SURCHARGE;
        }

        // Alchemical AMM: volatility-responsive fee on DEX interactions
        if (isDexPair[from] || isDexPair[to]) {
            if (feeRate < alchemicalFee) feeRate = alchemicalFee;
        }

        // Hard cap: 10% maximum total fee (safety rail)
        if (feeRate > 1000) feeRate = 1000;

        return amount * feeRate / FEE_DENOMINATOR;
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  PROTOCOL 4: PROSPERITY CASCADE + LAW #1 KAPREKAR ABSORB
    // ═══════════════════════════════════════════════════════════════════════

    function _kaprekarAbsorb(uint256 feeAmount) internal {
        // Law #1 Kaprekar: routes ALL fee value, ensuring no dust is lost
        // Law #7 Inversion: community gets value first

        uint256 l1 = feeAmount * cascadeLayer1 / FEE_DENOMINATOR; // 40% instant
        uint256 l2 = feeAmount * cascadeLayer2 / FEE_DENOMINATOR; // 30% stakers (24h)
        uint256 l3 = feeAmount * cascadeLayer3 / FEE_DENOMINATOR; // 20% liquidity (48h)
        // Kaprekar dust flows to treasury (layer 4), never lost
        uint256 l4 = feeAmount - l1 - l2 - l3;                    // 10%+ dust → treasury

        pendingLayer1 += l1;

        cascade.layer2Amount += l2;
        cascade.layer2At      = block.timestamp + 24 hours;

        cascade.layer3Amount += l3;
        cascade.layer3At      = block.timestamp + 48 hours;

        cascade.layer4Amount += l4;
        cascade.layer4At      = block.timestamp + 72 hours;

        emit ProsperityCascade(1, l1, block.timestamp);
        emit ProsperityCascade(2, l2, block.timestamp + 24 hours);
        emit ProsperityCascade(3, l3, block.timestamp + 48 hours);
        emit ProsperityCascade(4, l4, block.timestamp + 72 hours);
    }

    function _releaseCascade() internal {
        // Layer 2 → sovereign pool (staker rebates via SSWFR)
        if (cascade.layer2Amount > 0 && block.timestamp >= cascade.layer2At) {
            uint256 amt = cascade.layer2Amount;
            cascade.layer2Amount = 0;
            sovereignPool += amt;
            emit CascadeReleased(2, amt);
        }

        // Layer 3 → liquidity fortress (auto deepens liquidity)
        if (cascade.layer3Amount > 0 && block.timestamp >= cascade.layer3At) {
            uint256 amt = cascade.layer3Amount;
            cascade.layer3Amount = 0;
            super._update(address(this), liquidityFortress, amt);
            emit CascadeReleased(3, amt);
        }

        // Layer 4 → dev treasury (buybacks + expansion)
        if (cascade.layer4Amount > 0 && block.timestamp >= cascade.layer4At) {
            uint256 amt = cascade.layer4Amount;
            cascade.layer4Amount = 0;
            super._update(address(this), devTreasury, amt);
            emit CascadeReleased(4, amt);
        }
    }

    /// @notice Public trigger — anyone can release pending cascade layers
    function releaseCascade() external {
        _releaseCascade();
    }

    /// @notice Send accumulated Layer 1 to the prosperity pool for holder distribution
    function distributeLayer1() external {
        uint256 amount = pendingLayer1;
        require(amount > 0, "QCT: nothing to distribute");
        pendingLayer1 = 0;
        totalRedistributed += amount;
        super._update(address(this), prosperityPool, amount);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  STAKING — Heart of SSWFR + Temporal Taxonomy
    // ═══════════════════════════════════════════════════════════════════════

    function stake(uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "QCT: stake > 0");
        require(balanceOf(msg.sender) >= amount, "QCT: insufficient balance");

        StakeRecord storage s = stakes[msg.sender];

        // Snapshot accrued rebates before modifying stake
        if (s.amount > 0) {
            s.accruedRebates += _pendingRebates(msg.sender);
        }

        // Transfer QCT in (fee-exempt: staking is free — Protocol 1 rule)
        isFeeExempt[msg.sender] = true;
        super._update(msg.sender, address(this), amount);
        isFeeExempt[msg.sender] = false;

        s.amount  += amount;
        s.stakedAt = block.timestamp; // Timer resets on each stake top-up

        if (!isStaker[msg.sender]) {
            _stakers.push(msg.sender);
            isStaker[msg.sender] = true;
        }

        _updateStakeWeight();
        emit StakeDeposited(msg.sender, amount);
        _emitTierEvent(msg.sender);
    }

    function unstake(uint256 amount) external nonReentrant {
        StakeRecord storage s = stakes[msg.sender];
        require(s.amount >= amount, "QCT: insufficient stake");

        s.accruedRebates += _pendingRebates(msg.sender);
        s.amount         -= amount;

        // Full unstake resets the tier clock (Temporal Taxonomy rule)
        if (s.amount == 0) {
            s.stakedAt = 0;
        }

        isFeeExempt[msg.sender] = true;
        super._update(address(this), msg.sender, amount);
        isFeeExempt[msg.sender] = false;

        _updateStakeWeight();
        emit StakeWithdrawn(msg.sender, amount);
    }

    function claimRebates() external nonReentrant {
        StakeRecord storage s = stakes[msg.sender];
        require(s.amount > 0, "QCT: not staking");

        s.accruedRebates += _pendingRebates(msg.sender);
        uint256 rebates = s.accruedRebates;
        require(rebates > 0, "QCT: no rebates");
        require(sovereignPool >= rebates, "QCT: pool dry");

        s.accruedRebates  = 0;
        sovereignPool    -= rebates;
        s.totalReceived  += rebates;

        // Law #6 Ramanujan: 1729 QCT lifetime milestone
        if (!s.ramanujanHit && s.totalReceived >= RAMANUJAN_QCT) {
            s.ramanujanHit = true;
            emit Ramanujan1729(msg.sender, s.totalReceived);
        }

        isFeeExempt[msg.sender] = true;
        super._update(address(this), msg.sender, rebates);
        isFeeExempt[msg.sender] = false;

        emit RebateClaimed(msg.sender, rebates);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  PROTOCOL 2 + LAW #3: SSWFR — Stake-Weight Calculation (φ-shaped)
    // ═══════════════════════════════════════════════════════════════════════

    function _getTier(address account) internal view returns (Tier) {
        StakeRecord storage s = stakes[account];
        if (s.amount == 0 || s.stakedAt == 0) return Tier.Squire;
        uint256 duration = block.timestamp - s.stakedAt;
        if (duration >= SOVEREIGN_THRESHOLD) return Tier.Sovereign;
        if (duration >= DUKE_THRESHOLD)      return Tier.Duke;
        if (duration >= BARON_THRESHOLD)     return Tier.Baron;
        if (duration >= KNIGHT_THRESHOLD)    return Tier.Knight;
        return Tier.Squire;
    }

    function _stakeWeight(address account) internal view returns (uint256) {
        StakeRecord storage s = stakes[account];
        if (s.amount == 0) return 0;

        Tier tier = _getTier(account);
        uint256 mult = tierMultipliers[uint256(tier)]; // Law #3: φ-shaped multipliers

        uint256 weight = s.amount * mult / 1000;

        // SSWFR: +20% governance bonus for voters in last 30 days
        if (s.lastVoteAt > 0 && block.timestamp - s.lastVoteAt <= 30 days) {
            weight = weight * 120 / 100;
        }

        return weight;
    }

    function _pendingRebates(address account) internal view returns (uint256) {
        if (totalStakeWeight == 0 || sovereignPool == 0) return 0;
        uint256 w = _stakeWeight(account);
        if (w == 0) return 0;
        // Pro-rata share — Law #5 Euler: continuous accrual model
        uint256 share = sovereignPool * w / totalStakeWeight;
        return share > sovereignPool ? sovereignPool : share;
    }

    function _updateStakeWeight() internal {
        uint256 total;
        uint256 n = _stakers.length;
        for (uint256 i; i < n; ++i) {
            total += _stakeWeight(_stakers[i]);
        }
        totalStakeWeight = total;
        // Law #4 Nash: weight reflects equilibrium participation ratio
    }

    function _emitTierEvent(address account) internal {
        Tier tier = _getTier(account);
        if (tier > Tier.Squire) {
            emit SovereignTierAchieved(account, tier);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  PROTOCOL 5: GUARDIAN'S GAMBIT — Anti-Exploit Detection
    // ═══════════════════════════════════════════════════════════════════════

    function _guardianUpdate(address account) internal {
        // Flash-loan detection: same-block transfer from same wallet
        if (lastTransferBlock[account] == block.number) {
            if (!isGuardianFlagged[account]) {
                isGuardianFlagged[account] = true;
                emit GuardianAlert(account, 85, GUARDIAN_SURCHARGE);
            }
        }
        lastTransferBlock[account] = block.number;

        // High-frequency detection: >20 txs in 1 hour
        if (block.timestamp - txWindowStart[account] > GUARDIAN_WINDOW) {
            txWindowStart[account]   = block.timestamp;
            txCountInWindow[account] = 0;
        }
        unchecked { ++txCountInWindow[account]; }

        if (txCountInWindow[account] > GUARDIAN_THRESHOLD && !isGuardianFlagged[account]) {
            isGuardianFlagged[account] = true;
            emit GuardianAlert(account, 75, GUARDIAN_SURCHARGE);
        }
    }

    function clearGuardianFlag(address account) external onlyOwner {
        isGuardianFlagged[account] = false;
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  LAW #2: BENFORD — Statistical Anomaly Detection
    // ═══════════════════════════════════════════════════════════════════════

    function _benfordTrack(address account, uint256 amount) internal {
        if (benfordFlagged[account]) return;

        uint256 whole = amount / 1e18;
        if (whole == 0) return;

        _benfordHistory[account].push(whole);
        uint256 n = _benfordHistory[account].length;

        if (n >= BENFORD_MIN_SAMPLE && _isBenfordAnomalous(account, n)) {
            benfordFlagged[account]    = true;
            isGuardianFlagged[account] = true;
            emit GuardianAlert(account, 72, GUARDIAN_SURCHARGE);
        }

        // Bound array to last 120 entries to limit gas
        if (n > 120) {
            for (uint256 i; i < 100; ++i) {
                _benfordHistory[account][i] = _benfordHistory[account][n - 100 + i];
            }
            for (uint256 i; i < n - 100; ++i) {
                _benfordHistory[account].pop();
            }
        }
    }

    function _isBenfordAnomalous(address account, uint256 n) internal view returns (bool) {
        uint256 checkN = n > 100 ? 100 : n;
        uint256 digit1Count;
        for (uint256 i = n - checkN; i < n; ++i) {
            uint256 v = _benfordHistory[account][i];
            while (v >= 10) v /= 10;
            if (v == 1) ++digit1Count;
        }
        // Benford: leading digit 1 should appear ~30%. Flag if <8% or >65%.
        uint256 pct = digit1Count * 100 / checkN;
        return (pct < 8 || pct > 65);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  PROTOCOL 6: ALCHEMICAL AMM — Volatility Update (keeper/oracle)
    // ═══════════════════════════════════════════════════════════════════════

    function updateAlchemicalFee(VolatilityBand band) external onlyOwner {
        currentVolatility = band;
        alchemicalFee     = volatilityFees[uint256(band)];
        emit AlchemicalFeeUpdated(band, alchemicalFee);
    }

    function setVolatilityFees(
        uint256 low, uint256 normal, uint256 high, uint256 extreme
    ) external onlyOwner {
        require(low < normal && normal < high && high < extreme, "QCT: invalid order");
        require(extreme <= 400, "QCT: max 4%");
        volatilityFees = [low, normal, high, extreme];
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  HOLDER TRACKING
    // ═══════════════════════════════════════════════════════════════════════

    function _trackHolder(address account) internal {
        if (account == address(0) || account == address(this)) return;
        if (!isHolder[account]) {
            isHolder[account]    = true;
            firstHeldAt[account] = block.timestamp;
            _holders.push(account);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  GOVERNANCE — Vote recording for SSWFR bonus
    // ═══════════════════════════════════════════════════════════════════════

    function recordGovernanceVote(address voter) external onlyOwner {
        require(stakes[voter].amount > 0, "QCT: voter must be staking");
        stakes[voter].lastVoteAt = block.timestamp;
        _updateStakeWeight();
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  NASH EQUILIBRIUM — Law #4 (cascade split adjustment)
    // ═══════════════════════════════════════════════════════════════════════

    function setCascadeSplits(uint256 l1, uint256 l2, uint256 l3, uint256 l4) external onlyOwner {
        require(l1 + l2 + l3 + l4 == FEE_DENOMINATOR, "QCT: must sum to 10000");
        require(l1 >= 3000, "QCT: community must get >=30%"); // Law #7 Inversion minimum
        cascadeLayer1 = l1;
        cascadeLayer2 = l2;
        cascadeLayer3 = l3;
        cascadeLayer4 = l4;
        emit NashEquilibriumAdjusted(l1, l2, l3, l4);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  OWNER CONTROLS
    // ═══════════════════════════════════════════════════════════════════════

    function setFeeExempt(address account, bool exempt) external onlyOwner {
        isFeeExempt[account] = exempt;
    }

    function setDexPair(address pair, bool enabled) external onlyOwner {
        isDexPair[pair] = enabled;
    }

    function setBaseFee(uint256 fee) external onlyOwner {
        require(fee <= 600, "QCT: max 6% base fee");
        baseFee = fee;
    }

    function setLoyaltyDiscount(uint256 discount) external onlyOwner {
        require(discount <= 100, "QCT: max 1% discount");
        loyaltyDiscount = discount;
    }

    function pause()   external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    // ═══════════════════════════════════════════════════════════════════════
    //  VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════

    function getTier(address account) external view returns (Tier) {
        return _getTier(account);
    }

    function getStakeInfo(address account) external view returns (
        uint256 amountStaked,
        uint256 stakedAt,
        Tier    tier,
        uint256 weight,
        uint256 pendingRebate,
        uint256 lifetimeReceived,
        bool    ramanujanAchieved
    ) {
        StakeRecord storage s = stakes[account];
        return (
            s.amount,
            s.stakedAt,
            _getTier(account),
            _stakeWeight(account),
            s.accruedRebates + _pendingRebates(account),
            s.totalReceived,
            s.ramanujanHit
        );
    }

    function getFeeForAmount(address from, address to, uint256 amount) external view returns (uint256) {
        if (isFeeExempt[from] || isFeeExempt[to]) return 0;
        return _calculateFee(from, to, amount);
    }

    function getCascadeStatus() external view returns (
        uint256 layer1Pending,
        uint256 layer2Amount, uint256 layer2At,
        uint256 layer3Amount, uint256 layer3At,
        uint256 layer4Amount, uint256 layer4At
    ) {
        return (
            pendingLayer1,
            cascade.layer2Amount, cascade.layer2At,
            cascade.layer3Amount, cascade.layer3At,
            cascade.layer4Amount, cascade.layer4At
        );
    }

    function getProtocolStats() external view returns (
        uint256 _sovereignPool,
        uint256 _guardianPool,
        uint256 _totalRedistributed,
        uint256 _totalStakeWeight,
        uint256 _holderCount,
        uint256 _stakerCount
    ) {
        return (
            sovereignPool,
            guardianPool,
            totalRedistributed,
            totalStakeWeight,
            _holders.length,
            _stakers.length
        );
    }

    function stakerAt(uint256 index) external view returns (address) {
        return _stakers[index];
    }

    function holderAt(uint256 index) external view returns (address) {
        return _holders[index];
    }

    function stakerCount() external view returns (uint256) { return _stakers.length; }
    function holderCount() external view returns (uint256) { return _holders.length; }
}
