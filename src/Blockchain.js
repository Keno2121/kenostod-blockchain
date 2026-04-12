const Block = require('./Block');
const Transaction = require('./Transaction');
const ScheduledTransaction = require('./ScheduledTransaction');
const { SocialRecovery } = require('./SocialRecovery');
const { ReputationSystem } = require('./Reputation');
const Governance = require('./Governance');
const ResidualValueToken = require('./ResidualValueToken');
const ComputationalJob = require('./ComputationalJob');
const RoyaltyPool = require('./RoyaltyPool');
const BuyAndBurn = require('./BuyAndBurn');
const { monitor: benfordMonitor } = require('./Benford');
const { EnterpriseClientManager } = require('./EnterpriseClient');
const MerchantAccount = require('./MerchantAccount');
const PaymentGateway = require('./PaymentGateway');
const ExchangeAPI = require('./ExchangeAPI');

class Blockchain {
    constructor() {
        this.chain = [this.createGenesisBlock()];
        this.difficulty = 2;
        this.pendingTransactions = [];
        this.scheduledTransactions = [];
        this.socialRecovery = new SocialRecovery();
        this.reputation = new ReputationSystem();
        this.governance = new Governance();
        this.miningReward = 100;
        this.minimumFee = 0;
        this.tokenName = 'Kenostod';
        this.tokenSymbol = 'KENO';
        
        this.royaltyPool = new RoyaltyPool(this);
        this.buyAndBurn = new BuyAndBurn(this);
        this.enterpriseClients = new EnterpriseClientManager();
        this.computationalJobs = new Map();
        this.residualValueTokens = new Map();
        this.porvEnabled = true;
        
        this.merchantAccount = new MerchantAccount();
        this.paymentGateway = new PaymentGateway(this, this.merchantAccount);
        this.exchangeAPI = new ExchangeAPI(this);
    }

    createGenesisBlock() {
        return new Block(Date.parse("2025-01-01"), [], "0");
    }

    getLatestBlock() {
        return this.chain[this.chain.length - 1];
    }

    minePendingTransactions(miningRewardAddress) {
        // Calculate total fees from pending transactions
        const totalFees = this.pendingTransactions.reduce((sum, tx) => sum + tx.fee, 0);
        
        // Add mining reward transaction (includes base reward + fees)
        const rewardTransaction = new Transaction(null, miningRewardAddress, this.miningReward + totalFees);
        rewardTransaction.status = 'confirmed';
        rewardTransaction.submittedAt = null;
        this.pendingTransactions.push(rewardTransaction);

        // Clone transactions and mark as confirmed (prevents cancellation after mining)
        const transactionsToMine = this.pendingTransactions.map(tx => {
            const clonedTx = Object.assign(Object.create(Object.getPrototypeOf(tx)), tx);
            clonedTx.status = 'confirmed';
            return clonedTx;
        });

        // Create new block with cloned confirmed transactions
        const block = new Block(Date.now(), transactionsToMine, this.getLatestBlock().hash);
        block.mineBlock(this.difficulty);

        console.log('Block successfully mined!');
        console.log(`Miner reward: ${this.miningReward} KENO + ${totalFees} KENO fees = ${this.miningReward + totalFees} KENO total`);
        
        this.chain.push(block);
        this.pendingTransactions = [];
    }

    createTransaction(transaction) {
        if (!transaction.fromAddress || !transaction.toAddress) {
            throw new Error('Transaction must include from and to address');
        }

        if (!transaction.isValid()) {
            throw new Error('Cannot add invalid transaction to chain');
        }

        // Check if sender has enough balance (including pending transactions)
        if (transaction.fromAddress !== null) {
            const availableBalance = this.getAvailableBalance(transaction.fromAddress);
            if (availableBalance < transaction.amount + transaction.fee) {
                throw new Error(`Not enough balance. Available: ${availableBalance} KENO, Required: ${transaction.amount + transaction.fee} KENO`);
            }
        }

        transaction.submittedAt = Date.now();
        transaction.status = 'pending';
        this.pendingTransactions.push(transaction);

        // Benford's Law: record amount for silent fraud pattern analysis
        benfordMonitor.record(transaction.fromAddress, transaction.amount);
    }

