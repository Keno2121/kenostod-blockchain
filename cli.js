#!/usr/bin/env node

const Blockchain = require('./src/Blockchain');
const Transaction = require('./src/Transaction');
const Wallet = require('./src/Wallet');
const EC = require('elliptic').ec;
const ec = new EC('secp256k1');

// Initialize blockchain
const kenostodChain = new Blockchain();

// Sample wallets for testing
const wallet1 = new Wallet();
const wallet2 = new Wallet();

const args = process.argv.slice(2);
const command = args[0];

switch(command) {
    case 'mine':
        mine();
        break;
    case 'balance':
        checkBalance(args[1]);
        break;
    case 'send':
        sendTokens(args[1], args[2], args[3], args[4]);
        break;
    case 'wallet':
        createWallet();
        break;
    case 'stats':
        showStats();
        break;
    default:
        showHelp();
}

function mine() {
    console.log('Mining block...');
    const miner = new Wallet();
    console.log('Miner address:', miner.getAddress());
    
    kenostodChain.minePendingTransactions(miner.getAddress());
    console.log(`Block mined! Miner balance: ${kenostodChain.getBalanceOfAddress(miner.getAddress())} KENO`);
}

function checkBalance(address) {
    if (!address) {
        console.log('Usage: node cli.js balance <address>');
        return;
    }
    
    const balance = kenostodChain.getBalanceOfAddress(address);
    console.log(`Balance for ${address}: ${balance} KENO`);
}

function sendTokens(fromAddress, toAddress, amount, privateKey) {
    if (!fromAddress || !toAddress || !amount || !privateKey) {
        console.log('Usage: node cli.js send <from_address> <to_address> <amount> <private_key>');
        return;
    }
    
    try {
        const transaction = new Transaction(fromAddress, toAddress, parseFloat(amount));
        const key = ec.keyFromPrivate(privateKey, 'hex');
        transaction.signTransaction(key);
        
        kenostodChain.createTransaction(transaction);
        console.log('Transaction added to pending transactions');
        console.log('Transaction hash:', transaction.calculateHash());
    } catch (error) {
        console.error('Error:', error.message);
    }
}

function createWallet() {
    const newWallet = new Wallet();
    console.log('New Kenostod wallet created!');
    console.log('Address:', newWallet.getAddress());
    console.log('Private Key:', newWallet.getPrivateKey());
    console.log('IMPORTANT: Save your private key securely!');
}

function showStats() {
    const stats = kenostodChain.getChainStats();
    console.log('Kenostod Blockchain Stats:');
    console.log('Token:', stats.tokenName, '(' + stats.tokenSymbol + ')');
    console.log('Total Blocks:', stats.totalBlocks);
    console.log('Total Transactions:', stats.totalTransactions);
    console.log('Mining Difficulty:', stats.difficulty);
    console.log('Pending Transactions:', stats.pendingTransactions);
    console.log('Mining Reward:', stats.miningReward, 'KENO');
    console.log('Chain Valid:', stats.isValid);
}

function showHelp() {
    console.log('Kenostod Blockchain CLI');
    console.log('Available commands:');
    console.log('  mine                                    - Mine a new block');
    console.log('  balance <address>                       - Check balance of address');
    console.log('  send <from> <to> <amount> <private_key> - Send tokens');
    console.log('  wallet                                  - Create new wallet');
    console.log('  stats                                   - Show blockchain statistics');
}