// VLAT Engine — Volume · Liquidity · Adoption · Time
// The Sovereign Economy's multi-platform optimization framework
// Revenue = (V × L × A × T) × Platform_Count × Cross_Platform_Multiplier
// No project has ever used VLAT metrics to optimize cross-platform revenue.
// This is the playbook.

const { continuousEarnings } = require('./Euler');
const { phiMultiplier }       = require('./GoldenRatio');
const { crossedMilestone, milestoneBonus, signatureTag } = require('./Ramanujan');
const { absorbSplit }         = require('./Kaprekar');

const CROSS_PLATFORM_MULTIPLIER = 1.5;
const REVENUE_TARGET = 3000; // $3,000/month financial freedom goal

// Platform base scores — research-backed, June 2026
const PLATFORMS = {
    hyperliquid: {
        name: 'Hyperliquid',
        scores: { V: 95, L: 90, A: 70, T: 60 },
        total: 78.75,
        strength: 'Volume + Liquidity',
        integration: ['QCT fee protocols', 'FAL 2.0', 'RVT Perps', 'UTL Bridge'],
        status: 'phase1',
        chain: 'HyperEVM',
        monthTarget: 1,
        color: '#00d4ff'
    },
    aster: {
        name: 'Aster',
        scores: { V: 70, L: 65, A: 85, T: 50 },
        total: 67.5,
        strength: 'Adoption + Retail Reach',
        integration: ['Multi-chain QCT', 'Hidden Orders', 'UTL Protocol'],
        status: 'phase2',
        chain: 'BNB / ETH / SOL / ARB',
        monthTarget: 2,
        color: '#9b59b6'
    },
    gmx: {
        name: 'GMX V2',
        scores: { V: 60, L: 75, A: 60, T: 80 },
        total: 68.75,
        strength: 'Liquidity Depth + Time Maturity',
        integration: ['PoRV Compute Exchange', 'RVT commodity perps', 'GM pool yield'],
        status: 'phase3',
        chain: 'Arbitrum + Avalanche',
        monthTarget: 3,
        color: '#2ecc71'
    },
    dydx: {
        name: 'dYdX v4',
        scores: { V: 50, L: 70, A: 55, T: 90 },
        total: 66.25,
        strength: 'Decentralization + Institutional Trust',
        integration: ["Guardian's Gambit", '6174 optimization engine'],
        status: 'phase4',
        chain: 'Cosmos',
        monthTarget: 4,
        color: '#e67e22'
    }
};

// Revenue projection phases (conservative — Kimi VLAT analysis)
const REVENUE_PHASES = [
    { id: 1, months: '1–3',   label: 'Build + Audit',          min: 0,    max: 0,    phase: 'build'     },
    { id: 2, months: '4–6',   label: 'Testnet + Soft Launch',  min: 0,    max: 200,  phase: 'testnet'   },
    { id: 3, months: '7–9',   label: 'Mainnet + Early Volume', min: 200,  max: 800,  phase: 'mainnet'   },
    { id: 4, months: '10–12', label: 'Growing Volume',         min: 800,  max: 1500, phase: 'growing'   },
    { id: 5, months: '13–15', label: 'Established',            min: 1500, max: 2500, phase: 'established'},
    { id: 6, months: '16–18', label: 'Mature — QUIT JOB ✊',   min: 2500, max: 3500, phase: 'freedom'   }
];

class VLATEngine {
    constructor() {
        this.platformScores  = JSON.parse(JSON.stringify(PLATFORMS));
        this.activePlatforms = new Set(['hyperliquid']); // grows as integrations go live
        this.cumulativeRevenue = 0;
        this.monthlyRevenue    = 0;
        this.startDate         = new Date('2026-06-26'); // PinkSale launch date
        this.revenueHistory    = [];
        this._r1729Hit         = false;
    }

    // Composite VLAT score for one platform (normalized 0–100, φ-boosted)
    platformScore(key) {
        const p = this.platformScores[key];
        if (!p) return null;
        const { V, L, A, T } = p.scores;
        const raw = (V / 100) * (L / 100) * (A / 100) * (T / 100) * 100; // normalized
        const boost = phiMultiplier(this.activePlatforms.size);
        return parseFloat((raw * boost).toFixed(4));
    }

    // Combined score across all active platforms with cross-platform multiplier
    compositeScore() {
        let total = 0;
        for (const key of this.activePlatforms) {
            const s = this.platformScore(key);
            if (s !== null) total += s;
        }
        return parseFloat((total * CROSS_PLATFORM_MULTIPLIER).toFixed(4));
    }

