// GraduateAcademyManager.js — Hyperliquid Higher Education, unlocked at graduation
//
// THE PROGRESSION:
//   21 courses completed → Graduate → Unlock Hyperliquid Academy (4 advanced modules)
//
//   Module 1: Perpetuals & Funding Rates   → Squire vault tier  (30d,  1.00×)
//   Module 2: Prosperity Cascade & Vaults  → Knight vault tier  (90d,  1.18×)
//   Module 3: Cross-Venue Arbitrage        → Lord vault tier    (180d, 1.38×)
//   Module 4: The Sovereign Trade          → Sovereign tier     (365d, 1.62× ≈ φ)
//
// PRINCIPLE: Same as the 21 core courses — you EARN access by completing modules,
// nothing is required from you upfront. Education unlocks capital, not the reverse.

const { continuousEarnings } = require('./Euler');
const { absorb }             = require('./Kaprekar');
const { equilibriumAdjustment } = require('./Nash');

const PHI = 1.6180339887;

const HL_MODULES = [
    {
        id:          1,
        title:       'Perpetuals & Funding Rates',
        description: 'How perpetual contracts work on Hyperliquid. Funding rates as passive income. ' +
                     'Why funding rate arbitrage is the most reliable yield in DeFi.',
        duration:    '~2 hours',
        unlocks:     'SQUIRE',
        kenoBonus:   500,
        outcomes:    [
            'Understand long/short perpetual mechanics',
            'Calculate funding rate income from any position',
            'Identify positive funding rate opportunities',
            'Execute your first manual funding rate collection'
        ]
    },
    {
        id:          2,
        title:       'The Prosperity Cascade — Vault Architecture',
        description: 'How the Hyperliquid vault distributes profits automatically. ' +
                     'The four cascade levels: instant (40%), 24h stakers (30%), reinvest (20%), burn (10%). ' +
                     'Why time-lock multipliers compound your position.',
        duration:    '~3 hours',
        unlocks:     'KNIGHT',
        kenoBonus:   750,
        outcomes:    [
            'Understand vault deposit mechanics on HL',
            'Calculate your share of each cascade tier',
            'Compare lock-period multipliers (1.00× to 1.62×)',
            'Model your expected monthly income from vault deposits'
        ]
    },
    {
        id:          3,
        title:       'Cross-Venue Arbitrage: HL vs CEX',
        description: 'Spot pricing gaps between Hyperliquid and centralized exchanges. ' +
                     'How the bot executes arb in real time. ' +
                     'Risk management at each position size. Reading the order book like a pro.',
        duration:    '~4 hours',
        unlocks:     'LORD',
        kenoBonus:   1000,
        outcomes:    [
            'Read HL order books and identify spread opportunities',
            'Understand how the ArbEngine scans CEX vs HL prices',
            'Calculate break-even spread after fees and slippage',
            'Manage downside risk at 3 capital tiers'
        ]
    },
    {
        id:          4,
        title:       'The Sovereign Trade — Full Stack Capital',
        description: 'The complete sovereign playbook: KENO staking + FAL borrowing + HL vault deposit. ' +
                     'How these three streams compound each other toward $3,000/month passive income. ' +
                     'The Inversion Principle in action: you built the machine that pays you.',
        duration:    '~5 hours',
        unlocks:     'SOVEREIGN',
        kenoBonus:   1729,  // Ramanujan milestone — intentional
        outcomes:    [
            'Stack KENO staking + FAL borrow + vault deposit simultaneously',
            'Model your path from $500 to $3,000/month using the Nash ladder',
            'Set up automated compound reinvestment (Euler continuous)',
            'Become a vault depositor at Sovereign tier (365d, φ multiplier)'
        ]
    }
];

const VAULT_TIERS = {
    SQUIRE:   { lockDays: 30,  multiplier: 1.00, label: 'Squire',   minDepositUSD: 100,  color: '🟫' },
    KNIGHT:   { lockDays: 90,  multiplier: 1.18, label: 'Knight',   minDepositUSD: 500,  color: '🩶' },
    LORD:     { lockDays: 180, multiplier: 1.38, label: 'Lord',     minDepositUSD: 1000, color: '🥇' },
    SOVEREIGN:{ lockDays: 365, multiplier: PHI,  label: 'Sovereign',minDepositUSD: 2500, color: '👑' },
};

