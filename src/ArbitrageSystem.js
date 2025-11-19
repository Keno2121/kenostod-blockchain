const EC = require('elliptic').ec;
const ec = new EC('secp256k1');
const SHA256 = require('crypto-js/sha256');
const CoinGeckoAPI = require('./CoinGeckoAPI');

class ArbitrageSystem {
    constructor(blockchain, dataPersistence) {
        this.blockchain = blockchain;
        this.dataPersistence = dataPersistence;
        this.coinGeckoAPI = new CoinGeckoAPI();
        
        this.flashLoans = new Map();
        this.activeLoans = new Map();
        this.loanHistory = [];
        this.traderProfiles = new Map();
        this.arbitrageOpportunities = [];
        this.leaderboard = [];
        this.arbitrageEvents = [];
        this.bridgeTransfers = new Map();
        this.nftBadges = new Map();
        
        this.config = {
            maxLoanAmount: 10000,
            minLoanAmount: 100,
            defaultLoanLimit: 1000,
            bonusPercentage: 0.5,
            priceThreshold: 2.0,
            eventFrequency: 12 * 60 * 60 * 1000,
            bridgeLockTime: 300000,
            reputationLevels: {
                bronze: { threshold: 10, loanMultiplier: 1.5, badge: '🥉' },
                silver: { threshold: 50, loanMultiplier: 2.0, badge: '🥈' },
                gold: { threshold: 200, loanMultiplier: 3.0, badge: '🥇' },
                platinum: { threshold: 1000, loanMultiplier: 5.0, badge: '💎' }
            }
        };
        
        this.initializeSystem();
    }

    initializeSystem() {
        this.loadPersistedData();
        this.startArbitrageEventScheduler();
        this.startOpportunityDetector();
        console.log('🚀 KENO Arbitrage Revolution System initialized');
        console.log('   ⚡ Flash Arbitrage Loans (FAL) active');
        console.log('   💰 Arbitrage Incentive Protocol (AIP) active');
        console.log('   🌉 Cross-Exchange Settlement Bridge active');
        console.log('   🏆 Performance Tracking & Leaderboard active');
        console.log('   📅 Scheduled Arbitrage Events active');
    }

    loadPersistedData() {
        const savedData = this.dataPersistence.load('arbitrage_system');
        if (savedData) {
            this.loanHistory = savedData.loanHistory || [];
            this.traderProfiles = new Map(savedData.traderProfiles || []);
            this.leaderboard = savedData.leaderboard || [];
            this.nftBadges = new Map(savedData.nftBadges || []);
            console.log(`✅ Loaded ${this.loanHistory.length} arbitrage loans from disk`);
            console.log(`✅ Loaded ${this.traderProfiles.size} trader profiles from disk`);
        }
    }

    persistData() {
        this.dataPersistence.save('arbitrage_system', {
            loanHistory: this.loanHistory,
            traderProfiles: Array.from(this.traderProfiles.entries()),
            leaderboard: this.leaderboard,
            nftBadges: Array.from(this.nftBadges.entries()),
            lastSaved: new Date().toISOString()
        });
    }

    createFlashLoan(walletAddress, amount, purpose) {
        if (!walletAddress || amount <= 0) {
            return { success: false, error: 'Invalid wallet address or amount' };
        }

        const trader = this.getOrCreateTrader(walletAddress);
        const loanLimit = this.calculateLoanLimit(trader);

        if (amount > loanLimit) {
            return { 
                success: false, 
                error: `Loan amount exceeds your limit of ${loanLimit} KENO`,
                currentLimit: loanLimit,
                requestedAmount: amount
            };
        }

        if (this.activeLoans.has(walletAddress)) {
            return { 
                success: false, 
                error: 'You already have an active flash loan. Repay it first.' 
            };
        }

        const loanId = this.generateLoanId();
        const loan = {
            id: loanId,
            walletAddress,
            amount,
            purpose,
            timestamp: Date.now(),
            expiresAt: Date.now() + 300000,
            status: 'active',
            repaid: false,
            profit: 0
        };

        this.activeLoans.set(walletAddress, loan);
        this.flashLoans.set(loanId, loan);

        const balance = this.blockchain.getBalance(walletAddress);
        this.blockchain.updateBalance(walletAddress, balance + amount);

        console.log(`⚡ Flash loan created: ${amount} KENO to ${walletAddress.substring(0, 20)}...`);

        return {
            success: true,
            loanId,
            amount,
            expiresAt: loan.expiresAt,
            message: `Flash loan of ${amount} KENO approved! Must be repaid within 5 minutes.`
        };
    }

