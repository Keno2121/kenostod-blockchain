const fs = require('fs');
const path = require('path');

class DataPersistence {
    constructor(dataDir = './data') {
        this.dataDir = dataDir;
        this.blockchainFile = path.join(dataDir, 'blockchain.json');
        this.walletFile = path.join(dataDir, 'miner_wallet.json');
        this.fiatBalancesFile = path.join(dataDir, 'fiat_balances.json');
        
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
    }

    saveBlockchain(blockchain) {
        try {
            const data = {
                chain: blockchain.chain,
                difficulty: blockchain.difficulty,
                miningReward: blockchain.miningReward,
                pendingTransactions: blockchain.pendingTransactions,
                scheduledTransactions: blockchain.scheduledTransactions,
                socialRecovery: blockchain.socialRecovery,
                reputationSystem: blockchain.reputationSystem,
                governance: blockchain.governance,
                totalMinted: blockchain.totalMinted,
                totalBurned: blockchain.totalBurned,
                timestamp: Date.now()
            };
            
            fs.writeFileSync(this.blockchainFile, JSON.stringify(data, null, 2));
            console.log('✅ Blockchain saved to disk');
            return true;
        } catch (error) {
            console.error('❌ Error saving blockchain:', error.message);
            return false;
        }
    }

    loadBlockchain() {
        try {
            if (!fs.existsSync(this.blockchainFile)) {
                console.log('ℹ️  No saved blockchain found, starting fresh');
                return null;
            }
            
            const data = JSON.parse(fs.readFileSync(this.blockchainFile, 'utf8'));
            console.log(`✅ Loaded blockchain from disk (${data.chain.length} blocks, last saved: ${new Date(data.timestamp).toLocaleString()})`);
            return data;
        } catch (error) {
            console.error('❌ Error loading blockchain:', error.message);
            return null;
        }
    }

    saveWallet(wallet) {
        try {
            const data = {
                privateKey: wallet.privateKey,
                publicKey: wallet.publicKey,
                address: wallet.getAddress(),
                timestamp: Date.now()
            };
            
            fs.writeFileSync(this.walletFile, JSON.stringify(data, null, 2));
            console.log('✅ Miner wallet saved to disk');
            return true;
        } catch (error) {
            console.error('❌ Error saving wallet:', error.message);
            return false;
        }
    }

    loadWallet() {
        try {
            if (!fs.existsSync(this.walletFile)) {
                console.log('ℹ️  No saved wallet found, creating new one');
                return null;
            }
            
            const data = JSON.parse(fs.readFileSync(this.walletFile, 'utf8'));
            console.log(`✅ Loaded miner wallet from disk (address: ${data.address})`);
            return data;
        } catch (error) {
            console.error('❌ Error loading wallet:', error.message);
            return null;
        }
    }

    saveFiatBalances(fiatBalancesMap) {
        try {
            const data = {
                balances: Array.from(fiatBalancesMap.entries()),
                timestamp: Date.now()
            };
            
            fs.writeFileSync(this.fiatBalancesFile, JSON.stringify(data, null, 2));
            console.log(`✅ Fiat balances saved to disk (${data.balances.length} accounts)`);
            return true;
        } catch (error) {
            console.error('❌ Error saving fiat balances:', error.message);
            return false;
        }
    }

    loadFiatBalances() {
        try {
            if (!fs.existsSync(this.fiatBalancesFile)) {
                console.log('ℹ️  No saved fiat balances found, starting fresh');
                return null;
            }
            
            const data = JSON.parse(fs.readFileSync(this.fiatBalancesFile, 'utf8'));
            const balancesMap = new Map(data.balances);
            console.log(`✅ Loaded fiat balances from disk (${balancesMap.size} accounts, last saved: ${new Date(data.timestamp).toLocaleString()})`);
            return balancesMap;
        } catch (error) {
            console.error('❌ Error loading fiat balances:', error.message);
            return null;
        }
    }

    getBackupInfo() {
        const backupInfo = {
            blockchainExists: fs.existsSync(this.blockchainFile),
            walletExists: fs.existsSync(this.walletFile),
            fiatBalancesExists: fs.existsSync(this.fiatBalancesFile)
        };

        if (backupInfo.blockchainExists) {
            const stats = fs.statSync(this.blockchainFile);
            backupInfo.blockchainSize = stats.size;
            backupInfo.blockchainLastModified = stats.mtime;
        }

        if (backupInfo.walletExists) {
            const stats = fs.statSync(this.walletFile);
            backupInfo.walletSize = stats.size;
            backupInfo.walletLastModified = stats.mtime;
        }

        if (backupInfo.fiatBalancesExists) {
            const stats = fs.statSync(this.fiatBalancesFile);
            backupInfo.fiatBalancesSize = stats.size;
            backupInfo.fiatBalancesLastModified = stats.mtime;
        }

        return backupInfo;
    }
}

module.exports = DataPersistence;
