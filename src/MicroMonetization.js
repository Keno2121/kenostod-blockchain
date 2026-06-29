class MicroMonetization {
    constructor(blockchain) {
        this.blockchain = blockchain;
        
        this.fees = {
            aiChatPremium: 1,
            aiChatAdvanced: 1,
            quizRetake: 5,
            featuredPost: 10,
            featuredPostDuration: 24 * 60 * 60 * 1000,
            poolCreation: 50,
            poolBoost: 20,
            poolBoostDuration: 24 * 60 * 60 * 1000,
            prioritySupport: 5,
            badgeMint: 25,
            tipPlatformFee: 0.05,
            arbitrageAlert: 2,
            mentorVerification: 25
        };
        
        this.freeAiQuestionsDaily = 5;
        this.userDailyUsage = new Map();
        
        this.featuredPosts = new Map();
        this.boostedPools = new Map();
        
        this.membershipTiers = {
            free: {
                name: 'Free',
                price: 0,
                aiQuestionsDaily: 5,
                arbitrageAlerts: 0,
                poolDiscount: 0,
                prioritySupport: false,
                advancedAnalytics: false
            },
            studentPro: {
                name: 'Student Pro',
                priceMonthly: 15,
                priceYearly: 150,
                aiQuestionsDaily: 50,
                arbitrageAlerts: 10,
                poolDiscount: 0.1,
                prioritySupport: false,
                advancedAnalytics: true
            },
            traderPro: {
                name: 'Trader Pro',
                priceMonthly: 30,
                priceYearly: 300,
                aiQuestionsDaily: 200,
                arbitrageAlerts: 50,
                poolDiscount: 0.2,
                prioritySupport: true,
                advancedAnalytics: true,
                arbitrageSimulator: true
            },
            graduateElite: {
                name: 'Graduate Elite',
                priceMonthly: 50,
                priceYearly: 500,
                aiQuestionsDaily: -1,
                arbitrageAlerts: -1,
                poolDiscount: 0.3,
                prioritySupport: true,
                advancedAnalytics: true,
                arbitrageSimulator: true,
                exclusivePools: true,
                mentorTools: true,
                earlyGiftAccess: true
            }
        };
        
        this.userMemberships = new Map();
        
        this.transactions = [];
        this.totalRevenue = {
            aiChat: 0,
            quizRetakes: 0,
            featuredPosts: 0,
            poolFees: 0,
            tips: 0,
            alerts: 0,
            badges: 0,
            memberships: 0,
            other: 0
        };
    }
    
    getDayKey() {
        return new Date().toISOString().split('T')[0];
    }
    
    getUserDailyUsage(walletAddress) {
        const dayKey = this.getDayKey();
        const userKey = `${walletAddress}-${dayKey}`;
        
        if (!this.userDailyUsage.has(userKey)) {
            this.userDailyUsage.set(userKey, {
                aiQuestions: 0,
                arbitrageAlerts: 0,
                quizRetakes: {}
            });
        }
        
        return this.userDailyUsage.get(userKey);
    }
    
    getUserMembership(walletAddress) {
        return this.userMemberships.get(walletAddress) || { tier: 'free', expiresAt: null };
    }
    
    getMembershipBenefits(walletAddress) {
        const membership = this.getUserMembership(walletAddress);
        return this.membershipTiers[membership.tier] || this.membershipTiers.free;
    }
    
    checkAiChatAccess(walletAddress, questionType = 'basic') {
        const usage = this.getUserDailyUsage(walletAddress);
        const benefits = this.getMembershipBenefits(walletAddress);
        
        const limit = benefits.aiQuestionsDaily;
        
        if (limit === -1) {
            return { allowed: true, free: true, cost: 0 };
        }
        
        if (usage.aiQuestions < limit) {
            return { allowed: true, free: true, cost: 0, remaining: limit - usage.aiQuestions };
        }
        
        const cost = questionType === 'advanced' ? this.fees.aiChatAdvanced : this.fees.aiChatPremium;
        return { allowed: true, free: false, cost: cost, remaining: 0 };
    }
    
    async chargeAiChat(walletAddress, privateKey, questionType = 'basic') {
        const access = this.checkAiChatAccess(walletAddress, questionType);
        
        if (access.free) {
            const usage = this.getUserDailyUsage(walletAddress);
            usage.aiQuestions++;
            return { success: true, charged: false, message: `Free question used. ${access.remaining - 1} remaining today.` };
        }
        
        const result = await this.chargeUser(walletAddress, privateKey, access.cost, 'aiChat', 'AI Chat Premium Question');
        
        if (result.success) {
            const usage = this.getUserDailyUsage(walletAddress);
            usage.aiQuestions++;
        }
        
        return result;
    }
    
    checkQuizRetakeAccess(walletAddress, courseId) {
        return { allowed: true, cost: this.fees.quizRetake };
    }
    
    async chargeQuizRetake(walletAddress, privateKey, courseId) {
        const result = await this.chargeUser(walletAddress, privateKey, this.fees.quizRetake, 'quizRetakes', `Quiz Retake: Course ${courseId}`);
        
        if (result.success) {
            const usage = this.getUserDailyUsage(walletAddress);
            if (!usage.quizRetakes[courseId]) {
                usage.quizRetakes[courseId] = 0;
            }
            usage.quizRetakes[courseId]++;
        }
        
        return result;
    }
    
    async featurePost(walletAddress, privateKey, postId, communityTopic) {
        const result = await this.chargeUser(walletAddress, privateKey, this.fees.featuredPost, 'featuredPosts', `Featured Post: ${postId}`);
        
        if (result.success) {
            this.featuredPosts.set(postId, {
                walletAddress,
                topic: communityTopic,
                featuredAt: Date.now(),
                expiresAt: Date.now() + this.fees.featuredPostDuration
            });
        }
        
        return result;
    }
    
    getFeaturedPosts(topic = null) {
        const now = Date.now();
        const featured = [];
        
        for (const [postId, data] of this.featuredPosts.entries()) {
            if (data.expiresAt > now) {
                if (!topic || data.topic === topic) {
                    featured.push({ postId, ...data });
                }
            } else {
                this.featuredPosts.delete(postId);
            }
        }
        
        return featured.sort((a, b) => b.featuredAt - a.featuredAt);
    }
    
    async chargePoolCreation(walletAddress, privateKey, poolName) {
        const benefits = this.getMembershipBenefits(walletAddress);
        const discount = benefits.poolDiscount || 0;
        const cost = Math.floor(this.fees.poolCreation * (1 - discount));
        
        return await this.chargeUser(walletAddress, privateKey, cost, 'poolFees', `Pool Creation: ${poolName}`);
    }
    
    async boostPool(walletAddress, privateKey, poolId, days = 1) {
        const benefits = this.getMembershipBenefits(walletAddress);
        const discount = benefits.poolDiscount || 0;
        const cost = Math.floor(this.fees.poolBoost * days * (1 - discount));
        
        const result = await this.chargeUser(walletAddress, privateKey, cost, 'poolFees', `Pool Boost: ${poolId} for ${days} days`);
        
        if (result.success) {
            const existing = this.boostedPools.get(poolId);
            const currentExpiry = existing?.expiresAt || Date.now();
            
            this.boostedPools.set(poolId, {
                walletAddress,
                boostedAt: Date.now(),
                expiresAt: Math.max(currentExpiry, Date.now()) + (days * this.fees.poolBoostDuration)
            });
        }
        
        return result;
    }
    
    getBoostedPools() {
        const now = Date.now();
        const boosted = [];
        
        for (const [poolId, data] of this.boostedPools.entries()) {
            if (data.expiresAt > now) {
                boosted.push({ poolId, ...data });
            } else {
                this.boostedPools.delete(poolId);
            }
        }
        
        return boosted;
    }
    
    async processTip(fromWallet, privateKey, toWallet, amount, message = '') {
        const platformFee = Math.floor(amount * this.fees.tipPlatformFee);
        const tipAmount = amount - platformFee;
        
        try {
            if (this.blockchain) {
                const tx = this.blockchain.createTransaction(fromWallet, toWallet, tipAmount, 0, privateKey);
                if (!tx.success) {
                    return { success: false, error: tx.error };
                }
                
                if (platformFee > 0) {
                    this.totalRevenue.tips += platformFee;
                    this.transactions.push({
                        type: 'tip_fee',
                        from: fromWallet,
                        amount: platformFee,
                        timestamp: Date.now(),
                        description: `Tip platform fee (5%)`
                    });
                }
            }
            
            return { 
                success: true, 
                tipAmount, 
                platformFee, 
                message: `Tip of ${tipAmount} KENO sent! (${platformFee} KENO platform fee)` 
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
    
    async chargeArbitrageAlert(walletAddress, privateKey) {
        const usage = this.getUserDailyUsage(walletAddress);
        const benefits = this.getMembershipBenefits(walletAddress);
        
        const limit = benefits.arbitrageAlerts;
        
        if (limit === -1 || usage.arbitrageAlerts < limit) {
            usage.arbitrageAlerts++;
            return { success: true, charged: false, message: 'Alert included in membership.' };
        }
        
        const result = await this.chargeUser(walletAddress, privateKey, this.fees.arbitrageAlert, 'alerts', 'Real-time Arbitrage Alert');
        
        if (result.success) {
            usage.arbitrageAlerts++;
        }
        
        return result;
    }
    
    async mintBadge(walletAddress, privateKey, badgeType, badgeName) {
        return await this.chargeUser(walletAddress, privateKey, this.fees.badgeMint, 'badges', `Badge Mint: ${badgeName}`);
    }
    
    async purchaseMembership(walletAddress, privateKey, tier, billingCycle = 'monthly') {
        const tierData = this.membershipTiers[tier];
        if (!tierData || tier === 'free') {
            return { success: false, error: 'Invalid membership tier' };
        }
        
        const price = billingCycle === 'yearly' ? tierData.priceYearly : tierData.priceMonthly;
        const durationMs = billingCycle === 'yearly' ? 365 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;
        
        const kenoPrice = price * 100;
        
        const result = await this.chargeUser(walletAddress, privateKey, kenoPrice, 'memberships', `${tierData.name} Membership (${billingCycle})`);
        
        if (result.success) {
            const existing = this.userMemberships.get(walletAddress);
            const currentExpiry = existing?.expiresAt || Date.now();
            
            this.userMemberships.set(walletAddress, {
                tier,
                billingCycle,
                purchasedAt: Date.now(),
                expiresAt: Math.max(currentExpiry, Date.now()) + durationMs
            });
        }
        
        return result;
    }
    
    async chargeUser(walletAddress, privateKey, amount, category, description) {
        try {
            if (this.blockchain) {
                const wallet = this.blockchain.wallets.get(walletAddress);
                if (!wallet) {
                    return { success: false, error: 'Wallet not found' };
                }
                
                const balance = this.blockchain.getBalance(walletAddress);
                if (balance < amount) {
                    return { success: false, error: `Insufficient balance. Need ${amount} KENO, have ${balance} KENO.` };
                }
                
                const platformWallet = this.blockchain.getPlatformWallet?.() || 'KENOSTOD_PLATFORM';
                const tx = this.blockchain.createTransaction(walletAddress, platformWallet, amount, 0, privateKey);
                
                if (!tx.success) {
                    return { success: false, error: tx.error };
                }
            }
            
            this.totalRevenue[category] = (this.totalRevenue[category] || 0) + amount;
            
            this.transactions.push({
                type: category,
                from: walletAddress,
                amount,
                timestamp: Date.now(),
                description
            });
            
            return { 
                success: true, 
                charged: true,
                amount, 
                message: `Charged ${amount} KENO for: ${description}` 
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
    
    getRevenueStats() {
        return {
            totalRevenue: this.totalRevenue,
            grandTotal: Object.values(this.totalRevenue).reduce((a, b) => a + b, 0),
            transactionCount: this.transactions.length,
            recentTransactions: this.transactions.slice(-20).reverse(),
            activeMemberships: this.userMemberships.size,
            activeFeaturedPosts: this.featuredPosts.size,
            activeBoostedPools: this.boostedPools.size
        };
    }
    
    getFees() {
        return this.fees;
    }
    
    getMembershipTiers() {
        return this.membershipTiers;
    }
    
    exportData() {
        return {
            fees: this.fees,
            membershipTiers: this.membershipTiers,
            userMemberships: Array.from(this.userMemberships.entries()),
            featuredPosts: Array.from(this.featuredPosts.entries()),
            boostedPools: Array.from(this.boostedPools.entries()),
            transactions: this.transactions,
            totalRevenue: this.totalRevenue
        };
    }
}

module.exports = MicroMonetization;
