// ProtocolHub — Unified Sovereign Economy Protocol Dispatcher
// All three ecosystems wired through the 7 Constitutional Laws
// KENO (Kenostod) · SHIELD (Kings Shield) · QCT (Queens Chariot)
// Every fee, every trade, every event passes through here.

const { absorbSplit }           = require('./Kaprekar');
const { monitor: benford }      = require('./Benford');
const { phiMultiplier }         = require('./GoldenRatio');
const { payoffMatrix, equilibriumAdjustment } = require('./Nash');
const { continuousEarnings }    = require('./Euler');
const { crossedMilestone, milestoneBonus } = require('./Ramanujan');
const { engine: vlatEngine }    = require('./VLATEngine');

// ─── Protocol Registry ────────────────────────────────────────────────────────
// All protocols across all 3 ecosystems. Status: active | building | pending
const PROTOCOL_REGISTRY = {
    // KENO ecosystem (BSC)
    keno_utl_fee: {
        ecosystem: 'KENO',
        name: 'UTL Fee Collector',
        protocol: 'UTL Protocol',
        description: '0.1% fee on all UTL transactions → 60% stakers / 40% treasury',
        status: 'active',
        chain: 'BSC',
        contract: '0xb9489B33Bd9bB835139369b1dD282fB44B2273d8',
        law: 'Nash + Kaprekar',
        revenueType: 'fee'
    },
    keno_falp: {
        ecosystem: 'KENO',
        name: 'Flash Arb Loan Pool',
        protocol: 'FALP',
        description: '3–7% fee on arb loans — Nash auto-tunes to utilization',
        status: 'building',
        chain: 'BSC',
        contract: null, // pending deploy after PinkSale BNB
        law: 'Nash + Euler',
        revenueType: 'fee'
    },
    keno_pancakeswap_hook: {
        ecosystem: 'KENO',
        name: 'PancakeSwap v4 Hook',
        protocol: 'UTL Hook',
        description: '0.09% on every KENO swap routed to FeeCollector',
        status: 'active',
        chain: 'BSC',
        contract: '0xAF810a663995DCe98c5D7EdF5C970446A33bAA74',
        law: 'Kaprekar',
        revenueType: 'swap_fee'
    },
    keno_arb_bot: {
        ecosystem: 'KENO',
        name: 'KENO Arb Bot',
        protocol: 'FlashOrbBot',
        description: 'Kaprekar split: 55% reinvest / 25% founder / 15% burn / 5% FALP',
        status: 'pending_funding', // needs BNB from PinkSale
        chain: 'BSC',
        contract: null,
        law: 'All 7',
        revenueType: 'arb_profit'
    },
    keno_staking_v2: {
        ecosystem: 'KENO',
        name: 'Staking v2',
        protocol: 'UTL Staking',
        description: '10M KENO staked — continuous Euler compounding on rewards',
        status: 'active',
        chain: 'BSC',
        contract: '0x5e4D6C40B9629C8A4C9bBbBDafE503e0C5D175a4',
        law: 'Euler + GoldenRatio',
        revenueType: 'staking_yield'
    },

    // SHIELD ecosystem (Solana)
    shield_aegis_tax: {
        ecosystem: 'SHIELD',
        name: 'Aegis Tax',
        protocol: 'King\'s Shield',
        description: '6.174% on all SHIELD transfers → POL + KENO Burn',
        status: 'active',
        chain: 'Solana',
        contract: null, // SPL token on-chain
        law: 'Kaprekar (6174 constant)',
        revenueType: 'transfer_tax'
    },
    shield_bonds: {
        ecosystem: 'SHIELD',
        name: 'Shield Bonds',
        protocol: 'King\'s Shield',
        description: 'OlympusDAO-style bonding: SOL deposits → discounted SHIELD',
        status: 'building',
        chain: 'Solana',
        contract: null, // Anchor program — skeleton
        law: 'GoldenRatio + Euler',
        revenueType: 'bond_revenue'
    },
    shield_constitution_bot: {
        ecosystem: 'SHIELD',
        name: 'Constitution Flash Bot',
        protocol: 'King\'s Shield',
        description: 'Flash loan arb on Solana — 0.09% fee, Benford fraud detection',
        status: 'active',
        chain: 'Solana',
        contract: null,
        law: 'Benford + Kaprekar',
        revenueType: 'arb_profit'
    },

    // QCT ecosystem (Base)
    qct_tithe_triumph: {
        ecosystem: 'QCT',
        name: 'Tithe & Triumph',
        protocol: 'Queens Chariot',
        description: '2% standard / 4% anti-whale / 0% Sovereign (365d+) — dynamic fee engine',
        status: 'active',
        chain: 'Base',
        contract: '0x137a5Fc22a76Ec42490F2421a81935d124baE714',
        law: 'Kaprekar + Nash',
        revenueType: 'transfer_tax'
    },
    qct_sswfr: {
        ecosystem: 'QCT',
        name: 'SSWFR',
        protocol: 'Queens Chariot',
        description: 'Stake-weighted fee rebates — negative effective fee rate achievable',
        status: 'active',
        chain: 'Base',
        contract: '0x137a5Fc22a76Ec42490F2421a81935d124baE714',
        law: 'Nash + GoldenRatio',
        revenueType: 'rebate_engine'
    },
    qct_temporal_taxonomy: {
        ecosystem: 'QCT',
        name: 'Temporal Taxonomy',
        protocol: 'Queens Chariot',
        description: 'Time-lock tiers: Squire 1× → Sovereign 5× (365d+ = zero fees forever)',
        status: 'active',
        chain: 'Base',
        contract: '0x137a5Fc22a76Ec42490F2421a81935d124baE714',
        law: 'GoldenRatio + Euler',
        revenueType: 'loyalty_multiplier'
    },
    qct_prosperity_cascade: {
        ecosystem: 'QCT',
        name: 'Prosperity Cascade',
        protocol: 'Queens Chariot',
        description: '4-layer recursive redistribution: 40% instant / 30% stakers / 20% LP / 10% treasury',
        status: 'active',
        chain: 'Base',
        contract: '0x137a5Fc22a76Ec42490F2421a81935d124baE714',
        law: 'Kaprekar + Inversion',
        revenueType: 'redistribution'
    },
    qct_guardians_gambit: {
        ecosystem: 'QCT',
        name: "Guardian's Gambit",
        protocol: 'Queens Chariot',
        description: '+3% surcharge on exploit patterns (flash loans, bots, Benford anomalies)',
        status: 'active',
        chain: 'Base',
        contract: '0x137a5Fc22a76Ec42490F2421a81935d124baE714',
        law: 'Benford + Kaprekar',
        revenueType: 'anti_exploit_fee'
    },
    qct_alchemical_amm: {
        ecosystem: 'QCT',
        name: 'Alchemical AMM',
        protocol: 'Queens Chariot',
        description: 'Volatility-adaptive DEX fee: 0.2% calm → 2.0% extreme',
        status: 'active',
        chain: 'Base',
        contract: '0x137a5Fc22a76Ec42490F2421a81935d124baE714',
        law: 'Nash + Euler',
        revenueType: 'amm_fee'
    }
};

