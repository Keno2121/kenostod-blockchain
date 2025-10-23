const express = require('express');
const cors = require('cors');
const Blockchain = require('./src/Blockchain');
const Transaction = require('./src/Transaction');
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
        const { fromAddress, toAddress, amount, fee = 1, signature, timestamp } = req.body;
        
        if (!fromAddress || !toAddress || !amount || !signature) {
            return res.status(400).json({ error: 'Missing required fields: fromAddress, toAddress, amount, signature' });
        }

        // Create transaction with provided signature
        const transaction = new Transaction(fromAddress, toAddress, amount, fee);
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
                timestamp: transaction.timestamp
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
});

module.exports = { app, kenostodChain, minerWallet, wallet1, wallet2 };