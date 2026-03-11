const crypto = require('crypto');

class BankingAPI {
    constructor(blockchain, dataPersistence = null) {
        this.blockchain = blockchain;
        this.dataPersistence = dataPersistence;
        
        this.accounts = new Map();
        this.deposits = new Map();
        this.withdrawals = new Map();
        this.transactions = new Map();
        
        this.fiatBalances = new Map();
        
        this.depositIdCounter = 1;
        this.withdrawalIdCounter = 1;
        this.transactionIdCounter = 1;
        
        this.STRIPE_FEE_PERCENT = 0.029;
        this.STRIPE_FEE_FIXED = 0.30;
        this.PAYPAL_FEE_PERCENT = 0.0349;
        this.PAYPAL_FEE_FIXED = 0.49;
        
        this.MIN_DEPOSIT = 10;
        this.MIN_WITHDRAWAL = 10;
        this.MAX_DEPOSIT = 10000;
        this.MAX_WITHDRAWAL = 10000;
    }
    
    setDataPersistence(dataPersistence) {
        this.dataPersistence = dataPersistence;
    }
    
    loadFiatBalances(balancesMap) {
        if (balancesMap) {
            this.fiatBalances = balancesMap;
        }
    }
    
    saveFiatBalances() {
        if (this.dataPersistence) {
            this.dataPersistence.saveFiatBalances(this.fiatBalances);
        }
    }

    registerAccount(walletAddress, email, fullName) {
        if (this.accounts.has(walletAddress)) {
            return { success: false, error: 'Account already registered' };
        }

        const account = {
            walletAddress,
            email,
            fullName,
            registeredAt: Date.now(),
            verified: false,
            bankAccounts: [],
            paypalEmail: null,
            totalDeposited: 0,
            totalWithdrawn: 0
        };

        this.accounts.set(walletAddress, account);
        
        // Preserve existing balance if loaded from disk, otherwise initialize to 0
        if (!this.fiatBalances.has(walletAddress)) {
            this.fiatBalances.set(walletAddress, 0);
        }

        return {
            success: true,
            account
        };
    }

    addBankAccount(walletAddress, bankDetails) {
        const account = this.accounts.get(walletAddress);
        if (!account) {
            return { success: false, error: 'Account not found' };
        }

        const bankAccount = {
            id: crypto.randomBytes(16).toString('hex'),
            accountHolderName: bankDetails.accountHolderName,
            routingNumber: bankDetails.routingNumber,
            accountNumber: bankDetails.accountNumber,
            accountType: bankDetails.accountType || 'checking',
            addedAt: Date.now(),
            verified: false,
            last4: bankDetails.accountNumber.slice(-4)
        };

        account.bankAccounts.push(bankAccount);

        return {
            success: true,
            bankAccount: {
                ...bankAccount,
                accountNumber: undefined,
                routingNumber: undefined
            }
        };
    }

    addPayPalAccount(walletAddress, paypalEmail) {
        const account = this.accounts.get(walletAddress);
        if (!account) {
            return { success: false, error: 'Account not found' };
        }

        account.paypalEmail = paypalEmail;

        return {
            success: true,
            paypalEmail
        };
    }

    createDeposit(walletAddress, amount, method, paymentDetails = {}) {
        if (amount < this.MIN_DEPOSIT) {
            return { success: false, error: `Minimum deposit is $${this.MIN_DEPOSIT}` };
        }

        if (amount > this.MAX_DEPOSIT) {
            return { success: false, error: `Maximum deposit is $${this.MAX_DEPOSIT}` };
        }

        const account = this.accounts.get(walletAddress);
        if (!account) {
            return { success: false, error: 'Account not registered' };
        }

        let fee = 0;
        if (method === 'stripe') {
            fee = (amount * this.STRIPE_FEE_PERCENT) + this.STRIPE_FEE_FIXED;
        } else if (method === 'paypal') {
            fee = (amount * this.PAYPAL_FEE_PERCENT) + this.PAYPAL_FEE_FIXED;
        }

        const netAmount = amount - fee;

        const depositId = `DEP-${this.depositIdCounter++}`;
        const deposit = {
            depositId,
            walletAddress,
            amount,
            fee: parseFloat(fee.toFixed(2)),
            netAmount: parseFloat(netAmount.toFixed(2)),
            method,
            status: 'pending',
            paymentDetails,
            createdAt: Date.now(),
            completedAt: null,
            transactionId: null
        };

        this.deposits.set(depositId, deposit);

        return {
            success: true,
            deposit
        };
    }