class GraduateAcademyManager {
    constructor(db) {
        this.db = db;
    }

    async initTables() {
        await this.db.query(`
            CREATE TABLE IF NOT EXISTS graduate_hl_access (
                id            SERIAL PRIMARY KEY,
                wallet        VARCHAR(42)   NOT NULL UNIQUE,
                graduate_id   VARCHAR(50)   NOT NULL,
                enrolled_at   TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
                highest_tier  VARCHAR(20)   DEFAULT NULL,
                status        VARCHAR(20)   DEFAULT 'active'
            )
        `);

        await this.db.query(`
            CREATE TABLE IF NOT EXISTS graduate_hl_modules (
                id            SERIAL PRIMARY KEY,
                wallet        VARCHAR(42)   NOT NULL,
                module_id     INTEGER       NOT NULL,
                module_title  VARCHAR(255)  NOT NULL,
                unlocked_tier VARCHAR(20)   NOT NULL,
                keno_bonus    DECIMAL(18,8) NOT NULL,
                completed_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(wallet, module_id)
            )
        `);

        await this.db.query(`
            CREATE TABLE IF NOT EXISTS graduate_vault_deposits (
                id            SERIAL PRIMARY KEY,
                wallet        VARCHAR(42)   NOT NULL,
                tier          VARCHAR(20)   NOT NULL,
                amount_usd    DECIMAL(18,4) NOT NULL,
                lock_days     INTEGER       NOT NULL,
                multiplier    DECIMAL(10,6) NOT NULL,
                locked_until  TIMESTAMP     NOT NULL,
                apy_base      DECIMAL(6,4)  DEFAULT 0.15,
                status        VARCHAR(20)   DEFAULT 'active',
                deposited_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
            )
        `);

        console.log('✅ GraduateAcademyManager tables ready');
    }

    // ── Check graduate status ──────────────────────────────────────────────────
    async _isGraduate(wallet) {
        const result = await this.db.query(`
            SELECT graduate_id, completion_date, total_courses, keno_earned, rvt_nft_tier
            FROM kenostod_graduates
            WHERE LOWER(wallet_address) = LOWER($1)
        `, [wallet]);
        return result.rows[0] || null;
    }

    // ── Enroll in Higher Academy (graduates only) ──────────────────────────────
    async enroll(wallet) {
        try {
            const normalizedWallet = wallet.toLowerCase();
            const graduate = await this._isGraduate(normalizedWallet);

            if (!graduate) {
                return {
                    success: false,
                    locked:  true,
                    error:   'Hyperliquid Academy unlocks after graduation. Complete all 21 core courses first.',
                    hint:    'Every course earns 250 KENO. 21 courses = 5,250 KENO + Platinum RVT NFT + Higher Academy access.'
                };
            }

            const existing = await this.db.query(`
                SELECT * FROM graduate_hl_access WHERE wallet = $1
            `, [normalizedWallet]);

            if (existing.rows.length > 0) {
                return {
                    success:   true,
                    alreadyEnrolled: true,
                    access:    existing.rows[0],
                    message:   'You are already enrolled in Hyperliquid Higher Academy!'
                };
            }

            const result = await this.db.query(`
                INSERT INTO graduate_hl_access (wallet, graduate_id)
                VALUES ($1, $2)
                RETURNING *
            `, [normalizedWallet, graduate.graduate_id]);

            console.log(`🎓 HL Academy enrollment: ${normalizedWallet} (${graduate.graduate_id})`);

            return {
                success:     true,
                access:      result.rows[0],
                graduate:    graduate,
                modules:     HL_MODULES,
                message:     `🎓 Welcome to Hyperliquid Higher Academy, Graduate! ` +
                             `4 advanced modules unlock the Sovereign vault tier (φ = ${PHI} multiplier). ` +
                             `Complete Module 1 to access your first vault position.`,
                nextStep:    HL_MODULES[0]
            };
        } catch (err) {
            console.error('❌ GraduateAcademy enroll error:', err.message);
            return { success: false, error: err.message };
        }
    }