    cancelTransaction(transactionHash, senderAddress) {
        const txIndex = this.pendingTransactions.findIndex(tx => tx.calculateHash() === transactionHash);
        
        if (txIndex === -1) {
            throw new Error('Transaction not found in pending pool. It may have already been mined.');
        }

        const transaction = this.pendingTransactions[txIndex];

        if (transaction.status !== 'pending') {
            throw new Error('Transaction has already been confirmed and cannot be cancelled');
        }

        if (transaction.fromAddress !== senderAddress) {
            throw new Error('Only the sender can cancel their transaction');
        }

        if (!transaction.canBeCancelled()) {
            throw new Error('Transaction reversal window has expired (5 minutes maximum)');
        }

        transaction.status = 'cancelled';
        this.pendingTransactions.splice(txIndex, 1);
        
        return transaction;
    }

    getPendingTransactionsForAddress(address) {
        return this.pendingTransactions
            .filter(tx => tx.fromAddress === address || tx.toAddress === address)
            .map(tx => ({
                hash: tx.calculateHash(),
                fromAddress: tx.fromAddress,
                toAddress: tx.toAddress,
                amount: tx.amount,
                fee: tx.fee,
                timestamp: tx.timestamp,
                submittedAt: tx.submittedAt,
                status: tx.status,
                message: tx.message,
                canBeCancelled: tx.canBeCancelled(),
                timeRemaining: tx.getTimeRemaining()
            }));
    }

    getAvailableBalance(address) {
        // Get confirmed balance from the blockchain
        const confirmedBalance = this.getBalanceOfAddress(address);
        
        // Subtract pending outgoing transactions and fees
        const pendingOutgoing = this.pendingTransactions
            .filter(tx => tx.fromAddress === address)
            .reduce((sum, tx) => sum + tx.amount + tx.fee, 0);
            
        return confirmedBalance - pendingOutgoing;
    }

    getBalanceOfAddress(address) {
        let balance = 0;

        for (const block of this.chain) {
            for (const trans of block.transactions) {
                if (trans.fromAddress === address) {
                    balance -= trans.amount + trans.fee;
                }

                if (trans.toAddress === address) {
                    balance += trans.amount;
                }
            }
        }

        if (this.socialRecovery.recoveredWallets.has(address)) {
            return 0;
        }

        return balance;
    }

    getAllTransactionsForWallet(address) {
        const txs = [];

        for (const block of this.chain) {
            for (const tx of block.transactions) {
                if (tx.fromAddress === address || tx.toAddress === address) {
                    txs.push(tx);
                }
            }
        }

        return txs;
    }

    isChainValid() {
        for (let i = 1; i < this.chain.length; i++) {
            const currentBlock = this.chain[i];
            const previousBlock = this.chain[i - 1];

            if (!currentBlock.hasValidTransactions()) {
                return false;
            }

            if (currentBlock.hash !== currentBlock.calculateHash()) {
                return false;
            }

            if (currentBlock.previousHash !== previousBlock.hash) {
                return false;
            }

            // Verify proof-of-work: block hash must meet difficulty target
            const target = Array(this.difficulty + 1).join("0");
            if (currentBlock.hash.substring(0, this.difficulty) !== target) {
                return false;
            }
        }

        return true;
    }

    executeWalletRecovery(requestId) {
        const request = this.socialRecovery.getRecoveryRequest(requestId);
        if (!request) {
            throw new Error('Recovery request not found');
        }
        
        const oldBalance = this.getBalanceOfAddress(request.oldAddress);
        
        const result = this.socialRecovery.executeRecovery(requestId);
        
        const recoveryData = this.socialRecovery.recoveredWallets.get(result.oldAddress);
        if (recoveryData) {
            recoveryData.originalBalance = oldBalance;
        }
        
        if (oldBalance > 0) {
            const creditTx = new Transaction(null, result.newAddress, oldBalance, 0, `Wallet Recovery: ${oldBalance} KENO recovered from ${result.oldAddress.substring(0, 20)}...`);
            creditTx.status = 'confirmed';
            creditTx.submittedAt = null;
            this.pendingTransactions.push(creditTx);
            
            console.log(`Wallet recovery executed: ${oldBalance} KENO transferred to new address`);
            console.log(`  - Old address ${result.oldAddress.substring(0, 20)}... balance locked (returns 0)`);
            console.log(`  - New address ${result.newAddress.substring(0, 20)}... credited ${oldBalance} KENO`);
            console.log(`  - Supply tracking: +${oldBalance} minted, +${oldBalance} burned = ${0} net change`);
        }
        
        return result;
    }

