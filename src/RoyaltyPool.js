/**
 * Royalty Pool Smart Contract
 * 
 * Manages perpetual royalty collection from commercial use of AI models/data.
 * Automatically distributes royalties to RVT holders and funds the buy-and-burn mechanism.
 */
class RoyaltyPool {
    constructor(blockchain) {
        this.blockchain = blockchain;
        this.royaltyCollections = []; // History of all royalty payments
        this.rvtHoldings = new Map(); // Map of address -> array of RVT IDs they hold
        this.burnPercentage = 40; // 40% of royalties go to buy-and-burn
        this.minerPercentage = 50; // 50% distributed to RVT holders (miners)
        this.treasuryPercentage = 10; // 10% to network treasury
        this.totalCollected = 0;
        this.totalBurned = 0;
        this.totalDistributedToMiners = 0;
        this.totalToTreasury = 0;
    }

    /**
     * Assign an RVT to a wallet address (happens when mining)
     */
    assignRVT(walletAddress, rvtId) {
        if (!this.rvtHoldings.has(walletAddress)) {
            this.rvtHoldings.set(walletAddress, []);
        }
        this.rvtHoldings.get(walletAddress).push(rvtId);
    }

    /**
     * Transfer RVT from one address to another
     */
    transferRVT(fromAddress, toAddress, rvtId) {
        const fromRVTs = this.rvtHoldings.get(fromAddress);
        if (!fromRVTs || !fromRVTs.includes(rvtId)) {
            throw new Error('Sender does not hold this RVT');
        }

        const index = fromRVTs.indexOf(rvtId);
        fromRVTs.splice(index, 1);

        if (!this.rvtHoldings.has(toAddress)) {
            this.rvtHoldings.set(toAddress, []);
        }
        this.rvtHoldings.get(toAddress).push(rvtId);
    }

    /**
     * Collect royalty from commercial API usage
     */
    collectRoyalty(jobId, rvtId, amount, source = 'API_USAGE') {
        if (amount <= 0) {
            throw new Error('Royalty amount must be positive');
        }

        const collection = {
            collectionId: `ROY-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            jobId,
            rvtId,
            amount,
            source,
            timestamp: Date.now(),
            burnAmount: amount * (this.burnPercentage / 100),
            minerAmount: amount * (this.minerPercentage / 100),
            treasuryAmount: amount * (this.treasuryPercentage / 100),
            distributed: false
        };

        this.royaltyCollections.push(collection);
        this.totalCollected += amount;

        return collection;
    }

    /**
     * Distribute collected royalties
     */
    distributeRoyalty(collectionId, rvt) {
        const collection = this.royaltyCollections.find(c => c.collectionId === collectionId);
        if (!collection) {
            throw new Error('Collection not found');
        }

        if (collection.distributed) {
            throw new Error('Royalty already distributed');
        }

        const holder = this.findRVTHolder(collection.rvtId);
        if (!holder) {
            throw new Error('No RVT holder found');
        }

        collection.distributed = true;
        collection.holderAddress = holder;
        collection.distributedAt = Date.now();

        this.totalBurned += collection.burnAmount;
        this.totalDistributedToMiners += collection.minerAmount;
        this.totalToTreasury += collection.treasuryAmount;

        rvt.addRoyalty(collection.minerAmount);

        return {
            holderAddress: holder,
            minerPayout: collection.minerAmount,
            burnAmount: collection.burnAmount,
            treasuryAmount: collection.treasuryAmount
        };
    }

    /**
     * Find who currently holds a specific RVT
     */
    findRVTHolder(rvtId) {
        for (const [address, rvts] of this.rvtHoldings.entries()) {
            if (rvts.includes(rvtId)) {
                return address;
            }
        }
        return null;
    }

    /**
     * Get RVTs held by an address
     */
    getRVTsForAddress(address) {
        return this.rvtHoldings.get(address) || [];
    }

    /**
     * Get royalty history for a specific RVT
     */
    getRoyaltyHistory(rvtId) {
        return this.royaltyCollections.filter(c => c.rvtId === rvtId);
    }

    /**
     * Get pending (undistributed) royalties
     */
    getPendingRoyalties() {
        return this.royaltyCollections.filter(c => !c.distributed);
    }

    /**
     * Get pool statistics
     */
    getPoolStats() {
        const pending = this.getPendingRoyalties();
        const pendingTotal = pending.reduce((sum, c) => sum + c.amount, 0);

        return {
            totalCollected: this.totalCollected,
            totalBurned: this.totalBurned,
            totalDistributedToMiners: this.totalDistributedToMiners,
            totalToTreasury: this.totalToTreasury,
            pendingDistributions: pending.length,
            pendingAmount: pendingTotal,
            burnPercentage: this.burnPercentage,
            minerPercentage: this.minerPercentage,
            treasuryPercentage: this.treasuryPercentage
        };
    }

    toJSON() {
        return {
            stats: this.getPoolStats(),
            totalRVTHolders: this.rvtHoldings.size,
            recentCollections: this.royaltyCollections.slice(-10)
        };
    }
}

module.exports = RoyaltyPool;
