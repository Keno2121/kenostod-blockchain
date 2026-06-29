const { convergenceSteps } = require('./Kaprekar');
const { continuousEarnings, toContinuousRate, naturalDecay } = require('./Euler');
const { phiMultiplier } = require('./GoldenRatio');

class MerchantIncentives {
    constructor(blockchain) {
        this.blockchain = blockchain;
        
        this.merchantStakes = new Map();
        this.walletStakes = new Map();
        this.rewardsPool = new Map();
        this.claimedRewards = new Map();
        this.tierBenefits = this.defineTierBenefits();
        
        this.STAKING_INTERVAL = 30 * 24 * 60 * 60 * 1000;
        
        setInterval(() => this.distributeStakingRewards(), 60000);
    }

    defineTierBenefits() {
        return {
            BRONZE: {
                name: 'Bronze',
                minStake: 0,
                maxStake: 10000,
                transactionFee: 0.01,
                cashbackRate: 0.02,
                stakingAPY: 0.12,
                color: '#CD7F32',
                perks: [
                    '1% transaction fee (vs 3% USD)',
                    '2% cashback on all KENO sales',
                    '12% APY staking rewards',
                    'Instant settlement',
                    'Priority support'
                ]
            },
            SILVER: {
                name: 'Silver',
                minStake: 10000,
                maxStake: 100000,
                transactionFee: 0.0075,
                cashbackRate: 0.03,
                stakingAPY: 0.15,
                color: '#C0C0C0',
                perks: [
                    '0.75% transaction fee (vs 3% USD)',
                    '3% cashback on all KENO sales',
                    '15% APY staking rewards',
                    'Instant settlement',
                    'Featured merchant listing',
                    'Marketing support',
                    'API rate limit boost'
                ]
            },
            GOLD: {
                name: 'Gold',
                minStake: 100000,
                maxStake: 500000,
                transactionFee: 0.005,
                cashbackRate: 0.04,
                stakingAPY: 0.18,
                color: '#FFD700',
                perks: [
                    '0.5% transaction fee (vs 3% USD)',
                    '4% cashback on all KENO sales',
                    '18% APY staking rewards',
                    'Instant settlement',
                    'Premium merchant badge',
                    'Dedicated account manager',
                    'Custom integration support',
                    'Early access to new features'
                ]
            },
            PLATINUM: {
                name: 'Platinum',
                minStake: 500000,
                maxStake: Infinity,
                transactionFee: 0.0025,
                cashbackRate: 0.05,
                stakingAPY: 0.24,
                color: '#E5E4E2',
                perks: [
                    '0.25% transaction fee (vs 3% USD)',
                    '5% cashback on all KENO sales',
                    '24% APY staking rewards',
                    'Instant settlement',
                    'Elite merchant status',
                    'Revenue share program',
                    'White-label solutions',
                    'Governance voting rights',
                    'VIP events & networking'
                ]
            }
        };
    }

    getMerchantTier(stakedAmount) {
        if (stakedAmount >= this.tierBenefits.PLATINUM.minStake) return 'PLATINUM';
        if (stakedAmount >= this.tierBenefits.GOLD.minStake) return 'GOLD';
        if (stakedAmount >= this.tierBenefits.SILVER.minStake) return 'SILVER';
        return 'BRONZE';
    }

    getAvailableBalance(merchantAddress) {
        const totalBalance = this.blockchain.getBalanceOfAddress(merchantAddress);
        
        let stakedAmount = 0;
        for (const stake of this.merchantStakes.values()) {
            if (stake.merchantAddress === merchantAddress) {
                stakedAmount += stake.stakedAmount;
            }
        }
        
        return {
            totalBalance,
            stakedAmount,
            availableBalance: totalBalance - stakedAmount
        };
    }

    getStakeByAddress(merchantAddress) {
        for (const stake of this.merchantStakes.values()) {
            if (stake.merchantAddress === merchantAddress) {
                return stake;
            }
        }
        return null;
    }

    stakeMerchantKENO(merchantId, amount, merchantAddress) {
        if (amount <= 0) {
            return { success: false, error: 'Stake amount must be positive' };
        }

        const currentStake = this.merchantStakes.get(merchantId);
        
        if (currentStake && currentStake.merchantAddress !== merchantAddress) {
            return { success: false, error: 'Merchant ID is associated with a different wallet address' };
        }

        const balance = this.blockchain.getBalanceOfAddress(merchantAddress);
        const walletTotalStaked = this.walletStakes.get(merchantAddress) || 0;
        const availableBalance = balance - walletTotalStaked;
        
        if (availableBalance < amount) {
            return { 
                success: false, 
                error: `Insufficient available balance. You have ${balance} KENO total, ${walletTotalStaked} already staked across all merchants, ${availableBalance} available` 
            };
        }

        const stake = currentStake || {
            merchantId,
            merchantAddress,
            stakedAmount: 0,
            stakedAt: Date.now(),
            lastRewardClaim: Date.now(),
            totalRewardsEarned: 0
        };

        stake.stakedAmount += amount;
        stake.tier = this.getMerchantTier(stake.stakedAmount);
        stake.tierBenefits = this.tierBenefits[stake.tier];
        
        this.merchantStakes.set(merchantId, stake);
        this.walletStakes.set(merchantAddress, walletTotalStaked + amount);

        return {
            success: true,
            stake: stake,
            message: `Staked ${amount} KENO. New tier: ${stake.tier}`
        };
    }

