const Stripe = require('stripe');

class StripeIntegration {
    constructor(apiKey = null) {
        this.apiKey = apiKey || process.env.STRIPE_SECRET_KEY;
        if (!this.apiKey) {
            console.warn('STRIPE_SECRET_KEY not set. Stripe integration will use test mode.');
            this.apiKey = 'sk_test_demo';
            this.testMode = true;
        } else if (this.apiKey.startsWith('sk_test_')) {
            this.testMode = true;
            console.log('✅ Stripe configured in TEST MODE (using test key)');
        } else {
            this.testMode = false;
            console.log('✅ Stripe configured in LIVE MODE');
        }
        
        if (!this.testMode) {
            this.stripe = require('stripe')(this.apiKey);
        }
    }

    async createPaymentIntent(amount, currency = 'usd', metadata = {}) {
        if (this.testMode) {
            return {
                id: `pi_test_${Date.now()}`,
                client_secret: `pi_test_secret_${Date.now()}`,
                amount: Math.round(amount * 100),
                currency,
                status: 'requires_payment_method',
                metadata,
                testMode: true
            };
        }

        try {
            const paymentIntent = await this.stripe.paymentIntents.create({
                amount: Math.round(amount * 100),
                currency,
                metadata,
                automatic_payment_methods: {
                    enabled: true
                }
            });

            return paymentIntent;
        } catch (error) {
            throw new Error(`Stripe payment intent failed: ${error.message}`);
        }
    }

    async confirmPaymentIntent(paymentIntentId) {
        if (this.testMode) {
            return {
                id: paymentIntentId,
                status: 'succeeded',
                amount: 5000,
                testMode: true
            };
        }

        try {
            const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
            return paymentIntent;
        } catch (error) {
            throw new Error(`Stripe payment confirmation failed: ${error.message}`);
        }
    }

    async createPayout(amount, destination = null, currency = 'usd', metadata = {}) {
        if (this.testMode) {
            console.log(`💳 TEST MODE: Simulating payout of $${amount}`);
            return {
                id: `po_test_${Date.now()}`,
                amount: Math.round(amount * 100),
                currency,
                status: 'paid',
                destination: destination || 'default',
                metadata,
                testMode: true,
                message: '⚠️ TEST MODE: No real payout processed'
            };
        }

        try {
            // In live mode, payouts go to the Stripe account's connected bank account
            // The destination parameter is not needed (and often not supported)
            const payoutParams = {
                amount: Math.round(amount * 100),
                currency,
                metadata,
                method: 'standard'
            };

            const payout = await this.stripe.payouts.create(payoutParams);
            
            console.log(`✅ Stripe payout created: $${amount} → your connected bank account`);
            return payout;
        } catch (error) {
            throw new Error(`Stripe payout failed: ${error.message}`);
        }
    }

    async createBankAccount(accountHolderName, routingNumber, accountNumber, accountType = 'individual') {
        if (this.testMode) {
            return {
                id: `ba_test_${Date.now()}`,
                object: 'bank_account',
                account_holder_name: accountHolderName,
                last4: accountNumber.slice(-4),
                routing_number: routingNumber,
                status: 'verified',
                testMode: true
            };
        }

        try {
            const token = await this.stripe.tokens.create({
                bank_account: {
                    country: 'US',
                    currency: 'usd',
                    account_holder_name: accountHolderName,
                    account_holder_type: accountType,
                    routing_number: routingNumber,
                    account_number: accountNumber
                }
            });

            return token.bank_account;
        } catch (error) {
            throw new Error(`Stripe bank account creation failed: ${error.message}`);
        }
    }

    async validateWebhook(payload, signature, webhookSecret) {
        if (this.testMode) {
            const payloadString = Buffer.isBuffer(payload) ? payload.toString('utf8') : payload;
            return JSON.parse(payloadString);
        }

        try {
            const event = this.stripe.webhooks.constructEvent(
                payload,
                signature,
                webhookSecret
            );
            return event;
        } catch (error) {
            throw new Error(`Webhook signature verification failed: ${error.message}`);
        }
    }

