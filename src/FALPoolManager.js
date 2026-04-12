const CryptoJS = require('crypto-js');
const { absorb, convergenceSteps } = require('./Kaprekar');

class FALPoolManager {
    constructor(blockchain, dataPersistence, arbitrageSystem) {
        this.blockchain = blockchain;
        this.dataPersistence = dataPersistence;
        this.arbitrageSystem = arbitrageSystem;
        
        this.pools = new Map();
        this.poolContributions = new Map();
        this.poolLoans = new Map();
        this.poolHistory = [];
        this.contributorProfiles = new Map();
        this.treasuryBalance = 0;
        this.treasuryAddress = '0x3B3538b955647d811D42400084e9409e6593bE97';
        this.treasuryHistory = [];
        
        this.config = {
            minPoolDeposit: 100,
            maxPoolSize: 1000000,
            minPoolSize: 1000,
            poolFeePercentage: 5,
            platformFeePercentage: 1,
            defaultAPY: 15,
            lockPeriods: {
                flexible: { days: 0, bonusMultiplier: 1.0 },
                short: { days: 7, bonusMultiplier: 1.25 },
                medium: { days: 30, bonusMultiplier: 1.5 },
                long: { days: 90, bonusMultiplier: 2.0 }
            },
            riskLevels: {
                conservative: { maxLoanPercent: 25, profitShare: 60 },
                balanced: { maxLoanPercent: 50, profitShare: 70 },
                aggressive: { maxLoanPercent: 75, profitShare: 80 }
            }
        };
        
        this.initializeSystem();
    }
    
    initializeSystem() {
        this.loadPersistedData();
        console.log('🏊 Flash Arbitrage Loan Pool (FALP) System initialized');
        console.log('   💧 Liquidity Pools active');
        console.log('   📊 Profit Distribution Engine active');
        console.log('   🎯 Multi-tier Risk Management active');
        console.log('   💰 Contributor Rewards active');
    }
    
    loadPersistedData() {
        const savedData = this.dataPersistence.load('fal_pools');
        if (savedData) {
            this.pools = new Map(savedData.pools || []);
            this.poolContributions = new Map(savedData.poolContributions || []);
            this.poolLoans = new Map(savedData.poolLoans || []);
            this.poolHistory = savedData.poolHistory || [];
            this.contributorProfiles = new Map(savedData.contributorProfiles || []);
            this.treasuryBalance = savedData.treasuryBalance || 0;
            this.treasuryHistory = savedData.treasuryHistory || [];
            console.log(`✅ Loaded ${this.pools.size} FAL pools from disk`);
            console.log(`✅ Loaded ${this.contributorProfiles.size} pool contributor profiles`);
            console.log(`✅ Treasury balance: ${this.treasuryBalance.toFixed(2)} KENO`);
        }
    }
    
    persistData() {
        this.dataPersistence.save('fal_pools', {
            pools: Array.from(this.pools.entries()),
            poolContributions: Array.from(this.poolContributions.entries()),
            poolLoans: Array.from(this.poolLoans.entries()),
            poolHistory: this.poolHistory,
            contributorProfiles: Array.from(this.contributorProfiles.entries()),
            treasuryBalance: this.treasuryBalance,
            treasuryHistory: this.treasuryHistory,
            lastSaved: new Date().toISOString()
        });
    }
    
    generatePoolId() {
        return 'FALP-' + CryptoJS.SHA256(Date.now().toString() + Math.random().toString()).toString().substring(0, 12).toUpperCase();
    }
    
    generateContributionId() {
        return 'CONTRIB-' + CryptoJS.SHA256(Date.now().toString() + Math.random().toString()).toString().substring(0, 10).toUpperCase();
    }
    
