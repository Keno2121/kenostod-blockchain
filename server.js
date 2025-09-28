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

// Create a new transaction
app.post('/api/transaction', (req, res) => {
    try {
        const { fromAddress, toAddress, amount, privateKey, fee = 1 } = req.body;
        
        if (!fromAddress || !toAddress || !amount || !privateKey) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Create and sign transaction
        const transaction = new Transaction(fromAddress, toAddress, amount, fee);
        const key = ec.keyFromPrivate(privateKey, 'hex');
        transaction.signTransaction(key);

        // Add to blockchain
        kenostodChain.createTransaction(transaction);

        res.json({
            message: 'Transaction created successfully',
            transaction: transaction
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
        privateKey: newWallet.getPrivateKey()
    });
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

// Root endpoint with API documentation
app.get('/', (req, res) => {
    res.json({
        message: 'Welcome to Kenostod Blockchain!',
        tokenName: kenostodChain.tokenName,
        tokenSymbol: kenostodChain.tokenSymbol,
        endpoints: {
            'GET /api/blockchain': 'Get full blockchain data',
            'GET /api/balance/:address': 'Get balance for address',
            'GET /api/transactions/:address': 'Get transactions for address',
            'POST /api/transaction': 'Create new transaction',
            'POST /api/mine': 'Mine pending transactions',
            'POST /api/wallet/create': 'Create new wallet',
            'GET /api/stats': 'Get blockchain statistics',
            'GET /api/validate': 'Validate blockchain integrity'
        },
        testWallets: {
            miner: {
                address: minerWallet.getAddress(),
                privateKey: minerWallet.getPrivateKey()
            },
            wallet1: {
                address: wallet1.getAddress(),
                privateKey: wallet1.getPrivateKey()
            },
            wallet2: {
                address: wallet2.getAddress(),
                privateKey: wallet2.getPrivateKey()
            }
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