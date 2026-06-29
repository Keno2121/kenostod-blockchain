const Transaction = require('./Transaction');

/**
 * Buy-and-Burn Mechanism
 * 
 * Uses royalty fees to perpetually buy and burn KENO tokens from the market,
 * creating deflationary pressure and long-term value appreciation.
 */
class BuyAndBurn {
    constructor(blockchain) {
        this.blockchain = blockchain;
        this.burnHistory = [];
        this.totalBurned = 0;
        this.totalSpent = 0;
        this.burnWalletAddress = 'BURN_ADDRESS_0000000000000000000000000000000000000000';
    }

    /**
     * Execute a buy-and-burn transaction
     * In a real system, this would interact with a DEX to buy tokens
     * For this implementation, we directly burn from the royalty pool
     */
    executeBurn(amount, source = 'ROYALTY_POOL') {
        if (amount <= 0) {
            throw new Error('Burn amount must be positive');
        }

        const burn = {
            burnId: `BURN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            amount,
            source,
            timestamp: Date.now(),
            blockHeight: this.blockchain.chain.length
        };

        this.burnHistory.push(burn);
        this.totalBurned += amount;
        this.totalSpent += amount;

        console.log(`🔥 Burned ${amount} KENO tokens from ${source}`);
        console.log(`💎 Total supply reduced by ${this.totalBurned} KENO`);

        return burn;
    }

    /**
     * Simulate market buy before burn (for realistic economics)
     * This would integrate with a DEX in production
     */
    simulateMarketBuy(fundingAmount) {
        const marketPrice = this.getSimulatedMarketPrice();
        const tokensBought = fundingAmount / marketPrice;
        
        return {
            fundingAmount,
            marketPrice,
            tokensBought,
            priceImpact: this.calculatePriceImpact(tokensBought)
        };
    }

    /**
     * Get simulated KENO market price (would use real DEX pricing in production)
     */
    getSimulatedMarketPrice() {
        const stats = this.blockchain.getChainStats();
        const basePrice = 1.0;
        const burnMultiplier = 1 + (this.totalBurned / stats.circulatingSupply);
        const demandFactor = 1 + (stats.totalTransactions / 1000);
        
        return basePrice * burnMultiplier * demandFactor;
    }

    /**
     * Calculate price impact of a buy order
     */
    calculatePriceImpact(tokenAmount) {
        const stats = this.blockchain.getChainStats();
        const circulatingSupply = stats.circulatingSupply;
        
        if (circulatingSupply === 0) return 0;
        
        const impactPercentage = (tokenAmount / circulatingSupply) * 100;
        return Math.min(impactPercentage, 50);
    }

    /**
     * Get burn statistics
     */
    getBurnStats() {
        const stats = this.blockchain.getChainStats();
        const burnRate = stats.circulatingSupply > 0 
            ? (this.totalBurned / stats.totalMinted) * 100 
            : 0;

        return {
            totalBurned: this.totalBurned,
            totalSpent: this.totalSpent,
            burnTransactions: this.burnHistory.length,
            burnRate: burnRate,
            circulatingSupply: stats.circulatingSupply,
            effectiveSupplyReduction: (this.totalBurned / stats.totalMinted) * 100,
            avgBurnPerTransaction: this.burnHistory.length > 0 
                ? this.totalBurned / this.burnHistory.length 
                : 0,
            currentMarketPrice: this.getSimulatedMarketPrice()
        };
    }

    /**
     * Get recent burn history
     */
    getRecentBurns(limit = 20) {
        return this.burnHistory.slice(-limit).reverse();
    }

    /**
     * Schedule automatic burn based on royalty accumulation
     */
    shouldExecuteAutoBurn(royaltyPoolBalance, threshold = 100) {
        return royaltyPoolBalance >= threshold;
    }

    toJSON() {
        return {
            stats: this.getBurnStats(),
            recentBurns: this.getRecentBurns(10)
        };
    }
}

module.exports = BuyAndBurn;
