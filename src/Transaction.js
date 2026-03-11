const SHA256 = require('crypto-js/sha256');
const EC = require('./secp256k1-compat').ec;
const ec = new EC('secp256k1');

class Transaction {
    constructor(fromAddress, toAddress, amount, fee = 0, message = '', isSystemTx = false) {
        this.fromAddress = fromAddress;
        this.toAddress = toAddress;
        this.amount = amount;
        this.fee = fee;
        this.timestamp = Date.now();
        this.signature = null;
        this.submittedAt = null;
        this.status = 'pending';
        this.message = message;
        this.isSystemTx = isSystemTx;
        
        // Validate transaction parameters
        this.validateTransaction();
    }

    validateTransaction() {
        // Validate amounts and fees are positive
        if (this.amount <= 0) {
            throw new Error('Transaction amount must be positive');
        }
        
        if (this.fee < 0) {
            throw new Error('Transaction fee cannot be negative');
        }

        // Prevent self-transfers
        if (this.fromAddress === this.toAddress) {
            throw new Error('Cannot send tokens to yourself');
        }

        if (this.isSystemTx) {
            return;
        }

        // Validate addresses (skip for system transactions)
        if (this.fromAddress && this.fromAddress.length !== 130) {
            throw new Error('Invalid from address format');
        }
        
        if (this.toAddress && this.toAddress.length !== 130) {
            throw new Error('Invalid to address format');
        }
    }

    calculateHash() {
        return SHA256(this.fromAddress + this.toAddress + this.amount + this.fee + this.timestamp + this.message).toString();
    }

    signTransaction(signingKey) {
        if (signingKey.getPublic('hex') !== this.fromAddress) {
            throw new Error('You cannot sign transactions for other wallets!');
        }

        const hashTx = this.calculateHash();
        const sig = signingKey.sign(hashTx, 'base64');
        this.signature = sig.toDER('hex');
    }

    isValid() {
        // Mining reward transactions from null address are valid
        if (this.fromAddress === null) return true;

        // System transactions (escrow, royalty, burn) don't require signatures
        if (this.isSystemTx) return true;

        if (!this.signature || this.signature.length === 0) {
            throw new Error('No signature in this transaction');
        }

        const publicKey = ec.keyFromPublic(this.fromAddress, 'hex');
        return publicKey.verify(this.calculateHash(), this.signature);
    }

    canBeCancelled() {
        if (this.status !== 'pending') return false;
        if (!this.submittedAt) return false;
        
        const REVERSAL_WINDOW_MS = 5 * 60 * 1000;
        const timeSinceSubmission = Date.now() - this.submittedAt;
        return timeSinceSubmission < REVERSAL_WINDOW_MS;
    }

    getTimeRemaining() {
        if (!this.submittedAt) return 0;
        const REVERSAL_WINDOW_MS = 5 * 60 * 1000;
        const elapsed = Date.now() - this.submittedAt;
        return Math.max(0, REVERSAL_WINDOW_MS - elapsed);
    }
}

module.exports = Transaction;