    confirmDeposit(depositId, paymentIntentId = null) {
        const deposit = this.deposits.get(depositId);
        if (!deposit) {
            return { success: false, error: 'Deposit not found' };
        }

        if (deposit.status !== 'pending') {
            return { success: false, error: `Deposit already ${deposit.status}` };
        }

        deposit.status = 'completed';
        deposit.completedAt = Date.now();
        deposit.paymentIntentId = paymentIntentId;

        const currentBalance = this.fiatBalances.get(deposit.walletAddress) || 0;
        this.fiatBalances.set(deposit.walletAddress, currentBalance + deposit.netAmount);

        const account = this.accounts.get(deposit.walletAddress);
        if (account) {
            account.totalDeposited += deposit.netAmount;
        }

        const transactionId = `TXN-${this.transactionIdCounter++}`;
        const transaction = {
            transactionId,
            walletAddress: deposit.walletAddress,
            type: 'deposit',
            amount: deposit.netAmount,
            method: deposit.method,
            status: 'completed',
            timestamp: Date.now(),
            relatedId: depositId
        };

        this.transactions.set(transactionId, transaction);
        deposit.transactionId = transactionId;

        return {
            success: true,
            deposit,
            newBalance: this.fiatBalances.get(deposit.walletAddress)
        };
    }

    createWithdrawal(walletAddress, amount, method, destination = null) {
        if (amount < this.MIN_WITHDRAWAL) {
            return { success: false, error: `Minimum withdrawal is $${this.MIN_WITHDRAWAL}` };
        }

        if (amount > this.MAX_WITHDRAWAL) {
            return { success: false, error: `Maximum withdrawal is $${this.MAX_WITHDRAWAL}` };
        }

        const account = this.accounts.get(walletAddress);
        if (!account) {
            return { success: false, error: 'Account not registered' };
        }

        const currentBalance = this.fiatBalances.get(walletAddress) || 0;

        let fee = 0;
        if (method === 'stripe') {
            fee = (amount * this.STRIPE_FEE_PERCENT) + this.STRIPE_FEE_FIXED;
        } else if (method === 'paypal') {
            fee = (amount * this.PAYPAL_FEE_PERCENT) + this.PAYPAL_FEE_FIXED;
        }

        const totalRequired = amount + fee;

        if (currentBalance < totalRequired) {
            return { 
                success: false, 
                error: `Insufficient balance. Required: $${totalRequired.toFixed(2)}, Available: $${currentBalance.toFixed(2)}` 
            };
        }

        const withdrawalId = `WD-${this.withdrawalIdCounter++}`;
        const withdrawal = {
            withdrawalId,
            walletAddress,
            amount,
            fee: parseFloat(fee.toFixed(2)),
            totalAmount: parseFloat(totalRequired.toFixed(2)),
            method,
            destination: destination || 'stripe_connected_account',
            status: 'pending',
            createdAt: Date.now(),
            completedAt: null,
            transactionId: null
        };

        this.withdrawals.set(withdrawalId, withdrawal);

        // Deduct balance and save immediately to prevent double-payout if server crashes
        this.fiatBalances.set(walletAddress, currentBalance - totalRequired);
        this.saveFiatBalances();

        const transactionId = `TXN-${this.transactionIdCounter++}`;
        const transaction = {
            transactionId,
            walletAddress,
            type: 'withdrawal',
            amount: -totalRequired,
            method,
            status: 'pending',
            timestamp: Date.now(),
            relatedId: withdrawalId
        };

        this.transactions.set(transactionId, transaction);
        withdrawal.transactionId = transactionId;

        return {
            success: true,
            withdrawal,
            newBalance: this.fiatBalances.get(walletAddress)
        };
    }