    getTotalSupply() {
        let totalMinted = 0;
        let totalBurned = 0;
        
        for (const block of this.chain) {
            for (const tx of block.transactions) {
                if (tx.fromAddress === null) {
                    totalMinted += tx.amount;
                }
            }
        }
        
        for (const [oldAddress, recovery] of this.socialRecovery.recoveredWallets) {
            totalBurned += recovery.originalBalance;
        }
        
        const burnAddressBalance = this.getBalanceOfAddress(this.buyAndBurn.burnWalletAddress);
        totalBurned += burnAddressBalance;
        
        return {
            totalMinted,
            totalBurned,
            burnedViaPoRV: burnAddressBalance,
            burnedViaSocialRecovery: Array.from(this.socialRecovery.recoveredWallets.values())
                .reduce((sum, r) => sum + r.originalBalance, 0),
            circulatingSupply: totalMinted - totalBurned
        };
    }

    getChainStats() {
        const supply = this.getTotalSupply();
        
        return {
            totalBlocks: this.chain.length,
            totalTransactions: this.chain.reduce((acc, block) => acc + block.transactions.length, 0),
            difficulty: this.difficulty,
            pendingTransactions: this.pendingTransactions.length,
            scheduledTransactions: this.scheduledTransactions.filter(st => st.status === 'active').length,
            isValid: this.isChainValid(),
            tokenName: this.tokenName,
            tokenSymbol: this.tokenSymbol,
            miningReward: this.miningReward,
            supply: supply
        };
    }

    createScheduledTransaction(scheduledTx) {
        if (!scheduledTx.fromAddress || !scheduledTx.toAddress) {
            throw new Error('Scheduled transaction must include from and to address');
        }

        const balance = this.getBalanceOfAddress(scheduledTx.fromAddress);
        if (balance < scheduledTx.amount + scheduledTx.fee) {
            throw new Error(`Insufficient balance. Available: ${balance} KENO, Required: ${scheduledTx.amount + scheduledTx.fee} KENO`);
        }

        this.scheduledTransactions.push(scheduledTx);
        console.log(`Scheduled payment created: ${scheduledTx.id}`);
        return scheduledTx.id;
    }

    cancelScheduledTransaction(scheduleId, senderAddress) {
        const scheduled = this.scheduledTransactions.find(st => st.id === scheduleId);
        
        if (!scheduled) {
            throw new Error('Scheduled transaction not found');
        }

        if (scheduled.fromAddress !== senderAddress) {
            throw new Error('Only the sender can cancel their scheduled transaction');
        }

        if (scheduled.status !== 'active') {
            throw new Error(`Scheduled transaction is ${scheduled.status} and cannot be cancelled`);
        }

        scheduled.cancel();
        console.log(`Scheduled payment cancelled: ${scheduleId}`);
        return scheduled;
    }

    getScheduledTransactionsForAddress(address) {
        return this.scheduledTransactions
            .filter(st => st.fromAddress === address || st.toAddress === address)
            .map(st => st.toJSON());
    }

