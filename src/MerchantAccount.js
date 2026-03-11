const crypto = require('crypto');

class MerchantAccount {
    constructor() {
        this.merchants = new Map();
        this.payments = [];
        this.conversionRate = 0.50; // 1 KENO = $0.50 USD (initial rate)
    }

    registerMerchant(businessName, walletAddress, contactEmail, businessType) {
        const merchantId = 'MERCHANT_' + crypto.randomBytes(16).toString('hex');
        
        const merchant = {
            merchantId,
            businessName,
            walletAddress,
            contactEmail,
            businessType,
            registeredAt: Date.now(),
            isActive: true,
            totalPaymentsReceived: 0,
            totalRevenueKENO: 0,
            totalRevenueUSD: 0,
            paymentCount: 0,
            apiKey: this.generateAPIKey(),
            webhookUrl: null,
            settings: {
                autoConvert: false,
                confirmationBlocks: 1,
                acceptedCurrencies: ['KENO'],
                enableQRPayments: true
            }
        };
        
        this.merchants.set(merchantId, merchant);
        return merchant;
    }

    generateAPIKey() {
        return 'pk_' + crypto.randomBytes(32).toString('hex');
    }

    getMerchant(merchantId) {
        return this.merchants.get(merchantId);
    }

    getAllMerchants() {
        return Array.from(this.merchants.values());
    }

    getActiveMerchants() {
        return Array.from(this.merchants.values()).filter(m => m.isActive);
    }

    updateMerchantSettings(merchantId, settings) {
        const merchant = this.merchants.get(merchantId);
        if (!merchant) {
            throw new Error('Merchant not found');
        }
        
        merchant.settings = { ...merchant.settings, ...settings };
        return merchant;
    }

    setWebhookUrl(merchantId, webhookUrl) {
        const merchant = this.merchants.get(merchantId);
        if (!merchant) {
            throw new Error('Merchant not found');
        }
        
        merchant.webhookUrl = webhookUrl;
        return merchant;
    }

    recordPayment(merchantId, paymentData) {
        const merchant = this.merchants.get(merchantId);
        if (!merchant) {
            throw new Error('Merchant not found');
        }
        
        const payment = {
            paymentId: 'PAY_' + crypto.randomBytes(16).toString('hex'),
            merchantId,
            ...paymentData,
            timestamp: Date.now(),
            status: 'pending',
            confirmations: 0
        };
        
        this.payments.push(payment);
        return payment;
    }

    confirmPayment(paymentId, blockHeight) {
        const payment = this.payments.find(p => p.paymentId === paymentId);
        if (!payment) {
            throw new Error('Payment not found');
        }
        
        payment.status = 'confirmed';
        payment.confirmationBlock = blockHeight;
        payment.confirmedAt = Date.now();
        
        const merchant = this.merchants.get(payment.merchantId);
        if (merchant) {
            merchant.totalPaymentsReceived++;
            merchant.totalRevenueKENO += payment.amountKENO;
            merchant.totalRevenueUSD += payment.amountUSD;
            merchant.paymentCount++;
        }
        
        return payment;
    }

    getPaymentsByMerchant(merchantId) {
        return this.payments.filter(p => p.merchantId === merchantId);
    }

    getPayment(paymentId) {
        return this.payments.find(p => p.paymentId === paymentId);
    }

    getAllPayments() {
        return this.payments;
    }

    updateConversionRate(newRate) {
        this.conversionRate = newRate;
    }

    convertKENOtoUSD(kenoAmount) {
        return kenoAmount * this.conversionRate;
    }

    convertUSDtoKENO(usdAmount) {
        return usdAmount / this.conversionRate;
    }

    getMerchantStats(merchantId) {
        const merchant = this.merchants.get(merchantId);
        if (!merchant) {
            throw new Error('Merchant not found');
        }
        
        const payments = this.getPaymentsByMerchant(merchantId);
        const confirmedPayments = payments.filter(p => p.status === 'confirmed');
        const pendingPayments = payments.filter(p => p.status === 'pending');
        
        const last30Days = Date.now() - (30 * 24 * 60 * 60 * 1000);
        const recentPayments = confirmedPayments.filter(p => p.confirmedAt > last30Days);
        
        return {
            merchant,
            totalPayments: payments.length,
            confirmedPayments: confirmedPayments.length,
            pendingPayments: pendingPayments.length,
            recentPayments30Days: recentPayments.length,
            recentRevenue30DaysKENO: recentPayments.reduce((sum, p) => sum + p.amountKENO, 0),
            recentRevenue30DaysUSD: recentPayments.reduce((sum, p) => sum + p.amountUSD, 0),
            averagePaymentKENO: confirmedPayments.length > 0 
                ? confirmedPayments.reduce((sum, p) => sum + p.amountKENO, 0) / confirmedPayments.length 
                : 0
        };
    }
}

module.exports = MerchantAccount;
