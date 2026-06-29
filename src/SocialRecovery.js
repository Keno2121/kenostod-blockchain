const SHA256 = require('crypto-js/sha256');

class RecoveryConfig {
    constructor(walletAddress, guardians, threshold) {
        this.walletAddress = walletAddress;
        this.guardians = guardians;
        this.threshold = threshold;
        this.createdAt = Date.now();
        this.active = true;
    }

    isValid() {
        if (this.guardians.length < this.threshold) {
            throw new Error('Threshold cannot exceed number of guardians');
        }
        if (this.threshold < 1) {
            throw new Error('Threshold must be at least 1');
        }
        if (this.guardians.length < 2) {
            throw new Error('Must have at least 2 guardians');
        }
        return true;
    }
}

class RecoveryRequest {
    constructor(oldAddress, newAddress, requestedBy) {
        this.id = this.generateId();
        this.oldAddress = oldAddress;
        this.newAddress = newAddress;
        this.requestedBy = requestedBy;
        this.approvals = [];
        this.rejections = [];
        this.status = 'pending';
        this.createdAt = Date.now();
        this.expiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7 days
    }

    generateId() {
        return SHA256(Date.now() + Math.random()).toString().substring(0, 16);
    }

    addApproval(guardianAddress) {
        if (this.approvals.includes(guardianAddress)) {
            throw new Error('Guardian has already approved this recovery');
        }
        if (this.rejections.includes(guardianAddress)) {
            throw new Error('Guardian has already rejected this recovery');
        }
        this.approvals.push(guardianAddress);
    }

    addRejection(guardianAddress) {
        if (this.rejections.includes(guardianAddress)) {
            throw new Error('Guardian has already rejected this recovery');
        }
        if (this.approvals.includes(guardianAddress)) {
            throw new Error('Guardian has already approved this recovery');
        }
        this.rejections.push(guardianAddress);
    }

    isExpired() {
        return Date.now() > this.expiresAt;
    }

    canBeExecuted(threshold) {
        return this.approvals.length >= threshold && !this.isExpired();
    }

    toJSON() {
        return {
            id: this.id,
            oldAddress: this.oldAddress,
            newAddress: this.newAddress,
            requestedBy: this.requestedBy,
            approvals: this.approvals,
            rejections: this.rejections,
            status: this.status,
            createdAt: this.createdAt,
            expiresAt: this.expiresAt,
            timeRemaining: Math.max(0, this.expiresAt - Date.now())
        };
    }
}

class SocialRecovery {
    constructor() {
        this.recoveryConfigs = new Map();
        this.recoveryRequests = new Map();
        this.recoveredWallets = new Map();
    }

    setupRecovery(walletAddress, guardians, threshold) {
        if (threshold < 2) {
            throw new Error('Recovery threshold must be at least 2 for security');
        }
        const config = new RecoveryConfig(walletAddress, guardians, threshold);
        config.isValid();
        
        this.recoveryConfigs.set(walletAddress, config);
        console.log(`Social recovery configured for ${walletAddress} with ${guardians.length} guardians (threshold: ${threshold})`);
        return config;
    }

    getRecoveryConfig(walletAddress) {
        return this.recoveryConfigs.get(walletAddress);
    }

    hasRecoveryConfig(walletAddress) {
        return this.recoveryConfigs.has(walletAddress);
    }

    initiateRecovery(oldAddress, newAddress, initiatorAddress) {
        const config = this.recoveryConfigs.get(oldAddress);
        if (!config) {
            throw new Error('No recovery configuration found for this wallet');
        }

        if (!config.active) {
            throw new Error('Recovery configuration is not active');
        }

        const existingRequest = Array.from(this.recoveryRequests.values())
            .find(req => req.oldAddress === oldAddress && req.status === 'pending');
        
        if (existingRequest) {
            throw new Error('There is already a pending recovery request for this wallet');
        }

        const request = new RecoveryRequest(oldAddress, newAddress, initiatorAddress);
        this.recoveryRequests.set(request.id, request);
        
        console.log(`Recovery request ${request.id} initiated for ${oldAddress} -> ${newAddress}`);
        return request;
    }