    // ── Full academy status for a wallet ──────────────────────────────────────
    async getAcademyStatus(wallet) {
        try {
            const normalizedWallet = wallet.toLowerCase();
            const graduate = await this._isGraduate(normalizedWallet);

            if (!graduate) {
                const coreProgress = await this.db.query(`
                    SELECT COUNT(DISTINCT course_id) as completed
                    FROM student_rewards
                    WHERE LOWER(user_wallet_address) = $1
                    AND reward_type = 'course_completion'
                `, [normalizedWallet]);

                const completed = parseInt(coreProgress.rows[0]?.completed || 0);
                return {
                    success:         true,
                    graduated:       false,
                    coreCoursesCompleted: completed,
                    coreCoursesRequired: 21,
                    remaining:       21 - completed,
                    message:         `Complete ${21 - completed} more core course(s) to unlock Hyperliquid Higher Academy.`
                };
            }

            const accessRes = await this.db.query(`
                SELECT * FROM graduate_hl_access WHERE wallet = $1
            `, [normalizedWallet]);

            const enrolled = accessRes.rows.length > 0;

            const completedModulesRes = await this.db.query(`
                SELECT * FROM graduate_hl_modules
                WHERE wallet = $1
                ORDER BY module_id ASC
            `, [normalizedWallet]);

            const completedModuleIds = completedModulesRes.rows.map(r => r.module_id);
            const highestTier        = this._highestTier(completedModuleIds);

            const depositsRes = await this.db.query(`
                SELECT * FROM graduate_vault_deposits
                WHERE wallet = $1 AND status = 'active'
                ORDER BY deposited_at DESC
            `, [normalizedWallet]);

            const totalDeposited  = depositsRes.rows.reduce((s, r) => s + parseFloat(r.amount_usd), 0);
            const totalMultiplied = depositsRes.rows.reduce((s, r) => s + parseFloat(r.amount_usd) * parseFloat(r.multiplier), 0);

            const modulesWithStatus = HL_MODULES.map(m => {
                const isCompleted = completedModuleIds.includes(m.id);
                const prevDone    = m.id === 1 || completedModuleIds.includes(m.id - 1);
                return {
                    ...m,
                    completed:  isCompleted,
                    unlockable: !isCompleted && prevDone && enrolled,
                    locked:     !isCompleted && !prevDone
                };
            });

            const nextModule = modulesWithStatus.find(m => !m.completed);

            return {
                success:          true,
                graduated:        true,
                graduate,
                enrolled,
                highestTier,
                vaultTierDetails: highestTier ? VAULT_TIERS[highestTier] : null,
                modules:          modulesWithStatus,
                completedModules: completedModulesRes.rows,
                nextModule:       nextModule || null,
                vaultDeposits:    depositsRes.rows,
                vault: {
                    totalDepositedUSD:  parseFloat(totalDeposited.toFixed(2)),
                    multipliedWeight:   parseFloat(totalMultiplied.toFixed(2)),
                    activePositions:    depositsRes.rows.length
                },
                income: this._projectIncome(depositsRes.rows)
            };
        } catch (err) {
            console.error('❌ GraduateAcademy getStatus error:', err.message);
            return { success: false, error: err.message };
        }
    }

