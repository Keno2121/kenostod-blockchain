// Solar Bunker Protocol — Core Reward & Mesh Engine
// T.D.I.R. Foundation · Kenostod Blockchain Academy LLC
//
// Operational logic for:
//   — Bunker device activation & tier management
//   — Resilience Reward calculation (uptime mining)
//   — Mesh fee distribution (neighbor payments during outages)
//   — Guardian Node slot management
//   — Catastrophe Pause extension logic
//
// The six mathematical principles are structural — not decorative.
// They operate inside every calculation below. They are never named
// on any public-facing surface.

const { convergenceSteps, absorb: _kAbsorb } = require('./Kaprekar');
const { monitor: benfordMonitor }              = require('./Benford');
const { phiMultiplier, nextFibMilestone }      = require('./GoldenRatio');
const { payoffMatrix }                         = require('./Nash');
const { continuousEarnings, toContinuousRate } = require('./Euler');
const { crossedMilestone, milestoneBonus, signatureTag } = require('./Ramanujan');

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

const TIERS = {
    BRONZE:  { minStake: 1000,   storage: '500GB',    guardianSlots: 0,  label: 'Bronze',  baseAPY: 0.12 },
    SILVER:  { minStake: 5000,   storage: '2TB',      guardianSlots: 1,  label: 'Silver',  baseAPY: 0.16 },
    GOLD:    { minStake: 25000,  storage: '10TB',     guardianSlots: 5,  label: 'Gold',    baseAPY: 0.21 },
    DIAMOND: { minStake: 100000, storage: 'Unlimited', guardianSlots: 10, label: 'Diamond', baseAPY: 0.28 }
};

const MESH_FEE_PER_HOUR   = 10;        // KENO paid to neighbors per hour of mesh uptime
const STORAGE_BURN_RATE   = 100;       // KENO burned per 100GB/month
const GUARDIAN_STAKE      = 5000;      // KENO per Guardian Node slot
const RESILIENCE_BOND     = 2500;      // KENO staked for Resilience Mining
const CATASTROPHE_PAUSE_HOURS = 24;   // hours the reversal window extends during declared catastrophe

// Mesh fee split — mirrors Inversion Principle: value flows DOWN to participants
const MESH_SPLIT = { neighbors: 0.60, foundation: 0.25, treasury: 0.15 };

// Resilience Reward base APY per tier — continuous compounding applied in calculations
const RESILIENCE_APY = { BRONZE: 0.08, SILVER: 0.12, GOLD: 0.18, DIAMOND: 0.25 };

// ─── TIER RESOLUTION ─────────────────────────────────────────────────────────

function resolveTier(stakedKeno) {
    if (stakedKeno >= TIERS.DIAMOND.minStake) return 'DIAMOND';
    if (stakedKeno >= TIERS.GOLD.minStake)    return 'GOLD';
    if (stakedKeno >= TIERS.SILVER.minStake)  return 'SILVER';
    if (stakedKeno >= TIERS.BRONZE.minStake)  return 'BRONZE';
    return null;  // below minimum — not activated
}

// ─── RESILIENCE REWARD ENGINE ────────────────────────────────────────────────
// Called every reward cycle for an active Bunker node.
// stakedKeno    : KENO locked to activate device
// uptimeMs      : milliseconds the node has been continuously online
// consecutiveWeeks : how many full weeks without deactivation

function calculateResilienceReward(stakedKeno, uptimeMs, consecutiveWeeks = 0) {
    const tier = resolveTier(stakedKeno);
    if (!tier) return { reward: 0, tier: null };

    const apy         = RESILIENCE_APY[tier];
    const yearInMs    = 365 * 24 * 60 * 60 * 1000;
    const timeRatio   = uptimeMs / yearInMs;

    // Euler: continuous compounding — mathematically maximum earnings rate
    const r      = toContinuousRate(apy);
    const base   = continuousEarnings(stakedKeno, r, timeRatio);

    // Golden Ratio: φ multiplier grows silently with consecutive uptime weeks
    // The longer a node stays live, the closer rewards approach φ × base
    const phi    = phiMultiplier(consecutiveWeeks);
    const reward = parseFloat((base * phi).toFixed(6));

    return {
        reward,
        tier,
        apy,
        _phi: phi,              // φ multiplier — structural, not surfaced
        _r: r                   // continuous rate — structural, not surfaced
    };
}

// ─── MESH FEE DISTRIBUTION ───────────────────────────────────────────────────
// When a node is used as a mesh relay during an outage, MESH_FEE_PER_HOUR KENO
// is distributed. Kaprekar convergence absorbs all floating-point dust downward
// to neighbors — never lost, never held by the protocol.

