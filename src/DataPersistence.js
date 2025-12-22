const fs = require('fs');
const path = require('path');

class DataPersistence {
    constructor(dataDir = './data') {
        this.dataDir = dataDir;
        this.blockchainFile = path.join(dataDir, 'blockchain.json');
        this.walletFile = path.join(dataDir, 'miner_wallet.json');
        this.fiatBalancesFile = path.join(dataDir, 'fiat_balances.json');
        this.organizationsFile = path.join(dataDir, 'organizations.json');
        this.organizationMembersFile = path.join(dataDir, 'organization_members.json');
        this.teamSubscriptionsFile = path.join(dataDir, 'team_subscriptions.json');
        this.learningProgressFile = path.join(dataDir, 'learning_progress.json');
        this.icoPurchasesFile = path.join(dataDir, 'ico_purchases.json');
        this.preOrdersFile = path.join(dataDir, 'pre_order_sell_orders.json');
        this.miningGrantsFile = path.join(dataDir, 'mining_grants.json');
        
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

    saveOrganizations(organizationsMap) {
        try {
            const data = {
                organizations: Array.from(organizationsMap.entries()),
                timestamp: Date.now()
            };
            
            fs.writeFileSync(this.organizationsFile, JSON.stringify(data, null, 2));
            console.log(`✅ Organizations saved to disk (${data.organizations.length} orgs)`);
            return true;
        } catch (error) {
            console.error('❌ Error saving organizations:', error.message);
            return false;
        }
    }

    loadOrganizations() {
        try {
            if (!fs.existsSync(this.organizationsFile)) {
                console.log('ℹ️  No saved organizations found, starting fresh');
                return new Map();
            }
            
            const data = JSON.parse(fs.readFileSync(this.organizationsFile, 'utf8'));
            const organizationsMap = new Map(data.organizations);
            console.log(`✅ Loaded organizations from disk (${organizationsMap.size} orgs, last saved: ${new Date(data.timestamp).toLocaleString()})`);
            return organizationsMap;
        } catch (error) {
            console.error('❌ Error loading organizations:', error.message);
            return new Map();
        }
    }

    saveOrganizationMembers(membersMap) {
        try {
            const data = {
                members: Array.from(membersMap.entries()),
                timestamp: Date.now()
            };
            
            fs.writeFileSync(this.organizationMembersFile, JSON.stringify(data, null, 2));
            console.log(`✅ Organization members saved to disk (${data.members.length} members)`);
            return true;
        } catch (error) {
            console.error('❌ Error saving organization members:', error.message);
            return false;
        }
    }

    loadOrganizationMembers() {
        try {
            if (!fs.existsSync(this.organizationMembersFile)) {
                console.log('ℹ️  No saved organization members found, starting fresh');
                return new Map();
            }
            
            const data = JSON.parse(fs.readFileSync(this.organizationMembersFile, 'utf8'));
            const membersMap = new Map(data.members);
            console.log(`✅ Loaded organization members from disk (${membersMap.size} members, last saved: ${new Date(data.timestamp).toLocaleString()})`);
            return membersMap;
        } catch (error) {
            console.error('❌ Error loading organization members:', error.message);
            return new Map();
        }
    }

    saveTeamSubscriptions(subscriptionsMap) {
        try {
            const data = {
                subscriptions: Array.from(subscriptionsMap.entries()),
                timestamp: Date.now()
            };
            
            fs.writeFileSync(this.teamSubscriptionsFile, JSON.stringify(data, null, 2));
            console.log(`✅ Team subscriptions saved to disk (${data.subscriptions.length} subscriptions)`);
            return true;
        } catch (error) {
            console.error('❌ Error saving team subscriptions:', error.message);
            return false;
        }
    }

    loadTeamSubscriptions() {
        try {
            if (!fs.existsSync(this.teamSubscriptionsFile)) {
                console.log('ℹ️  No saved team subscriptions found, starting fresh');
                return new Map();
            }
            
            const data = JSON.parse(fs.readFileSync(this.teamSubscriptionsFile, 'utf8'));
            const subscriptionsMap = new Map(data.subscriptions);
            console.log(`✅ Loaded team subscriptions from disk (${subscriptionsMap.size} subscriptions, last saved: ${new Date(data.timestamp).toLocaleString()})`);
            return subscriptionsMap;
        } catch (error) {
            console.error('❌ Error loading team subscriptions:', error.message);
            return new Map();
        }
    }

    saveLearningProgress(progressMap) {
        try {
            const data = {
                progress: Array.from(progressMap.entries()),
                timestamp: Date.now()
            };
            
            fs.writeFileSync(this.learningProgressFile, JSON.stringify(data, null, 2));
            console.log(`✅ Learning progress saved to disk (${data.progress.length} records)`);
            return true;
        } catch (error) {
            console.error('❌ Error saving learning progress:', error.message);
            return false;
        }
    }

    loadLearningProgress() {
        try {
            if (!fs.existsSync(this.learningProgressFile)) {
                console.log('ℹ️  No saved learning progress found, starting fresh');
                return new Map();
            }
            
            const data = JSON.parse(fs.readFileSync(this.learningProgressFile, 'utf8'));
            const progressMap = new Map(data.progress);
            console.log(`✅ Loaded learning progress from disk (${progressMap.size} records, last saved: ${new Date(data.timestamp).toLocaleString()})`);
            return progressMap;
        } catch (error) {
            console.error('❌ Error loading learning progress:', error.message);
            return new Map();
        }
    }

    saveICOPurchases(purchases) {
        try {
            const data = {
                purchases,
                timestamp: Date.now()
            };
            
            fs.writeFileSync(this.icoPurchasesFile, JSON.stringify(data, null, 2));
            console.log(`✅ ICO purchases saved to disk (${purchases.length} purchases)`);
            return true;
        } catch (error) {
            console.error('❌ Error saving ICO purchases:', error.message);
            return false;
        }
    }

    loadICOPurchases() {
        try {
            if (!fs.existsSync(this.icoPurchasesFile)) {
                console.log('ℹ️  No saved ICO purchases found, starting fresh');
                return [];
            }
            
            const data = JSON.parse(fs.readFileSync(this.icoPurchasesFile, 'utf8'));
            console.log(`✅ Loaded ICO purchases from disk (${data.purchases.length} purchases, last saved: ${new Date(data.timestamp).toLocaleString()})`);
            return data.purchases;
        } catch (error) {
            console.error('❌ Error loading ICO purchases:', error.message);
            return [];
        }
    }

    savePreOrders(preOrders) {
        try {
            const data = {
                preOrders,
                timestamp: Date.now()
            };
            
            fs.writeFileSync(this.preOrdersFile, JSON.stringify(data, null, 2));
            console.log(`✅ Pre-order sell orders saved to disk (${preOrders.length} orders)`);
            return true;
        } catch (error) {
            console.error('❌ Error saving pre-orders:', error.message);
            return false;
        }
    }

    loadPreOrders() {
        try {
            if (!fs.existsSync(this.preOrdersFile)) {
                console.log('ℹ️  No saved pre-orders found, starting fresh');
                return [];
            }
            
            const data = JSON.parse(fs.readFileSync(this.preOrdersFile, 'utf8'));
            console.log(`✅ Loaded pre-order sell orders from disk (${data.preOrders.length} orders, last saved: ${new Date(data.timestamp).toLocaleString()})`);
            return data.preOrders;
        } catch (error) {
            console.error('❌ Error loading pre-orders:', error.message);
            return [];
        }
    }

    saveMiningGrants(miningGrants) {
        try {
            const data = {
                miningGrants,
                timestamp: Date.now()
            };
            fs.writeFileSync(this.miningGrantsFile, JSON.stringify(data, null, 2));
            console.log(`✅ Mining grants saved to disk (${miningGrants.length} applications)`);
            return true;
        } catch (error) {
            console.error('❌ Error saving mining grants:', error.message);
            return false;
        }
    }

    loadMiningGrants() {
        try {
            if (!fs.existsSync(this.miningGrantsFile)) {
                console.log('ℹ️  No saved mining grants found, starting fresh');
                return [];
            }
            const data = JSON.parse(fs.readFileSync(this.miningGrantsFile, 'utf8'));
            console.log(`✅ Loaded mining grants from disk (${data.miningGrants.length} applications)`);
            return data.miningGrants;
        } catch (error) {
            console.error('❌ Error loading mining grants:', error.message);
            return [];
        }
    }

    getBackupInfo() {
        const backupInfo = {
            blockchainExists: fs.existsSync(this.blockchainFile),
            walletExists: fs.existsSync(this.walletFile),
            fiatBalancesExists: fs.existsSync(this.fiatBalancesFile),
            organizationsExists: fs.existsSync(this.organizationsFile),
            organizationMembersExists: fs.existsSync(this.organizationMembersFile),
            teamSubscriptionsExists: fs.existsSync(this.teamSubscriptionsFile),
            learningProgressExists: fs.existsSync(this.learningProgressFile),
            icoPurchasesExists: fs.existsSync(this.icoPurchasesFile)
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

        if (backupInfo.organizationsExists) {
            const stats = fs.statSync(this.organizationsFile);
            backupInfo.organizationsSize = stats.size;
            backupInfo.organizationsLastModified = stats.mtime;
        }

        if (backupInfo.organizationMembersExists) {
            const stats = fs.statSync(this.organizationMembersFile);
            backupInfo.organizationMembersSize = stats.size;
            backupInfo.organizationMembersLastModified = stats.mtime;
        }

        if (backupInfo.teamSubscriptionsExists) {
            const stats = fs.statSync(this.teamSubscriptionsFile);
            backupInfo.teamSubscriptionsSize = stats.size;
            backupInfo.teamSubscriptionsLastModified = stats.mtime;
        }

        if (backupInfo.learningProgressExists) {
            const stats = fs.statSync(this.learningProgressFile);
            backupInfo.learningProgressSize = stats.size;
            backupInfo.learningProgressLastModified = stats.mtime;
        }

        return backupInfo;
    }

    save(key, data) {
        try {
            const filename = path.join(this.dataDir, `${key}.json`);
            const dataWithTimestamp = {
                ...data,
                lastSaved: new Date().toISOString()
            };
            fs.writeFileSync(filename, JSON.stringify(dataWithTimestamp, null, 2));
            console.log(`✅ Saved ${key} to disk`);
            return true;
        } catch (error) {
            console.error(`❌ Error saving ${key}:`, error.message);
            return false;
        }
    }

    load(key) {
        try {
            const filename = path.join(this.dataDir, `${key}.json`);
            if (!fs.existsSync(filename)) {
                return null;
            }
            const data = JSON.parse(fs.readFileSync(filename, 'utf8'));
            return data;
        } catch (error) {
            console.error(`❌ Error loading ${key}:`, error.message);
            return null;
        }
    }
}

module.exports = DataPersistence;