    processScheduledTransactions(signingKey) {
        const executed = [];
        
        for (const scheduled of this.scheduledTransactions) {
            if (!scheduled.shouldExecute()) continue;
            
            try {
                const balance = this.getAvailableBalance(scheduled.fromAddress);
                if (balance < scheduled.amount + scheduled.fee) {
                    console.log(`Skipping scheduled ${scheduled.id}: insufficient balance`);
                    continue;
                }

                const tx = scheduled.createTransaction();
                
                if (signingKey) {
                    tx.signTransaction(signingKey);
                }
                
                tx.signature = scheduled.signature;
                
                this.createTransaction(tx);
                scheduled.markExecuted();
                
                executed.push({
                    scheduleId: scheduled.id,
                    transactionHash: tx.calculateHash(),
                    amount: tx.amount
                });
                
                console.log(`Executed scheduled payment: ${scheduled.id}`);
            } catch (error) {
                console.error(`Error executing scheduled ${scheduled.id}:`, error.message);
            }
        }
        
        this.scheduledTransactions = this.scheduledTransactions.filter(st => 
            st.status === 'active' || st.executionCount < st.schedule.maxOccurrences
        );
        
        return executed;
    }

    createGovernanceProposal(proposerAddress, title, description, parameterName, newValue) {
        const balance = this.getBalanceOfAddress(proposerAddress);
        if (balance === 0) {
            throw new Error('Must hold KENO tokens to create a proposal');
        }

        const proposal = this.governance.createProposal(proposerAddress, title, description, parameterName, newValue);
        proposal.currentValue = this[parameterName];
        
        return proposal;
    }

    voteOnProposal(proposalId, voterAddress, vote) {
        const votingPower = this.getBalanceOfAddress(voterAddress);
        return this.governance.castVote(proposalId, voterAddress, vote, votingPower);
    }

    checkAndExecuteProposals() {
        const supply = this.getTotalSupply();
        const totalSupply = supply.circulatingSupply;

        const activeProposals = this.governance.getActiveProposals();
        
        for (const proposal of activeProposals) {
            this.governance.checkProposalStatus(proposal.id, totalSupply);
        }

        const approvedProposals = this.governance.getApprovedProposals();
        
        for (const proposal of approvedProposals) {
            try {
                const oldValue = this[proposal.parameterName];
                this[proposal.parameterName] = proposal.newValue;
                this.governance.markProposalExecuted(proposal.id);
                
                console.log(`Governance: ${proposal.parameterName} changed from ${oldValue} to ${proposal.newValue}`);
                console.log(`  Proposal "${proposal.title}" executed successfully`);
            } catch (error) {
                console.error(`Failed to execute proposal ${proposal.id}:`, error.message);
            }
        }
    }

    getGovernanceStats() {
        const proposals = this.governance.getAllProposals();
        const activeProposals = this.governance.getActiveProposals();
        
        return {
            totalProposals: proposals.length,
            activeProposals: activeProposals.length,
            approvedProposals: proposals.filter(p => p.status === 'approved').length,
            rejectedProposals: proposals.filter(p => p.status === 'rejected').length,
            executedProposals: proposals.filter(p => p.executed).length,
            votingPeriodDays: this.governance.votingPeriod / (24 * 60 * 60 * 1000),
            minimumParticipation: `${(this.governance.minimumParticipation * 100).toFixed(0)}%`,
            approvalThreshold: `${(this.governance.approvalThreshold * 100).toFixed(0)}%`
        };
    }

    createSystemTransaction(fromAddress, toAddress, amount, message = '') {
        if (fromAddress !== null) {
            const confirmedBalance = this.getBalanceOfAddress(fromAddress);
            
            const pendingInflows = this.pendingTransactions
                .filter(tx => tx.toAddress === fromAddress && tx.status === 'confirmed')
                .reduce((sum, tx) => sum + tx.amount, 0);
            
            const pendingOutflows = this.pendingTransactions
                .filter(tx => tx.fromAddress === fromAddress && tx.status === 'confirmed')
                .reduce((sum, tx) => sum + tx.amount, 0);
            
            const availableBalance = confirmedBalance + pendingInflows - pendingOutflows;
            
            if (availableBalance < amount) {
                throw new Error(`System transaction failed: ${fromAddress.substring(0, 20)}... has ${availableBalance} KENO available (${confirmedBalance} confirmed + ${pendingInflows} pending in - ${pendingOutflows} pending out), needs ${amount} KENO`);
            }
        }

        const sysTx = new Transaction(fromAddress, toAddress, amount, 0, message, true);
        sysTx.status = 'confirmed';
        sysTx.submittedAt = null;
        return sysTx;
    }

