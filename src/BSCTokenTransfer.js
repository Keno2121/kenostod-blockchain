const { ethers } = require('ethers');
const fs = require('fs');

class BSCTokenTransfer {
    constructor() {
        this.KENO_TOKEN_ADDRESS = '0x65791E0B5Cbac5F40c76cDe31bf4F074D982FD0E';
        this.BSC_RPC_URL = 'https://bsc-dataseed.binance.org/';
        this.BSC_CHAIN_ID = 56;
        
        this.provider = null;
        this.wallet = null;
        this.kenoContract = null;
        this.initialized = false;
        
        this.kenoABI = JSON.parse(fs.readFileSync('./public/KENO-abi.json', 'utf8'));
    }
    
    initialize() {
        const privateKey = process.env.KENO_DISTRIBUTION_WALLET_KEY;
        
        if (!privateKey) {
            console.log('⚠️  BSC Token Transfer: KENO_DISTRIBUTION_WALLET_KEY not configured');
            console.log('   Token transfers will be recorded but not executed on-chain');
            return false;
        }
        
        try {
            // ethers v6 syntax
            this.provider = new ethers.JsonRpcProvider(this.BSC_RPC_URL);
            this.wallet = new ethers.Wallet(privateKey, this.provider);
            this.kenoContract = new ethers.Contract(
                this.KENO_TOKEN_ADDRESS, 
                this.kenoABI, 
                this.wallet
            );
            this.initialized = true;
            console.log(`✅ BSC Token Transfer initialized`);
            console.log(`   Distribution wallet: ${this.wallet.address}`);
            return true;
        } catch (error) {
            console.error('❌ BSC Token Transfer initialization failed:', error.message);
            return false;
        }
    }
    
    async getDistributionWalletBalance() {
        if (!this.initialized) {
            return { keno: '0', bnb: '0' };
        }
        
        try {
            const kenoBalance = await this.kenoContract.balanceOf(this.wallet.address);
            const bnbBalance = await this.provider.getBalance(this.wallet.address);
            
            return {
                keno: ethers.formatUnits(kenoBalance, 18),
                bnb: ethers.formatEther(bnbBalance),
                kenoRaw: kenoBalance.toString(),
                bnbRaw: bnbBalance.toString()
            };
        } catch (error) {
            console.error('Error fetching wallet balance:', error.message);
            return { keno: '0', bnb: '0', error: error.message };
        }
    }
    
    async transferTokens(toAddress, amount, orderId = null) {
        if (!this.initialized) {
            return {
                success: false,
                error: 'BSC Token Transfer not initialized. Configure KENO_DISTRIBUTION_WALLET_KEY.',
                txHash: null
            };
        }
        
        if (!ethers.isAddress(toAddress)) {
            return {
                success: false,
                error: 'Invalid recipient address',
                txHash: null
            };
        }
        
        try {
            // ethers v6 syntax
            const amountWei = ethers.parseUnits(amount.toString(), 18);
            
            const balance = await this.kenoContract.balanceOf(this.wallet.address);
            if (balance < amountWei) {
                return {
                    success: false,
                    error: `Insufficient KENO balance. Have: ${ethers.formatUnits(balance, 18)}, Need: ${amount}`,
                    txHash: null
                };
            }
            
            const bnbBalance = await this.provider.getBalance(this.wallet.address);
            const minBNB = ethers.parseEther('0.0005');
            if (bnbBalance < minBNB) {
                return {
                    success: false,
                    error: `Insufficient BNB for gas. Have: ${ethers.formatEther(bnbBalance)} BNB`,
                    txHash: null
                };
            }
            
            console.log(`📤 Sending ${amount} KENO to ${toAddress}...`);
            
            const tx = await this.kenoContract.transfer(toAddress, amountWei, {
                gasLimit: 100000
            });
            
            console.log(`⏳ Transaction submitted: ${tx.hash}`);
            console.log(`   Waiting for confirmation...`);
            
            const receipt = await tx.wait();
            
            if (receipt.status === 1) {
                console.log(`✅ Transfer successful!`);
                console.log(`   TX Hash: ${tx.hash}`);
                console.log(`   Block: ${receipt.blockNumber}`);
                console.log(`   Gas Used: ${receipt.gasUsed.toString()}`);
                
                return {
                    success: true,
                    txHash: tx.hash,
                    blockNumber: receipt.blockNumber,
                    gasUsed: receipt.gasUsed.toString(),
                    amount: amount,
                    recipient: toAddress,
                    orderId: orderId
                };
            } else {
                return {
                    success: false,
                    error: 'Transaction failed on-chain',
                    txHash: tx.hash
                };
            }
            
        } catch (error) {
            console.error(`❌ Transfer failed:`, error.message);
            
            let errorMessage = error.message;
            if (error.code === 'INSUFFICIENT_FUNDS') {
                errorMessage = 'Insufficient BNB for gas fees';
            } else if (error.code === 'UNPREDICTABLE_GAS_LIMIT') {
                errorMessage = 'Token transfer would fail (check whitelist or balance)';
            }
            
            return {
                success: false,
                error: errorMessage,
                txHash: null
            };
        }
    }
    
    async sweepPendingTransfers(pendingPurchases) {
        if (!this.initialized) {
            return {
                success: false,
                error: 'BSC Token Transfer not initialized',
                results: []
            };
        }
        
        const results = [];
        let successCount = 0;
        let failCount = 0;
        
        for (const purchase of pendingPurchases) {
            if (purchase.tokensSent) {
                console.log(`⏭️  Skipping ${purchase.orderId} - already sent`);
                continue;
            }
            
            console.log(`\n📦 Processing order ${purchase.orderId}...`);
            console.log(`   Recipient: ${purchase.walletAddress}`);
            console.log(`   Tokens: ${purchase.tokens} KENO`);
            
            const result = await this.transferTokens(
                purchase.walletAddress,
                purchase.tokens,
                purchase.orderId
            );
            
            results.push({
                orderId: purchase.orderId,
                walletAddress: purchase.walletAddress,
                tokens: purchase.tokens,
                ...result
            });
            
            if (result.success) {
                successCount++;
            } else {
                failCount++;
            }
            
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        return {
            success: true,
            totalProcessed: results.length,
            successCount,
            failCount,
            results
        };
    }
    
    getStatus() {
        return {
            initialized: this.initialized,
            distributionWallet: this.wallet ? this.wallet.address : null,
            tokenContract: this.KENO_TOKEN_ADDRESS,
            network: 'Binance Smart Chain (BSC Mainnet)',
            chainId: this.BSC_CHAIN_ID
        };
    }
}

module.exports = BSCTokenTransfer;