    createPool(creatorWallet, poolName, riskLevel = 'balanced', lockPeriod = 'flexible', initialDeposit = 0) {
        if (!creatorWallet || !poolName) {
            return { success: false, error: 'Creator wallet and pool name are required' };
        }
        
        if (!this.config.riskLevels[riskLevel]) {
            return { success: false, error: 'Invalid risk level. Choose: conservative, balanced, or aggressive' };
        }
        
        if (!this.config.lockPeriods[lockPeriod]) {
            return { success: false, error: 'Invalid lock period. Choose: flexible, short, medium, or long' };
        }
        
        if (initialDeposit > 0 && initialDeposit < this.config.minPoolDeposit) {
            return { success: false, error: `Minimum deposit is ${this.config.minPoolDeposit} KENO` };
        }
        
        const poolId = this.generatePoolId();
        const riskConfig = this.config.riskLevels[riskLevel];
        const lockConfig = this.config.lockPeriods[lockPeriod];
        
        const pool = {
            id: poolId,
            name: poolName,
            creatorWallet,
            riskLevel,
            lockPeriod,
            riskConfig,
            lockConfig,
            totalLiquidity: initialDeposit,
            availableLiquidity: initialDeposit,
            lockedLiquidity: 0,
            totalContributors: initialDeposit > 0 ? 1 : 0,
            totalLoansIssued: 0,
            totalProfitGenerated: 0,
            totalProfitDistributed: 0,
            activeLoans: 0,
            successRate: 100,
            estimatedAPY: this.config.defaultAPY * lockConfig.bonusMultiplier,
            status: 'active',
            createdAt: Date.now(),
            lastActivityAt: Date.now(),
            contributors: []
        };
        
        this.pools.set(poolId, pool);
        
        if (initialDeposit > 0) {
            const contributionId = this.generateContributionId();
            const contribution = {
                id: contributionId,
                poolId,
                walletAddress: creatorWallet,
                amount: initialDeposit,
                lockPeriod,
                lockedUntil: lockPeriod === 'flexible' ? null : Date.now() + (lockConfig.days * 24 * 60 * 60 * 1000),
                sharePercentage: 100,
                totalEarned: 0,
                depositedAt: Date.now(),
                status: 'active'
            };
            
            this.poolContributions.set(contributionId, contribution);
            pool.contributors.push(contributionId);
            
            this.updateContributorProfile(creatorWallet, initialDeposit, poolId);
        }
        
        this.persistData();
        
        console.log(`🏊 New FAL Pool created: ${poolName} (${poolId}) with ${initialDeposit} KENO`);
        
        return {
            success: true,
            poolId,
            pool,
            message: `Pool "${poolName}" created successfully! ${initialDeposit > 0 ? `Initial deposit: ${initialDeposit} KENO` : 'Ready for deposits.'}`
        };
    }
    
    depositToPool(poolId, walletAddress, amount, lockPeriod = null) {
        const pool = this.pools.get(poolId);
        
        if (!pool) {
            return { success: false, error: 'Pool not found' };
        }
        
        if (pool.status !== 'active') {
            return { success: false, error: 'Pool is not accepting deposits' };
        }
        
        if (amount < this.config.minPoolDeposit) {
            return { success: false, error: `Minimum deposit is ${this.config.minPoolDeposit} KENO` };
        }
        
        if (pool.totalLiquidity + amount > this.config.maxPoolSize) {
            return { success: false, error: `Deposit would exceed pool maximum size of ${this.config.maxPoolSize} KENO` };
        }
        
        const useLockPeriod = lockPeriod || pool.lockPeriod;
        const lockConfig = this.config.lockPeriods[useLockPeriod];
        
        const contributionId = this.generateContributionId();
        const contribution = {
            id: contributionId,
            poolId,
            walletAddress,
            amount,
            lockPeriod: useLockPeriod,
            lockedUntil: useLockPeriod === 'flexible' ? null : Date.now() + (lockConfig.days * 24 * 60 * 60 * 1000),
            sharePercentage: 0,
            totalEarned: 0,
            depositedAt: Date.now(),
            status: 'active'
        };
        
        this.poolContributions.set(contributionId, contribution);
        pool.contributors.push(contributionId);
        pool.totalLiquidity += amount;
        pool.availableLiquidity += amount;
        pool.totalContributors = new Set(pool.contributors.map(cid => this.poolContributions.get(cid)?.walletAddress)).size;
        pool.lastActivityAt = Date.now();
        
        this.recalculateSharePercentages(poolId);
        this.updateContributorProfile(walletAddress, amount, poolId);
        this.persistData();
        
        console.log(`💧 Deposit to pool ${pool.name}: ${amount} KENO from ${walletAddress.substring(0, 20)}...`);
        
        return {
            success: true,
            contributionId,
            poolId,
            amount,
            sharePercentage: contribution.sharePercentage,
            estimatedAPY: pool.estimatedAPY,
            message: `Successfully deposited ${amount} KENO to pool "${pool.name}". Your share: ${contribution.sharePercentage.toFixed(2)}%`
        };
    }
    
