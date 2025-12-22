require('dotenv').config();
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
const BSCTokenTransfer = require('./src/BSCTokenTransfer');
const EC = require('elliptic').ec;
const ec = new EC('secp256k1');

const app = express();
const PORT = 5000;

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
        const webhookBaseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0] || 'localhost:5000'}`;
        const { webhook, uuid } = await stripeSync.findOrCreateManagedWebhook(
            `${webhookBaseUrl}/api/stripe/webhook`,
            {
                enabled_events: ['*'],
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

app.use(express.static('public'));

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
let paypalIntegration, merchantIncentives, revenueTracker, arbitrageSystem, falPoolManager;
let bscTokenTransfer;
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
let printfulIntegration, aiSupport, microMonetization;
const MicroMonetization = require('./src/MicroMonetization');

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
app.get('/api/balance/:address', (req, res) => {
    const address = req.params.address;
    const balance = kenostodChain.getBalanceOfAddress(address);
    
    res.json({
        address: address,
        balance: balance,
        token: kenostodChain.tokenSymbol
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

// Get current subscription price IDs
app.get('/api/stripe/get-price-ids', async (req, res) => {
    try {
        const products = await stripeService.ensureSubscriptionProducts();
        res.json({
            student: products.student.price.id,
            professional: products.professional.price.id
        });
    } catch (error) {
        console.error('Get price IDs error:', error);
        // Fallback to hardcoded prices for sandbox
        res.json({
            student: 'price_1SX1x1BMJMAmd04Cp1Aeq6TM',
            professional: 'price_1SX1x1BMJMAmd04CG9J97tmG'
        });
    }
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
        const currentPrice = now >= publicSaleStart ? 0.05 : 0.01;
        
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
                pricePhase: now >= publicSaleStart ? 'Public Sale' : 'Private Sale',
                nextPriceChange: now >= publicSaleStart ? null : publicSaleStart.toISOString()
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
        
        // Get user's course reward balance from database
        let totalRewards = 0;
        try {
            const result = await pool.query(
                `SELECT COALESCE(SUM(reward_amount), 0) as total FROM student_rewards 
                 WHERE user_wallet_address = $1 AND status = 'claimed'`,
                [walletAddress]
            );
            totalRewards = parseFloat(result.rows[0]?.total || 0);
        } catch (dbErr) {
            console.error('DB error getting rewards:', dbErr);
        }
        
        // Also check ICO purchases
        const userPurchases = icoPurchases.filter(p => 
            p.walletAddress && p.walletAddress.toLowerCase() === walletAddress.toLowerCase()
        );
        const icoPurchaseTokens = userPurchases.reduce((sum, p) => sum + (p.tokens || 0), 0);
        
        const totalTokens = totalRewards + icoPurchaseTokens;
        
        if (totalTokens === 0) {
            return res.status(400).json({
                success: false,
                error: 'No KENO tokens available to cash out. Complete courses to earn KENO!'
            });
        }
        
        // Calculate USD value (using current rate of $0.50 per KENO for pre-listing)
        const kenoPrice = 0.50;
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
            successUrl: successUrl || `${process.env.REPLIT_DEV_DOMAIN || 'http://localhost:5000'}/success`,
            cancelUrl: cancelUrl || `${process.env.REPLIT_DEV_DOMAIN || 'http://localhost:5000'}/cancel`,
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
        const baseUrl = process.env.REPLIT_DEV_DOMAIN 
            ? `https://${process.env.REPLIT_DEV_DOMAIN}` 
            : 'http://localhost:5000';
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