    unstakeMerchantKENO(merchantId, amount) {
        const stake = this.merchantStakes.get(merchantId);
        if (!stake) {
            return { success: false, error: 'No stake found' };
        }

        if (amount > stake.stakedAmount) {
            return { success: false, error: 'Insufficient staked amount' };
        }

        this.claimStakingRewards(merchantId);

        stake.stakedAmount -= amount;
        stake.tier = this.getMerchantTier(stake.stakedAmount);
        stake.tierBenefits = this.tierBenefits[stake.tier];

        const walletTotal = this.walletStakes.get(stake.merchantAddress) || 0;
        this.walletStakes.set(stake.merchantAddress, Math.max(0, walletTotal - amount));

        return {
            success: true,
            stake,
            unstaked: amount,
            message: `Unstaked ${amount} KENO. New tier: ${stake.tier}`
        };
    }

    calculateStakingRewards(merchantId) {
        const stake = this.merchantStakes.get(merchantId);
        if (!stake || stake.stakedAmount === 0) {
            return 0;
        }

        const tier = this.validateAndGetTier(merchantId);
        const apy = this.tierBenefits[tier].stakingAPY;

        const timeStaked = Date.now() - stake.lastRewardClaim;
        const yearInMs = 365 * 24 * 60 * 60 * 1000;
        const timeRatio = timeStaked / yearInMs;

        // Euler: continuous compounding — mathematically maximum earnings
        const continuousRate = toContinuousRate(apy);
        const rewards = continuousEarnings(stake.stakedAmount, continuousRate, timeRatio);

        // Golden Ratio: φ multiplier rewards loyalty — grows silently toward φ
        const consecutiveWeeks = Math.floor(timeStaked / (7 * 24 * 60 * 60 * 1000));
        const phi = phiMultiplier(consecutiveWeeks);
        const sovereignRewards = parseFloat((rewards * phi).toFixed(6));

        return sovereignRewards;
    }

    claimStakingRewards(merchantId) {
        const rewards = this.calculateStakingRewards(merchantId);
        if (rewards === 0) {
            return { success: false, error: 'No rewards to claim' };
        }

        const stake = this.merchantStakes.get(merchantId);
        stake.lastRewardClaim = Date.now();
        stake.totalRewardsEarned += rewards;

        const currentRewards = this.rewardsPool.get(merchantId) || 0;
        this.rewardsPool.set(merchantId, currentRewards + rewards);

        return {
            success: true,
            rewards,
            totalEarned: stake.totalRewardsEarned,
            availableBalance: this.rewardsPool.get(merchantId)
        };
    }

    distributeStakingRewards() {
        for (const [merchantId, stake] of this.merchantStakes.entries()) {
            if (stake.stakedAmount > 0) {
                this.claimStakingRewards(merchantId);
            }
        }
    }

    validateAndGetTier(merchantId) {
        const stake = this.merchantStakes.get(merchantId);
        if (!stake) {
            return 'BRONZE';
        }

        const currentBalance = this.blockchain.getBalanceOfAddress(stake.merchantAddress);
        const walletTotalStaked = this.walletStakes.get(stake.merchantAddress) || 0;
        
        if (currentBalance < walletTotalStaked) {
            const merchantsWithThisWallet = [];
            for (const [mid, s] of this.merchantStakes.entries()) {
                if (s.merchantAddress === stake.merchantAddress) {
                    merchantsWithThisWallet.push({ merchantId: mid, stake: s });
                }
            }
            
            const reductionRatio = currentBalance / walletTotalStaked;
            let newWalletTotal = 0;
            
            for (const { merchantId: mid, stake: s } of merchantsWithThisWallet) {
                s.stakedAmount = parseFloat((s.stakedAmount * reductionRatio).toFixed(2));
                newWalletTotal += s.stakedAmount;
                s.tier = this.getMerchantTier(s.stakedAmount);
                s.tierBenefits = this.tierBenefits[s.tier];
            }
            
            this.walletStakes.set(stake.merchantAddress, newWalletTotal);
        }
        
        const tier = this.getMerchantTier(stake.stakedAmount);
        stake.tier = tier;
        return tier;
    }

