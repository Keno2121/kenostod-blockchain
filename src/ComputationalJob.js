const crypto = require('crypto');

/**
 * Computational Job
 * 
 * Represents high-value AI/ML computation tasks that miners perform.
 * These form the basis of Proof-of-Residual-Value (PoRV) mining.
 */
class ComputationalJob {
    constructor(clientId, jobType, parameters, upfrontFee, royaltyRate) {
        this.jobId = this.generateJobId();
        this.clientId = clientId; // Enterprise client who commissioned the job
        this.jobType = jobType; // 'AI_TRAINING', 'SIMULATION', 'DATA_ANALYTICS'
        this.parameters = parameters; // Job-specific config (model architecture, dataset, etc.)
        this.upfrontFee = upfrontFee; // Immediate payment in KENO
        this.royaltyRate = royaltyRate; // Percentage (1-5%) of commercial revenue
        this.status = 'pending'; // pending, assigned, completed, deployed
        this.createdAt = Date.now();
        this.assignedTo = null; // Miner address
        this.assignedAt = null;
        this.completedAt = null;
        this.completedBy = null;
        this.blockHeight = null; // Block where computation was validated
        this.outputHash = null; // Hash of the trained model/simulation result
        this.rvtId = null; // Linked RVT after completion
        this.totalApiCalls = 0; // Track usage for royalty calculation
        this.totalRevenue = 0; // Total commercial revenue generated
        this.deployedAt = null;
    }

    generateJobId() {
        return 'JOB-' + crypto.randomBytes(8).toString('hex').toUpperCase();
    }

    /**
     * Assign job to a miner (during block validation)
     */
    assignToMiner(minerAddress) {
        if (this.status !== 'pending') {
            throw new Error('Job is not available for assignment');
        }
        this.assignedTo = minerAddress;
        this.assignedAt = Date.now();
        this.status = 'assigned';
    }

    /**
     * Mark job as completed (after successful mining)
     */
    complete(minerAddress, blockHeight, outputHash) {
        if (this.status !== 'assigned') {
            throw new Error('Job must be assigned before completion');
        }
        if (this.assignedTo !== minerAddress) {
            throw new Error('Only the assigned miner can complete this job');
        }
        
        this.completedBy = minerAddress;
        this.completedAt = Date.now();
        this.blockHeight = blockHeight;
        this.outputHash = outputHash;
        this.status = 'completed';
    }

    /**
     * Deploy to production (makes it available for commercial use)
     */
    deploy(rvtId) {
        if (this.status !== 'completed') {
            throw new Error('Job must be completed before deployment');
        }
        this.rvtId = rvtId;
        this.deployedAt = Date.now();
        this.status = 'deployed';
    }

    /**
     * Record API call for royalty calculation
     */
    recordApiCall(revenueGenerated = 0) {
        if (this.status !== 'deployed') {
            throw new Error('Cannot track usage for non-deployed jobs');
        }
        this.totalApiCalls++;
        this.totalRevenue += revenueGenerated;
    }

    /**
     * Calculate royalty owed based on revenue
     */
    calculateRoyalty(revenue) {
        return revenue * (this.royaltyRate / 100);
    }

    /**
     * Get job performance metrics
     */
    getMetrics() {
        return {
            jobId: this.jobId,
            totalApiCalls: this.totalApiCalls,
            totalRevenue: this.totalRevenue,
            totalRoyalties: this.calculateRoyalty(this.totalRevenue),
            avgRevenuePerCall: this.totalApiCalls > 0 ? this.totalRevenue / this.totalApiCalls : 0,
            daysActive: this.deployedAt ? (Date.now() - this.deployedAt) / (1000 * 60 * 60 * 24) : 0
        };
    }

    toJSON() {
        return {
            jobId: this.jobId,
            clientId: this.clientId,
            jobType: this.jobType,
            parameters: this.parameters,
            upfrontFee: this.upfrontFee,
            royaltyRate: this.royaltyRate,
            status: this.status,
            createdAt: this.createdAt,
            assignedTo: this.assignedTo,
            assignedAt: this.assignedAt,
            completedAt: this.completedAt,
            completedBy: this.completedBy,
            blockHeight: this.blockHeight,
            outputHash: this.outputHash,
            rvtId: this.rvtId,
            deployedAt: this.deployedAt,
            metrics: this.status === 'deployed' ? this.getMetrics() : null
        };
    }
}

module.exports = ComputationalJob;
