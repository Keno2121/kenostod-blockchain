// KENO Presale DApp

const PRESALE_CONTRACT_ADDRESS = 'YOUR_PRESALE_CONTRACT_ADDRESS';
const KENO_TOKEN_ADDRESS = 'YOUR_KENO_TOKEN_ADDRESS';
const BSC_CHAIN_ID = '0x61';
const BSC_RPC = 'https://data-seed-prebsc-1-s1.binance.org:8545/';
const BSC_TESTNET = true;

const PRESALE_ABI = [
    "function buyTokens() external payable",
    "function getPresaleStatus() external view returns (bool privateSaleActive, bool publicSaleActive, uint256 privateTokensSold, uint256 publicTokensSold, uint256 totalRaised, bool finalized)",
    "function getCurrentPrice() external view returns (uint256)",
    "function isWhitelisted(address) external view returns (bool)",
    "function paused() external view returns (bool)"
];

const KENO_ABI = [
    "function balanceOf(address) external view returns (uint256)",
    "function decimals() external view returns (uint8)"
];

let provider = null;
let signer = null;
let presaleContract = null;
let kenoContract = null;
let userAddress = null;

document.addEventListener('DOMContentLoaded', () => {
    initApp();
    setupEventListeners();
});

function initApp() {
    if (PRESALE_CONTRACT_ADDRESS === 'YOUR_PRESALE_CONTRACT_ADDRESS') {
        showNotice('⚠️ Presale contract not deployed yet. Coming soon!');
        document.getElementById('presaleClosed').style.display = 'block';
        return;
    }
    
    if (typeof window.ethereum !== 'undefined') {
        checkConnection();
    } else {
        showNotice('⚠️ MetaMask not detected. Please install MetaMask to participate.');
    }
}

function setupEventListeners() {
    document.getElementById('connectWallet').addEventListener('click', connectWallet);
    document.getElementById('bnbAmount').addEventListener('input', calculateTokens);
    document.getElementById('buyButton').addEventListener('click', buyTokens);
    
    if (window.ethereum) {
        window.ethereum.on('accountsChanged', handleAccountsChanged);
        window.ethereum.on('chainChanged', () => window.location.reload());
    }
}

async function checkConnection() {
    try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
            await connectWallet();
        }
    } catch (error) {
        console.error('Error checking connection:', error);
    }
}

async function connectWallet() {
    try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        
        const chainId = await window.ethereum.request({ method: 'eth_chainId' });
        if (chainId !== BSC_CHAIN_ID) {
            await switchToBSC();
        }
        
        provider = new ethers.providers.Web3Provider(window.ethereum);
        signer = provider.getSigner();
        userAddress = accounts[0];
        
        presaleContract = new ethers.Contract(PRESALE_CONTRACT_ADDRESS, PRESALE_ABI, signer);
        kenoContract = new ethers.Contract(KENO_TOKEN_ADDRESS, KENO_ABI, provider);
        
        updateWalletInfo();
        await loadPresaleStatus();
        
        document.getElementById('connectWallet').textContent = 'Connected';
        document.getElementById('connectWallet').classList.add('connected');
        document.getElementById('walletInfo').style.display = 'block';
        document.getElementById('notConnected').style.display = 'none';
        document.getElementById('presaleForm').style.display = 'block';
        
    } catch (error) {
        console.error('Connection error:', error);
        showError('Failed to connect wallet: ' + error.message);
    }
}

async function switchToBSC() {
    try {
        await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: BSC_CHAIN_ID }],
        });
    } catch (switchError) {
        if (switchError.code === 4902) {
            await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [{
                    chainId: BSC_CHAIN_ID,
                    chainName: 'Binance Smart Chain',
                    nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
                    rpcUrls: [BSC_RPC],
                    blockExplorerUrls: ['https://bscscan.com/']
                }],
            });
        } else {
            throw switchError;
        }
    }
}

async function updateWalletInfo() {
    const shortAddress = userAddress.slice(0, 6) + '...' + userAddress.slice(-4);
    document.getElementById('walletAddress').textContent = shortAddress;
    
    const balance = await provider.getBalance(userAddress);
    const bnbBalance = ethers.utils.formatEther(balance);
    document.getElementById('walletBalance').textContent = parseFloat(bnbBalance).toFixed(4);
}