    repayFlashLoan(walletAddress, loanId, actualProfit = 0) {
        const loan = this.flashLoans.get(loanId);
        
        if (!loan) {
            return { success: false, error: 'Loan not found' };
        }

        if (loan.walletAddress !== walletAddress) {
            return { success: false, error: 'Unauthorized repayment attempt' };
        }

        if (loan.repaid) {
            return { success: false, error: 'Loan already repaid' };
        }

        const balance = this.blockchain.getBalance(walletAddress);
        
        if (balance < loan.amount) {
            this.handleDefaultedLoan(loan);
            return { 
                success: false, 
                error: 'Insufficient balance to repay loan. Loan defaulted.',
                penaltyApplied: true
            };
        }

        this.blockchain.updateBalance(walletAddress, balance - loan.amount);

        loan.repaid = true;
        loan.status = 'completed';
        loan.profit = actualProfit;
        loan.repaidAt = Date.now();

        this.activeLoans.delete(walletAddress);
        this.loanHistory.push(loan);

        const trader = this.getOrCreateTrader(walletAddress);
        trader.totalLoans++;
        trader.successfulLoans++;
        trader.totalProfit += actualProfit;
        trader.lastActivity = Date.now();

        if (actualProfit > 0) {
            this.applyArbitrageBonus(walletAddress, actualProfit);
        }

        this.updateLeaderboard(walletAddress);
        this.checkBadgeEligibility(walletAddress);
        this.persistData();

        console.log(`✅ Flash loan repaid: ${loan.amount} KENO by ${walletAddress.substring(0, 20)}...`);

        return {
            success: true,
            message: 'Loan repaid successfully',
            profit: actualProfit,
            bonusEarned: actualProfit > 0 ? actualProfit * (this.config.bonusPercentage / 100) : 0
        };
    }

    handleDefaultedLoan(loan) {
        loan.status = 'defaulted';
        loan.repaid = false;
        
        const trader = this.getOrCreateTrader(loan.walletAddress);
        trader.totalLoans++;
        trader.defaultedLoans++;
        trader.reputationScore = Math.max(0, trader.reputationScore - 10);
        
        this.activeLoans.delete(loan.walletAddress);
        this.loanHistory.push(loan);
        this.persistData();
        
        console.log(`❌ Flash loan defaulted: ${loan.amount} KENO by ${loan.walletAddress.substring(0, 20)}...`);
    }

    applyArbitrageBonus(walletAddress, profit) {
        const bonusAmount = profit * (this.config.bonusPercentage / 100);
        
        const balance = this.blockchain.getBalance(walletAddress);
        this.blockchain.updateBalance(walletAddress, balance + bonusAmount);
        
        const trader = this.getOrCreateTrader(walletAddress);
        trader.totalBonusEarned += bonusAmount;
        
        console.log(`💰 Arbitrage bonus: ${bonusAmount.toFixed(2)} KENO to ${walletAddress.substring(0, 20)}...`);
        
        return bonusAmount;
    }

    detectArbitrageOpportunities(exchangePrices) {
        const opportunities = [];
        const exchanges = Object.keys(exchangePrices);
        
        for (let i = 0; i < exchanges.length; i++) {
            for (let j = i + 1; j < exchanges.length; j++) {
                const exchange1 = exchanges[i];
                const exchange2 = exchanges[j];
                const price1 = exchangePrices[exchange1];
                const price2 = exchangePrices[exchange2];
                
                const priceDiff = Math.abs(price1 - price2);
                const avgPrice = (price1 + price2) / 2;
                const percentageDiff = (priceDiff / avgPrice) * 100;
                
                if (percentageDiff >= this.config.priceThreshold) {
                    opportunities.push({
                        id: this.generateOpportunityId(),
                        buyExchange: price1 < price2 ? exchange1 : exchange2,
                        sellExchange: price1 < price2 ? exchange2 : exchange1,
                        buyPrice: Math.min(price1, price2),
                        sellPrice: Math.max(price1, price2),
                        priceDiff,
                        percentageDiff: percentageDiff.toFixed(2),
                        potentialProfit: percentageDiff,
                        timestamp: Date.now(),
                        eligible: true
                    });
                }
            }
        }
        
        this.arbitrageOpportunities = opportunities;
        return opportunities;
    }

