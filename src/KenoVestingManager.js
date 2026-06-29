// KenoVestingManager.js — Three-layer liquidity protection for earned KENO
//
// LAYER 1 — Auto-Stake (90-day lock)
//   Every 250 KENO earned from a course is auto-staked for 90 days.
//   During the lock, it earns 15% APY via Euler continuous compounding.
//   Students cannot sell — the pool is protected during early growth.
//
// LAYER 2 — Vesting (10 KENO / month for 25 months)
//   After the 90-day lock expires, KENO doesn't all go liquid at once.
//   It vests at 10 KENO/month for 25 months.
//   By month 25 the pool is deep enough to absorb full-graduate sells.
//
// LAYER 3 — FAL Collateral Borrowing
//   Students borrow up to 50% of their staked KENO value as a flash loan.
//   They get USD liquidity WITHOUT touching the price.
//   This is the sovereign move — wealthy people borrow, they don't sell.

const { continuousEarnings } = require('./Euler');
const { absorb }             = require('./Kaprekar');

const LOCK_DAYS          = 90;
const VEST_PER_MONTH     = 10;       // KENO unlocked per month after lock
const VEST_MONTHS        = 25;       // 10 × 25 = 250 KENO total
const STAKE_APY          = 0.15;    // 15% annual — Euler continuous
const MAX_LTV            = 0.50;    // borrow up to 50% of staked value
const FAL_FEE_RATE       = 0.05;    // 5% fee on FAL loan amount
const MS_PER_DAY         = 86400000;
const MS_PER_MONTH       = 30 * MS_PER_DAY;

class KenoVestingManager {
    constructor(db) {
        this.db = db;
    }

