// In-App Purchase Handler for Google Play Billing
// This file handles subscriptions for the Android app

class IAPHandler {
    constructor() {
        this.store = null;
        this.isAndroid = this.detectAndroid();
        this.subscriptionStatus = {
            isSubscribed: false,
            tier: 'free',
            expiryDate: null
        };
    }

    detectAndroid() {
        return typeof cordova !== 'undefined' && cordova.platformId === 'android';
    }

    async initialize() {
        if (!this.isAndroid) {
            console.log('Not on Android - using website subscriptions only');
            return false;
        }

        try {
            // Wait for Cordova to be ready
            await this.waitForCordova();

            // Import the purchase plugin
            const { store, ProductType, Platform } = CdvPurchase;
            this.store = store;

            // Register products (these IDs must match Google Play Console)
            this.store.register([
                {
                    id: 'kenostod_student_monthly',
                    type: ProductType.PAID_SUBSCRIPTION,
                    platform: Platform.GOOGLE_PLAY
                },
                {
                    id: 'kenostod_professional_monthly',
                    type: ProductType.PAID_SUBSCRIPTION,
                    platform: Platform.GOOGLE_PLAY
                }
            ]);

            // Set up event handlers
            this.setupEventHandlers();

            // Initialize the store
            await this.store.initialize([Platform.GOOGLE_PLAY]);

            console.log('✅ Google Play Billing initialized');
            return true;
        } catch (error) {
            console.error('Failed to initialize IAP:', error);
            return false;
        }
    }

    setupEventHandlers() {
        // Handle approved transactions
        this.store.when().approved((transaction) => {
            console.log('✅ Purchase approved:', transaction);
            
            // Verify on backend (optional but recommended)
            this.verifyPurchaseOnBackend(transaction);
            
            // Finish the transaction
            transaction.finish();
        });

        // Handle updated receipts
        this.store.when().receiptsUpdated(() => {
            console.log('📝 Receipts updated');
            this.checkSubscriptionStatus();
        });

        // Handle errors
        this.store.when().error((error) => {
            console.error('❌ IAP Error:', error);
        });
    }

    async waitForCordova() {
        return new Promise((resolve) => {
            if (typeof cordova !== 'undefined') {
                resolve();
            } else {
                document.addEventListener('deviceready', resolve);
            }
        });
    }

    checkSubscriptionStatus() {
        if (!this.store) return;

        const studentSub = this.store.get('kenostod_student_monthly');
        const proSub = this.store.get('kenostod_professional_monthly');

        if (proSub && proSub.owned) {
            this.subscriptionStatus = {
                isSubscribed: true,
                tier: 'professional',
                expiryDate: proSub.expiryDate
            };
        } else if (studentSub && studentSub.owned) {
            this.subscriptionStatus = {
                isSubscribed: true,
                tier: 'student',
                expiryDate: studentSub.expiryDate
            };
        } else {
            this.subscriptionStatus = {
                isSubscribed: false,
                tier: 'free',
                expiryDate: null
            };
        }

        // Dispatch event for UI update
        window.dispatchEvent(new CustomEvent('subscriptionStatusChanged', {
            detail: this.subscriptionStatus
        }));
    }

    async purchaseSubscription(productId) {
        if (!this.store) {
            throw new Error('Store not initialized. Using website subscriptions.');
        }

        try {
            const product = this.store.get(productId);
            if (!product) {
                throw new Error(`Product ${productId} not found`);
            }

            const offer = product.getOffer();
            if (!offer) {
                throw new Error(`No offer available for ${productId}`);
            }

            await offer.order();
            console.log('🛒 Purchase initiated for:', productId);
        } catch (error) {
            console.error('Purchase failed:', error);
            throw error;
        }
    }

    async restorePurchases() {
        if (!this.store) return;

        try {
            await this.store.restorePurchases();
            console.log('🔄 Purchases restored');
            this.checkSubscriptionStatus();
        } catch (error) {
            console.error('Restore failed:', error);
        }
    }

    async verifyPurchaseOnBackend(transaction) {
        // Send receipt to your backend for server-side verification
        // This is optional but highly recommended for security
        try {
            const response = await fetch('/api/verify-purchase', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    platform: 'android',
                    productId: transaction.products[0].id,
                    transactionId: transaction.transactionId,
                    receipt: transaction.nativeReceipt
                })
            });

            const result = await response.json();
            console.log('✅ Backend verification:', result);
        } catch (error) {
            console.warn('Backend verification failed:', error);
            // Continue anyway - local verification is done by the plugin
        }
    }

    getSubscriptionStatus() {
        return this.subscriptionStatus;
    }

    isFeatureUnlocked(featureName) {
        const tier = this.subscriptionStatus.tier;
        
        // Free tier restrictions
        const freeFeatures = ['basic_wallet', 'view_blockchain', 'basic_mining'];
        
        // Student tier features
        const studentFeatures = [...freeFeatures, 'social_recovery', 'scheduled_payments', 'transaction_reversal'];
        
        // Professional tier features (all features)
        const professionalFeatures = [...studentFeatures, 'porv_mining', 'advanced_exchange', 'merchant_gateway', 'governance'];

        if (tier === 'professional') {
            return professionalFeatures.includes(featureName);
        } else if (tier === 'student') {
            return studentFeatures.includes(featureName);
        } else {
            return freeFeatures.includes(featureName);
        }
    }
}

// Create global instance
const iapHandler = new IAPHandler();

// Initialize when document is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        iapHandler.initialize();
    });
} else {
    iapHandler.initialize();
}

// Export for use in other scripts
window.iapHandler = iapHandler;