// ─── Revenue Ledger ───────────────────────────────────────────────────────────
const revenueByProtocol = {};
const eventLog = [];
let totalLifetimeRevenue = 0;

// Nash state (updated per event)
let nashState = {
    totalFeeVolume:   0,
    participantCount: 0,
    stakedKeno:       10_000_000, // 10M staked at launch
    totalKeno:        1_000_000_000,
    currentStakerSplit: 0.60
};

// ─── Core Dispatcher ──────────────────────────────────────────────────────────

/**
 * dispatch(protocolKey, amount, wallet?)
 * The single entry point for ALL protocol revenue events.
 * Runs every event through the 7 Constitutional Laws before recording.
 */
function dispatch(protocolKey, amount, wallet = null) {
    const protocol = PROTOCOL_REGISTRY[protocolKey];
    if (!protocol) {
        console.warn(`[ProtocolHub] Unknown protocol: ${protocolKey}`);
        return null;
    }
    if (!amount || amount <= 0) return null;

    // Law 2 — Benford: record transaction for fraud detection
    if (wallet) benford.record(wallet, amount);

    // Law 1 — Kaprekar: split by revenue type
    const split = _kaprekarRoute(protocolKey, amount, protocol);

    // Law 4 — Nash: update fee volume, check equilibrium
    nashState.totalFeeVolume   += amount;
    nashState.participantCount  = Math.max(nashState.participantCount, 1);
    const nash   = payoffMatrix(nashState.totalFeeVolume, nashState.participantCount, nashState.stakedKeno, nashState.totalKeno);
    const newSplit = equilibriumAdjustment(nash.nashScore, nashState.currentStakerSplit);
    if (newSplit !== nashState.currentStakerSplit) {
        nashState.currentStakerSplit = newSplit;
    }

    // Law 3 — GoldenRatio: apply φ multiplier based on consecutive active periods
    const activePeriods = Object.values(PROTOCOL_REGISTRY).filter(p => p.status === 'active').length;
    const phiBoost = phiMultiplier(activePeriods);

    // Law 5 — Euler: continuous compounding on staking/yield revenue types
    let eulerBonus = 0;
    if (['staking_yield', 'bond_revenue', 'rebate_engine'].includes(protocol.revenueType)) {
        eulerBonus = continuousEarnings(split.stakers || amount * 0.60, 0.20, 1 / 52); // weekly
    }

    // Law 6 — Ramanujan: milestone check on cumulative protocol revenue
    const prevTotal = revenueByProtocol[protocolKey]?.total || 0;
    const newTotal  = prevTotal + amount;
    let r1729Bonus  = 0;
    if (crossedMilestone(prevTotal, newTotal)) {
        r1729Bonus = milestoneBonus(newTotal);
        console.log(`🎯 [ProtocolHub] 1729 milestone hit on ${protocol.name}! Bonus: ${r1729Bonus}`);
    }

    // Law 7 — Inversion: confirm value flows to participants first (already in split logic)
    const inversionOk = (split.participants || 0) >= amount * 0.40; // 40%+ to participants always

    // Record
    if (!revenueByProtocol[protocolKey]) {
        revenueByProtocol[protocolKey] = { total: 0, events: 0, lastEvent: null };
    }
    revenueByProtocol[protocolKey].total  = parseFloat((newTotal).toFixed(6));
    revenueByProtocol[protocolKey].events += 1;
    revenueByProtocol[protocolKey].lastEvent = new Date().toISOString();
    totalLifetimeRevenue = parseFloat((totalLifetimeRevenue + amount).toFixed(6));

    const event = {
        id:           `${protocolKey}_${Date.now()}`,
        protocol:     protocolKey,
        ecosystem:    protocol.ecosystem,
        amount,
        split,
        nash:         { score: nash.nashScore, equilibrium: nash.equilibriumReached, stakerSplit: nashState.currentStakerSplit },
        phiBoost:     parseFloat(phiBoost.toFixed(4)),
        eulerBonus:   parseFloat(eulerBonus.toFixed(8)),
        r1729Bonus,
        inversionOk,
        wallet:       wallet ? wallet.slice(0, 8) + '...' : null,
        timestamp:    new Date().toISOString(),
        _hub:         true
    };

    eventLog.push(event);
    if (eventLog.length > 500) eventLog.shift(); // rolling window

    return event;
}

