// Revenue Tracker - Tracks all platform revenue streams
// Handles: Merchant Gateway Fees, Exchange Trading Fees, White-Label Licensing

class RevenueTracker {
    constructor() {
        // Merchant Gateway Fee Tracking
        this.merchantFees = new Map(); // merchantId -> { totalFees, transactions[], monthlyRevenue }
        this.platformMerchantRevenue = 0;
        this.merchantTransactions = [];
        
        // Exchange Trading Fee Tracking
        this.tradingFees = new Map(); // userAddress -> { totalFees, trades[] }
        this.platformTradingRevenue = 0;
        this.tradingTransactions = [];
        
        // White-Label License Tracking (in-memory, synced with PostgreSQL)
        this.licenses = new Map(); // licenseId -> license details
        this.platformLicensingRevenue = 0;
        
        // Revenue Configuration
        this.config = {
            merchantGatewayFee: 0.025, // 2.5% platform fee
            exchangeTradingFee: 0.005, // 0.5% trading fee
            whiteLabel: {
                BASIC: { price: 500, features: ['Custom branding', '5 domains', 'Email support'] },
                PROFESSIONAL: { price: 2000, features: ['Custom branding', 'Unlimited domains', 'Priority support', 'API access', 'Custom features'] },
                ENTERPRISE: { price: 5000, features: ['Full customization', 'Unlimited domains', 'Dedicated support', 'Full API access', 'Source code access', 'White-label mobile apps'] }
            }
        };
        
        // Revenue Analytics
        this.revenueHistory = {
            daily: [],
            monthly: [],
            yearly: []
        };
    }

    // ===== MERCHANT GATEWAY FEES (2.5%) =====
    
    recordMerchantTransaction(merchantId, transactionAmount, merchantAddress) {
        const platformFee = transactionAmount * this.config.merchantGatewayFee;
        const merchantReceives = transactionAmount - platformFee;
        
        const transaction = {
            transactionId: `MTX_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            merchantId,
            merchantAddress,
            grossAmount: transactionAmount,
            platformFee,
            netAmount: merchantReceives,
            timestamp: Date.now(),
            type: 'merchant_gateway'
        };
        
        this.merchantTransactions.push(transaction);
        
        // Update merchant's fee tracking
        if (!this.merchantFees.has(merchantId)) {
            this.merchantFees.set(merchantId, {
                merchantId,
                merchantAddress,
                totalFees: 0,
                totalGross: 0,
                totalNet: 0,
                transactions: [],
                monthlyRevenue: this.getMonthlyRevenue(merchantId)
            });
        }
        
        const merchantData = this.merchantFees.get(merchantId);
        merchantData.totalFees += platformFee;
        merchantData.totalGross += transactionAmount;
        merchantData.totalNet += merchantReceives;
        merchantData.transactions.push(transaction);
        
        // Update platform revenue
        this.platformMerchantRevenue += platformFee;
        
        return {
            success: true,
            transaction,
            platformFee,
            merchantReceives,
            feePercentage: '2.5%'
        };
    }
    
    getMerchantFeeReport(merchantId) {
        const data = this.merchantFees.get(merchantId);
        if (!data) {
            return {
                merchantId,
                totalTransactions: 0,
                totalGross: 0,
                totalFees: 0,
                totalNet: 0,
                transactions: []
            };
        }
        
        return {
            merchantId: data.merchantId,
            merchantAddress: data.merchantAddress,
            totalTransactions: data.transactions.length,
            totalGross: data.totalGross.toFixed(2),
            totalFees: data.totalFees.toFixed(2),
            totalNet: data.totalNet.toFixed(2),
            feePercentage: '2.5%',
            transactions: data.transactions.slice(-50) // Last 50 transactions
        };
    }
    
    getMonthlyRevenue(merchantId) {
        const data = this.merchantFees.get(merchantId);
        if (!data) return 0;
        
        const now = Date.now();
        const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
        
        return data.transactions
            .filter(tx => tx.timestamp >= thirtyDaysAgo)
            .reduce((sum, tx) => sum + tx.platformFee, 0);
    }

    // ===== EXCHANGE TRADING FEES (0.5%) =====
    
    recordTradingFee(tradeDetails) {
        const { buyerAddress, sellerAddress, quantity, price, pair } = tradeDetails;
        const tradeValue = quantity * price;
        const tradingFee = tradeValue * this.config.exchangeTradingFee;
        
        const transaction = {
            transactionId: `TRD_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            buyerAddress,
            sellerAddress,
            pair,
            quantity,
            price,
            tradeValue,
            tradingFee,
            timestamp: Date.now(),
            type: 'exchange_trading'
        };
        
        this.tradingTransactions.push(transaction);
        
        // Update buyer's fee tracking
        if (!this.tradingFees.has(buyerAddress)) {
            this.tradingFees.set(buyerAddress, {
                userAddress: buyerAddress,
                totalFees: 0,
                totalTradeVolume: 0,
                trades: []
            });
        }
        
        const buyerData = this.tradingFees.get(buyerAddress);
        buyerData.totalFees += tradingFee / 2; // Split fee between buyer/seller
        buyerData.totalTradeVolume += tradeValue;
        buyerData.trades.push({ ...transaction, side: 'buy' });
        
        // Update seller's fee tracking
        if (!this.tradingFees.has(sellerAddress)) {
            this.tradingFees.set(sellerAddress, {
                userAddress: sellerAddress,
                totalFees: 0,
                totalTradeVolume: 0,
                trades: []
            });
        }
        
        const sellerData = this.tradingFees.get(sellerAddress);
        sellerData.totalFees += tradingFee / 2; // Split fee between buyer/seller
        sellerData.totalTradeVolume += tradeValue;
        sellerData.trades.push({ ...transaction, side: 'sell' });
        
        // Update platform revenue
        this.platformTradingRevenue += tradingFee;
        
        return {
            success: true,
            transaction,
            tradingFee,
            buyerFee: (tradingFee / 2).toFixed(2),
            sellerFee: (tradingFee / 2).toFixed(2),
            feePercentage: '0.5%'
        };
    }
    