    createBridgeTransfer(walletAddress, fromExchange, toExchange, amount, signature) {
        if (!this.verifyBridgeSignature(walletAddress, fromExchange, toExchange, amount, signature)) {
            return { success: false, error: 'Invalid signature' };
        }

        const transferId = this.generateTransferId();
        const transfer = {
            id: transferId,
            walletAddress,
            fromExchange,
            toExchange,
            amount,
            timestamp: Date.now(),
            status: 'pending',
            unlockTime: Date.now() + this.config.bridgeLockTime
        };

        this.bridgeTransfers.set(transferId, transfer);

        setTimeout(() => {
            this.completeBridgeTransfer(transferId);
        }, this.config.bridgeLockTime);

        console.log(`🌉 Bridge transfer initiated: ${amount} KENO from ${fromExchange} to ${toExchange}`);

        return {
            success: true,
            transferId,
            estimatedTime: this.config.bridgeLockTime / 1000,
            message: `Transfer initiated. Tokens will be available on ${toExchange} in ${this.config.bridgeLockTime / 1000} seconds.`
        };
    }

    completeBridgeTransfer(transferId) {
        const transfer = this.bridgeTransfers.get(transferId);
        if (transfer && transfer.status === 'pending') {
            transfer.status = 'completed';
            transfer.completedAt = Date.now();
            
            console.log(`✅ Bridge transfer completed: ${transfer.amount} KENO to ${transfer.toExchange}`);
        }
    }

    verifyBridgeSignature(walletAddress, fromExchange, toExchange, amount, signature) {
        return true;
    }

    getOrCreateTrader(walletAddress) {
        if (!this.traderProfiles.has(walletAddress)) {
            this.traderProfiles.set(walletAddress, {
                walletAddress,
                totalLoans: 0,
                successfulLoans: 0,
                defaultedLoans: 0,
                totalProfit: 0,
                totalBonusEarned: 0,
                reputationScore: 0,
                reputationLevel: 'beginner',
                badges: [],
                joinedAt: Date.now(),
                lastActivity: Date.now()
            });
        }
        return this.traderProfiles.get(walletAddress);
    }

    calculateLoanLimit(trader) {
        let baseLimit = this.config.defaultLoanLimit;
        
        const levels = this.config.reputationLevels;
        const successfulTrades = trader.successfulLoans;
        
        if (successfulTrades >= levels.platinum.threshold) {
            baseLimit *= levels.platinum.loanMultiplier;
            trader.reputationLevel = 'platinum';
        } else if (successfulTrades >= levels.gold.threshold) {
            baseLimit *= levels.gold.loanMultiplier;
            trader.reputationLevel = 'gold';
        } else if (successfulTrades >= levels.silver.threshold) {
            baseLimit *= levels.silver.loanMultiplier;
            trader.reputationLevel = 'silver';
        } else if (successfulTrades >= levels.bronze.threshold) {
            baseLimit *= levels.bronze.loanMultiplier;
            trader.reputationLevel = 'bronze';
        }
        
        return Math.min(baseLimit, this.config.maxLoanAmount);
    }

    updateLeaderboard(walletAddress) {
        const trader = this.getOrCreateTrader(walletAddress);
        
        const existingIndex = this.leaderboard.findIndex(t => t.walletAddress === walletAddress);
        if (existingIndex !== -1) {
            this.leaderboard.splice(existingIndex, 1);
        }
        
        this.leaderboard.push({
            walletAddress,
            totalProfit: trader.totalProfit,
            successfulLoans: trader.successfulLoans,
            reputationLevel: trader.reputationLevel,
            badges: trader.badges
        });
        
        this.leaderboard.sort((a, b) => b.totalProfit - a.totalProfit);
        this.leaderboard = this.leaderboard.slice(0, 100);
    }