    withdrawFromPool(contributionId, walletAddress, amount = null, signature = null, timestamp = null) {
        const contribution = this.poolContributions.get(contributionId);
        
        if (!contribution) {
            return { success: false, error: 'Contribution not found' };
        }
        
        if (contribution.walletAddress !== walletAddress) {
            return { success: false, error: 'Unauthorized withdrawal attempt' };
        }
        
        if (contribution.status !== 'active') {
            return { success: false, error: 'Contribution is not active' };
        }
        
        if (contribution.lockedUntil && Date.now() < contribution.lockedUntil) {
            const remainingDays = Math.ceil((contribution.lockedUntil - Date.now()) / (24 * 60 * 60 * 1000));
            return { success: false, error: `Funds are locked for ${remainingDays} more days` };
        }
        
        const pool = this.pools.get(contribution.poolId);
        if (!pool) {
            return { success: false, error: 'Pool not found' };
        }
        
        if (pool.activeLoans > 0) {
            const lockedByLoans = pool.lockedLiquidity;
            const contributorLockedShare = lockedByLoans * (contribution.sharePercentage / 100);
            const maxWithdrawable = contribution.amount - contributorLockedShare;
            
            if (maxWithdrawable <= 0) {
                return { success: false, error: 'Your funds are currently locked in active loans. Wait for loans to be repaid.' };
            }
        }
        
        const withdrawAmount = amount || contribution.amount;
        
        if (withdrawAmount > contribution.amount) {
            return { success: false, error: 'Withdrawal amount exceeds your contribution' };
        }
        
        if (withdrawAmount > pool.availableLiquidity) {
            return { success: false, error: 'Insufficient available liquidity. Try a smaller amount or wait for active loans to be repaid.' };
        }
        
        const earnings = contribution.totalEarned;
        const totalWithdrawal = withdrawAmount + earnings;
        
        contribution.amount -= withdrawAmount;
        contribution.totalEarned = 0;
        pool.totalLiquidity -= withdrawAmount;
        pool.availableLiquidity -= withdrawAmount;
        pool.lastActivityAt = Date.now();
        
        if (contribution.amount === 0) {
            contribution.status = 'withdrawn';
            pool.contributors = pool.contributors.filter(cid => cid !== contributionId);
            pool.totalContributors = new Set(pool.contributors.map(cid => this.poolContributions.get(cid)?.walletAddress)).size;
        }
        
        this.recalculateSharePercentages(contribution.poolId);
        this.persistData();
        
        console.log(`💸 Withdrawal from pool ${pool.name}: ${totalWithdrawal} KENO to ${walletAddress.substring(0, 20)}...`);
        
        return {
            success: true,
            withdrawnPrincipal: withdrawAmount,
            withdrawnEarnings: earnings,
            totalWithdrawn: totalWithdrawal,
            remainingContribution: contribution.amount,
            message: `Withdrew ${withdrawAmount} KENO + ${earnings.toFixed(2)} KENO earnings = ${totalWithdrawal.toFixed(2)} KENO total`
        };
    }
    