    async createProduct(name, description = '') {
        if (this.testMode) {
            return {
                id: `prod_test_${Date.now()}`,
                object: 'product',
                name,
                description,
                testMode: true
            };
        }

        try {
            const product = await this.stripe.products.create({
                name,
                description
            });
            return product;
        } catch (error) {
            throw new Error(`Stripe product creation failed: ${error.message}`);
        }
    }

    async createPrice(productId, amount, currency = 'usd', interval = 'month') {
        if (this.testMode) {
            return {
                id: `price_test_${Date.now()}`,
                object: 'price',
                product: productId,
                unit_amount: Math.round(amount * 100),
                currency,
                recurring: { interval },
                testMode: true
            };
        }

        try {
            const price = await this.stripe.prices.create({
                product: productId,
                unit_amount: Math.round(amount * 100),
                currency,
                recurring: { interval }
            });
            return price;
        } catch (error) {
            throw new Error(`Stripe price creation failed: ${error.message}`);
        }
    }

    async createCheckoutSession(priceId, successUrl, cancelUrl, customerEmail = null, metadata = {}) {
        if (this.testMode) {
            return {
                id: `cs_test_${Date.now()}`,
                url: `https://checkout.stripe.com/test/${Date.now()}`,
                testMode: true,
                message: '⚠️ TEST MODE: This is a simulated checkout session'
            };
        }

        try {
            const sessionParams = {
                mode: 'subscription',
                line_items: [{
                    price: priceId,
                    quantity: 1
                }],
                success_url: successUrl,
                cancel_url: cancelUrl,
                metadata,
                // CRITICAL: Propagate metadata to subscription for webhook processing
                subscription_data: {
                    metadata: metadata
                },
                locale: 'auto'
            };

            if (customerEmail) {
                sessionParams.customer_email = customerEmail;
            }

            const session = await this.stripe.checkout.sessions.create(sessionParams);
            return session;
        } catch (error) {
            throw new Error(`Stripe checkout session creation failed: ${error.message}`);
        }
    }

    async createCustomerPortalSession(customerId, returnUrl) {
        if (this.testMode) {
            return {
                url: `https://billing.stripe.com/test/${Date.now()}`,
                testMode: true,
                message: '⚠️ TEST MODE: This is a simulated portal session'
            };
        }

        try {
            const session = await this.stripe.billingPortal.sessions.create({
                customer: customerId,
                return_url: returnUrl
            });
            return session;
        } catch (error) {
            throw new Error(`Stripe customer portal session creation failed: ${error.message}`);
        }
    }

    async retrieveSubscription(subscriptionId) {
        if (this.testMode) {
            return {
                id: subscriptionId,
                status: 'active',
                testMode: true
            };
        }

        try {
            const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
            return subscription;
        } catch (error) {
            throw new Error(`Stripe subscription retrieval failed: ${error.message}`);
        }
    }

    async cancelSubscription(subscriptionId) {
        if (this.testMode) {
            return {
                id: subscriptionId,
                status: 'canceled',
                testMode: true
            };
        }

        try {
            const subscription = await this.stripe.subscriptions.cancel(subscriptionId);
            return subscription;
        } catch (error) {
            throw new Error(`Stripe subscription cancellation failed: ${error.message}`);
        }
    }

    async listProducts() {
        if (this.testMode) {
            return {
                data: [],
                testMode: true
            };
        }

        try {
            const products = await this.stripe.products.list({ limit: 100 });
            return products;
        } catch (error) {
            throw new Error(`Stripe product list failed: ${error.message}`);
        }
    }

    async listPrices(productId = null) {
        if (this.testMode) {
            return {
                data: [],
                testMode: true
            };
        }

        try {
            const params = { limit: 100 };
            if (productId) {
                params.product = productId;
            }
            const prices = await this.stripe.prices.list(params);
            return prices;
        } catch (error) {
            throw new Error(`Stripe price list failed: ${error.message}`);
        }
    }

    isTestMode() {
        return this.testMode;
    }
}

module.exports = StripeIntegration;