async function loadPresaleStatus() {
    try {
        const status = await presaleContract.getPresaleStatus();
        const currentPrice = await presaleContract.getCurrentPrice();
        const isPaused = await presaleContract.paused();
        
        const privateSaleActive = status.privateSaleActive;
        const publicSaleActive = status.publicSaleActive;
        const privateTokensSold = parseFloat(ethers.utils.formatEther(status.privateTokensSold));
        const publicTokensSold = parseFloat(ethers.utils.formatEther(status.publicTokensSold));
        const totalRaised = parseFloat(ethers.utils.formatEther(status.totalRaised));
        
        const totalSold = (privateTokensSold + publicTokensSold) / 1000000;
        document.getElementById('tokensSold').textContent = totalSold.toFixed(2) + 'M';
        
        const avgPrice = totalRaised > 0 ? totalRaised / (privateTokensSold + publicTokensSold) : 0;
        document.getElementById('totalRaised').textContent = '$' + (totalRaised * 300).toFixed(0);
        
        const priceInUSD = parseFloat(ethers.utils.formatEther(currentPrice)) * 300;
        document.getElementById('currentPrice').textContent = '$' + priceInUSD.toFixed(3);
        
        if (isPaused) {
            document.getElementById('salePhase').textContent = 'PAUSED';
            document.getElementById('presaleForm').style.display = 'none';
            document.getElementById('presaleClosed').style.display = 'block';
            document.querySelector('.presale-closed p').textContent = '⏸️ Presale is temporarily paused';
        } else if (privateSaleActive) {
            document.getElementById('salePhase').textContent = 'Private Sale';
            document.getElementById('maxPurchase').textContent = '5';
            const isWhitelisted = await presaleContract.isWhitelisted(userAddress);
            if (!isWhitelisted) {
                showError('You are not whitelisted for the private sale. Please wait for the public sale.');
                document.getElementById('buyButton').disabled = true;
            }
        } else if (publicSaleActive) {
            document.getElementById('salePhase').textContent = 'Public Sale';
            document.getElementById('maxPurchase').textContent = '2';
        } else {
            document.getElementById('salePhase').textContent = 'Not Active';
            document.getElementById('presaleForm').style.display = 'none';
            document.getElementById('presaleClosed').style.display = 'block';
        }
        
    } catch (error) {
        console.error('Error loading presale status:', error);
        showError('Failed to load presale data');
    }
}

async function calculateTokens() {
    const bnbAmount = parseFloat(document.getElementById('bnbAmount').value) || 0;
    
    if (bnbAmount < 0.01) {
        document.getElementById('kenoAmount').textContent = '0 KENO';
        document.getElementById('buyButton').disabled = true;
        return;
    }
    
    try {
        const currentPrice = await presaleContract.getCurrentPrice();
        const priceInEth = parseFloat(ethers.utils.formatEther(currentPrice));
        const kenoAmount = bnbAmount / priceInEth;
        
        document.getElementById('kenoAmount').textContent = kenoAmount.toLocaleString() + ' KENO';
        document.getElementById('buyButton').disabled = false;
        
    } catch (error) {
        console.error('Error calculating tokens:', error);
        document.getElementById('kenoAmount').textContent = '0 KENO';
    }
}

async function buyTokens() {
    const bnbAmount = document.getElementById('bnbAmount').value;
    
    if (!bnbAmount || parseFloat(bnbAmount) < 0.01) {
        showError('Please enter a valid amount (min 0.01 BNB)');
        return;
    }
    
    const maxPurchase = document.getElementById('salePhase').textContent === 'Private Sale' ? 5 : 2;
    if (parseFloat(bnbAmount) > maxPurchase) {
        showError(`Maximum purchase is ${maxPurchase} BNB`);
        return;
    }
    
    try {
        document.getElementById('buyButton').disabled = true;
        showTransactionStatus('Waiting for transaction approval...', 'pending');
        
        const tx = await presaleContract.buyTokens({
            value: ethers.utils.parseEther(bnbAmount)
        });
        
        showTransactionStatus('Transaction submitted! Waiting for confirmation...', 'pending');
        
        const receipt = await tx.wait();
        
        showTransactionStatus('✅ Success! Tokens purchased successfully!', 'success');
        
        document.getElementById('bnbAmount').value = '';
        document.getElementById('kenoAmount').textContent = '0 KENO';
        
        await updateWalletInfo();
        await loadPresaleStatus();
        
        setTimeout(() => {
            document.getElementById('transactionStatus').style.display = 'none';
            document.getElementById('buyButton').disabled = false;
        }, 5000);
        
    } catch (error) {
        console.error('Purchase error:', error);
        let errorMsg = 'Transaction failed: ';
        
        if (error.code === 4001) {
            errorMsg += 'User rejected transaction';
        } else if (error.message.includes('insufficient funds')) {
            errorMsg += 'Insufficient BNB balance';
        } else if (error.message.includes('not whitelisted')) {
            errorMsg += 'You are not whitelisted for the private sale';
        } else if (error.message.includes('exceeds')) {
            errorMsg += 'Purchase amount exceeds limit';
        } else {
            errorMsg += error.message || 'Unknown error';
        }
        
        showTransactionStatus(errorMsg, 'error');
        document.getElementById('buyButton').disabled = false;
    }
}

function showTransactionStatus(message, type) {
    const statusEl = document.getElementById('transactionStatus');
    statusEl.textContent = message;
    statusEl.className = 'tx-status ' + type;
    statusEl.style.display = 'block';
}

function showError(message) {
    showTransactionStatus(message, 'error');
}

function showNotice(message) {
    const notice = document.createElement('div');
    notice.className = 'not-connected';
    notice.textContent = message;
    document.querySelector('.presale-card').prepend(notice);
}

function handleAccountsChanged(accounts) {
    if (accounts.length === 0) {
        window.location.reload();
    } else if (accounts[0] !== userAddress) {
        window.location.reload();
    }
}

setInterval(() => {
    if (presaleContract && userAddress) {
        loadPresaleStatus();
        updateWalletInfo();
    }
}, 30000);
