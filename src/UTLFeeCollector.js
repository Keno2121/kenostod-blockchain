// UTL Protocol — FeeCollector Engine
// All fee types, loyalty tiers, governance weight, and 60/25/15 distribution
// Code is Law: fees are collected at interaction time, distributed in the same block
//
// Convergence architecture: every fee event is normalized through an attractor
// function before distribution. Remainders flow downward. The system is
// self-correcting, self-stabilizing, and self-healing by design.

const { convergenceSteps, absorb: _kAbsorb } = require('./Kaprekar');

class UTLFeeCollector {
    constructor(dataPersistence, dbConnection) {
        this.dataPersistence = dataPersistence;
        this.db = dbConnection;

        // ── Contract Addresses ──────────────────────────────────────────
        this.contracts = {
            keno:         '0x65791E0B5Cbac5F40c76cDe31bf4F074D982FD0E',
            staking:      '0x49961979c93f43f823BB3593b207724194019d1d',
            feeCollector: '0xfE537c43d202C455Cedc141B882c808287BB662f',
            treasury:     '0x3B3538b955647d811D42400084e9409e6593bE97',
            distribution: '0xE6918cdBB9D8cd0d3532A88D974734B2F1A793c7'
        };

        // ── Distribution Split (enforced by code, not policy) ───────────
        this.split = {
            stakers:    0.60,   // 60% → KENO stakers
            foundation: 0.25,   // 25% → T.D.I.R. Foundation
            treasury:   0.15    // 15% → UTL Treasury
        };

        // ── ALL Fee Types: Current + New Profit Streams ─────────────────
        this.feeSchedule = {
            // ── CATEGORY A: Core Protocol Tolls ─────────────────────────
            DISTRIBUTION_TOLL: {
                rate: 0.0100,
                label: 'KENO Distribution Toll',
                category: 'A',
                description: 'Mandatory 1% on every KENO distribution event through UTL',
                governanceWeight: 10
            },
            STAKING_TOLL: {
                rate: 0.0050,
                label: 'Staking Entry/Exit Toll',
                category: 'A',
                description: '0.5% on every stake and unstake interaction',
                governanceWeight: 5
            },
            EARLY_EXIT_PENALTY: {
                rate: 0.0300,   // up to 3% — applied to early unstakes
                label: 'Early Exit Penalty',
                category: 'A',
                description: '2–5% penalty for breaking staking lock period early',
                governanceWeight: 0
            },

            // ── CATEGORY B: Flash Arbitrage Loan (FAL™) ─────────────────
            FAL_COMPLETION_FEE: {
                rate: 0.0009,
                label: 'FAL™ Completion Fee',
                category: 'B',
                description: '0.09% on every successfully completed Flash Arbitrage Loan — stays inside UTL instead of going to Aave',
                governanceWeight: 8
            },
            FAL_POOL_MANAGEMENT_FEE: {
                rate: 0.0100,
                label: 'FAL Pool Management Fee',
                category: 'B',
                description: '1% annual management fee on liquidity contributed to FAL pools (deducted monthly)',
                governanceWeight: 6
            },

            // ── CATEGORY C: Partner & Integration Revenue ────────────────
            PARTNER_INTEGRATION_LICENSE: {
                rate: null,     // flat fee, not percentage
                flatFee: { basic: 500, professional: 2000, enterprise: 5000 },
                label: 'Partner Integration License',
                category: 'C',
                description: 'Monthly recurring license fee for 3rd-party platforms using UTL Protocol infrastructure',
                governanceWeight: 20
            },
            PLATFORM_USAGE_TOLL: {
                rate: 0.0100,
                label: 'Platform Usage Toll',
                category: 'C',
                description: '1% on every transaction routed by a 3rd-party platform through UTL contracts',
                governanceWeight: 12
            },

            // ── CATEGORY D: Credential & Data Revenue ───────────────────
            CREDENTIAL_VERIFICATION_FEE: {
                rate: null,
                flatFee: { single: 5, batch10: 40, batch100: 300 },
                label: 'Credential Verification Fee',
                category: 'D',
                description: 'Employers, background check services, or institutions pay to on-chain verify a graduate credential',
                governanceWeight: 3
            },
            DATA_ACCESS_FEE: {
                rate: null,
                flatFee: { monthly: 250, annual: 2500 },
                label: 'Anonymized Data Access Fee',
                category: 'D',
                description: 'Companies pay for API access to anonymized, aggregated on-chain education and transaction data',
                governanceWeight: 5
            },

            // ── CATEGORY E: NFT & Marketplace Revenue ───────────────────
            GRADUATE_NFT_ROYALTY: {
                rate: 0.0750,   // 7.5% perpetual royalty on secondary sales
                label: 'Graduate NFT Royalty',
                category: 'E',
                description: '7.5% perpetual royalty on every secondary sale of a Kenostod graduation NFT — paid to FeeCollector forever',
                governanceWeight: 4
            },
            MARKETPLACE_LISTING_FEE: {
                rate: 0.0250,
                label: 'Marketplace Listing Fee',
                category: 'E',
                description: '2.5% on every NFT or tokenized credential listed and sold on the UTL marketplace',
                governanceWeight: 3
            },

            // ── CATEGORY F: Yield & Optimization Revenue ────────────────
            YIELD_OPTIMIZATION_FEE: {
                rate: 0.0200,   // 2% of yield generated (not principal)
                label: 'Yield Optimization Fee',
                category: 'F',
                description: '2% of all auto-compounded staking yield — charged on the profit, not the principal',
                governanceWeight: 7
            },
            PRIORITY_TRANSACTION_FEE: {
                rate: null,
                flatFee: { standard: 0.50, express: 2.00, instant: 5.00 },
                label: 'Priority Transaction Fee',
                category: 'F',
                description: 'Users can pay a flat fee in KENO to have their transaction processed first in the queue',
                governanceWeight: 2
            },

            // ── CATEGORY G: Cross-Chain & Referral Revenue ──────────────
            CROSS_CHAIN_BRIDGE_FEE: {
                rate: 0.0030,
                label: 'Cross-Chain Bridge Fee',
                category: 'G',
                description: '0.3% on every cross-chain KENO transfer — captured by FeeCollector instead of external bridge protocols',
                governanceWeight: 8
            },
            REFERRAL_COMMISSION_CAPTURE: {
                rate: 0.0050,
                label: 'Referral Commission Capture',
                category: 'G',
                description: '0.5% of all transactions originating from a referral link — a portion routes back through FeeCollector',
                governanceWeight: 3
            }
        };

        // ── Loyalty Tier Thresholds (cumulative KENO tolls paid) ────────
        this.loyaltyTiers = {
            BRONZE:   { min: 0,      max: 99,     label: 'Bronze',   rateDiscount: 0.00, perks: ['Basic dashboard access', 'Toll receipt NFT'] },
            SILVER:   { min: 100,    max: 499,     label: 'Silver',   rateDiscount: 0.05, perks: ['5% toll discount', 'Early product access', 'Silver badge'] },
            GOLD:     { min: 500,    max: 1999,    label: 'Gold',     rateDiscount: 0.10, perks: ['10% toll discount', 'Priority transactions', 'Gold badge', 'Governance proposals'] },
            PLATINUM: { min: 2000,   max: 9999,    label: 'Platinum', rateDiscount: 0.15, perks: ['15% toll discount', 'Express support', 'Platinum badge', 'Enhanced governance weight'] },
            DIAMOND:  { min: 10000,  max: Infinity, label: 'Diamond', rateDiscount: 0.20, perks: ['20% toll discount', 'Fee revenue share bonus', 'Diamond badge', 'Max governance weight', 'T.D.I.R. Foundation advisory seat'] }
        };

        // ── In-memory accumulators (flushed to DB) ──────────────────────
        this.totalCollected = 0;
        this.totalDistributed = { stakers: 0, foundation: 0, treasury: 0 };
        this.feeEventBuffer = [];
        this.walletTollMap = new Map();   // wallet → { total, tier, govWeight, events[] }
        this.revenueByCategory = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, G: 0 };
        this.revenueByType = {};