    borrowFromPool(poolId, borrowerWallet, amount, arbitrageOpportunityId = null) {
        const pool = this.pools.get(poolId);
        
        if (!pool) {
            return { success: false, error: 'Pool not found' };
        }
        
        if (pool.status !== 'active') {
            return { success: false, error: 'Pool is not active' };
        }
        
        const maxBorrowable = pool.availableLiquidity * (pool.riskConfig.maxLoanPercent / 100);
        
        if (amount > maxBorrowable) {
            return { success: false, error: `Maximum borrowable amount is ${maxBorrowable.toFixed(2)} KENO (${pool.riskConfig.maxLoanPercent}% of available liquidity)` };
        }
        
        if (amount < this.config.minPoolDeposit) {
            return { success: false, error: `Minimum loan amount is ${this.config.minPoolDeposit} KENO` };
        }
        
        const trader = this.arbitrageSystem?.getOrCreateTrader(borrowerWallet);
        if (trader && trader.defaultedLoans > trader.successfulLoans) {
            return { success: false, error: 'Your loan default rate is too high. Complete more successful trades first.' };
        }
        
        const existingLoan = Array.from(this.poolLoans.values()).find(
            loan => loan.borrowerWallet === borrowerWallet && loan.status === 'active'
        );
        if (existingLoan) {
            return { success: false, error: 'You already have an active pool loan. Repay it first.' };
        }
        
        const loanId = 'PLOAN-' + CryptoJS.SHA256(Date.now().toString() + Math.random().toString()).toString().substring(0, 10).toUpperCase();
        
        const loan = {
            id: loanId,
            poolId,
            borrowerWallet,
            amount,
            arbitrageOpportunityId,
            platformFee: amount * (this.config.platformFeePercentage / 100),
            poolFee: amount * (this.config.poolFeePercentage / 100),
            timestamp: Date.now(),
            expiresAt: Date.now() + 300000,
            status: 'active',
            repaid: false,
            profit: 0,
            profitDistributed: false
        };
        
        this.poolLoans.set(loanId, loan);
        
        pool.availableLiquidity -= amount;
        pool.lockedLiquidity += amount;
        pool.activeLoans++;
        pool.totalLoansIssued++;
        pool.lastActivityAt = Date.now();
        
        this.persistData();
        
        console.log(`⚡ Pool loan issued: ${amount} KENO from ${pool.name} to ${borrowerWallet.substring(0, 20)}...`);
        
        return {
            success: true,
            loanId,
            poolId,
            poolName: pool.name,
            amount,
            expiresAt: loan.expiresAt,
            platformFee: loan.platformFee,
            poolFee: loan.poolFee,
            totalToRepay: amount + loan.platformFee + loan.poolFee,
            message: `Flash loan of ${amount} KENO from pool "${pool.name}" approved! Repay ${(amount + loan.platformFee + loan.poolFee).toFixed(2)} KENO within 5 minutes.`
        };
    }
    
    repayPoolLoan(loanId, borrowerWallet, actualProfit = 0) {
        const loan = this.poolLoans.get(loanId);
        
        if (!loan) {
            return { success: false, error: 'Loan not found' };
        }
        
        if (loan.borrowerWallet !== borrowerWallet) {
            return { success: false, error: 'Unauthorized repayment attempt' };
        }
        
        if (loan.repaid) {
            return { success: false, error: 'Loan already repaid' };
        }
        
        const pool = this.pools.get(loan.poolId);
        if (!pool) {
            return { success: false, error: 'Pool not found' };
        }
        
        const totalRepayment = loan.amount + loan.platformFee + loan.poolFee;
        
        pool.availableLiquidity += loan.amount + loan.poolFee;
        pool.lockedLiquidity -= loan.amount;
        pool.activeLoans--;
        pool.lastActivityAt = Date.now();
        
        loan.repaid = true;
        loan.status = 'completed';
        loan.profit = actualProfit;
        loan.repaidAt = Date.now();
        
        const profitToDistribute = loan.poolFee + (actualProfit > 0 ? actualProfit * (pool.riskConfig.profitShare / 100) : 0);
        
        if (profitToDistribute > 0) {
            this.distributeProfit(loan.poolId, profitToDistribute, loanId);
            pool.totalProfitGenerated += profitToDistribute;
        }
        
        this.treasuryBalance += loan.platformFee;
        this.treasuryHistory.push({
            type: 'falp_platform_fee',
            loanId,
            poolId: loan.poolId,
            amount: loan.platformFee,
            timestamp: Date.now(),
            note: '1% platform fee from FALP loan repayment'
        });
        
        this.poolHistory.push({
            type: 'loan_repaid',
            loanId,
            poolId: loan.poolId,
            amount: loan.amount,
            profit: actualProfit,
            profitDistributed: profitToDistribute,
            platformFeeToTreasury: loan.platformFee,
            timestamp: Date.now()
        });
        
        const totalLoans = pool.totalLoansIssued;
        const defaultedLoans = this.poolHistory.filter(h => h.poolId === loan.poolId && h.type === 'loan_defaulted').length;
        pool.successRate = ((totalLoans - defaultedLoans) / totalLoans) * 100;
        
        this.updatePoolAPY(loan.poolId);
        this.persistData();
        
        console.log(`✅ Pool loan repaid: ${loan.amount} KENO to ${pool.name}, profit distributed: ${profitToDistribute.toFixed(2)} KENO, treasury: +${loan.platformFee.toFixed(2)} KENO`);
        
        return {
            success: true,
            loanId,
            amountRepaid: totalRepayment,
            profitGenerated: actualProfit,
            profitDistributedToPool: profitToDistribute,
            platformFeeToTreasury: loan.platformFee,
            message: `Loan repaid! ${profitToDistribute.toFixed(2)} KENO distributed to pool contributors. ${loan.platformFee.toFixed(2)} KENO to treasury.`
        };
    }
    
