const Block = require('./Block');
const Transaction = require('./Transaction');

class Blockchain {
    constructor() {
        this.chain = [this.createGenesisBlock()];
        this.difficulty = 2;
        this.pendingTransactions = [];
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
        this.pendingTransactions.push(rewardTransaction);

        // Create new block with pending transactions
        const block = new Block(Date.now(), this.pendingTransactions, this.getLatestBlock().hash);
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

        this.pendingTransactions.push(transaction);
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
            isValid: this.isChainValid(),
            tokenName: this.tokenName,
            tokenSymbol: this.tokenSymbol,
            miningReward: this.miningReward
        };
    }
}

module.exports = Blockchain;