    completeWithdrawal(withdrawalId, payoutId = null) {
        const withdrawal = this.withdrawals.get(withdrawalId);
        if (!withdrawal) {
            return { success: false, error: 'Withdrawal not found' };
        }

        if (withdrawal.status !== 'pending') {
            return { success: false, error: `Withdrawal already ${withdrawal.status}` };
        }

        withdrawal.status = 'completed';
        withdrawal.completedAt = Date.now();
        withdrawal.payoutId = payoutId;

        const account = this.accounts.get(withdrawal.walletAddress);
        if (account) {
            account.totalWithdrawn += withdrawal.amount;
        }

        const transaction = this.transactions.get(withdrawal.transactionId);
        if (transaction) {
            transaction.status = 'completed';
        }

        return {
            success: true,
            withdrawal
        };
    }

    cancelWithdrawal(withdrawalId) {
        const withdrawal = this.withdrawals.get(withdrawalId);
        if (!withdrawal) {
            return { success: false, error: 'Withdrawal not found' };
        }

        if (withdrawal.status !== 'pending') {
            return { success: false, error: `Cannot cancel ${withdrawal.status} withdrawal` };
        }

        withdrawal.status = 'cancelled';

        // Restore the balance that was deducted
        const currentBalance = this.fiatBalances.get(withdrawal.walletAddress) || 0;
        this.fiatBalances.set(withdrawal.walletAddress, currentBalance + withdrawal.totalAmount);
        
        // Save immediately to prevent balance loss on restart
        this.saveFiatBalances();

        const transaction = this.transactions.get(withdrawal.transactionId);
        if (transaction) {
            transaction.status = 'cancelled';
        }

        return {
            success: true,
            withdrawal,
            newBalance: this.fiatBalances.get(withdrawal.walletAddress)
        };
    }

    getFiatBalance(walletAddress) {
        return this.fiatBalances.get(walletAddress) || 0;
    }

    getAccount(walletAddress) {
        const account = this.accounts.get(walletAddress);
        if (!account) {
            return null;
        }

        return {
            ...account,
            fiatBalance: this.getFiatBalance(walletAddress)
        };
    }

    getDeposits(walletAddress, limit = 50) {
        const deposits = [];
        for (const deposit of this.deposits.values()) {
            if (deposit.walletAddress === walletAddress) {
                deposits.push(deposit);
            }
        }
        return deposits.sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
    }

    getWithdrawals(walletAddress, limit = 50) {
        const withdrawals = [];
        for (const withdrawal of this.withdrawals.values()) {
            if (withdrawal.walletAddress === walletAddress) {
                withdrawals.push(withdrawal);
            }
        }
        return withdrawals.sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
    }

    getTransactions(walletAddress, limit = 100) {
        const transactions = [];
        for (const transaction of this.transactions.values()) {
            if (transaction.walletAddress === walletAddress) {
                transactions.push(transaction);
            }
        }
        return transactions.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
    }

    getAllDeposits() {
        return Array.from(this.deposits.values())
            .sort((a, b) => b.createdAt - a.createdAt);
    }

    getAllWithdrawals() {
        return Array.from(this.withdrawals.values())
            .sort((a, b) => b.createdAt - a.createdAt);
    }

    getStats() {
        let totalDeposits = 0;
        let completedDeposits = 0;
        let totalWithdrawals = 0;
        let completedWithdrawals = 0;

        for (const deposit of this.deposits.values()) {
            totalDeposits += deposit.netAmount;
            if (deposit.status === 'completed') {
                completedDeposits++;
            }
        }

        for (const withdrawal of this.withdrawals.values()) {
            totalWithdrawals += withdrawal.amount;
            if (withdrawal.status === 'completed') {
                completedWithdrawals++;
            }
        }

        return {
            totalAccounts: this.accounts.size,
            totalDeposits: parseFloat(totalDeposits.toFixed(2)),
            completedDeposits,
            totalWithdrawals: parseFloat(totalWithdrawals.toFixed(2)),
            completedWithdrawals,
            netFlow: parseFloat((totalDeposits - totalWithdrawals).toFixed(2))
        };
    }
}

module.exports = BankingAPI;