    checkBadgeEligibility(walletAddress) {
        const trader = this.getOrCreateTrader(walletAddress);
        const newBadges = [];
        
        const milestones = [
            { trades: 10, badge: 'First Blood', emoji: '🥉', description: '10 successful arbitrage trades' },
            { trades: 50, badge: 'Arbitrage Pro', emoji: '🥈', description: '50 successful arbitrage trades' },
            { trades: 200, badge: 'Master Trader', emoji: '🥇', description: '200 successful arbitrage trades' },
            { trades: 1000, badge: 'Arbitrage Legend', emoji: '💎', description: '1000 successful arbitrage trades' },
            { profit: 10000, badge: 'Profit King', emoji: '👑', description: 'Earned 10,000 KENO in profits' },
            { profit: 100000, badge: 'Whale Trader', emoji: '🐋', description: 'Earned 100,000 KENO in profits' }
        ];
        
        milestones.forEach(milestone => {
            const hasTradeRequirement = milestone.trades && trader.successfulLoans >= milestone.trades;
            const hasProfitRequirement = milestone.profit && trader.totalProfit >= milestone.profit;
            
            if ((hasTradeRequirement || hasProfitRequirement) && !trader.badges.includes(milestone.badge)) {
                trader.badges.push(milestone.badge);
                newBadges.push({
                    name: milestone.badge,
                    emoji: milestone.emoji,
                    description: milestone.description,
                    earnedAt: Date.now()
                });
                
                this.nftBadges.set(`${walletAddress}-${milestone.badge}`, {
                    walletAddress,
                    badge: milestone.badge,
                    tokenId: this.generateNFTTokenId(),
                    mintedAt: Date.now()
                });
            }
        });
        
        return newBadges;
    }

    startArbitrageEventScheduler() {
        this.scheduleNextEvent();
        
        setInterval(() => {
            this.scheduleNextEvent();
        }, this.config.eventFrequency);
        
        console.log('📅 Arbitrage Event Scheduler started (events every 12 hours)');
    }

    scheduleNextEvent() {
        const event = {
            id: this.generateEventId(),
            name: 'Arbitrage Trading Competition',
            startTime: Date.now() + (6 * 60 * 60 * 1000),
            duration: 60 * 60 * 1000,
            prizes: {
                first: 5000,
                second: 2500,
                third: 1000
            },
            participants: [],
            status: 'scheduled'
        };
        
        this.arbitrageEvents.push(event);
        console.log(`📅 Next arbitrage event scheduled for ${new Date(event.startTime).toLocaleString()}`);
    }

    startOpportunityDetector() {
        // Initial load
        this.updateOpportunitiesFromCoinGecko();
        
        // Update every 60 seconds with real CoinGecko data
        setInterval(async () => {
            await this.updateOpportunitiesFromCoinGecko();
        }, 60000);
    }

    async updateOpportunitiesFromCoinGecko() {
        try {
            const opportunities = await this.coinGeckoAPI.generateArbitrageOpportunities();
            
            if (opportunities && opportunities.length > 0) {
                this.arbitrageOpportunities = opportunities.map(opp => ({
                    ...opp,
                    timestamp: Date.now()
                }));
                
                console.log(`✅ Updated ${opportunities.length} arbitrage opportunities from REAL CoinGecko market prices`);
            }
        } catch (error) {
            console.error('⚠️  Error updating opportunities from CoinGecko:', error.message);
            // Keep existing opportunities if update fails
        }
    }

    generateLoanId() {
        return 'FAL-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }

    generateOpportunityId() {
        return 'ARB-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }

    generateTransferId() {
        return 'BRG-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }

    generateEventId() {
        return 'EVT-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }

    generateNFTTokenId() {
        return 'NFT-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }

    getStats() {
        return {
            totalLoans: this.loanHistory.length,
            activeLoans: this.activeLoans.size,
            totalTraders: this.traderProfiles.size,
            totalProfitGenerated: Array.from(this.traderProfiles.values()).reduce((sum, t) => sum + t.totalProfit, 0),
            totalBonusesPaid: Array.from(this.traderProfiles.values()).reduce((sum, t) => sum + t.totalBonusEarned, 0),
            activeOpportunities: this.arbitrageOpportunities.length,
            upcomingEvents: this.arbitrageEvents.filter(e => e.status === 'scheduled').length
        };
    }

    getTraderProfile(walletAddress) {
        const trader = this.traderProfiles.get(walletAddress);
        if (!trader) {
            return null;
        }
        
        return {
            ...trader,
            loanLimit: this.calculateLoanLimit(trader),
            rank: this.leaderboard.findIndex(t => t.walletAddress === walletAddress) + 1,
            recentLoans: this.loanHistory.filter(l => l.walletAddress === walletAddress).slice(-10)
        };
    }

    getLeaderboard(limit = 10) {
        return this.leaderboard.slice(0, limit);
    }

    getOpportunities() {
        return this.arbitrageOpportunities.filter(opp => 
            Date.now() - opp.timestamp < 60000
        );
    }

    getUpcomingEvents() {
        return this.arbitrageEvents.filter(e => e.status === 'scheduled');
    }
}

module.exports = ArbitrageSystem;
