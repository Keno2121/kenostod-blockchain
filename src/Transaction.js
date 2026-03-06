const SHA256 = require('crypto-js/sha256');
const { secp256k1 } = require('@noble/curves/secp256k1.js');

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
        
        this.validateTransaction();
    }

    validateTransaction() {
        if (this.amount <= 0) {
            throw new Error('Transaction amount must be positive');
        }
        
        if (this.fee < 0) {
            throw new Error('Transaction fee cannot be negative');
        }

        if (this.fromAddress === this.toAddress) {
            throw new Error('Cannot send tokens to yourself');
        }

        if (this.isSystemTx) {
            return;
        }

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

    signTransaction(privateKeyHex) {
        const privKeyBytes = Buffer.from(privateKeyHex, 'hex');
        const pubKeyHex = Buffer.from(
            secp256k1.getPublicKey(privKeyBytes, false)
        ).toString('hex');

        if (pubKeyHex !== this.fromAddress) {
            throw new Error('You cannot sign transactions for other wallets!');
        }

        const hashBytes = Buffer.from(this.calculateHash(), 'hex');
        const sigBytes = secp256k1.sign(hashBytes, privKeyBytes, { format: 'der' });
        this.signature = Buffer.from(sigBytes).toString('hex');
    }

    isValid() {
        if (this.fromAddress === null) return true;
        if (this.isSystemTx) return true;

        if (!this.signature || this.signature.length === 0) {
            throw new Error('No signature in this transaction');
        }

        const hashBytes = Buffer.from(this.calculateHash(), 'hex');
        return secp256k1.verify(
            Buffer.from(this.signature, 'hex'),
            hashBytes,
            Buffer.from(this.fromAddress, 'hex'),
            { format: 'der' }
        );
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