    // ── Complete an HL Academy module ─────────────────────────────────────────
    async completeModule(wallet, moduleId) {
        try {
            const normalizedWallet = wallet.toLowerCase();
            const parsedId = parseInt(moduleId);

            if (!HL_MODULES.find(m => m.id === parsedId)) {
                return { success: false, error: `Invalid module ID ${moduleId}. Modules are 1–4.` };
            }

            const accessRes = await this.db.query(`
                SELECT * FROM graduate_hl_access WHERE wallet = $1
            `, [normalizedWallet]);

            if (accessRes.rows.length === 0) {
                return { success: false, error: 'Not enrolled in Hyperliquid Academy. Enroll first.' };
            }

            if (parsedId > 1) {
                const prevRes = await this.db.query(`
                    SELECT id FROM graduate_hl_modules
                    WHERE wallet = $1 AND module_id = $2
                `, [normalizedWallet, parsedId - 1]);

                if (prevRes.rows.length === 0) {
                    return {
                        success: false,
                        error:   `Complete Module ${parsedId - 1} before unlocking Module ${parsedId}.`
                    };
                }
            }

            const mod = HL_MODULES.find(m => m.id === parsedId);

            const result = await this.db.query(`
                INSERT INTO graduate_hl_modules
                    (wallet, module_id, module_title, unlocked_tier, keno_bonus)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (wallet, module_id) DO NOTHING
                RETURNING *
            `, [normalizedWallet, parsedId, mod.title, mod.unlocks, mod.kenoBonus]);

            if (result.rows.length === 0) {
                return { success: false, error: `Module ${parsedId} already completed.` };
            }

            await this.db.query(`
                UPDATE graduate_hl_access
                SET highest_tier = $1
                WHERE wallet = $2
            `, [mod.unlocks, normalizedWallet]);

            // Award KENO bonus via student_rewards
            await this.db.query(`
                INSERT INTO student_rewards
                    (user_wallet_address, reward_type, reward_amount, description, status)
                VALUES ($1, 'hl_module_completion', $2, $3, 'available')
            `, [
                normalizedWallet,
                mod.kenoBonus,
                `HL Academy: ${mod.title}`
            ]);

            const tier = VAULT_TIERS[mod.unlocks];
            const nextMod = HL_MODULES.find(m => m.id === parsedId + 1) || null;

            console.log(`🎓 HL Module ${parsedId} completed: ${normalizedWallet} → unlocked ${mod.unlocks} tier`);

            // Ramanujan bonus on Module 4 (1729 KENO is intentional)
            const ramanujanNote = parsedId === 4
                ? ' The Ramanujan milestone: 1,729 KENO. Self-taught. From nothing. Rewrote everything.'
                : '';

            return {
                success:      true,
                module:       result.rows[0],
                kenoAwarded:  mod.kenoBonus,
                unlockedTier: mod.unlocks,
                tierDetails:  tier,
                message:      `🏆 Module ${parsedId} complete! Earned ${mod.kenoBonus} KENO + unlocked ${tier.label} vault tier.${ramanujanNote}`,
                nextModule:   nextMod,
                vaultAccess: {
                    tier:           tier.label,
                    lockDays:       tier.lockDays,
                    multiplier:     tier.multiplier,
                    minDepositUSD:  tier.minDepositUSD,
                    instruction:    `You can now deposit into the ${tier.label} vault (${tier.lockDays}-day lock, ${tier.multiplier.toFixed(3)}× multiplier).`
                }
            };
        } catch (err) {
            console.error('❌ GraduateAcademy completeModule error:', err.message);
            return { success: false, error: err.message };
        }
    }

    // ── Register a vault deposit (tier must be unlocked) ──────────────────────
    async registerVaultDeposit(wallet, tierName, amountUSD) {
        try {
            const normalizedWallet = wallet.toLowerCase();
            const tier = VAULT_TIERS[tierName.toUpperCase()];

            if (!tier) {
                return { success: false, error: `Invalid tier. Choose: SQUIRE, KNIGHT, LORD, or SOVEREIGN.` };
            }

            const unlockedTierRes = await this.db.query(`
                SELECT highest_tier FROM graduate_hl_access WHERE wallet = $1
            `, [normalizedWallet]);

            if (unlockedTierRes.rows.length === 0) {
                return { success: false, error: 'Not enrolled in HL Academy.' };
            }

            const highestTier  = unlockedTierRes.rows[0].highest_tier;
            const tierOrder    = ['SQUIRE', 'KNIGHT', 'LORD', 'SOVEREIGN'];
            const highestIndex = tierOrder.indexOf(highestTier);
            const targetIndex  = tierOrder.indexOf(tierName.toUpperCase());

            if (targetIndex > highestIndex) {
                const required = HL_MODULES[targetIndex];
                return {
                    success: false,
                    error:   `Complete Module ${targetIndex + 1} (${required.title}) to unlock ${tier.label} tier.`,
                    moduleRequired: required
                };
            }

            if (parseFloat(amountUSD) < tier.minDepositUSD) {
                return {
                    success: false,
                    error:   `Minimum deposit for ${tier.label} tier is $${tier.minDepositUSD} USD.`
                };
            }

            const lockedUntil = new Date(Date.now() + tier.lockDays * 86400000);
            const baseAPY     = 0.15;

            // Euler premium: continuous compounding at APY × multiplier
            const effectiveRate = baseAPY * tier.multiplier;
            const projectedEarnings = continuousEarnings(
                parseFloat(amountUSD),
                effectiveRate,
                tier.lockDays / 365
            );

            const result = await this.db.query(`
                INSERT INTO graduate_vault_deposits
                    (wallet, tier, amount_usd, lock_days, multiplier, locked_until, apy_base)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING *
            `, [normalizedWallet, tierName.toUpperCase(), amountUSD, tier.lockDays, tier.multiplier, lockedUntil, baseAPY]);

            console.log(`💎 Vault deposit: ${normalizedWallet} | ${tier.label} | $${amountUSD} | ${tier.lockDays}d`);

            return {
                success:            true,
                deposit:            result.rows[0],
                tier:               tier.label,
                lockedUntil,
                projectedEarningsUSD: parseFloat(projectedEarnings.toFixed(2)),
                effectiveAPY:       `${(effectiveRate * 100).toFixed(2)}%`,
                message:            `✅ $${amountUSD} registered in the ${tier.label} vault (${tier.lockDays}-day lock). ` +
                                    `Projected earnings: $${projectedEarnings.toFixed(2)} at ${(effectiveRate * 100).toFixed(1)}% effective APY.`,
                hlInstruction:      process.env.HL_VAULT_ADDRESS
                    ? `Deposit $${amountUSD} USDC to vault: ${process.env.HL_VAULT_ADDRESS} on Hyperliquid.`
                    : 'Vault address will be provided when the Prosperity Vault is live on Hyperliquid.'
            };
        } catch (err) {
            console.error('❌ GraduateAcademy registerVaultDeposit error:', err.message);
            return { success: false, error: err.message };
        }
    }