    createComputationalJobWithSignedPayment(clientId, jobType, parameters, upfrontFee, royaltyRate, escrowPaymentTx) {
        const client = this.enterpriseClients.getClient(clientId);
        if (!client) {
            throw new Error('Enterprise client not found');
        }

        if (!client.isActive) {
            throw new Error('Client account is inactive');
        }

        const job = new ComputationalJob(clientId, jobType, parameters, upfrontFee, royaltyRate);
        job.escrowAddress = 'JOB_ESCROW_' + job.jobId;

        const tx = new Transaction(
            escrowPaymentTx.fromAddress,
            escrowPaymentTx.toAddress,
            escrowPaymentTx.amount,
            escrowPaymentTx.fee,
            escrowPaymentTx.message || ''
        );
        tx.timestamp = escrowPaymentTx.timestamp;
        tx.signature = escrowPaymentTx.signature;

        if (tx.fromAddress !== client.walletAddress) {
            throw new Error('Escrow payment must come from registered client wallet');
        }

        if (tx.toAddress !== job.escrowAddress) {
            throw new Error(`Escrow payment must be sent to ${job.escrowAddress}`);
        }

        if (tx.amount !== upfrontFee) {
            throw new Error(`Escrow payment amount (${tx.amount}) must match upfront fee (${upfrontFee})`);
        }

        if (!tx.isValid()) {
            throw new Error('Invalid escrow payment signature');
        }

        const availableBalance = this.getAvailableBalance(client.walletAddress);
        if (availableBalance < tx.amount + tx.fee) {
            throw new Error(`Insufficient balance. Client has ${availableBalance} KENO, needs ${tx.amount + tx.fee} KENO`);
        }

        this.createTransaction(tx);
        
        this.computationalJobs.set(job.jobId, job);
        client.addJob(job.jobId);
        client.recordPayment(upfrontFee);

        console.log(`💼 New computational job created: ${job.jobId} for ${client.name}`);
        console.log(`   Type: ${jobType}, Upfront Fee: ${upfrontFee} KENO (escrowed via signed tx), Royalty Rate: ${royaltyRate}%`);
        console.log(`   ✅ Escrow payment verified and signed by client`);

        return job;
    }

    minePoRVBlock(minerAddress, jobId = null) {
        if (!this.porvEnabled) {
            this.minePendingTransactions(minerAddress);
            return null;
        }

        let job = null;
        let rvt = null;

        if (jobId) {
            job = this.computationalJobs.get(jobId);
            if (!job || job.status !== 'pending') {
                throw new Error('Job not available for mining');
            }
            job.assignToMiner(minerAddress);
        }

        const totalFees = this.pendingTransactions.reduce((sum, tx) => sum + tx.fee, 0);

        const baseRewardTx = new Transaction(null, minerAddress, this.miningReward + totalFees);
        baseRewardTx.status = 'confirmed';
        baseRewardTx.submittedAt = null;
        this.pendingTransactions.push(baseRewardTx);

        if (job) {
            const escrowReleaseTx = this.createSystemTransaction(job.escrowAddress, minerAddress, job.upfrontFee, `Job ${job.jobId} completion payment`);
            this.pendingTransactions.push(escrowReleaseTx);
        }

        const transactionsToMine = this.pendingTransactions.map(tx => {
            const clonedTx = Object.assign(Object.create(Object.getPrototypeOf(tx)), tx);
            clonedTx.status = 'confirmed';
            return clonedTx;
        });

        const block = new Block(Date.now(), transactionsToMine, this.getLatestBlock().hash);
        block.mineBlock(this.difficulty);

        console.log('✅ PoRV Block successfully mined!');
        console.log(`💰 Miner reward: ${this.miningReward} KENO + ${totalFees} KENO fees`);

        if (job) {
            const outputHash = block.hash.substring(0, 32);
            job.complete(minerAddress, this.chain.length, outputHash);

            rvt = new ResidualValueToken(
                job.jobId,
                minerAddress,
                this.chain.length,
                job.jobType,
                { clientId: job.clientId, jobType: job.jobType }
            );
            this.residualValueTokens.set(rvt.rvtId, rvt);
            this.royaltyPool.assignRVT(minerAddress, rvt.rvtId);
            job.deploy(rvt.rvtId);

            console.log(`🎫 RVT issued: ${rvt.rvtId}`);
            console.log(`💎 Job bonus: ${job.upfrontFee} KENO (released from escrow)`);
            console.log(`📊 Royalty rate: ${job.royaltyRate}% on commercial use`);
        }

        this.chain.push(block);
        this.pendingTransactions = [];

        return { job, rvt, block };
    }