    calculateCashback(merchantId, saleAmount) {
        const tier = this.validateAndGetTier(merchantId);
        const cashbackRate = this.tierBenefits[tier].cashbackRate;
        return parseFloat((saleAmount * cashbackRate).toFixed(2));
    }

    applyCashback(merchantId, saleAmount) {
        const cashback = this.calculateCashback(merchantId, saleAmount);
        
        const currentRewards = this.rewardsPool.get(merchantId) || 0;
        this.rewardsPool.set(merchantId, currentRewards + cashback);

        return {
            success: true,
            cashback,
            saleAmount,
            cashbackRate: this.calculateCashbackRate(merchantId),
            totalRewards: this.rewardsPool.get(merchantId)
        };
    }

    calculateCashbackRate(merchantId) {
        const tier = this.validateAndGetTier(merchantId);
        return this.tierBenefits[tier].cashbackRate;
    }

    getTransactionFee(merchantId) {
        const tier = this.validateAndGetTier(merchantId);
        return this.tierBenefits[tier].transactionFee;
    }

    withdrawRewards(merchantId, amount) {
        const available = this.rewardsPool.get(merchantId) || 0;
        
        if (amount > available) {
            return { success: false, error: 'Insufficient rewards balance' };
        }

        this.rewardsPool.set(merchantId, available - amount);
        
        const claimed = this.claimedRewards.get(merchantId) || 0;
        this.claimedRewards.set(merchantId, claimed + amount);

        return {
            success: true,
            withdrawn: amount,
            remaining: this.rewardsPool.get(merchantId),
            totalClaimed: this.claimedRewards.get(merchantId)
        };
    }

    getMerchantDashboard(merchantId) {
        const stake = this.merchantStakes.get(merchantId) || {
            merchantId,
            stakedAmount: 0,
            tier: 'BRONZE',
            tierBenefits: this.tierBenefits.BRONZE,
            totalRewardsEarned: 0
        };

        const tier = this.getMerchantTier(stake.stakedAmount);
        const pendingRewards = this.calculateStakingRewards(merchantId);
        const availableRewards = this.rewardsPool.get(merchantId) || 0;
        const totalClaimed = this.claimedRewards.get(merchantId) || 0;

        return {
            merchantId,
            currentTier: tier,
            tierBenefits: this.tierBenefits[tier],
            staking: {
                stakedAmount: stake.stakedAmount,
                stakingAPY: this.tierBenefits[tier].stakingAPY,
                pendingRewards,
                totalEarned: stake.totalRewardsEarned
            },
            rewards: {
                available: availableRewards,
                pending: pendingRewards,
                totalClaimed,
                lifetimeEarnings: stake.totalRewardsEarned + availableRewards
            },
            benefits: {
                transactionFee: this.tierBenefits[tier].transactionFee,
                cashbackRate: this.tierBenefits[tier].cashbackRate,
                savingsVsUSD: this.calculateSavingsVsUSD(tier)
            },
            nextTier: this.getNextTier(tier),
            allTiers: this.tierBenefits
        };
    }

    calculateSavingsVsUSD(tier) {
        const kenoFee = this.tierBenefits[tier].transactionFee;
        const usdFee = 0.029;
        const savingsPercent = ((usdFee - kenoFee) / usdFee) * 100;

        return {
            kenoFee: `${(kenoFee * 100).toFixed(2)}%`,
            usdFee: '2.9%',
            savingsPercent: `${savingsPercent.toFixed(1)}%`,
            on10kSales: `$${((usdFee - kenoFee) * 10000).toFixed(2)}`
        };
    }

    getNextTier(currentTier) {
        const tiers = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'];
        const currentIndex = tiers.indexOf(currentTier);
        
        if (currentIndex === tiers.length - 1) {
            return null;
        }

        const nextTier = tiers[currentIndex + 1];
        return {
            name: nextTier,
            requiredStake: this.tierBenefits[nextTier].minStake,
            benefits: this.tierBenefits[nextTier]
        };
    }

    getGlobalStats() {
        let totalStaked = 0;
        let totalRewardsDistributed = 0;
        const tierDistribution = { BRONZE: 0, SILVER: 0, GOLD: 0, PLATINUM: 0 };

        for (const stake of this.merchantStakes.values()) {
            totalStaked += stake.stakedAmount;
            totalRewardsDistributed += stake.totalRewardsEarned;
            tierDistribution[stake.tier]++;
        }

        return {
            totalMerchants: this.merchantStakes.size,
            totalStaked,
            totalRewardsDistributed,
            tierDistribution,
            averageStake: this.merchantStakes.size > 0 ? totalStaked / this.merchantStakes.size : 0
        };
    }
}

module.exports = MerchantIncentives;