    getUserTradingFees(userAddress) {
        const data = this.tradingFees.get(userAddress);
        if (!data) {
            return {
                userAddress,
                totalTrades: 0,
                totalFees: 0,
                totalVolume: 0,
                trades: []
            };
        }
        
        return {
            userAddress: data.userAddress,
            totalTrades: data.trades.length,
            totalFees: data.totalFees.toFixed(2),
            totalVolume: data.totalTradeVolume.toFixed(2),
            feePercentage: '0.5%',
            trades: data.trades.slice(-50) // Last 50 trades
        };
    }

    // ===== WHITE-LABEL LICENSING =====
    
    createLicense(licenseDetails) {
        const { organizationName, tier, contactEmail, customDomain, stripeSubscriptionId } = licenseDetails;
        
        if (!this.config.whiteLabel[tier]) {
            throw new Error(`Invalid license tier: ${tier}. Valid tiers: BASIC, PROFESSIONAL, ENTERPRISE`);
        }
        
        const licenseId = `LIC_${Date.now()}_${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
        const licenseKey = this.generateLicenseKey();
        
        const license = {
            licenseId,
            licenseKey,
            organizationName,
            tier,
            contactEmail,
            customDomain,
            monthlyPrice: this.config.whiteLabel[tier].price,
            features: this.config.whiteLabel[tier].features,
            status: 'active',
            createdAt: Date.now(),
            expiresAt: Date.now() + (365 * 24 * 60 * 60 * 1000), // 1 year
            stripeSubscriptionId,
            totalRevenue: 0,
            paymentsReceived: []
        };
        
        this.licenses.set(licenseId, license);
        
        return {
            success: true,
            license,
            message: `White-label license created for ${organizationName}`
        };
    }
    
    generateLicenseKey() {
        const segments = [];
        for (let i = 0; i < 4; i++) {
            segments.push(Math.random().toString(36).substr(2, 6).toUpperCase());
        }
        return segments.join('-');
    }
    
    validateLicense(licenseKey) {
        for (const license of this.licenses.values()) {
            if (license.licenseKey === licenseKey) {
                if (license.status !== 'active') {
                    return { valid: false, reason: 'License is not active' };
                }
                if (license.expiresAt < Date.now()) {
                    return { valid: false, reason: 'License has expired' };
                }
                return { valid: true, license };
            }
        }
        return { valid: false, reason: 'License key not found' };
    }
    
    recordLicensePayment(licenseId, amount, paymentId) {
        const license = this.licenses.get(licenseId);
        if (!license) {
            throw new Error(`License ${licenseId} not found`);
        }
        
        const payment = {
            paymentId,
            amount,
            timestamp: Date.now(),
            period: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        };
        
        license.paymentsReceived.push(payment);
        license.totalRevenue += amount;
        this.platformLicensingRevenue += amount;
        
        return {
            success: true,
            payment,
            licenseRevenue: license.totalRevenue
        };
    }
    
    getLicenseReport(licenseId) {
        const license = this.licenses.get(licenseId);
        if (!license) {
            return { error: 'License not found' };
        }
        
        return {
            licenseId: license.licenseId,
            organizationName: license.organizationName,
            tier: license.tier,
            monthlyPrice: license.monthlyPrice,
            status: license.status,
            totalRevenue: license.totalRevenue,
            paymentsReceived: license.paymentsReceived.length,
            createdAt: new Date(license.createdAt).toLocaleDateString(),
            expiresAt: new Date(license.expiresAt).toLocaleDateString(),
            features: license.features
        };
    }
    
    getAllLicenses() {
        return Array.from(this.licenses.values()).map(license => ({
            licenseId: license.licenseId,
            organizationName: license.organizationName,
            tier: license.tier,
            monthlyPrice: license.monthlyPrice,
            status: license.status,
            totalRevenue: license.totalRevenue,
            createdAt: new Date(license.createdAt).toLocaleDateString()
        }));
    }

    // ===== REVENUE ANALYTICS =====
    
    getGlobalRevenueReport() {
        const totalMerchants = this.merchantFees.size;
        const totalTraders = this.tradingFees.size;
        const totalLicenses = this.licenses.size;
        
        const activeLicenses = Array.from(this.licenses.values())
            .filter(l => l.status === 'active').length;
        
        const monthlyRecurringRevenue = Array.from(this.licenses.values())
            .filter(l => l.status === 'active')
            .reduce((sum, l) => sum + l.monthlyPrice, 0);
        
        return {
            summary: {
                totalRevenue: (this.platformMerchantRevenue + this.platformTradingRevenue + this.platformLicensingRevenue).toFixed(2),
                merchantGatewayRevenue: this.platformMerchantRevenue.toFixed(2),
                tradingRevenue: this.platformTradingRevenue.toFixed(2),
                licensingRevenue: this.platformLicensingRevenue.toFixed(2),
                monthlyRecurringRevenue: monthlyRecurringRevenue.toFixed(2)
            },
            merchants: {
                total: totalMerchants,
                totalTransactions: this.merchantTransactions.length,
                averageFeePerTransaction: totalMerchants > 0 
                    ? (this.platformMerchantRevenue / this.merchantTransactions.length).toFixed(2) 
                    : '0.00'
            },
            exchange: {
                totalTraders: totalTraders,
                totalTrades: this.tradingTransactions.length,
                averageFeePerTrade: this.tradingTransactions.length > 0
                    ? (this.platformTradingRevenue / this.tradingTransactions.length).toFixed(2)
                    : '0.00'
            },
            licensing: {
                totalLicenses,
                activeLicenses,
                basicLicenses: Array.from(this.licenses.values()).filter(l => l.tier === 'BASIC').length,
                professionalLicenses: Array.from(this.licenses.values()).filter(l => l.tier === 'PROFESSIONAL').length,
                enterpriseLicenses: Array.from(this.licenses.values()).filter(l => l.tier === 'ENTERPRISE').length
            },
            projections: {
                annualRecurringRevenue: (monthlyRecurringRevenue * 12).toFixed(2),
                projectedAnnualRevenue: ((this.platformMerchantRevenue + this.platformTradingRevenue) * 12 + monthlyRecurringRevenue * 12).toFixed(2)
            }
        };
    }
    
    getRevenueBreakdown() {
        const total = this.platformMerchantRevenue + this.platformTradingRevenue + this.platformLicensingRevenue;
        
        return {
            merchantGateway: {
                revenue: this.platformMerchantRevenue.toFixed(2),
                percentage: total > 0 ? ((this.platformMerchantRevenue / total) * 100).toFixed(1) + '%' : '0%',
                feeRate: '2.5%'
            },
            exchangeTrading: {
                revenue: this.platformTradingRevenue.toFixed(2),
                percentage: total > 0 ? ((this.platformTradingRevenue / total) * 100).toFixed(1) + '%' : '0%',
                feeRate: '0.5%'
            },
            whiteLabelLicensing: {
                revenue: this.platformLicensingRevenue.toFixed(2),
                percentage: total > 0 ? ((this.platformLicensingRevenue / total) * 100).toFixed(1) + '%' : '0%',
                tiers: 'Basic: $500/mo, Pro: $2000/mo, Enterprise: $5000/mo'
            },
            total: total.toFixed(2)
        };
    }
}

module.exports = RevenueTracker;