    recordApiUsageWithSignedPayment(jobId, revenueGenerated, royaltyPaymentTx) {
        const job = this.computationalJobs.get(jobId);
        if (!job) {
            throw new Error('Job not found');
        }

        if (job.status !== 'deployed') {
            throw new Error('Job must be deployed before usage tracking');
        }

        const client = this.enterpriseClients.getClient(job.clientId);
        if (!client) {
            throw new Error('Client not found');
        }

        job.recordApiCall(revenueGenerated);
        
        const royaltyAmount = job.calculateRoyalty(revenueGenerated);
        
        const clientBalance = this.getBalanceOfAddress(client.walletAddress);
        if (clientBalance < royaltyAmount) {
            throw new Error(`Client has insufficient balance for royalty payment. Has ${clientBalance} KENO, needs ${royaltyAmount} KENO`);
        }

        const rvt = this.residualValueTokens.get(job.rvtId);
        if (!rvt) {
            throw new Error('RVT not found for this job');
        }

        const royaltyPoolAddress = 'ROYALTY_POOL_' + job.jobId;

        const tx = new Transaction(
            royaltyPaymentTx.fromAddress,
            royaltyPaymentTx.toAddress,
            royaltyPaymentTx.amount,
            royaltyPaymentTx.fee,
            royaltyPaymentTx.message || ''
        );
        tx.timestamp = royaltyPaymentTx.timestamp;
        tx.signature = royaltyPaymentTx.signature;

        if (tx.fromAddress !== client.walletAddress) {
            throw new Error('Royalty payment must come from registered client wallet');
        }

        if (tx.toAddress !== royaltyPoolAddress) {
            throw new Error(`Royalty payment must be sent to ${royaltyPoolAddress}`);
        }

        if (tx.amount !== royaltyAmount) {
            throw new Error(`Royalty payment amount (${tx.amount}) must match calculated royalty (${royaltyAmount})`);
        }

        if (!tx.isValid()) {
            throw new Error('Invalid royalty payment signature');
        }

        const availableBalance = this.getAvailableBalance(client.walletAddress);
        if (availableBalance < tx.amount + tx.fee) {
            throw new Error(`Insufficient balance. Client has ${availableBalance} KENO, needs ${tx.amount + tx.fee} KENO`);
        }

        this.createTransaction(tx);

        const collection = this.royaltyPool.collectRoyalty(
            job.jobId,
            rvt.rvtId,
            royaltyAmount,
            'API_USAGE'
        );

        const distribution = this.royaltyPool.distributeRoyalty(collection.collectionId, rvt);

        const minerPayoutTx = this.createSystemTransaction(royaltyPoolAddress, distribution.holderAddress, distribution.minerPayout, `RVT royalty distribution (50%)`);
        const treasuryAddress = 'TREASURY_NETWORK';
        const treasuryTx = this.createSystemTransaction(royaltyPoolAddress, treasuryAddress, distribution.treasuryAmount, `Treasury allocation (10%)`);
        const burnTx = this.createSystemTransaction(royaltyPoolAddress, this.buyAndBurn.burnWalletAddress, distribution.burnAmount, `Token burn (40%)`);

        this.pendingTransactions.push(minerPayoutTx, treasuryTx, burnTx);
        
        const actualBurn = this.buyAndBurn.executeBurn(distribution.burnAmount, 'ROYALTY_POOL');

        client.recordRoyalty(royaltyAmount);

        console.log(`📈 API usage recorded for ${jobId}`);
        console.log(`   Revenue: $${revenueGenerated}, Royalty: ${royaltyAmount} KENO (paid via signed tx)`);
        console.log(`   ✅ Royalty payment verified and signed by client`);
        console.log(`   Miner payout: ${distribution.minerPayout} KENO (50%)`);
        console.log(`   Treasury: ${distribution.treasuryAmount} KENO (10%)`);
        console.log(`   Burned: ${distribution.burnAmount} KENO (40%)`);

        return {
            job: job.toJSON(),
            royalty: royaltyAmount,
            distribution,
            burnRecord: actualBurn
        };
    }