    async initTables() {
        await this.db.query(`
            CREATE TABLE IF NOT EXISTS keno_stakes (
                id               SERIAL PRIMARY KEY,
                wallet           VARCHAR(42)    NOT NULL,
                reward_id        INTEGER,
                course_id        INTEGER,
                principal_keno   DECIMAL(18,8)  NOT NULL,
                staked_at        TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
                lock_expires_at  TIMESTAMP      NOT NULL,
                vest_started_at  TIMESTAMP,
                claimed_keno     DECIMAL(18,8)  DEFAULT 0,
                status           VARCHAR(20)    DEFAULT 'locked',
                created_at       TIMESTAMP      DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await this.db.query(`
            CREATE TABLE IF NOT EXISTS keno_fal_loans (
                id               SERIAL PRIMARY KEY,
                wallet           VARCHAR(42)    NOT NULL,
                stake_id         INTEGER        REFERENCES keno_stakes(id),
                loan_keno        DECIMAL(18,8)  NOT NULL,
                collateral_keno  DECIMAL(18,8)  NOT NULL,
                fee_keno         DECIMAL(18,8)  NOT NULL,
                repay_total      DECIMAL(18,8)  NOT NULL,
                status           VARCHAR(20)    DEFAULT 'active',
                created_at       TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
                due_at           TIMESTAMP      NOT NULL,
                repaid_at        TIMESTAMP
            )
        `);

        console.log('✅ KenoVestingManager tables ready');
    }

    // ─── LAYER 1: Auto-stake course reward ───────────────────────────────────
    async autoStakeReward(wallet, amountKeno, rewardId, courseId) {
        try {
            const normalizedWallet = wallet.toLowerCase();
            const lockExpires = new Date(Date.now() + LOCK_DAYS * MS_PER_DAY);

            const result = await this.db.query(`
                INSERT INTO keno_stakes
                    (wallet, reward_id, course_id, principal_keno, lock_expires_at, status)
                VALUES ($1, $2, $3, $4, $5, 'locked')
                RETURNING *
            `, [normalizedWallet, rewardId || null, courseId || null, amountKeno, lockExpires]);

            const stake = result.rows[0];

            console.log(`🔒 Auto-staked ${amountKeno} KENO for ${normalizedWallet} — unlocks ${lockExpires.toDateString()}`);

            return {
                success: true,
                stake,
                message: `${amountKeno} KENO auto-staked for 90 days at 15% APY. ` +
                         `Vesting begins ${lockExpires.toDateString()} — 10 KENO/month for 25 months.`,
                details: {
                    lockedUntil:       lockExpires,
                    vestingSchedule:   `${VEST_PER_MONTH} KENO/month × ${VEST_MONTHS} months`,
                    projectedAPYBonus: parseFloat(continuousEarnings(amountKeno, STAKE_APY, 90 / 365).toFixed(4)),
                    falCapacity:       parseFloat((amountKeno * MAX_LTV).toFixed(4))
                }
            };
        } catch (err) {
            console.error('❌ autoStakeReward error:', err.message);
            return { success: false, error: err.message };
        }
    }

    // ─── LAYER 1 + 2: Full staking dashboard for a wallet ────────────────────
    async getStakingStatus(wallet) {
        try {
            const normalizedWallet = wallet.toLowerCase();
            const now = new Date();

            const stakesRes = await this.db.query(`
                SELECT * FROM keno_stakes
                WHERE wallet = $1
                ORDER BY staked_at DESC
            `, [normalizedWallet]);

            const loansRes = await this.db.query(`
                SELECT * FROM keno_fal_loans
                WHERE wallet = $1 AND status = 'active'
                ORDER BY created_at DESC
            `, [normalizedWallet]);

            let totalLocked    = 0;
            let totalVesting   = 0;
            let totalClaimable = 0;
            let totalEarned    = 0;
            let totalPrincipal = 0;

            const stakes = stakesRes.rows.map(s => {
                const principal    = parseFloat(s.principal_keno);
                const stakedAt     = new Date(s.staked_at);
                const lockExpires  = new Date(s.lock_expires_at);
                const claimed      = parseFloat(s.claimed_keno);

                totalPrincipal += principal;

                // Euler APY on the full principal since staking
                const yearsStaked  = (now - stakedAt) / (365 * MS_PER_DAY);
                const apyEarnings  = continuousEarnings(principal, STAKE_APY, yearsStaked);
                totalEarned       += apyEarnings;

                let status         = s.status;
                let claimableKeno  = 0;

                if (status === 'locked' && now >= lockExpires) {
                    status = 'vesting';
                }

                if (status === 'locked') {
                    totalLocked += principal - claimed;
                } else {
                    // Vesting: 10 KENO/month from lock expiry
                    const vestStart    = new Date(s.vest_started_at || lockExpires);
                    const monthsVested = Math.floor((now - vestStart) / MS_PER_MONTH);
                    const totalVested  = Math.min(principal, monthsVested * VEST_PER_MONTH);
                    claimableKeno      = Math.max(0, totalVested - claimed);
                    const stillVesting = principal - totalVested;

                    totalClaimable += claimableKeno;
                    totalVesting   += stillVesting;
                }

                const daysUntilUnlock = status === 'locked'
                    ? Math.ceil((lockExpires - now) / MS_PER_DAY)
                    : 0;

                return {
                    id:              s.id,
                    courseId:        s.course_id,
                    principal:       principal,
                    claimed:         claimed,
                    claimable:       parseFloat(claimableKeno.toFixed(4)),
                    status,
                    lockedUntil:     lockExpires,
                    daysUntilUnlock: Math.max(0, daysUntilUnlock),
                    apyEarnings:     parseFloat(apyEarnings.toFixed(4))
                };
            });

            // FAL capacity: 50% of (locked + vesting) KENO
            const eligibleCollateral = totalLocked + totalVesting;
            const activeLoanTotal    = loansRes.rows.reduce((s, l) => s + parseFloat(l.loan_keno), 0);
            const falCapacity        = Math.max(0, (eligibleCollateral * MAX_LTV) - activeLoanTotal);

            // Kaprekar absorb on summary totals — dust flows to claimable
            const [absLocked, absVesting, absClaimable] = absorb(
                totalPrincipal - parseFloat((totalEarned).toFixed(4)),
                [totalLocked, totalVesting, totalClaimable].map(v => v / (totalPrincipal || 1))
            );

            return {
                success:          true,
                wallet:           normalizedWallet,
                summary: {
                    totalPrincipal:    parseFloat(totalPrincipal.toFixed(4)),
                    totalLocked:       parseFloat(totalLocked.toFixed(4)),
                    totalVesting:      parseFloat(totalVesting.toFixed(4)),
                    totalClaimable:    parseFloat(totalClaimable.toFixed(4)),
                    totalAPYEarnings:  parseFloat(totalEarned.toFixed(4)),
                    falCapacityKeno:   parseFloat(falCapacity.toFixed(4)),
                    activeLoans:       loansRes.rows.length
                },
                stakes,
                activeLoans:      loansRes.rows,
                explanation: {
                    locked:    'Locked for 90 days — earning 15% APY. Cannot sell yet (pool protected).',
                    vesting:   'Lock expired — unlocks 10 KENO/month for 25 months.',
                    claimable: 'Ready to claim. Or borrow against it instead of selling.',
                    fal:       `You can borrow up to ${parseFloat(falCapacity.toFixed(2))} KENO against your stake — without selling.`
                }
            };
        } catch (err) {
            console.error('❌ getStakingStatus error:', err.message);
            return { success: false, error: err.message };
        }
    }

    // ─── LAYER 2: Claim vested KENO ──────────────────────────────────────────
    async claimVested(wallet, requestedAmount) {
        try {
            const normalizedWallet = wallet.toLowerCase();
            const now = new Date();

            const stakesRes = await this.db.query(`
                SELECT * FROM keno_stakes
                WHERE wallet = $1
                AND (status = 'vesting' OR (status = 'locked' AND lock_expires_at <= $2))
                ORDER BY staked_at ASC
            `, [normalizedWallet, now]);

            if (stakesRes.rows.length === 0) {
                return { success: false, error: 'No vesting stakes found. Stakes must complete their 90-day lock first.' };
            }

            let remaining = parseFloat(requestedAmount);
            let totalClaimed = 0;
            const claimedFrom = [];

            for (const s of stakesRes.rows) {
                if (remaining <= 0) break;

                const principal   = parseFloat(s.principal_keno);
                const claimed     = parseFloat(s.claimed_keno);
                const lockExpires = new Date(s.lock_expires_at);
                const vestStart   = new Date(s.vest_started_at || lockExpires);
                const monthsVested = Math.floor((now - vestStart) / MS_PER_MONTH);
                const totalVested  = Math.min(principal, monthsVested * VEST_PER_MONTH);
                const claimable    = Math.max(0, totalVested - claimed);

                if (claimable <= 0) continue;

                const toClaimFromThis = Math.min(claimable, remaining);

                await this.db.query(`
                    UPDATE keno_stakes
                    SET claimed_keno = claimed_keno + $1,
                        status = CASE
                            WHEN claimed_keno + $1 >= principal_keno THEN 'completed'
                            ELSE 'vesting'
                        END,
                        vest_started_at = COALESCE(vest_started_at, $2)
                    WHERE id = $3
                `, [toClaimFromThis, lockExpires, s.id]);

                totalClaimed += toClaimFromThis;
                remaining    -= toClaimFromThis;
                claimedFrom.push({ stakeId: s.id, courseId: s.course_id, amount: parseFloat(toClaimFromThis.toFixed(4)) });
            }

            if (totalClaimed === 0) {
                return {
                    success: false,
                    error:   'No KENO is claimable yet. Vesting releases 10 KENO/month after the 90-day lock.',
                };
            }

            console.log(`💸 Claimed ${totalClaimed.toFixed(4)} KENO for ${normalizedWallet}`);

            return {
                success:      true,
                claimed:      parseFloat(totalClaimed.toFixed(4)),
                claimedFrom,
                message:      `✅ ${totalClaimed.toFixed(2)} KENO claimed! Remember: the sovereign move is to borrow, not sell — your KENO keeps growing.`
            };
        } catch (err) {
            console.error('❌ claimVested error:', err.message);
            return { success: false, error: err.message };
        }
    }

    // ─── LAYER 3: Borrow against staked KENO (FAL collateral) ────────────────
    async borrowAgainstStake(wallet, loanAmountKeno) {
        try {
            const normalizedWallet = wallet.toLowerCase();
            const loanAmount       = parseFloat(loanAmountKeno);

            if (!loanAmount || loanAmount <= 0) {
                return { success: false, error: 'Loan amount must be greater than 0' };
            }

            // Check existing active loans
            const existingLoan = await this.db.query(`
                SELECT id FROM keno_fal_loans
                WHERE wallet = $1 AND status = 'active'
            `, [normalizedWallet]);

            if (existingLoan.rows.length > 0) {
                return { success: false, error: 'You have an active FAL loan. Repay it before borrowing again.' };
            }

            // Calculate total eligible collateral (locked + vesting principal)
            const stakesRes = await this.db.query(`
                SELECT id, principal_keno, claimed_keno
                FROM keno_stakes
                WHERE wallet = $1 AND status IN ('locked', 'vesting')
            `, [normalizedWallet]);

            const totalCollateral = stakesRes.rows.reduce((sum, s) => {
                return sum + parseFloat(s.principal_keno) - parseFloat(s.claimed_keno);
            }, 0);

            const maxLoan = totalCollateral * MAX_LTV;

            if (loanAmount > maxLoan) {
                return {
                    success:       false,
                    error:         `Max loan is ${maxLoan.toFixed(2)} KENO (50% of your ${totalCollateral.toFixed(2)} KENO staked).`,
                    maxLoanKeno:   parseFloat(maxLoan.toFixed(4)),
                    collateralKeno: parseFloat(totalCollateral.toFixed(4))
                };
            }

            if (totalCollateral === 0) {
                return { success: false, error: 'No staked KENO to borrow against. Complete courses first.' };
            }

            const feeKeno   = parseFloat((loanAmount * FAL_FEE_RATE).toFixed(8));
            const repayTotal = parseFloat((loanAmount + feeKeno).toFixed(8));
            const dueAt      = new Date(Date.now() + 30 * MS_PER_DAY);

            const result = await this.db.query(`
                INSERT INTO keno_fal_loans
                    (wallet, loan_keno, collateral_keno, fee_keno, repay_total, due_at, status)
                VALUES ($1, $2, $3, $4, $5, $6, 'active')
                RETURNING *
            `, [normalizedWallet, loanAmount, totalCollateral, feeKeno, repayTotal, dueAt]);

            console.log(`⚡ FAL collateral loan: ${loanAmount} KENO to ${normalizedWallet} (backed by ${totalCollateral.toFixed(2)} KENO stake)`);

            return {
                success:        true,
                loan:           result.rows[0],
                message:        `✅ Borrowed ${loanAmount} KENO against your staked position. Repay ${repayTotal.toFixed(2)} KENO by ${dueAt.toDateString()}.`,
                breakdown: {
                    borrowed:       loanAmount,
                    fee5pct:        feeKeno,
                    repayBy:        dueAt,
                    repayTotal:     repayTotal,
                    collateralAt:   parseFloat(totalCollateral.toFixed(4)),
                    ltv:            `${(loanAmount / totalCollateral * 100).toFixed(1)}%`,
                    note:           'Your staked KENO keeps earning 15% APY while the loan is active. You did not sell.'
                }
            };
        } catch (err) {
            console.error('❌ borrowAgainstStake error:', err.message);
            return { success: false, error: err.message };
        }
    }

    // ─── LAYER 3: Repay FAL collateral loan ──────────────────────────────────
    async repayFalLoan(wallet, loanId) {
        try {
            const normalizedWallet = wallet.toLowerCase();

            const loanRes = await this.db.query(`
                SELECT * FROM keno_fal_loans
                WHERE id = $1 AND wallet = $2 AND status = 'active'
            `, [loanId, normalizedWallet]);

            if (loanRes.rows.length === 0) {
                return { success: false, error: 'Active loan not found for this wallet.' };
            }

            const loan = loanRes.rows[0];

            await this.db.query(`
                UPDATE keno_fal_loans
                SET status = 'repaid', repaid_at = CURRENT_TIMESTAMP
                WHERE id = $1
            `, [loanId]);

            console.log(`✅ FAL loan repaid: ${loan.repay_total} KENO by ${normalizedWallet}`);

            return {
                success:     true,
                loanId,
                repaid:      parseFloat(loan.repay_total),
                message:     `✅ Loan repaid! ${loan.repay_total} KENO returned. Your full stake is now free as collateral again.`,
                collateral:  parseFloat(loan.collateral_keno)
            };
        } catch (err) {
            console.error('❌ repayFalLoan error:', err.message);
            return { success: false, error: err.message };
        }
    }
}

module.exports = KenoVestingManager;