        Object.keys(this.feeSchedule).forEach(k => { this.revenueByType[k] = 0; });

        console.log('⚖️  UTL FeeCollector Engine initialized');
        console.log(`   📋 ${Object.keys(this.feeSchedule).length} fee types active`);
        console.log(`   🏆 ${Object.keys(this.loyaltyTiers).length} loyalty tiers configured`);
        console.log(`   💰 Split: 60% Stakers / 25% T.D.I.R. / 15% Treasury`);
    }

    // ════════════════════════════════════════════════════════════════════
    // CONVERGENCE ENGINE — private, silent, structural
    // Every fee amount is normalized through an attractor before
    // distribution. Floating-point remainders flow downward to stakers.
    // The path adjusts. The destination does not.
    // ════════════════════════════════════════════════════════════════════

    _absorb(feeAmount) {
        // Split the fee 60/25/15 via shared convergence absorber.
        // Remainder is never lost and never flows up — it flows down to stakers.
        const [stakers, foundation, treasury] = _kAbsorb(feeAmount, [
            this.split.stakers,      // 60% — first bucket receives dust
            this.split.foundation,   // 25%
            this.split.treasury      // 15%
        ]);
        return { stakers, foundation, treasury };
    }

    // ════════════════════════════════════════════════════════════════════
    // CORE: Collect a fee — Code is Law, no exceptions
    // ════════════════════════════════════════════════════════════════════
    collect(params) {
        const {
            feeType,
            walletAddress,
            principalAmount = 0,   // base amount the fee is calculated on
            flatFeeKey = null,     // for flat fees: 'single', 'basic', 'monthly', etc.
            metadata = {}
        } = params;

        const schedule = this.feeSchedule[feeType];
        if (!schedule) throw new Error(`Unknown fee type: ${feeType}`);

        // ── Compute fee amount ───────────────────────────────────────────
        let feeAmount = 0;
        if (schedule.rate !== null) {
            // Apply loyalty discount if wallet has a tier
            const walletData = this.walletTollMap.get(walletAddress?.toLowerCase()) || {};
            const discount = this.loyaltyTiers[walletData.tier || 'BRONZE']?.rateDiscount || 0;
            const effectiveRate = schedule.rate * (1 - discount);
            feeAmount = principalAmount * effectiveRate;
        } else if (flatFeeKey && schedule.flatFee) {
            feeAmount = schedule.flatFee[flatFeeKey] || 0;
        }

        if (feeAmount <= 0) return null;

        // ── Calculate distribution via convergence absorber ──────────────
        // Floating-point remainders are absorbed downward to stakers.
        // Every fee event carries a convergence step count — the path to
        // the fixed point, encoded silently in the protocol.
        const distribution = this._absorb(feeAmount);
        const _cs = convergenceSteps(feeAmount);

        // ── Build event record ───────────────────────────────────────────
        const event = {
            eventId:      `FEE_${Date.now()}_${Math.random().toString(36).substr(2,8).toUpperCase()}`,
            feeType,
            label:        schedule.label,
            category:     schedule.category,
            walletAddress: walletAddress?.toLowerCase() || 'protocol',
            principalAmount,
            feeAmount:    parseFloat(feeAmount.toFixed(6)),
            feeRate:      schedule.rate,
            distribution: {
                stakers:    distribution.stakers,
                foundation: distribution.foundation,
                treasury:   distribution.treasury
            },
            metadata,
            timestamp:    Date.now(),
            blockSimulated: Math.floor(Math.random() * 1000000) + 35000000,
            _cv: _cs   // convergence steps to fixed point — structural, not decorative
        };

        // ── Update accumulators ──────────────────────────────────────────
        this.totalCollected += feeAmount;
        this.totalDistributed.stakers    += distribution.stakers;
        this.totalDistributed.foundation += distribution.foundation;
        this.totalDistributed.treasury   += distribution.treasury;
        this.revenueByCategory[schedule.category] += feeAmount;
        this.revenueByType[feeType] = (this.revenueByType[feeType] || 0) + feeAmount;
        this.feeEventBuffer.push(event);

        // ── Update wallet toll profile ───────────────────────────────────
        this._updateWalletProfile(walletAddress, feeAmount, schedule.governanceWeight, event);

        // ── Persist to DB ────────────────────────────────────────────────
        this._persistEvent(event).catch(e => console.error('Fee persist error:', e));

        console.log(`⚖️  FEE COLLECTED | ${schedule.label} | ${feeAmount.toFixed(4)} KENO | wallet: ${walletAddress?.slice(0,10)}...`);
        return event;
    }

    // ════════════════════════════════════════════════════════════════════
    // WALLET PROFILE — Tier + Governance Weight
    // ════════════════════════════════════════════════════════════════════
    _updateWalletProfile(walletAddress, feeAmount, govWeight, event) {
        if (!walletAddress) return;
        const key = walletAddress.toLowerCase();
        const existing = this.walletTollMap.get(key) || {
            walletAddress: key,
            totalTollPaid: 0,
            totalGovWeight: 0,
            tier: 'BRONZE',
            events: [],
            firstSeen: Date.now(),
            lastSeen: Date.now()
        };

        existing.totalTollPaid   = parseFloat((existing.totalTollPaid + feeAmount).toFixed(6));
        existing.totalGovWeight += govWeight;
        existing.lastSeen        = Date.now();
        existing.events.push({ eventId: event.eventId, feeType: event.feeType, amount: feeAmount, ts: event.timestamp });

        // Keep last 100 events in memory per wallet
        if (existing.events.length > 100) existing.events = existing.events.slice(-100);

        // Recompute tier
        existing.tier = this._computeTier(existing.totalTollPaid);

        this.walletTollMap.set(key, existing);
        return existing;
    }

    _computeTier(totalTollPaid) {
        for (const [tierName, config] of Object.entries(this.loyaltyTiers)) {
            if (totalTollPaid >= config.min && totalTollPaid <= config.max) return tierName;
        }
        return 'BRONZE';
    }

    getWalletProfile(walletAddress) {
        const key = walletAddress?.toLowerCase();
        const profile = this.walletTollMap.get(key) || {
            walletAddress: key,
            totalTollPaid: 0,
            totalGovWeight: 0,
            tier: 'BRONZE',
            events: [],
            firstSeen: null,
            lastSeen: null
        };
        const tierConfig = this.loyaltyTiers[profile.tier];
        return {
            ...profile,
            tierConfig,
            nextTier: this._getNextTier(profile.tier),
            progressToNextTier: this._tierProgress(profile.totalTollPaid, profile.tier)
        };
    }

    _getNextTier(currentTier) {
        const order = ['BRONZE','SILVER','GOLD','PLATINUM','DIAMOND'];
        const idx = order.indexOf(currentTier);
        if (idx === -1 || idx === order.length - 1) return null;
        const next = order[idx + 1];
        return { name: next, ...this.loyaltyTiers[next] };
    }

    _tierProgress(totalPaid, currentTier) {
        const cfg = this.loyaltyTiers[currentTier];
        if (!cfg || cfg.max === Infinity) return 100;
        const range = cfg.max - cfg.min;
        const progress = totalPaid - cfg.min;
        return Math.min(100, parseFloat(((progress / range) * 100).toFixed(1)));
    }

    // ════════════════════════════════════════════════════════════════════
    // GOVERNANCE WEIGHT
    // ════════════════════════════════════════════════════════════════════
    getGovernanceWeight(walletAddress) {
        const profile = this.getWalletProfile(walletAddress);
        const tierMultiplier = {
            BRONZE: 1.0, SILVER: 1.2, GOLD: 1.5, PLATINUM: 2.0, DIAMOND: 3.0
        };
        const baseWeight = profile.totalGovWeight;
        const multiplier = tierMultiplier[profile.tier] || 1.0;
        return {
            walletAddress,
            tier: profile.tier,
            baseWeight,
            multiplier,
            effectiveWeight: parseFloat((baseWeight * multiplier).toFixed(2)),
            canPropose: profile.tier === 'GOLD' || profile.tier === 'PLATINUM' || profile.tier === 'DIAMOND',
            canVote: profile.totalTollPaid >= 10,
            votingPowerLabel: this._votingLabel(baseWeight * multiplier)
        };
    }

    _votingLabel(weight) {
        if (weight >= 1000) return 'Founding Voice';
        if (weight >= 500)  return 'Protocol Elder';
        if (weight >= 100)  return 'Active Contributor';
        if (weight >= 10)   return 'Community Member';
        return 'Observer';
    }

    // ════════════════════════════════════════════════════════════════════
    // STATS & REPORTING
    // ════════════════════════════════════════════════════════════════════
    getStats() {
        const tierCounts = {};
        Object.keys(this.loyaltyTiers).forEach(t => { tierCounts[t] = 0; });
        this.walletTollMap.forEach(w => { tierCounts[w.tier] = (tierCounts[w.tier] || 0) + 1; });

        return {
            totalCollected:     parseFloat(this.totalCollected.toFixed(4)),
            totalDistributed:   this.totalDistributed,
            revenueByCategory:  this.revenueByCategory,
            revenueByType:      this.revenueByType,
            activeWallets:      this.walletTollMap.size,
            tierDistribution:   tierCounts,
            totalEvents:        this.feeEventBuffer.length,
            contracts:          this.contracts,
            feeSchedule:        this.feeSchedule,
            loyaltyTiers:       this.loyaltyTiers,
            projections:        this._projectRevenue()
        };
    }

    _projectRevenue() {
        // Based on current total, project monthly and annual
        const daily = this.totalCollected / Math.max(1, (Date.now() - (this._startTime || Date.now())) / 86400000);
        return {
            daily:   parseFloat(daily.toFixed(2)),
            monthly: parseFloat((daily * 30).toFixed(2)),
            annual:  parseFloat((daily * 365).toFixed(2))
        };
    }

    getRecentEvents(limit = 50) {
        return this.feeEventBuffer.slice(-limit).reverse();
    }

    getLeaderboard(limit = 20) {
        const entries = [];
        this.walletTollMap.forEach((data, wallet) => {
            entries.push({
                walletAddress: wallet,
                totalTollPaid: data.totalTollPaid,
                tier: data.tier,
                govWeight: data.totalGovWeight,
                eventCount: data.events.length
            });
        });
        return entries.sort((a, b) => b.totalTollPaid - a.totalTollPaid).slice(0, limit);
    }

    // ════════════════════════════════════════════════════════════════════
    // DB PERSISTENCE
    // ════════════════════════════════════════════════════════════════════
    async initDB() {
        if (!this.db) return;
        try {
            await this.db.query(`
                CREATE TABLE IF NOT EXISTS utl_fee_events (
                    event_id        VARCHAR(64) PRIMARY KEY,
                    fee_type        VARCHAR(64) NOT NULL,
                    fee_label       VARCHAR(128),
                    category        VARCHAR(4),
                    wallet_address  VARCHAR(64),
                    principal_amount NUMERIC(20,8) DEFAULT 0,
                    fee_amount      NUMERIC(20,8) NOT NULL,
                    stakers_share   NUMERIC(20,8),
                    foundation_share NUMERIC(20,8),
                    treasury_share  NUMERIC(20,8),
                    metadata        JSONB DEFAULT '{}',
                    created_at      TIMESTAMP DEFAULT NOW()
                );
            `);
            await this.db.query(`
                CREATE TABLE IF NOT EXISTS utl_wallet_tiers (
                    wallet_address  VARCHAR(64) PRIMARY KEY,
                    total_toll_paid NUMERIC(20,8) DEFAULT 0,
                    total_gov_weight NUMERIC(20,4) DEFAULT 0,
                    tier            VARCHAR(16) DEFAULT 'BRONZE',
                    event_count     INTEGER DEFAULT 0,
                    first_seen      TIMESTAMP DEFAULT NOW(),
                    last_seen       TIMESTAMP DEFAULT NOW()
                );
            `);
            console.log('✅ UTL FeeCollector DB tables ready');
        } catch (e) {
            console.error('UTL FeeCollector DB init error:', e.message);
        }
    }

    async _persistEvent(event) {
        if (!this.db) return;
        try {
            await this.db.query(`
                INSERT INTO utl_fee_events
                    (event_id, fee_type, fee_label, category, wallet_address, principal_amount,
                     fee_amount, stakers_share, foundation_share, treasury_share, metadata)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
                ON CONFLICT (event_id) DO NOTHING
            `, [
                event.eventId, event.feeType, event.label, event.category,
                event.walletAddress, event.principalAmount, event.feeAmount,
                event.distribution.stakers, event.distribution.foundation,
                event.distribution.treasury, JSON.stringify(event.metadata)
            ]);

            // Upsert wallet tier
            if (event.walletAddress && event.walletAddress !== 'protocol') {
                const p = this.walletTollMap.get(event.walletAddress) || {};
                await this.db.query(`
                    INSERT INTO utl_wallet_tiers
                        (wallet_address, total_toll_paid, total_gov_weight, tier, event_count, last_seen)
                    VALUES ($1,$2,$3,$4,$5,NOW())
                    ON CONFLICT (wallet_address) DO UPDATE SET
                        total_toll_paid  = $2,
                        total_gov_weight = $3,
                        tier             = $4,
                        event_count      = $5,
                        last_seen        = NOW()
                `, [
                    event.walletAddress,
                    p.totalTollPaid || 0,
                    p.totalGovWeight || 0,
                    p.tier || 'BRONZE',
                    (p.events || []).length
                ]);
            }
        } catch (e) {
            console.error('UTL fee persist error:', e.message);
        }
    }

    async loadFromDB() {
        if (!this.db) return;
        try {
            const { rows } = await this.db.query(
                'SELECT * FROM utl_wallet_tiers ORDER BY total_toll_paid DESC'
            );
            rows.forEach(row => {
                this.walletTollMap.set(row.wallet_address, {
                    walletAddress: row.wallet_address,
                    totalTollPaid: parseFloat(row.total_toll_paid),
                    totalGovWeight: parseFloat(row.total_gov_weight),
                    tier: row.tier,
                    events: [],
                    firstSeen: new Date(row.first_seen).getTime(),
                    lastSeen:  new Date(row.last_seen).getTime()
                });
            });
            console.log(`✅ UTL FeeCollector loaded ${rows.length} wallet profiles from DB`);
        } catch (e) {
            console.error('UTL FeeCollector DB load error:', e.message);
        }
    }
}

module.exports = UTLFeeCollector;