    // Mark a platform as live (called when integration deploys)
    activatePlatform(key) {
        if (!this.platformScores[key]) return false;
        this.platformScores[key].status = 'active';
        this.activePlatforms.add(key);
        return true;
    }

    // Record a month of revenue — runs through all 7 Constitutional Laws
    recordRevenue(monthlyAmount) {
        const prev = this.cumulativeRevenue;

        // Law 1 — Kaprekar: proper split, dust flows to founder (participant first)
        const split = absorbSplit(monthlyAmount, {
            founder:  0.25,
            reinvest: 0.55,
            burn:     0.15,
            falp:     0.05
        });

        // Law 5 — Euler: continuous compounding on the reinvested portion
        const eulerBoost = continuousEarnings(split.reinvest, 0.20, 1 / 12);

        this.monthlyRevenue    = monthlyAmount;
        this.cumulativeRevenue = parseFloat((prev + monthlyAmount).toFixed(2));

        // Law 6 — Ramanujan: check for 1729 milestone
        let r1729Bonus = 0;
        if (!this._r1729Hit && crossedMilestone(prev, this.cumulativeRevenue)) {
            this._r1729Hit = true;
            r1729Bonus = milestoneBonus(this.cumulativeRevenue);
        }

        const entry = {
            timestamp:   new Date().toISOString(),
            monthly:     monthlyAmount,
            cumulative:  this.cumulativeRevenue,
            split,
            eulerBoost:  parseFloat(eulerBoost.toFixed(6)),
            r1729Bonus,
            tag:         signatureTag(this.cumulativeRevenue),
            progressPct: parseFloat(((monthlyAmount / REVENUE_TARGET) * 100).toFixed(2))
        };
        this.revenueHistory.push(entry);
        return entry;
    }

    // Current phase based on months elapsed since PinkSale launch
    currentPhase() {
        const now           = new Date();
        const msElapsed     = now - this.startDate;
        const monthsElapsed = Math.max(0, Math.floor(msElapsed / (1000 * 60 * 60 * 24 * 30)));
        if (monthsElapsed < 3)  return { ...REVENUE_PHASES[0], monthsElapsed };
        if (monthsElapsed < 6)  return { ...REVENUE_PHASES[1], monthsElapsed };
        if (monthsElapsed < 9)  return { ...REVENUE_PHASES[2], monthsElapsed };
        if (monthsElapsed < 12) return { ...REVENUE_PHASES[3], monthsElapsed };
        if (monthsElapsed < 15) return { ...REVENUE_PHASES[4], monthsElapsed };
        return { ...REVENUE_PHASES[5], monthsElapsed };
    }

    // Full dashboard snapshot — everything the dashboard needs in one call
    snapshot() {
        const activePlatformList = [...this.activePlatforms];
        const allPlatformData    = Object.entries(this.platformScores).map(([key, p]) => ({
            key,
            name:           p.name,
            scores:         p.scores,
            total:          p.total,
            strength:       p.strength,
            integration:    p.integration,
            status:         p.status,
            chain:          p.chain,
            monthTarget:    p.monthTarget,
            color:          p.color,
            compositeScore: this.platformScore(key),
            isActive:       this.activePlatforms.has(key)
        }));

        return {
            timestamp:              new Date().toISOString(),
            activePlatforms:        activePlatformList,
            activePlatformCount:    activePlatformList.length,
            compositeScore:         this.compositeScore(),
            crossPlatformMultiplier: CROSS_PLATFORM_MULTIPLIER,
            monthlyRevenue:         this.monthlyRevenue,
            cumulativeRevenue:      this.cumulativeRevenue,
            revenueTarget:          REVENUE_TARGET,
            progressPct:            parseFloat(((this.monthlyRevenue / REVENUE_TARGET) * 100).toFixed(2)),
            currentPhase:           this.currentPhase(),
            platforms:              allPlatformData,
            revenueHistory:         this.revenueHistory.slice(-12),
            phases:                 REVENUE_PHASES,
            phiMultiplier:          phiMultiplier(activePlatformList.length),
            r1729Hit:               this._r1729Hit,
            _vlat:                  true
        };
    }
}

const engine = new VLATEngine();

module.exports = { VLATEngine, engine, PLATFORMS, REVENUE_PHASES, REVENUE_TARGET };