// Stripe webhook handler for subscription automation
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    try {
        const sig = req.headers['stripe-signature'];
        const event = stripeIntegration.constructWebhookEvent(req.body, sig);
        
        console.log(`📥 Stripe webhook received: ${event.type}`);
        
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object;
                const metadata = session.metadata;
                
                // Create license after successful checkout
                if (metadata.licenseType === 'white_label') {
                    const result = revenueTracker.createLicense({
                        organizationName: metadata.organizationName,
                        tier: metadata.tier,
                        contactEmail: session.customer_email,
                        customDomain: metadata.customDomain,
                        stripeSubscriptionId: session.subscription
                    });
                    
                    // Save to database
                    if (dbConnection) {
                        const license = result.license;
                        await dbConnection.query(`
                            INSERT INTO white_label_licenses (
                                license_id, license_key, organization_name, tier, contact_email, 
                                custom_domain, monthly_price, status, stripe_subscription_id, 
                                stripe_customer_id, total_revenue, expires_at
                            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                        `, [
                            license.licenseId, license.licenseKey, license.organizationName, 
                            license.tier, license.contactEmail, license.customDomain, 
                            license.monthlyPrice, license.status, license.stripeSubscriptionId,
                            session.customer, license.totalRevenue, new Date(license.expiresAt)
                        ]);
                    }
                    
                    console.log(`✅ License created: ${result.license.licenseId} for ${metadata.organizationName}`);
                }
                break;
            }
            
            case 'customer.subscription.created':
            case 'customer.subscription.updated': {
                const subscription = event.data.object;
                const metadata = subscription.metadata;
                
                // Update license status in database (try by subscription ID first, then by metadata)
                if (dbConnection) {
                    let updated = false;
                    
                    // Try to find and update by subscription ID
                    const result = await dbConnection.query(`
                        UPDATE white_label_licenses 
                        SET status = $1, stripe_subscription_id = $2, updated_at = CURRENT_TIMESTAMP
                        WHERE stripe_subscription_id = $2
                        RETURNING id
                    `, [subscription.status === 'active' ? 'active' : 'inactive', subscription.id]);
                    
                    updated = result.rowCount > 0;
                    
                    // FALLBACK: If not found by subscription ID and we have metadata, create license
                    if (!updated && metadata && metadata.organizationName) {
                        console.log(`⚠️  License not found for subscription ${subscription.id}, creating from metadata`);
                        
                        const result = revenueTracker.createLicense({
                            organizationName: metadata.organizationName,
                            tier: metadata.tier,
                            contactEmail: subscription.customer_email || 'unknown@email.com',
                            customDomain: metadata.customDomain || '',
                            stripeSubscriptionId: subscription.id
                        });
                        
                        const license = result.license;
                        await dbConnection.query(`
                            INSERT INTO white_label_licenses (
                                license_id, license_key, organization_name, tier, contact_email, 
                                custom_domain, monthly_price, status, stripe_subscription_id, 
                                stripe_customer_id, total_revenue, expires_at
                            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                            ON CONFLICT (stripe_subscription_id) DO UPDATE SET
                                status = EXCLUDED.status,
                                updated_at = CURRENT_TIMESTAMP
                        `, [
                            license.licenseId, license.licenseKey, license.organizationName, 
                            license.tier, license.contactEmail, license.customDomain, 
                            license.monthlyPrice, subscription.status === 'active' ? 'active' : 'inactive', 
                            subscription.id, subscription.customer, license.totalRevenue, 
                            new Date(license.expiresAt)
                        ]);
                        
                        console.log(`✅ License created from metadata for ${metadata.organizationName}`);
                        updated = true;
                    }
                    
                    if (updated) {
                        console.log(`✅ Subscription ${subscription.id} status: ${subscription.status}`);
                    } else {
                        console.error(`❌ Failed to update license for subscription ${subscription.id} - no subscription ID match and no metadata`);
                    }
                }
                break;
            }
            
            case 'customer.subscription.deleted': {
                const subscription = event.data.object;
                
                // Mark license as cancelled
                if (dbConnection) {
                    await dbConnection.query(`
                        UPDATE white_label_licenses 
                        SET status = 'cancelled', is_active = false, updated_at = CURRENT_TIMESTAMP
                        WHERE stripe_subscription_id = $1
                    `, [subscription.id]);
                }
                
                console.log(`❌ License cancelled for subscription: ${subscription.id}`);
                break;
            }
            
            case 'invoice.payment_succeeded': {
                const invoice = event.data.object;
                
                // Record payment
                if (dbConnection && invoice.subscription) {
                    const licenseResult = await dbConnection.query(`
                        SELECT license_id, monthly_price FROM white_label_licenses 
                        WHERE stripe_subscription_id = $1
                    `, [invoice.subscription]);
                    
                    if (licenseResult.rows.length > 0) {
                        const license = licenseResult.rows[0];
                        const period = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                        
                        await dbConnection.query(`
                            INSERT INTO license_payments (license_id, payment_id, amount, period, status)
                            VALUES ($1, $2, $3, $4, 'completed')
                        `, [license.license_id, invoice.id, invoice.amount_paid / 100, period]);
                        
                        await dbConnection.query(`
                            UPDATE white_label_licenses 
                            SET total_revenue = total_revenue + $1, 
                                status = 'active',
                                updated_at = CURRENT_TIMESTAMP
                            WHERE license_id = $2
                        `, [invoice.amount_paid / 100, license.license_id]);
                        
                        console.log(`💰 Payment recorded: $${(invoice.amount_paid / 100).toFixed(2)} for license ${license.license_id}`);
                    }
                }
                break;
            }
            
            case 'invoice.payment_failed': {
                const invoice = event.data.object;
                
                // Mark license as past_due
                if (dbConnection && invoice.subscription) {
                    await dbConnection.query(`
                        UPDATE white_label_licenses 
                        SET status = 'past_due', updated_at = CURRENT_TIMESTAMP
                        WHERE stripe_subscription_id = $1
                    `, [invoice.subscription]);
                }
                
                console.log(`⚠️  Payment failed for subscription: ${invoice.subscription}`);
                break;
            }
        }
        
        res.json({ received: true });
    } catch (error) {
        console.error('Stripe webhook error:', error);
        res.status(400).json({ error: error.message });
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
        const result = await wealthBuilderManager.calculateWealthSnapshot(walletAddress, email, icoPurchases || []);
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
        
        if (identifier.startsWith('KG-')) {
            result = await dbConnection.query(`
                SELECT * FROM kenostod_graduates WHERE graduate_id = $1
            `, [identifier]);
        } else {
            result = await dbConnection.query(`
                SELECT * FROM kenostod_graduates WHERE wallet_address = $1
            `, [identifier]);
        }
        
        if (result.rows.length === 0) {
            return res.json({ isGraduate: false, message: 'No graduate record found' });
        }
        
        const graduate = result.rows[0];
        res.json({
            isGraduate: true,
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
        const { walletAddress, amount, purpose } = req.body;
        
        if (!walletAddress || !amount) {
            return res.status(400).json({ 
                success: false, 
                error: 'Wallet address and amount are required' 
            });
        }
        
        const result = arbitrageSystem.createFlashLoan(walletAddress, amount, purpose || 'Arbitrage trading');
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

app.post('/api/arbitrage/flash-loan/repay', (req, res) => {
    try {
        const { walletAddress, loanId, profit } = req.body;
        
        if (!walletAddress || !loanId) {
            return res.status(400).json({ 
                success: false, 
                error: 'Wallet address and loan ID are required' 
            });
        }
        
        const result = arbitrageSystem.repayFlashLoan(walletAddress, loanId, profit || 0);
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

// ==================== END KENO ARBITRAGE REVOLUTION API ENDPOINTS ====================

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
        const now = new Date();
        const currentPhase = now < privateSaleDate ? 'upcoming' : 'private';
        const currentPrice = currentPhase === 'private' ? 0.01 : 0.05;

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
            SELECT COUNT(DISTINCT user_wallet_address) as count 
            FROM student_rewards 
            WHERE reward_type = 'course_completion'
            GROUP BY user_wallet_address 
            HAVING COUNT(*) >= 21
        `);
        stats.totalGraduates = graduatesResult.rows.length;
        
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
                user_wallet_address as wallet_address,
                MAX(user_email) as email,
                COUNT(DISTINCT CASE WHEN reward_type = 'course_completion' THEN course_id END) as courses_completed,
                COALESCE(SUM(reward_amount), 0) as total_keno,
                MIN(created_at) as first_activity
            FROM student_rewards
            GROUP BY user_wallet_address
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

module.exports = { app, kenostodChain, minerWallet, wallet1, wallet2 };