function distributeMeshFee(feeAmount, walletAddress, metadata = {}) {
    const raw = {
        neighbors:   feeAmount * MESH_SPLIT.neighbors,
        foundation:  feeAmount * MESH_SPLIT.foundation,
        treasury:    feeAmount * MESH_SPLIT.treasury
    };

    // Kaprekar: every dust remainder flows DOWN to neighbors
    const _cs = convergenceSteps(feeAmount);
    const total = parseFloat((raw.neighbors + raw.foundation + raw.treasury).toFixed(6));
    const dust  = parseFloat((feeAmount - total).toFixed(6));
    const neighborsFinal = parseFloat((raw.neighbors + Math.max(0, dust)).toFixed(6));

    // Benford: record mesh fee amount per wallet for silent fraud detection
    if (walletAddress) benfordMonitor.record(walletAddress, feeAmount);

    // Nash: participation payoff for mesh relay — staying active is always dominant
    const nash = payoffMatrix(feeAmount, 1, feeAmount, feeAmount * 10);

    return {
        neighbors:    neighborsFinal,
        foundation:   parseFloat(raw.foundation.toFixed(6)),
        treasury:     parseFloat(raw.treasury.toFixed(6)),
        feeAmount,
        walletAddress: walletAddress?.toLowerCase(),
        metadata,
        timestamp:    Date.now(),
        _cv:  _cs,                              // Kaprekar convergence steps
        _bd:  benfordMonitor.isFlagged(walletAddress) ? 1 : 0,  // Benford flag
        _ns:  nash.nashScore                    // Nash equilibrium score
    };
}

// ─── GUARDIAN NODE STAKE REWARD ──────────────────────────────────────────────
// Guardian Nodes earn fees from protected members. This calculates their share.
// nodeStakedKeno : KENO staked across all guardian slots for this node
// totalNetworkStake : total KENO staked across all guardian nodes in network
// totalFeePool : KENO pool available for guardian distribution this cycle

function guardianNodeReward(nodeStakedKeno, totalNetworkStake, totalFeePool) {
    if (!totalNetworkStake || totalNetworkStake <= 0) return 0;
    const share  = nodeStakedKeno / totalNetworkStake;
    const reward = parseFloat((totalFeePool * share).toFixed(6));

    // Benford: monitor guardian payout amounts — outsized claims detectable
    benfordMonitor.record('guardian_pool', reward);

    return reward;
}

// ─── NODE ACTIVATION RECORD ──────────────────────────────────────────────────
// Called when a wallet activates a Bunker device. Checks tier, validates stake,
// applies Ramanujan milestone bonus silently if applicable.

function activateNode(walletAddress, stakedKeno) {
    const tier = resolveTier(stakedKeno);
    if (!tier) {
        return { success: false, reason: `Minimum stake is ${TIERS.BRONZE.minStake} KENO` };
    }

    const tierConfig = TIERS[tier];

    // Ramanujan: silent bonus if cumulative staked KENO crosses 1729
    const rBonus = milestoneBonus(stakedKeno);
    const effectiveStake = parseFloat((stakedKeno + rBonus).toFixed(6));
    const _rTag  = signatureTag(stakedKeno);   // _R1729 appears in record at milestone

    // Golden Ratio: next Fibonacci milestone above current stake
    const _nextFib = nextFibMilestone(effectiveStake);

    // Benford: record activation stake for wallet monitoring
    benfordMonitor.record(walletAddress, stakedKeno);

    return {
        success: true,
        walletAddress: walletAddress?.toLowerCase(),
        tier,
        label:         tierConfig.label,
        stakedKeno:    effectiveStake,
        storage:       tierConfig.storage,
        guardianSlots: tierConfig.guardianSlots,
        activatedAt:   Date.now(),
        _nextMilestone: _nextFib,
        _sig: _rTag || undefined   // _R1729 tag at milestone, silent otherwise
    };
}

// ─── CATASTROPHE PAUSE EXTENSION ─────────────────────────────────────────────
// During a declared catastrophe, the standard 5-minute transaction reversal
// window extends to CATASTROPHE_PAUSE_HOURS. This function returns the
// exact deadline timestamp and a Nash-verified participation signal.

function catastrophePauseDeadline(catastropheDeclaredAt, totalStakedKeno, totalKeno) {
    const deadlineMs = catastropheDeclaredAt + (CATASTROPHE_PAUSE_HOURS * 60 * 60 * 1000);

    // Nash: verify participation is still dominant during catastrophe conditions
    // (ensures the network doesn't collapse exactly when it's needed most)
    const nash = payoffMatrix(
        MESH_FEE_PER_HOUR * 24,   // estimated 24hr mesh fees
        Math.max(1, Math.round(totalStakedKeno / GUARDIAN_STAKE)),
        totalStakedKeno,
        totalKeno
    );

    return {
        catastropheDeclaredAt,
        pauseDeadline:      deadlineMs,
        pauseHours:         CATASTROPHE_PAUSE_HOURS,
        equilibriumStable:  nash.equilibriumReached,
        _ns:                nash.nashScore    // Nash score — structural
    };
}

// ─── STORAGE BURN CALCULATION ─────────────────────────────────────────────────
// Additional storage costs STORAGE_BURN_RATE KENO/100GB/month.
// Burned — reduces circulating supply.

function storageMonthlyBurn(additionalGB) {
    if (additionalGB <= 0) return 0;
    return parseFloat(((additionalGB / 100) * STORAGE_BURN_RATE).toFixed(6));
}

// ─── EXPORTS ─────────────────────────────────────────────────────────────────

module.exports = {
    TIERS,
    MESH_FEE_PER_HOUR,
    STORAGE_BURN_RATE,
    GUARDIAN_STAKE,
    RESILIENCE_BOND,
    CATASTROPHE_PAUSE_HOURS,
    MESH_SPLIT,
    RESILIENCE_APY,
    resolveTier,
    calculateResilienceReward,
    distributeMeshFee,
    guardianNodeReward,
    activateNode,
    catastrophePauseDeadline,
    storageMonthlyBurn
};
