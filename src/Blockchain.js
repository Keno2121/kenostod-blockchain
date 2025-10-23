const Block = require('./Block');
const Transaction = require('./Transaction');
const ScheduledTransaction = require('./ScheduledTransaction');

class Blockchain {
    constructor() {
        this.chain = [this.createGenesisBlock()];
        this.difficulty = 2;
        this.pendingTransactions = [];
        this.scheduledTransactions = [];
        this.miningReward = 100;
        this.tokenName = 'Kenostod';
        this.tokenSymbol = 'KENO';
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

    getChainStats() {
        return {
            totalBlocks: this.chain.length,
            totalTransactions: this.chain.reduce((acc, block) => acc + block.transactions.length, 0),
            difficulty: this.difficulty,
            pendingTransactions: this.pendingTransactions.length,
            scheduledTransactions: this.scheduledTransactions.filter(st => st.status === 'active').length,
            isValid: this.isChainValid(),
            tokenName: this.tokenName,
            tokenSymbol: this.tokenSymbol,
            miningReward: this.miningReward
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
}

module.exports = Blockchain;