    handlePoolLoanDefault(loan, pool) {
        loan.status = 'defaulted';
        loan.repaid = false;
        
        pool.lockedLiquidity -= loan.amount;
        pool.activeLoans--;
        pool.totalLiquidity -= loan.amount;
        pool.lastActivityAt = Date.now();
        
        const lossPerContributor = loan.amount / pool.contributors.length;
        pool.contributors.forEach(contributionId => {
            const contribution = this.poolContributions.get(contributionId);
            if (contribution && contribution.status === 'active') {
                const loss = Math.min(lossPerContributor * (contribution.sharePercentage / 100), contribution.amount);
                contribution.amount = Math.max(0, contribution.amount - loss);
            }
        });
        
        this.poolHistory.push({
            type: 'loan_defaulted',
            loanId: loan.id,
            poolId: loan.poolId,
            amount: loan.amount,
            timestamp: Date.now()
        });
        
        const totalLoans = pool.totalLoansIssued;
        const defaultedLoans = this.poolHistory.filter(h => h.poolId === loan.poolId && h.type === 'loan_defaulted').length;
        pool.successRate = ((totalLoans - defaultedLoans) / totalLoans) * 100;
        
        this.recalculateSharePercentages(loan.poolId);
        this.persistData();
        
        console.log(`❌ Pool loan defaulted: ${loan.amount} KENO from ${pool.name}`);
    }
    
    distributeProfit(poolId, profitAmount, loanId) {
        const pool = this.pools.get(poolId);
        if (!pool) return;

        // Collect active contributions for convergence-aware distribution
        const active = [];
        pool.contributors.forEach(contributionId => {
            const contribution = this.poolContributions.get(contributionId);
            if (contribution && contribution.status === 'active') active.push(contribution);
        });

        if (active.length > 0) {
            // Compute raw shares with lock bonus applied
            const rawShares = active.map(c => {
                const share = profitAmount * (c.sharePercentage / 100);
                const lockBonus = this.config.lockPeriods[c.lockPeriod]?.bonusMultiplier || 1.0;
                return share * lockBonus;
            });

            // Absorb dust: remainder flows to first contributor (largest share = most sovereign)
            const totalRaw = rawShares.reduce((a, b) => a + b, 0);
            const ratios = rawShares.map(s => s / (totalRaw || 1));
            const absorbed = absorb(profitAmount, ratios);

            absorbed.forEach((adjustedShare, i) => {
                const contribution = active[i];
                contribution.totalEarned += adjustedShare;
                const profile = this.getOrCreateContributorProfile(contribution.walletAddress);
                profile.totalEarnings += adjustedShare;
                profile._cv = convergenceSteps(adjustedShare);
            });
        }

        pool.totalProfitDistributed += profitAmount;
        
        this.poolHistory.push({
            type: 'profit_distributed',
            poolId,
            loanId,
            amount: profitAmount,
            timestamp: Date.now()
        });
    }
    
    recalculateSharePercentages(poolId) {
        const pool = this.pools.get(poolId);
        if (!pool || pool.totalLiquidity === 0) return;
        
        pool.contributors.forEach(contributionId => {
            const contribution = this.poolContributions.get(contributionId);
            if (contribution && contribution.status === 'active') {
                contribution.sharePercentage = (contribution.amount / pool.totalLiquidity) * 100;
            }
        });
    }
    
    updatePoolAPY(poolId) {
        const pool = this.pools.get(poolId);
        if (!pool) return;
        
        const poolAge = (Date.now() - pool.createdAt) / (365 * 24 * 60 * 60 * 1000);
        if (poolAge > 0 && pool.totalLiquidity > 0) {
            const annualizedProfit = (pool.totalProfitDistributed / poolAge) / pool.totalLiquidity * 100;
            pool.estimatedAPY = Math.max(annualizedProfit, this.config.defaultAPY);
        }
    }
    
