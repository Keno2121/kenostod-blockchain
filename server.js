const express = require('express');
const cors = require('cors');
const Blockchain = require('./src/Blockchain');
const Transaction = require('./src/Transaction');
const ScheduledTransaction = require('./src/ScheduledTransaction');
const Wallet = require('./src/Wallet');
const EC = require('elliptic').ec;
const ec = new EC('secp256k1');

const app = express();
const PORT = 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Initialize blockchain
const kenostodChain = new Blockchain();

// Create some test wallets
const minerWallet = new Wallet();
const wallet1 = new Wallet();
const wallet2 = new Wallet();

console.log('Kenostod Blockchain initialized!');
console.log('Miner address:', minerWallet.getAddress());
console.log('Test wallet 1 address:', wallet1.getAddress());
console.log('Test wallet 2 address:', wallet2.getAddress());

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

        res.json({
            message: 'Block mined successfully!',
            balance: kenostodChain.getBalanceOfAddress(minerAddress),
            blockHeight: kenostodChain.chain.length
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

// Simple transaction endpoint (signs and creates transaction server-side)
app.post('/api/transaction/simple', (req, res) => {
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

// Helper endpoint to sign transactions (for development only)
app.post('/api/sign', (req, res) => {
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

// Validate blockchain
app.get('/api/validate', (req, res) => {
    const isValid = kenostodChain.isChainValid();
    
    res.json({
        isValid: isValid,
        message: isValid ? 'Blockchain is valid' : 'Blockchain is corrupted!'
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
            'GET /api/balance/:address': 'Get balance for address',
            'GET /api/transactions/:address': 'Get transactions for address',
            'POST /api/transaction': 'Submit pre-signed transaction (requires signature)',
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

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Kenostod Blockchain server running on http://0.0.0.0:${PORT}`);
    console.log('API Documentation available at: http://localhost:5000');
    
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