    getPoRVStats() {
        const jobs = Array.from(this.computationalJobs.values());
        const rvts = Array.from(this.residualValueTokens.values());
        
        return {
            enabled: this.porvEnabled,
            totalJobs: jobs.length,
            pendingJobs: jobs.filter(j => j.status === 'pending').length,
            completedJobs: jobs.filter(j => j.status === 'completed').length,
            deployedJobs: jobs.filter(j => j.status === 'deployed').length,
            totalRVTs: rvts.length,
            activeRVTs: rvts.filter(r => r.isActive).length,
            totalApiCalls: jobs.reduce((sum, j) => sum + j.totalApiCalls, 0),
            totalRevenue: jobs.reduce((sum, j) => sum + j.totalRevenue, 0),
            royaltyPool: this.royaltyPool.getPoolStats(),
            buyAndBurn: this.buyAndBurn.getBurnStats(),
            enterpriseClients: this.enterpriseClients.getStats()
        };
    }

    getRVTsForAddress(address) {
        const rvtIds = this.royaltyPool.getRVTsForAddress(address);
        return rvtIds.map(id => this.residualValueTokens.get(id)).filter(r => r);
    }

    getJobDetails(jobId) {
        const job = this.computationalJobs.get(jobId);
        if (!job) {
            throw new Error('Job not found');
        }
        return job.toJSON();
    }

    getAllJobs() {
        return Array.from(this.computationalJobs.values()).map(j => j.toJSON());
    }

    getAvailableJobs() {
        return Array.from(this.computationalJobs.values())
            .filter(j => j.status === 'pending')
            .map(j => j.toJSON());
    }

    restoreFromData(data) {
        if (!data) return false;
        
        try {
            this.chain = data.chain.map(blockData => {
                const block = Object.create(Block.prototype);
                Object.assign(block, blockData);
                block.transactions = blockData.transactions.map(txData => {
                    const tx = Object.create(Transaction.prototype);
                    Object.assign(tx, txData);
                    return tx;
                });
                return block;
            });
            
            this.difficulty = data.difficulty || 2;
            this.miningReward = data.miningReward || 100;
            this.totalMinted = data.totalMinted || 0;
            this.totalBurned = data.totalBurned || 0;
            
            this.pendingTransactions = (data.pendingTransactions || []).map(txData => {
                const tx = Object.create(Transaction.prototype);
                Object.assign(tx, txData);
                return tx;
            });
            
            this.scheduledTransactions = (data.scheduledTransactions || []).map(stData => {
                const st = Object.create(ScheduledTransaction.prototype);
                Object.assign(st, stData);
                return st;
            });
            
            if (data.socialRecovery) {
                this.socialRecovery.guardians = data.socialRecovery.guardians || new Map();
                this.socialRecovery.recoveryRequests = data.socialRecovery.recoveryRequests || new Map();
            }
            
            if (data.reputationSystem) {
                this.reputation.ratings = data.reputationSystem.ratings || new Map();
                this.reputation.reputationScores = data.reputationSystem.reputationScores || new Map();
            }
            
            if (data.governance) {
                this.governance.proposals = data.governance.proposals || [];
            }
            
            console.log(`✅ Blockchain restored: ${this.chain.length} blocks, ${this.totalMinted} KENO minted`);
            return true;
        } catch (error) {
            console.error('❌ Error restoring blockchain:', error.message);
            return false;
        }
    }
}

module.exports = Blockchain;