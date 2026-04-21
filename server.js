require('dotenv').config();

// Detect Replit-internal database URLs that won't work outside Replit
if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('helium') && !process.env.REPLIT_DOMAINS) {
    console.log('⚠️  Replit-internal DATABASE_URL detected on external host - database features disabled');
    delete process.env.DATABASE_URL;
}

// ═══════════════════════════════════════════════════════════
// EMBEDDED RESCUE WATCHER — Runs inside the stable server process
// Transfers ownership of all 5 UTL contracts + whitelists UTLFarm
// Fires the instant 0.0015 BNB lands on the compromised wallet
// ═══════════════════════════════════════════════════════════
(async () => {
    try {
        const { ethers } = require('ethers');
        const NEW_OWNER   = '0x4AA73FadfFd71E6549867a37455EA957A52Cf849';
        const COMPROMISED = '0xDc41cAAD2Cb3509Df595082AFB7372F0454fcEbf';
        const KENO_TOKEN  = '0x65791E0B5Cbac5F40c76cDe31bf4F074D982FD0E';
        const FARM_ADDR   = '0xaf991D0A2b4Ab522Adc6766fc0FdCbAfFA541094';
        const CONTRACTS   = [
            { name: 'KENO Token',    addr: '0x65791E0B5Cbac5F40c76cDe31bf4F074D982FD0E' },
            { name: 'Staking',       addr: '0x49961979c93f43f823BB3593b207724194019d1d' },
            { name: 'Fee Collector', addr: '0xfE537c43d202C455Cedc141B882c808287BB662f' },
            { name: 'Treasury',      addr: '0x3B3538b955647d811D42400084e9409e6593bE97' },
            { name: 'Distribution',  addr: '0xE6918cdBB9D8cd0d3532A88D974734B2F1A793c7' },
        ];
        const ABI = [
            'function owner() view returns (address)',
            'function transferOwnership(address newOwner)',
            'function updateWhitelist(address, bool) external',
            'function isWhitelisted(address) view returns (bool)',
        ];
        const GAS_PRICE = ethers.parseUnits('20', 'gwei');
        const GAS_LIMIT = 80000n;
        const MIN_BNB   = ethers.parseEther('0.0015');

        const provider = new ethers.JsonRpcProvider('https://bsc-dataseed1.binance.org/');
        const pk = process.env.DEPLOYER_PRIVATE_KEY;
        if (!pk) return;
        const wallet = new ethers.Wallet(pk.startsWith('0x') ? pk : '0x'+pk, provider);

        // Check if already done
        const kenoC = new ethers.Contract(KENO_TOKEN, ABI, provider);
        const firstOwner = await kenoC.owner().catch(() => null);
        if (!firstOwner || firstOwner.toLowerCase() === NEW_OWNER.toLowerCase()) {
            console.log('🔒 [RESCUE] All contracts already transferred — watcher disabled');
            return;
        }

        // Pre-sign all rescue transactions
        const iface = new ethers.Interface(ABI);
        const txsToSign = [];

        const alreadyWL = await kenoC.isWhitelisted(FARM_ADDR).catch(() => false);
        if (!alreadyWL) txsToSign.push({ label: 'Whitelist UTLFarm', to: KENO_TOKEN, data: iface.encodeFunctionData('updateWhitelist', [FARM_ADDR, true]) });

        for (const c of CONTRACTS) {
            const ct = new ethers.Contract(c.addr, ABI, provider);
            const own = await ct.owner().catch(() => null);
            if (own && own.toLowerCase() === wallet.address.toLowerCase()) {
                txsToSign.push({ label: c.name, to: c.addr, data: iface.encodeFunctionData('transferOwnership', [NEW_OWNER]) });
            }
        }

        if (txsToSign.length === 0) { console.log('🔒 [RESCUE] Nothing to transfer'); return; }

        const baseNonce = await provider.getTransactionCount(wallet.address, 'pending');
        const signedTxs = [];
        for (let i = 0; i < txsToSign.length; i++) {
            const signed = await wallet.signTransaction({ to: txsToSign[i].to, data: txsToSign[i].data, gasLimit: GAS_LIMIT, gasPrice: GAS_PRICE, nonce: baseNonce + i, chainId: 56, value: 0n });
            signedTxs.push({ label: txsToSign[i].label, signed });
        }

        console.log(`🔥 [RESCUE] ${signedTxs.length} txs pre-signed (nonce ${baseNonce}+). Watching for BNB on ${COMPROMISED.substring(0,10)}...`);

        let fired = false;
        const watcher = setInterval(async () => {
            if (fired) return;
            try {
                const bal = await provider.getBalance(COMPROMISED);
                if (bal >= MIN_BNB) {
                    fired = true;
                    clearInterval(watcher);
                    console.log(`\n🔥 [RESCUE] BNB DETECTED (${ethers.formatEther(bal)}) — BROADCASTING ALL ${signedTxs.length} TXS!`);
                    await Promise.all(signedTxs.map(async ({ label, signed }) => {
                        try {
                            const tx = await provider.broadcastTransaction(signed);
                            console.log(`   📤 [RESCUE] ${label}: ${tx.hash}`);
                            await tx.wait();
                            console.log(`   ✅ [RESCUE] CONFIRMED: ${label}`);
                        } catch(e) {
                            console.error(`   ❌ [RESCUE] ${label}: ${e.message.substring(0,80)}`);
                        }
                    }));
                    console.log('🏁 [RESCUE] ALL OWNERSHIP TRANSFERS COMPLETE');
                }
            } catch(e) { /* network blip */ }
        }, 500);

    } catch(e) {
        console.error('[RESCUE] Setup error:', e.message);
    }
})();

const express = require('express');
const cors = require('cors');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const https = require('https');
const Blockchain = require('./src/Blockchain');
const Transaction = require('./src/Transaction');
const ScheduledTransaction = require('./src/ScheduledTransaction');
const Wallet = require('./src/Wallet');
const BankingAPI = require('./src/BankingAPI');
const StripeIntegration = require('./src/StripeIntegration');
const PayPalIntegration = require('./src/PayPalIntegration');
const { runMigrations } = require('stripe-replit-sync');
const { getStripeSync } = require('./src/stripeClient');
const bridge = require('./src/bridge');
const stripeService = require('./src/stripeService');
const WebhookHandlers = require('./src/webhookHandlers');
const MerchantIncentives = require('./src/MerchantIncentives');
const RevenueTracker = require('./src/RevenueTracker');
const DataPersistence = require('./src/DataPersistence');
const DatabaseConnection = require('./src/DatabaseConnection');
const OrganizationManager = require('./src/OrganizationManager');
const WealthBuilderManager = require('./src/WealthBuilderManager');
const SecurityMiddleware = require('./src/SecurityMiddleware');
const EmailService = require('./src/EmailService');
const PrintfulIntegration = require('./src/PrintfulIntegration');
const AISupport = require('./src/AISupport');
const ArbitrageSystem = require('./src/ArbitrageSystem');
const FALPoolManager = require('./src/FALPoolManager');
const LiveArbBot = require('./src/LiveArbBot');
const UTLFeeCollector = require('./src/UTLFeeCollector');
const BSCTokenTransfer = require('./src/BSCTokenTransfer');
const EC = require('./src/secp256k1-compat').ec;
const ec = new EC('secp256k1');

const app = express();
const PORT = process.env.PORT || 5000;

// ==================== GLOBAL CRASH PROTECTION ====================
// Prevents any unhandled promise rejection or exception from killing
// the autoscale pod and causing deployment failures
process.on('unhandledRejection', (reason, promise) => {
    console.error('⚠️ Unhandled Promise Rejection (non-fatal):', reason?.message || reason);
});

process.on('uncaughtException', (err) => {
    console.error('⚠️ Uncaught Exception (non-fatal):', err.message);
});
// ================================================================

// CRITICAL: Enable trust proxy for Replit deployment (behind reverse proxy)
// This allows rate limiting to correctly identify users via X-Forwarded-For header
app.set('trust proxy', 1);

// Middleware
app.use(cors({
    origin: true,
    credentials: true
}));

// Session middleware for admin authentication
app.use(session({
    secret: process.env.ADMIN_PASSWORD || 'kenostod-session-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// ==================== STRIPE INITIALIZATION ====================
// Initialize Stripe with managed webhooks and database sync
// This runs AFTER the server starts to avoid blocking deployment
let stripeInitialized = false;

async function initializeStripe() {
    try {
        if (!process.env.DATABASE_URL) {
            console.warn('⚠️  DATABASE_URL not set - Stripe integration skipped');
            return;
        }

        console.log('🔄 Initializing Stripe integration...');
        
        // 1. Run migrations to create stripe schema
        await runMigrations({ 
            databaseUrl: process.env.DATABASE_URL,
            schema: 'stripe'
        });
        console.log('✅ Stripe schema ready');

        // 2. Get StripeSync instance
        const stripeSync = await getStripeSync();

        // 3. Set up managed webhook
        console.log('📧 Setting up Stripe managed webhook...');
        const webhookBaseUrl = process.env.APP_URL || `https://${process.env.REPLIT_DOMAINS?.split(',')[0] || 'localhost:5000'}`;
        const { webhook, uuid } = await stripeSync.findOrCreateManagedWebhook(
            `${webhookBaseUrl}/api/stripe/webhook`,
            {
                enabled_events: [
                    'checkout.session.completed',
                    'customer.subscription.created',
                    'customer.subscription.updated',
                    'customer.subscription.deleted',
                    'invoice.payment_succeeded',
                    'invoice.payment_failed'
                ],
                description: 'Kenostod Blockchain Academy - Managed webhook',
            }
        );
        console.log(`✅ Webhook configured (UUID: ${uuid})`);

        // 4. Skip Stripe data sync on startup (takes too long for deployment)
        // Payments still work without sync - sync happens on-demand
        console.log('ℹ️  Stripe data sync deferred (runs on-demand only)');

        stripeInitialized = true;
    } catch (error) {
        console.error('❌ Stripe initialization error:', error.message);
        console.log('⚠️  Server continues running without Stripe sync - payments still work');
    }
}

// Stripe will be initialized after server starts (see app.listen callback)

// ==================== STRIPE WEBHOOK ROUTE ====================
// Stripe webhook must be BEFORE express.json() to preserve raw body
app.post(
    '/api/stripe/webhook/:uuid',
    express.raw({ type: 'application/json' }),
    async (req, res) => {
        try {
            const signature = req.headers['stripe-signature'];
            if (!signature) {
                return res.status(400).json({ error: 'Missing stripe-signature' });
            }

            if (!Buffer.isBuffer(req.body)) {
                console.error('❌ Webhook error: Body is not a Buffer');
                return res.status(500).json({ error: 'Webhook processing error' });
            }

            const sig = Array.isArray(signature) ? signature[0] : signature;
            const { uuid } = req.params;
            
            await WebhookHandlers.processWebhook(req.body, sig, uuid);
            res.status(200).json({ received: true });
        } catch (error) {
            console.error('❌ Webhook error:', error.message);
            res.status(400).json({ error: 'Webhook processing error' });
        }
    }
);

// Legacy webhook route (for backward compatibility)
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
        console.warn('⚠️  STRIPE_WEBHOOK_SECRET not set. Webhook validation disabled.');
        return res.json({ received: true });
    }

    try {
        const event = await stripeIntegration.validateWebhook(req.body, sig, webhookSecret);

        switch (event.type) {
            case 'checkout.session.completed':
                console.log('✅ Subscription checkout completed:', event.data.object.id);
                
                if (organizationManager && event.data.object.metadata?.organization_id) {
                    const orgId = event.data.object.metadata.organization_id;
                    const customerId = event.data.object.customer;
                    const subscriptionId = event.data.object.subscription;
                    
                    try {
                        await organizationManager.updateStripeInfo(orgId, customerId, subscriptionId);
                        console.log(`✅ Updated Stripe info for organization ${orgId}`);
                    } catch (err) {
                        console.error(`Error updating organization ${orgId}:`, err.message);
                    }
                }
                break;
                
            case 'customer.subscription.created':
                console.log('✅ Subscription created:', event.data.object.id);
                
                if (organizationManager && event.data.object.metadata?.organization_id) {
                    const orgId = event.data.object.metadata.organization_id;
                    
                    try {
                        await organizationManager.updateSubscriptionStatus(orgId, 'active');
                        console.log(`✅ Activated subscription for organization ${orgId}`);
                    } catch (err) {
                        console.error(`Error activating organization ${orgId}:`, err.message);
                    }
                }
                break;
                
            case 'customer.subscription.updated':
                console.log('🔄 Subscription updated:', event.data.object.id);
                
                if (organizationManager && event.data.object.metadata?.organization_id) {
                    const orgId = event.data.object.metadata.organization_id;
                    const status = event.data.object.status;
                    
                    try {
                        await organizationManager.updateSubscriptionStatus(orgId, status);
                        console.log(`✅ Updated subscription status to '${status}' for organization ${orgId}`);
                    } catch (err) {
                        console.error(`Error updating organization ${orgId}:`, err.message);
                    }
                }
                break;
                
            case 'customer.subscription.deleted':
                console.log('❌ Subscription cancelled:', event.data.object.id);
                
                if (organizationManager && event.data.object.metadata?.organization_id) {
                    const orgId = event.data.object.metadata.organization_id;
                    
                    try {
                        await organizationManager.updateSubscriptionStatus(orgId, 'cancelled');
                        console.log(`✅ Cancelled subscription for organization ${orgId}`);
                    } catch (err) {
                        console.error(`Error cancelling organization ${orgId}:`, err.message);
                    }
                }
                break;
                
            case 'invoice.payment_succeeded':
                console.log('💰 Payment succeeded:', event.data.object.id);
                
                if (organizationManager && event.data.object.subscription) {
                    const subscriptionId = event.data.object.subscription;
                    
                    try {
                        const result = await dbConnection.query(
                            'SELECT id FROM organizations WHERE stripe_subscription_id = $1',
                            [subscriptionId]
                        );
                        
                        if (result.rows.length > 0) {
                            const orgId = result.rows[0].id;
                            await organizationManager.updateSubscriptionStatus(orgId, 'active');
                            console.log(`✅ Payment confirmed for organization ${orgId}`);
                        }
                    } catch (err) {
                        console.error(`Error confirming payment for subscription ${subscriptionId}:`, err.message);
                    }
                }
                break;
                
            case 'invoice.payment_failed':
                console.log('⚠️  Payment failed:', event.data.object.id);
                
                if (organizationManager && event.data.object.subscription) {
                    const subscriptionId = event.data.object.subscription;
                    
                    try {
                        const result = await dbConnection.query(
                            'SELECT id FROM organizations WHERE stripe_subscription_id = $1',
                            [subscriptionId]
                        );
                        
                        if (result.rows.length > 0) {
                            const orgId = result.rows[0].id;
                            await organizationManager.updateSubscriptionStatus(orgId, 'past_due');
                            console.log(`⚠️  Payment failed for organization ${orgId}, status set to past_due`);
                        }
                    } catch (err) {
                        console.error(`Error updating organization for subscription ${subscriptionId}:`, err.message);
                    }
                }
                break;
                
            default:
                console.log(`Unhandled webhook event: ${event.type}`);
        }

        res.json({ received: true });
    } catch (error) {
        console.error('Webhook error:', error.message);
        res.status(400).json({ error: error.message });
    }
});

app.use(express.json());

// Rate Limiting for Security
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    message: { error: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});

const strictLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: 'Too many requests to this endpoint, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { error: 'Too many authentication attempts, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});

app.use('/api/', generalLimiter);
console.log('✅ Rate limiting enabled for API endpoints');

// Prevent browser caching to ensure users always see latest version
app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
});

app.use((req, res, next) => {
    const adminPages = ['/admin-analytics.html', '/admin-backoffice.html', '/admin-grants.html', '/admin-ico-purchases.html', '/admin-merchandise.html'];
    if (adminPages.includes(req.path)) {
        const adminPassword = process.env.ADMIN_PASSWORD;
        const providedPassword = req.query.key;
        if (!adminPassword || providedPassword !== adminPassword) {
            return res.status(403).send('<html><body style="background:#0f172a;color:#e2e8f0;display:flex;justify-content:center;align-items:center;height:100vh;font-family:Inter,sans-serif;"><div style="text-align:center;"><h1 style="font-size:3rem;">403</h1><p>Access Denied — Admin Only</p></div></body></html>');
        }
    }
    next();
});
app.use(express.static('public', {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
        }
    }
}));


app.use('/snap', express.static('utl/metamask-snap', {
    setHeaders: (res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET');
        res.setHeader('Content-Type', 'application/json');
    }
}));

app.get('/api/utl/config', (req, res) => {
    res.json({
        walletConnectProjectId: process.env.WALLETCONNECT_PROJECT_ID || '',
        contracts: {
            FeeCollector: '0xfE537c43d202C455Cedc141B882c808287BB662f',
            Staking: '0x49961979c93f43f823BB3593b207724194019d1d',
            Treasury: '0x3B3538b955647d811D42400084e9409e6593bE97',
            Distribution: '0xE6918cdBB9D8cd0d3532A88D974734B2F1A793c7',
            USDC: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d'
        },
        network: { chainId: 56, name: 'BNB Smart Chain', rpc: 'https://bsc-dataseed1.binance.org/' }
    });
});

app.get('/api/subscription/verify', async (req, res) => {
    const { email, sessionId } = req.query;
    if (!email && !sessionId) {
        return res.json({ active: false, plan: 'free' });
    }
    try {
        if (sessionId) {
            const session = await stripeIntegration.stripe.checkout.sessions.retrieve(sessionId);
            if (session && session.payment_status === 'paid') {
                return res.json({ active: true, plan: session.metadata?.plan || 'student', email: session.customer_email });
            }
        }
        if (email) {
            const customers = await stripeIntegration.stripe.customers.list({ email, limit: 1 });
            if (customers.data.length > 0) {
                const subs = await stripeIntegration.stripe.subscriptions.list({ customer: customers.data[0].id, status: 'active', limit: 1 });
                if (subs.data.length > 0) {
                    return res.json({ active: true, plan: subs.data[0].items?.data[0]?.price?.lookup_key || 'student' });
                }
            }
        }
        res.json({ active: false, plan: 'free' });
    } catch (err) {
        console.error('Subscription verify error:', err.message);
        res.json({ active: false, plan: 'free' });
    }
});

const DEX_TOKENS = {
    bsc: [
        { symbol: 'BNB',  name: 'BNB',           address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', decimals: 18 },
        { symbol: 'USDC', name: 'USD Coin',       address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', decimals: 18 },
        { symbol: 'USDT', name: 'Tether USD',     address: '0x55d398326f99059fF775485246999027B3197955', decimals: 18 },
        { symbol: 'BUSD', name: 'Binance USD',    address: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56', decimals: 18 },
        { symbol: 'ETH',  name: 'Ethereum',       address: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8', decimals: 18 },
        { symbol: 'BTCB', name: 'Bitcoin BEP-20', address: '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c', decimals: 18 },
        { symbol: 'CAKE', name: 'PancakeSwap',    address: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82', decimals: 18 },
        { symbol: 'XRP',  name: 'XRP Token',      address: '0x1D2F0da169ceB9fC7B3144628dB156f3F6c60dBE', decimals: 18 },
        { symbol: 'ADA',  name: 'Cardano Token',  address: '0x3EE2200Efb3400fAbB9AacF31297cBdD1d435D47', decimals: 18 },
        { symbol: 'DOT',  name: 'Polkadot Token', address: '0x7083609fCE4d1d8Dc0C979AAb8c869Ea2C873402', decimals: 18 }
    ],
    ethereum: [
        { symbol: 'ETH',  name: 'Ethereum',       address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', decimals: 18 },
        { symbol: 'USDC', name: 'USD Coin',       address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6  },
        { symbol: 'USDT', name: 'Tether USD',     address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6  },
        { symbol: 'WBTC', name: 'Wrapped BTC',    address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', decimals: 8  },
        { symbol: 'DAI',  name: 'Dai Stablecoin', address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', decimals: 18 },
        { symbol: 'WETH', name: 'Wrapped ETH',    address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', decimals: 18 }
    ]
};

const DEX_TOKEN_MAP = {};
Object.entries(DEX_TOKENS).forEach(([net, list]) => {
    DEX_TOKEN_MAP[net] = {};
    list.forEach(t => { DEX_TOKEN_MAP[net][t.address.toLowerCase()] = t; });
});

app.get('/api/utl/dex/tokens', (req, res) => {
    const { network } = req.query;
    res.json({ tokens: DEX_TOKENS[network] || DEX_TOKENS.bsc });
});

app.get('/api/utl/dex/quote', async (req, res) => {
    const { fromToken, toToken, amount, network, slippage, fromAddress } = req.query;
    const chainId = network === 'ethereum' ? 1 : 56;
    const userAddr = fromAddress || '0x0000000000000000000000000000000000000000';

    try {
        const net = network || 'bsc';
        const fromInfo = DEX_TOKEN_MAP[net]?.[fromToken?.toLowerCase()] || { symbol: 'UNKNOWN', decimals: 18 };
        const toInfo   = DEX_TOKEN_MAP[net]?.[toToken?.toLowerCase()]   || { symbol: 'UNKNOWN', decimals: 18 };

        const UTL_FEE_COLLECTOR = '0xfE537c43d202C455Cedc141B882c808287BB662f';
        const url = `https://apiv5.paraswap.io/prices?srcToken=${fromToken}&destToken=${toToken}&srcDecimals=${fromInfo.decimals}&destDecimals=${toInfo.decimals}&amount=${amount}&side=SELL&network=${chainId}&userAddress=${userAddr}&partner=utl&partnerAddress=${UTL_FEE_COLLECTOR}&partnerFeeBps=10`;
        const resp = await fetch(url, { headers: { 'Accept': 'application/json' }, signal: AbortSignal.timeout(8000) });

        if (resp.ok) {
            const data = await resp.json();
            const pr = data.priceRoute;
            if (pr && pr.destAmount) {
                const fromAmtHuman = parseFloat(pr.srcAmount) / Math.pow(10, pr.srcDecimals || fromInfo.decimals);
                const toAmtHuman   = parseFloat(pr.destAmount) / Math.pow(10, pr.destDecimals || toInfo.decimals);
                const usdValue = parseFloat(pr.srcUSD || 0) || (fromAmtHuman * 1);
                const bestRoute = (pr.bestRoute || []).flatMap(r => (r.swaps || []).flatMap(s => (s.swapExchanges || []).map(e => ({ name: e.exchange, part: Math.round(e.percent || 0) }))));
                return res.json({
                    live: true,
                    provider: 'ParaSwap',
                    fromToken: { symbol: fromInfo.symbol, address: fromToken, decimals: fromInfo.decimals },
                    toToken:   { symbol: toInfo.symbol,   address: toToken,   decimals: toInfo.decimals },
                    fromAmount: pr.srcAmount,
                    toAmount:   pr.destAmount,
                    toAmountHuman: toAmtHuman.toFixed(8),
                    rate: `${(toAmtHuman / fromAmtHuman).toFixed(6)}`,
                    priceImpact: (parseFloat(pr.maxImpactReached || 0)).toFixed(3),
                    estimatedGas: pr.gasCost || '200000',
                    protocols: bestRoute.length ? bestRoute : [{ name: 'ParaSwap', part: 100 }],
                    utlFee: (usdValue * 0.001).toFixed(4),
                    savings: pr.side === 'SELL' ? (Math.random() * 1.5 + 0.3).toFixed(2) : '0.50',
                    priceRoute: pr
                });
            }
        }
    } catch (err) {
        console.log('ParaSwap quote error, using fallback:', err.message);
    }

    const fallbackPrices = { BNB: 620, USDC: 1.0, USDT: 1.0, BUSD: 1.0, ETH: 2850, BTCB: 97500, WBTC: 97500, CAKE: 2.45, XRP: 2.55, ADA: 0.78, DOT: 7.15, DAI: 1.0, WETH: 2850 };
    const net = network || 'bsc';
    const fromInfo = DEX_TOKEN_MAP[net]?.[fromToken?.toLowerCase()] || { symbol: 'UNKNOWN', decimals: 18 };
    const toInfo   = DEX_TOKEN_MAP[net]?.[toToken?.toLowerCase()]   || { symbol: 'UNKNOWN', decimals: 18 };
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) return res.status(400).json({ error: 'Invalid amount' });
    const fromAmtHuman  = parsedAmount / Math.pow(10, fromInfo.decimals);
    const usdValue      = fromAmtHuman * (fallbackPrices[fromInfo.symbol] || 1);
    const toAmtHuman    = usdValue / (fallbackPrices[toInfo.symbol] || 1);
    const slip          = Math.min(Math.max(parseFloat(slippage || '0.5'), 0), 50) / 100;
    const toAfterSlip   = toAmtHuman * (1 - slip);
    const dexNames      = ['PancakeSwap V3', 'PancakeSwap V2', 'BiSwap', 'DODO', 'Wombat', 'Thena'];
    const mainPart      = 65 + Math.floor(Math.random() * 25);
    res.json({
        live: false, simulated: true, provider: 'ParaSwap',
        fromToken: { symbol: fromInfo.symbol, address: fromToken, decimals: fromInfo.decimals },
        toToken:   { symbol: toInfo.symbol,   address: toToken,   decimals: toInfo.decimals },
        fromAmount: amount,
        toAmount: BigInt(Math.floor(toAfterSlip * Math.pow(10, toInfo.decimals))).toString(),
        toAmountHuman: toAfterSlip.toFixed(8),
        rate: (toAfterSlip / fromAmtHuman).toFixed(6),
        priceImpact: (Math.random() * 0.25).toFixed(3),
        estimatedGas: (180000 + Math.floor(Math.random() * 70000)).toString(),
        protocols: [{ name: dexNames[Math.floor(Math.random() * 3)], part: mainPart }, { name: dexNames[3 + Math.floor(Math.random() * 3)], part: 100 - mainPart }],
        utlFee: (usdValue * 0.001).toFixed(4),
        savings: (Math.random() * 1.5 + 0.3).toFixed(2)
    });
});

app.post('/api/utl/dex/swap-data', async (req, res) => {
    const { priceRoute, fromAddress, slippage, network } = req.body;
    const chainId = network === 'ethereum' ? 1 : 56;

    if (!priceRoute || !fromAddress) {
        return res.json({ live: false, simulated: true, message: 'Get a quote first' });
    }

    try {
        const slippageBps = Math.round((parseFloat(slippage) || 0.5) * 100);

        // Calculate min dest amount with slippage applied
        const destAmountBig = BigInt(priceRoute.destAmount || '0');
        const slippageFactor = BigInt(10000 - slippageBps);
        const minDestAmount = ((destAmountBig * slippageFactor) / BigInt(10000)).toString();

        // ParaSwap requires EITHER slippage OR destAmount — not both
        // We send slippage in basis points and let ParaSwap calculate the minimum
        const buildBody = {
            priceRoute,
            srcToken: priceRoute.srcToken,
            destToken: priceRoute.destToken,
            srcAmount: priceRoute.srcAmount,
            slippage: slippageBps,
            userAddress: fromAddress,
            srcDecimals: priceRoute.srcDecimals,
            destDecimals: priceRoute.destDecimals
        };

        const resp = await fetch(`https://apiv5.paraswap.io/transactions/${chainId}?ignoreChecks=true&onlyParams=false`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify(buildBody),
            signal: AbortSignal.timeout(10000)
        });

        if (resp.ok) {
            const data = await resp.json();
            return res.json({ live: true, to: data.to, data: data.data, value: data.value, gas: data.gas, toAmount: priceRoute.destAmount });
        }

        const errText = await resp.text();
        console.log('ParaSwap tx build error:', resp.status, errText);

        // Fallback: try 1inch aggregator for BSC
        if (chainId === 56) {
            const inch = await fetch(
                `https://api.1inch.dev/swap/v6.0/56/swap?src=${priceRoute.srcToken}&dst=${priceRoute.destToken}&amount=${priceRoute.srcAmount}&from=${fromAddress}&slippage=${parseFloat(slippage) || 0.5}&disableEstimate=true`,
                { headers: { 'Accept': 'application/json', 'Authorization': 'Bearer ' + (process.env.ONEINCH_API_KEY || '') }, signal: AbortSignal.timeout(8000) }
            );
            if (inch.ok) {
                const iData = await inch.json();
                if (iData.tx) {
                    return res.json({ live: true, to: iData.tx.to, data: iData.tx.data, value: iData.tx.value, gas: iData.tx.gas, toAmount: priceRoute.destAmount });
                }
            }
        }
    } catch (err) {
        console.log('DEX swap-data error:', err.message);
    }

    res.json({ live: false, simulated: true, message: 'Swap routing unavailable — quote data preserved. Try adjusting slippage or switching tokens.' });
});

let cgPriceCache = { data: null, ts: 0 };
app.get('/api/utl/prices', async (req, res) => {
    const now = Date.now();
    if (cgPriceCache.data && now - cgPriceCache.ts < 60000) {
        return res.json(cgPriceCache.data);
    }
    try {
        const resp = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=binancecoin,usd-coin,ethereum,bitcoin&vs_currencies=usd&include_24hr_change=true', {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(6000)
        });
        if (resp.ok) {
            const raw = await resp.json();
            const result = {
                BNB:  { price: raw['binancecoin']?.usd || 0,  change24h: raw['binancecoin']?.usd_24h_change || 0  },
                ETH:  { price: raw['ethereum']?.usd || 0,     change24h: raw['ethereum']?.usd_24h_change || 0     },
                BTC:  { price: raw['bitcoin']?.usd || 0,      change24h: raw['bitcoin']?.usd_24h_change || 0      },
                USDC: { price: raw['usd-coin']?.usd || 1,     change24h: raw['usd-coin']?.usd_24h_change || 0     }
            };
            cgPriceCache = { data: result, ts: now };
            return res.json(result);
        }
    } catch (err) {
        console.log('CoinGecko price error:', err.message);
    }
    res.json(cgPriceCache.data || {
        BNB: { price: 620, change24h: 0 }, ETH: { price: 2850, change24h: 0 },
        BTC: { price: 97500, change24h: 0 }, USDC: { price: 1, change24h: 0 }
    });
});

// ═══════════════════════════════════════════════════════════════════
// UTL FEECOLLECTOR — CODE IS LAW — ALL FEE ENDPOINTS
// ═══════════════════════════════════════════════════════════════════

// GET: Full fee schedule, tier structure, distribution split
app.get('/api/utl/fee/schedule', (req, res) => {
    if (!utlFeeCollector) return res.status(503).json({ error: 'FeeCollector not ready' });
    res.json({
        success: true,
        feeSchedule: utlFeeCollector.feeSchedule,
        loyaltyTiers: utlFeeCollector.loyaltyTiers,
        distributionSplit: utlFeeCollector.split,
        contracts: utlFeeCollector.contracts
    });
});

// GET: Aggregate stats — total collected, by category, by type, projections
app.get('/api/utl/fee/stats', (req, res) => {
    if (!utlFeeCollector) return res.status(503).json({ error: 'FeeCollector not ready' });
    res.json({ success: true, ...utlFeeCollector.getStats() });
});

// GET: Recent fee collection events (live ledger)
app.get('/api/utl/fee/events', (req, res) => {
    if (!utlFeeCollector) return res.status(503).json({ error: 'FeeCollector not ready' });
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    res.json({ success: true, events: utlFeeCollector.getRecentEvents(limit) });
});

// GET: Top toll payers — leaderboard
app.get('/api/utl/fee/leaderboard', (req, res) => {
    if (!utlFeeCollector) return res.status(503).json({ error: 'FeeCollector not ready' });
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    res.json({ success: true, leaderboard: utlFeeCollector.getLeaderboard(limit) });
});

// GET: Individual wallet profile — tier, toll history, governance weight
app.get('/api/utl/fee/wallet/:address', (req, res) => {
    if (!utlFeeCollector) return res.status(503).json({ error: 'FeeCollector not ready' });
    const profile = utlFeeCollector.getWalletProfile(req.params.address);
    const govWeight = utlFeeCollector.getGovernanceWeight(req.params.address);
    res.json({ success: true, profile, governance: govWeight });
});

// GET: Governance weight for a wallet
app.get('/api/utl/fee/governance/:address', (req, res) => {
    if (!utlFeeCollector) return res.status(503).json({ error: 'FeeCollector not ready' });
    res.json({ success: true, ...utlFeeCollector.getGovernanceWeight(req.params.address) });
});

// POST: Record a fee collection event
// Body: { feeType, walletAddress, principalAmount, flatFeeKey, metadata }
app.post('/api/utl/fee/collect', async (req, res) => {
    if (!utlFeeCollector) return res.status(503).json({ error: 'FeeCollector not ready' });
    try {
        const { feeType, walletAddress, principalAmount = 0, flatFeeKey, metadata = {} } = req.body;
        if (!feeType) return res.status(400).json({ error: 'feeType is required' });
        const event = utlFeeCollector.collect({ feeType, walletAddress, principalAmount: parseFloat(principalAmount), flatFeeKey, metadata });
        if (!event) return res.status(400).json({ error: 'Fee amount resolved to zero — check feeType and amount' });
        const profile = utlFeeCollector.getWalletProfile(walletAddress);
        res.json({
            success: true,
            message: 'Fee collected and distributed — Code is Law',
            event,
            walletTier: profile.tier,
            tierConfig: profile.tierConfig,
            progressToNextTier: profile.progressToNextTier
        });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// POST: Record a KENO distribution toll (Category A)
app.post('/api/utl/fee/distribution-toll', async (req, res) => {
    if (!utlFeeCollector) return res.status(503).json({ error: 'FeeCollector not ready' });
    try {
        const { walletAddress, kenoAmount } = req.body;
        const event = utlFeeCollector.collect({
            feeType: 'DISTRIBUTION_TOLL',
            walletAddress,
            principalAmount: parseFloat(kenoAmount) || 0,
            metadata: { source: 'keno_distribution' }
        });
        res.json({ success: true, event, distribution: event?.distribution });
    } catch (err) { res.status(400).json({ error: err.message }); }
});

// POST: Record a staking toll (Category A)
app.post('/api/utl/fee/staking-toll', async (req, res) => {
    if (!utlFeeCollector) return res.status(503).json({ error: 'FeeCollector not ready' });
    try {
        const { walletAddress, stakeAmount, action } = req.body; // action: 'stake' | 'unstake'
        const event = utlFeeCollector.collect({
            feeType: 'STAKING_TOLL',
            walletAddress,
            principalAmount: parseFloat(stakeAmount) || 0,
            metadata: { action: action || 'stake' }
        });
        res.json({ success: true, event, distribution: event?.distribution });
    } catch (err) { res.status(400).json({ error: err.message }); }
});

// POST: Record FAL™ completion fee (Category B)
app.post('/api/utl/fee/fal-completion', async (req, res) => {
    if (!utlFeeCollector) return res.status(503).json({ error: 'FeeCollector not ready' });
    try {
        const { walletAddress, loanAmount, profit } = req.body;
        const event = utlFeeCollector.collect({
            feeType: 'FAL_COMPLETION_FEE',
            walletAddress,
            principalAmount: parseFloat(loanAmount) || 0,
            metadata: { loanAmount, profit }
        });
        res.json({ success: true, event, distribution: event?.distribution });
    } catch (err) { res.status(400).json({ error: err.message }); }
});

// POST: Record credential verification fee (Category D)
app.post('/api/utl/fee/credential-verify', async (req, res) => {
    if (!utlFeeCollector) return res.status(503).json({ error: 'FeeCollector not ready' });
    try {
        const { requestorAddress, graduateWallet, verifyTier = 'single' } = req.body;
        // Look up the graduate wallet in DB for verification
        const gradResult = dbConnection ? await dbConnection.query(
            'SELECT * FROM graduates WHERE wallet_address = $1 LIMIT 1',
            [graduateWallet]
        ).catch(() => null) : null;
        const isVerified = gradResult && gradResult.rows.length > 0;
        const event = utlFeeCollector.collect({
            feeType: 'CREDENTIAL_VERIFICATION_FEE',
            walletAddress: requestorAddress,
            flatFeeKey: verifyTier,
            metadata: { graduateWallet, isVerified, verifyTier }
        });
        res.json({
            success: true,
            verified: isVerified,
            graduate: isVerified ? { wallet: graduateWallet, courses: gradResult.rows[0]?.total_courses, kenoEarned: gradResult.rows[0]?.keno_earned } : null,
            event,
            distribution: event?.distribution
        });
    } catch (err) { res.status(400).json({ error: err.message }); }
});

// POST: Record partner integration license fee (Category C)
app.post('/api/utl/fee/partner-license', async (req, res) => {
    if (!utlFeeCollector) return res.status(503).json({ error: 'FeeCollector not ready' });
    try {
        const { partnerAddress, partnerName, licenseTier = 'basic' } = req.body;
        const event = utlFeeCollector.collect({
            feeType: 'PARTNER_INTEGRATION_LICENSE',
            walletAddress: partnerAddress,
            flatFeeKey: licenseTier,
            metadata: { partnerName, licenseTier }
        });
        res.json({ success: true, event, distribution: event?.distribution, message: `${partnerName} licensed at ${licenseTier} tier` });
    } catch (err) { res.status(400).json({ error: err.message }); }
});

// POST: Record Graduate NFT royalty (Category E)
app.post('/api/utl/fee/nft-royalty', async (req, res) => {
    if (!utlFeeCollector) return res.status(503).json({ error: 'FeeCollector not ready' });
    try {
        const { sellerAddress, salePrice, nftId } = req.body;
        const event = utlFeeCollector.collect({
            feeType: 'GRADUATE_NFT_ROYALTY',
            walletAddress: sellerAddress,
            principalAmount: parseFloat(salePrice) || 0,
            metadata: { nftId, salePrice }
        });
        res.json({ success: true, event, distribution: event?.distribution });
    } catch (err) { res.status(400).json({ error: err.message }); }
});

// POST: Record cross-chain bridge fee (Category G)
app.post('/api/utl/fee/bridge', async (req, res) => {
    if (!utlFeeCollector) return res.status(503).json({ error: 'FeeCollector not ready' });
    try {
        const { walletAddress, bridgeAmount, fromChain, toChain } = req.body;
        const event = utlFeeCollector.collect({
            feeType: 'CROSS_CHAIN_BRIDGE_FEE',
            walletAddress,
            principalAmount: parseFloat(bridgeAmount) || 0,
            metadata: { fromChain, toChain }
        });
        res.json({ success: true, event, distribution: event?.distribution });
    } catch (err) { res.status(400).json({ error: err.message }); }
});

// POST: Record yield optimization fee (Category F)
app.post('/api/utl/fee/yield', async (req, res) => {
    if (!utlFeeCollector) return res.status(503).json({ error: 'FeeCollector not ready' });
    try {
        const { walletAddress, yieldAmount } = req.body;
        const event = utlFeeCollector.collect({
            feeType: 'YIELD_OPTIMIZATION_FEE',
            walletAddress,
            principalAmount: parseFloat(yieldAmount) || 0,
            metadata: { source: 'auto_compound' }
        });
        res.json({ success: true, event, distribution: event?.distribution });
    } catch (err) { res.status(400).json({ error: err.message }); }
});

// GET: DB-level fee event history for a wallet (paginated)
app.get('/api/utl/fee/history/:address', async (req, res) => {
    if (!dbConnection) return res.status(503).json({ error: 'DB not ready' });
    try {
        const limit  = Math.min(parseInt(req.query.limit)  || 50, 200);
        const offset = parseInt(req.query.offset) || 0;
        const { rows } = await dbConnection.query(
            `SELECT * FROM utl_fee_events WHERE wallet_address = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
            [req.params.address.toLowerCase(), limit, offset]
        );
        const total = await dbConnection.query(
            `SELECT COUNT(*) FROM utl_fee_events WHERE wallet_address = $1`,
            [req.params.address.toLowerCase()]
        );
        res.json({ success: true, events: rows, total: parseInt(total.rows[0]?.count || 0), limit, offset });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET: Total UTL revenue from DB (for external audits, investor reporting)
app.get('/api/utl/fee/audit', async (req, res) => {
    if (!dbConnection) return res.status(503).json({ error: 'DB not ready' });
    try {
        const totals = await dbConnection.query(`
            SELECT
                fee_type,
                fee_label,
                category,
                COUNT(*)          AS event_count,
                SUM(fee_amount)   AS total_collected,
                SUM(stakers_share)    AS total_stakers,
                SUM(foundation_share) AS total_foundation,
                SUM(treasury_share)   AS total_treasury
            FROM utl_fee_events
            GROUP BY fee_type, fee_label, category
            ORDER BY total_collected DESC
        `);
        const grand = await dbConnection.query(`
            SELECT
                COUNT(*)              AS total_events,
                SUM(fee_amount)       AS grand_total,
                SUM(stakers_share)    AS grand_stakers,
                SUM(foundation_share) AS grand_foundation,
                SUM(treasury_share)   AS grand_treasury,
                MIN(created_at)       AS first_event,
                MAX(created_at)       AS last_event
            FROM utl_fee_events
        `);
        res.json({
            success: true,
            auditReport: {
                byFeeType: totals.rows,
                grandTotals: grand.rows[0],
                generatedAt: new Date().toISOString(),
                contracts: utlFeeCollector?.contracts
            }
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/snap-package/snap.manifest.json', (req, res) => {
    res.setHeader('Content-Disposition', 'attachment; filename="snap.manifest.json"');
    res.sendFile(__dirname + '/utl/metamask-snap/snap.manifest.json');
});

app.get('/snap-package/serve-snap.js', (req, res) => {
    res.setHeader('Content-Disposition', 'attachment; filename="serve-snap.js"');
    res.sendFile(__dirname + '/utl/metamask-snap/serve-snap.js');
});

app.get('/snap-package/serve-snap-view', (req, res) => {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.sendFile(__dirname + '/utl/metamask-snap/serve-snap.js');
});

app.get('/snap-package/dist/bundle.js', (req, res) => {
    res.setHeader('Content-Disposition', 'attachment; filename="bundle.js"');
    res.sendFile(__dirname + '/utl/metamask-snap/dist/bundle.js');
});

app.get('/snap/dist/bundle.js', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/javascript');
    res.sendFile(__dirname + '/utl/metamask-snap/dist/bundle.js');
});

// CRITICAL: Health check endpoint for deployment - responds immediately
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve robots.txt and sitemap.xml for SEO
app.get('/robots.txt', (req, res) => {
    res.sendFile(__dirname + '/public/robots.txt');
});

app.get('/sitemap.xml', (req, res) => {
    res.sendFile(__dirname + '/public/sitemap.xml');
});

app.get('/KENO-CONTRACT-FOR-BSCSCAN-CLEAN.txt', (req, res) => {
    res.sendFile(__dirname + '/KENO-CONTRACT-FINAL.txt');
});

// STUB VARIABLES - will be initialized after port opens
let dataPersistence, kenostodChain, minerWallet, wallet1, wallet2, bankingAPI, stripeIntegration;
let paypalIntegration, merchantIncentives, revenueTracker, arbitrageSystem, falPoolManager, utlFeeCollector;
let bscTokenTransfer;
const liveArbBot = new LiveArbBot();
let icoPurchases = [], pendingPayPalOrders = new Map();

// Function to log ICO purchases and save to file
function logICOPurchase(purchaseData) {
    icoPurchases.push(purchaseData);
    if (dataPersistence) {
        dataPersistence.saveICOPurchases(icoPurchases);
    }
    console.log(`📊 ICO purchase logged: ${purchaseData.tokens} KENO for $${purchaseData.amount}`);
}
let dbConnection, organizationManager, wealthBuilderManager, securityMiddleware;
let printfulIntegration, aiSupport, microMonetization, mercuryBankAPI;
const MicroMonetization = require('./src/MicroMonetization');
const MercuryBankAPI = require('./src/MercuryBankAPI');

// Initialize blockchain and systems AFTER port opens
async function initializeBlockchainSystems() {
    try {
        // Initialize persistence
        dataPersistence = new DataPersistence();
        
        // Initialize blockchain
        kenostodChain = new Blockchain();
        const savedBlockchainData = dataPersistence.loadBlockchain();
        if (savedBlockchainData) {
            kenostodChain.restoreFromData(savedBlockchainData);
        }
        
        // Initialize wallets
        const savedWalletData = dataPersistence.loadWallet();
        if (savedWalletData) {
            minerWallet = Wallet.fromPrivateKey(savedWalletData.privateKey);
        } else {
            minerWallet = new Wallet();
            dataPersistence.saveWallet(minerWallet);
        }
        wallet1 = new Wallet();
        wallet2 = new Wallet();
        
        // Initialize integrations
        bankingAPI = new BankingAPI(kenostodChain, dataPersistence);
        stripeIntegration = new StripeIntegration();
        paypalIntegration = new PayPalIntegration();
        
        // Initialize BSC Token Transfer for real on-chain token delivery
        bscTokenTransfer = new BSCTokenTransfer();
        bscTokenTransfer.initialize();
        
        // Load fiat balances and ICO purchases
        const savedFiatBalances = dataPersistence.loadFiatBalances();
        if (savedFiatBalances) {
            bankingAPI.loadFiatBalances(savedFiatBalances);
        }
        icoPurchases = dataPersistence.loadICOPurchases();
        miningGrants = dataPersistence.loadMiningGrants();
        global.preOrderSellOrders = dataPersistence.loadPreOrders();
        
        // Initialize business logic
        merchantIncentives = new MerchantIncentives(kenostodChain);
        revenueTracker = new RevenueTracker();
        arbitrageSystem = new ArbitrageSystem(kenostodChain, dataPersistence);
        falPoolManager = new FALPoolManager(kenostodChain, dataPersistence, arbitrageSystem);
        utlFeeCollector = new UTLFeeCollector(dataPersistence, dbConnection);
        await utlFeeCollector.initDB();
        await utlFeeCollector.loadFromDB();
        
        // Connect systems
        kenostodChain.exchangeAPI.setBankingAPI(bankingAPI);
        kenostodChain.paymentGateway.merchantIncentives = merchantIncentives;
        kenostodChain.paymentGateway.revenueTracker = revenueTracker;
        kenostodChain.exchangeAPI.revenueTracker = revenueTracker;
        
        // Initialize utilities
        printfulIntegration = new PrintfulIntegration();
        aiSupport = new AISupport();
        microMonetization = new MicroMonetization(kenostodChain);
        
        // Initialize PostgreSQL database (non-blocking - do it after blockchain loads)
        try {
            dbConnection = new DatabaseConnection();
            await dbConnection.initializeSchema();
            organizationManager = new OrganizationManager(dbConnection);
            wealthBuilderManager = new WealthBuilderManager(dbConnection, bscTokenTransfer);
            securityMiddleware = new SecurityMiddleware(dbConnection);
            console.log('✅ Database initialized');
            await initializeTestGraduate();
        } catch (error) {
            console.error('⚠️  Database initialization failed:', error.message);
            console.log('   Continuing without database features...');
        }
        
        // Log startup messages
        console.log('Kenostod Blockchain initialized!');
        console.log('Miner address:', minerWallet.getAddress());
        console.log('Current balance:', kenostodChain.getBalanceOfAddress(minerWallet.getAddress()), 'KENO');
        console.log('Test wallet 1 address:', wallet1.getAddress());
        console.log('Test wallet 2 address:', wallet2.getAddress());
        console.log('Banking system initialized!');
        if (stripeIntegration.isTestMode()) {
            console.log('⚠️  Stripe running in TEST MODE');
        }
        if (paypalIntegration.isTestMode()) {
            console.log('⚠️  PayPal running in TEST MODE');
        }
        console.log('\n📦 Graduate Merchandise System:');
        console.log('   ✅ Email notifications enabled (Replit Mail)');
        console.log('   ✅ Printful integration available' + (printfulIntegration.isConfigured() ? ' (configured)' : ' (needs PRINTFUL_API_KEY)'));
        console.log('   ✅ Admin panel: /admin-merchandise.html');
        if (process.env.NODE_ENV !== 'production') {
            console.log('   🧪 Test Graduate Endpoint: POST /api/dev/create-test-graduate');
            console.log('      Use this to create test graduate accounts for testing merchandise orders');
        }
    } catch (error) {
        console.error('❌ Error initializing blockchain systems:', error.message);
    }
}

async function initializeTestGraduate() {
    if (!dbConnection) {
        return;
    }
    
    try {
        const testWallet = '0xTEST1234567890ABCDEF1234567890ABCDEF1234';
        
        const existingGraduate = await dbConnection.query(
            'SELECT * FROM kenostod_graduates WHERE wallet_address = $1',
            [testWallet]
        );
        
        if (existingGraduate.rows.length === 0) {
            await dbConnection.query(`
                INSERT INTO kenostod_graduates 
                (graduate_id, wallet_address, user_email, completion_date, total_courses, keno_earned, rvt_nft_tier, certificate_hash)
                VALUES 
                ('KG-20250101-TEST', $1, 'test.graduate@kenostod.com', '2025-01-01', 21, 5250, 'Platinum', 'test-cert-hash-KG-20250101-TEST')
            `, [testWallet]);
            
            console.log('\n🎓 Test Graduate Account Created!');
            console.log('   Wallet: 0xTEST1234567890ABCDEF1234567890ABCDEF1234');
            console.log('   Graduate ID: KG-20250101-TEST');
            console.log('   Email: test.graduate@kenostod.com');
            console.log('   ');
            console.log('   To test merchandise system:');
            console.log('   1. Use this wallet address in the request form');
            console.log('   2. System will recognize it as a verified graduate');
            console.log('   3. Submit test orders to see the full flow\n');
        } else {
            console.log('✅ Test graduate account already exists (KG-20250101-TEST)');
        }
    } catch (error) {
        console.error('⚠️  Error creating test graduate:', error.message);
    }
}

// Admin Authentication Middleware - Header-based (works with Replit proxy)
const adminAuth = (req, res, next) => {
    const adminPassword = process.env.ADMIN_PASSWORD;
    const providedPassword = req.headers['x-admin-password'];

    if (!adminPassword) {
        return res.status(500).json({ error: 'Server configuration error' });
    }

    if (providedPassword === adminPassword) {
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized' });
    }
};

// Mining grant applications storage
let miningGrants = [];
try {
    const fs = require('fs');
    if (fs.existsSync('./mining_grants.json')) {
        miningGrants = JSON.parse(fs.readFileSync('./mining_grants.json', 'utf8') || '[]');
    }
} catch (e) {
    console.error('Error loading grants:', e);
}

// Helper to save grants
function saveGrants() {
    try {
        require('fs').writeFileSync('./mining_grants.json', JSON.stringify(miningGrants, null, 2));
    } catch (e) {
        console.error('Error saving grants:', e);
    }
}

// Initial seed if empty
if (miningGrants.length === 0) {
    miningGrants = [
        {
            id: 'GR-1734876737000',
            walletAddress: '0x65791E0B5Cbac5F40c76cDe31bf4F074D982FD0E',
            coursesCompleted: 21,
            experience: 'Expert',
            interest: 'Applying to become a certified KENO miner to contribute to the network security and earn PoRV rewards.',
            goals: 'Establish a high-performance mining node and participate in community governance.',
            status: 'pending',
            appliedAt: new Date(Date.now() - 86400000).toISOString()
        }
    ];
    saveGrants();
}

// Mining grant application endpoint
app.post('/api/grants/apply', (req, res) => {
    try {
        const { walletAddress, coursesCompleted, interest, goals, experience } = req.body;
        
        if (!walletAddress || !coursesCompleted || !interest || !goals || !experience) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const application = {
            id: 'GRANT-' + Date.now(),
            walletAddress,
            coursesCompleted,
            interest,
            goals,
            experience,
            appliedAt: new Date().toISOString(),
            status: 'pending'
        };

        miningGrants.push(application);
        
        if (dataPersistence) {
            dataPersistence.saveMiningGrants(miningGrants);
        }

        console.log(`📝 Mining grant application received from ${walletAddress}`);
        res.json({ success: true, message: 'Application submitted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Admin endpoint to view grants (protected)
app.get('/api/admin/grants', adminAuth, (req, res) => {
    res.json(miningGrants);
});

// Enterprise inquiry storage
let enterpriseInquiries = [];
try {
    const saved = require('fs').readFileSync('./enterprise_inquiries.json', 'utf8');
    enterpriseInquiries = JSON.parse(saved);
} catch (e) {
    enterpriseInquiries = [];
}

// Enterprise inquiry endpoint
app.post('/api/enterprise/inquiry', async (req, res) => {
    try {
        const { organizationName, contactName, email, phone, organizationType, learnerCount, message } = req.body;
        
        if (!organizationName || !contactName || !email || !organizationType || !learnerCount) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }
        
        const inquiry = {
            id: 'ENT-' + Date.now(),
            organizationName,
            contactName,
            email,
            phone: phone || '',
            organizationType,
            learnerCount,
            message: message || '',
            status: 'new',
            submittedAt: new Date().toISOString()
        };
        
        enterpriseInquiries.push(inquiry);
        
        try {
            require('fs').writeFileSync('./enterprise_inquiries.json', JSON.stringify(enterpriseInquiries, null, 2));
        } catch (e) {
            console.error('Error saving enterprise inquiry:', e);
        }
        
        console.log(`🏢 Enterprise inquiry received from ${organizationName} (${contactName})`);
        
        res.json({ 
            success: true, 
            message: 'Thank you for your interest! Our enterprise team will contact you within 24 hours.',
            inquiryId: inquiry.id
        });
    } catch (error) {
        console.error('Enterprise inquiry error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Admin endpoint to view enterprise inquiries
app.get('/api/admin/enterprise-inquiries', adminAuth, (req, res) => {
    res.json({ success: true, inquiries: enterpriseInquiries });
});

// ==================== LICENSE INQUIRY SYSTEM ====================

let licenseInquiries = [];
try {
    const saved = require('fs').readFileSync('./license_inquiries.json', 'utf8');
    licenseInquiries = JSON.parse(saved);
} catch (e) {
    licenseInquiries = [];
}

app.post('/api/license-inquiry', async (req, res) => {
    try {
        const { name, company, email, phone, licenseType, useCase, timeline, message } = req.body;

        if (!name || !company || !email || !licenseType) {
            return res.status(400).json({ success: false, error: 'Missing required fields: name, company, email, licenseType' });
        }

        const inquiry = {
            id: 'LIC-' + Date.now(),
            name,
            company,
            email,
            phone: phone || '',
            licenseType,
            useCase: useCase || '',
            timeline: timeline || '',
            message: message || '',
            status: 'new',
            submittedAt: new Date().toISOString()
        };

        licenseInquiries.push(inquiry);

        try {
            require('fs').writeFileSync('./license_inquiries.json', JSON.stringify(licenseInquiries, null, 2));
        } catch (e) {
            console.error('Error saving license inquiry:', e);
        }

        console.log(`📋 License inquiry [${inquiry.id}] from ${company} (${name}) — ${licenseType}`);

        res.json({
            success: true,
            message: 'Thank you for your interest! Our licensing team will reach out within 1 business day.',
            inquiryId: inquiry.id
        });
    } catch (error) {
        console.error('License inquiry error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/admin/license-inquiries', adminAuth, (req, res) => {
    res.json({ success: true, inquiries: licenseInquiries });
});

// ==================== WITHDRAWAL NOTIFICATION SYSTEM ====================

let withdrawNotifyList = [];
try {
    const saved = require('fs').readFileSync('./withdraw_notify_list.json', 'utf8');
    withdrawNotifyList = JSON.parse(saved);
} catch (e) {
    withdrawNotifyList = [];
}

app.post('/api/withdraw-notify', (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email || !email.includes('@')) {
            return res.status(400).json({ success: false, error: 'Invalid email address' });
        }
        
        const normalizedEmail = email.toLowerCase().trim();
        
        if (withdrawNotifyList.some(e => e.email === normalizedEmail)) {
            return res.json({ success: true, message: 'Already subscribed' });
        }
        
        withdrawNotifyList.push({
            email: normalizedEmail,
            subscribedAt: new Date().toISOString()
        });
        
        try {
            require('fs').writeFileSync('./withdraw_notify_list.json', JSON.stringify(withdrawNotifyList, null, 2));
        } catch (e) {
            console.error('Error saving withdraw notify list:', e);
        }
        
        console.log(`📧 Withdrawal notification subscription: ${normalizedEmail}`);
        res.json({ success: true, message: 'Subscribed successfully' });
    } catch (error) {
        console.error('Withdraw notify error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/admin/withdraw-notify-list', adminAuth, (req, res) => {
    res.json({ success: true, subscribers: withdrawNotifyList });
});

// ==================== NODE SALE WHITELIST SYSTEM (PostgreSQL) ====================

// KENO contract address (to prevent confusion)
const KENO_CONTRACT_ADDRESS = '0x65791e0b5cbac5f40c76cde31bf4f074d982fd0e';

// Node whitelist registration endpoint
app.post('/api/node-whitelist', async (req, res) => {
    try {
        const { email, wallet, tier } = req.body;
        
        if (!email || !wallet || !tier) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }
        
        if (!dbConnection) {
            return res.status(503).json({ success: false, error: 'Database unavailable' });
        }
        
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ success: false, error: 'Invalid email format' });
        }
        
        // Validate wallet format
        const normalizedWallet = wallet.toLowerCase();
        if (!normalizedWallet.match(/^0x[a-f0-9]{40}$/)) {
            return res.status(400).json({ success: false, error: 'Invalid wallet address format' });
        }
        
        // Prevent KENO contract address
        if (normalizedWallet === KENO_CONTRACT_ADDRESS) {
            return res.status(400).json({ 
                success: false, 
                error: 'This is the KENO token contract address, not your personal wallet. Please use your MetaMask wallet address.' 
            });
        }
        
        // Validate tier
        const validTiers = ['scholar', 'educator', 'academy'];
        if (!validTiers.includes(tier)) {
            return res.status(400).json({ success: false, error: 'Invalid tier selection' });
        }
        
        const whitelistId = 'NODE-' + Date.now();
        
        // Insert into PostgreSQL (unique constraints will handle duplicates)
        await dbConnection.query(
            `INSERT INTO node_whitelist (whitelist_id, email, wallet, tier) VALUES ($1, $2, $3, $4)`,
            [whitelistId, email.toLowerCase(), normalizedWallet, tier]
        );
        
        console.log(`🖥️ Node whitelist registration: ${email} for ${tier} node`);
        
        res.json({ 
            success: true, 
            message: 'Successfully added to whitelist!',
            whitelistId
        });
    } catch (error) {
        console.error('Node whitelist error:', error);
        // Handle unique constraint violations
        if (error.code === '23505') {
            return res.status(400).json({ 
                success: false, 
                error: 'This email or wallet is already on the whitelist' 
            });
        }
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get node whitelist stats (public)
app.get('/api/node-whitelist/stats', async (req, res) => {
    try {
        if (!dbConnection) {
            return res.status(503).json({ success: false, error: 'Database unavailable' });
        }
        
        const totalResult = await dbConnection.query('SELECT COUNT(*) as total FROM node_whitelist');
        const tierResult = await dbConnection.query(
            `SELECT tier, COUNT(*) as count FROM node_whitelist GROUP BY tier`
        );
        
        const byTier = { scholar: 0, educator: 0, academy: 0 };
        tierResult.rows.forEach(row => {
            byTier[row.tier] = parseInt(row.count);
        });
        
        res.json({ 
            success: true, 
            stats: {
                total: parseInt(totalResult.rows[0].total),
                byTier
            }
        });
    } catch (error) {
        console.error('Node whitelist stats error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Admin endpoint to view node whitelist
app.get('/api/admin/node-whitelist', adminAuth, async (req, res) => {
    try {
        if (!dbConnection) {
            return res.status(503).json({ success: false, error: 'Database unavailable' });
        }
        
        const result = await dbConnection.query(
            'SELECT whitelist_id, email, wallet, tier, registered_at, status FROM node_whitelist ORDER BY registered_at DESC'
        );
        
        res.json({ success: true, whitelist: result.rows });
    } catch (error) {
        console.error('Node whitelist fetch error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== KENO CLAIM SYSTEM (PostgreSQL) ====================

// Get user's claimable KENO balance (supports email AND/OR wallet lookup)
app.get('/api/claims/balance/:email', async (req, res) => {
    try {
        const emailOrWallet = req.params.email.toLowerCase();
        const walletParam = req.query.wallet ? req.query.wallet.toLowerCase() : null;
        
        if (!dbConnection) {
            return res.status(503).json({ success: false, error: 'Database unavailable' });
        }
        
        // Get claimable rewards: status='available' OR status='claimed' (not yet claimed via form)
        // 'claimed' means auto-transferred on-chain, but can still be claimed via form for record-keeping
        let claimableRewardsResult;
        if (walletParam) {
            claimableRewardsResult = await dbConnection.query(
                `SELECT COALESCE(SUM(reward_amount), 0) as total_claimable 
                 FROM student_rewards 
                 WHERE (LOWER(user_email) = $1 OR LOWER(user_wallet_address) = $1 
                    OR LOWER(user_email) = $2 OR LOWER(user_wallet_address) = $2)
                 AND (status = 'available' OR status = 'claimed')`,
                [emailOrWallet, walletParam]
            );
        } else {
            claimableRewardsResult = await dbConnection.query(
                `SELECT COALESCE(SUM(reward_amount), 0) as total_claimable 
                 FROM student_rewards 
                 WHERE (LOWER(user_email) = $1 OR LOWER(user_wallet_address) = $1)
                 AND (status = 'available' OR status = 'claimed')`,
                [emailOrWallet]
            );
        }
        
        // Get total already claimed via claim form (from keno_claims table)
        const claimedResult = await dbConnection.query(
            `SELECT COALESCE(SUM(amount), 0) as total_claimed 
             FROM keno_claims 
             WHERE (LOWER(email) = $1 OR LOWER(wallet_address) = $1 ${walletParam ? 'OR LOWER(email) = $2 OR LOWER(wallet_address) = $2' : ''}) 
             AND status = 'completed'`,
            walletParam ? [emailOrWallet, walletParam] : [emailOrWallet]
        );
        
        // Get pending claims from claim form
        const pendingResult = await dbConnection.query(
            `SELECT COALESCE(SUM(amount), 0) as total_pending 
             FROM keno_claims 
             WHERE (LOWER(email) = $1 OR LOWER(wallet_address) = $1 ${walletParam ? 'OR LOWER(email) = $2 OR LOWER(wallet_address) = $2' : ''}) 
             AND status = 'pending'`,
            walletParam ? [emailOrWallet, walletParam] : [emailOrWallet]
        );
        
        // Get total earned from all sources (for info display)
        let totalEarnedResult;
        if (walletParam) {
            totalEarnedResult = await dbConnection.query(
                `SELECT COALESCE(SUM(reward_amount), 0) as total_earned 
                 FROM student_rewards 
                 WHERE (LOWER(user_email) = $1 OR LOWER(user_wallet_address) = $1 
                    OR LOWER(user_email) = $2 OR LOWER(user_wallet_address) = $2)`,
                [emailOrWallet, walletParam]
            );
        } else {
            totalEarnedResult = await dbConnection.query(
                `SELECT COALESCE(SUM(reward_amount), 0) as total_earned 
                 FROM student_rewards 
                 WHERE (LOWER(user_email) = $1 OR LOWER(user_wallet_address) = $1)`,
                [emailOrWallet]
            );
        }
        
        const totalEarned = parseFloat(totalEarnedResult.rows[0]?.total_earned || 0);
        const totalClaimable = parseFloat(claimableRewardsResult.rows[0]?.total_claimable || 0);
        const alreadyClaimed = parseFloat(claimedResult.rows[0]?.total_claimed || 0);
        const pendingClaims = parseFloat(pendingResult.rows[0]?.total_pending || 0);
        const claimable = totalClaimable - alreadyClaimed - pendingClaims;
        
        res.json({
            success: true,
            email: emailOrWallet,
            wallet: walletParam,
            totalEarned,
            alreadyClaimed,
            pendingClaims,
            claimable
        });
    } catch (error) {
        console.error('Error fetching claimable balance:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Submit a claim request
app.post('/api/claims/request', async (req, res) => {
    try {
        const { email, walletAddress, amount } = req.body;
        
        if (!email || !walletAddress || !amount) {
            return res.status(400).json({ 
                success: false, 
                error: 'Email, wallet address, and amount are required' 
            });
        }
        
        // Validate wallet address
        const { ethers } = require('ethers');
        if (!ethers.isAddress(walletAddress)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid BSC wallet address. Must start with 0x' 
            });
        }
        
        // SECURITY: Reject KENO contract address as destination (common user mistake)
        const KENO_CONTRACT = '0x65791e0b5cbac5f40c76cde31bf4f074d982fd0e';
        if (walletAddress.toLowerCase() === KENO_CONTRACT) {
            return res.status(400).json({ 
                success: false, 
                error: 'This is the KENO token contract address, not a personal wallet. Please use your MetaMask wallet address (shown at the top of MetaMask app) instead.' 
            });
        }
        
        // Check claimable balance
        if (!dbConnection) {
            return res.status(503).json({ success: false, error: 'Database unavailable' });
        }
        
        const rewardsResult = await dbConnection.query(
            `SELECT COALESCE(SUM(reward_amount), 0) as total_earned 
             FROM student_rewards 
             WHERE LOWER(user_email) = $1 OR LOWER(user_wallet_address) = $2`,
            [email.toLowerCase(), walletAddress.toLowerCase()]
        );
        
        const existingClaimsResult = await dbConnection.query(
            `SELECT COALESCE(SUM(amount), 0) as total_claimed 
             FROM keno_claims 
             WHERE (LOWER(email) = $1 OR LOWER(wallet_address) = $2) AND (status = 'completed' OR status = 'pending')`,
            [email.toLowerCase(), walletAddress.toLowerCase()]
        );
        
        const totalEarned = parseFloat(rewardsResult.rows[0]?.total_earned || 0);
        const existingClaims = parseFloat(existingClaimsResult.rows[0]?.total_claimed || 0);
        const claimable = Math.max(0, totalEarned - existingClaims);
        
        if (amount > claimable) {
            return res.status(400).json({
                success: false,
                error: `Insufficient claimable balance. You can claim up to ${claimable} KENO.`
            });
        }
        
        if (amount < 1) {
            return res.status(400).json({
                success: false,
                error: 'Minimum claim amount is 1 KENO'
            });
        }
        
        // Create claim request in PostgreSQL
        const claimId = 'CLAIM-' + Date.now();
        
        await dbConnection.query(`
            INSERT INTO keno_claims (claim_id, email, wallet_address, amount, status)
            VALUES ($1, $2, $3, $4, 'pending')
        `, [claimId, email.toLowerCase(), walletAddress, parseFloat(amount)]);
        
        console.log(`📋 KENO claim request: ${amount} KENO to ${walletAddress} (${email})`);
        
        // Send email notification to admin
        const ADMIN_EMAIL = 'moheazy81@gmail.com';
        try {
            await EmailService.sendClaimNotification({
                email: email.toLowerCase(),
                walletAddress,
                amount: parseFloat(amount),
                claimId
            }, ADMIN_EMAIL);
        } catch (emailError) {
            console.warn('⚠️ Email notification failed (claim still recorded):', emailError.message);
        }
        
        res.json({
            success: true,
            message: `Claim request submitted! ${amount} KENO will be sent to ${walletAddress} after admin approval.`,
            claimId
        });
    } catch (error) {
        console.error('Error submitting claim:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get user's claim history
app.get('/api/claims/history/:email', async (req, res) => {
    try {
        if (!dbConnection) {
            return res.status(503).json({ success: false, error: 'Database unavailable' });
        }
        
        const email = req.params.email.toLowerCase();
        const result = await dbConnection.query(`
            SELECT claim_id as id, email, wallet_address as "walletAddress", amount, 
                   status, tx_hash as "txHash", rejection_reason as "rejectionReason",
                   requested_at as "requestedAt", processed_at as "processedAt"
            FROM keno_claims 
            WHERE LOWER(email) = $1 
            ORDER BY requested_at DESC
        `, [email]);
        
        res.json({ success: true, claims: result.rows });
    } catch (error) {
        console.error('Error fetching claim history:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Admin: View all claims
app.get('/api/admin/claims', adminAuth, async (req, res) => {
    try {
        if (!dbConnection) {
            return res.status(503).json({ success: false, error: 'Database unavailable' });
        }
        
        const result = await dbConnection.query(`
            SELECT claim_id as id, email, wallet_address as "walletAddress", amount, 
                   status, tx_hash as "txHash", rejection_reason as "rejectionReason",
                   requested_at as "requestedAt", processed_at as "processedAt"
            FROM keno_claims 
            ORDER BY requested_at DESC
        `);
        
        res.json({ success: true, claims: result.rows });
    } catch (error) {
        console.error('Error fetching claims:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Admin: Approve and process claim (sends real KENO on BSC)
app.post('/api/admin/claims/approve', adminAuth, async (req, res) => {
    try {
        const { claimId } = req.body;
        
        if (!dbConnection) {
            return res.status(503).json({ success: false, error: 'Database unavailable' });
        }
        
        const claimResult = await dbConnection.query(`
            SELECT * FROM keno_claims WHERE claim_id = $1
        `, [claimId]);
        
        if (claimResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Claim not found' });
        }
        
        const claim = claimResult.rows[0];
        
        if (claim.status !== 'pending') {
            return res.status(400).json({ 
                success: false, 
                error: `Claim already ${claim.status}` 
            });
        }
        
        // Send real KENO on BSC
        if (!bscTokenTransfer) {
            return res.status(503).json({ 
                success: false, 
                error: 'BSC token transfer service unavailable' 
            });
        }
        
        console.log(`🚀 Processing claim ${claimId}: ${claim.amount} KENO to ${claim.wallet_address}`);
        
        const transferResult = await bscTokenTransfer.transferTokens(
            claim.wallet_address,
            parseFloat(claim.amount),
            claimId
        );
        
        if (transferResult.success) {
            await dbConnection.query(`
                UPDATE keno_claims 
                SET status = 'completed', tx_hash = $1, processed_at = CURRENT_TIMESTAMP
                WHERE claim_id = $2
            `, [transferResult.txHash, claimId]);
            
            console.log(`✅ Claim ${claimId} completed! TX: ${transferResult.txHash}`);
            
            res.json({
                success: true,
                message: `Successfully sent ${claim.amount} KENO to ${claim.wallet_address}`,
                txHash: transferResult.txHash,
                bscscanUrl: `https://bscscan.com/tx/${transferResult.txHash}`
            });
        } else {
            await dbConnection.query(`
                UPDATE keno_claims 
                SET status = 'failed', rejection_reason = $1, processed_at = CURRENT_TIMESTAMP
                WHERE claim_id = $2
            `, [transferResult.error, claimId]);
            
            console.error(`❌ Claim ${claimId} failed: ${transferResult.error}`);
            
            res.status(500).json({
                success: false,
                error: transferResult.error
            });
        }
    } catch (error) {
        console.error('Error processing claim:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Admin: Reject claim
app.post('/api/admin/claims/reject', adminAuth, async (req, res) => {
    try {
        const { claimId, reason } = req.body;
        
        if (!dbConnection) {
            return res.status(503).json({ success: false, error: 'Database unavailable' });
        }
        
        const result = await dbConnection.query(`
            UPDATE keno_claims 
            SET status = 'rejected', rejection_reason = $1, processed_at = CURRENT_TIMESTAMP
            WHERE claim_id = $2
            RETURNING *
        `, [reason || 'Claim rejected by admin', claimId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Claim not found' });
        }
        
        console.log(`❌ Claim ${claimId} rejected: ${reason}`);
        
        res.json({ success: true, message: 'Claim rejected' });
    } catch (error) {
        console.error('Error rejecting claim:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== END KENO CLAIM SYSTEM ====================

// Admin endpoint to update grant status (protected)
app.post('/api/admin/grants/update', adminAuth, (req, res) => {
    const { grantId, status, note } = req.body;
    const grant = miningGrants.find(g => g.id === grantId);
    
    if (grant) {
        const oldStatus = grant.status;
        grant.status = status;
        if (note) grant.adminNote = note;
        grant.updatedAt = new Date().toISOString();
        
        // Automated reward distribution for approvals
        if (status === 'approved' && oldStatus !== 'approved') {
            console.log(`🚀 DISTRIBUTING KENO GRANT: 5250 KENO to ${grant.walletAddress}`);
            
            // In a real blockchain, this would trigger a smart contract transfer
            // For our high-fidelity simulator, we update the student's earned balance
            if (typeof students !== 'undefined') {
                const student = students.find(s => s.walletAddress === grant.walletAddress);
                if (student) {
                    student.kenoEarned = (Number(student.kenoEarned) || 0) + 5250;
                    student.approvedGrants = (student.approvedGrants || 0) + 1;
                    console.log(`✅ Updated student ${grant.walletAddress} balance with 5250 KENO bonus`);
                }
            }
            
            // Log reward in database for transparency
            if (dbConnection) {
                dbConnection.query(`
                    INSERT INTO student_rewards (user_wallet_address, reward_type, amount, description)
                    VALUES ($1, 'mining_grant_bonus', 5250, 'Mining Grant Approval Bonus')
                `, [grant.walletAddress]).catch(e => console.error('Error logging grant reward:', e));
            }
        }
        
        if (dataPersistence) {
            dataPersistence.saveMiningGrants(miningGrants);
        } else if (typeof saveGrants === 'function') {
            saveGrants();
        }
        
        console.log(`✅ Mining grant ${grantId} updated to ${status}`);
        res.json({ success: true, grant });
    } else {
        res.status(404).json({ error: 'Grant not found' });
    }
});

// Get blockchain info (with pagination support)
app.get('/api/blockchain', (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    
    const totalBlocks = kenostodChain.chain.length;
    const startIndex = Math.max(0, totalBlocks - offset - limit);
    const endIndex = totalBlocks - offset;
    
    const paginatedChain = kenostodChain.chain.slice(startIndex, endIndex).reverse();
    
    res.json({
        chain: paginatedChain,
        stats: kenostodChain.getChainStats(),
        pendingTransactions: kenostodChain.pendingTransactions,
        pagination: {
            total: totalBlocks,
            limit: limit,
            offset: offset,
            showing: paginatedChain.length
        }
    });
});

// Get balance for an address
app.get('/api/balance/:address', async (req, res) => {
    const address = req.params.address;
    const isEmail = address.includes('@');
    
    // Get simulated blockchain balance
    let blockchainBalance = 0;
    if (!isEmail) {
        blockchainBalance = kenostodChain.getBalanceOfAddress(address);
    }
    
    // Also check database for rewards (by wallet address or email)
    let databaseRewards = 0;
    try {
        if (isEmail) {
            const result = await pool.query(
                `SELECT COALESCE(SUM(reward_amount), 0) as total FROM student_rewards WHERE user_email = $1`,
                [address]
            );
            databaseRewards = parseFloat(result.rows[0]?.total || 0);
        } else {
            // Check by wallet address (try both internal format and 0x format)
            const result = await pool.query(
                `SELECT COALESCE(SUM(reward_amount), 0) as total FROM student_rewards WHERE user_wallet_address = $1`,
                [address]
            );
            databaseRewards = parseFloat(result.rows[0]?.total || 0);
        }
    } catch (dbErr) {
        console.error('DB error in balance check:', dbErr.message);
    }
    
    // Also check ICO purchases
    let icoPurchaseTokens = 0;
    const userPurchases = icoPurchases.filter(p => {
        if (isEmail) {
            return p.email && p.email.toLowerCase() === address.toLowerCase();
        }
        return p.walletAddress && p.walletAddress.toLowerCase() === address.toLowerCase();
    });
    icoPurchaseTokens = userPurchases.reduce((sum, p) => sum + (p.tokens || 0), 0);
    
    const totalBalance = blockchainBalance + databaseRewards + icoPurchaseTokens;
    
    res.json({
        address: address,
        balance: totalBalance,
        token: kenostodChain.tokenSymbol,
        breakdown: {
            blockchain: blockchainBalance,
            courseRewards: databaseRewards,
            icoPurchases: icoPurchaseTokens
        }
    });
});

// Get transactions for an address
app.get('/api/transactions/:address', (req, res) => {
    const address = req.params.address;
    const transactions = kenostodChain.getAllTransactionsForWallet(address);
    
    res.json({
        address: address,
        transactions: transactions
    });
});

// Create a new transaction (accepts pre-signed transactions)
app.post('/api/transaction', (req, res) => {
    try {
        const { fromAddress, toAddress, amount, fee = 1, signature, timestamp, message = '' } = req.body;
        
        if (!fromAddress || !toAddress || !amount || !signature) {
            return res.status(400).json({ error: 'Missing required fields: fromAddress, toAddress, amount, signature' });
        }

        // Create transaction with provided signature and message
        const transaction = new Transaction(fromAddress, toAddress, amount, fee, message);
        if (timestamp) {
            transaction.timestamp = timestamp;
        }
        transaction.signature = signature;

        // Validate the transaction (including signature)
        if (!transaction.isValid()) {
            return res.status(400).json({ error: 'Invalid transaction signature' });
        }

        // Add to blockchain
        kenostodChain.createTransaction(transaction);

        res.json({
            message: 'Transaction created successfully',
            transactionHash: transaction.calculateHash(),
            transaction: {
                fromAddress: transaction.fromAddress,
                toAddress: transaction.toAddress,
                amount: transaction.amount,
                fee: transaction.fee,
                timestamp: transaction.timestamp,
                message: transaction.message
            }
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Mine pending transactions
app.post('/api/mine', (req, res) => {
    try {
        const { minerAddress } = req.body;
        
        if (!minerAddress) {
            return res.status(400).json({ error: 'Miner address is required' });
        }

        console.log(`Mining started by ${minerAddress}...`);
        kenostodChain.minePendingTransactions(minerAddress);
        
        dataPersistence.saveBlockchain(kenostodChain);

        res.json({
            message: 'Block mined successfully!',
            balance: kenostodChain.getBalanceOfAddress(minerAddress),
            blockHeight: kenostodChain.chain.length
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// ⚠️ DEVELOPMENT ONLY - Bulk mine multiple blocks to generate initial token supply
// This endpoint is DISABLED in production to prevent tokenomics manipulation
app.post('/api/mining/bulk-mine', (req, res) => {
    if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({ 
            error: 'Bulk mining is disabled in production for security reasons',
            message: 'This endpoint could manipulate tokenomics and is only for development/testing',
            alternative: 'Use /api/mine to mine blocks individually'
        });
    }
    
    try {
        const { minerAddress, numberOfBlocks } = req.body;
        
        if (!minerAddress) {
            return res.status(400).json({ error: 'Miner address is required' });
        }
        
        if (!numberOfBlocks || numberOfBlocks < 1) {
            return res.status(400).json({ error: 'Number of blocks must be at least 1' });
        }
        
        // Safety limit to prevent crashes
        if (numberOfBlocks > 200000) {
            return res.status(400).json({ error: 'Cannot mine more than 200,000 blocks at once' });
        }
        
        console.log(`⚠️  BULK MINING: Creating ${numberOfBlocks} blocks for ${minerAddress}...`);
        const startTime = Date.now();
        const startingHeight = kenostodChain.chain.length;
        const startingBalance = kenostodChain.getBalanceOfAddress(minerAddress);
        
        // Mine blocks in batches
        for (let i = 0; i < numberOfBlocks; i++) {
            kenostodChain.minePendingTransactions(minerAddress);
            
            // Progress logging every 10,000 blocks
            if ((i + 1) % 10000 === 0) {
                console.log(`  Progress: ${i + 1}/${numberOfBlocks} blocks mined...`);
            }
        }
        
        const endTime = Date.now();
        const finalBalance = kenostodChain.getBalanceOfAddress(minerAddress);
        const tokensCreated = finalBalance - startingBalance;
        
        console.log(`✅ Bulk mining completed: ${numberOfBlocks} blocks in ${((endTime - startTime) / 1000).toFixed(2)}s`);
        console.log(`   Tokens created: ${tokensCreated} KENO`);
        
        dataPersistence.saveBlockchain(kenostodChain);
        
        res.json({
            message: `⚠️ DEVELOPMENT ONLY: ${numberOfBlocks} blocks mined successfully`,
            tokensCreated: tokensCreated,
            minerBalance: finalBalance,
            blockHeight: kenostodChain.chain.length,
            blocksAdded: kenostodChain.chain.length - startingHeight,
            timeTaken: `${((endTime - startTime) / 1000).toFixed(2)} seconds`,
            warning: 'This endpoint is disabled in production to protect tokenomics'
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Create a new wallet
app.post('/api/wallet/create', (req, res) => {
    const newWallet = new Wallet();
    
    res.json({
        address: newWallet.getAddress(),
        privateKey: newWallet.getPrivateKey(),
        warning: 'Store your private key securely! Never share it with anyone.'
    });
});

// ⚠️ DEVELOPMENT ONLY - DO NOT USE IN PRODUCTION ⚠️
// This endpoint accepts private keys from clients for convenience in testing
// It should be DISABLED in production environments
app.post('/api/transaction/simple', (req, res) => {
    // Security check: Disable in production
    if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({ 
            error: 'This endpoint is disabled in production for security reasons',
            message: 'Private keys should never be sent to a server. Use client-side signing instead.',
            alternative: 'Use /api/transaction with client-side signed transactions'
        });
    }
    
    try {
        const { fromAddress, toAddress, amount, fee = 1, privateKey, message = '' } = req.body;
        
        if (!fromAddress || !toAddress || !amount || !privateKey) {
            return res.status(400).json({ error: 'Missing required fields: fromAddress, toAddress, amount, privateKey' });
        }

        // Verify private key matches from address
        const key = ec.keyFromPrivate(privateKey, 'hex');
        const derivedAddress = key.getPublic('hex');
        
        if (derivedAddress !== fromAddress) {
            return res.status(400).json({ error: 'Private key does not match the sender address' });
        }

        // Create transaction with message and sign it
        const transaction = new Transaction(fromAddress, toAddress, amount, fee, message);
        transaction.signTransaction(key);

        // Validate the transaction
        if (!transaction.isValid()) {
            return res.status(400).json({ error: 'Invalid transaction' });
        }

        // Add to blockchain
        kenostodChain.createTransaction(transaction);

        const reversalTime = 300; // 5 minutes in seconds

        res.json({
            success: true,
            message: 'Transaction created successfully! You have 5 minutes to cancel it.',
            transactionHash: transaction.calculateHash(),
            transaction: {
                fromAddress: transaction.fromAddress,
                toAddress: transaction.toAddress,
                amount: transaction.amount,
                fee: transaction.fee,
                timestamp: transaction.timestamp,
                message: transaction.message
            },
            reversalWindow: {
                seconds: reversalTime,
                expiresAt: new Date(Date.now() + reversalTime * 1000).toISOString()
            }
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// ⚠️ DEVELOPMENT ONLY - DO NOT USE IN PRODUCTION ⚠️
// Helper endpoint to sign transactions (for development/testing only)
app.post('/api/sign', (req, res) => {
    // Security check: Disable in production
    if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({ 
            error: 'This endpoint is disabled in production for security reasons',
            message: 'Private keys should never be sent to a server. Use client-side signing instead.'
        });
    }
    
    try {
        const { fromAddress, toAddress, amount, fee = 1, privateKey } = req.body;
        
        if (!fromAddress || !toAddress || !amount || !privateKey) {
            return res.status(400).json({ error: 'Missing required fields: fromAddress, toAddress, amount, privateKey' });
        }

        // Create transaction and sign it
        const transaction = new Transaction(fromAddress, toAddress, amount, fee);
        const key = ec.keyFromPrivate(privateKey, 'hex');
        transaction.signTransaction(key);

        res.json({
            message: 'Transaction signed successfully',
            signedTransaction: {
                fromAddress: transaction.fromAddress,
                toAddress: transaction.toAddress,
                amount: transaction.amount,
                fee: transaction.fee,
                timestamp: transaction.timestamp,
                signature: transaction.signature
            },
            note: 'Submit this signed transaction to /api/transaction'
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get pending transactions for an address
app.get('/api/pending/:address', (req, res) => {
    try {
        const address = req.params.address;
        const pending = kenostodChain.getPendingTransactionsForAddress(address);
        
        res.json({
            address: address,
            pendingTransactions: pending,
            count: pending.length
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Cancel a pending transaction
app.post('/api/transaction/cancel', (req, res) => {
    try {
        const { transactionHash, senderAddress } = req.body;
        
        if (!transactionHash || !senderAddress) {
            return res.status(400).json({ error: 'Missing required fields: transactionHash, senderAddress' });
        }

        const cancelledTx = kenostodChain.cancelTransaction(transactionHash, senderAddress);
        
        res.json({
            message: 'Transaction cancelled successfully!',
            transaction: {
                hash: transactionHash,
                fromAddress: cancelledTx.fromAddress,
                toAddress: cancelledTx.toAddress,
                amount: cancelledTx.amount,
                fee: cancelledTx.fee
            }
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Create scheduled payment
app.post('/api/scheduled', (req, res) => {
    try {
        const { fromAddress, toAddress, amount, fee = 1, schedule, signature } = req.body;
        
        if (!fromAddress || !toAddress || !amount || !schedule || !signature) {
            return res.status(400).json({ error: 'Missing required fields: fromAddress, toAddress, amount, schedule, signature' });
        }

        const scheduledTx = new ScheduledTransaction(fromAddress, toAddress, amount, fee, schedule);
        scheduledTx.signature = signature;
        
        const scheduleId = kenostodChain.createScheduledTransaction(scheduledTx);
        
        res.json({
            message: 'Scheduled payment created successfully!',
            scheduleId: scheduleId,
            schedule: scheduledTx.toJSON()
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get scheduled transactions for an address
app.get('/api/scheduled/:address', (req, res) => {
    try {
        const address = req.params.address;
        const scheduled = kenostodChain.getScheduledTransactionsForAddress(address);
        
        res.json({
            address: address,
            scheduledTransactions: scheduled,
            count: scheduled.length
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Cancel scheduled payment
app.post('/api/scheduled/cancel', (req, res) => {
    try {
        const { scheduleId, senderAddress } = req.body;
        
        if (!scheduleId || !senderAddress) {
            return res.status(400).json({ error: 'Missing required fields: scheduleId, senderAddress' });
        }

        const cancelled = kenostodChain.cancelScheduledTransaction(scheduleId, senderAddress);
        
        res.json({
            message: 'Scheduled payment cancelled successfully!',
            schedule: cancelled.toJSON()
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Setup social recovery for a wallet
app.post('/api/recovery/setup', (req, res) => {
    try {
        const { walletAddress, guardians, threshold } = req.body;
        
        if (!walletAddress || !guardians || !threshold) {
            return res.status(400).json({ error: 'Missing required fields: walletAddress, guardians, threshold' });
        }

        const config = kenostodChain.socialRecovery.setupRecovery(walletAddress, guardians, threshold);
        
        res.json({
            message: 'Social recovery configured successfully!',
            config: {
                walletAddress: config.walletAddress,
                guardians: config.guardians,
                threshold: config.threshold,
                createdAt: config.createdAt
            }
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get recovery configuration for a wallet
app.get('/api/recovery/:address', (req, res) => {
    try {
        const address = req.params.address;
        const config = kenostodChain.socialRecovery.getRecoveryConfig(address);
        
        if (!config) {
            return res.json({ message: 'No recovery configuration found for this wallet' });
        }
        
        res.json({
            walletAddress: config.walletAddress,
            guardians: config.guardians,
            threshold: config.threshold,
            active: config.active,
            createdAt: config.createdAt
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Initiate wallet recovery
app.post('/api/recovery/initiate', (req, res) => {
    try {
        const { oldAddress, newAddress, initiatorAddress } = req.body;
        
        if (!oldAddress || !newAddress || !initiatorAddress) {
            return res.status(400).json({ error: 'Missing required fields: oldAddress, newAddress, initiatorAddress' });
        }

        const request = kenostodChain.socialRecovery.initiateRecovery(oldAddress, newAddress, initiatorAddress);
        
        res.json({
            message: 'Recovery request initiated! Guardians must now approve.',
            request: request.toJSON()
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Approve recovery request
app.post('/api/recovery/approve', (req, res) => {
    try {
        const { requestId, guardianAddress } = req.body;
        
        if (!requestId || !guardianAddress) {
            return res.status(400).json({ error: 'Missing required fields: requestId, guardianAddress' });
        }

        const request = kenostodChain.socialRecovery.approveRecovery(requestId, guardianAddress);
        
        res.json({
            message: 'Recovery request approved!',
            request: request.toJSON()
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Reject recovery request
app.post('/api/recovery/reject', (req, res) => {
    try {
        const { requestId, guardianAddress } = req.body;
        
        if (!requestId || !guardianAddress) {
            return res.status(400).json({ error: 'Missing required fields: requestId, guardianAddress' });
        }

        const request = kenostodChain.socialRecovery.rejectRecovery(requestId, guardianAddress);
        
        res.json({
            message: 'Recovery request rejected.',
            request: request.toJSON()
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Execute wallet recovery
app.post('/api/recovery/execute', (req, res) => {
    try {
        const { requestId } = req.body;
        
        if (!requestId) {
            return res.status(400).json({ error: 'Missing required field: requestId' });
        }

        const result = kenostodChain.executeWalletRecovery(requestId);
        
        res.json({
            message: result.message + ' Balance will be transferred upon next block mining.',
            oldAddress: result.oldAddress,
            newAddress: result.newAddress
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get recovery requests for a guardian
app.get('/api/recovery/guardian/:address', (req, res) => {
    try {
        const address = req.params.address;
        const requests = kenostodChain.socialRecovery.getRecoveryRequestsForGuardian(address);
        
        res.json({
            guardianAddress: address,
            pendingRequests: requests,
            count: requests.length
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Rate a user after a transaction
app.post('/api/reputation/rate', (req, res) => {
    try {
        const { fromAddress, toAddress, score, comment, transactionHash } = req.body;
        
        if (!fromAddress || !toAddress || !score) {
            return res.status(400).json({ error: 'Missing required fields: fromAddress, toAddress, score' });
        }

        const rating = kenostodChain.reputation.addRating(fromAddress, toAddress, score, comment, transactionHash);
        
        res.json({
            message: 'Rating submitted successfully!',
            rating: {
                id: rating.id,
                score: rating.score,
                comment: rating.comment,
                timestamp: rating.timestamp
            }
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get reputation score for an address
app.get('/api/reputation/:address', (req, res) => {
    try {
        const address = req.params.address;
        const reputation = kenostodChain.reputation.getReputationScore(address);
        const trustScore = kenostodChain.reputation.getTrustScore(address);
        
        res.json({
            address: address,
            averageScore: reputation.averageScore,
            totalRatings: reputation.totalRatings,
            breakdown: reputation.breakdown,
            trustLevel: trustScore
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get ratings for an address
app.get('/api/reputation/ratings/:address', (req, res) => {
    try {
        const address = req.params.address;
        const ratings = kenostodChain.reputation.getRatingsForAddress(address);
        
        res.json({
            address: address,
            ratings: ratings,
            count: ratings.length
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get top rated addresses
app.get('/api/reputation/top', (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const topRated = kenostodChain.reputation.getTopRatedAddresses(limit);
        
        res.json({
            topRated: topRated,
            count: topRated.length
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Create governance proposal
app.post('/api/governance/propose', (req, res) => {
    try {
        const { proposerAddress, title, description, parameterName, newValue } = req.body;
        
        if (!proposerAddress || !title || !description || !parameterName || newValue === undefined) {
            return res.status(400).json({ error: 'Missing required fields: proposerAddress, title, description, parameterName, newValue' });
        }

        const proposal = kenostodChain.createGovernanceProposal(proposerAddress, title, description, parameterName, parseFloat(newValue));
        
        res.json({
            message: 'Governance proposal created! Community can now vote.',
            proposal: proposal
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Vote on governance proposal
app.post('/api/governance/vote', (req, res) => {
    try {
        const { proposalId, voterAddress, vote } = req.body;
        
        if (!proposalId || !voterAddress || !vote) {
            return res.status(400).json({ error: 'Missing required fields: proposalId, voterAddress, vote' });
        }

        const proposal = kenostodChain.voteOnProposal(proposalId, voterAddress, vote);
        
        res.json({
            message: `Vote cast: ${vote}`,
            proposal: kenostodChain.governance.getProposal(proposalId)
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get all governance proposals
app.get('/api/governance/proposals', (req, res) => {
    try {
        const proposals = kenostodChain.governance.getAllProposals();
        res.json({ proposals });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get active governance proposals
app.get('/api/governance/proposals/active', (req, res) => {
    try {
        const proposals = kenostodChain.governance.getActiveProposals();
        res.json({ proposals });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get specific proposal
app.get('/api/governance/proposal/:id', (req, res) => {
    try {
        const proposal = kenostodChain.governance.getProposal(req.params.id);
        
        if (!proposal) {
            return res.status(404).json({ error: 'Proposal not found' });
        }

        const stats = kenostodChain.governance.getProposalStats(req.params.id);
        
        res.json({
            proposal,
            stats
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get governance statistics
app.get('/api/governance/stats', (req, res) => {
    try {
        const stats = kenostodChain.getGovernanceStats();
        res.json(stats);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get blockchain stats
app.get('/api/stats', (req, res) => {
    res.json(kenostodChain.getChainStats());
});

// Crypto price cache
let cryptoPriceCache = {
    data: null,
    lastFetch: 0,
    CACHE_DURATION: 30000
};

// Get crypto market data for ticker (with caching)
app.get('/api/crypto-prices', (req, res) => {
    const now = Date.now();
    
    if (cryptoPriceCache.data && (now - cryptoPriceCache.lastFetch) < cryptoPriceCache.CACHE_DURATION) {
        return res.json(cryptoPriceCache.data);
    }

    const options = {
        hostname: 'api.coingecko.com',
        port: 443,
        path: '/api/v3/simple/price?ids=bitcoin,ethereum,solana,cardano,ripple,polkadot,dogecoin,polygon,chainlink,litecoin&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_market_cap=true',
        method: 'GET',
        headers: {
            'User-Agent': 'Kenostod-Blockchain/1.0'
        }
    };

    const request = https.request(options, (response) => {
        let data = '';

        response.on('data', (chunk) => {
            data += chunk;
        });

        response.on('end', () => {
            try {
                const prices = JSON.parse(data);
                cryptoPriceCache.data = prices;
                cryptoPriceCache.lastFetch = now;
                res.json(prices);
            } catch (error) {
                if (cryptoPriceCache.data) {
                    res.json(cryptoPriceCache.data);
                } else {
                    res.json({});
                }
            }
        });
    });

    request.on('error', (error) => {
        console.error('Crypto price fetch error:', error);
        if (cryptoPriceCache.data) {
            res.json(cryptoPriceCache.data);
        } else {
            res.json({});
        }
    });

    request.end();
});

// Get recent transactions for ticker
app.get('/api/recent-transactions', (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const allTransactions = [];
        
        // Get transactions from recent blocks
        for (let i = Math.max(0, kenostodChain.chain.length - 5); i < kenostodChain.chain.length; i++) {
            const block = kenostodChain.chain[i];
            allTransactions.push(...block.transactions);
        }
        
        // Sort by timestamp (most recent first) and limit
        const recentTransactions = allTransactions
            .filter(tx => tx.fromAddress !== null)
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, limit)
            .map(tx => ({
                from: tx.fromAddress.substring(0, 8) + '...',
                to: tx.toAddress.substring(0, 8) + '...',
                amount: tx.amount,
                timestamp: tx.timestamp,
                message: tx.message || ''
            }));
        
        res.json(recentTransactions);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch recent transactions' });
    }
});

// Validate blockchain
app.get('/api/validate', (req, res) => {
    const isValid = kenostodChain.isChainValid();
    
    res.json({
        isValid: isValid,
        message: isValid ? 'Blockchain is valid' : 'Blockchain is corrupted!'
    });
});

// Additional API endpoints for documentation compatibility
app.get('/api/chain', (req, res) => {
    res.json(kenostodChain.chain);
});

app.get('/api/chain/latest', (req, res) => {
    res.json(kenostodChain.getLatestBlock());
});

app.get('/api/chain/height', (req, res) => {
    res.json({
        height: kenostodChain.chain.length
    });
});

app.get('/api/valid', (req, res) => {
    res.json({
        valid: kenostodChain.isChainValid()
    });
});

app.get('/api/supply', (req, res) => {
    res.json(kenostodChain.getTotalSupply());
});

app.get('/api/difficulty', (req, res) => {
    res.json({
        difficulty: kenostodChain.difficulty
    });
});

// API documentation endpoint
app.get('/api', (req, res) => {
    res.json({
        message: 'Welcome to Kenostod Blockchain API!',
        tokenName: kenostodChain.tokenName,
        tokenSymbol: kenostodChain.tokenSymbol,
        endpoints: {
            'GET /api/blockchain': 'Get full blockchain data',
            'GET /api/chain': 'Get blockchain (alias)',
            'GET /api/chain/latest': 'Get latest block',
            'GET /api/chain/height': 'Get blockchain height',
            'GET /api/valid': 'Check if blockchain is valid',
            'GET /api/supply': 'Get token supply information',
            'GET /api/difficulty': 'Get mining difficulty',
            'GET /api/balance/:address': 'Get balance for address',
            'GET /api/transactions/:address': 'Get transactions for address',
            'POST /api/transaction': 'Submit pre-signed transaction (requires signature)',
            'POST /api/transaction/simple': 'Send transaction (server-side signing)',
            'POST /api/mine': 'Mine pending transactions',
            'POST /api/wallet/create': 'Create new wallet',
            'GET /api/stats': 'Get blockchain statistics',
            'GET /api/validate': 'Validate blockchain integrity',
            'POST /api/sign': 'Helper endpoint to sign transactions (for development only)'
        },
        testWallets: {
            miner: {
                address: minerWallet.getAddress()
            },
            wallet1: {
                address: wallet1.getAddress()
            },
            wallet2: {
                address: wallet2.getAddress()
            }
        },
        security: {
            note: 'Private keys are never exposed through the API for security reasons',
            transactionFlow: 'Create transaction -> Sign locally -> Submit to /api/transaction'
        }
    });
});

// ==================== PROOF-OF-RESIDUAL-VALUE (PoRV) ENDPOINTS ====================

// Register enterprise client
app.post('/api/porv/client/register', (req, res) => {
    try {
        const { name, industry, walletAddress } = req.body;
        
        if (!name || !industry || !walletAddress) {
            return res.status(400).json({ error: 'Missing required fields: name, industry, walletAddress' });
        }

        const client = kenostodChain.enterpriseClients.registerClient(name, industry, walletAddress);
        res.json({
            message: 'Enterprise client registered successfully',
            client: client.toJSON()
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get enterprise client details
app.get('/api/porv/client/:clientId', (req, res) => {
    try {
        const client = kenostodChain.enterpriseClients.getClient(req.params.clientId);
        if (!client) {
            return res.status(404).json({ error: 'Client not found' });
        }
        res.json(client.toJSON());
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get all enterprise clients
app.get('/api/porv/clients', (req, res) => {
    res.json({
        clients: kenostodChain.enterpriseClients.getAllClients().map(c => c.toJSON()),
        stats: kenostodChain.enterpriseClients.getStats()
    });
});

// Create computational job (requires signed escrow payment transaction)
app.post('/api/porv/job/create', (req, res) => {
    try {
        const { clientId, jobType, parameters, upfrontFee, royaltyRate, escrowPaymentTx } = req.body;
        
        if (!clientId || !jobType || !upfrontFee || !royaltyRate || !escrowPaymentTx) {
            return res.status(400).json({ 
                error: 'Missing required fields: clientId, jobType, upfrontFee, royaltyRate, escrowPaymentTx (signed transaction object)' 
            });
        }

        const job = kenostodChain.createComputationalJobWithSignedPayment(
            clientId,
            jobType,
            parameters || {},
            upfrontFee,
            royaltyRate,
            escrowPaymentTx
        );

        res.json({
            message: 'Computational job created successfully (escrow payment verified)',
            job: job.toJSON()
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get available jobs for mining
app.get('/api/porv/jobs/available', (req, res) => {
    res.json({
        availableJobs: kenostodChain.getAvailableJobs()
    });
});

// Get all jobs
app.get('/api/porv/jobs', (req, res) => {
    res.json({
        jobs: kenostodChain.getAllJobs()
    });
});

// Get job details
app.get('/api/porv/job/:jobId', (req, res) => {
    try {
        const job = kenostodChain.getJobDetails(req.params.jobId);
        res.json(job);
    } catch (error) {
        res.status(404).json({ error: error.message });
    }
});

// Toggle PoRV/PoW mode
app.post('/api/porv/toggle', (req, res) => {
    try {
        kenostodChain.porvEnabled = !kenostodChain.porvEnabled;
        res.json({
            success: true,
            enabled: kenostodChain.porvEnabled,
            message: kenostodChain.porvEnabled 
                ? 'PoRV mode enabled - Mining now requires completing computational jobs for RVTs' 
                : 'PoW mode enabled - Mining uses traditional proof-of-work'
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get PoRV mode status
app.get('/api/porv/status', (req, res) => {
    res.json({
        enabled: kenostodChain.porvEnabled,
        mode: kenostodChain.porvEnabled ? 'PoRV' : 'PoW'
    });
});

// Mine PoRV block (with optional job)
app.post('/api/porv/mine', (req, res) => {
    try {
        const { minerAddress, jobId } = req.body;
        
        if (!minerAddress) {
            return res.status(400).json({ error: 'Miner address is required' });
        }

        const result = kenostodChain.minePoRVBlock(minerAddress, jobId || null);
        
        res.json({
            message: jobId ? 'PoRV block mined with computational job!' : 'Standard block mined!',
            minerBalance: kenostodChain.getBalanceOfAddress(minerAddress),
            blockHeight: kenostodChain.chain.length,
            job: result && result.job ? result.job.toJSON() : null,
            rvt: result && result.rvt ? result.rvt.toJSON() : null
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Record API usage (requires signed royalty payment transaction)
app.post('/api/porv/usage', (req, res) => {
    try {
        const { jobId, revenueGenerated, royaltyPaymentTx } = req.body;
        
        if (!jobId || revenueGenerated === undefined || !royaltyPaymentTx) {
            return res.status(400).json({ 
                error: 'Missing required fields: jobId, revenueGenerated, royaltyPaymentTx (signed transaction object)' 
            });
        }

        const result = kenostodChain.recordApiUsageWithSignedPayment(jobId, revenueGenerated, royaltyPaymentTx);
        
        res.json({
            message: 'API usage recorded and royalties distributed (payment verified)',
            ...result
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get all RVTs (must be before :address route)
app.get('/api/porv/rvts', (req, res) => {
    try {
        const rvts = Array.from(kenostodChain.residualValueTokens.values());
        res.json({
            totalRVTs: rvts.length,
            rvts: rvts.map(r => r.toJSON())
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get RVTs for an address
app.get('/api/porv/rvts/:address', (req, res) => {
    try {
        const rvts = kenostodChain.getRVTsForAddress(req.params.address);
        res.json({
            address: req.params.address,
            rvtCount: rvts.length,
            rvts: rvts.map(r => r.toJSON())
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get PoRV statistics
app.get('/api/porv/stats', (req, res) => {
    res.json(kenostodChain.getPoRVStats());
});

// Get royalty pool statistics
app.get('/api/porv/royalty-pool', (req, res) => {
    res.json(kenostodChain.royaltyPool.toJSON());
});

// Get buy-and-burn statistics
app.get('/api/porv/buy-and-burn', (req, res) => {
    res.json(kenostodChain.buyAndBurn.toJSON());
});

// Get royalty history for an RVT
app.get('/api/porv/royalty/:rvtId', (req, res) => {
    try {
        const history = kenostodChain.royaltyPool.getRoyaltyHistory(req.params.rvtId);
        res.json({
            rvtId: req.params.rvtId,
            royaltyCollections: history
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// ==================== PoRV LICENSING & PROFIT-SHARING SYSTEM ====================

// PoRV Technology License Registry
// Tracks external platforms using PoRV technology and enforces profit-sharing
const porvLicenses = [];
const PORV_CREATOR_ADDRESS = '04ec760c787ea85d7d73181dfdd5b8bc87dc94793ec929c09db6b43276ddb8900b204d9a22158d053feb56c1e2a9f08037251e3bd19e0d468e63eff1ee55e6f89e'; // Platform creator address
const CREATOR_ROYALTY_PERCENTAGE = 10; // 10% of all PoRV profits go to creator

// Register for PoRV Technology License
app.post('/api/porv/license/register', (req, res) => {
    try {
        const { platformName, companyName, contactEmail, walletAddress, agreedToTerms } = req.body;
        
        if (!platformName || !companyName || !contactEmail || !walletAddress || !agreedToTerms) {
            return res.status(400).json({ 
                error: 'Missing required fields: platformName, companyName, contactEmail, walletAddress, agreedToTerms' 
            });
        }

        if (!agreedToTerms) {
            return res.status(400).json({ 
                error: 'You must agree to PoRV licensing terms which require profit-sharing' 
            });
        }

        const licenseId = `PORV-LIC-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        
        const license = {
            licenseId,
            platformName,
            companyName,
            contactEmail,
            walletAddress,
            issuedAt: new Date().toISOString(),
            status: 'pending', // pending -> active -> suspended
            agreedToTerms: true,
            creatorRoyaltyRate: CREATOR_ROYALTY_PERCENTAGE,
            totalRevenue: 0,
            creatorRoyaltiesPaid: 0,
            usageHistory: []
        };

        porvLicenses.push(license);

        res.json({
            message: 'PoRV Technology License application submitted',
            license,
            terms: {
                creatorRoyaltyRate: `${CREATOR_ROYALTY_PERCENTAGE}%`,
                creatorAddress: PORV_CREATOR_ADDRESS,
                requirement: 'All platforms using PoRV technology must pay 10% of gross revenue to the PoRV creator',
                enforcement: 'Automatic on-chain royalty distribution required for each profitable transaction',
                violation: 'License suspension and legal action for non-compliance'
            }
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Report PoRV usage and pay creator royalties (REQUIRED for licensed platforms)
app.post('/api/porv/license/report-usage', (req, res) => {
    try {
        const { licenseId, revenueGenerated, royaltyPaymentTx } = req.body;
        
        if (!licenseId || revenueGenerated === undefined || !royaltyPaymentTx) {
            return res.status(400).json({ 
                error: 'Missing required fields: licenseId, revenueGenerated, royaltyPaymentTx (signed transaction to creator)' 
            });
        }

        const license = porvLicenses.find(l => l.licenseId === licenseId);
        
        if (!license) {
            return res.status(404).json({ error: 'License not found. Register first at /api/porv/license/register' });
        }

        if (license.status !== 'active') {
            return res.status(403).json({ 
                error: `License status: ${license.status}. Only active licenses can report usage.` 
            });
        }

        // Verify royalty payment transaction
        const creatorRoyaltyDue = revenueGenerated * (CREATOR_ROYALTY_PERCENTAGE / 100);
        
        if (royaltyPaymentTx.amount < creatorRoyaltyDue) {
            return res.status(400).json({ 
                error: `Insufficient creator royalty payment. Required: ${creatorRoyaltyDue} KENO, Provided: ${royaltyPaymentTx.amount} KENO` 
            });
        }

        if (royaltyPaymentTx.toAddress !== PORV_CREATOR_ADDRESS) {
            return res.status(400).json({ 
                error: `Invalid payment recipient. Creator royalties must go to: ${PORV_CREATOR_ADDRESS}` 
            });
        }

        // Verify and submit the transaction
        const tx = kenostodChain.createTransactionFromObject(royaltyPaymentTx);
        if (!tx.isValid()) {
            return res.status(400).json({ error: 'Invalid transaction signature for royalty payment' });
        }

        kenostodChain.addTransaction(tx);

        // Record usage
        license.totalRevenue += revenueGenerated;
        license.creatorRoyaltiesPaid += creatorRoyaltyDue;
        license.usageHistory.push({
            timestamp: new Date().toISOString(),
            revenue: revenueGenerated,
            creatorRoyalty: creatorRoyaltyDue,
            transactionHash: tx.calculateHash()
        });

        res.json({
            message: 'PoRV usage reported and creator royalties paid successfully',
            license: {
                licenseId: license.licenseId,
                platformName: license.platformName,
                totalRevenue: license.totalRevenue,
                totalCreatorRoyalties: license.creatorRoyaltiesPaid,
                complianceStatus: 'compliant'
            },
            payment: {
                creatorRoyaltyPaid: creatorRoyaltyDue,
                transactionHash: tx.calculateHash(),
                creatorAddress: PORV_CREATOR_ADDRESS
            }
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get license information
app.get('/api/porv/license/:licenseId', (req, res) => {
    const license = porvLicenses.find(l => l.licenseId === req.params.licenseId);
    
    if (!license) {
        return res.status(404).json({ error: 'License not found' });
    }

    res.json({
        license,
        compliance: {
            expectedCreatorRoyaltyRate: `${CREATOR_ROYALTY_PERCENTAGE}%`,
            totalRevenue: license.totalRevenue,
            creatorRoyaltiesPaid: license.creatorRoyaltiesPaid,
            compliancePercentage: license.totalRevenue > 0 
                ? ((license.creatorRoyaltiesPaid / license.totalRevenue) * 100).toFixed(2) + '%'
                : 'N/A'
        }
    });
});

// Get all PoRV licenses (for creator/admin)
app.get('/api/porv/licenses', (req, res) => {
    res.json({
        totalLicenses: porvLicenses.length,
        activeLicenses: porvLicenses.filter(l => l.status === 'active').length,
        totalRevenueGenerated: porvLicenses.reduce((sum, l) => sum + l.totalRevenue, 0),
        totalCreatorRoyalties: porvLicenses.reduce((sum, l) => sum + l.creatorRoyaltiesPaid, 0),
        licenses: porvLicenses.map(l => ({
            licenseId: l.licenseId,
            platformName: l.platformName,
            companyName: l.companyName,
            status: l.status,
            totalRevenue: l.totalRevenue,
            creatorRoyaltiesPaid: l.creatorRoyaltiesPaid,
            issuedAt: l.issuedAt
        }))
    });
});

// Approve pending license (for creator/admin)
app.post('/api/porv/license/:licenseId/approve', (req, res) => {
    const license = porvLicenses.find(l => l.licenseId === req.params.licenseId);
    
    if (!license) {
        return res.status(404).json({ error: 'License not found' });
    }

    if (license.status !== 'pending') {
        return res.status(400).json({ error: `License is already ${license.status}` });
    }

    license.status = 'active';
    license.approvedAt = new Date().toISOString();

    res.json({
        message: 'PoRV license approved successfully',
        license
    });
});

// Get PoRV licensing terms
app.get('/api/porv/license/terms', (req, res) => {
    res.json({
        technology: 'Proof-of-Residual-Value (PoRV) Consensus System',
        creator: 'Kenostod Blockchain Academy',
        creatorAddress: PORV_CREATOR_ADDRESS,
        licensing: {
            type: 'Commercial License with Mandatory Profit-Sharing',
            creatorRoyaltyRate: `${CREATOR_ROYALTY_PERCENTAGE}%`,
            requirement: 'All platforms implementing PoRV technology must share profits with the creator',
            payment: 'Automatic on-chain royalty payments required for each profitable use',
            enforcement: 'Smart contract enforcement + legal agreements'
        },
        terms: [
            `Pay ${CREATOR_ROYALTY_PERCENTAGE}% of all gross revenue generated using PoRV technology to creator`,
            'Report all usage via /api/porv/license/report-usage endpoint',
            'Maintain active license status through compliance',
            'Credit Kenostod Blockchain Academy as PoRV technology creator',
            'License can be suspended for non-compliance',
            'Legal action may be taken for unlicensed usage or non-payment'
        ],
        benefits: [
            'Access to revolutionary PoRV consensus algorithm',
            'RVT (Residual Value Token) system with perpetual royalties',
            'Built-in buy-and-burn deflationary mechanism',
            'Technical support and documentation',
            'Updates and improvements to PoRV technology'
        ],
        registration: 'POST /api/porv/license/register'
    });
});

// ==================== END PoRV LICENSING ====================

// ==================== END PoRV ENDPOINTS ====================

// ==================== PAYMENT GATEWAY ENDPOINTS ====================

// Register merchant
app.post('/api/merchant/register', (req, res) => {
    try {
        const { businessName, walletAddress, contactEmail, businessType } = req.body;
        const merchant = kenostodChain.merchantAccount.registerMerchant(businessName, walletAddress, contactEmail, businessType);
        res.json({ success: true, merchant });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get all merchants (specific route - must be before :merchantId)
app.get('/api/merchant/list/all', (req, res) => {
    try {
        const merchants = kenostodChain.merchantAccount.getAllMerchants();
        res.json({ merchants, count: merchants.length });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get tier benefits info (specific route - must be before :merchantId)
app.get('/api/merchant/tiers', (req, res) => {
    try {
        res.json({ tiers: merchantIncentives.tierBenefits });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get global incentive stats (specific route - must be before :merchantId)
app.get('/api/merchant/stats', (req, res) => {
    try {
        const stats = merchantIncentives.getGlobalStats();
        res.json(stats);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get available balance (specific route - must be before :merchantId)
app.get('/api/merchant/available-balance/:address', (req, res) => {
    try {
        const balance = merchantIncentives.getAvailableBalance(req.params.address);
        res.json(balance);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get merchant details
app.get('/api/merchant/:merchantId', (req, res) => {
    try {
        const merchant = kenostodChain.merchantAccount.getMerchant(req.params.merchantId);
        if (!merchant) {
            return res.status(404).json({ error: 'Merchant not found' });
        }
        res.json({ merchant });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get merchant statistics
app.get('/api/merchant/:merchantId/stats', (req, res) => {
    try {
        const stats = kenostodChain.merchantAccount.getMerchantStats(req.params.merchantId);
        res.json(stats);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Update merchant settings
app.put('/api/merchant/:merchantId/settings', (req, res) => {
    try {
        const merchant = kenostodChain.merchantAccount.updateMerchantSettings(req.params.merchantId, req.body);
        res.json({ success: true, merchant });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Create payment request
app.post('/api/payment/request', (req, res) => {
    try {
        const paymentRequest = kenostodChain.paymentGateway.createPaymentRequest(req.body.merchantId, req.body);
        res.json({ success: true, paymentRequest });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get payment request
app.get('/api/payment/request/:paymentRequestId', (req, res) => {
    try {
        const paymentRequest = kenostodChain.paymentGateway.getPaymentRequest(req.params.paymentRequestId);
        if (!paymentRequest) {
            return res.status(404).json({ error: 'Payment request not found' });
        }
        res.json({ paymentRequest });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Process payment
app.post('/api/payment/process', (req, res) => {
    try {
        const { paymentRequestId, signedTransaction } = req.body;
        
        const transaction = new Transaction(
            signedTransaction.fromAddress,
            signedTransaction.toAddress,
            signedTransaction.amount,
            signedTransaction.fee,
            signedTransaction.message,
            signedTransaction.signature
        );
        transaction.timestamp = signedTransaction.timestamp;
        
        if (!transaction.isValid()) {
            return res.status(400).json({ error: 'Invalid transaction signature' });
        }
        
        kenostodChain.createTransaction(transaction);
        
        const result = kenostodChain.paymentGateway.processPayment(paymentRequestId, transaction);
        
        res.json({ success: true, ...result });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Create invoice
app.post('/api/payment/invoice', (req, res) => {
    try {
        const { merchantId, ...invoiceDetails } = req.body;
        const invoice = kenostodChain.paymentGateway.createInvoice(merchantId, invoiceDetails);
        res.json({ success: true, invoice });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get invoice
app.get('/api/payment/invoice/:invoiceId', (req, res) => {
    try {
        const invoice = kenostodChain.paymentGateway.getInvoice(req.params.invoiceId);
        if (!invoice) {
            return res.status(404).json({ error: 'Invoice not found' });
        }
        res.json({ invoice });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Pay invoice
app.post('/api/payment/invoice/:invoiceId/pay', (req, res) => {
    try {
        const result = kenostodChain.paymentGateway.payInvoice(req.params.invoiceId);
        res.json({ success: true, ...result });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get conversion rate
app.get('/api/payment/conversion-rate', (req, res) => {
    try {
        const rate = kenostodChain.merchantAccount.conversionRate;
        res.json({ kenoToUSD: rate, usdToKENO: 1 / rate });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// ==================== END PAYMENT GATEWAY ENDPOINTS ====================

// ==================== EXCHANGE API ENDPOINTS ====================

// Get trading pairs
app.get('/api/exchange/pairs', (req, res) => {
    try {
        const pairs = kenostodChain.exchangeAPI.getTradingPairs();
        res.json({ pairs });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get market data
app.get('/api/exchange/market/:pair?', (req, res) => {
    try {
        const pair = req.params.pair || 'KENO_USD';
        const marketData = kenostodChain.exchangeAPI.getMarketData(pair);
        if (!marketData) {
            return res.status(404).json({ error: 'Trading pair not found' });
        }
        res.json({ pair, ...marketData });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get all market data
app.get('/api/exchange/markets/all', (req, res) => {
    try {
        const marketData = kenostodChain.exchangeAPI.getAllMarketData();
        res.json({ markets: marketData });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get order book
app.get('/api/exchange/orderbook/:pair?', (req, res) => {
    try {
        const pair = req.params.pair || 'KENO_USD';
        const depth = parseInt(req.query.depth) || 20;
        const orderBook = kenostodChain.exchangeAPI.getOrderBook(pair, depth);
        res.json(orderBook);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Create order
app.post('/api/exchange/order', (req, res) => {
    try {
        const order = kenostodChain.exchangeAPI.createOrder(req.body);
        res.json({ success: true, order });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Cancel order
app.delete('/api/exchange/order/:orderId', (req, res) => {
    try {
        const { userAddress } = req.body;
        const order = kenostodChain.exchangeAPI.cancelOrder(req.params.orderId, userAddress);
        res.json({ success: true, order });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get user orders
app.get('/api/exchange/orders/:userAddress', (req, res) => {
    try {
        const status = req.query.status || null;
        const orders = kenostodChain.exchangeAPI.getUserOrders(req.params.userAddress, status);
        res.json({ orders, count: orders.length });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get recent trades
app.get('/api/exchange/trades/:pair?', (req, res) => {
    try {
        const pair = req.params.pair || 'KENO_USD';
        const limit = parseInt(req.query.limit) || 50;
        const trades = kenostodChain.exchangeAPI.getRecentTrades(pair, limit);
        res.json({ pair, trades, count: trades.length });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get user trades
app.get('/api/exchange/trades/user/:userAddress', (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const trades = kenostodChain.exchangeAPI.getUserTrades(req.params.userAddress, limit);
        res.json({ trades, count: trades.length });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get ticker data
app.get('/api/exchange/ticker/:pair?', (req, res) => {
    try {
        const pair = req.params.pair || 'KENO_USD';
        const ticker = kenostodChain.exchangeAPI.getTickerData(pair);
        res.json(ticker);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Create deposit address
app.post('/api/exchange/deposit/address', (req, res) => {
    try {
        const { userAddress } = req.body;
        const depositAddress = kenostodChain.exchangeAPI.createDepositAddress(userAddress);
        res.json({ success: true, depositAddress });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Process withdrawal
app.post('/api/exchange/withdrawal', (req, res) => {
    try {
        const withdrawal = kenostodChain.exchangeAPI.processWithdrawal(req.body);
        res.json({ success: true, withdrawal });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// ==================== END EXCHANGE API ENDPOINTS ====================

// ==================== BANKING API ENDPOINTS ====================

// Register banking account
app.post('/api/banking/register', (req, res) => {
    try {
        const { walletAddress, email, fullName } = req.body;
        const result = bankingAPI.registerAccount(walletAddress, email, fullName);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Add bank account
app.post('/api/banking/bank-account', (req, res) => {
    try {
        const { walletAddress, bankDetails } = req.body;
        const result = bankingAPI.addBankAccount(walletAddress, bankDetails);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Add PayPal account
app.post('/api/banking/paypal-account', (req, res) => {
    try {
        const { walletAddress, paypalEmail } = req.body;
        const result = bankingAPI.addPayPalAccount(walletAddress, paypalEmail);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Create deposit (Stripe)
app.post('/api/banking/deposit/stripe', async (req, res) => {
    try {
        const { walletAddress, amount } = req.body;
        
        const depositResult = bankingAPI.createDeposit(walletAddress, amount, 'stripe');
        if (!depositResult.success) {
            return res.status(400).json(depositResult);
        }
        
        const paymentIntent = await stripeIntegration.createPaymentIntent(
            amount,
            'usd',
            { depositId: depositResult.deposit.depositId, walletAddress }
        );
        
        res.json({
            success: true,
            deposit: depositResult.deposit,
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Create deposit (PayPal)
app.post('/api/banking/deposit/paypal', async (req, res) => {
    try {
        const { walletAddress, amount } = req.body;
        
        const depositResult = bankingAPI.createDeposit(walletAddress, amount, 'paypal');
        if (!depositResult.success) {
            return res.status(400).json(depositResult);
        }
        
        const order = await paypalIntegration.createOrder(
            amount,
            'USD',
            { depositId: depositResult.deposit.depositId, walletAddress }
        );
        
        res.json({
            success: true,
            deposit: depositResult.deposit,
            orderId: order.id,
            approveUrl: order.approveUrl
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Confirm Stripe deposit
app.post('/api/banking/deposit/stripe/confirm', async (req, res) => {
    try {
        const { depositId, paymentIntentId } = req.body;
        
        const paymentIntent = await stripeIntegration.confirmPaymentIntent(paymentIntentId);
        
        if (paymentIntent.status === 'succeeded' || paymentIntent.testMode) {
            const result = bankingAPI.confirmDeposit(depositId, paymentIntentId);
            dataPersistence.saveFiatBalances(bankingAPI.fiatBalances);
            res.json(result);
        } else {
            res.status(400).json({ 
                success: false, 
                error: `Payment status: ${paymentIntent.status}` 
            });
        }
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Confirm PayPal deposit
app.post('/api/banking/deposit/paypal/confirm', async (req, res) => {
    try {
        const { depositId, orderId } = req.body;
        
        const captureResult = await paypalIntegration.captureOrder(orderId);
        
        if (captureResult.status === 'COMPLETED' || captureResult.testMode) {
            const result = bankingAPI.confirmDeposit(depositId, orderId);
            dataPersistence.saveFiatBalances(bankingAPI.fiatBalances);
            res.json(result);
        } else {
            res.status(400).json({ 
                success: false, 
                error: `PayPal order status: ${captureResult.status}` 
            });
        }
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Create withdrawal (Stripe)
app.post('/api/banking/withdrawal/stripe', async (req, res) => {
    try {
        const { walletAddress, amount } = req.body;
        
        // Create withdrawal (destination not needed - goes to Stripe-connected bank account)
        const withdrawalResult = bankingAPI.createWithdrawal(
            walletAddress, 
            amount, 
            'stripe', 
            null
        );
        
        if (!withdrawalResult.success) {
            return res.status(400).json(withdrawalResult);
        }
        
        // Create payout to Stripe-connected bank account
        const payout = await stripeIntegration.createPayout(
            amount,
            null,
            'usd',
            { withdrawalId: withdrawalResult.withdrawal.withdrawalId }
        );
        
        const completeResult = bankingAPI.completeWithdrawal(
            withdrawalResult.withdrawal.withdrawalId,
            payout.id
        );
        
        dataPersistence.saveFiatBalances(bankingAPI.fiatBalances);
        
        res.json({
            success: true,
            withdrawal: completeResult.withdrawal,
            payoutId: payout.id
        });
    } catch (error) {
        const { walletAddress, amount } = req.body;
        const withdrawal = Array.from(bankingAPI.withdrawals.values())
            .find(w => w.walletAddress === walletAddress && w.status === 'pending');
        
        if (withdrawal) {
            bankingAPI.cancelWithdrawal(withdrawal.withdrawalId);
        }
        
        res.status(400).json({ error: error.message });
    }
});

// Create withdrawal (PayPal)
app.post('/api/banking/withdrawal/paypal', async (req, res) => {
    try {
        const { walletAddress, amount, paypalEmail } = req.body;
        
        const withdrawalResult = bankingAPI.createWithdrawal(
            walletAddress, 
            amount, 
            'paypal', 
            { paypalEmail }
        );
        
        if (!withdrawalResult.success) {
            return res.status(400).json(withdrawalResult);
        }
        
        const payout = await paypalIntegration.createPayout(
            paypalEmail,
            amount,
            'USD',
            { 
                withdrawalId: withdrawalResult.withdrawal.withdrawalId,
                note: 'Kenostod withdrawal'
            }
        );
        
        const completeResult = bankingAPI.completeWithdrawal(
            withdrawalResult.withdrawal.withdrawalId,
            payout.batch_id
        );
        
        dataPersistence.saveFiatBalances(bankingAPI.fiatBalances);
        
        res.json({
            success: true,
            withdrawal: completeResult.withdrawal,
            batchId: payout.batch_id
        });
    } catch (error) {
        const { walletAddress, amount } = req.body;
        const withdrawal = Array.from(bankingAPI.withdrawals.values())
            .find(w => w.walletAddress === walletAddress && w.status === 'pending');
        
        if (withdrawal) {
            bankingAPI.cancelWithdrawal(withdrawal.withdrawalId);
        }
        
        res.status(400).json({ error: error.message });
    }
});

// Get fiat balance
app.get('/api/banking/balance/:walletAddress', (req, res) => {
    try {
        const balance = bankingAPI.getFiatBalance(req.params.walletAddress);
        console.log(`💰 Balance check for ${req.params.walletAddress.substring(0, 10)}...: $${balance.toFixed(2)}`);
        res.json({ walletAddress: req.params.walletAddress, balance });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.get('/api/banking/debug/all-balances', (req, res) => {
    try {
        const allBalances = [];
        for (const [address, balance] of bankingAPI.fiatBalances.entries()) {
            allBalances.push({
                address: address.substring(0, 20) + '...',
                balance: balance
            });
        }
        res.json({ count: allBalances.length, balances: allBalances });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get account details
app.get('/api/banking/account/:walletAddress', (req, res) => {
    try {
        const account = bankingAPI.getAccount(req.params.walletAddress);
        if (!account) {
            return res.status(404).json({ error: 'Account not found' });
        }
        res.json(account);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get deposits
app.get('/api/banking/deposits/:walletAddress', (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const deposits = bankingAPI.getDeposits(req.params.walletAddress, limit);
        res.json({ deposits, count: deposits.length });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get withdrawals
app.get('/api/banking/withdrawals/:walletAddress', (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const withdrawals = bankingAPI.getWithdrawals(req.params.walletAddress, limit);
        res.json({ withdrawals, count: withdrawals.length });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get all transactions
app.get('/api/banking/transactions/:walletAddress', (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        const transactions = bankingAPI.getTransactions(req.params.walletAddress, limit);
        res.json({ transactions, count: transactions.length });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get banking stats
app.get('/api/banking/stats', (req, res) => {
    try {
        const stats = bankingAPI.getStats();
        res.json(stats);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Cancel withdrawal
app.post('/api/banking/withdrawal/cancel', (req, res) => {
    try {
        const { withdrawalId } = req.body;
        const result = bankingAPI.cancelWithdrawal(withdrawalId);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// ==================== END BANKING API ENDPOINTS ====================

// ==================== STRIPE SUBSCRIPTION API ENDPOINTS ====================

app.post('/api/stripe/create-checkout-session', async (req, res) => {
    try {
        const { priceId, plan, customerEmail } = req.body;
        
        if (!priceId) {
            return res.status(400).json({ error: 'priceId is required' });
        }

        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        const host = req.headers['x-forwarded-host'] || req.get('host');
        const baseUrl = `${protocol}://${host}`;
        
        const successUrl = `${baseUrl}/?subscription=success&plan=${plan || 'unknown'}`;
        const cancelUrl = `${baseUrl}/?subscription=cancelled`;

        // Create or get customer
        let customer;
        if (customerEmail) {
            try {
                customer = await stripeService.createCustomer(customerEmail, `user-${Date.now()}`);
            } catch (err) {
                console.error('Customer creation error:', err);
                customer = { id: null };
            }
        }

        // Create checkout session
        const session = await stripeService.createCheckoutSession(
            customer?.id,
            priceId,
            successUrl,
            cancelUrl
        );

        res.json({ 
            url: session.url,
            sessionId: session.id,
            testMode: process.env.STRIPE_MODE === 'test'
        });
    } catch (error) {
        console.error('Checkout session error:', error);
        res.status(400).json({ error: error.message });
    }
});

app.post('/api/stripe/create-portal-session', async (req, res) => {
    try {
        const { customerId } = req.body;
        
        if (!customerId) {
            return res.status(400).json({ error: 'customerId is required' });
        }

        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        const host = req.headers['x-forwarded-host'] || req.get('host');
        const returnUrl = `${protocol}://${host}/`;

        const session = await stripeService.createCustomerPortalSession(customerId, returnUrl);

        res.json({ 
            url: session.url,
            testMode: process.env.STRIPE_MODE === 'test'
        });
    } catch (error) {
        console.error('Portal session error:', error);
        res.status(400).json({ error: error.message });
    }
});

// Initialize or get subscription products and prices
app.post('/api/stripe/init-subscriptions', async (req, res) => {
    try {
        const products = await stripeService.ensureSubscriptionProducts();
        res.json({ 
            success: true, 
            products,
            message: 'Subscription products initialized'
        });
    } catch (error) {
        console.error('Subscription init error:', error);
        res.status(400).json({ error: error.message });
    }
});

// Get current subscription price IDs - use hardcoded prices to avoid creating duplicate Stripe plans
app.get('/api/stripe/get-price-ids', (req, res) => {
    res.json({
        student: process.env.STRIPE_STUDENT_PRICE_ID || 'price_1SX1x1BMJMAmd04Cp1Aeq6TM',
        professional: process.env.STRIPE_PROFESSIONAL_PRICE_ID || 'price_1SX1x1BMJMAmd04CG9J97tmG'
    });
});

app.get('/api/stripe/subscription-prices', async (req, res) => {
    try {
        const prices = await stripeService.listPrices();
        // Filter for active subscription prices
        const subscriptionPrices = prices.filter(p => p.type === 'recurring' && p.status === 'active');
        res.json(subscriptionPrices);
    } catch (error) {
        console.error('List prices error:', error);
        res.status(400).json({ error: error.message });
    }
});

app.get('/api/stripe/products', async (req, res) => {
    try {
        const prices = await stripeService.listPrices();
        res.json(prices);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.get('/api/stripe/prices/:productId?', async (req, res) => {
    try {
        const prices = await stripeService.listPrices();
        res.json(prices);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.get('/api/stripe/subscription/:subscriptionId', async (req, res) => {
    try {
        const subscription = await stripeIntegration.retrieveSubscription(req.params.subscriptionId);
        res.json(subscription);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.post('/api/stripe/subscription/:subscriptionId/cancel', async (req, res) => {
    try {
        const subscription = await stripeIntegration.cancelSubscription(req.params.subscriptionId);
        res.json(subscription);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// ==================== END STRIPE SUBSCRIPTION API ENDPOINTS ====================

// ==================== PAYPAL API ENDPOINTS ====================

app.get('/api/paypal/config', (req, res) => {
    res.json({
        clientId: process.env.PAYPAL_CLIENT_ID || 'test',
        testMode: paypalIntegration.isTestMode()
    });
});

app.post('/api/paypal/create-order', async (req, res) => {
    try {
        const { amount, walletAddress } = req.body;
        
        // Check if PayPal is configured
        if (paypalIntegration.isTestMode()) {
            return res.status(503).json({
                success: false,
                error: 'PayPal is not configured. Please contact support.'
            });
        }
        
        // Validate amount is a number
        if (!amount || typeof amount !== 'number' || amount <= 0) {
            return res.status(400).json({ 
                success: false,
                error: 'Valid numeric amount is required' 
            });
        }
        
        // Validate wallet address
        if (!walletAddress || typeof walletAddress !== 'string') {
            return res.status(400).json({ 
                success: false,
                error: 'Wallet address is required' 
            });
        }
        
        // Accept BSC/MetaMask addresses (0x prefix, 42 chars) OR Kenostod simulator addresses (04 prefix, 130 chars)
        const isBscAddress = walletAddress.startsWith('0x') && walletAddress.length === 42 && /^0x[a-fA-F0-9]{40}$/.test(walletAddress);
        const isKenostodAddress = walletAddress.startsWith('04') && walletAddress.length === 130 && /^04[a-fA-F0-9]{128}$/.test(walletAddress);
        
        if (!isBscAddress && !isKenostodAddress) {
            return res.status(400).json({ 
                success: false,
                error: 'Invalid wallet address format. Use MetaMask/BSC address (0x...) or Kenostod simulator address (04...)' 
            });
        }
        
        // Enforce ICO pricing tiers
        const validTiers = [50, 100, 250, 500, 1000];
        if (!validTiers.includes(amount)) {
            return res.status(400).json({ 
                success: false,
                error: `Invalid amount. Please select one of: ${validTiers.map(t => '$' + t).join(', ')}` 
            });
        }
        
        const order = await paypalIntegration.createOrder(amount, 'USD', {
            depositId: `ICO-${Date.now()}`
        });
        
        // Store wallet address with order ID for later use
        pendingPayPalOrders.set(order.id, {
            walletAddress,
            amount,
            timestamp: Date.now()
        });
        
        res.json({
            success: true,
            orderId: order.id,
            status: order.status,
            approveUrl: order.approveUrl
        });
    } catch (error) {
        console.error('PayPal create-order error:', {
            endpoint: '/api/paypal/create-order',
            statusCode: error.statusCode,
            name: error.name,
            message: error.message
        });
        
        // Determine appropriate status code
        const statusCode = error.statusCode || 502;
        
        res.status(statusCode).json({ 
            success: false,
            error: error.message || 'Failed to create PayPal order. Please try again.'
        });
    }
});

app.post('/api/paypal/capture-order/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;
        
        // Check if PayPal is configured
        if (paypalIntegration.isTestMode()) {
            return res.status(503).json({
                success: false,
                error: 'PayPal is not configured. Please contact support.'
            });
        }
        
        if (!orderId) {
            return res.status(400).json({ 
                success: false,
                error: 'Order ID is required' 
            });
        }
        
        // Get pending order data (wallet address)
        const pendingOrder = pendingPayPalOrders.get(orderId);
        if (!pendingOrder) {
            return res.status(400).json({
                success: false,
                error: 'Order not found or expired. Please try again.'
            });
        }
        
        const capture = await paypalIntegration.captureOrder(orderId);
        
        // Calculate tokens
        const purchaseAmount = parseFloat(capture.amount.value);
        const tokens = purchaseAmount * 100; // $1 = 100 KENO base (at $0.01 per token)
        const bonusTokens = tokens * 0.20; // 20% bonus
        const totalTokens = tokens + bonusTokens;
        
        // Send REAL KENO tokens on BSC to buyer's wallet
        let tokensSent = false;
        let txHash = null;
        try {
            console.log(`📤 Attempting to send ${totalTokens} KENO to ${pendingOrder.walletAddress}...`);
            
            const transferResult = await bscTokenTransfer.transferTokens(
                pendingOrder.walletAddress,
                totalTokens,
                orderId
            );
            
            if (transferResult.success) {
                tokensSent = true;
                txHash = transferResult.txHash;
                console.log(`✅ Real BSC transfer successful! TX: ${txHash}`);
            } else {
                console.error(`❌ BSC transfer failed: ${transferResult.error}`);
                console.log(`   Tokens will be recorded for manual delivery`);
            }
        } catch (txError) {
            console.error(`❌ Error sending tokens: ${txError.message}`);
            txHash = null;
        }
        
        // Log the ICO purchase with wallet address
        logICOPurchase({
            orderId: capture.id,
            amount: purchaseAmount,
            tokens: totalTokens,
            walletAddress: pendingOrder.walletAddress,
            txHash: txHash,
            tokensSent: tokensSent,
            timestamp: new Date().toISOString()
        });
        
        // Also save to database for Investor Dashboard
        try {
            const investorId = `INV-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Date.now().toString().slice(-4)}`;
            await dbConnection.query(
                `INSERT INTO ico_investors (
                    investor_id, wallet_address, email, investment_amount_usd, tokens_purchased,
                    bonus_tokens, sale_phase, payment_method, transaction_hash, investment_status,
                    token_price_usd, bonus_percentage
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
                [
                    investorId,
                    pendingOrder.walletAddress,
                    pendingOrder.email || 'paypal@purchase.com',
                    purchaseAmount,
                    tokens,
                    bonusTokens,
                    'private',
                    'paypal',
                    txHash || capture.id,
                    'completed',
                    0.01,
                    20
                ]
            );
            console.log(`📊 ICO purchase saved to database for investor dashboard (${investorId})`);
        } catch (dbError) {
            console.error(`⚠️ Database insert error (purchase still valid):`, dbError.message);
        }
        
        // Clean up pending order
        pendingPayPalOrders.delete(orderId);
        
        res.json({
            success: true,
            orderId: capture.id,
            status: capture.status,
            amount: capture.amount,
            tokens: totalTokens,
            tokensSent: tokensSent,
            txHash: txHash
        });
    } catch (error) {
        console.error('PayPal capture-order error:', {
            endpoint: '/api/paypal/capture-order',
            orderId: req.params.orderId,
            statusCode: error.statusCode,
            name: error.name,
            message: error.message
        });
        
        // Determine appropriate status code
        const statusCode = error.statusCode || 502;
        
        res.status(statusCode).json({ 
            success: false,
            error: error.message || 'Failed to capture PayPal payment. Please try again.'
        });
    }
});

// Get ICO purchases (admin dashboard)
app.get('/api/ico/purchases', (req, res) => {
    res.json({
        success: true,
        purchases: icoPurchases,
        total: icoPurchases.length
    });
});

// ==================== BSC TOKEN TRANSFER ENDPOINTS ====================

// Get BSC transfer service status
app.get('/api/bsc/status', async (req, res) => {
    try {
        const status = bscTokenTransfer.getStatus();
        const balance = await bscTokenTransfer.getDistributionWalletBalance();
        
        res.json({
            success: true,
            ...status,
            balance
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get pending token transfers
app.get('/api/bsc/pending-transfers', (req, res) => {
    const pendingTransfers = icoPurchases.filter(p => !p.tokensSent);
    const completedTransfers = icoPurchases.filter(p => p.tokensSent);
    
    res.json({
        success: true,
        pending: pendingTransfers,
        completed: completedTransfers,
        summary: {
            pendingCount: pendingTransfers.length,
            pendingTokens: pendingTransfers.reduce((sum, p) => sum + (p.tokens || 0), 0),
            completedCount: completedTransfers.length,
            completedTokens: completedTransfers.reduce((sum, p) => sum + (p.tokens || 0), 0)
        }
    });
});

// Admin authentication middleware for BSC endpoints
function requireBscAdmin(req, res, next) {
    const adminKey = req.headers['x-admin-key'] || req.body.adminKey;
    const validAdminKey = process.env.KENO_DISTRIBUTION_WALLET_KEY; // Uses same secret as wallet
    
    if (!adminKey || adminKey !== validAdminKey) {
        return res.status(403).json({
            success: false,
            error: 'Unauthorized. Admin authentication required.'
        });
    }
    next();
}

// Sweep all pending token transfers (admin endpoint - PROTECTED)
app.post('/api/bsc/sweep', requireBscAdmin, async (req, res) => {
    try {
        const pendingTransfers = icoPurchases.filter(p => !p.tokensSent);
        
        if (pendingTransfers.length === 0) {
            return res.json({
                success: true,
                message: 'No pending transfers to process',
                results: []
            });
        }
        
        console.log(`\n🔄 Starting sweep of ${pendingTransfers.length} pending transfers...`);
        
        const sweepResult = await bscTokenTransfer.sweepPendingTransfers(pendingTransfers);
        
        // Update icoPurchases with successful transfers
        for (const result of sweepResult.results) {
            if (result.success) {
                const purchaseIndex = icoPurchases.findIndex(p => p.orderId === result.orderId);
                if (purchaseIndex !== -1) {
                    icoPurchases[purchaseIndex].tokensSent = true;
                    icoPurchases[purchaseIndex].txHash = result.txHash;
                    icoPurchases[purchaseIndex].txBlockNumber = result.blockNumber;
                    icoPurchases[purchaseIndex].deliveredAt = new Date().toISOString();
                }
            }
        }
        
        // Save updated purchases
        dataPersistence.saveICOPurchases(icoPurchases);
        
        // Update database records
        for (const result of sweepResult.results) {
            if (result.success && dbConnection) {
                try {
                    await dbConnection.query(
                        `UPDATE ico_investors 
                         SET transaction_hash = $1, investment_status = 'delivered'
                         WHERE wallet_address = $2`,
                        [result.txHash, result.walletAddress]
                    );
                } catch (dbError) {
                    console.error(`⚠️ Database update failed for ${result.orderId}:`, dbError.message);
                }
            }
        }
        
        console.log(`\n✅ Sweep completed: ${sweepResult.successCount} successful, ${sweepResult.failCount} failed`);
        
        res.json({
            success: true,
            ...sweepResult
        });
    } catch (error) {
        console.error('Sweep error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Send tokens to a specific address (admin endpoint - PROTECTED)
app.post('/api/bsc/send', requireBscAdmin, async (req, res) => {
    try {
        const { toAddress, amount, orderId } = req.body;
        
        if (!toAddress || !amount) {
            return res.status(400).json({
                success: false,
                error: 'toAddress and amount are required'
            });
        }
        
        const result = await bscTokenTransfer.transferTokens(toAddress, amount, orderId);
        
        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ==================== ICO INVESTMENT TRACKER & ANALYTICS ====================

// Get user's ICO purchases and analytics
app.get('/api/ico/my-investments/:walletAddress', (req, res) => {
    try {
        const { walletAddress } = req.params;
        
        const userPurchases = icoPurchases.filter(p => 
            p.walletAddress && p.walletAddress.toLowerCase() === walletAddress.toLowerCase()
        );
        
        if (userPurchases.length === 0) {
            return res.json({
                success: true,
                purchases: [],
                analytics: {
                    totalInvested: 0,
                    totalTokens: 0,
                    currentValue: 0,
                    profit: 0,
                    roi: 0
                }
            });
        }
        
        const totalInvested = userPurchases.reduce((sum, p) => sum + (p.amount || 0), 0);
        const totalTokens = userPurchases.reduce((sum, p) => sum + (p.tokens || 0), 0);
        
        const now = new Date();
        const publicSaleStart = new Date('2025-12-29T00:00:00Z');
        const dexListingDate = new Date('2025-12-29T00:00:00Z');
        
        // Price phases: Private ($0.01) -> Public ($0.05) -> DEX Listed ($1.00)
        let currentPrice = 0.01;
        let pricePhase = 'Private Sale';
        
        if (now >= dexListingDate) {
            currentPrice = 1.00;  // DEX listing price
            pricePhase = 'DEX Listed';
        } else if (now >= publicSaleStart) {
            currentPrice = 0.05;
            pricePhase = 'Public Sale';
        }
        
        const currentValue = totalTokens * currentPrice;
        const profit = currentValue - totalInvested;
        const roi = totalInvested > 0 ? ((profit / totalInvested) * 100) : 0;
        
        res.json({
            success: true,
            purchases: userPurchases,
            analytics: {
                totalInvested: parseFloat(totalInvested.toFixed(2)),
                totalTokens: parseFloat(totalTokens.toFixed(2)),
                currentPrice: currentPrice,
                currentValue: parseFloat(currentValue.toFixed(2)),
                profit: parseFloat(profit.toFixed(2)),
                roi: parseFloat(roi.toFixed(2)),
                pricePhase: pricePhase,
                nextPriceChange: now >= dexListingDate ? null : dexListingDate.toISOString()
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get smart sell recommendations
app.get('/api/ico/sell-recommendations/:walletAddress', (req, res) => {
    try {
        const { walletAddress } = req.params;
        
        const userPurchases = icoPurchases.filter(p => 
            p.walletAddress && p.walletAddress.toLowerCase() === walletAddress.toLowerCase()
        );
        
        const totalTokens = userPurchases.reduce((sum, p) => sum + (p.tokens || 0), 0);
        
        if (totalTokens === 0) {
            return res.json({
                success: false,
                error: 'No KENO tokens found for this wallet'
            });
        }
        
        const orderBook = kenostodChain.exchangeAPI.getOrderBook('KENO_USD', 10);
        const marketData = kenostodChain.exchangeAPI.getMarketData('KENO_USD');
        
        const bestBidPrice = orderBook.bids.length > 0 ? orderBook.bids[0].price : 0.50;
        const bestBidQuantity = orderBook.bids.length > 0 ? orderBook.bids[0].quantity : 0;
        
        const tradingFee = 0.005;
        const grossRevenue = totalTokens * bestBidPrice;
        const tradingFeeAmount = grossRevenue * tradingFee;
        const netRevenue = grossRevenue - tradingFeeAmount;
        
        const stripeFee = (netRevenue * 0.029) + 0.30;
        const paypalFee = (netRevenue * 0.0349) + 0.49;
        
        const netAfterStripe = netRevenue - stripeFee;
        const netAfterPayPal = netRevenue - paypalFee;
        
        res.json({
            success: true,
            tokens: totalTokens,
            recommendations: {
                bestBidPrice: bestBidPrice,
                bestBidQuantity: bestBidQuantity,
                marketPrice: marketData?.lastPrice || 0.50,
                canSellImmediately: bestBidQuantity >= totalTokens,
                grossRevenue: parseFloat(grossRevenue.toFixed(2)),
                tradingFee: parseFloat(tradingFeeAmount.toFixed(2)),
                netRevenue: parseFloat(netRevenue.toFixed(2)),
                bankWithdrawal: {
                    stripe: {
                        fee: parseFloat(stripeFee.toFixed(2)),
                        netAmount: parseFloat(netAfterStripe.toFixed(2))
                    },
                    paypal: {
                        fee: parseFloat(paypalFee.toFixed(2)),
                        netAmount: parseFloat(netAfterPayPal.toFixed(2))
                    }
                },
                optimalStrategy: bestBidQuantity >= totalTokens ? 'Sell all tokens now at market price' : 'Place limit order and wait for buyers'
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// One-click cash-out: Sell KENO + Withdraw to Bank
// Simplified version - uses wallet address verification only (no private key needed)
app.post('/api/ico/one-click-cashout', async (req, res) => {
    try {
        const { walletAddress, withdrawalMethod, withdrawalDestination, signature, timestamp, message } = req.body;
        
        if (!walletAddress) {
            return res.status(400).json({ success: false, error: 'Wallet address required' });
        }
        
        // Get user's course reward balance from database (check by wallet OR email)
        let totalRewards = 0;
        const emailInput = withdrawalDestination || '';
        const isEmailInput = walletAddress.includes('@');
        const lookupEmail = isEmailInput ? walletAddress : emailInput;
        const lookupWallet = isEmailInput ? '' : walletAddress;
        
        try {
            // Check by wallet address first
            if (lookupWallet) {
                const result = await pool.query(
                    `SELECT COALESCE(SUM(reward_amount), 0) as total FROM student_rewards 
                     WHERE user_wallet_address = $1`,
                    [lookupWallet]
                );
                totalRewards = parseFloat(result.rows[0]?.total || 0);
            }
            
            // Also check by email if provided
            if (lookupEmail && totalRewards === 0) {
                const result = await pool.query(
                    `SELECT COALESCE(SUM(reward_amount), 0) as total FROM student_rewards 
                     WHERE user_email = $1`,
                    [lookupEmail]
                );
                totalRewards = parseFloat(result.rows[0]?.total || 0);
            }
        } catch (dbErr) {
            console.error('DB error getting rewards:', dbErr);
        }
        
        // Also check ICO purchases (by wallet OR email)
        const userPurchases = icoPurchases.filter(p => {
            const matchesWallet = lookupWallet && p.walletAddress && p.walletAddress.toLowerCase() === lookupWallet.toLowerCase();
            const matchesEmail = lookupEmail && p.email && p.email.toLowerCase() === lookupEmail.toLowerCase();
            return matchesWallet || matchesEmail;
        });
        const icoPurchaseTokens = userPurchases.reduce((sum, p) => sum + (p.tokens || 0), 0);
        
        const totalTokens = totalRewards + icoPurchaseTokens;
        
        if (totalTokens === 0) {
            return res.status(400).json({
                success: false,
                error: 'No KENO tokens available to cash out. Complete courses to earn KENO!'
            });
        }
        
        // Calculate USD value (using $1.00 per KENO - DEX listing price as of Dec 29, 2025)
        const kenoPrice = 1.00;
        const grossUsd = totalTokens * kenoPrice;
        
        // Calculate fees based on method
        let fee = 0;
        let netAmount = 0;
        
        if (withdrawalMethod === 'stripe') {
            fee = (grossUsd * 0.029) + 0.30; // 2.9% + $0.30
            netAmount = grossUsd - fee;
        } else if (withdrawalMethod === 'paypal') {
            if (!withdrawalDestination) {
                return res.status(400).json({ success: false, error: 'PayPal email required' });
            }
            fee = (grossUsd * 0.0349) + 0.49; // 3.49% + $0.49
            netAmount = grossUsd - fee;
        }
        
        // Note: Actual cash-out requires KENO to be listed on an exchange first
        // This is a preview of what the cash-out would look like
        
        res.json({
            success: true,
            preview: true,
            message: 'Cash-out preview calculated. Actual withdrawals available after PancakeSwap listing (Dec 29, 2025).',
            summary: {
                tokenBalance: totalTokens,
                courseRewards: totalRewards,
                icoPurchases: icoPurchaseTokens,
                kenoPrice: kenoPrice,
                grossUsd: parseFloat(grossUsd.toFixed(2)),
                withdrawalMethod: withdrawalMethod,
                fee: parseFloat(fee.toFixed(2)),
                netAmount: parseFloat(netAmount.toFixed(2))
            }
        });
    } catch (error) {
        console.error('Cash-out error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create pre-order sell order (scheduled for future date)
app.post('/api/ico/create-preorder', (req, res) => {
    try {
        const { walletAddress, tokens, targetPrice, executeDate } = req.body;
        
        const preOrder = {
            id: `PRE-${Date.now()}`,
            walletAddress: walletAddress,
            tokens: parseFloat(tokens),
            targetPrice: parseFloat(targetPrice),
            executeDate: new Date(executeDate),
            status: 'pending',
            createdAt: new Date()
        };
        
        if (!preOrderSellOrders) {
            global.preOrderSellOrders = [];
        }
        
        preOrderSellOrders.push(preOrder);
        
        dataPersistence.savePreOrders(preOrderSellOrders);
        
        res.json({
            success: true,
            preOrder: preOrder,
            message: `Pre-order created! Will execute on ${new Date(executeDate).toLocaleDateString()}`
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get user's pre-orders
app.get('/api/ico/preorders/:walletAddress', (req, res) => {
    try {
        const { walletAddress } = req.params;
        
        if (!global.preOrderSellOrders) {
            global.preOrderSellOrders = [];
        }
        
        const userPreOrders = preOrderSellOrders.filter(p => 
            p.walletAddress.toLowerCase() === walletAddress.toLowerCase()
        );
        
        res.json({
            success: true,
            preOrders: userPreOrders
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Send email notification to ICO investor (PancakeSwap listing launch)
app.post('/api/ico/send-notification', async (req, res) => {
    try {
        const { walletAddress } = req.body;
        
        const userPurchases = icoPurchases.filter(p => 
            p.walletAddress && p.walletAddress.toLowerCase() === walletAddress.toLowerCase()
        );
        
        if (userPurchases.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No ICO purchases found for this wallet'
            });
        }
        
        const totalInvested = userPurchases.reduce((sum, p) => sum + (p.amount || 0), 0);
        const totalTokens = userPurchases.reduce((sum, p) => sum + (p.tokens || 0), 0);
        
        const privateSalePrice = 0.01;
        const publicSalePrice = 0.05;
        const valueAtPrivate = totalTokens * privateSalePrice;
        const valueAtPublic = totalTokens * publicSalePrice;
        const profit = valueAtPublic - totalInvested;
        const roi = totalInvested > 0 ? ((profit / totalInvested) * 100) : 0;
        
        const recipientEmail = userPurchases[0].email || req.body.email;
        
        if (!recipientEmail) {
            return res.status(400).json({
                success: false,
                error: 'No email address found. Please provide email in request body'
            });
        }
        
        const emailHtml = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f9fafb; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center; }
        .header h1 { color: #ffffff; margin: 0; font-size: 28px; }
        .content { padding: 40px 30px; }
        .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 30px 0; }
        .stat-card { background: #f3f4f6; padding: 20px; border-radius: 10px; text-align: center; }
        .stat-label { font-size: 14px; color: #6b7280; margin-bottom: 8px; }
        .stat-value { font-size: 24px; font-weight: 700; color: #111827; }
        .stat-value.green { color: #10b981; }
        .cta-button { display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; padding: 16px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 20px 0; }
        .footer { background-color: #f9fafb; padding: 30px; text-align: center; color: #6b7280; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎉 KENO Public Sale is Live!</h1>
            <p style="color: #fff; margin: 10px 0 0 0; font-size: 18px;">Your tokens just increased 5x in value!</p>
        </div>
        
        <div class="content">
            <h2 style="color: #111827; margin-top: 0;">Congratulations, Early Investor!</h2>
            
            <p style="color: #4b5563; line-height: 1.6;">
                The KENO token has officially launched on PancakeSwap, and your Private Sale investment has significantly increased in value!
            </p>
            
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-label">Your Investment</div>
                    <div class="stat-value">$${totalInvested.toFixed(2)}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Total KENO</div>
                    <div class="stat-value">${totalTokens.toFixed(2)}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Current Value</div>
                    <div class="stat-value green">$${valueAtPublic.toFixed(2)}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Your Profit</div>
                    <div class="stat-value green">+$${profit.toFixed(2)} (${roi.toFixed(0)}%)</div>
                </div>
            </div>
            
            <h3 style="color: #111827;">What You Can Do Now:</h3>
            
            <ul style="color: #4b5563; line-height: 1.8;">
                <li><strong>Hold:</strong> Keep your KENO for long-term growth</li>
                <li><strong>Sell:</strong> Cash out your profit via our exchange</li>
                <li><strong>Trade:</strong> Trade KENO/USD, KENO/BTC, or KENO/ETH</li>
            </ul>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="https://kenostodblockchain.com/ico-dashboard.html" class="cta-button">
                    💎 View My Investment Dashboard
                </a>
            </div>
            
            <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 20px 0; border-radius: 4px;">
                <strong style="color: #92400e;">💡 Smart Tip:</strong>
                <p style="color: #92400e; margin: 8px 0 0 0;">Check your Investment Dashboard for personalized sell recommendations and one-click cash-out options!</p>
            </div>
        </div>
        
        <div class="footer">
            <p><strong>Kenostod Blockchain Academy</strong></p>
            <p>Breaking cycles of economic hardship through blockchain education</p>
            <p style="margin-top: 20px;">
                <a href="https://kenostodblockchain.com" style="color: #667eea; text-decoration: none;">Visit Website</a> | 
                <a href="https://kenostodblockchain.com/ico-dashboard.html" style="color: #667eea; text-decoration: none;">Investment Dashboard</a>
            </p>
        </div>
    </div>
</body>
</html>
        `;
        
        const emailResult = await emailService.sendEmail(
            recipientEmail,
            '🎉 Your KENO Investment Just Increased 5x!',
            emailHtml
        );
        
        if (!emailResult.success) {
            return res.status(500).json({
                success: false,
                error: 'Failed to send email: ' + emailResult.error
            });
        }
        
        res.json({
            success: true,
            message: 'Email notification sent successfully',
            email: recipientEmail,
            analytics: {
                totalInvested,
                totalTokens,
                currentValue: valueAtPublic,
                profit,
                roi
            }
        });
        
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Send notifications to ALL ICO investors (admin only)
app.post('/api/ico/notify-all-investors', async (req, res) => {
    try {
        const investors = new Map();
        
        icoPurchases.forEach(purchase => {
            if (purchase.walletAddress && purchase.email) {
                if (!investors.has(purchase.walletAddress)) {
                    investors.set(purchase.walletAddress, {
                        email: purchase.email,
                        walletAddress: purchase.walletAddress
                    });
                }
            }
        });
        
        const results = [];
        
        for (const [walletAddress, investor] of investors.entries()) {
            try {
                const response = await fetch('http://localhost:5000/api/ico/send-notification', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        walletAddress: walletAddress,
                        email: investor.email
                    })
                });
                
                const data = await response.json();
                results.push({
                    email: investor.email,
                    success: data.success
                });
            } catch (error) {
                results.push({
                    email: investor.email,
                    success: false,
                    error: error.message
                });
            }
        }
        
        res.json({
            success: true,
            message: `Sent notifications to ${results.filter(r => r.success).length} out of ${results.length} investors`,
            results: results
        });
        
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== END ICO INVESTMENT TRACKER & ANALYTICS ====================

// ==================== END PAYPAL API ENDPOINTS ====================

// ==================== MERCHANT INCENTIVES API ENDPOINTS ====================

// Stake KENO for merchant benefits
app.post('/api/merchant/stake', (req, res) => {
    try {
        const { merchantId, amount, merchantAddress } = req.body;
        const result = merchantIncentives.stakeMerchantKENO(merchantId, amount, merchantAddress);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Unstake KENO
app.post('/api/merchant/unstake', (req, res) => {
    try {
        const { merchantId, amount } = req.body;
        const result = merchantIncentives.unstakeMerchantKENO(merchantId, amount);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Claim staking rewards
app.post('/api/merchant/rewards/claim', (req, res) => {
    try {
        const { merchantId } = req.body;
        const result = merchantIncentives.claimStakingRewards(merchantId);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Withdraw rewards
app.post('/api/merchant/rewards/withdraw', (req, res) => {
    try {
        const { merchantId, amount } = req.body;
        const result = merchantIncentives.withdrawRewards(merchantId, amount);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get merchant dashboard with all incentive data
app.get('/api/merchant/dashboard/:merchantId', (req, res) => {
    try {
        const dashboard = merchantIncentives.getMerchantDashboard(req.params.merchantId);
        res.json(dashboard);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Calculate potential earnings
app.post('/api/merchant/calculate-earnings', (req, res) => {
    try {
        const { merchantId, monthlySales } = req.body;
        
        const fee = merchantIncentives.getTransactionFee(merchantId);
        const cashbackRate = merchantIncentives.calculateCashbackRate(merchantId);
        
        const kenoFees = monthlySales * fee;
        const usdFees = monthlySales * 0.029;
        const savings = usdFees - kenoFees;
        const cashback = monthlySales * cashbackRate;
        
        const stake = merchantIncentives.merchantStakes.get(merchantId);
        let stakingRewards = 0;
        if (stake) {
            const tier = merchantIncentives.getMerchantTier(stake.stakedAmount);
            const apy = merchantIncentives.tierBenefits[tier].stakingAPY;
            stakingRewards = stake.stakedAmount * apy / 12;
        }
        
        res.json({
            monthlySales,
            kenoFees: parseFloat(kenoFees.toFixed(2)),
            usdFees: parseFloat(usdFees.toFixed(2)),
            feeSavings: parseFloat(savings.toFixed(2)),
            cashbackEarned: parseFloat(cashback.toFixed(2)),
            stakingRewards: parseFloat(stakingRewards.toFixed(2)),
            totalMonthlyBenefit: parseFloat((savings + cashback + stakingRewards).toFixed(2))
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Apply cashback to completed payment
app.post('/api/merchant/payment/cashback', (req, res) => {
    try {
        const { merchantId, saleAmount } = req.body;
        const result = merchantIncentives.applyCashback(merchantId, saleAmount);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// ==================== END MERCHANT INCENTIVES API ENDPOINTS ====================

// ==================== CORPORATE/TEAM PLANS API ENDPOINTS ====================

// Create a new organization
app.post('/api/organization/create', async (req, res) => {
    try {
        if (!organizationManager) {
            return res.status(503).json({ error: 'Organization management not available' });
        }

        const { name, ownerEmail, ownerWalletAddress, companyType, totalSeats, monthlyPrice } = req.body;

        if (!name || !ownerEmail) {
            return res.status(400).json({ error: 'Missing required fields: name, ownerEmail' });
        }

        const organization = await organizationManager.createOrganization({
            name,
            ownerEmail,
            ownerWalletAddress,
            companyType,
            totalSeats,
            monthlyPrice
        });

        res.json({
            success: true,
            message: 'Organization created successfully',
            organization
        });
    } catch (error) {
        console.error('Error creating organization:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get organization by ID
app.get('/api/organization/:id', async (req, res) => {
    try {
        if (!organizationManager) {
            return res.status(503).json({ error: 'Organization management not available' });
        }

        const organization = await organizationManager.getOrganization(req.params.id);

        if (!organization) {
            return res.status(404).json({ error: 'Organization not found' });
        }

        res.json(organization);
    } catch (error) {
        console.error('Error fetching organization:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get organizations by owner email
app.get('/api/organization/owner/:email', async (req, res) => {
    try {
        if (!organizationManager) {
            return res.status(503).json({ error: 'Organization management not available' });
        }

        const organizations = await organizationManager.getOrganizationByOwnerEmail(req.params.email);
        res.json(organizations);
    } catch (error) {
        console.error('Error fetching organizations:', error);
        res.status(500).json({ error: error.message });
    }
});

// Invite a member to organization
app.post('/api/organization/:id/invite', async (req, res) => {
    try {
        if (!organizationManager) {
            return res.status(503).json({ error: 'Organization management not available' });
        }

        const { userEmail, role } = req.body;

        if (!userEmail) {
            return res.status(400).json({ error: 'Missing required field: userEmail' });
        }

        const member = await organizationManager.inviteMember(req.params.id, userEmail, role);

        res.json({
            success: true,
            message: 'Member invited successfully',
            member
        });
    } catch (error) {
        console.error('Error inviting member:', error);
        res.status(500).json({ error: error.message });
    }
});

// Accept organization invite
app.post('/api/organization/invite/:memberId/accept', async (req, res) => {
    try {
        if (!organizationManager) {
            return res.status(503).json({ error: 'Organization management not available' });
        }

        const { walletAddress } = req.body;

        if (!walletAddress) {
            return res.status(400).json({ error: 'Missing required field: walletAddress' });
        }

        const member = await organizationManager.acceptInvite(req.params.memberId, walletAddress);

        if (!member) {
            return res.status(404).json({ error: 'Invite not found' });
        }

        res.json({
            success: true,
            message: 'Invite accepted successfully',
            member
        });
    } catch (error) {
        console.error('Error accepting invite:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get organization members
app.get('/api/organization/:id/members', async (req, res) => {
    try {
        if (!organizationManager) {
            return res.status(503).json({ error: 'Organization management not available' });
        }

        const members = await organizationManager.getOrganizationMembers(req.params.id);
        res.json(members);
    } catch (error) {
        console.error('Error fetching members:', error);
        res.status(500).json({ error: error.message });
    }
});

// Remove member from organization
app.delete('/api/organization/:organizationId/member/:memberId', async (req, res) => {
    try {
        if (!organizationManager) {
            return res.status(503).json({ error: 'Organization management not available' });
        }

        await organizationManager.removeMember(req.params.organizationId, req.params.memberId);

        res.json({
            success: true,
            message: 'Member removed successfully'
        });
    } catch (error) {
        console.error('Error removing member:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get team learning progress
app.get('/api/organization/:id/progress', async (req, res) => {
    try {
        if (!organizationManager) {
            return res.status(503).json({ error: 'Organization management not available' });
        }

        const progress = await organizationManager.getTeamProgress(req.params.id);
        res.json(progress);
    } catch (error) {
        console.error('Error fetching team progress:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get member learning progress
app.get('/api/organization/member/:memberId/progress', async (req, res) => {
    try {
        if (!organizationManager) {
            return res.status(503).json({ error: 'Organization management not available' });
        }

        const progress = await organizationManager.getMemberProgress(req.params.memberId);
        res.json(progress);
    } catch (error) {
        console.error('Error fetching member progress:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update learning progress
app.post('/api/organization/progress/update', async (req, res) => {
    try {
        if (!organizationManager) {
            return res.status(503).json({ error: 'Organization management not available' });
        }

        const { organizationId, memberId, walletAddress, courseName, completionPercentage, timeSpentMinutes, quizScore } = req.body;

        if (!organizationId || !memberId || !courseName) {
            return res.status(400).json({ error: 'Missing required fields: organizationId, memberId, courseName' });
        }

        const progress = await organizationManager.updateLearningProgress({
            organizationId,
            memberId,
            walletAddress,
            courseName,
            completionPercentage: completionPercentage || 0,
            timeSpentMinutes: timeSpentMinutes || 0,
            quizScore
        });

        res.json({
            success: true,
            message: 'Learning progress updated',
            progress
        });
    } catch (error) {
        console.error('Error updating progress:', error);
        res.status(500).json({ error: error.message });
    }
});

// Calculate bulk discount pricing
app.post('/api/organization/pricing/calculate', async (req, res) => {
    try {
        if (!organizationManager) {
            return res.status(503).json({ error: 'Organization management not available' });
        }

        const { totalSeats } = req.body;

        if (!totalSeats || totalSeats < 1) {
            return res.status(400).json({ error: 'Invalid seat count' });
        }

        const pricing = await organizationManager.calculateBulkDiscount(totalSeats);
        res.json(pricing);
    } catch (error) {
        console.error('Error calculating pricing:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update Stripe subscription info
app.post('/api/organization/:id/stripe', async (req, res) => {
    try {
        if (!organizationManager) {
            return res.status(503).json({ error: 'Organization management not available' });
        }

        const { stripeCustomerId, stripeSubscriptionId } = req.body;

        await organizationManager.updateStripeInfo(req.params.id, stripeCustomerId, stripeSubscriptionId);

        res.json({
            success: true,
            message: 'Stripe info updated successfully'
        });
    } catch (error) {
        console.error('Error updating Stripe info:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update subscription status
app.post('/api/organization/:id/subscription/status', async (req, res) => {
    try {
        if (!organizationManager) {
            return res.status(503).json({ error: 'Organization management not available' });
        }

        const { status } = req.body;

        if (!status) {
            return res.status(400).json({ error: 'Missing required field: status' });
        }

        await organizationManager.updateSubscriptionStatus(req.params.id, status);

        res.json({
            success: true,
            message: 'Subscription status updated successfully'
        });
    } catch (error) {
        console.error('Error updating subscription status:', error);
        res.status(500).json({ error: error.message });
    }
});

// Create Stripe checkout session for corporate subscription
app.post('/api/organization/:id/checkout', async (req, res) => {
    try {
        if (!organizationManager) {
            return res.status(503).json({ error: 'Organization management not available' });
        }

        const { successUrl, cancelUrl, priceId } = req.body;
        const organizationId = req.params.id;

        const organization = await organizationManager.getOrganization(organizationId);
        if (!organization) {
            return res.status(404).json({ error: 'Organization not found' });
        }

        const checkoutSession = await stripeIntegration.createCheckoutSession({
            priceId: priceId || 'price_corporate_base',
            successUrl: successUrl || `${process.env.APP_URL || process.env.REPLIT_DEV_DOMAIN || 'http://localhost:5000'}/success`,
            cancelUrl: cancelUrl || `${process.env.APP_URL || process.env.REPLIT_DEV_DOMAIN || 'http://localhost:5000'}/cancel`,
            customerEmail: organization.owner_email,
            metadata: {
                organization_id: organizationId,
                organization_name: organization.name,
                total_seats: organization.total_seats
            }
        });

        res.json({
            success: true,
            checkoutUrl: checkoutSession.url,
            sessionId: checkoutSession.id
        });
    } catch (error) {
        console.error('Error creating checkout session:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get all organizations (admin endpoint)
app.get('/api/organizations/all', async (req, res) => {
    try {
        if (!organizationManager) {
            return res.status(503).json({ error: 'Organization management not available' });
        }

        const organizations = await organizationManager.getAllOrganizations();
        res.json(organizations);
    } catch (error) {
        console.error('Error fetching all organizations:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== END CORPORATE/TEAM PLANS API ENDPOINTS ====================

// ==================== REVENUE GENERATION API ENDPOINTS ====================

// ===== MERCHANT GATEWAY FEES (2.5%) =====

// Record merchant transaction and collect platform fee
app.post('/api/revenue/merchant/transaction', (req, res) => {
    try {
        const { merchantId, transactionAmount, merchantAddress } = req.body;
        
        if (!merchantId || !transactionAmount || !merchantAddress) {
            return res.status(400).json({ error: 'Missing required fields: merchantId, transactionAmount, merchantAddress' });
        }
        
        const result = revenueTracker.recordMerchantTransaction(merchantId, transactionAmount, merchantAddress);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get merchant fee report
app.get('/api/revenue/merchant/:merchantId/report', (req, res) => {
    try {
        const report = revenueTracker.getMerchantFeeReport(req.params.merchantId);
        res.json(report);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// ===== EXCHANGE TRADING FEES (0.5%) =====

// Record trading fee (called by exchange after successful trade)
app.post('/api/revenue/exchange/trade-fee', (req, res) => {
    try {
        const { buyerAddress, sellerAddress, quantity, price, pair } = req.body;
        
        if (!buyerAddress || !sellerAddress || !quantity || !price || !pair) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        const result = revenueTracker.recordTradingFee({ buyerAddress, sellerAddress, quantity, price, pair });
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get user trading fees report
app.get('/api/revenue/exchange/:userAddress/fees', (req, res) => {
    try {
        const report = revenueTracker.getUserTradingFees(req.params.userAddress);
        res.json(report);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// ===== WHITE-LABEL LICENSING =====

// Create new white-label license
app.post('/api/revenue/license/create', async (req, res) => {
    try {
        const { organizationName, tier, contactEmail, customDomain, stripeSubscriptionId } = req.body;
        
        if (!organizationName || !tier || !contactEmail) {
            return res.status(400).json({ error: 'Missing required fields: organizationName, tier, contactEmail' });
        }
        
        const result = revenueTracker.createLicense({ organizationName, tier, contactEmail, customDomain, stripeSubscriptionId });
        
        // Save to database if available
        if (dbConnection) {
            const license = result.license;
            await dbConnection.query(`
                INSERT INTO white_label_licenses (
                    license_id, license_key, organization_name, tier, contact_email, 
                    custom_domain, monthly_price, status, stripe_subscription_id, 
                    total_revenue, expires_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            `, [
                license.licenseId, license.licenseKey, license.organizationName, 
                license.tier, license.contactEmail, license.customDomain, 
                license.monthlyPrice, license.status, license.stripeSubscriptionId,
                license.totalRevenue, new Date(license.expiresAt)
            ]);
        }
        
        res.json(result);
    } catch (error) {
        console.error('Error creating license:', error);
        res.status(500).json({ error: error.message });
    }
});

// Validate license key
app.post('/api/revenue/license/validate', (req, res) => {
    try {
        const { licenseKey } = req.body;
        
        if (!licenseKey) {
            return res.status(400).json({ error: 'License key required' });
        }
        
        const result = revenueTracker.validateLicense(licenseKey);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Record license payment
app.post('/api/revenue/license/:licenseId/payment', async (req, res) => {
    try {
        const { amount, paymentId } = req.body;
        
        if (!amount || !paymentId) {
            return res.status(400).json({ error: 'Missing required fields: amount, paymentId' });
        }
        
        const result = revenueTracker.recordLicensePayment(req.params.licenseId, amount, paymentId);
        
        // Save payment to database if available
        if (dbConnection) {
            const period = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
            await dbConnection.query(`
                INSERT INTO license_payments (license_id, payment_id, amount, period)
                VALUES ($1, $2, $3, $4)
            `, [req.params.licenseId, paymentId, amount, period]);
            
            await dbConnection.query(`
                UPDATE white_label_licenses 
                SET total_revenue = total_revenue + $1, updated_at = CURRENT_TIMESTAMP
                WHERE license_id = $2
            `, [amount, req.params.licenseId]);
        }
        
        res.json(result);
    } catch (error) {
        console.error('Error recording payment:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get license report
app.get('/api/revenue/license/:licenseId/report', (req, res) => {
    try {
        const report = revenueTracker.getLicenseReport(req.params.licenseId);
        res.json(report);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get all licenses (admin)
app.get('/api/revenue/licenses/all', (req, res) => {
    try {
        const licenses = revenueTracker.getAllLicenses();
        res.json(licenses);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get white-label pricing tiers
app.get('/api/revenue/license/pricing', (req, res) => {
    try {
        res.json(revenueTracker.config.whiteLabel);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// ===== STRIPE INTEGRATION FOR WHITE-LABEL LICENSING =====

// Create Stripe checkout session for license purchase
app.post('/api/revenue/license/checkout', async (req, res) => {
    try {
        const { organizationName, tier, contactEmail, customDomain } = req.body;
        
        if (!organizationName || !tier || !contactEmail) {
            return res.status(400).json({ error: 'Missing required fields: organizationName, tier, contactEmail' });
        }
        
        // Validate tier
        const tierConfig = revenueTracker.config.whiteLabel[tier];
        if (!tierConfig) {
            return res.status(400).json({ error: 'Invalid tier. Choose: BASIC, PROFESSIONAL, or ENTERPRISE' });
        }
        
        // Create Stripe product and price
        const product = await stripeIntegration.createProduct(
            `Kenostod White-Label License - ${tier}`,
            `Full white-label licensing for ${organizationName} - ${tier} tier`
        );
        
        const price = await stripeIntegration.createPrice(
            product.id,
            tierConfig.price,
            'usd',
            'month'
        );
        
        // Create Stripe checkout session
        const baseUrl = process.env.APP_URL || (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : 'http://localhost:5000');
        const session = await stripeIntegration.createCheckoutSession(
            price.id,
            `${baseUrl}?payment=success&tier=${tier}`,
            `${baseUrl}?payment=cancelled`,
            contactEmail,
            {
                organizationName,
                tier,
                customDomain: customDomain || '',
                licenseType: 'white_label'
            }
        );
        
        res.json({
            success: true,
            sessionId: session.id,
            checkoutUrl: session.url,
            tier,
            monthlyPrice: tierConfig.price,
            message: session.testMode ? '⚠️ TEST MODE - No actual payment will be processed' : 'Proceed to Stripe checkout'
        });
    } catch (error) {
        console.error('Error creating Stripe checkout session:', error);
        res.status(500).json({ error: error.message });
    }
});


// ===== REVENUE ANALYTICS & REPORTING =====

// Get global revenue report (all streams)
app.get('/api/revenue/report/global', (req, res) => {
    try {
        const report = revenueTracker.getGlobalRevenueReport();
        res.json(report);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get revenue breakdown by source
app.get('/api/revenue/report/breakdown', (req, res) => {
    try {
        const breakdown = revenueTracker.getRevenueBreakdown();
        res.json(breakdown);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// ==================== END REVENUE GENERATION API ENDPOINTS ====================

// ==================== STUDENT ENROLLMENT API ENDPOINTS ====================

// Enroll a new student
app.post('/api/students/enroll', async (req, res) => {
    try {
        const { name, email, walletAddress, phone, country, referralCode } = req.body;
        
        if (!name || !email || !walletAddress) {
            return res.status(400).json({ 
                success: false, 
                error: 'Name, email, and wallet address are required' 
            });
        }
        
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Please enter a valid email address' 
            });
        }
        
        // Validate wallet address format (basic check)
        if (!walletAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Please enter a valid wallet address (0x...)' 
            });
        }
        
        // Normalize wallet address to lowercase
        const normalizedWallet = walletAddress.toLowerCase();
        const normalizedEmail = email.toLowerCase().trim();
        const sanitizedName = name.trim().substring(0, 255);
        
        // Check if student already exists
        const existingStudent = await dbConnection.query(
            `SELECT * FROM students WHERE LOWER(email) = $1 OR wallet_address = $2`,
            [normalizedEmail, normalizedWallet]
        );
        
        if (existingStudent.rows.length > 0) {
            const existing = existingStudent.rows[0];
            // If same wallet and email, just return success (already enrolled)
            if (existing.wallet_address === normalizedWallet && existing.email.toLowerCase() === normalizedEmail) {
                return res.json({ 
                    success: true, 
                    message: 'Welcome back! You are already enrolled.',
                    student: {
                        studentId: existing.student_id,
                        name: existing.name,
                        email: existing.email,
                        walletAddress: existing.wallet_address,
                        enrollmentDate: existing.enrollment_date
                    },
                    alreadyEnrolled: true
                });
            }
            // Different wallet or email conflict
            if (existing.email.toLowerCase() === normalizedEmail) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'This email is already registered with a different wallet address' 
                });
            }
            if (existing.wallet_address === normalizedWallet) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'This wallet address is already registered with a different email' 
                });
            }
        }
        
        // Generate student ID
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
        const studentId = `STU-${dateStr}-${randomSuffix}`;
        
        // Insert new student
        await dbConnection.query(`
            INSERT INTO students (student_id, name, email, wallet_address, phone, country, referral_code)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [studentId, sanitizedName, normalizedEmail, normalizedWallet, phone || null, country || null, referralCode || null]);
        
        // Update any existing student_rewards records with this wallet to include the email
        await dbConnection.query(`
            UPDATE student_rewards 
            SET user_email = $1 
            WHERE wallet_address = $2 OR user_wallet_address = $2
        `, [normalizedEmail, normalizedWallet]);
        
        console.log(`✅ New student enrolled: ${studentId} - ${sanitizedName} (${normalizedEmail})`);

        // Auto-generate Bridge KYC link for new student
        let bridgeKycLink = null;
        let bridgeCustomerId = null;
        try {
            const kycResult = await bridge.createKycLink(normalizedEmail, sanitizedName);
            if (kycResult && kycResult.kyc_link) {
                bridgeKycLink = kycResult.kyc_link;
                bridgeCustomerId = kycResult.customer_id || null;
                await dbConnection.query(
                    `UPDATE students SET bridge_customer_id = $1, bridge_kyc_link = $2, 
                     bridge_kyc_status = 'not_started', bridge_kyc_updated_at = NOW()
                     WHERE student_id = $3`,
                    [bridgeCustomerId, bridgeKycLink, studentId]
                );
                console.log(`🔗 Bridge KYC link created for ${normalizedEmail}`);
            }
        } catch (bridgeErr) {
            console.error('Bridge KYC link creation failed (non-fatal):', bridgeErr.message);
        }

        res.json({ 
            success: true, 
            message: 'Welcome to Kenostod Blockchain Academy!',
            student: {
                studentId,
                name: sanitizedName,
                email: normalizedEmail,
                walletAddress: normalizedWallet,
                enrollmentDate: new Date().toISOString()
            },
            bridge: {
                kycRequired: true,
                kycLink: bridgeKycLink,
                message: bridgeKycLink 
                    ? 'Complete your identity verification to unlock USDB earnings and the KUTL card.' 
                    : 'Identity verification will be available shortly.'
            }
        });
    } catch (error) {
        console.error('Error enrolling student:', error.message);
        res.status(500).json({ success: false, error: 'Failed to enroll. Please try again.' });
    }
});

// Check if student is enrolled
app.get('/api/students/check/:walletAddress', async (req, res) => {
    try {
        const walletAddress = req.params.walletAddress.toLowerCase();
        
        const result = await dbConnection.query(
            `SELECT * FROM students WHERE wallet_address = $1`,
            [walletAddress]
        );
        
        if (result.rows.length > 0) {
            const student = result.rows[0];
            res.json({ 
                success: true, 
                enrolled: true,
                student: {
                    studentId: student.student_id,
                    name: student.name,
                    email: student.email,
                    walletAddress: student.wallet_address,
                    enrollmentDate: student.enrollment_date,
                    coursesCompleted: student.courses_completed,
                    totalKenoEarned: student.total_keno_earned
                }
            });
        } else {
            res.json({ success: true, enrolled: false });
        }
    } catch (error) {
        console.error('Error checking enrollment:', error.message);
        res.status(500).json({ success: false, error: 'Failed to check enrollment status' });
    }
});

// Get student by email (for admin lookups)
app.get('/api/students/by-email/:email', async (req, res) => {
    try {
        const email = req.params.email.toLowerCase();
        
        const result = await dbConnection.query(
            `SELECT * FROM students WHERE LOWER(email) = $1`,
            [email]
        );
        
        if (result.rows.length > 0) {
            const student = result.rows[0];
            res.json({ 
                success: true, 
                found: true,
                student: {
                    studentId: student.student_id,
                    name: student.name,
                    email: student.email,
                    walletAddress: student.wallet_address,
                    enrollmentDate: student.enrollment_date,
                    coursesCompleted: student.courses_completed,
                    totalKenoEarned: student.total_keno_earned
                }
            });
        } else {
            res.json({ success: true, found: false });
        }
    } catch (error) {
        console.error('Error finding student:', error.message);
        res.status(500).json({ success: false, error: 'Failed to find student' });
    }
});

// Admin: Update student email for existing wallet (backfill)
app.post('/api/admin/students/update-email', requireAdminAuth, async (req, res) => {
    try {
        const { walletAddress, email, name } = req.body;
        
        if (!walletAddress || !email) {
            return res.status(400).json({ 
                success: false, 
                error: 'Wallet address and email are required' 
            });
        }
        
        const normalizedWallet = walletAddress.toLowerCase();
        const normalizedEmail = email.toLowerCase().trim();
        
        // Check if student exists
        const existingStudent = await dbConnection.query(
            `SELECT * FROM students WHERE wallet_address = $1`,
            [normalizedWallet]
        );
        
        if (existingStudent.rows.length > 0) {
            // Update existing student
            await dbConnection.query(`
                UPDATE students 
                SET email = $1, name = COALESCE($2, name), updated_at = CURRENT_TIMESTAMP
                WHERE wallet_address = $3
            `, [normalizedEmail, name || null, normalizedWallet]);
        } else {
            // Create new student record
            const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
            const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
            const studentId = `STU-${dateStr}-${randomSuffix}`;
            
            await dbConnection.query(`
                INSERT INTO students (student_id, name, email, wallet_address)
                VALUES ($1, $2, $3, $4)
            `, [studentId, name || 'Student', normalizedEmail, normalizedWallet]);
        }
        
        // Update student_rewards records
        await dbConnection.query(`
            UPDATE student_rewards 
            SET user_email = $1 
            WHERE user_wallet_address = $2
        `, [normalizedEmail, normalizedWallet]);
        
        console.log(`✅ Admin updated student: ${normalizedWallet} -> ${normalizedEmail}`);
        
        res.json({ 
            success: true, 
            message: 'Student record updated successfully'
        });
    } catch (error) {
        console.error('Error updating student:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Admin: Update student (upsert - creates if not exists, used by admin backoffice)
app.post('/api/admin/students/update', requireAdminAuth, async (req, res) => {
    try {
        const { walletAddress, email, name } = req.body;
        
        if (!walletAddress) {
            return res.status(400).json({ 
                success: false, 
                error: 'Wallet address is required' 
            });
        }
        
        const normalizedWallet = walletAddress.toLowerCase();
        const normalizedEmail = email ? email.toLowerCase().trim() : null;
        
        // Check if student exists
        const existingStudent = await dbConnection.query(
            `SELECT * FROM students WHERE wallet_address = $1`,
            [normalizedWallet]
        );
        
        if (existingStudent.rows.length > 0) {
            // Update existing student
            await dbConnection.query(`
                UPDATE students 
                SET name = COALESCE(NULLIF($1, ''), name),
                    email = COALESCE(NULLIF($2, ''), email),
                    updated_at = CURRENT_TIMESTAMP
                WHERE wallet_address = $3
            `, [name || null, normalizedEmail, normalizedWallet]);
        } else {
            // Create new student record for legacy wallet (backfill)
            const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
            const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
            const studentId = `STU-${dateStr}-${randomSuffix}`;
            
            await dbConnection.query(`
                INSERT INTO students (student_id, name, email, wallet_address)
                VALUES ($1, $2, $3, $4)
            `, [studentId, name || 'Student', normalizedEmail || '', normalizedWallet]);
            
            console.log(`✅ Admin created student record for legacy wallet: ${normalizedWallet}`);
        }
        
        // Update student_rewards records if email provided
        if (normalizedEmail) {
            await dbConnection.query(`
                UPDATE student_rewards 
                SET user_email = $1 
                WHERE user_wallet_address = $2
            `, [normalizedEmail, normalizedWallet]);
        }
        
        console.log(`✅ Admin updated student: ${normalizedWallet}`);
        res.json({ success: true, message: 'Student updated successfully' });
    } catch (error) {
        console.error('Error updating student:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Admin: List all enrolled students
app.get('/api/admin/students', requireAdminAuth, async (req, res) => {
    try {
        const result = await dbConnection.query(`
            SELECT s.*, 
                   (SELECT COUNT(*) FROM student_rewards sr WHERE sr.user_wallet_address = s.wallet_address AND sr.reward_type = 'course_completion') as actual_courses_completed,
                   (SELECT COALESCE(SUM(reward_amount), 0) FROM student_rewards sr WHERE sr.user_wallet_address = s.wallet_address) as actual_keno_earned
            FROM students s
            ORDER BY s.created_at DESC
            LIMIT 500
        `);
        
        res.json({ 
            success: true, 
            students: result.rows,
            total: result.rows.length
        });
    } catch (error) {
        console.error('Error fetching students:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== END STUDENT ENROLLMENT API ENDPOINTS ====================

// ==================== WEALTH BUILDER PROGRAM API ENDPOINTS ====================

// Award course completion reward (SECURED: Rate Limited + Course Progress Verification)
app.post('/api/wealth/rewards/course-complete', 
    (req, res, next) => {
        if (!securityMiddleware) {
            return res.status(503).json({ error: 'Security features currently unavailable' });
        }
        securityMiddleware.courseCompletionLimiter(req, res, next);
    },
    (req, res, next) => securityMiddleware.trackCourseProgress(req, res, next),
    async (req, res) => {
        if (!wealthBuilderManager) {
            return res.status(503).json({ error: 'Wealth Builder features currently unavailable' });
        }
        
        try {
            const { walletAddress, email, courseName, courseId } = req.body;
            
            if (!courseId) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'courseId is required to prevent duplicate rewards' 
                });
            }
            
            const result = await wealthBuilderManager.awardCourseCompletion(walletAddress, email, courseName, courseId);
            res.json(result);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

// Get user's rewards
app.get('/api/wealth/rewards/:walletAddress', async (req, res) => {
    if (!wealthBuilderManager) {
        return res.status(503).json({ error: 'Wealth Builder features currently unavailable' });
    }
    
    try {
        const result = await wealthBuilderManager.getUserRewards(req.params.walletAddress);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Submit scholarship application (SECURED: Rate Limited)
app.post('/api/wealth/scholarships/apply', 
    (req, res, next) => {
        if (!securityMiddleware) {
            return res.status(503).json({ error: 'Security features currently unavailable' });
        }
        securityMiddleware.scholarshipApplicationLimiter(req, res, next);
    },
    async (req, res) => {
        if (!wealthBuilderManager) {
            return res.status(503).json({ error: 'Wealth Builder features currently unavailable' });
        }
        
        try {
            const result = await wealthBuilderManager.applyForScholarship(req.body);
            res.json(result);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

// Get scholarship applications (admin)
app.get('/api/wealth/scholarships', async (req, res) => {
    if (!wealthBuilderManager) {
        return res.status(503).json({ error: 'Wealth Builder features currently unavailable' });
    }
    
    try {
        const status = req.query.status;
        const result = await wealthBuilderManager.getScholarshipApplications(status);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Review scholarship application (admin)
app.post('/api/wealth/scholarships/review', async (req, res) => {
    if (!wealthBuilderManager) {
        return res.status(503).json({ error: 'Wealth Builder features currently unavailable' });
    }
    
    try {
        const { applicationId, status, reviewerName, notes } = req.body;
        const result = await wealthBuilderManager.reviewScholarshipApplication(
            applicationId, 
            status, 
            reviewerName, 
            notes
        );
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Check scholarship access (for course unlock)
app.get('/api/wealth/scholarships/check-access', async (req, res) => {
    if (!wealthBuilderManager) {
        return res.status(503).json({ error: 'Wealth Builder features currently unavailable' });
    }
    
    try {
        const { email, wallet } = req.query;
        const identifier = email || wallet;
        
        if (!identifier) {
            return res.status(400).json({ error: 'Email or wallet address required' });
        }
        
        const result = await wealthBuilderManager.checkScholarshipAccess(identifier);
        res.json({
            hasScholarship: result.hasAccess,
            coursesUnlocked: result.hasAccess ? 21 : 0,
            grant: result.grant
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create job listing (admin/companies)
app.post('/api/wealth/jobs/create', async (req, res) => {
    if (!wealthBuilderManager) {
        return res.status(503).json({ error: 'Wealth Builder features currently unavailable' });
    }
    
    try {
        const result = await wealthBuilderManager.createJobListing(req.body);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get active job listings
app.get('/api/wealth/jobs', async (req, res) => {
    if (!wealthBuilderManager) {
        return res.status(503).json({ error: 'Wealth Builder features currently unavailable' });
    }
    
    try {
        const result = await wealthBuilderManager.getActiveJobs();
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Apply for a job (SECURED: Rate Limited + Duplicate Prevention)
app.post('/api/wealth/jobs/apply', 
    (req, res, next) => {
        if (!securityMiddleware) {
            return res.status(503).json({ error: 'Security features currently unavailable' });
        }
        securityMiddleware.jobApplicationLimiter(req, res, next);
    },
    (req, res, next) => securityMiddleware.checkDuplicateJobApplication(req, res, next),
    async (req, res) => {
        if (!wealthBuilderManager) {
            return res.status(503).json({ error: 'Wealth Builder features currently unavailable' });
        }
        
        try {
            const result = await wealthBuilderManager.applyForJob(req.body);
            res.json(result);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

// Generate referral code (SECURED: Rate Limited)
app.post('/api/wealth/referrals/generate', 
    (req, res, next) => {
        if (!securityMiddleware) {
            return res.status(503).json({ error: 'Security features currently unavailable' });
        }
        securityMiddleware.referralLimiter(req, res, next);
    },
    async (req, res) => {
        if (!wealthBuilderManager) {
            return res.status(503).json({ error: 'Wealth Builder features currently unavailable' });
        }
        
        try {
            const { walletAddress, email } = req.body;
            const result = await wealthBuilderManager.generateReferralCode(walletAddress, email);
            res.json(result);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

// Process referral signup (SECURED: Rate Limited)
app.post('/api/wealth/referrals/process', 
    (req, res, next) => {
        if (!securityMiddleware) {
            return res.status(503).json({ error: 'Security features currently unavailable' });
        }
        securityMiddleware.referralLimiter(req, res, next);
    },
    async (req, res) => {
        if (!wealthBuilderManager) {
            return res.status(503).json({ error: 'Wealth Builder features currently unavailable' });
        }
        
        try {
            const { referralCode, newUserEmail } = req.body;
            const result = await wealthBuilderManager.processReferral(referralCode, newUserEmail);
            res.json(result);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

// Complete referral reward (when referred user completes first course) (SECURED: Rate Limited)
app.post('/api/wealth/referrals/complete', 
    (req, res, next) => {
        if (!securityMiddleware) {
            return res.status(503).json({ error: 'Security features currently unavailable' });
        }
        securityMiddleware.referralLimiter(req, res, next);
    },
    async (req, res) => {
        if (!wealthBuilderManager) {
            return res.status(503).json({ error: 'Wealth Builder features currently unavailable' });
        }
        
        try {
            const { referralCode } = req.body;
            const result = await wealthBuilderManager.completeReferralReward(referralCode);
            res.json(result);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

// Get user's RVT NFTs
app.get('/api/wealth/rvt/:walletAddress', async (req, res) => {
    if (!wealthBuilderManager) {
        return res.status(503).json({ error: 'Wealth Builder features currently unavailable' });
    }
    
    try {
        const result = await wealthBuilderManager.getUserRVTNFTs(req.params.walletAddress);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get wealth snapshot/dashboard
app.get('/api/wealth/dashboard/:walletAddress', async (req, res) => {
    if (!wealthBuilderManager) {
        return res.status(503).json({ error: 'Wealth Builder features currently unavailable' });
    }
    
    try {
        const { walletAddress } = req.params;
        const email = req.query.email || '';
        
        // Get FAL profits from arbitrage system
        let falProfits = 0;
        if (arbitrageSystem) {
            const trader = arbitrageSystem.traderProfiles.get(walletAddress.toLowerCase());
            if (trader) {
                falProfits = (trader.totalProfit || 0) + (trader.totalBonusEarned || 0);
            }
        }
        
        // Get approved grants
        const approvedGrants = (miningGrants || [])
            .filter(g => g.walletAddress && g.walletAddress.toLowerCase() === walletAddress.toLowerCase() && g.status === 'approved')
            .length;
        const grantTokens = approvedGrants * 5250;
        
        const result = await wealthBuilderManager.calculateWealthSnapshot(walletAddress, email, icoPurchases || [], falProfits + grantTokens);
        
        // Add grant info to response
        if (result.success && result.wealth) {
            result.wealth.approvedGrants = approvedGrants;
            result.wealth.grantTokens = grantTokens;
        }
        
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== END WEALTH BUILDER PROGRAM API ENDPOINTS ====================

// ==================== GRADUATE CLUB API ENDPOINTS ====================

// Generate Graduate ID and certificate (INTERNAL USE ONLY - called after verified completion)
app.post('/api/graduates/generate-id', async (req, res) => {
    if (!wealthBuilderManager || !dbConnection) {
        return res.status(503).json({ error: 'Graduate features currently unavailable' });
    }
    
    try {
        const { walletAddress, email } = req.body;
        
        if (!walletAddress) {
            return res.status(400).json({ error: 'Wallet address required' });
        }
        
        // SECURITY: Verify the user actually completed all 21 courses
        const completionCheck = await dbConnection.query(`
            SELECT 
                COUNT(DISTINCT course_name) as completed_courses,
                SUM(reward_amount) as total_keno_earned
            FROM student_rewards
            WHERE user_wallet_address = $1 
            AND reward_type = 'course_completion'
            AND status = 'claimed'
        `, [walletAddress]);
        
        const completedCount = parseInt(completionCheck.rows[0]?.completed_courses || 0);
        const kenoEarned = parseFloat(completionCheck.rows[0]?.total_keno_earned || 0);
        
        // Require at least 21 courses (>= allows for future curriculum expansion)
        if (completedCount < 21) {
            return res.status(403).json({ 
                error: 'Must complete at least 21 courses to become a graduate',
                coursesCompleted: completedCount,
                coursesRemaining: 21 - completedCount
            });
        }
        
        // Check if already a graduate
        const existingGrad = await dbConnection.query(`
            SELECT graduate_id FROM kenostod_graduates WHERE wallet_address = $1
        `, [walletAddress]);
        
        if (existingGrad.rows.length > 0) {
            return res.json({ 
                success: true,
                alreadyGraduate: true,
                graduateId: existingGrad.rows[0].graduate_id,
                message: 'You are already a Kenostod Graduate!'
            });
        }
        
        // Generate Graduate ID
        const completionDate = new Date();
        const dateStr = completionDate.toISOString().slice(0, 10).replace(/-/g, '');
        const addressHash = walletAddress.slice(-4).toUpperCase();
        
        const graduateId = `KG-${dateStr}-${addressHash}`;
        
        const certHash = require('crypto')
            .createHash('sha256')
            .update(`${walletAddress}${dateStr}${completedCount}`)
            .digest('hex');
        
        // Insert graduate record
        await dbConnection.query(`
            INSERT INTO kenostod_graduates 
            (graduate_id, wallet_address, user_email, completion_date, total_courses, keno_earned, rvt_nft_tier, certificate_hash)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
            graduateId,
            walletAddress,
            email || null,
            completionDate,
            21,
            Math.round(kenoEarned),
            'Platinum',
            certHash
        ]);
        
        const graduate = {
            graduateId,
            walletAddress,
            email,
            completionDate: completionDate.toISOString(),
            totalCourses: 21,
            kenoEarned: Math.round(kenoEarned),
            rvtNFT: 'Platinum',
            royaltyRate: 0.02,
            certificateHash: certHash,
            verificationUrl: `https://kenostodblockchain.com/verify/${graduateId}`,
            status: 'verified'
        };
        
        console.log(`🎓 New Graduate! ${graduateId} - Wallet: ${walletAddress.slice(0, 8)}...`);
        
        res.json({ success: true, graduate, message: 'Welcome to the Kenostod Graduate Club!' });
    } catch (error) {
        console.error('Error generating graduate ID:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Verify graduate status
app.get('/api/graduates/verify/:identifier', async (req, res) => {
    if (!dbConnection) {
        return res.status(503).json({ error: 'Database features currently unavailable' });
    }
    
    try {
        const { identifier } = req.params;
        let result;
        
        if (identifier.startsWith('KG-') || identifier.startsWith('GRAD-')) {
            result = await dbConnection.query(`
                SELECT * FROM kenostod_graduates WHERE graduate_id = $1
            `, [identifier]);
        } else if (identifier.includes('@')) {
            result = await dbConnection.query(`
                SELECT * FROM kenostod_graduates WHERE LOWER(user_email) = LOWER($1)
            `, [identifier]);
        } else {
            result = await dbConnection.query(`
                SELECT * FROM kenostod_graduates WHERE wallet_address = $1
            `, [identifier]);
        }
        
        if (result.rows.length === 0) {
            return res.json({ success: false, isGraduate: false, message: 'No graduate record found' });
        }
        
        const graduate = result.rows[0];
        res.json({
            success: true,
            isGraduate: true,
            graduate: {
                graduate_id: graduate.graduate_id,
                wallet_address: graduate.wallet_address,
                user_email: graduate.user_email,
                graduate_name: graduate.graduate_name,
                completion_date: graduate.completion_date,
                total_courses: graduate.total_courses,
                keno_earned: graduate.keno_earned,
                rvt_nft_tier: graduate.rvt_nft_tier,
                certificate_hash: graduate.certificate_hash
            },
            graduateId: graduate.graduate_id,
            walletAddress: graduate.wallet_address,
            completionDate: graduate.completion_date,
            totalCourses: graduate.total_courses,
            kenoEarned: graduate.keno_earned,
            rvtNFT: graduate.rvt_nft_tier,
            certificateHash: graduate.certificate_hash,
            verifiedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error verifying graduate:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Update graduate name for certificate
app.post('/api/graduates/update-name', async (req, res) => {
    if (!dbConnection) {
        return res.status(503).json({ error: 'Database features currently unavailable' });
    }
    
    try {
        const { graduateId, name } = req.body;
        
        if (!graduateId || !name) {
            return res.status(400).json({ success: false, error: 'Graduate ID and name are required' });
        }
        
        const sanitizedName = name.trim().slice(0, 100);
        
        const result = await dbConnection.query(`
            UPDATE kenostod_graduates 
            SET graduate_name = $1, updated_at = CURRENT_TIMESTAMP
            WHERE graduate_id = $2
            RETURNING *
        `, [sanitizedName, graduateId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Graduate not found' });
        }
        
        console.log(`Updated graduate name: ${graduateId} -> ${sanitizedName}`);
        
        res.json({
            success: true,
            message: 'Name updated successfully',
            graduate: result.rows[0]
        });
    } catch (error) {
        console.error('Error updating graduate name:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get graduate leaderboard
app.get('/api/graduates/leaderboard', async (req, res) => {
    if (!dbConnection) {
        return res.status(503).json({ error: 'Database features currently unavailable' });
    }
    
    try {
        const result = await dbConnection.query(`
            SELECT 
                graduate_id,
                LEFT(wallet_address, 8) || '...' as wallet_preview,
                completion_date,
                total_courses,
                keno_earned,
                rvt_nft_tier,
                created_at
            FROM kenostod_graduates
            ORDER BY completion_date ASC
            LIMIT 100
        `);
        
        res.json({ 
            success: true, 
            totalGraduates: result.rows.length,
            graduates: result.rows 
        });
    } catch (error) {
        console.error('Error fetching leaderboard:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Award scholarship course completion (KENO locked until graduation)
app.post('/api/graduates/scholarship/course-complete', async (req, res) => {
    if (!wealthBuilderManager || !dbConnection) {
        return res.status(503).json({ error: 'Graduate features currently unavailable' });
    }
    try {
        const { walletAddress, email, courseName, courseId } = req.body;
        if (!walletAddress || !courseName || !courseId) {
            return res.status(400).json({ error: 'walletAddress, courseName, and courseId are required' });
        }
        const result = await wealthBuilderManager.awardScholarshipCourseCompletion(walletAddress, email, courseName, courseId);
        res.json(result);
    } catch (error) {
        console.error('Error awarding scholarship course completion:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Get scholarship student progress
app.get('/api/graduates/scholarship/progress/:wallet', async (req, res) => {
    if (!wealthBuilderManager || !dbConnection) {
        return res.status(503).json({ error: 'Graduate features currently unavailable' });
    }
    try {
        const { wallet } = req.params;
        const result = await wealthBuilderManager.getScholarshipProgress(wallet);
        res.json(result);
    } catch (error) {
        console.error('Error fetching scholarship progress:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Trigger scholarship graduation (ADMIN ONLY — unlocks KENO + creates graduate record + flags card activation)
app.post('/api/graduates/scholarship/graduate', async (req, res) => {
    if (!wealthBuilderManager || !dbConnection) {
        return res.status(503).json({ error: 'Graduate features currently unavailable' });
    }
    try {
        const { walletAddress, email, adminKey } = req.body;
        if (!walletAddress || !adminKey) {
            return res.status(400).json({ error: 'walletAddress and adminKey are required' });
        }
        const result = await wealthBuilderManager.triggerScholarshipGraduation(walletAddress, email, adminKey);
        if (!result.success && result.error === 'Unauthorized. Admin key required.') {
            return res.status(401).json(result);
        }
        res.json(result);
    } catch (error) {
        console.error('Error triggering scholarship graduation:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ==================== END GRADUATE CLUB API ENDPOINTS ====================

// ==================== GRADUATE MERCHANDISE API ENDPOINTS ====================

// Check if user is eligible for graduate merchandise (completed 21 courses)
app.get('/api/graduate/check-eligibility/:wallet', async (req, res) => {
    if (!dbConnection) {
        return res.status(503).json({ error: 'Database features currently unavailable' });
    }
    
    try {
        const { wallet } = req.params;
        
        // Check if user is a verified graduate (case-insensitive wallet match)
        const graduateCheck = await dbConnection.query(`
            SELECT graduate_id, completion_date, total_courses, keno_earned, rvt_nft_tier
            FROM kenostod_graduates
            WHERE LOWER(wallet_address) = LOWER($1)
        `, [wallet]);
        
        if (graduateCheck.rows.length > 0) {
            const graduate = graduateCheck.rows[0];
            return res.json({
                eligible: true,
                isGraduate: true,
                graduateId: graduate.graduate_id,
                completionDate: graduate.completion_date,
                totalCourses: graduate.total_courses,
                kenoEarned: graduate.keno_earned,
                rvtNFT: graduate.rvt_nft_tier
            });
        }
        
        // Check course completion status (case-insensitive wallet match)
        const completionCheck = await dbConnection.query(`
            SELECT 
                COUNT(DISTINCT course_id) as completed_courses
            FROM course_progress
            WHERE LOWER(user_wallet_address) = LOWER($1) 
            AND completion_verified = true
        `, [wallet]);
        
        const completedCount = parseInt(completionCheck.rows[0]?.completed_courses || 0);
        
        res.json({
            eligible: completedCount >= 21,
            isGraduate: false,
            coursesCompleted: completedCount,
            coursesRemaining: Math.max(0, 21 - completedCount),
            message: completedCount >= 21 
                ? 'Congratulations! You are eligible for graduate merchandise.' 
                : `Complete ${21 - completedCount} more course(s) to unlock graduate merchandise.`
        });
    } catch (error) {
        console.error('Error checking eligibility:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Submit graduate merchandise order
app.post('/api/graduate/merchandise/order', async (req, res) => {
    if (!dbConnection) {
        return res.status(503).json({ error: 'Database features currently unavailable' });
    }
    
    if (!securityMiddleware) {
        return res.status(503).json({ error: 'Security features currently unavailable' });
    }
    
    try {
        const {
            userWalletAddress,
            userEmail,
            graduateName,
            shippingAddress,
            phoneNumber,
            itemsRequested
        } = req.body;
        
        // Validate required fields
        if (!userWalletAddress || !graduateName || !shippingAddress || !itemsRequested) {
            return res.status(400).json({ 
                success: false,
                error: 'Missing required fields: userWalletAddress, graduateName, shippingAddress, itemsRequested' 
            });
        }
        
        // Validate wallet address format
        if (!securityMiddleware.validateWalletAddress(userWalletAddress)) {
            return res.status(400).json({ 
                success: false,
                error: 'Invalid wallet address format. Must be a valid Ethereum address (0x...)' 
            });
        }
        
        // Validate email if provided
        if (userEmail && !securityMiddleware.validateEmail(userEmail)) {
            return res.status(400).json({ 
                success: false,
                error: 'Invalid email address format' 
            });
        }
        
        // Validate phone number if provided
        if (phoneNumber && !securityMiddleware.validatePhoneNumber(phoneNumber)) {
            return res.status(400).json({ 
                success: false,
                error: 'Invalid phone number format' 
            });
        }
        
        // Validate shipping address structure
        if (!shippingAddress.line1 || !shippingAddress.city || !shippingAddress.postalCode || !shippingAddress.country) {
            return res.status(400).json({ 
                success: false,
                error: 'Incomplete shipping address. Required: line1, city, postalCode, country' 
            });
        }
        
        // Validate items requested
        if (!Array.isArray(itemsRequested) || itemsRequested.length === 0) {
            return res.status(400).json({ 
                success: false,
                error: 'Items requested must be a non-empty array' 
            });
        }
        
        const validItemTypes = ['pin', 'id_card', 'hoodie', 'ring', 'certificate', 'phone_case'];
        for (const item of itemsRequested) {
            if (!item.itemType || !validItemTypes.includes(item.itemType)) {
                return res.status(400).json({ 
                    success: false,
                    error: `Invalid item type. Must be one of: ${validItemTypes.join(', ')}` 
                });
            }
            if (!item.quantity || item.quantity < 1 || item.quantity > 10) {
                return res.status(400).json({ 
                    success: false,
                    error: 'Item quantity must be between 1 and 10' 
                });
            }
        }
        
        // Sanitize all text inputs
        const sanitizedGraduateName = securityMiddleware.sanitizeText(graduateName, 100);
        const sanitizedEmail = userEmail ? securityMiddleware.sanitizeText(userEmail, 254) : null;
        const sanitizedPhone = phoneNumber ? securityMiddleware.sanitizeText(phoneNumber, 20) : null;
        const sanitizedLine1 = securityMiddleware.sanitizeText(shippingAddress.line1, 200);
        const sanitizedLine2 = shippingAddress.line2 ? securityMiddleware.sanitizeText(shippingAddress.line2, 200) : null;
        const sanitizedCity = securityMiddleware.sanitizeText(shippingAddress.city, 100);
        const sanitizedState = shippingAddress.state ? securityMiddleware.sanitizeText(shippingAddress.state, 100) : null;
        const sanitizedPostalCode = securityMiddleware.sanitizeText(shippingAddress.postalCode, 20);
        const sanitizedCountry = securityMiddleware.sanitizeText(shippingAddress.country, 100);
        
        // Verify graduate status - authoritative check against kenostod_graduates table (case-insensitive)
        const graduateCheck = await dbConnection.query(`
            SELECT graduate_id, completion_date, total_courses 
            FROM kenostod_graduates 
            WHERE LOWER(wallet_address) = LOWER($1)
        `, [userWalletAddress]);
        
        if (graduateCheck.rows.length === 0) {
            return res.status(403).json({ 
                success: false,
                error: 'You must be a verified graduate to request merchandise. Complete all 21 courses and claim your graduation status first.',
                requiresGraduation: true
            });
        }
        
        const graduate = graduateCheck.rows[0];
        
        // Verify they completed all 21 courses
        if (graduate.total_courses < 21) {
            return res.status(403).json({ 
                success: false,
                error: `You must complete all 21 courses to request merchandise. You have completed ${graduate.total_courses} courses.`,
                coursesCompleted: graduate.total_courses,
                coursesRequired: 21
            });
        }
        
        const graduateId = graduate.graduate_id;
        
        // Generate unique order ID
        const orderId = `MO-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
        
        // Calculate estimated cost
        const itemPrices = {
            'pin': 0,        // Free for graduates
            'id_card': 0,    // Free for graduates
            'hoodie': 45,    // Discounted for graduates
            'ring': 69,      // Discounted
            'certificate': 99, // Discounted
            'phone_case': 25  // Discounted
        };
        
        let estimatedCost = 0;
        itemsRequested.forEach(item => {
            const price = itemPrices[item.itemType] || 0;
            estimatedCost += price * (item.quantity || 1);
        });
        
        // Insert order into database (using sanitized inputs)
        const result = await dbConnection.query(`
            INSERT INTO graduate_merchandise_orders (
                order_id,
                user_wallet_address,
                user_email,
                graduate_name,
                graduate_id,
                shipping_address_line1,
                shipping_address_line2,
                shipping_city,
                shipping_state,
                shipping_postal_code,
                shipping_country,
                phone_number,
                items_requested,
                estimated_total_cost,
                order_status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            RETURNING *
        `, [
            orderId,
            userWalletAddress.toLowerCase(),
            sanitizedEmail,
            sanitizedGraduateName,
            graduateId,
            sanitizedLine1,
            sanitizedLine2,
            sanitizedCity,
            sanitizedState,
            sanitizedPostalCode,
            sanitizedCountry,
            sanitizedPhone,
            JSON.stringify(itemsRequested),
            estimatedCost,
            'pending'
        ]);
        
        console.log(`📦 New merchandise order: ${orderId} from ${graduateId}`);
        
        res.json({
            success: true,
            order: result.rows[0],
            message: 'Your merchandise order has been submitted successfully! You will receive an email when it ships.'
        });
    } catch (error) {
        console.error('Error submitting merchandise order:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Get all merchandise orders (ADMIN ONLY)
app.get('/api/graduate/merchandise/orders', (req, res, next) => {
    if (!securityMiddleware) {
        return res.status(503).json({ error: 'Security features currently unavailable' });
    }
    securityMiddleware.requireAdmin(req, res, next);
}, async (req, res) => {
    if (!dbConnection) {
        return res.status(503).json({ error: 'Database features currently unavailable' });
    }
    
    try {
        const status = req.query.status || 'all';
        
        // Validate status parameter if provided
        if (status !== 'all' && !securityMiddleware.validateStatus(status)) {
            return res.status(400).json({ 
                success: false,
                error: 'Invalid status filter. Must be one of: pending, processing, shipped, delivered, all' 
            });
        }
        
        let query = `
            SELECT 
                o.*,
                g.completion_date
            FROM graduate_merchandise_orders o
            LEFT JOIN kenostod_graduates g ON o.graduate_id = g.graduate_id
        `;
        
        if (status !== 'all') {
            query += ` WHERE o.order_status = $1`;
        }
        
        query += ` ORDER BY o.created_at DESC`;
        
        const params = status !== 'all' ? [status] : [];
        const result = await dbConnection.query(query, params);
        
        console.log(`🔒 Admin accessed merchandise orders (${result.rows.length} orders)`);
        
        res.json({
            success: true,
            totalOrders: result.rows.length,
            orders: result.rows
        });
    } catch (error) {
        console.error('Error fetching merchandise orders:', error.message);
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
});

// Update merchandise order status (ADMIN ONLY)
app.put('/api/graduate/merchandise/orders/:orderId', (req, res, next) => {
    if (!securityMiddleware) {
        return res.status(503).json({ error: 'Security features currently unavailable' });
    }
    securityMiddleware.requireAdmin(req, res, next);
}, async (req, res) => {
    if (!dbConnection) {
        return res.status(503).json({ error: 'Database features currently unavailable' });
    }
    
    try {
        const { orderId } = req.params;
        const { status, orderNotes, trackingNumber, printfulOrderId, autoPrintful } = req.body;
        
        // Validate required fields
        if (!status) {
            return res.status(400).json({ 
                success: false,
                error: 'Status is required' 
            });
        }
        
        // Validate order ID format
        if (!orderId || !orderId.startsWith('MO-')) {
            return res.status(400).json({ 
                success: false,
                error: 'Invalid order ID format' 
            });
        }
        
        // Validate status value - ONLY allow these specific values
        if (!securityMiddleware.validateStatus(status)) {
            return res.status(400).json({ 
                success: false,
                error: 'Invalid status. Must be one of: pending, processing, shipped, delivered' 
            });
        }
        
        // Get current order data before updating
        const currentOrderResult = await dbConnection.query(
            'SELECT * FROM graduate_merchandise_orders WHERE order_id = $1',
            [orderId]
        );
        
        if (currentOrderResult.rows.length === 0) {
            return res.status(404).json({ 
                success: false,
                error: 'Order not found' 
            });
        }
        
        const currentOrder = currentOrderResult.rows[0];
        
        // Handle autoPrintful - create Printful order if requested
        let printfulResult = null;
        let finalPrintfulOrderId = printfulOrderId;
        
        if (autoPrintful === true && printfulIntegration.isConfigured()) {
            try {
                console.log(`🖨️  Creating Printful order for ${orderId}...`);
                printfulResult = await printfulIntegration.createPrintfulOrder(currentOrder);
                finalPrintfulOrderId = printfulResult.printfulOrderId;
                console.log(`✅ Printful order created: ${finalPrintfulOrderId}`);
            } catch (printfulError) {
                console.error('❌ Printful order creation failed:', printfulError.message);
                return res.status(500).json({
                    success: false,
                    error: `Printful integration failed: ${printfulError.message}`
                });
            }
        } else if (autoPrintful === true && !printfulIntegration.isConfigured()) {
            console.warn('⚠️  autoPrintful requested but PRINTFUL_API_KEY not configured');
        }
        
        // Sanitize all text inputs to prevent XSS
        const sanitizedOrderNotes = orderNotes ? securityMiddleware.sanitizeText(orderNotes, 1000) : null;
        const sanitizedTrackingNumber = trackingNumber ? securityMiddleware.sanitizeText(trackingNumber, 100) : null;
        const sanitizedPrintfulOrderId = finalPrintfulOrderId ? securityMiddleware.sanitizeText(finalPrintfulOrderId, 50) : null;
        
        // Update timestamp fields based on status
        let timestampField = '';
        if (status === 'processing') timestampField = 'processed_at = CURRENT_TIMESTAMP';
        if (status === 'shipped') timestampField = 'shipped_at = CURRENT_TIMESTAMP';
        if (status === 'delivered') timestampField = 'delivered_at = CURRENT_TIMESTAMP';
        
        const updates = ['order_status = $1'];
        const params = [status];
        let paramIndex = 2;
        
        if (sanitizedOrderNotes !== null) {
            updates.push(`order_notes = $${paramIndex}`);
            params.push(sanitizedOrderNotes);
            paramIndex++;
        }
        
        if (sanitizedTrackingNumber !== null) {
            updates.push(`tracking_number = $${paramIndex}`);
            params.push(sanitizedTrackingNumber);
            paramIndex++;
        }
        
        if (sanitizedPrintfulOrderId !== null) {
            updates.push(`printful_order_id = $${paramIndex}`);
            params.push(sanitizedPrintfulOrderId);
            paramIndex++;
        }
        
        if (timestampField) {
            updates.push(timestampField);
        }
        
        params.push(orderId);
        
        // Using parameterized query to prevent SQL injection
        const result = await dbConnection.query(`
            UPDATE graduate_merchandise_orders
            SET ${updates.join(', ')}
            WHERE order_id = $${paramIndex}
            RETURNING *
        `, params);
        
        const updatedOrder = result.rows[0];
        
        console.log(`🔒 Admin updated order ${orderId} to status: ${status}`);
        
        // Send email notifications based on status change
        let emailResult = null;
        try {
            if (status === 'shipped' && currentOrder.order_status !== 'shipped') {
                emailResult = await EmailService.sendOrderShippedEmail(updatedOrder);
            } else if (status === 'delivered' && currentOrder.order_status !== 'delivered') {
                emailResult = await EmailService.sendOrderDeliveredEmail(updatedOrder);
            }
        } catch (emailError) {
            console.error('⚠️  Email notification failed (non-critical):', emailError.message);
        }
        
        res.json({
            success: true,
            order: updatedOrder,
            message: 'Order updated successfully',
            emailSent: emailResult ? true : false,
            printfulOrder: printfulResult ? {
                printfulOrderId: printfulResult.printfulOrderId,
                estimatedShippingDate: printfulResult.estimatedShippingDate
            } : null
        });
    } catch (error) {
        console.error('Error updating merchandise order:', error.message);
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
});

// Get Printful order status (ADMIN ONLY) - Optional endpoint for syncing Printful status
app.get('/api/graduate/merchandise/printful-status/:orderId', (req, res, next) => {
    if (!securityMiddleware) {
        return res.status(503).json({ error: 'Security features currently unavailable' });
    }
    securityMiddleware.requireAdmin(req, res, next);
}, async (req, res) => {
    if (!dbConnection) {
        return res.status(503).json({ error: 'Database features currently unavailable' });
    }
    
    if (!printfulIntegration.isConfigured()) {
        return res.status(503).json({ 
            success: false,
            error: 'Printful integration not configured. Set PRINTFUL_API_KEY environment variable.' 
        });
    }
    
    try {
        const { orderId } = req.params;
        
        const orderResult = await dbConnection.query(
            'SELECT * FROM graduate_merchandise_orders WHERE order_id = $1',
            [orderId]
        );
        
        if (orderResult.rows.length === 0) {
            return res.status(404).json({ 
                success: false,
                error: 'Order not found' 
            });
        }
        
        const order = orderResult.rows[0];
        
        if (!order.printful_order_id) {
            return res.status(400).json({ 
                success: false,
                error: 'No Printful order ID associated with this order' 
            });
        }
        
        console.log(`🔍 Fetching Printful status for order ${orderId} (Printful ID: ${order.printful_order_id})`);
        
        const printfulStatus = await printfulIntegration.getOrderStatus(order.printful_order_id);
        
        let shouldUpdateTracking = false;
        const updates = [];
        const params = [];
        let paramIndex = 1;
        
        if (printfulStatus.trackingNumber && printfulStatus.trackingNumber !== order.tracking_number) {
            updates.push(`tracking_number = $${paramIndex}`);
            params.push(printfulStatus.trackingNumber);
            paramIndex++;
            shouldUpdateTracking = true;
        }
        
        if (printfulStatus.status === 'shipped' && order.order_status !== 'shipped') {
            updates.push(`order_status = $${paramIndex}`);
            params.push('shipped');
            paramIndex++;
            updates.push('shipped_at = CURRENT_TIMESTAMP');
            shouldUpdateTracking = true;
        }
        
        if (shouldUpdateTracking && updates.length > 0) {
            params.push(orderId);
            await dbConnection.query(`
                UPDATE graduate_merchandise_orders
                SET ${updates.join(', ')}
                WHERE order_id = $${paramIndex}
            `, params);
            
            console.log(`✅ Updated local order ${orderId} with Printful tracking info`);
        }
        
        res.json({
            success: true,
            printfulStatus: printfulStatus,
            localOrderUpdated: shouldUpdateTracking,
            message: shouldUpdateTracking ? 'Order updated with Printful tracking info' : 'Order is already up to date'
        });
    } catch (error) {
        console.error('Error fetching Printful status:', error.message);
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
});

// Send order to Printful for fulfillment (ADMIN ONLY)
app.post('/api/graduate/merchandise/orders/:orderId/send-to-printful', (req, res, next) => {
    if (!securityMiddleware) {
        return res.status(503).json({ error: 'Security features currently unavailable' });
    }
    securityMiddleware.requireAdmin(req, res, next);
}, async (req, res) => {
    if (!dbConnection) {
        return res.status(503).json({ error: 'Database features currently unavailable' });
    }
    
    if (!printfulIntegration.isConfigured()) {
        return res.status(503).json({ 
            success: false,
            error: 'Printful integration not configured. Please set PRINTFUL_API_KEY environment variable.' 
        });
    }
    
    try {
        const { orderId } = req.params;
        
        const orderResult = await dbConnection.query(
            'SELECT * FROM graduate_merchandise_orders WHERE order_id = $1',
            [orderId]
        );
        
        if (orderResult.rows.length === 0) {
            return res.status(404).json({ 
                success: false,
                error: 'Order not found' 
            });
        }
        
        const order = orderResult.rows[0];
        
        if (order.printful_order_id) {
            return res.status(400).json({ 
                success: false,
                error: 'Order already sent to Printful',
                printfulOrderId: order.printful_order_id
            });
        }
        
        if (order.order_status !== 'pending' && order.order_status !== 'processing') {
            return res.status(400).json({ 
                success: false,
                error: `Cannot send order to Printful. Current status: ${order.order_status}`
            });
        }
        
        console.log(`🖨️  Sending order ${orderId} to Printful...`);
        
        const printfulResult = await printfulIntegration.createPrintfulOrder(order);
        
        await dbConnection.query(`
            UPDATE graduate_merchandise_orders
            SET printful_order_id = $1,
                order_status = 'processing',
                processed_at = CURRENT_TIMESTAMP
            WHERE order_id = $2
        `, [printfulResult.printfulOrderId, orderId]);
        
        console.log(`✅ Order ${orderId} sent to Printful successfully (Printful ID: ${printfulResult.printfulOrderId})`);
        
        res.json({
            success: true,
            message: 'Order sent to Printful successfully',
            printfulOrderId: printfulResult.printfulOrderId,
            estimatedShippingDate: printfulResult.estimatedShippingDate,
            status: printfulResult.status,
            costs: printfulResult.costs
        });
    } catch (error) {
        console.error('Error sending order to Printful:', error.message);
        res.status(500).json({ 
            success: false,
            error: `Failed to send order to Printful: ${error.message}` 
        });
    }
});

// Printful webhook endpoint for shipping updates
app.post('/api/webhooks/printful', async (req, res) => {
    if (!dbConnection) {
        return res.status(503).json({ error: 'Database features currently unavailable' });
    }
    
    try {
        const webhookData = req.body;
        
        console.log('📬 Received Printful webhook:', webhookData.type || 'unknown type');
        
        if (webhookData.type === 'package_shipped') {
            const printfulOrderId = webhookData.data?.order?.id;
            const trackingNumber = webhookData.data?.shipment?.tracking_number;
            const trackingUrl = webhookData.data?.shipment?.tracking_url;
            
            if (!printfulOrderId) {
                console.warn('⚠️  Printful webhook missing order ID');
                return res.status(400).json({ error: 'Missing order ID in webhook data' });
            }
            
            const orderResult = await dbConnection.query(
                'SELECT * FROM graduate_merchandise_orders WHERE printful_order_id = $1',
                [printfulOrderId.toString()]
            );
            
            if (orderResult.rows.length === 0) {
                console.warn(`⚠️  No local order found for Printful ID: ${printfulOrderId}`);
                return res.status(404).json({ error: 'Order not found' });
            }
            
            const order = orderResult.rows[0];
            
            await dbConnection.query(`
                UPDATE graduate_merchandise_orders
                SET order_status = 'shipped',
                    tracking_number = $1,
                    shipped_at = CURRENT_TIMESTAMP
                WHERE order_id = $2
            `, [trackingNumber || null, order.order_id]);
            
            console.log(`✅ Updated order ${order.order_id} to shipped status (tracking: ${trackingNumber})`);
            
            const updatedOrderResult = await dbConnection.query(
                'SELECT * FROM graduate_merchandise_orders WHERE order_id = $1',
                [order.order_id]
            );
            const updatedOrder = updatedOrderResult.rows[0];
            
            try {
                if (updatedOrder.user_email) {
                    await EmailService.sendOrderShippedEmail(updatedOrder);
                    console.log(`📧 Shipped notification email sent for order ${order.order_id}`);
                }
            } catch (emailError) {
                console.error('⚠️  Email notification failed (non-critical):', emailError.message);
            }
        } else if (webhookData.type === 'package_returned') {
            const printfulOrderId = webhookData.data?.order?.id;
            
            if (printfulOrderId) {
                await dbConnection.query(`
                    UPDATE graduate_merchandise_orders
                    SET order_notes = COALESCE(order_notes || E'\n', '') || 'Package returned by carrier - ' || CURRENT_TIMESTAMP
                    WHERE printful_order_id = $1
                `, [printfulOrderId.toString()]);
                
                console.log(`⚠️  Package returned for Printful order ${printfulOrderId}`);
            }
        }
        
        res.json({ received: true });
    } catch (error) {
        console.error('Error processing Printful webhook:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Create test graduate account (DEVELOPMENT ONLY)
app.post('/api/dev/create-test-graduate', async (req, res) => {
    if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({ 
            error: 'This endpoint is only available in development mode',
            message: 'Test graduate creation is disabled in production for security'
        });
    }
    
    if (!dbConnection) {
        return res.status(503).json({ error: 'Database features currently unavailable' });
    }
    
    try {
        const testGraduateId = 'KG-TEST-0001';
        const testWalletAddress = wallet1.getAddress();
        const testEmail = 'test@kenostod.com';
        
        const existingGraduate = await dbConnection.query(
            'SELECT * FROM kenostod_graduates WHERE graduate_id = $1',
            [testGraduateId]
        );
        
        if (existingGraduate.rows.length > 0) {
            console.log('✅ Test graduate already exists, returning existing record');
            return res.json({
                success: true,
                message: 'Test graduate already exists',
                graduate: existingGraduate.rows[0],
                alreadyExists: true
            });
        }
        
        const result = await dbConnection.query(`
            INSERT INTO kenostod_graduates 
            (graduate_id, wallet_address, user_email, completion_date, total_courses, keno_earned, rvt_nft_tier, certificate_hash)
            VALUES ($1, $2, $3, CURRENT_TIMESTAMP, 21, 5250, 'Platinum', $4)
            RETURNING *
        `, [testGraduateId, testWalletAddress, testEmail, `test-cert-hash-${testGraduateId}`]);
        
        const newGraduate = result.rows[0];
        
        console.log(`🎓 Test graduate created successfully: ${testGraduateId}`);
        console.log(`   Wallet: ${testWalletAddress}`);
        console.log(`   Email: ${testEmail}`);
        
        res.json({
            success: true,
            message: 'Test graduate created successfully',
            graduate: newGraduate,
            instructions: {
                walletAddress: testWalletAddress,
                email: testEmail,
                usage: 'Use this wallet address in the merchandise request form to test the system'
            }
        });
    } catch (error) {
        console.error('Error creating test graduate:', error.message);
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
});

// ==================== END GRADUATE MERCHANDISE API ENDPOINTS ====================

// ==================== CHAT HISTORY API ENDPOINTS ====================

// Create a new chat conversation
app.post('/api/chat/conversations', async (req, res) => {
    if (!dbConnection) {
        return res.status(503).json({ error: 'Database features currently unavailable' });
    }
    
    try {
        const { userWalletAddress, userEmail, conversationTitle } = req.body;
        
        const result = await dbConnection.query(`
            INSERT INTO chat_conversations (user_wallet_address, user_email, conversation_title)
            VALUES ($1, $2, $3)
            RETURNING *
        `, [userWalletAddress || null, userEmail || null, conversationTitle || 'Untitled Conversation']);
        
        res.json({ success: true, conversation: result.rows[0] });
    } catch (error) {
        console.error('Error creating conversation:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Add a message to a conversation
app.post('/api/chat/conversations/:conversationId/messages', async (req, res) => {
    if (!dbConnection) {
        return res.status(503).json({ error: 'Database features currently unavailable' });
    }
    
    try {
        const { conversationId } = req.params;
        const { messageRole, messageContent } = req.body;
        
        if (!messageRole || !messageContent) {
            return res.status(400).json({ error: 'messageRole and messageContent are required' });
        }
        
        const messageResult = await dbConnection.query(`
            INSERT INTO chat_messages (conversation_id, message_role, message_content)
            VALUES ($1, $2, $3)
            RETURNING *
        `, [conversationId, messageRole, messageContent]);
        
        await dbConnection.query(`
            UPDATE chat_conversations 
            SET updated_at = CURRENT_TIMESTAMP 
            WHERE id = $1
        `, [conversationId]);
        
        res.json({ success: true, message: messageResult.rows[0] });
    } catch (error) {
        console.error('Error adding message:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Get all conversations for a user
app.get('/api/chat/conversations', async (req, res) => {
    if (!dbConnection) {
        return res.status(503).json({ error: 'Database features currently unavailable' });
    }
    
    try {
        const { userWalletAddress, userEmail } = req.query;
        
        let query = 'SELECT * FROM chat_conversations WHERE 1=1';
        const params = [];
        
        if (userWalletAddress) {
            params.push(userWalletAddress);
            query += ` AND user_wallet_address = $${params.length}`;
        }
        
        if (userEmail) {
            params.push(userEmail);
            query += ` AND user_email = $${params.length}`;
        }
        
        query += ' ORDER BY updated_at DESC';
        
        const result = await dbConnection.query(query, params);
        
        res.json({ success: true, conversations: result.rows });
    } catch (error) {
        console.error('Error fetching conversations:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Get a specific conversation with all its messages
app.get('/api/chat/conversations/:conversationId', async (req, res) => {
    if (!dbConnection) {
        return res.status(503).json({ error: 'Database features currently unavailable' });
    }
    
    try {
        const { conversationId } = req.params;
        
        const conversationResult = await dbConnection.query(`
            SELECT * FROM chat_conversations WHERE id = $1
        `, [conversationId]);
        
        if (conversationResult.rows.length === 0) {
            return res.status(404).json({ error: 'Conversation not found' });
        }
        
        const messagesResult = await dbConnection.query(`
            SELECT * FROM chat_messages 
            WHERE conversation_id = $1 
            ORDER BY timestamp ASC
        `, [conversationId]);
        
        res.json({
            success: true,
            conversation: conversationResult.rows[0],
            messages: messagesResult.rows
        });
    } catch (error) {
        console.error('Error fetching conversation:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Delete a conversation
app.delete('/api/chat/conversations/:conversationId', async (req, res) => {
    if (!dbConnection) {
        return res.status(503).json({ error: 'Database features currently unavailable' });
    }
    
    try {
        const { conversationId } = req.params;
        
        const result = await dbConnection.query(`
            DELETE FROM chat_conversations WHERE id = $1 RETURNING *
        `, [conversationId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Conversation not found' });
        }
        
        res.json({ success: true, message: 'Conversation deleted successfully' });
    } catch (error) {
        console.error('Error deleting conversation:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Update conversation title
app.put('/api/chat/conversations/:conversationId', async (req, res) => {
    if (!dbConnection) {
        return res.status(503).json({ error: 'Database features currently unavailable' });
    }
    
    try {
        const { conversationId } = req.params;
        const { conversationTitle } = req.body;
        
        if (!conversationTitle) {
            return res.status(400).json({ error: 'conversationTitle is required' });
        }
        
        const result = await dbConnection.query(`
            UPDATE chat_conversations 
            SET conversation_title = $1, updated_at = CURRENT_TIMESTAMP 
            WHERE id = $2 
            RETURNING *
        `, [conversationTitle, conversationId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Conversation not found' });
        }
        
        res.json({ success: true, conversation: result.rows[0] });
    } catch (error) {
        console.error('Error updating conversation:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ==================== END CHAT HISTORY API ENDPOINTS ====================

// ==================== AI CUSTOMER SUPPORT API ENDPOINTS ====================

app.post('/api/support/chat', async (req, res) => {
    try {
        const { messages } = req.body;
        
        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Messages array is required' 
            });
        }
        
        const response = await aiSupport.chat(messages);
        res.json(response);
    } catch (error) {
        console.error('AI Support chat error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to get AI response',
            details: error.message 
        });
    }
});

app.post('/api/support/quick-question', async (req, res) => {
    try {
        const { question } = req.body;
        
        if (!question) {
            return res.status(400).json({ 
                success: false, 
                error: 'Question is required' 
            });
        }
        
        const response = await aiSupport.quickAnswer(question);
        res.json(response);
    } catch (error) {
        console.error('AI Support quick question error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to get AI response',
            details: error.message 
        });
    }
});

// ==================== END AI CUSTOMER SUPPORT API ENDPOINTS ====================

// ==================== KENO ARBITRAGE REVOLUTION API ENDPOINTS ====================

app.post('/api/arbitrage/flash-loan/create', (req, res) => {
    try {
        const { walletAddress, amount, loanAmount, targetPair, opportunityId, purpose } = req.body;
        const actualAmount = amount || loanAmount;
        
        if (!walletAddress || !actualAmount) {
            return res.status(400).json({ 
                success: false, 
                error: 'Wallet address and amount are required' 
            });
        }
        
        const result = arbitrageSystem.createFlashLoan(walletAddress, actualAmount, purpose || targetPair || 'Arbitrage trading');
        res.json(result);
    } catch (error) {
        console.error('Flash loan creation error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to create flash loan',
            details: error.message 
        });
    }
});

app.post('/api/arbitrage/flash-loan/repay', async (req, res) => {
    try {
        const { walletAddress, loanId, profit } = req.body;
        
        if (!walletAddress || !loanId) {
            return res.status(400).json({ 
                success: false, 
                error: 'Wallet address and loan ID are required' 
            });
        }
        
        const actualProfit = profit || 0;
        const result = arbitrageSystem.repayFlashLoan(walletAddress, loanId, actualProfit);

        if (result.success && actualProfit > 0 && dbConnection) {
            try {
                const bonusEarned = result.bonusEarned || 0;
                const totalKeno = actualProfit + bonusEarned;
                await dbConnection.query(
                    `INSERT INTO student_rewards 
                        (user_wallet_address, reward_type, reward_amount, description, status, created_at)
                     VALUES ($1, 'fal_profit', $2, $3, 'available', NOW())`,
                    [
                        walletAddress.toLowerCase(),
                        totalKeno,
                        `FAL profit: ${actualProfit.toFixed(2)} KENO + ${bonusEarned.toFixed(2)} KENO bonus (Loan: ${loanId})`
                    ]
                );
                console.log(`💾 FAL profit saved to DB: ${totalKeno.toFixed(2)} KENO for ${walletAddress.substring(0, 20)}...`);
            } catch (dbErr) {
                console.error('Failed to save FAL profit to DB:', dbErr.message);
            }
        }

        res.json(result);
    } catch (error) {
        console.error('Flash loan repayment error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to repay flash loan',
            details: error.message 
        });
    }
});

app.get('/api/arbitrage/opportunities', (req, res) => {
    try {
        const opportunities = arbitrageSystem.getOpportunities();
        res.json({ 
            success: true, 
            opportunities,
            count: opportunities.length 
        });
    } catch (error) {
        console.error('Opportunities fetch error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch arbitrage opportunities',
            details: error.message 
        });
    }
});

// Real-time CoinGecko API endpoints
app.get('/api/market/prices', generalLimiter, async (req, res) => {
    try {
        const prices = await arbitrageSystem.coinGeckoAPI.getPrices();
        res.json({ 
            success: true, 
            prices,
            source: 'coingecko-api',
            lastUpdate: arbitrageSystem.coinGeckoAPI.lastUpdate
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch market prices',
            message: error.message 
        });
    }
});

app.get('/api/market/price/:symbol', generalLimiter, async (req, res) => {
    try {
        const { symbol } = req.params;
        const price = await arbitrageSystem.coinGeckoAPI.getPrice(symbol.toUpperCase());
        
        if (price === null) {
            return res.status(404).json({ 
                success: false, 
                error: 'Symbol not found' 
            });
        }
        
        res.json({ 
            success: true, 
            symbol: symbol.toUpperCase(),
            price,
            source: 'coingecko-api'
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch price' 
        });
    }
});

app.get('/api/market/health', async (req, res) => {
    try {
        const health = await arbitrageSystem.coinGeckoAPI.healthCheck();
        res.json({ 
            success: true, 
            ...health 
        });
    } catch (error) {
        res.json({ 
            success: false, 
            status: 'error',
            error: error.message 
        });
    }
});

app.get('/api/arbitrage/leaderboard', (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const leaderboard = arbitrageSystem.getLeaderboard(limit);
        
        res.json({ 
            success: true, 
            leaderboard,
            total: leaderboard.length 
        });
    } catch (error) {
        console.error('Leaderboard fetch error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch leaderboard',
            details: error.message 
        });
    }
});

app.get('/api/arbitrage/active-loan/:walletAddress', (req, res) => {
    try {
        const { walletAddress } = req.params;
        const activeLoan = arbitrageSystem.getActiveLoan(walletAddress);
        
        if (!activeLoan) {
            return res.json({ 
                success: true, 
                hasActiveLoan: false,
                message: 'No active loan found for this wallet' 
            });
        }
        
        res.json({ 
            success: true,
            hasActiveLoan: true,
            loan: activeLoan
        });
    } catch (error) {
        console.error('Active loan check error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to check active loan',
            details: error.message 
        });
    }
});

app.get('/api/arbitrage/profile/:walletAddress', (req, res) => {
    try {
        const { walletAddress } = req.params;
        const profile = arbitrageSystem.getTraderProfile(walletAddress);
        
        if (!profile) {
            return res.json({ 
                success: false, 
                error: 'Trader profile not found' 
            });
        }
        
        res.json({ 
            success: true, 
            profile 
        });
    } catch (error) {
        console.error('Profile fetch error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch trader profile',
            details: error.message 
        });
    }
});

app.get('/api/arbitrage/events', (req, res) => {
    try {
        const events = arbitrageSystem.getUpcomingEvents();
        res.json({ 
            success: true, 
            events,
            count: events.length 
        });
    } catch (error) {
        console.error('Events fetch error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch events',
            details: error.message 
        });
    }
});

app.get('/api/arbitrage/stats', (req, res) => {
    try {
        const stats = arbitrageSystem.getStats();
        res.json({ 
            success: true, 
            stats 
        });
    } catch (error) {
        console.error('Stats fetch error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch statistics',
            details: error.message 
        });
    }
});

app.post('/api/arbitrage/bridge/transfer', (req, res) => {
    try {
        const { walletAddress, fromExchange, toExchange, amount, signature } = req.body;
        
        if (!walletAddress || !fromExchange || !toExchange || !amount) {
            return res.status(400).json({ 
                success: false, 
                error: 'Missing required parameters' 
            });
        }
        
        const result = arbitrageSystem.createBridgeTransfer(
            walletAddress, 
            fromExchange, 
            toExchange, 
            amount, 
            signature
        );
        
        res.json(result);
    } catch (error) {
        console.error('Bridge transfer error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to create bridge transfer',
            details: error.message 
        });
    }
});

// FAL Withdrawal Request - Students submit withdrawal requests
app.post('/api/fal/withdrawal/request', async (req, res) => {
    try {
        const { simulatorWallet, metaMaskWallet, amount } = req.body;
        
        if (!simulatorWallet || !metaMaskWallet || !amount) {
            return res.status(400).json({ 
                success: false, 
                error: 'Missing required fields' 
            });
        }
        
        if (!metaMaskWallet.startsWith('0x') || metaMaskWallet.length !== 42) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid MetaMask wallet address' 
            });
        }
        
        const profile = arbitrageSystem.getTraderProfile(simulatorWallet);
        if (!profile) {
            return res.status(400).json({ 
                success: false, 
                error: 'No trading profile found for this wallet' 
            });
        }
        
        const availableBalance = profile.totalProfit + profile.totalBonusEarned;
        if (amount > availableBalance) {
            return res.status(400).json({ 
                success: false, 
                error: `Insufficient balance. Available: ${availableBalance.toFixed(2)} KENO` 
            });
        }
        
        const requestId = 'FAL-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
        
        await db.query(`
            INSERT INTO fal_withdrawals (request_id, simulator_wallet, metamask_wallet, amount, status)
            VALUES ($1, $2, $3, $4, 'pending')
        `, [requestId, simulatorWallet.toLowerCase(), metaMaskWallet.toLowerCase(), amount]);
        
        console.log(`💸 FAL withdrawal request: ${amount} KENO from ${simulatorWallet.substring(0, 20)}... to ${metaMaskWallet}`);
        
        try {
            await EmailService.sendEmail({
                to: 'moheazy81@gmail.com',
                subject: `🚨 New FAL Withdrawal Request: ${amount.toFixed(2)} KENO`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #10b981;">FAL KENO Distribution Request</h2>
                        <div style="background: #f3f4f6; padding: 20px; border-radius: 10px; margin: 20px 0;">
                            <p><strong>Request ID:</strong> ${requestId}</p>
                            <p><strong>Amount:</strong> ${amount.toFixed(2)} KENO</p>
                            <p><strong>Simulator Wallet:</strong> ${simulatorWallet.substring(0, 30)}...</p>
                            <p><strong>BSC MetaMask Wallet:</strong> ${metaMaskWallet}</p>
                            <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
                        </div>
                        <p><strong>Student flow:</strong> KENO sent to their BSC wallet → student converts to USDK via Bridge.xyz. No admin cash handling required.</p>
                        <p>View in <a href="https://kenostodblockchain.com/backoffice.html">Admin Backoffice</a> for distribution queue.</p>
                    </div>
                `,
                text: `FAL KENO Distribution Request\n\nRequest ID: ${requestId}\nAmount: ${amount.toFixed(2)} KENO\nBSC MetaMask: ${metaMaskWallet}\n\nStudent converts to USDK via Bridge.xyz after receipt. View in backoffice.`
            });
            console.log('📧 Admin notification email sent for FAL withdrawal');
        } catch (emailError) {
            console.error('⚠️ Failed to send admin notification email:', emailError.message);
        }
        
        res.json({ 
            success: true, 
            requestId,
            message: 'Withdrawal request submitted successfully'
        });
    } catch (error) {
        console.error('FAL withdrawal request error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to submit withdrawal request' 
        });
    }
});

app.get('/api/admin/fal-withdrawals', async (req, res) => {
    try {
        const { adminPassword } = req.query;
        
        if (adminPassword !== process.env.ADMIN_PASSWORD) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        
        const result = await db.query(`
            SELECT * FROM fal_withdrawals 
            ORDER BY requested_at DESC
        `);
        
        res.json({ success: true, withdrawals: result.rows });
    } catch (error) {
        console.error('Error fetching FAL withdrawals:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch withdrawals' });
    }
});

app.get('/api/admin/trader-profits', (req, res) => {
    try {
        const { adminPassword } = req.query;
        
        if (adminPassword !== process.env.ADMIN_PASSWORD) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        
        const profiles = arbitrageSystem.getAllTraderProfiles();
        const stats = arbitrageSystem.getStats();
        
        res.json({ 
            success: true, 
            profiles,
            summary: {
                totalTraders: stats.totalTraders,
                totalProfitGenerated: stats.totalProfitGenerated,
                totalBonusesPaid: stats.totalBonusesPaid,
                totalLoans: stats.totalLoans
            }
        });
    } catch (error) {
        console.error('Error fetching trader profits:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch trader profits' });
    }
});

app.post('/api/admin/fal-withdrawal/process', async (req, res) => {
    try {
        const { adminPassword, requestId, action, notes } = req.body;
        
        if (adminPassword !== process.env.ADMIN_PASSWORD) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        
        if (!requestId || !action) {
            return res.status(400).json({ success: false, error: 'Missing requestId or action' });
        }
        
        if (action === 'approve') {
            const withdrawal = await db.query(
                'SELECT * FROM fal_withdrawals WHERE request_id = $1',
                [requestId]
            );
            
            if (withdrawal.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Withdrawal not found' });
            }
            
            const w = withdrawal.rows[0];
            
            let txHash = null;
            if (bscTokenTransfer) {
                try {
                    const txResult = await bscTokenTransfer.sendTokens(w.metamask_wallet, parseFloat(w.amount));
                    if (txResult.success) {
                        txHash = txResult.txHash;
                    }
                } catch (txError) {
                    console.error('BSC transfer error:', txError);
                }
            }
            
            await db.query(`
                UPDATE fal_withdrawals 
                SET status = 'completed', tx_hash = $1, admin_notes = $2, processed_at = NOW()
                WHERE request_id = $3
            `, [txHash, notes || 'Approved', requestId]);
            
            const trader = arbitrageSystem.getTraderProfile(w.simulator_wallet);
            if (trader) {
                const deductAmount = parseFloat(w.amount);
                if (trader.totalProfit >= deductAmount) {
                    trader.totalProfit -= deductAmount;
                } else {
                    const remaining = deductAmount - trader.totalProfit;
                    trader.totalProfit = 0;
                    trader.totalBonusEarned = Math.max(0, trader.totalBonusEarned - remaining);
                }
                arbitrageSystem.persistData();
            }
            
            console.log(`✅ FAL withdrawal approved: ${w.amount} KENO to ${w.metamask_wallet} (TX: ${txHash || 'pending'})`);
            
            res.json({ success: true, message: 'Withdrawal approved and processed', txHash });
        } else if (action === 'reject') {
            await db.query(`
                UPDATE fal_withdrawals 
                SET status = 'rejected', admin_notes = $1, processed_at = NOW()
                WHERE request_id = $2
            `, [notes || 'Rejected', requestId]);
            
            res.json({ success: true, message: 'Withdrawal rejected' });
        } else {
            res.status(400).json({ success: false, error: 'Invalid action' });
        }
    } catch (error) {
        console.error('Error processing FAL withdrawal:', error);
        res.status(500).json({ success: false, error: 'Failed to process withdrawal' });
    }
});

app.get('/api/arbitrage/export/:walletAddress', (req, res) => {
    try {
        const { walletAddress } = req.params;
        const profile = arbitrageSystem.getTraderProfile(walletAddress);
        if (!profile) {
            return res.status(404).json({ success: false, error: 'No trading profile found' });
        }
        const loans = arbitrageSystem.loanHistory.filter(
            l => l.walletAddress && l.walletAddress.toLowerCase() === walletAddress.toLowerCase()
        );
        const exportData = {
            exportDate: new Date().toISOString(),
            exportedFor: 'Bridge.xyz KYC / Source of Funds Documentation',
            platform: 'Kenostod Blockchain Academy',
            foundation: 'T.D.I.R. Foundation — Turn Dreams Into Reality',
            kenoContract: '0x65791E0B5Cbac5F40c76cDe31bf4F074D982FD0E',
            network: 'BNB Smart Chain (BSC)',
            activityType: 'Educational Flash Arbitrage Loan (FAL) simulation — utility token earnings',
            regulatory: {
                entityType: 'Wyoming LLC',
                fincenMSB: 'MRX26-00001866',
                tokenClassification: 'Utility token (not a security)'
            },
            traderProfile: {
                walletAddress: profile.walletAddress,
                reputationLevel: profile.reputationLevel,
                reputationScore: profile.reputationScore,
                totalLoans: profile.totalLoans,
                successfulLoans: profile.successfulLoans,
                defaultedLoans: profile.defaultedLoans,
                totalProfitKeno: profile.totalProfit,
                totalBonusKeno: profile.totalBonusEarned,
                availableBalanceKeno: profile.totalProfit + profile.totalBonusEarned,
                badges: profile.badges,
                joinedAt: new Date(profile.joinedAt).toISOString(),
                lastActivity: new Date(profile.lastActivity).toISOString()
            },
            loanHistory: loans.map(l => ({
                loanId: l.id,
                amount: l.amount,
                profit: l.profit || 0,
                status: l.status,
                purpose: l.purpose,
                createdAt: new Date(l.timestamp).toISOString(),
                repaidAt: l.repaidAt ? new Date(l.repaidAt).toISOString() : null
            })),
            summary: {
                totalLoansCount: loans.length,
                completedLoans: loans.filter(l => l.status === 'completed').length,
                defaultedLoans: loans.filter(l => l.status === 'defaulted').length,
                totalKenoEarned: profile.totalProfit + profile.totalBonusEarned,
                kenoValueUSD: `$${(profile.totalProfit + profile.totalBonusEarned).toFixed(2)} USD (at $1.00/KENO)`
            }
        };
        res.json({ success: true, export: exportData });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Export failed', details: error.message });
    }
});

app.get('/api/arbitrage/export/:walletAddress/csv', (req, res) => {
    try {
        const { walletAddress } = req.params;
        const profile = arbitrageSystem.getTraderProfile(walletAddress);
        if (!profile) {
            return res.status(404).json({ success: false, error: 'No trading profile found' });
        }
        const loans = arbitrageSystem.loanHistory.filter(
            l => l.walletAddress && l.walletAddress.toLowerCase() === walletAddress.toLowerCase()
        );
        const lines = [];
        lines.push('# KENOSTOD BLOCKCHAIN ACADEMY — FAL EARNINGS EXPORT');
        lines.push('# Generated: ' + new Date().toISOString());
        lines.push('# Purpose: Source of Funds Documentation for Bridge.xyz KYC');
        lines.push('# Foundation: T.D.I.R. Foundation — Turn Dreams Into Reality');
        lines.push('# KENO Token (BEP-20): 0x65791E0B5Cbac5F40c76cDe31bf4F074D982FD0E');
        lines.push('# FinCEN MSB: MRX26-00001866 | Wyoming LLC | Token Type: Utility (not security)');
        lines.push('# Activity Type: Educational Flash Arbitrage Loan simulation earnings');
        lines.push('#');
        lines.push('# ACCOUNT SUMMARY');
        lines.push(`Wallet Address,${walletAddress}`);
        lines.push(`Reputation Level,${profile.reputationLevel || 'beginner'}`);
        lines.push(`Total Loans,${profile.totalLoans}`);
        lines.push(`Successful Loans,${profile.successfulLoans}`);
        lines.push(`Total Profit (KENO),${(profile.totalProfit || 0).toFixed(2)}`);
        lines.push(`Total Bonus (KENO),${(profile.totalBonusEarned || 0).toFixed(2)}`);
        lines.push(`Available Balance (KENO),${((profile.totalProfit || 0) + (profile.totalBonusEarned || 0)).toFixed(2)}`);
        lines.push(`Estimated Value (USD @ $1.00/KENO),$${((profile.totalProfit || 0) + (profile.totalBonusEarned || 0)).toFixed(2)}`);
        lines.push(`Badges Earned,"${(profile.badges || []).join(', ')}"`);
        lines.push(`Account Created,${new Date(profile.joinedAt).toISOString()}`);
        lines.push(`Last Activity,${new Date(profile.lastActivity).toISOString()}`);
        lines.push('#');
        lines.push('# LOAN HISTORY');
        lines.push('Loan ID,Date,Amount (KENO),Profit (KENO),Status,Purpose,Repaid At');
        loans.forEach(l => {
            lines.push([
                l.id,
                new Date(l.timestamp).toISOString(),
                l.amount,
                (l.profit || 0).toFixed(2),
                l.status,
                `"${l.purpose || 'Arbitrage simulation'}"`,
                l.repaidAt ? new Date(l.repaidAt).toISOString() : 'N/A'
            ].join(','));
        });
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="FAL-earnings-${walletAddress.substring(0, 12)}-${Date.now()}.csv"`);
        res.send(lines.join('\n'));
    } catch (error) {
        res.status(500).json({ success: false, error: 'CSV export failed', details: error.message });
    }
});

// ==================== END KENO ARBITRAGE REVOLUTION API ENDPOINTS ====================

// ==================== LIVE ARB BOT API ENDPOINTS ====================

app.post('/api/live-arb/start', async (req, res) => {
    try {
        const result = await liveArbBot.start();
        res.json(result);
    } catch (e) {
        res.status(500).json({ ok: false, msg: e.message });
    }
});

app.post('/api/live-arb/stop', (req, res) => {
    res.json(liveArbBot.stop());
});

app.post('/api/live-arb/pause', (req, res) => {
    liveArbBot.pause();
    res.json({ ok: true });
});

app.post('/api/live-arb/resume', (req, res) => {
    liveArbBot.resume();
    res.json({ ok: true });
});

app.get('/api/live-arb/status', (req, res) => {
    res.json(liveArbBot.getStatus());
});

app.get('/api/live-arb/wallet', async (req, res) => {
    try {
        if (!liveArbBot.wallet) {
            return res.json({ address: process.env.NEW_WALLET_PRIVATE_KEY ? '(not connected)' : '(key not set)', bnb: '—', keno: '—' });
        }
        const info = await liveArbBot.getWalletInfo();
        res.json(info);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/live-arb/keno-volume', async (req, res) => {
    try {
        if (!liveArbBot.wallet) return res.status(400).json({ ok: false, msg: 'Bot not started' });
        liveArbBot.generateKenoVolume();
        res.json({ ok: true, msg: 'KENO volume trade triggered' });
    } catch (e) {
        res.status(500).json({ ok: false, msg: e.message });
    }
});

app.get('/api/live-arb/farm-status', async (req, res) => {
    try {
        const status = await liveArbBot.getFarmStatus();
        res.json(status);
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

app.post('/api/live-arb/farm-stake', async (req, res) => {
    try {
        const { amount } = req.body;
        const result = await liveArbBot.stakeLPTokens(amount || 'all');
        res.json(result);
    } catch (e) {
        res.status(500).json({ ok: false, msg: e.message });
    }
});

app.post('/api/live-arb/farm-harvest', async (req, res) => {
    try {
        const result = await liveArbBot.harvestFarm();
        res.json(result);
    } catch (e) {
        res.status(500).json({ ok: false, msg: e.message });
    }
});

app.post('/api/live-arb/farm-unstake', async (req, res) => {
    try {
        const { amount } = req.body;
        const result = await liveArbBot.unstakeLPTokens(amount || 'all');
        res.json(result);
    } catch (e) {
        res.status(500).json({ ok: false, msg: e.message });
    }
});

// ==================== END LIVE ARB BOT API ENDPOINTS ====================

// ==================== REAL ON-CHAIN FLASH ARB LOAN (FAL) API ENDPOINTS ====================
// FlashArbLoan contract: 0xE08eD19B34A3704ED7f7DD757027Ff4dd174474e on BSC
(function() {
    const { ethers } = require('ethers');
    const FAL_CONTRACT = '0xE08eD19B34A3704ED7f7DD757027Ff4dd174474e';
    const BSC_RPC = 'https://bsc-dataseed1.binance.org/';
    const PANCAKE_ROUTER = '0x10ED43C718714eb63d5aA57B78B54704E256024E';
    const BISWAP_ROUTER  = '0x3a6d8cA21D1CF76F653A67577FA0D27453350dD8';
    const WBNB = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';
    const USDT = '0x55d398326f99059fF775485246999027B3197955';

    const ROUTER_ABI = [
        'function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)'
    ];
    const FAL_ABI = [
        'function quoteArb(uint256 wbnbAmount) external view returns (uint256 usdtOut, uint256 wbnbBack, uint256 repayAmount, bool profitable)',
        'function executeFlashArb(uint256 wbnbAmount) external',
        'function totalProfitWBNB() view returns (uint256)',
        'function totalArbs() view returns (uint256)',
        'function paused() view returns (bool)',
        'function owner() view returns (address)'
    ];

    function getProvider() { return new ethers.JsonRpcProvider(BSC_RPC); }
    function getSigner() {
        const pk = process.env.NEW_WALLET_PRIVATE_KEY;
        if (!pk) throw new Error('NEW_WALLET_PRIVATE_KEY not set');
        return new ethers.Wallet(pk, getProvider());
    }

    // GET /api/fal/quote?amount=0.1   (amount in BNB)
    app.get('/api/fal/quote', async (req, res) => {
        try {
            const provider = getProvider();
            const bnbAmount = parseFloat(req.query.amount || '0.1');
            const wbnbWei = ethers.parseEther(String(bnbAmount));
            const fal = new ethers.Contract(FAL_CONTRACT, FAL_ABI, provider);
            const [usdtOut, wbnbBack, repayAmount, profitable] = await fal.quoteArb(wbnbWei);

            // Also get raw prices for the UI
            const pancake = new ethers.Contract(PANCAKE_ROUTER, ROUTER_ABI, provider);
            const biswap  = new ethers.Contract(BISWAP_ROUTER,  ROUTER_ABI, provider);
            const pathWU = [WBNB, USDT];
            const pathUW = [USDT, WBNB];
            const [, pancakeUSDT] = await pancake.getAmountsOut(wbnbWei, pathWU);
            const [, biswapUSDT]  = await biswap.getAmountsOut(wbnbWei, pathWU);

            const spread = Number(biswapUSDT - pancakeUSDT) * 100 / Number(pancakeUSDT);
            const profitWBNB = profitable ? Number(wbnbBack - repayAmount) / 1e18 : 0;
            const profitUSD  = profitWBNB * (Number(pancakeUSDT) / 1e18 / bnbAmount);

            res.json({
                ok: true,
                input: { bnbAmount },
                pancakeUSDT: (Number(pancakeUSDT) / 1e18).toFixed(4),
                biswapUSDT:  (Number(biswapUSDT)  / 1e18).toFixed(4),
                spreadPct:   spread.toFixed(4),
                repayWBNB:   (Number(repayAmount) / 1e18).toFixed(6),
                wbnbBack:    (Number(wbnbBack)    / 1e18).toFixed(6),
                profitWBNB:  profitWBNB.toFixed(6),
                profitUSD:   profitUSD.toFixed(4),
                profitable
            });
        } catch (e) {
            res.status(500).json({ ok: false, msg: e.message });
        }
    });

    // GET /api/fal/status
    app.get('/api/fal/status', async (req, res) => {
        try {
            const provider = getProvider();
            const fal = new ethers.Contract(FAL_CONTRACT, FAL_ABI, provider);
            const [totalProfit, totalArbs, paused, owner] = await Promise.all([
                fal.totalProfitWBNB(),
                fal.totalArbs(),
                fal.paused(),
                fal.owner()
            ]);
            res.json({
                ok: true,
                contract: FAL_CONTRACT,
                bscscan: `https://bscscan.com/address/${FAL_CONTRACT}`,
                totalProfitWBNB: (Number(totalProfit) / 1e18).toFixed(6),
                totalArbs: Number(totalArbs),
                paused,
                owner,
                network: 'BSC Mainnet'
            });
        } catch (e) {
            res.status(500).json({ ok: false, msg: e.message });
        }
    });

    // POST /api/fal/execute   { amount: "0.05" }  (BNB to borrow)
    app.post('/api/fal/execute', async (req, res) => {
        try {
            const signer = getSigner();
            const bnbAmount = parseFloat(req.body.amount || '0.05');
            if (bnbAmount < 0.01 || bnbAmount > 5) {
                return res.status(400).json({ ok: false, msg: 'Amount must be 0.01–5 BNB' });
            }
            const wbnbWei = ethers.parseEther(String(bnbAmount));

            // Pre-flight quote check
            const fal = new ethers.Contract(FAL_CONTRACT, FAL_ABI, signer);
            const [,, , profitable] = await fal.quoteArb(wbnbWei);
            if (!profitable) {
                return res.status(400).json({ ok: false, msg: 'Not profitable at current spread. Wait for a better opportunity.' });
            }

            // Execute on-chain
            const tx = await fal.executeFlashArb(wbnbWei, {
                gasPrice: ethers.parseUnits('3', 'gwei'),
                gasLimit: 500000
            });
            const receipt = await tx.wait();
            const success = receipt.status === 1;
            res.json({
                ok: success,
                txHash: tx.hash,
                bscscan: `https://bscscan.com/tx/${tx.hash}`,
                gasUsed: Number(receipt.gasUsed),
                msg: success ? 'Flash arb executed on-chain!' : 'Transaction reverted — spread closed before execution'
            });
        } catch (e) {
            res.status(500).json({ ok: false, msg: e.message });
        }
    });
})();
// ==================== END REAL FAL API ENDPOINTS ====================

// ==================== FLASH ARBITRAGE LOAN POOLS (FALP) API ENDPOINTS ====================

app.post('/api/fal-pool/create', (req, res) => {
    try {
        const { walletAddress, poolName, riskLevel, lockPeriod, initialDeposit } = req.body;
        
        if (!walletAddress || !poolName) {
            return res.status(400).json({ 
                success: false, 
                error: 'Wallet address and pool name are required' 
            });
        }
        
        const result = falPoolManager.createPool(
            walletAddress,
            poolName,
            riskLevel || 'balanced',
            lockPeriod || 'flexible',
            parseFloat(initialDeposit) || 0
        );
        
        res.json(result);
    } catch (error) {
        console.error('Pool creation error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to create pool',
            details: error.message 
        });
    }
});

app.post('/api/fal-pool/deposit', (req, res) => {
    try {
        const { poolId, walletAddress, amount, lockPeriod } = req.body;
        
        if (!poolId || !walletAddress || !amount) {
            return res.status(400).json({ 
                success: false, 
                error: 'Pool ID, wallet address, and amount are required' 
            });
        }
        
        const result = falPoolManager.depositToPool(
            poolId,
            walletAddress,
            parseFloat(amount),
            lockPeriod
        );
        
        res.json(result);
    } catch (error) {
        console.error('Pool deposit error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to deposit to pool',
            details: error.message 
        });
    }
});

app.post('/api/fal-pool/withdraw', (req, res) => {
    try {
        const { contributionId, walletAddress, amount } = req.body;
        
        if (!contributionId || !walletAddress) {
            return res.status(400).json({ 
                success: false, 
                error: 'Contribution ID and wallet address are required' 
            });
        }
        
        const result = falPoolManager.withdrawFromPool(
            contributionId,
            walletAddress,
            amount ? parseFloat(amount) : null
        );
        
        res.json(result);
    } catch (error) {
        console.error('Pool withdrawal error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to withdraw from pool',
            details: error.message 
        });
    }
});

app.post('/api/fal-pool/borrow', (req, res) => {
    try {
        const { poolId, walletAddress, amount, arbitrageOpportunityId } = req.body;
        
        if (!poolId || !walletAddress || !amount) {
            return res.status(400).json({ 
                success: false, 
                error: 'Pool ID, wallet address, and amount are required' 
            });
        }
        
        const result = falPoolManager.borrowFromPool(
            poolId,
            walletAddress,
            parseFloat(amount),
            arbitrageOpportunityId
        );
        
        res.json(result);
    } catch (error) {
        console.error('Pool borrow error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to borrow from pool',
            details: error.message 
        });
    }
});

app.post('/api/fal-pool/repay', (req, res) => {
    try {
        const { loanId, walletAddress, profit } = req.body;
        
        if (!loanId || !walletAddress) {
            return res.status(400).json({ 
                success: false, 
                error: 'Loan ID and wallet address are required' 
            });
        }
        
        const result = falPoolManager.repayPoolLoan(
            loanId,
            walletAddress,
            parseFloat(profit) || 0
        );
        
        res.json(result);
    } catch (error) {
        console.error('Pool loan repayment error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to repay pool loan',
            details: error.message 
        });
    }
});

app.get('/api/fal-pool/list', (req, res) => {
    try {
        const pools = falPoolManager.getAllPools();
        res.json({ 
            success: true, 
            pools,
            count: pools.length 
        });
    } catch (error) {
        console.error('Pool list fetch error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch pools',
            details: error.message 
        });
    }
});

app.get('/api/fal-pool/leaderboard', (req, res) => {
    try {
        const leaderboard = falPoolManager.getPoolLeaderboard();
        res.json({ 
            success: true, 
            leaderboard,
            count: leaderboard.length 
        });
    } catch (error) {
        console.error('Pool leaderboard fetch error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch leaderboard',
            details: error.message 
        });
    }
});

app.get('/api/fal-pool/treasury', (req, res) => {
    try {
        const stats = falPoolManager.getTreasuryStats();
        res.json({ success: true, treasury: stats });
    } catch (error) {
        console.error('Treasury stats error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch treasury stats', details: error.message });
    }
});

app.get('/api/fal-pool/:poolId', (req, res) => {
    try {
        const { poolId } = req.params;
        const pool = falPoolManager.getPoolStats(poolId);
        
        if (!pool) {
            return res.status(404).json({ 
                success: false, 
                error: 'Pool not found' 
            });
        }
        
        res.json({ 
            success: true, 
            pool 
        });
    } catch (error) {
        console.error('Pool fetch error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch pool details',
            details: error.message 
        });
    }
});

app.get('/api/fal-pool/contributor/:walletAddress', (req, res) => {
    try {
        const { walletAddress } = req.params;
        const stats = falPoolManager.getContributorStats(walletAddress);
        
        res.json({ 
            success: true, 
            ...stats 
        });
    } catch (error) {
        console.error('Contributor stats fetch error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch contributor stats',
            details: error.message 
        });
    }
});

// ==================== END FLASH ARBITRAGE LOAN POOLS API ENDPOINTS ====================

// ==================== T.D.I.R. FOUNDATION DISTRIBUTION PROTOCOL ====================

const foundationGrantsFile = 'foundation_grants.json';

function loadFoundationGrants() {
    try {
        const fs = require('fs');
        if (fs.existsSync(foundationGrantsFile)) {
            return JSON.parse(fs.readFileSync(foundationGrantsFile, 'utf8'));
        }
    } catch (e) {}
    return [];
}

function saveFoundationGrants(grants) {
    const fs = require('fs');
    fs.writeFileSync(foundationGrantsFile, JSON.stringify(grants, null, 2));
}

app.post('/api/foundation/grant-request', (req, res) => {
    try {
        const { simulatorWallet, bscWallet, amount, activityType, notes } = req.body;
        if (!simulatorWallet || !bscWallet || !amount) {
            return res.status(400).json({ success: false, error: 'simulatorWallet, bscWallet, and amount are required' });
        }
        if (!bscWallet.startsWith('0x') || bscWallet.length !== 42) {
            return res.status(400).json({ success: false, error: 'Invalid BSC wallet address' });
        }
        const profile = arbitrageSystem.getTraderProfile(simulatorWallet);
        if (!profile) {
            return res.status(400).json({ success: false, error: 'No FAL trading profile found for this wallet' });
        }
        const availableBalance = (profile.totalProfit || 0) + (profile.totalBonusEarned || 0);
        if (amount > availableBalance) {
            return res.status(400).json({
                success: false,
                error: `Insufficient balance. Available: ${availableBalance.toFixed(2)} KENO`
            });
        }
        const grants = loadFoundationGrants();
        const grantId = 'TDIR-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
        const grant = {
            grantId,
            grantee: simulatorWallet,
            destinationWallet: bscWallet.toLowerCase(),
            amountKeno: amount,
            estimatedValueUSD: amount.toFixed(2),
            activityType: activityType || 'FAL educational simulation earnings',
            reputationLevel: profile.reputationLevel || 'beginner',
            totalLoansCompleted: profile.successfulLoans || 0,
            badges: profile.badges || [],
            status: 'pending_distribution',
            requestedAt: new Date().toISOString(),
            notes: notes || '',
            documentation: {
                platform: 'Kenostod Blockchain Academy',
                foundation: 'T.D.I.R. Foundation — Turn Dreams Into Reality',
                tokenType: 'KENO (BEP-20) — Utility Token (not a security)',
                kenoContract: '0x65791E0B5Cbac5F40c76cDe31bf4F074D982FD0E',
                network: 'BNB Smart Chain (BSC)',
                entityType: 'Wyoming LLC',
                fincenMSB: 'MRX26-00001866',
                distributionChain: 'Platform Treasury → T.D.I.R. Foundation → Grantee BSC Wallet → Bridge.xyz → USDK'
            }
        };
        grants.push(grant);
        saveFoundationGrants(grants);
        console.log(`🏛️ Foundation grant request: ${amount} KENO — ${grantId}`);
        res.json({
            success: true,
            grantId,
            message: `Foundation grant request submitted. ${amount.toFixed ? amount.toFixed(2) : amount} KENO will be distributed to ${bscWallet} from the T.D.I.R. Foundation treasury.`,
            nextStep: 'After receiving KENO on BSC, go to Bridge.xyz to convert to USDK.',
            distributionChain: 'Platform Treasury → T.D.I.R. Foundation → Your BSC Wallet → Bridge.xyz'
        });
    } catch (error) {
        console.error('Foundation grant error:', error);
        res.status(500).json({ success: false, error: 'Grant request failed', details: error.message });
    }
});

app.get('/api/foundation/grants', (req, res) => {
    try {
        const { adminPassword } = req.query;
        if (adminPassword !== process.env.ADMIN_PASSWORD) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        const grants = loadFoundationGrants();
        const totalPending = grants.filter(g => g.status === 'pending_distribution').reduce((s, g) => s + g.amountKeno, 0);
        const totalDistributed = grants.filter(g => g.status === 'distributed').reduce((s, g) => s + g.amountKeno, 0);
        res.json({ success: true, grants, summary: { totalGrants: grants.length, totalPendingKeno: totalPending, totalDistributedKeno: totalDistributed } });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to fetch grants' });
    }
});

app.post('/api/foundation/grant-approve', async (req, res) => {
    try {
        const { adminPassword, grantId } = req.body;
        if (adminPassword !== process.env.ADMIN_PASSWORD) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        const grants = loadFoundationGrants();
        const grant = grants.find(g => g.grantId === grantId);
        if (!grant) return res.status(404).json({ success: false, error: 'Grant not found' });
        if (grant.status === 'distributed') {
            return res.status(400).json({ success: false, error: 'Grant already distributed' });
        }

        // Check BSC transfer is available
        if (!bscTokenTransfer || !bscTokenTransfer.initialized) {
            return res.status(503).json({ success: false, error: 'BSC transfer not initialized. Check KENO_DISTRIBUTION_WALLET_KEY.' });
        }

        // Fire real on-chain KENO transfer
        console.log(`🏛️ Foundation executing grant ${grantId}: ${grant.amountKeno} KENO → ${grant.destinationWallet}`);
        const transferResult = await bscTokenTransfer.transferTokens(
            grant.destinationWallet,
            grant.amountKeno,
            grantId
        );

        if (!transferResult.success) {
            return res.status(500).json({
                success: false,
                error: `On-chain transfer failed: ${transferResult.error}`,
                grantId
            });
        }

        // Mark grant as distributed with real tx hash
        grant.status = 'distributed';
        grant.distributedAt = new Date().toISOString();
        grant.txHash = transferResult.txHash;
        grant.blockNumber = transferResult.blockNumber;
        grant.gasUsed = transferResult.gasUsed;
        saveFoundationGrants(grants);

        // Deduct from trader profile balance
        const profile = arbitrageSystem.getTraderProfile(grant.grantee);
        if (profile) {
            const deductFromBonus = Math.min(grant.amountKeno, profile.totalBonusEarned || 0);
            const deductFromProfit = grant.amountKeno - deductFromBonus;
            profile.totalBonusEarned = Math.max(0, (profile.totalBonusEarned || 0) - deductFromBonus);
            profile.totalProfit = Math.max(0, (profile.totalProfit || 0) - deductFromProfit);
            arbitrageSystem.persistData();
        }

        console.log(`✅ Foundation grant distributed: ${grant.amountKeno} KENO → ${grant.destinationWallet} | TX: ${transferResult.txHash}`);
        res.json({
            success: true,
            message: `Grant distributed! ${grant.amountKeno} KENO sent to ${grant.destinationWallet}`,
            grantId,
            txHash: transferResult.txHash,
            bscscanUrl: `https://bscscan.com/tx/${transferResult.txHash}`,
            grant
        });
    } catch (error) {
        console.error('Foundation grant approve error:', error);
        res.status(500).json({ success: false, error: 'Failed to approve grant', details: error.message });
    }
});

app.get('/api/foundation/my-grants/:walletAddress', (req, res) => {
    try {
        const { walletAddress } = req.params;
        const grants = loadFoundationGrants().filter(
            g => g.grantee.toLowerCase() === walletAddress.toLowerCase() ||
                 g.destinationWallet.toLowerCase() === walletAddress.toLowerCase()
        );
        res.json({ success: true, grants, totalKeno: grants.reduce((s, g) => s + g.amountKeno, 0) });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to fetch grants' });
    }
});

// ==================== END T.D.I.R. FOUNDATION DISTRIBUTION PROTOCOL ====================

// ==================== ICO INVESTOR DASHBOARD API ENDPOINTS ====================

app.get('/api/ico/investor-stats', async (req, res) => {
    try {
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        const stats = await dbConnection.query(
            'SELECT * FROM investment_statistics WHERE stat_date = CURRENT_DATE LIMIT 1'
        );

        const investors = await dbConnection.query(
            'SELECT COUNT(*) as total FROM ico_investors'
        );

        const raised = await dbConnection.query(
            'SELECT SUM(investment_amount_usd) as total FROM ico_investors'
        );

        const tokens = await dbConnection.query(
            'SELECT SUM(tokens_purchased + COALESCE(bonus_tokens, 0)) as total FROM ico_investors'
        );

        const investors24h = await dbConnection.query(
            'SELECT COUNT(*) as count FROM ico_investors WHERE created_at >= NOW() - INTERVAL \'24 hours\''
        );

        const raised24h = await dbConnection.query(
            'SELECT SUM(investment_amount_usd) as amount FROM ico_investors WHERE created_at >= NOW() - INTERVAL \'24 hours\''
        );

        const recentInvestments = await dbConnection.query(
            'SELECT investment_amount_usd as amount, tokens_purchased as tokens, sale_phase as type, created_at as timestamp FROM ico_investors ORDER BY created_at DESC LIMIT 10'
        );

        const kycVerified = await dbConnection.query(
            'SELECT COUNT(*) as count FROM kyc_verifications WHERE verification_status = \'verified\''
        );

        const totalRaised = parseFloat(raised.rows[0]?.total || 0);
        const totalInvestors = parseInt(investors.rows[0]?.total || 0);
        const tokensSold = parseFloat(tokens.rows[0]?.total || 0);
        const investors24hCount = parseInt(investors24h.rows[0]?.count || 0);
        const raised24hAmount = parseFloat(raised24h.rows[0]?.amount || 0);

        const privateSaleDate = new Date('2025-11-28T00:00:00Z');
        const dexListingDate = new Date('2025-12-29T00:00:00Z');
        const now = new Date();
        
        // Price phases: Upcoming -> Private ($0.01) -> DEX Listed ($1.00)
        let currentPhase = 'upcoming';
        let currentPrice = 0.01;
        
        if (now >= dexListingDate) {
            currentPhase = 'dex_listed';
            currentPrice = 1.00;
        } else if (now >= privateSaleDate) {
            currentPhase = 'private';
            currentPrice = 0.01;
        }

        const raised24hPercent = totalRaised > 0 ? ((raised24hAmount / totalRaised) * 100).toFixed(2) : 0;

        res.json({
            totalRaised: totalRaised,
            totalInvestors: totalInvestors,
            tokensSold: tokensSold,
            currentPrice: currentPrice,
            goal: 500000,
            raised24h: raised24hPercent,
            investors24h: investors24hCount,
            circulatingSupply: tokensSold,
            holders: totalInvestors,
            transactions24h: investors24hCount,
            recentInvestments: recentInvestments.rows.map(inv => ({
                amount: parseFloat(inv.amount),
                tokens: parseFloat(inv.tokens),
                type: inv.type === 'private' ? 'Private Sale' : 'Public Sale',
                timestamp: inv.timestamp
            }))
        });
    } catch (error) {
        console.error('Error fetching investor stats:', error);
        res.json({
            totalRaised: 0,
            totalInvestors: 0,
            tokensSold: 0,
            currentPrice: 0.01,
            goal: 500000,
            raised24h: 0,
            investors24h: 0,
            circulatingSupply: 0,
            holders: 0,
            transactions24h: 0,
            recentInvestments: []
        });
    }
});

app.post('/api/ico/record-investment', async (req, res) => {
    try {
        const {
            walletAddress,
            email,
            investmentAmount,
            tokensPurchased,
            tokenPrice,
            paymentMethod,
            transactionHash,
            salePhase,
            bonusPercentage,
            bonusTokens,
            referralCode
        } = req.body;

        if (!walletAddress || !investmentAmount || !tokensPurchased) {
            return res.status(400).json({ 
                success: false, 
                error: 'Missing required fields' 
            });
        }

        const investorId = `INV-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        await dbConnection.query(
            `INSERT INTO ico_investors (
                investor_id, wallet_address, email, investment_amount_usd, 
                tokens_purchased, token_price_usd, payment_method, transaction_hash,
                sale_phase, bonus_percentage, bonus_tokens, referral_code, ip_address
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
            [
                investorId,
                walletAddress,
                email,
                investmentAmount,
                tokensPurchased,
                tokenPrice,
                paymentMethod || 'crypto',
                transactionHash || null,
                salePhase || 'private',
                bonusPercentage || 20,
                bonusTokens || 0,
                referralCode || null,
                req.ip
            ]
        );

        await dbConnection.query(
            `INSERT INTO investment_statistics (
                stat_date, total_raised_usd, total_investors, total_tokens_sold
            ) VALUES (CURRENT_DATE, $1, 1, $2)
            ON CONFLICT (stat_date) DO UPDATE SET
                total_raised_usd = investment_statistics.total_raised_usd + $1,
                total_investors = investment_statistics.total_investors + 1,
                total_tokens_sold = investment_statistics.total_tokens_sold + $2,
                updated_at = CURRENT_TIMESTAMP`,
            [investmentAmount, tokensPurchased]
        );

        res.json({ 
            success: true, 
            investorId,
            message: 'Investment recorded successfully' 
        });
    } catch (error) {
        console.error('Error recording investment:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to record investment',
            details: error.message 
        });
    }
});

app.post('/api/ico/kyc/submit', async (req, res) => {
    try {
        const {
            walletAddress,
            email,
            fullName,
            dateOfBirth,
            nationality,
            countryOfResidence,
            addressLine1,
            addressLine2,
            city,
            stateProvince,
            postalCode,
            phoneNumber,
            governmentIdType,
            governmentIdNumber
        } = req.body;

        if (!walletAddress || !email || !fullName) {
            return res.status(400).json({ 
                success: false, 
                error: 'Missing required KYC fields' 
            });
        }

        const verificationId = `KYC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        await dbConnection.query(
            `INSERT INTO kyc_verifications (
                verification_id, wallet_address, email, full_name, date_of_birth,
                nationality, country_of_residence, address_line1, address_line2,
                city, state_province, postal_code, phone_number,
                government_id_type, government_id_number, verification_status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
            [
                verificationId,
                walletAddress,
                email,
                fullName,
                dateOfBirth || null,
                nationality || null,
                countryOfResidence || null,
                addressLine1 || null,
                addressLine2 || null,
                city || null,
                stateProvince || null,
                postalCode || null,
                phoneNumber || null,
                governmentIdType || null,
                governmentIdNumber || null,
                'pending'
            ]
        );

        res.json({ 
            success: true, 
            verificationId,
            message: 'KYC verification submitted. Our team will review within 24 hours.' 
        });
    } catch (error) {
        console.error('Error submitting KYC:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to submit KYC verification',
            details: error.message 
        });
    }
});

app.get('/api/ico/kyc/status/:walletAddress', async (req, res) => {
    try {
        const { walletAddress } = req.params;

        const result = await dbConnection.query(
            'SELECT verification_status, verified_at, rejected_reason FROM kyc_verifications WHERE wallet_address = $1 ORDER BY created_at DESC LIMIT 1',
            [walletAddress]
        );

        if (result.rows.length === 0) {
            return res.json({ 
                status: 'not_submitted',
                message: 'No KYC verification found for this wallet' 
            });
        }

        const kyc = result.rows[0];
        res.json({ 
            status: kyc.verification_status,
            verifiedAt: kyc.verified_at,
            rejectedReason: kyc.rejected_reason 
        });
    } catch (error) {
        console.error('Error fetching KYC status:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch KYC status' 
        });
    }
});

// ==================== END ICO INVESTOR DASHBOARD API ENDPOINTS ====================

// ==================== MICRO-MONETIZATION API ENDPOINTS ====================

app.get('/api/monetization/fees', (req, res) => {
    if (!microMonetization) {
        return res.status(503).json({ error: 'System initializing' });
    }
    res.json({
        fees: microMonetization.getFees(),
        membershipTiers: microMonetization.getMembershipTiers()
    });
});

app.get('/api/monetization/stats', (req, res) => {
    if (!microMonetization) {
        return res.status(503).json({ error: 'System initializing' });
    }
    res.json(microMonetization.getRevenueStats());
});

app.get('/api/monetization/membership/:walletAddress', (req, res) => {
    if (!microMonetization) {
        return res.status(503).json({ error: 'System initializing' });
    }
    const { walletAddress } = req.params;
    const membership = microMonetization.getUserMembership(walletAddress);
    const benefits = microMonetization.getMembershipBenefits(walletAddress);
    res.json({ membership, benefits });
});

app.post('/api/monetization/membership/purchase', async (req, res) => {
    if (!microMonetization) {
        return res.status(503).json({ error: 'System initializing' });
    }
    const { walletAddress, privateKey, tier, billingCycle } = req.body;
    
    if (!walletAddress || !privateKey || !tier) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const result = await microMonetization.purchaseMembership(walletAddress, privateKey, tier, billingCycle || 'monthly');
    res.json(result);
});

app.post('/api/monetization/ai-chat/check', (req, res) => {
    if (!microMonetization) {
        return res.status(503).json({ error: 'System initializing' });
    }
    const { walletAddress, questionType } = req.body;
    const access = microMonetization.checkAiChatAccess(walletAddress || 'anonymous', questionType || 'basic');
    res.json(access);
});

app.post('/api/monetization/ai-chat/charge', async (req, res) => {
    if (!microMonetization) {
        return res.status(503).json({ error: 'System initializing' });
    }
    const { walletAddress, privateKey, questionType } = req.body;
    
    if (!walletAddress) {
        return res.json({ success: true, charged: false, message: 'Anonymous user - free basic access' });
    }
    
    const result = await microMonetization.chargeAiChat(walletAddress, privateKey, questionType || 'basic');
    res.json(result);
});

app.post('/api/monetization/quiz-retake', async (req, res) => {
    if (!microMonetization) {
        return res.status(503).json({ error: 'System initializing' });
    }
    const { walletAddress, privateKey, courseId } = req.body;
    
    if (!walletAddress || !privateKey || !courseId) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const result = await microMonetization.chargeQuizRetake(walletAddress, privateKey, courseId);
    res.json(result);
});

app.post('/api/monetization/feature-post', async (req, res) => {
    if (!microMonetization) {
        return res.status(503).json({ error: 'System initializing' });
    }
    const { walletAddress, privateKey, postId, topic } = req.body;
    
    if (!walletAddress || !privateKey || !postId) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const result = await microMonetization.featurePost(walletAddress, privateKey, postId, topic);
    res.json(result);
});

app.get('/api/monetization/featured-posts', (req, res) => {
    if (!microMonetization) {
        return res.status(503).json({ error: 'System initializing' });
    }
    const { topic } = req.query;
    const posts = microMonetization.getFeaturedPosts(topic);
    res.json({ featuredPosts: posts });
});

app.post('/api/monetization/pool-create-fee', async (req, res) => {
    if (!microMonetization) {
        return res.status(503).json({ error: 'System initializing' });
    }
    const { walletAddress, privateKey, poolName } = req.body;
    
    if (!walletAddress || !privateKey || !poolName) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const result = await microMonetization.chargePoolCreation(walletAddress, privateKey, poolName);
    res.json(result);
});

app.post('/api/monetization/pool-boost', async (req, res) => {
    if (!microMonetization) {
        return res.status(503).json({ error: 'System initializing' });
    }
    const { walletAddress, privateKey, poolId, days } = req.body;
    
    if (!walletAddress || !privateKey || !poolId) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const result = await microMonetization.boostPool(walletAddress, privateKey, poolId, days || 1);
    res.json(result);
});

app.get('/api/monetization/boosted-pools', (req, res) => {
    if (!microMonetization) {
        return res.status(503).json({ error: 'System initializing' });
    }
    const pools = microMonetization.getBoostedPools();
    res.json({ boostedPools: pools });
});

app.post('/api/monetization/tip', async (req, res) => {
    if (!microMonetization) {
        return res.status(503).json({ error: 'System initializing' });
    }
    const { fromWallet, privateKey, toWallet, amount, message } = req.body;
    
    if (!fromWallet || !privateKey || !toWallet || !amount) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const result = await microMonetization.processTip(fromWallet, privateKey, toWallet, amount, message);
    res.json(result);
});

app.post('/api/monetization/arbitrage-alert', async (req, res) => {
    if (!microMonetization) {
        return res.status(503).json({ error: 'System initializing' });
    }
    const { walletAddress, privateKey } = req.body;
    
    if (!walletAddress) {
        return res.json({ success: false, error: 'Wallet address required for alerts' });
    }
    
    const result = await microMonetization.chargeArbitrageAlert(walletAddress, privateKey);
    res.json(result);
});

app.post('/api/monetization/mint-badge', async (req, res) => {
    if (!microMonetization) {
        return res.status(503).json({ error: 'System initializing' });
    }
    const { walletAddress, privateKey, badgeType, badgeName } = req.body;
    
    if (!walletAddress || !privateKey || !badgeType || !badgeName) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const result = await microMonetization.mintBadge(walletAddress, privateKey, badgeType, badgeName);
    res.json(result);
});

// ==================== END MICRO-MONETIZATION API ENDPOINTS ====================

// ==================== ADMIN BACK OFFICE API ENDPOINTS ====================

// Unified admin auth - uses x-admin-password header
function requireAdminAuth(req, res, next) {
    const adminPassword = process.env.ADMIN_PASSWORD;
    const providedPassword = req.headers['x-admin-password'];

    if (!adminPassword) {
        return res.status(500).json({ success: false, error: 'Server configuration error' });
    }

    if (providedPassword === adminPassword) {
        next();
    } else {
        res.status(401).json({ success: false, error: 'Unauthorized' });
    }
}

// Admin authentication endpoint - verifies password
app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminPassword) {
        console.error('ADMIN_PASSWORD not configured');
        return res.status(500).json({ error: 'Server configuration error' });
    }

    // Debug: Log password lengths (not the actual passwords)
    console.log(`Admin login attempt: provided=${password?.length || 0} chars, expected=${adminPassword?.length || 0} chars`);

    if (password && password === adminPassword) {
        console.log('Admin login successful');
        res.json({ success: true });
    } else {
        console.log('Admin login failed - password mismatch');
        res.status(401).json({ success: false, error: 'Invalid password' });
    }
});

app.get('/api/admin/dashboard', requireAdminAuth, async (req, res) => {
    try {
        if (!dbConnection) {
            return res.status(503).json({ success: false, error: 'Database not ready' });
        }
        
        const stats = {};
        
        const studentsResult = await dbConnection.query(`
            SELECT COUNT(DISTINCT user_wallet_address) as count 
            FROM student_rewards
        `);
        stats.totalStudents = parseInt(studentsResult.rows[0]?.count || 0);
        
        const completionsResult = await dbConnection.query(`
            SELECT COUNT(*) as count 
            FROM student_rewards 
            WHERE reward_type = 'course_completion'
        `);
        stats.courseCompletions = parseInt(completionsResult.rows[0]?.count || 0);
        
        const kenoResult = await dbConnection.query(`
            SELECT COALESCE(SUM(reward_amount), 0) as total 
            FROM student_rewards
        `);
        stats.kenoDistributed = parseFloat(kenoResult.rows[0]?.total || 0);
        
        const graduatesResult = await dbConnection.query(`
            SELECT COUNT(*) as count 
            FROM kenostod_graduates
        `);
        stats.totalGraduates = parseInt(graduatesResult.rows[0]?.count || 0);
        
        const icoResult = await dbConnection.query(`
            SELECT COALESCE(SUM(investment_amount_usd), 0) as total 
            FROM ico_investors
        `);
        stats.icoRaised = parseFloat(icoResult.rows[0]?.total || 0);
        
        const rvtResult = await dbConnection.query(`
            SELECT COUNT(*) as count 
            FROM rvt_nft_distributions
        `);
        stats.rvtNftsIssued = parseInt(rvtResult.rows[0]?.count || 0);
        
        const courseStatsResult = await dbConnection.query(`
            SELECT course_id, COUNT(*) as count 
            FROM student_rewards 
            WHERE reward_type = 'course_completion' AND course_id IS NOT NULL
            GROUP BY course_id 
            ORDER BY course_id
        `);
        const courseStats = courseStatsResult.rows;
        
        const studentsQuery = await dbConnection.query(`
            SELECT 
                sr.user_wallet_address as wallet_address,
                COALESCE(s.name, MAX(sr.user_email)) as name,
                COALESCE(s.email, MAX(sr.user_email)) as email,
                COUNT(DISTINCT CASE WHEN sr.reward_type = 'course_completion' THEN sr.course_id END) as courses_completed,
                COALESCE(SUM(sr.reward_amount), 0) as total_keno,
                MIN(sr.created_at) as first_activity,
                s.created_at as enrolled_at
            FROM student_rewards sr
            LEFT JOIN students s ON LOWER(sr.user_wallet_address) = LOWER(s.wallet_address)
            GROUP BY sr.user_wallet_address, s.name, s.email, s.created_at
            ORDER BY first_activity DESC
            LIMIT 100
        `);
        const students = studentsQuery.rows;
        
        for (let student of students) {
            const rvtCount = await dbConnection.query(`
                SELECT COUNT(*) as count FROM rvt_nft_distributions 
                WHERE recipient_wallet = $1
            `, [student.wallet_address]);
            student.rvt_count = parseInt(rvtCount.rows[0]?.count || 0);
        }
        
        const courseProgressResult = await dbConnection.query(`
            SELECT * FROM course_progress 
            ORDER BY updated_at DESC 
            LIMIT 100
        `);
        const courseProgress = courseProgressResult.rows;
        
        const rewardsResult = await dbConnection.query(`
            SELECT * FROM student_rewards 
            ORDER BY created_at DESC 
            LIMIT 100
        `);
        const rewards = rewardsResult.rows;
        
        const graduatesQuery = await dbConnection.query(`
            SELECT 
                user_wallet_address as wallet_address,
                MAX(user_email) as email,
                COUNT(*) as courses_count,
                COALESCE(SUM(reward_amount), 0) as total_keno,
                MAX(created_at) as graduated_at
            FROM student_rewards
            WHERE reward_type = 'course_completion'
            GROUP BY user_wallet_address
            HAVING COUNT(*) >= 21
            ORDER BY graduated_at DESC
        `);
        const graduates = graduatesQuery.rows;
        
        for (let grad of graduates) {
            const rvtTier = await dbConnection.query(`
                SELECT nft_type FROM rvt_nft_distributions 
                WHERE recipient_wallet = $1 
                ORDER BY distributed_at DESC LIMIT 1
            `, [grad.wallet_address]);
            grad.rvt_tier = rvtTier.rows[0]?.nft_type || 'Platinum';
        }
        
        const investorsResult = await dbConnection.query(`
            SELECT * FROM ico_investors 
            ORDER BY created_at DESC 
            LIMIT 100
        `);
        const investors = investorsResult.rows;
        
        const referralsResult = await dbConnection.query(`
            SELECT * FROM referrals 
            ORDER BY created_at DESC 
            LIMIT 100
        `);
        const referrals = referralsResult.rows;
        
        const recentActivityResult = await dbConnection.query(`
            SELECT * FROM student_rewards 
            ORDER BY created_at DESC 
            LIMIT 20
        `);
        const recentActivity = recentActivityResult.rows;
        
        res.json({
            success: true,
            data: {
                stats,
                courseStats,
                students,
                courseProgress,
                rewards,
                graduates,
                investors,
                referrals,
                recentActivity
            }
        });
        
    } catch (error) {
        console.error('❌ Admin dashboard error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/admin/student/:walletAddress', requireAdminAuth, async (req, res) => {
    try {
        if (!dbConnection) {
            return res.status(503).json({ success: false, error: 'Database not ready' });
        }
        
        const { walletAddress } = req.params;
        
        const rewards = await dbConnection.query(`
            SELECT * FROM student_rewards 
            WHERE user_wallet_address = $1 
            ORDER BY created_at DESC
        `, [walletAddress]);
        
        const progress = await dbConnection.query(`
            SELECT * FROM course_progress 
            WHERE user_wallet_address = $1 
            ORDER BY course_id
        `, [walletAddress]);
        
        const rvtNfts = await dbConnection.query(`
            SELECT * FROM rvt_nft_distributions 
            WHERE recipient_wallet = $1
        `, [walletAddress]);
        
        const wealthSnapshot = await dbConnection.query(`
            SELECT * FROM wealth_snapshots 
            WHERE user_wallet = $1 
            ORDER BY created_at DESC 
            LIMIT 1
        `, [walletAddress]);
        
        res.json({
            success: true,
            data: {
                rewards: rewards.rows,
                progress: progress.rows,
                rvtNfts: rvtNfts.rows,
                wealthSnapshot: wealthSnapshot.rows[0] || null
            }
        });
        
    } catch (error) {
        console.error('❌ Student detail error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== END ADMIN BACK OFFICE API ENDPOINTS ====================

// ==================== MERCURY BANK USD CASHOUT ENDPOINTS ====================

mercuryBankAPI = new MercuryBankAPI();

app.post('/api/bank-details/save', async (req, res) => {
    try {
        const { email, walletAddress, bankName, accountHolderName, routingNumber, accountNumber, accountType } = req.body;
        
        if (!email || !bankName || !accountHolderName || !routingNumber || !accountNumber) {
            return res.status(400).json({ success: false, error: 'Missing required bank details' });
        }
        
        if (!/^\d{9}$/.test(routingNumber)) {
            return res.status(400).json({ success: false, error: 'Invalid routing number (must be 9 digits)' });
        }
        
        if (!/^\d{4,17}$/.test(accountNumber)) {
            return res.status(400).json({ success: false, error: 'Invalid account number' });
        }
        
        const encryptedAccount = mercuryBankAPI.encryptAccountNumber(accountNumber);
        
        await dbConnection.query(`
            INSERT INTO student_bank_details (email, wallet_address, bank_name, account_holder_name, routing_number, account_number_encrypted, account_type)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (email) 
            DO UPDATE SET bank_name = $3, account_holder_name = $4, routing_number = $5, account_number_encrypted = $6, account_type = $7, updated_at = CURRENT_TIMESTAMP
        `, [email.toLowerCase(), walletAddress?.toLowerCase(), bankName, accountHolderName, routingNumber, encryptedAccount, accountType || 'checking']);
        
        console.log(`🏦 Bank details saved for: ${email}`);
        res.json({ success: true, message: 'Bank details saved securely' });
    } catch (error) {
        console.error('Bank details save error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/bank-details/check', async (req, res) => {
    try {
        const { email } = req.query;
        if (!email) {
            return res.status(400).json({ success: false, error: 'Email required' });
        }
        
        const result = await dbConnection.query(
            'SELECT bank_name, account_holder_name, routing_number, account_type FROM student_bank_details WHERE email = $1',
            [email.toLowerCase()]
        );
        
        if (result.rows.length > 0) {
            const details = result.rows[0];
            res.json({ 
                success: true, 
                hasBankDetails: true,
                bankName: details.bank_name,
                accountHolderName: details.account_holder_name,
                routingNumberLast4: details.routing_number.slice(-4),
                accountType: details.account_type
            });
        } else {
            res.json({ success: true, hasBankDetails: false });
        }
    } catch (error) {
        console.error('Bank details check error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/usd-withdrawal/request', async (req, res) => {
    try {
        const { email, walletAddress, kenoAmount } = req.body;
        
        if (!email || !kenoAmount || kenoAmount <= 0) {
            return res.status(400).json({ success: false, error: 'Invalid request' });
        }
        
        const bankDetails = await dbConnection.query(
            'SELECT * FROM student_bank_details WHERE email = $1',
            [email.toLowerCase()]
        );
        
        if (bankDetails.rows.length === 0) {
            return res.status(400).json({ success: false, error: 'Please add bank details first' });
        }
        
        const usdAmount = kenoAmount * 1.00;
        
        // Check reserve availability (Revenue-First Model)
        const reserve = await dbConnection.query('SELECT * FROM withdrawal_reserve ORDER BY id DESC LIMIT 1');
        if (reserve.rows.length > 0) {
            const r = reserve.rows[0];
            const currentBalance = parseFloat(r.current_balance_usd);
            const minimumReserve = parseFloat(r.minimum_reserve_usd);
            const availableForWithdrawal = currentBalance - minimumReserve;
            
            if (availableForWithdrawal < usdAmount) {
                console.log(`⚠️ Withdrawal blocked: $${usdAmount} requested, only $${availableForWithdrawal.toFixed(2)} available`);
                return res.status(400).json({ 
                    success: false, 
                    error: 'Withdrawal reserve is currently low. Please try a smaller amount or wait for more revenue to be deposited.',
                    reserveStatus: {
                        available: Math.max(0, availableForWithdrawal),
                        requested: usdAmount,
                        message: 'Revenue-first model: Withdrawals are funded from platform revenue (courses, ICO, node sales, B2B licensing)'
                    }
                });
            }
        }
        
        const requestId = 'USD-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
        
        await dbConnection.query(`
            INSERT INTO usd_withdrawals (request_id, email, wallet_address, keno_amount, usd_amount, status)
            VALUES ($1, $2, $3, $4, $5, 'pending')
        `, [requestId, email.toLowerCase(), walletAddress?.toLowerCase(), kenoAmount, usdAmount]);
        
        console.log(`💵 USD withdrawal request: ${kenoAmount} KENO ($${usdAmount}) from ${email}`);
        
        try {
            await EmailService.sendEmail({
                to: 'moheazy81@gmail.com',
                subject: `🏦 New USD Withdrawal Request: $${usdAmount.toFixed(2)}`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #7c3aed;">New USD Withdrawal Request (Mercury Bank)</h2>
                        <div style="background: #f3f4f6; padding: 20px; border-radius: 10px; margin: 20px 0;">
                            <p><strong>Request ID:</strong> ${requestId}</p>
                            <p><strong>Student Email:</strong> ${email}</p>
                            <p><strong>KENO Amount:</strong> ${kenoAmount.toFixed(2)} KENO</p>
                            <p><strong>USD Amount:</strong> $${usdAmount.toFixed(2)}</p>
                            <p><strong>Bank:</strong> ${bankDetails.rows[0].bank_name}</p>
                            <p><strong>Account Holder:</strong> ${bankDetails.rows[0].account_holder_name}</p>
                            <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
                        </div>
                        <p>Login to the <a href="https://kenostodblockchain.com/backoffice.html">Admin Backoffice</a> to review and process via Mercury Bank.</p>
                    </div>
                `,
                text: `New USD Withdrawal Request\n\nRequest ID: ${requestId}\nEmail: ${email}\nKENO: ${kenoAmount}\nUSD: $${usdAmount}\n\nLogin to backoffice to process via Mercury.`
            });
            console.log('📧 Admin notification email sent for USD withdrawal');
        } catch (emailError) {
            console.error('⚠️ Email notification failed:', emailError.message);
        }
        
        res.json({ success: true, requestId, usdAmount, message: 'Withdrawal request submitted' });
    } catch (error) {
        console.error('USD withdrawal request error:', error);
        res.status(500).json({ success: false, error: 'Failed to submit withdrawal request' });
    }
});

app.get('/api/usd-withdrawal/history', async (req, res) => {
    try {
        const { email } = req.query;
        if (!email) {
            return res.status(400).json({ success: false, error: 'Email required' });
        }
        
        const result = await dbConnection.query(`
            SELECT request_id, keno_amount, usd_amount, status, requested_at, completed_at 
            FROM usd_withdrawals 
            WHERE email = $1 
            ORDER BY requested_at DESC
        `, [email.toLowerCase()]);
        
        res.json({ success: true, withdrawals: result.rows });
    } catch (error) {
        console.error('USD withdrawal history error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/admin/usd-withdrawals', async (req, res) => {
    try {
        const { adminPassword } = req.query;
        if (adminPassword !== process.env.ADMIN_PASSWORD) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        
        const result = await dbConnection.query(`
            SELECT w.*, b.bank_name, b.account_holder_name, b.routing_number, b.account_type
            FROM usd_withdrawals w
            LEFT JOIN student_bank_details b ON w.email = b.email
            ORDER BY w.requested_at DESC
        `);
        
        res.json({ success: true, withdrawals: result.rows });
    } catch (error) {
        console.error('Admin USD withdrawals error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/admin/usd-withdrawal/process', async (req, res) => {
    try {
        const { adminPassword, requestId, action, adminNotes } = req.body;
        
        if (adminPassword !== process.env.ADMIN_PASSWORD) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        
        const withdrawal = await dbConnection.query(
            'SELECT w.*, b.* FROM usd_withdrawals w LEFT JOIN student_bank_details b ON w.email = b.email WHERE w.request_id = $1',
            [requestId]
        );
        
        if (withdrawal.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Withdrawal not found' });
        }
        
        const w = withdrawal.rows[0];
        
        if (action === 'approve') {
            // Check reserve availability before approving
            const reserve = await dbConnection.query('SELECT * FROM withdrawal_reserve ORDER BY id DESC LIMIT 1');
            if (reserve.rows.length > 0) {
                const r = reserve.rows[0];
                const currentBalance = parseFloat(r.current_balance_usd);
                const minimumReserve = parseFloat(r.minimum_reserve_usd);
                const availableForWithdrawal = currentBalance - minimumReserve;
                
                if (availableForWithdrawal < parseFloat(w.usd_amount)) {
                    return res.status(400).json({ 
                        success: false, 
                        error: `Insufficient reserve funds. Available: $${availableForWithdrawal.toFixed(2)}, Requested: $${w.usd_amount}`,
                        suggestion: 'Add more funds to the reserve via revenue deposits before approving this withdrawal.'
                    });
                }
            }
            
            const decryptedAccount = mercuryBankAPI.decryptAccountNumber(w.account_number_encrypted);
            
            const transferResult = await mercuryBankAPI.initiateACHTransfer({
                amount: w.usd_amount,
                recipientName: w.account_holder_name,
                routingNumber: w.routing_number,
                accountNumber: decryptedAccount,
                accountType: w.account_type,
                memo: `Kenostod KENO Withdrawal - ${requestId}`
            });
            
            // Deduct from reserve after successful transfer initiation
            const currentReserve = await dbConnection.query('SELECT * FROM withdrawal_reserve ORDER BY id DESC LIMIT 1');
            if (currentReserve.rows.length > 0) {
                const currentUsd = parseFloat(currentReserve.rows[0].current_balance_usd);
                const currentKeno = parseFloat(currentReserve.rows[0].current_balance_keno);
                const newBalanceUsd = Math.max(0, currentUsd - parseFloat(w.usd_amount));
                const newBalanceKeno = Math.max(0, currentKeno - parseFloat(w.keno_amount));
                
                await dbConnection.query(`
                    UPDATE withdrawal_reserve 
                    SET current_balance_usd = $1, current_balance_keno = $2, last_updated = CURRENT_TIMESTAMP
                    WHERE id = (SELECT id FROM withdrawal_reserve ORDER BY id DESC LIMIT 1)
                `, [newBalanceUsd, newBalanceKeno]);
                
                await dbConnection.query(`
                    INSERT INTO reserve_transactions 
                    (transaction_type, source, amount_usd, amount_keno, reference_id, description, balance_after_usd, balance_after_keno, created_by)
                    VALUES ('withdrawal', 'student_cashout', $1, $2, $3, $4, $5, $6, 'admin')
                `, [w.usd_amount, w.keno_amount, requestId, `USD cashout to ${w.email}`, newBalanceUsd, newBalanceKeno]);
                
                console.log(`📤 Reserve deduction: $${w.usd_amount} for ${requestId}. New balance: $${newBalanceUsd}`);
            }
            
            await dbConnection.query(`
                UPDATE usd_withdrawals 
                SET status = 'approved', mercury_transfer_id = $1, admin_notes = $2, processed_at = CURRENT_TIMESTAMP
                WHERE request_id = $3
            `, [transferResult.transferId, adminNotes || '', requestId]);
            
            console.log(`✅ USD withdrawal approved: ${requestId} - Transfer ID: ${transferResult.transferId}`);
            res.json({ success: true, message: 'Withdrawal approved and ACH transfer initiated', transferResult });
            
        } else if (action === 'reject') {
            await dbConnection.query(`
                UPDATE usd_withdrawals 
                SET status = 'rejected', admin_notes = $1, processed_at = CURRENT_TIMESTAMP
                WHERE request_id = $2
            `, [adminNotes || 'Request rejected', requestId]);
            
            console.log(`❌ USD withdrawal rejected: ${requestId}`);
            res.json({ success: true, message: 'Withdrawal rejected' });
        } else {
            res.status(400).json({ success: false, error: 'Invalid action' });
        }
    } catch (error) {
        console.error('Process USD withdrawal error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== END MERCURY BANK ENDPOINTS ====================

// ==================== KENO MARKET (PancakeSwap Live Data) ====================

app.get('/api/keno/market', async (req, res) => {
    try {
        const https = require('https');
        const PAIR  = '0x72368adf1487eeebcb095f16cf8cbf91f2b44880';
        const KENO  = '0x65791E0B5Cbac5F40c76cDe31bf4F074D982FD0E';

        function bscCall(to, data) {
            return new Promise((resolve, reject) => {
                const body = JSON.stringify({ jsonrpc:'2.0', id:1, method:'eth_call', params:[{to, data}, 'latest'] });
                const req2 = https.request({
                    hostname: 'bsc-dataseed1.binance.org', path:'/', method:'POST',
                    headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)},
                    timeout: 8000
                }, r => { let d=''; r.on('data', c=>d+=c); r.on('end', ()=>{ try{resolve(JSON.parse(d))}catch(e){reject(e)} }); });
                req2.on('error', reject);
                req2.on('timeout', ()=>{ req2.destroy(); reject(new Error('BSC timeout')); });
                req2.write(body); req2.end();
            });
        }

        function getBNBPrice() {
            return new Promise((resolve) => {
                const url = 'https://api.coingecko.com/api/v3/simple/price?ids=binancecoin&vs_currencies=usd';
                https.get(url, { headers: { 'Accept': 'application/json', 'User-Agent': 'KenostodUTL/2.0' } }, r => {
                    let d=''; r.on('data', c=>d+=c);
                    r.on('end', ()=>{
                        try {
                            const price = parseFloat(JSON.parse(d).binancecoin?.usd);
                            resolve(isNaN(price) ? 620 : price);
                        } catch(e){ resolve(620); }
                    });
                }).on('error', ()=>resolve(620)).setTimeout(8000, function(){ this.destroy(); resolve(620); });
            });
        }

        const [reservesRes, bnbPrice] = await Promise.all([
            bscCall(PAIR, '0x0902f1ac'),
            getBNBPrice()
        ]);

        const r = reservesRes.result;
        const reserve0 = BigInt('0x' + r.slice(2, 66));
        const reserve1 = BigInt('0x' + r.slice(66, 130));
        const kenoReserve = Number(reserve0) / 1e18;
        const bnbReserve  = Number(reserve1) / 1e18;
        const kenoPerBNB  = kenoReserve / bnbReserve;
        const kenoPriceUSD = bnbPrice / kenoPerBNB;
        const tvl = kenoReserve * kenoPriceUSD * 2;

        res.json({
            ok: true,
            pair: PAIR,
            token: KENO,
            symbol: 'KENO',
            pairName: 'KENO/BNB',
            dex: 'PancakeSwap V2',
            chain: 'BSC',
            price: { usd: kenoPriceUSD, bnb: 1 / kenoPerBNB },
            peg: { usd: 1.00, status: kenoPriceUSD >= 0.95 ? 'ON_PEG' : 'BELOW_PEG' },
            reserves: { keno: kenoReserve, bnb: bnbReserve },
            tvl,
            bnbPrice,
            links: {
                swap: `https://pancakeswap.finance/swap?outputCurrency=${KENO}&chain=bsc`,
                addLiquidity: `https://pancakeswap.finance/add/BNB/${KENO}?chain=bsc`,
                pair: `https://bscscan.com/address/${PAIR}`,
                chart: `https://dexscreener.com/bsc/${PAIR}`,
                token: `https://bscscan.com/token/${KENO}`
            }
        });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

// ==================== KENO LIQUIDITY POOL API ====================

app.get('/api/pool/keno-bnb', async (req, res) => {
    try {
        const { ethers } = require('ethers');
        const provider = new ethers.JsonRpcProvider('https://bsc-dataseed1.binance.org/');
        const PAIR  = '0x72368adf1487eeebCb095F16CF8cbf91f2B44880';
        const KENO  = '0x65791E0B5Cbac5F40c76cDe31bf4F074D982FD0E';
        const WBNB  = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';
        const PANCAKE_ROUTER = '0x10ED43C718714eb63d5aA57B78B54704E256024E';

        const PAIR_ABI = [
            'function getReserves() view returns (uint112,uint112,uint32)',
            'function totalSupply() view returns (uint256)',
            'function balanceOf(address) view returns (uint256)',
            'function token0() view returns (address)',
            'function token1() view returns (address)'
        ];
        const ERC20_ABI = ['function balanceOf(address) view returns (uint256)'];

        const pair = new ethers.Contract(PAIR, PAIR_ABI, provider);
        const keno = new ethers.Contract(KENO, ERC20_ABI, provider);

        const [reserves, totalSupply, token0] = await Promise.all([
            pair.getReserves(),
            pair.totalSupply(),
            pair.token0()
        ]);

        const isToken0KENO = token0.toLowerCase() === KENO.toLowerCase();
        const kenoReserve = isToken0KENO ? reserves[0] : reserves[1];
        const bnbReserve  = isToken0KENO ? reserves[1] : reserves[0];

        const kenoFloat = parseFloat(ethers.formatUnits(kenoReserve, 18));
        const bnbFloat  = parseFloat(ethers.formatEther(bnbReserve));

        // BNB price from PancakeSwap WBNB/BUSD if possible, else fallback
        let bnbPriceUSD = 630;
        try {
            const r2 = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=binancecoin&vs_currencies=usd',
                { headers: { 'Accept': 'application/json', 'User-Agent': 'Kenostod/2.0' } });
            const pd = await r2.json();
            if (pd?.binancecoin?.usd) bnbPriceUSD = pd.binancecoin.usd;
        } catch(_) {}

        const bnbValueUSD  = bnbFloat * bnbPriceUSD;
        const totalLiqUSD  = bnbValueUSD * 2; // equal value both sides
        const kenoPriceUSD = kenoFloat > 0 ? bnbValueUSD / kenoFloat : 0;
        const lpSupply     = parseFloat(ethers.formatEther(totalSupply));

        res.json({
            ok: true,
            pair: PAIR,
            kenoToken: KENO,
            router: PANCAKE_ROUTER,
            kenoReserve: kenoFloat.toFixed(2),
            bnbReserve: bnbFloat.toFixed(8),
            bnbReserveRaw: bnbReserve.toString(),
            kenoReserveRaw: kenoReserve.toString(),
            kenoPriceUSD: kenoPriceUSD.toFixed(10),
            bnbPriceUSD: bnbPriceUSD.toFixed(2),
            totalLiquidityUSD: totalLiqUSD.toFixed(2),
            lpTotalSupply: lpSupply.toFixed(6),
            isToken0KENO
        });
    } catch (e) {
        res.json({ ok: false, error: e.message });
    }
});

// ==================== WITHDRAWAL RESERVE SYSTEM (Revenue-First Model) ====================

// Get reserve status (public endpoint for transparency)
app.get('/api/reserve/status', async (req, res) => {
    try {
        const reserve = await dbConnection.query('SELECT * FROM withdrawal_reserve ORDER BY id DESC LIMIT 1');
        
        if (reserve.rows.length === 0) {
            return res.json({ 
                success: true, 
                reserve: { currentBalanceUsd: 0, currentBalanceKeno: 0, minimumReserveUsd: 1000, healthy: false }
            });
        }
        
        const r = reserve.rows[0];
        const pendingWithdrawals = await dbConnection.query(
            "SELECT COALESCE(SUM(usd_amount), 0) as pending FROM usd_withdrawals WHERE status = 'pending'"
        );
        const pendingAmount = parseFloat(pendingWithdrawals.rows[0]?.pending || 0);
        
        const availableForWithdrawal = Math.max(0, parseFloat(r.current_balance_usd) - parseFloat(r.minimum_reserve_usd));
        const isHealthy = parseFloat(r.current_balance_usd) >= parseFloat(r.minimum_reserve_usd);
        
        res.json({
            success: true,
            reserve: {
                currentBalanceUsd: parseFloat(r.current_balance_usd),
                currentBalanceKeno: parseFloat(r.current_balance_keno),
                minimumReserveUsd: parseFloat(r.minimum_reserve_usd),
                reservePercentage: r.reserve_percentage,
                kenoPriceUsd: parseFloat(r.keno_price_usd),
                pendingWithdrawalsUsd: pendingAmount,
                availableForWithdrawal: availableForWithdrawal,
                healthy: isHealthy,
                lastUpdated: r.last_updated
            }
        });
    } catch (error) {
        console.error('Reserve status error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Admin: Get detailed reserve info and transaction history
app.get('/api/admin/reserve', requireAdminAuth, async (req, res) => {
    try {
        const reserve = await dbConnection.query('SELECT * FROM withdrawal_reserve ORDER BY id DESC LIMIT 1');
        const transactions = await dbConnection.query(
            'SELECT * FROM reserve_transactions ORDER BY created_at DESC LIMIT 100'
        );
        
        const pendingWithdrawals = await dbConnection.query(
            "SELECT COALESCE(SUM(usd_amount), 0) as pending, COUNT(*) as count FROM usd_withdrawals WHERE status = 'pending'"
        );
        
        const revenueStats = await dbConnection.query(`
            SELECT source, 
                   SUM(amount_usd) as total_usd, 
                   COUNT(*) as count
            FROM reserve_transactions 
            WHERE transaction_type = 'deposit'
            GROUP BY source
        `);
        
        const withdrawalStats = await dbConnection.query(`
            SELECT SUM(amount_usd) as total_withdrawn, COUNT(*) as count
            FROM reserve_transactions 
            WHERE transaction_type = 'withdrawal'
        `);
        
        res.json({
            success: true,
            reserve: reserve.rows[0] || null,
            transactions: transactions.rows,
            pendingWithdrawals: {
                totalUsd: parseFloat(pendingWithdrawals.rows[0]?.pending || 0),
                count: parseInt(pendingWithdrawals.rows[0]?.count || 0)
            },
            revenueBySource: revenueStats.rows,
            totalWithdrawn: {
                totalUsd: parseFloat(withdrawalStats.rows[0]?.total_withdrawn || 0),
                count: parseInt(withdrawalStats.rows[0]?.count || 0)
            }
        });
    } catch (error) {
        console.error('Admin reserve error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Admin: Add funds to reserve (from revenue sources)
app.post('/api/admin/reserve/deposit', requireAdminAuth, async (req, res) => {
    try {
        const { source, amountUsd, amountKeno, referenceId, description } = req.body;
        
        if (!source || (!amountUsd && !amountKeno)) {
            return res.status(400).json({ success: false, error: 'Source and amount required' });
        }
        
        const validSources = ['ico_sale', 'course_sale', 'node_sale', 'b2b_licensing', 'trading_fees', 'manual_deposit', 'other'];
        if (!validSources.includes(source)) {
            return res.status(400).json({ success: false, error: `Invalid source. Valid: ${validSources.join(', ')}` });
        }
        
        // Get current reserve balance
        const currentReserve = await dbConnection.query('SELECT * FROM withdrawal_reserve ORDER BY id DESC LIMIT 1');
        const currentUsd = parseFloat(currentReserve.rows[0]?.current_balance_usd || 0);
        const currentKeno = parseFloat(currentReserve.rows[0]?.current_balance_keno || 0);
        
        const depositUsd = parseFloat(amountUsd) || 0;
        const depositKeno = parseFloat(amountKeno) || 0;
        
        const newBalanceUsd = currentUsd + depositUsd;
        const newBalanceKeno = currentKeno + depositKeno;
        
        // Update reserve balance
        await dbConnection.query(`
            UPDATE withdrawal_reserve 
            SET current_balance_usd = $1, current_balance_keno = $2, last_updated = CURRENT_TIMESTAMP
            WHERE id = (SELECT id FROM withdrawal_reserve ORDER BY id DESC LIMIT 1)
        `, [newBalanceUsd, newBalanceKeno]);
        
        // Log transaction
        await dbConnection.query(`
            INSERT INTO reserve_transactions 
            (transaction_type, source, amount_usd, amount_keno, reference_id, description, balance_after_usd, balance_after_keno, created_by)
            VALUES ('deposit', $1, $2, $3, $4, $5, $6, $7, 'admin')
        `, [source, depositUsd, depositKeno, referenceId || null, description || `Revenue deposit from ${source}`, newBalanceUsd, newBalanceKeno]);
        
        console.log(`💰 Reserve deposit: $${depositUsd} / ${depositKeno} KENO from ${source}. New balance: $${newBalanceUsd}`);
        
        res.json({
            success: true,
            message: 'Funds deposited to reserve',
            deposit: { amountUsd: depositUsd, amountKeno: depositKeno, source },
            newBalance: { usd: newBalanceUsd, keno: newBalanceKeno }
        });
    } catch (error) {
        console.error('Reserve deposit error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Admin: Update reserve settings
app.post('/api/admin/reserve/settings', requireAdminAuth, async (req, res) => {
    try {
        const { minimumReserveUsd, reservePercentage, kenoPriceUsd } = req.body;
        
        const updates = [];
        const values = [];
        let paramIndex = 1;
        
        if (minimumReserveUsd !== undefined) {
            updates.push(`minimum_reserve_usd = $${paramIndex++}`);
            values.push(parseFloat(minimumReserveUsd));
        }
        if (reservePercentage !== undefined) {
            updates.push(`reserve_percentage = $${paramIndex++}`);
            values.push(parseInt(reservePercentage));
        }
        if (kenoPriceUsd !== undefined) {
            updates.push(`keno_price_usd = $${paramIndex++}`);
            values.push(parseFloat(kenoPriceUsd));
        }
        
        if (updates.length === 0) {
            return res.status(400).json({ success: false, error: 'No settings to update' });
        }
        
        updates.push('last_updated = CURRENT_TIMESTAMP');
        
        await dbConnection.query(`
            UPDATE withdrawal_reserve 
            SET ${updates.join(', ')}
            WHERE id = (SELECT id FROM withdrawal_reserve ORDER BY id DESC LIMIT 1)
        `, values);
        
        console.log(`⚙️ Reserve settings updated`);
        res.json({ success: true, message: 'Reserve settings updated' });
    } catch (error) {
        console.error('Reserve settings error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============ Admin Course Editor API ============

// In-memory course overrides (loaded from file on startup)
let courseOverrides = {};
const COURSE_OVERRIDES_FILE = './data/course-overrides.json';

// Load course overrides from file
function loadCourseOverrides() {
    try {
        const fs = require('fs');
        if (fs.existsSync(COURSE_OVERRIDES_FILE)) {
            courseOverrides = JSON.parse(fs.readFileSync(COURSE_OVERRIDES_FILE, 'utf8'));
            console.log(`✅ Loaded ${Object.keys(courseOverrides).length} course overrides`);
        }
    } catch (error) {
        console.error('Error loading course overrides:', error.message);
    }
}

// Save course overrides to file
function saveCourseOverrides() {
    try {
        const fs = require('fs');
        fs.writeFileSync(COURSE_OVERRIDES_FILE, JSON.stringify(courseOverrides, null, 2));
    } catch (error) {
        console.error('Error saving course overrides:', error.message);
    }
}

// Initialize on startup
loadCourseOverrides();

// Base course data (matches backoffice.js structure)
const baseCourses = {
    1: { icon: '💼', title: 'Course 1: Wallet Management & Cryptography', duration: '4 hours', modules: 5, level: 'Beginner', overview: 'Master the fundamentals of blockchain wallets using industry-standard secp256k1 elliptic curve cryptography.' },
    2: { icon: '⛏️', title: 'Course 2: Block Mining & Hashing', duration: '5 hours', modules: 6, level: 'Beginner', overview: 'Learn how blockchain miners create new blocks using SHA-256 hashing and Proof-of-Work consensus.' },
    3: { icon: '🔄', title: 'Course 3: Transaction Reversal Windows', duration: '3 hours', modules: 4, level: 'Intermediate', overview: 'Understand the unique transaction reversal system that provides a safety net for blockchain transactions.' },
    4: { icon: '📅', title: 'Course 4: Scheduled Transactions', duration: '3 hours', modules: 4, level: 'Intermediate', overview: 'Master time-locked and scheduled transactions for automated blockchain payments.' },
    5: { icon: '🛡️', title: 'Course 5: Social Recovery Wallets', duration: '4 hours', modules: 5, level: 'Intermediate', overview: 'Learn about social recovery mechanisms that help users recover lost wallet access through trusted contacts.' },
    6: { icon: '💬', title: 'Course 6: Blockchain Messaging', duration: '3 hours', modules: 4, level: 'Beginner', overview: 'Explore encrypted messaging capabilities built into blockchain transactions.' },
    7: { icon: '⭐', title: 'Course 7: Reputation Systems', duration: '3 hours', modules: 4, level: 'Intermediate', overview: 'Build and verify on-chain reputation through transaction history analysis.' },
    8: { icon: '🗳️', title: 'Course 8: Governance & Voting', duration: '4 hours', modules: 5, level: 'Advanced', overview: 'Participate in blockchain governance through proposal creation and voting mechanisms.' },
    9: { icon: '⚡', title: 'Course 9: Proof-of-Work Deep Dive', duration: '5 hours', modules: 6, level: 'Advanced', overview: 'Advanced understanding of Proof-of-Work consensus and mining optimization.' },
    10: { icon: '🔮', title: 'Course 10: Proof-of-Residual-Value (PoRV)', duration: '5 hours', modules: 6, level: 'Advanced', overview: 'Learn about the innovative PoRV consensus that generates value through AI/ML computations.' },
    11: { icon: '🎨', title: 'Course 11: Residual Value Tokens (RVT)', duration: '4 hours', modules: 5, level: 'Intermediate', overview: 'Understand perpetual royalty NFTs that generate passive income for holders.' },
    12: { icon: '🏢', title: 'Course 12: Enterprise Blockchain', duration: '4 hours', modules: 5, level: 'Advanced', overview: 'Apply blockchain solutions to enterprise business problems.' },
    13: { icon: '👑', title: 'Course 13: Royalty Distribution', duration: '3 hours', modules: 4, level: 'Intermediate', overview: 'Implement automatic royalty distribution through smart contracts.' },
    14: { icon: '🏪', title: 'Course 14: Merchant Payment Gateway', duration: '4 hours', modules: 5, level: 'Intermediate', overview: 'Build merchant payment solutions accepting cryptocurrency.' },
    15: { icon: '🏦', title: 'Course 15: Blockchain Banking', duration: '5 hours', modules: 6, level: 'Advanced', overview: 'Integrate blockchain with traditional banking systems.' },
    16: { icon: '📊', title: 'Course 16: Decentralized Exchange', duration: '5 hours', modules: 6, level: 'Advanced', overview: 'Build and operate decentralized cryptocurrency exchanges.' },
    17: { icon: '💹', title: 'Course 17: DeFi Finance', duration: '5 hours', modules: 6, level: 'Advanced', overview: 'Master decentralized finance protocols and yield strategies.' },
    18: { icon: '⚡', title: 'Course 18: Flash Arbitrage Loans (FAL)', duration: '6 hours', modules: 7, level: 'Advanced', overview: 'Execute flash loans for arbitrage opportunities across exchanges.' },
    19: { icon: '🏊', title: 'Course 19: Flash Arbitrage Loan Pools (FALP)', duration: '6 hours', modules: 7, level: 'Advanced', overview: 'Participate in pooled liquidity for collective arbitrage opportunities.' },
    20: { icon: '💰', title: 'Course 20: Wealth Building Strategies', duration: '5 hours', modules: 6, level: 'Advanced', overview: 'Long-term cryptocurrency wealth building and portfolio management.' },
    21: { icon: '🌟', title: 'Course 21: Generational Wealth', duration: '5 hours', modules: 6, level: 'Advanced', overview: 'Create lasting wealth through strategic blockchain investments and inheritance planning.' }
};

// Get merged courses (base + overrides)
function getMergedCourses() {
    const merged = {};
    for (const id of Object.keys(baseCourses)) {
        merged[id] = { ...baseCourses[id], ...(courseOverrides[id] || {}) };
    }
    return merged;
}

// Admin: Get all courses
app.get('/api/admin/courses', (req, res) => {
    const adminPwd = req.headers['x-admin-password'] || req.query.adminPassword;
    if (adminPwd !== process.env.ADMIN_PASSWORD) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    
    res.json({ success: true, courses: getMergedCourses() });
});

// Admin: Update a course
app.put('/api/admin/courses/:courseId', (req, res) => {
    const adminPwd = req.headers['x-admin-password'] || req.body.adminPassword;
    if (adminPwd !== process.env.ADMIN_PASSWORD) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    
    const courseId = req.params.courseId;
    if (!baseCourses[courseId]) {
        return res.status(404).json({ success: false, error: 'Course not found' });
    }
    
    const { title, duration, modules, level, overview } = req.body;
    
    // Create or update override
    if (!courseOverrides[courseId]) {
        courseOverrides[courseId] = {};
    }
    
    if (title) courseOverrides[courseId].title = title;
    if (duration) courseOverrides[courseId].duration = duration;
    if (modules) courseOverrides[courseId].modules = parseInt(modules);
    if (level) courseOverrides[courseId].level = level;
    if (overview) courseOverrides[courseId].overview = overview;
    
    saveCourseOverrides();
    
    console.log(`✏️ Course ${courseId} updated:`, courseOverrides[courseId]);
    res.json({ success: true, message: 'Course updated', course: getMergedCourses()[courseId] });
});

// Public: Get course info (for displaying on course pages)
app.get('/api/courses/:courseId', (req, res) => {
    const courseId = req.params.courseId;
    const courses = getMergedCourses();
    
    if (!courses[courseId]) {
        return res.status(404).json({ success: false, error: 'Course not found' });
    }
    
    res.json({ success: true, course: courses[courseId] });
});

// Helper function to check reserve availability
async function checkReserveAvailability(amountUsd) {
    const reserve = await dbConnection.query('SELECT * FROM withdrawal_reserve ORDER BY id DESC LIMIT 1');
    if (reserve.rows.length === 0) return { available: false, reason: 'Reserve not initialized' };
    
    const r = reserve.rows[0];
    const currentBalance = parseFloat(r.current_balance_usd);
    const minimumReserve = parseFloat(r.minimum_reserve_usd);
    const availableForWithdrawal = currentBalance - minimumReserve;
    
    if (availableForWithdrawal < amountUsd) {
        return {
            available: false,
            reason: 'Insufficient reserve funds',
            currentBalance,
            minimumReserve,
            availableForWithdrawal: Math.max(0, availableForWithdrawal),
            requested: amountUsd
        };
    }
    
    return {
        available: true,
        currentBalance,
        availableForWithdrawal,
        requested: amountUsd
    };
}

// Helper function to deduct from reserve (called when withdrawal is approved)
async function deductFromReserve(amountUsd, amountKeno, referenceId, description) {
    const currentReserve = await dbConnection.query('SELECT * FROM withdrawal_reserve ORDER BY id DESC LIMIT 1');
    const currentUsd = parseFloat(currentReserve.rows[0]?.current_balance_usd || 0);
    const currentKeno = parseFloat(currentReserve.rows[0]?.current_balance_keno || 0);
    
    const newBalanceUsd = Math.max(0, currentUsd - amountUsd);
    const newBalanceKeno = Math.max(0, currentKeno - amountKeno);
    
    await dbConnection.query(`
        UPDATE withdrawal_reserve 
        SET current_balance_usd = $1, current_balance_keno = $2, last_updated = CURRENT_TIMESTAMP
        WHERE id = (SELECT id FROM withdrawal_reserve ORDER BY id DESC LIMIT 1)
    `, [newBalanceUsd, newBalanceKeno]);
    
    await dbConnection.query(`
        INSERT INTO reserve_transactions 
        (transaction_type, source, amount_usd, amount_keno, reference_id, description, balance_after_usd, balance_after_keno, created_by)
        VALUES ('withdrawal', 'student_cashout', $1, $2, $3, $4, $5, $6, 'system')
    `, [amountUsd, amountKeno, referenceId, description, newBalanceUsd, newBalanceKeno]);
    
    console.log(`📤 Reserve deduction: $${amountUsd} for ${referenceId}. New balance: $${newBalanceUsd}`);
    
    return { newBalanceUsd, newBalanceKeno };
}

// ==================== END WITHDRAWAL RESERVE SYSTEM ====================

// Test email endpoint (admin only)
app.post('/api/admin/test-email', async (req, res) => {
    try {
        const { adminPassword, targetEmail } = req.body;
        if (adminPassword !== process.env.ADMIN_PASSWORD) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        
        const testEmail = targetEmail || 'moheazy81@gmail.com';
        
        console.log(`📧 Attempting to send test email to ${testEmail}...`);
        
        const result = await EmailService.sendEmail({
            to: testEmail,
            subject: 'Test Email from Kenostod Blockchain Academy',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #7c3aed;">Email Test Successful!</h2>
                    <div style="background: #f3f4f6; padding: 20px; border-radius: 10px; margin: 20px 0;">
                        <p>This is a test email from Kenostod Blockchain Academy.</p>
                        <p><strong>Sent at:</strong> ${new Date().toLocaleString()}</p>
                        <p><strong>Target:</strong> ${testEmail}</p>
                    </div>
                    <p>If you received this email, the email notification system is working correctly.</p>
                </div>
            `,
            text: `Email Test Successful!\n\nThis is a test email from Kenostod Blockchain Academy.\nSent at: ${new Date().toLocaleString()}\n\nIf you received this email, the email notification system is working correctly.`
        });
        
        console.log(`✅ Test email sent successfully to ${testEmail}`);
        res.json({ success: true, message: `Test email sent to ${testEmail}`, result });
    } catch (error) {
        console.error('❌ Test email error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== FINLEGO / KUTL CARD API ENDPOINTS ====================

const finlego = require('./src/FinlegoIntegration');

app.get('/api/finlego/card', async (req, res) => {
    try {
        const accountId = req.query.accountId || (req.session && req.session.userId);
        const result = await finlego.getCardInfo(accountId);
        res.json(result);
    } catch (e) {
        res.json({ success: false, sandbox: true, data: null, error: e.message });
    }
});

app.get('/api/finlego/balance', async (req, res) => {
    try {
        const accountId = req.query.accountId || (req.session && req.session.userId);
        const result = await finlego.getBalance(accountId);
        res.json(result);
    } catch (e) {
        res.json({ success: false, sandbox: true, data: null, error: e.message });
    }
});

app.get('/api/finlego/transactions', async (req, res) => {
    try {
        const accountId = req.query.accountId || (req.session && req.session.userId);
        const limit = parseInt(req.query.limit) || 20;
        const result = await finlego.getTransactions(accountId, limit);
        res.json(result);
    } catch (e) {
        res.json({ success: false, sandbox: true, data: null, error: e.message });
    }
});

app.post('/api/finlego/issue-card', async (req, res) => {
    try {
        const { firstName, lastName, email, kenoBalance, userId } = req.body;
        if (!email) return res.status(400).json({ success: false, error: 'Email required' });
        const result = await finlego.issueVirtualCard({ firstName, lastName, email, kenoBalance, userId });
        res.json(result);
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

app.get('/api/finlego/status', async (req, res) => {
    try {
        const token = await finlego.getAuthToken();
        res.json({
            connected: !!token,
            sandbox: true,
            boUrl: finlego.FINLEGO_CONFIG.boBaseUrl,
            foUrl: finlego.FINLEGO_CONFIG.foBaseUrl,
            message: token ? 'Connected to Finlego sandbox' : 'Sandbox credentials ready — API session pending Tuesday tech session',
        });
    } catch (e) {
        res.json({ connected: false, error: e.message });
    }
});

// ==================== END FINLEGO / KUTL CARD API ENDPOINTS ====================

// ==================== FOUNDER BACKOFFICE AUTH ====================
app.post('/api/auth/founder', (req, res) => {
    const { password } = req.body || {};
    const ADMIN_PASS = process.env.ADMIN_PASSWORD;
    if (!ADMIN_PASS) {
        return res.status(500).json({ ok: false, error: 'Server not configured' });
    }
    if (password && password === ADMIN_PASS) {
        return res.json({ ok: true });
    }
    res.status(401).json({ ok: false });
});
// ==================== END FOUNDER BACKOFFICE AUTH ====================

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Kenostod Blockchain server running on http://0.0.0.0:${PORT}`);
    console.log('API Documentation available at: http://localhost:5000');
    
    // Security check: Warn if NODE_ENV is not set for production deployment
    if (!process.env.NODE_ENV) {
        console.log('\n⚠️  WARNING: NODE_ENV is not set!');
        console.log('⚠️  Development endpoints (/api/transaction/simple, /api/sign) are ENABLED');
        console.log('⚠️  These endpoints accept private keys and should ONLY be used for testing');
        console.log('⚠️  For production deployment, set NODE_ENV=production to disable them\n');
    } else if (process.env.NODE_ENV === 'production') {
        console.log('✅ Running in PRODUCTION mode - development endpoints are disabled');
    } else {
        console.log(`ℹ️  Running in ${process.env.NODE_ENV} mode`);
    }
    
    // CRITICAL: Initialize blockchain systems immediately (async - won't block port)
    // This includes loading blockchain, wallets, and mining genesis block
    initializeBlockchainSystems().catch(err => console.error('❌ Blockchain init error:', err));

    // AUTO-START Live Arb Bot — starts automatically on every server boot
    // 10 second delay ensures RPC connections are ready before first scan
    setTimeout(async () => {
        try {
            console.log('🤖 Auto-starting Live Arb Bot...');
            const result = await liveArbBot.start();
            console.log('✅ Live Arb Bot auto-started:', result?.msg || 'running');
        } catch (err) {
            console.error('⚠️ Live Arb Bot auto-start error:', err.message);
        }
    }, 10000);
    
    // Initialize Stripe MUCH later to ensure deployment health checks pass first
    // Payments work without Stripe init, so this is safe to delay
    setTimeout(() => {
        initializeStripe().catch(err => console.error('Stripe init error:', err));
    }, 30000);
    
    // Start scheduled transaction processor (runs every 30 seconds)
    // Will work once kenostodChain is initialized
    setTimeout(() => {
        setInterval(() => {
            if (kenostodChain && kenostodChain.processScheduledTransactions) {
                const executed = kenostodChain.processScheduledTransactions();
                if (executed && executed.length > 0) {
                    console.log(`Processed ${executed.length} scheduled transactions`);
                }
            }
        }, 30000);
        console.log('Scheduled transaction processor started (runs every 30 seconds)');
    }, 2000);

    // Start recovery request cleanup (runs every hour)
    setTimeout(() => {
        setInterval(() => {
            if (kenostodChain && kenostodChain.socialRecovery) {
                kenostodChain.socialRecovery.cleanupExpiredRequests();
            }
        }, 3600000);
        console.log('Social recovery cleanup started (runs every hour)');
    }, 2000);

    // Start governance proposal checker (runs every hour)
    setTimeout(() => {
        setInterval(() => {
            try {
                if (kenostodChain && kenostodChain.governance && kenostodChain.governance.proposals instanceof Map) {
                    kenostodChain.checkAndExecuteProposals();
                }
            } catch (error) {
                console.error('Error in governance checker:', error.message);
            }
        }, 3600000);
        console.log('Governance proposal checker started (runs every hour)');
    }, 2000);
});

// ============================================================
// BRIDGE.XYZ SANDBOX INTEGRATION ROUTES
// ============================================================

app.get('/api/bridge/status', async (req, res) => {
    try {
        const result = await bridge.testConnection();
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== BRIDGE STUDENT KYC ROUTES ====================

app.get('/api/bridge/student-kyc/:walletAddress', async (req, res) => {
    try {
        const wallet = req.params.walletAddress.toLowerCase();
        const result = await dbConnection.query(
            `SELECT bridge_customer_id, bridge_kyc_status, bridge_kyc_link, 
                    bridge_liquidation_address, bridge_kyc_updated_at, name, email
             FROM students WHERE wallet_address = $1`,
            [wallet]
        );
        if (!result.rows.length) return res.status(404).json({ error: 'Student not found' });
        const student = result.rows[0];
        res.json({
            success: true,
            kyc: {
                customerId: student.bridge_customer_id,
                status: student.bridge_kyc_status || 'not_started',
                kycLink: student.bridge_kyc_link,
                liquidationAddress: student.bridge_liquidation_address,
                updatedAt: student.bridge_kyc_updated_at
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/bridge/student-kyc/refresh', async (req, res) => {
    try {
        const { walletAddress } = req.body;
        if (!walletAddress) return res.status(400).json({ error: 'walletAddress required' });
        const wallet = walletAddress.toLowerCase();

        const result = await dbConnection.query(
            `SELECT bridge_customer_id, bridge_kyc_status, name, email FROM students WHERE wallet_address = $1`,
            [wallet]
        );
        if (!result.rows.length) return res.status(404).json({ error: 'Student not found' });
        const student = result.rows[0];
        if (!student.bridge_customer_id) return res.status(400).json({ error: 'No Bridge customer ID on record. Student may need to re-enroll.' });

        const customer = await bridge.getCustomer(student.bridge_customer_id);
        const newStatus = customer.kyc_status || customer.status || 'pending';

        await dbConnection.query(
            `UPDATE students SET bridge_kyc_status = $1, bridge_kyc_updated_at = NOW() WHERE wallet_address = $2`,
            [newStatus, wallet]
        );

        // Auto-create liquidation address when KYC is approved
        let liquidationAddress = null;
        if (newStatus === 'approved') {
            try {
                const liq = await bridge.createLiquidationAddress({
                    customerId: student.bridge_customer_id,
                    chain: 'base',
                    currency: 'usdb'
                });
                liquidationAddress = liq.address || liq.id || null;
                if (liquidationAddress) {
                    await dbConnection.query(
                        `UPDATE students SET bridge_liquidation_address = $1 WHERE wallet_address = $2`,
                        [liquidationAddress, wallet]
                    );
                    console.log(`✅ USDB liquidation address created for ${student.email}: ${liquidationAddress}`);
                }
            } catch (liqErr) {
                console.error('Liquidation address creation failed:', liqErr.message);
            }
        }

        res.json({ success: true, status: newStatus, liquidationAddress });
    } catch (err) {
        res.status(500).json({ error: err.response ? err.response.data : err.message });
    }
});

// ==================== END BRIDGE STUDENT KYC ROUTES ====================

app.get('/api/bridge/customers', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const data = await bridge.listCustomers(limit);
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.response ? err.response.data : err.message });
    }
});

app.get('/api/bridge/customers/:id', async (req, res) => {
    try {
        const data = await bridge.getCustomer(req.params.id);
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.response ? err.response.data : err.message });
    }
});

app.post('/api/bridge/kyc_link', async (req, res) => {
    try {
        const { email, full_name } = req.body;
        if (!email || !full_name) {
            return res.status(400).json({ error: 'email and full_name are required' });
        }
        const data = await bridge.createKycLink(email, full_name);
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.response ? err.response.data : err.message });
    }
});

app.get('/api/bridge/transfers', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const data = await bridge.listTransfers(limit);
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.response ? err.response.data : err.message });
    }
});

app.post('/api/bridge/transfers', async (req, res) => {
    try {
        const data = await bridge.createTransfer(req.body);
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.response ? err.response.data : err.message });
    }
});

app.post('/api/bridge/liquidation_addresses', async (req, res) => {
    try {
        const data = await bridge.createLiquidationAddress(req.body);
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.response ? err.response.data : err.message });
    }
});

app.get('/api/bridge/liquidation_addresses', async (req, res) => {
    try {
        const customerId = req.query.customer_id;
        const data = await bridge.listLiquidationAddresses(customerId);
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.response ? err.response.data : err.message });
    }
});

module.exports = { app, kenostodChain, minerWallet, wallet1, wallet2 };