// ─── Kaprekar Route — splits by revenue type ─────────────────────────────────
function _kaprekarRoute(key, amount, protocol) {
    switch (protocol.revenueType) {
        case 'arb_profit':
            return absorbSplit(amount, { founder: 0.25, reinvest: 0.55, burn: 0.15, falp: 0.05 });
        case 'transfer_tax':
        case 'anti_exploit_fee':
        case 'amm_fee':
            return absorbSplit(amount, { participants: 0.40, stakers: 0.30, liquidity: 0.20, treasury: 0.10 });
        case 'fee':
        case 'swap_fee':
            return absorbSplit(amount, { stakers: 0.60, treasury: 0.40 });
        case 'staking_yield':
        case 'rebate_engine':
            return absorbSplit(amount, { participants: 0.70, treasury: 0.20, burn: 0.10 });
        case 'bond_revenue':
            return absorbSplit(amount, { liquidity: 0.60, participants: 0.25, treasury: 0.15 });
        case 'loyalty_multiplier':
        case 'redistribution':
            return absorbSplit(amount, { participants: 0.55, stakers: 0.30, burn: 0.15 });
        default:
            return absorbSplit(amount, { participants: 0.50, stakers: 0.30, treasury: 0.20 });
    }
}

// ─── Bulk Aegis Tax route (called by Kings Shield bot after each trade) ────────
function dispatchAegisTax(profitSol, wallet) {
    const TAX_RATE = 0.06174; // 6.174% — Kaprekar constant embedded
    const taxAmount = parseFloat((profitSol * TAX_RATE).toFixed(8));
    if (taxAmount <= 0) return null;
    return dispatch('shield_aegis_tax', taxAmount, wallet);
}

// ─── QCT Cascade trigger (server-side scheduler calls this) ──────────────────
function triggerQCTCascade(feeAmount) {
    return dispatch('qct_prosperity_cascade', feeAmount);
}

// ─── Dashboard summary ────────────────────────────────────────────────────────
function summary() {
    const byEcosystem = { KENO: 0, SHIELD: 0, QCT: 0 };
    const protocolList = Object.entries(PROTOCOL_REGISTRY).map(([key, p]) => {
        const rev = revenueByProtocol[key] || { total: 0, events: 0, lastEvent: null };
        byEcosystem[p.ecosystem] = parseFloat(((byEcosystem[p.ecosystem] || 0) + rev.total).toFixed(6));
        return { key, ...p, revenue: rev };
    });

    const activeCount  = protocolList.filter(p => p.status === 'active').length;
    const buildingCount = protocolList.filter(p => p.status === 'building').length;
    const pendingCount  = protocolList.filter(p => p.status === 'pending_funding').length;

    const nash = payoffMatrix(
        nashState.totalFeeVolume,
        nashState.participantCount,
        nashState.stakedKeno,
        nashState.totalKeno
    );

    const vlat = vlatEngine.snapshot();

    return {
        timestamp:           new Date().toISOString(),
        totalLifetimeRevenue,
        byEcosystem,
        protocols:           protocolList,
        counts:              { active: activeCount, building: buildingCount, pending: pendingCount, total: protocolList.length },
        nashEquilibrium:     nash,
        recentEvents:        eventLog.slice(-20),
        vlat,
        _hub:                true
    };
}

// ─── Update Nash state (called externally with real staking data) ─────────────
function updateNashState(updates) {
    Object.assign(nashState, updates);
}

module.exports = {
    PROTOCOL_REGISTRY,
    dispatch,
    dispatchAegisTax,
    triggerQCTCascade,
    summary,
    updateNashState,
    revenueByProtocol,
    eventLog
};