    updateContributorProfile(walletAddress, depositAmount, poolId) {
        const profile = this.getOrCreateContributorProfile(walletAddress);
        profile.totalDeposited += depositAmount;
        profile.poolsContributed.add(poolId);
        profile.lastActivity = Date.now();
    }
    
    getOrCreateContributorProfile(walletAddress) {
        if (!this.contributorProfiles.has(walletAddress)) {
            this.contributorProfiles.set(walletAddress, {
                walletAddress,
                totalDeposited: 0,
                totalEarnings: 0,
                poolsContributed: new Set(),
                joinedAt: Date.now(),
                lastActivity: Date.now()
            });
        }
        return this.contributorProfiles.get(walletAddress);
    }
    
    getPool(poolId) {
        return this.pools.get(poolId);
    }
    
    getAllPools() {
        return Array.from(this.pools.values())
            .filter(pool => pool.status === 'active')
            .sort((a, b) => b.totalLiquidity - a.totalLiquidity);
    }
    
    getPoolLeaderboard() {
        return Array.from(this.pools.values())
            .filter(pool => pool.status === 'active')
            .map(pool => ({
                id: pool.id,
                name: pool.name,
                totalLiquidity: pool.totalLiquidity,
                totalContributors: pool.totalContributors,
                estimatedAPY: pool.estimatedAPY,
                successRate: pool.successRate,
                totalProfitDistributed: pool.totalProfitDistributed,
                riskLevel: pool.riskLevel
            }))
            .sort((a, b) => b.totalProfitDistributed - a.totalProfitDistributed)
            .slice(0, 20);
    }
    
    getContributorStats(walletAddress) {
        const contributions = Array.from(this.poolContributions.values())
            .filter(c => c.walletAddress === walletAddress);
        
        const activeContributions = contributions.filter(c => c.status === 'active');
        
        return {
            totalContributions: contributions.length,
            activeContributions: activeContributions.length,
            totalDeposited: activeContributions.reduce((sum, c) => sum + c.amount, 0),
            totalEarnings: activeContributions.reduce((sum, c) => sum + c.totalEarned, 0),
            contributions: contributions.map(c => ({
                id: c.id,
                poolId: c.poolId,
                poolName: this.pools.get(c.poolId)?.name || 'Unknown',
                amount: c.amount,
                sharePercentage: c.sharePercentage,
                totalEarned: c.totalEarned,
                lockPeriod: c.lockPeriod,
                lockedUntil: c.lockedUntil,
                status: c.status
            }))
        };
    }
    
    getTreasuryStats() {
        const totalCollected = this.treasuryHistory.reduce((sum, e) => sum + e.amount, 0);
        const recentHistory = this.treasuryHistory.slice(-20).reverse();
        return {
            balance: this.treasuryBalance,
            address: this.treasuryAddress,
            totalCollected,
            totalTransactions: this.treasuryHistory.length,
            recentHistory,
            feeStructure: {
                falpPlatformFee: `${this.config.platformFeePercentage}% of every FALP loan`,
                distribution: '60% stakers — 40% treasury',
                note: 'Platform fees self-fund the treasury without manual intervention'
            }
        };
    }

    getPoolStats(poolId) {
        const pool = this.pools.get(poolId);
        if (!pool) return null;
        
        const poolLoans = Array.from(this.poolLoans.values()).filter(l => l.poolId === poolId);
        const completedLoans = poolLoans.filter(l => l.status === 'completed');
        const activeLoans = poolLoans.filter(l => l.status === 'active');
        
        return {
            ...pool,
            totalLoans: poolLoans.length,
            completedLoans: completedLoans.length,
            activeLoansDetails: activeLoans,
            averageProfit: completedLoans.length > 0 
                ? completedLoans.reduce((sum, l) => sum + l.profit, 0) / completedLoans.length 
                : 0,
            contributorsDetails: pool.contributors.map(cid => {
                const c = this.poolContributions.get(cid);
                return c ? {
                    walletAddress: c.walletAddress.substring(0, 20) + '...',
                    amount: c.amount,
                    sharePercentage: c.sharePercentage,
                    totalEarned: c.totalEarned,
                    lockPeriod: c.lockPeriod
                } : null;
            }).filter(Boolean)
        };
    }
}

module.exports = FALPoolManager;
