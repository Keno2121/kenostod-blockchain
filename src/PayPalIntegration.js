const checkoutNodeJssdk = require('@paypal/checkout-server-sdk');

class PayPalError extends Error {
    constructor(message, statusCode = null, name = null, details = null) {
        super(message);
        this.name = 'PayPalError';
        this.statusCode = statusCode;
        this.paypalName = name;
        this.details = details;
    }
}

class PayPalIntegration {
    constructor(clientId = null, clientSecret = null) {
        this.clientId = clientId || process.env.PAYPAL_CLIENT_ID;
        this.clientSecret = clientSecret || process.env.PAYPAL_CLIENT_SECRET;
        
        if (!this.clientId || !this.clientSecret) {
            console.warn('⚠️  PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET not set. PayPal integration will use test mode.');
            this.testMode = true;
        } else {
            this.testMode = false;
            
            const isLive = process.env.PAYPAL_MODE === 'live';
            const environment = isLive
                ? new checkoutNodeJssdk.core.LiveEnvironment(this.clientId, this.clientSecret)
                : new checkoutNodeJssdk.core.SandboxEnvironment(this.clientId, this.clientSecret);
            
            this.client = new checkoutNodeJssdk.core.PayPalHttpClient(environment);
            console.log(`✅ PayPal configured in ${isLive ? 'LIVE' : 'SANDBOX'} MODE`);
        }
    }

    async createOrder(amount, currency = 'USD', metadata = {}) {
        if (this.testMode) {
            throw new Error('PayPal is not configured. Please set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET environment variables.');
        }

        try {
            const request = new checkoutNodeJssdk.orders.OrdersCreateRequest();
            request.prefer("return=representation");
            request.requestBody({
                intent: 'CAPTURE',
                purchase_units: [{
                    amount: {
                        currency_code: currency,
                        value: amount.toFixed(2)
                    },
                    custom_id: metadata.depositId || ''
                }]
            });

            const response = await this.client.execute(request);
            const result = response.result;
            
            const approveUrl = result.links?.find(link => link.rel === 'approve')?.href;

            return {
                id: result.id,
                status: result.status,
                amount: result.purchase_units[0].amount,
                approveUrl
            };
        } catch (error) {
            // Preserve full PayPal error details for debugging
            throw new PayPalError(
                error.message || 'PayPal order creation failed',
                error.statusCode,
                error.name,
                error.details || error.message
            );
        }
    }

    async captureOrder(orderId) {
        if (this.testMode) {
            throw new Error('PayPal is not configured. Please set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET environment variables.');
        }

        try {
            const request = new checkoutNodeJssdk.orders.OrdersCaptureRequest(orderId);
            request.prefer("return=representation");
            request.requestBody({});

            const response = await this.client.execute(request);
            const result = response.result;

            return {
                id: result.id,
                status: result.status,
                amount: result.purchase_units[0].payments.captures[0].amount
            };
        } catch (error) {
            // Preserve full PayPal error details for debugging
            throw new PayPalError(
                error.message || 'PayPal order capture failed',
                error.statusCode,
                error.name,
                error.details || error.message
            );
        }
    }

    async createPayout(recipientEmail, amount, currency = 'USD', metadata = {}) {
        if (this.testMode) {
            return {
                batch_id: `BATCH-${Date.now()}`,
                status: 'SUCCESS',
                items: [{
                    payout_item_id: `ITEM-${Date.now()}`,
                    transaction_status: 'SUCCESS',
                    amount: {
                        currency: currency,
                        value: amount.toFixed(2)
                    },
                    receiver: recipientEmail
                }],
                testMode: true
            };
        }

        try {
            const request = {
                body: {
                    sender_batch_header: {
                        sender_batch_id: `batch_${Date.now()}`,
                        email_subject: 'You have received a payout from Kenostod',
                        email_message: 'You have received a payout. Thank you for using Kenostod!'
                    },
                    items: [
                        {
                            recipient_type: 'EMAIL',
                            amount: {
                                value: amount.toFixed(2),
                                currency: currency
                            },
                            receiver: recipientEmail,
                            note: metadata.note || 'Kenostod withdrawal',
                            sender_item_id: metadata.withdrawalId || `withdrawal_${Date.now()}`
                        }
                    ]
                }
            };

            const { result } = await this.client.payouts.payoutsPost(request);

            return {
                batch_id: result.batch_header.payout_batch_id,
                status: result.batch_header.batch_status,
                items: result.items
            };
        } catch (error) {
            throw new Error(`PayPal payout failed: ${error.message}`);
        }
    }

    async getOrderDetails(orderId) {
        if (this.testMode) {
            throw new Error('PayPal is not configured. Please set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET environment variables.');
        }

        try {
            const request = new checkoutNodeJssdk.orders.OrdersGetRequest(orderId);
            const response = await this.client.execute(request);
            return response.result;
        } catch (error) {
            // Preserve full PayPal error details for debugging
            throw new PayPalError(
                error.message || 'PayPal order retrieval failed',
                error.statusCode,
                error.name,
                error.details || error.message
            );
        }
    }

    isTestMode() {
        return this.testMode;
    }
}

module.exports = PayPalIntegration;
