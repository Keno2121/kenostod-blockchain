const crypto = require('crypto');

/**
 * Enterprise Client Management
 * 
 * Manages enterprise clients for Model IPO and perpetual licensing.
 * These clients commission high-value AI/ML computations on the network.
 */
class EnterpriseClient {
    constructor(name, industry, walletAddress) {
        this.clientId = this.generateClientId();
        this.name = name;
        this.industry = industry;
        this.walletAddress = walletAddress;
        this.tier = 'STANDARD';
        this.createdAt = Date.now();
        this.jobs = [];
        this.totalSpent = 0;
        this.totalRoyaltiesPaid = 0;
        this.activeModels = 0;
        this.isActive = true;
    }

    generateClientId() {
        return 'ENT-' + crypto.randomBytes(6).toString('hex').toUpperCase();
    }

    /**
     * Add a computational job for this client
     */
    addJob(jobId) {
        this.jobs.push({
            jobId,
            commissionedAt: Date.now()
        });
    }

    /**
     * Record upfront payment for a job
     */
    recordPayment(amount) {
        this.totalSpent += amount;
        this.updateTier();
    }

    /**
     * Record royalty payment from commercial use
     */
    recordRoyalty(amount) {
        this.totalRoyaltiesPaid += amount;
    }

    /**
     * Update client tier based on total spending
     */
    updateTier() {
        if (this.totalSpent >= 100000) {
            this.tier = 'PLATINUM';
        } else if (this.totalSpent >= 50000) {
            this.tier = 'GOLD';
        } else if (this.totalSpent >= 10000) {
            this.tier = 'SILVER';
        } else {
            this.tier = 'STANDARD';
        }
    }

    /**
     * Get tier benefits
     */
    getTierBenefits() {
        const benefits = {
            'STANDARD': {
                prioritySupport: false,
                discountRate: 0,
                maxConcurrentJobs: 3,
                customRoyaltyTerms: false
            },
            'SILVER': {
                prioritySupport: true,
                discountRate: 5,
                maxConcurrentJobs: 10,
                customRoyaltyTerms: false
            },
            'GOLD': {
                prioritySupport: true,
                discountRate: 10,
                maxConcurrentJobs: 25,
                customRoyaltyTerms: true
            },
            'PLATINUM': {
                prioritySupport: true,
                discountRate: 15,
                maxConcurrentJobs: 100,
                customRoyaltyTerms: true
            }
        };

        return benefits[this.tier];
    }

    /**
     * Activate or deactivate client
     */
    setActive(isActive) {
        this.isActive = isActive;
    }

    /**
     * Get client metrics
     */
    getMetrics() {
        return {
            clientId: this.clientId,
            name: this.name,
            industry: this.industry,
            tier: this.tier,
            totalJobs: this.jobs.length,
            totalSpent: this.totalSpent,
            totalRoyaltiesPaid: this.totalRoyaltiesPaid,
            avgSpendPerJob: this.jobs.length > 0 ? this.totalSpent / this.jobs.length : 0,
            activeModels: this.activeModels,
            lifetimeValue: this.totalSpent + this.totalRoyaltiesPaid,
            isActive: this.isActive,
            benefits: this.getTierBenefits()
        };
    }

    toJSON() {
        return {
            clientId: this.clientId,
            name: this.name,
            industry: this.industry,
            walletAddress: this.walletAddress,
            tier: this.tier,
            createdAt: this.createdAt,
            metrics: this.getMetrics(),
            recentJobs: this.jobs.slice(-5)
        };
    }
}

/**
 * Enterprise Client Manager
 * 
 * Centralized management of all enterprise clients
 */
class EnterpriseClientManager {
    constructor() {
        this.clients = new Map(); // clientId -> EnterpriseClient
        this.walletToClient = new Map(); // walletAddress -> clientId
    }

    /**
     * Register a new enterprise client
     */
    registerClient(name, industry, walletAddress) {
        if (this.walletToClient.has(walletAddress)) {
            throw new Error('Wallet already registered to a client');
        }

        const client = new EnterpriseClient(name, industry, walletAddress);
        this.clients.set(client.clientId, client);
        this.walletToClient.set(walletAddress, client.clientId);

        console.log(`✅ Enterprise client registered: ${name} (${client.clientId})`);
        return client;
    }

    /**
     * Get client by ID
     */
    getClient(clientId) {
        return this.clients.get(clientId);
    }

    /**
     * Get client by wallet address
     */
    getClientByWallet(walletAddress) {
        const clientId = this.walletToClient.get(walletAddress);
        return clientId ? this.clients.get(clientId) : null;
    }

    /**
     * Get all clients
     */
    getAllClients() {
        return Array.from(this.clients.values());
    }

    /**
     * Get clients by tier
     */
    getClientsByTier(tier) {
        return this.getAllClients().filter(c => c.tier === tier);
    }

    /**
     * Get active clients
     */
    getActiveClients() {
        return this.getAllClients().filter(c => c.isActive);
    }

    /**
     * Get manager statistics
     */
    getStats() {
        const allClients = this.getAllClients();
        const activeClients = this.getActiveClients();
        
        return {
            totalClients: allClients.length,
            activeClients: activeClients.length,
            inactiveClients: allClients.length - activeClients.length,
            tierDistribution: {
                STANDARD: this.getClientsByTier('STANDARD').length,
                SILVER: this.getClientsByTier('SILVER').length,
                GOLD: this.getClientsByTier('GOLD').length,
                PLATINUM: this.getClientsByTier('PLATINUM').length
            },
            totalRevenue: allClients.reduce((sum, c) => sum + c.totalSpent + c.totalRoyaltiesPaid, 0),
            avgRevenuePerClient: allClients.length > 0 
                ? allClients.reduce((sum, c) => sum + c.totalSpent + c.totalRoyaltiesPaid, 0) / allClients.length 
                : 0
        };
    }

    toJSON() {
        return {
            stats: this.getStats(),
            clients: this.getAllClients().map(c => c.toJSON())
        };
    }
}

module.exports = { EnterpriseClient, EnterpriseClientManager };