    approveRecovery(requestId, guardianAddress) {
        const request = this.recoveryRequests.get(requestId);
        if (!request) {
            throw new Error('Recovery request not found');
        }

        if (request.status !== 'pending') {
            throw new Error(`Recovery request is ${request.status}`);
        }

        if (request.isExpired()) {
            request.status = 'expired';
            throw new Error('Recovery request has expired');
        }

        const config = this.recoveryConfigs.get(request.oldAddress);
        if (!config.guardians.includes(guardianAddress)) {
            throw new Error('Address is not a guardian for this wallet');
        }

        request.addApproval(guardianAddress);
        console.log(`Guardian ${guardianAddress} approved recovery ${requestId} (${request.approvals.length}/${config.threshold})`);

        return request;
    }

    rejectRecovery(requestId, guardianAddress) {
        const request = this.recoveryRequests.get(requestId);
        if (!request) {
            throw new Error('Recovery request not found');
        }

        if (request.status !== 'pending') {
            throw new Error(`Recovery request is ${request.status}`);
        }

        const config = this.recoveryConfigs.get(request.oldAddress);
        if (!config.guardians.includes(guardianAddress)) {
            throw new Error('Address is not a guardian for this wallet');
        }

        request.addRejection(guardianAddress);
        console.log(`Guardian ${guardianAddress} rejected recovery ${requestId}`);

        return request;
    }

    executeRecovery(requestId) {
        const request = this.recoveryRequests.get(requestId);
        if (!request) {
            throw new Error('Recovery request not found');
        }

        if (request.status !== 'pending') {
            throw new Error(`Recovery request is ${request.status}`);
        }

        if (request.isExpired()) {
            request.status = 'expired';
            throw new Error('Recovery request has expired');
        }

        const config = this.recoveryConfigs.get(request.oldAddress);
        if (!request.canBeExecuted(config.threshold)) {
            throw new Error(`Not enough approvals. Required: ${config.threshold}, Got: ${request.approvals.length}`);
        }

        this.recoveredWallets.set(request.oldAddress, {
            newAddress: request.newAddress,
            recoveredAt: Date.now(),
            requestId: requestId
        });

        config.active = false;
        request.status = 'executed';

        console.log(`Recovery executed: ${request.oldAddress} -> ${request.newAddress}`);
        return {
            oldAddress: request.oldAddress,
            newAddress: request.newAddress,
            message: 'Wallet recovered successfully! All future transactions should use the new address.'
        };
    }

    getRecoveryRequest(requestId) {
        const request = this.recoveryRequests.get(requestId);
        return request ? request.toJSON() : null;
    }

    getRecoveryRequestsForGuardian(guardianAddress) {
        const requests = [];
        for (const [requestId, request] of this.recoveryRequests) {
            const config = this.recoveryConfigs.get(request.oldAddress);
            if (config && config.guardians.includes(guardianAddress) && request.status === 'pending') {
                requests.push(request.toJSON());
            }
        }
        return requests;
    }

    getRecoveryRequestsForWallet(walletAddress) {
        const requests = [];
        for (const [requestId, request] of this.recoveryRequests) {
            if (request.oldAddress === walletAddress || request.newAddress === walletAddress) {
                requests.push(request.toJSON());
            }
        }
        return requests;
    }

    cleanupExpiredRequests() {
        let cleaned = 0;
        if (!this.recoveryRequests || !(this.recoveryRequests instanceof Map)) {
            console.log('⚠️  Recovery requests not initialized, skipping cleanup');
            return 0;
        }
        for (const [requestId, request] of this.recoveryRequests) {
            if (request.isExpired() && request.status === 'pending') {
                request.status = 'expired';
                cleaned++;
            }
        }
        if (cleaned > 0) {
            console.log(`🧹 Cleaned up ${cleaned} expired recovery requests`);
        }
        return cleaned;
    }
}

module.exports = { SocialRecovery, RecoveryConfig, RecoveryRequest };
