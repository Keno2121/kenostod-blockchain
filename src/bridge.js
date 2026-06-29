const axios = require('axios');
const { randomUUID } = require('crypto');

const BRIDGE_API_KEY = process.env.BRIDGE_API_KEY;
const BRIDGE_SANDBOX_URL = 'https://api.sandbox.bridge.xyz/v0';
const BRIDGE_PROD_URL = 'https://api.bridge.xyz/v0';

const USE_SANDBOX = true;
const BASE_URL = USE_SANDBOX ? BRIDGE_SANDBOX_URL : BRIDGE_PROD_URL;

function bridgeClient(idempotencyKey) {
    const headers = {
        'Api-Key': BRIDGE_API_KEY,
        'Content-Type': 'application/json',
    };
    if (idempotencyKey) {
        headers['Idempotency-Key'] = idempotencyKey;
    }
    return axios.create({ baseURL: BASE_URL, headers });
}

async function getAccount() {
    const client = bridgeClient();
    const res = await client.get('/customers');
    return res.data;
}

async function createKycLink(email, fullName) {
    const client = bridgeClient(randomUUID());
    const res = await client.post('/kyc_links', {
        full_name: fullName,
        email: email,
        type: 'individual',
    });
    return res.data;
}

async function listCustomers(limit = 20) {
    const client = bridgeClient();
    const res = await client.get('/customers', { params: { limit } });
    return res.data;
}

async function getCustomer(customerId) {
    const client = bridgeClient();
    const res = await client.get(`/customers/${customerId}`);
    return res.data;
}

async function listTransfers(limit = 20) {
    const client = bridgeClient();
    const res = await client.get('/transfers', { params: { limit } });
    return res.data;
}

async function createTransfer({ amount, currency, sourcePaymentRail, destinationPaymentRail, destinationAddress, customerId }) {
    const client = bridgeClient(randomUUID());
    const res = await client.post('/transfers', {
        amount: amount.toString(),
        on_behalf_of: customerId,
        developer_fee: '0',
        source: {
            payment_rail: sourcePaymentRail,
            currency: currency || 'usdb',
        },
        destination: {
            payment_rail: destinationPaymentRail,
            currency: currency || 'usdb',
            to_address: destinationAddress,
        },
    });
    return res.data;
}

async function createLiquidationAddress({ customerId, chain, currency, externalAccountId }) {
    const client = bridgeClient(randomUUID());
    const res = await client.post(`/customers/${customerId}/liquidation_addresses`, {
        chain: chain || 'base',
        currency: currency || 'usdb',
        external_account_id: externalAccountId,
    });
    return res.data;
}

async function listLiquidationAddresses(customerId) {
    const client = bridgeClient();
    const res = await client.get(`/customers/${customerId}/liquidation_addresses`);
    return res.data;
}

async function testConnection() {
    try {
        const client = bridgeClient();
        const res = await client.get('/customers', { params: { limit: 1 } });
        return { connected: true, mode: USE_SANDBOX ? 'sandbox' : 'production', status: res.status };
    } catch (err) {
        return {
            connected: false,
            mode: USE_SANDBOX ? 'sandbox' : 'production',
            error: err.response ? err.response.data : err.message,
        };
    }
}

module.exports = {
    testConnection,
    getAccount,
    createKycLink,
    listCustomers,
    getCustomer,
    listTransfers,
    createTransfer,
    createLiquidationAddress,
    listLiquidationAddresses,
    BASE_URL,
    USE_SANDBOX,
};