    // ── Public: vault tiers info (no auth needed) ─────────────────────────────
    getVaultTiers() {
        return {
            success: true,
            tiers: Object.entries(VAULT_TIERS).map(([key, t]) => ({
                id:             key,
                label:          t.label,
                emoji:          t.color,
                lockDays:       t.lockDays,
                multiplier:     t.multiplier,
                minDepositUSD:  t.minDepositUSD,
                baseAPY:        '15%',
                effectiveAPY:   `${(0.15 * t.multiplier * 100).toFixed(2)}%`,
                unlockedBy:     `HL Academy Module ${['SQUIRE','KNIGHT','LORD','SOVEREIGN'].indexOf(key) + 1}`,
                monthlyOn1k:    `$${(1000 * 0.15 * t.multiplier / 12).toFixed(0)}/month per $1,000 deposited`
            })),
            progression: 'Graduate → Module 1 → Squire → Module 2 → Knight → Module 3 → Lord → Module 4 → Sovereign (φ)',
            vaultAddress: process.env.HL_VAULT_ADDRESS || 'Coming soon — QCT Prosperity Vault on Hyperliquid'
        };
    }

    // ── Internal helpers ──────────────────────────────────────────────────────
    _highestTier(completedModuleIds) {
        const tierMap = { 1: 'SQUIRE', 2: 'KNIGHT', 3: 'LORD', 4: 'SOVEREIGN' };
        const max = Math.max(0, ...completedModuleIds);
        return tierMap[max] || null;
    }

    _projectIncome(deposits) {
        if (!deposits.length) return null;
        const totalMonthly = deposits.reduce((sum, d) => {
            const effectiveAPY = 0.15 * parseFloat(d.multiplier);
            return sum + parseFloat(d.amount_usd) * effectiveAPY / 12;
        }, 0);

        const nashTarget = 3000;
        const splits = equilibriumAdjustment
            ? equilibriumAdjustment({ vault: totalMonthly / nashTarget, other: 1 - totalMonthly / nashTarget })
            : { vault: totalMonthly / nashTarget };

        return {
            projectedMonthlyUSD: parseFloat(totalMonthly.toFixed(2)),
            nashTargetUSD:       nashTarget,
            progressPct:         parseFloat(Math.min(100, (totalMonthly / nashTarget) * 100).toFixed(1)),
            note:                'Vault income alone. Add KENO staking + FAL profits + SHIELD tax + arb bot to reach $3k/month.'
        };
    }
}

module.exports = { GraduateAcademyManager, HL_MODULES, VAULT_TIERS };
