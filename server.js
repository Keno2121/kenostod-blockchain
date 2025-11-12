require('dotenv').config();
const express = require('express');
const cors = require('cors');
const https = require('https');
const Blockchain = require('./src/Blockchain');
const Transaction = require('./src/Transaction');
const ScheduledTransaction = require('./src/ScheduledTransaction');
const Wallet = require('./src/Wallet');
const BankingAPI = require('./src/BankingAPI');
const StripeIntegration = require('./src/StripeIntegration');
const PayPalIntegration = require('./src/PayPalIntegration');
const MerchantIncentives = require('./src/MerchantIncentives');
const RevenueTracker = require('./src/RevenueTracker');
const DataPersistence = require('./src/DataPersistence');
const DatabaseConnection = require('./src/DatabaseConnection');
const OrganizationManager = require('./src/OrganizationManager');
const WealthBuilderManager = require('./src/WealthBuilderManager');
const EC = require('elliptic').ec;
const ec = new EC('secp256k1');

const app = express();
const PORT = 5000;

// Middleware
app.use(cors());

// Stripe webhook must be BEFORE express.json() to preserve raw body for signature verification
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

// Prevent browser caching to ensure users always see latest version
app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
});

app.use(express.static('public'));

// Serve robots.txt and sitemap.xml for SEO
app.get('/robots.txt', (req, res) => {
    res.sendFile(__dirname + '/public/robots.txt');
});

app.get('/sitemap.xml', (req, res) => {
    res.sendFile(__dirname + '/public/sitemap.xml');
});

// Initialize persistence system
const dataPersistence = new DataPersistence();

// Initialize blockchain and restore from saved data if exists
const kenostodChain = new Blockchain();
const savedBlockchainData = dataPersistence.loadBlockchain();
if (savedBlockchainData) {
    kenostodChain.restoreFromData(savedBlockchainData);
}

// Load or create miner wallet (persistent across restarts)
let minerWallet;
const savedWalletData = dataPersistence.loadWallet();
if (savedWalletData) {
    minerWallet = Wallet.fromPrivateKey(savedWalletData.privateKey);
} else {
    minerWallet = new Wallet();
    dataPersistence.saveWallet(minerWallet);
}

// Create test wallets (these are ephemeral for testing)
const wallet1 = new Wallet();
const wallet2 = new Wallet();

// Initialize banking system
const bankingAPI = new BankingAPI(kenostodChain, dataPersistence);
const stripeIntegration = new StripeIntegration();
const paypalIntegration = new PayPalIntegration();

// Load saved fiat balances
const savedFiatBalances = dataPersistence.loadFiatBalances();
if (savedFiatBalances) {
    bankingAPI.loadFiatBalances(savedFiatBalances);
}

// Initialize merchant incentives
const merchantIncentives = new MerchantIncentives(kenostodChain);

// Initialize revenue tracker for all revenue streams
const revenueTracker = new RevenueTracker();

// Connect banking API to exchange
kenostodChain.exchangeAPI.setBankingAPI(bankingAPI);

// Connect merchant incentives to payment gateway
kenostodChain.paymentGateway.merchantIncentives = merchantIncentives;

// Connect revenue tracker to payment gateway and exchange
kenostodChain.paymentGateway.revenueTracker = revenueTracker;
kenostodChain.exchangeAPI.revenueTracker = revenueTracker;

// Initialize PostgreSQL database for corporate/team plans and wealth builder
let dbConnection;
let organizationManager;
let wealthBuilderManager;

(async () => {
    try {
        dbConnection = new DatabaseConnection();
        await dbConnection.initializeSchema();
        organizationManager = new OrganizationManager(dbConnection);
        wealthBuilderManager = new WealthBuilderManager(dbConnection);
        console.log('✅ Organization Manager initialized');
        console.log('✅ Wealth Builder Manager initialized');
    } catch (error) {
        console.error('❌ Error initializing database:', error.message);
        console.log('⚠️  Corporate/Team Plans and Wealth Builder features disabled');
    }
})();

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

// Routes

