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
const DataPersistence = require('./src/DataPersistence');
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
                break;
            case 'customer.subscription.created':
                console.log('✅ Subscription created:', event.data.object.id);
                break;
            case 'customer.subscription.updated':
                console.log('🔄 Subscription updated:', event.data.object.id);
                break;
            case 'customer.subscription.deleted':
                console.log('❌ Subscription cancelled:', event.data.object.id);
                break;
            case 'invoice.payment_succeeded':
                console.log('💰 Payment succeeded:', event.data.object.id);
                break;
            case 'invoice.payment_failed':
                console.log('⚠️  Payment failed:', event.data.object.id);
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

// Connect banking API to exchange
kenostodChain.exchangeAPI.setBankingAPI(bankingAPI);

// Connect merchant incentives to payment gateway
kenostodChain.paymentGateway.merchantIncentives = merchantIncentives;

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
        kenostodChain.checkAndExecuteProposals();
    }, 3600000);
    console.log('Governance proposal checker started (runs every hour)');
});

module.exports = { app, kenostodChain, minerWallet, wallet1, wallet2 };