// Get blockchain info
app.get('/api/blockchain', (req, res) => {
    res.json({
        chain: kenostodChain.chain,
        stats: kenostodChain.getChainStats(),
        pendingTransactions: kenostodChain.pendingTransactions
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

// Get all merchants
app.get('/api/merchant/list/all', (req, res) => {
    try {
        const merchants = kenostodChain.merchantAccount.getAllMerchants();
        res.json({ merchants, count: merchants.length });
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

        const session = await stripeIntegration.createCheckoutSession(
            priceId,
            successUrl,
            cancelUrl,
            customerEmail,
            { plan }
        );

        res.json({ 
            url: session.url,
            sessionId: session.id,
            testMode: session.testMode || false
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

        const session = await stripeIntegration.createCustomerPortalSession(customerId, returnUrl);

        res.json({ 
            url: session.url,
            testMode: session.testMode || false
        });
    } catch (error) {
        console.error('Portal session error:', error);
        res.status(400).json({ error: error.message });
    }
});

app.get('/api/stripe/products', async (req, res) => {
    try {
        const products = await stripeIntegration.listProducts();
        res.json(products);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.get('/api/stripe/prices/:productId?', async (req, res) => {
    try {
        const prices = await stripeIntegration.listPrices(req.params.productId);
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

// Get tier benefits info
app.get('/api/merchant/tiers', (req, res) => {
    try {
        res.json({ tiers: merchantIncentives.tierBenefits });
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

// Get global incentive stats
app.get('/api/merchant/stats', (req, res) => {
    try {
        const stats = merchantIncentives.getGlobalStats();
        res.json(stats);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get available balance (total minus staked)
app.get('/api/merchant/available-balance/:address', (req, res) => {
    try {
        const balance = merchantIncentives.getAvailableBalance(req.params.address);
        res.json(balance);
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

// Award course completion reward
app.post('/api/wealth/rewards/course-complete', async (req, res) => {
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
});

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

// Submit scholarship application
app.post('/api/wealth/scholarships/apply', async (req, res) => {
    if (!wealthBuilderManager) {
        return res.status(503).json({ error: 'Wealth Builder features currently unavailable' });
    }
    
    try {
        const result = await wealthBuilderManager.applyForScholarship(req.body);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

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

// Apply for a job
app.post('/api/wealth/jobs/apply', async (req, res) => {
    if (!wealthBuilderManager) {
        return res.status(503).json({ error: 'Wealth Builder features currently unavailable' });
    }
    
    try {
        const result = await wealthBuilderManager.applyForJob(req.body);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Generate referral code
app.post('/api/wealth/referrals/generate', async (req, res) => {
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
});

// Process referral signup
app.post('/api/wealth/referrals/process', async (req, res) => {
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
});

// Complete referral reward (when referred user completes first course)
app.post('/api/wealth/referrals/complete', async (req, res) => {
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
});

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
        const result = await wealthBuilderManager.calculateWealthSnapshot(walletAddress, email);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== END WEALTH BUILDER PROGRAM API ENDPOINTS ====================

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
    
    // Mine the first block to give miner some tokens
    setTimeout(() => {
        console.log('Mining genesis block...');
        kenostodChain.minePendingTransactions(minerWallet.getAddress());
        console.log(`Miner balance: ${kenostodChain.getBalanceOfAddress(minerWallet.getAddress())} KENO`);
    }, 1000);

    // Start scheduled transaction processor (runs every 30 seconds)
    setInterval(() => {
        const executed = kenostodChain.processScheduledTransactions();
        if (executed.length > 0) {
            console.log(`Processed ${executed.length} scheduled transactions`);
        }
    }, 30000);
    console.log('Scheduled transaction processor started (runs every 30 seconds)');

    // Start recovery request cleanup (runs every hour)
    setInterval(() => {
        kenostodChain.socialRecovery.cleanupExpiredRequests();
    }, 3600000);
    console.log('Social recovery cleanup started (runs every hour)');

    // Start governance proposal checker (runs every hour)
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
});

module.exports = { app, kenostodChain, minerWallet, wallet1, wallet2 };