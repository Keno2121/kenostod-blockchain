const BSC_CHAIN_ID = '0x38';
const BSC_RPC_URL = 'https://bsc-dataseed.binance.org/';
const KENO_TOKEN_ADDRESS = '0x65791E0B5Cbac5F40c76cDe31bf4F074D982FD0E';
const PRESALE_CONTRACT_ADDRESS = '0xE26D6fcf7f3d560a8acEB43fa904Bef31b1fB6D0';

let web3Provider = null;
let kenoContract = null;
let presaleContract = null;
let userAddress = null;
let kenoABI = null;
let presaleABI = null;

async function loadABIs() {
    try {
        const kenoResponse = await fetch('/KENO-abi.json');
        kenoABI = await kenoResponse.json();
        
        const presaleResponse = await fetch('/KENOPresale-abi.json');
        presaleABI = await presaleResponse.json();
        
        console.log('✅ Contract ABIs loaded');
    } catch (error) {
        console.error('Failed to load ABIs:', error);
        showError('Failed to load contract interfaces');
    }
}

async function connectWallet() {
    if (typeof window.ethereum === 'undefined') {
        showError('MetaMask is not installed! Please install MetaMask to participate in the ICO.');
        window.open('https://metamask.io/download/', '_blank');
        return;
    }

    try {
        updateStatus('Connecting to MetaMask...', 'info');
        
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        userAddress = accounts[0];
        
        await switchToBSC();
        
        web3Provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = web3Provider.getSigner();
        
        kenoContract = new ethers.Contract(KENO_TOKEN_ADDRESS, kenoABI, signer);
        presaleContract = new ethers.Contract(PRESALE_CONTRACT_ADDRESS, presaleABI, signer);
        
        document.getElementById('walletAddress').textContent = 
            userAddress.slice(0, 6) + '...' + userAddress.slice(-4);
        document.getElementById('connectBtn').style.display = 'none';
        document.getElementById('walletInfo').style.display = 'block';
        
        updateStatus('Wallet connected successfully!', 'success');
        
        await loadSaleInfo();
        await loadUserBalance();
        
        window.ethereum.on('accountsChanged', handleAccountsChanged);
        window.ethereum.on('chainChanged', () => window.location.reload());
        
    } catch (error) {
        console.error('Connection error:', error);
        if (error.code === 4001) {
            showError('Connection rejected. Please approve the connection in MetaMask.');
        } else {
            showError('Failed to connect wallet: ' + error.message);
        }
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
            try {
                await window.ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [{
                        chainId: BSC_CHAIN_ID,
                        chainName: 'Binance Smart Chain',
                        nativeCurrency: {
                            name: 'BNB',
                            symbol: 'BNB',
                            decimals: 18
                        },
                        rpcUrls: [BSC_RPC_URL],
                        blockExplorerUrls: ['https://bscscan.com/']
                    }],
                });
            } catch (addError) {
                throw new Error('Failed to add BSC network to MetaMask');
            }
        } else {
            throw switchError;
        }
    }
}

async function loadSaleInfo() {
    try {
        const isPrivateSaleActive = await presaleContract.isPrivateSaleActive();
        const isPublicSaleActive = await presaleContract.isPublicSaleActive();
        const isPaused = await presaleContract.paused();
        
        const privateSalePrice = await presaleContract.PRIVATE_SALE_PRICE();
        const publicSalePrice = await presaleContract.PUBLIC_SALE_PRICE();
        const totalSold = await presaleContract.tokensSold();
        const totalRaised = await presaleContract.bnbRaised();
        
        let currentPhase = 'Not Started';
        let currentPrice = publicSalePrice;
        
        if (isPaused) {
            currentPhase = 'Paused';
        } else if (isPrivateSaleActive) {
            currentPhase = 'Private Sale';
            currentPrice = privateSalePrice;
        } else if (isPublicSaleActive) {
            currentPhase = 'Public Sale';
            currentPrice = publicSalePrice;
        }
        
        document.getElementById('salePhase').textContent = currentPhase;
        document.getElementById('currentPrice').textContent = 
            ethers.utils.formatEther(currentPrice) + ' BNB';
        document.getElementById('tokensSold').textContent = 
            (parseInt(totalSold) / 1e18).toLocaleString() + ' KENO';
        document.getElementById('bnbRaised').textContent = 
            parseFloat(ethers.utils.formatEther(totalRaised)).toFixed(2) + ' BNB';
        
        const bnbPrice = await getBNBPrice();
        const usdRaised = parseFloat(ethers.utils.formatEther(totalRaised)) * bnbPrice;
        document.getElementById('usdRaised').textContent = 
            '$' + usdRaised.toLocaleString(undefined, { maximumFractionDigits: 0 });
        
        if (isPaused) {
            document.getElementById('buySection').innerHTML = 
                '<div class="alert alert-warning">⏸️ The presale is currently paused. Please check back later.</div>';
        } else if (!isPrivateSaleActive && !isPublicSaleActive) {
            const privateSaleStart = await presaleContract.privateSaleStart();
            const startDate = new Date(parseInt(privateSaleStart) * 1000);
            document.getElementById('buySection').innerHTML = 
                '<div class="alert alert-info">⏰ Private sale starts on ' + 
                startDate.toLocaleString() + '</div>';
        }
        
    } catch (error) {
        console.error('Failed to load sale info:', error);
        showError('Failed to load sale information');
    }
}

async function loadUserBalance() {
    try {
        const balance = await web3Provider.getBalance(userAddress);
        document.getElementById('userBalance').textContent = 
            parseFloat(ethers.utils.formatEther(balance)).toFixed(4) + ' BNB';
        
        const kenoBalance = await kenoContract.balanceOf(userAddress);
        document.getElementById('kenoBalance').textContent = 
            (parseInt(kenoBalance) / 1e18).toLocaleString() + ' KENO';
            
    } catch (error) {
        console.error('Failed to load balance:', error);
    }
}

async function calculateTokens() {
    const bnbAmount = document.getElementById('bnbAmount').value;
    
    if (!bnbAmount || parseFloat(bnbAmount) <= 0) {
        document.getElementById('tokenAmount').textContent = '0';
        return;
    }
    
    try {
        const isPrivateSaleActive = await presaleContract.isPrivateSaleActive();
        const price = isPrivateSaleActive ? 
            await presaleContract.PRIVATE_SALE_PRICE() :
            await presaleContract.PUBLIC_SALE_PRICE();
        
        const bnbWei = ethers.utils.parseEther(bnbAmount);
        const tokens = bnbWei.mul(ethers.utils.parseEther('1')).div(price);
        
        document.getElementById('tokenAmount').textContent = 
            (parseInt(tokens) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 0 });
            
    } catch (error) {
        console.error('Calculation error:', error);
    }
}

async function buyTokens() {
    const bnbAmount = document.getElementById('bnbAmount').value;
    
    if (!bnbAmount || parseFloat(bnbAmount) <= 0) {
        showError('Please enter a valid BNB amount');
        return;
    }
    
    if (!userAddress) {
        showError('Please connect your wallet first');
        return;
    }
    
    try {
        updateStatus('Preparing transaction...', 'info');
        
        const bnbWei = ethers.utils.parseEther(bnbAmount);
        
        const minPurchase = await presaleContract.MIN_PURCHASE();
        const isPrivateSaleActive = await presaleContract.isPrivateSaleActive();
        const maxPurchase = isPrivateSaleActive ?
            await presaleContract.PRIVATE_SALE_MAX_PER_WALLET() :
            await presaleContract.PUBLIC_SALE_MAX_PER_WALLET();
        
        if (bnbWei.lt(minPurchase)) {
            showError('Minimum purchase is ' + ethers.utils.formatEther(minPurchase) + ' BNB');
            return;
        }
        
        const userPurchased = await presaleContract.purchasedAmount(userAddress);
        if (userPurchased.add(bnbWei).gt(maxPurchase)) {
            showError('Maximum purchase is ' + ethers.utils.formatEther(maxPurchase) + ' BNB per wallet');
            return;
        }
        
        updateStatus('Please confirm the transaction in MetaMask...', 'info');
        
        const tx = await presaleContract.buyTokens({ value: bnbWei });
        
        updateStatus('Transaction submitted! Waiting for confirmation...', 'info');
        document.getElementById('txHash').innerHTML = 
            `<a href="https://bscscan.com/tx/${tx.hash}" target="_blank">View on BSCScan</a>`;
        
        const receipt = await tx.wait();
        
        updateStatus('🎉 Purchase successful! Your KENO tokens will be available after the presale ends.', 'success');
        
        await loadSaleInfo();
        await loadUserBalance();
        
        document.getElementById('bnbAmount').value = '';
        document.getElementById('tokenAmount').textContent = '0';
        
    } catch (error) {
        console.error('Purchase error:', error);
        
        if (error.code === 4001) {
            showError('Transaction rejected');
        } else if (error.message.includes('insufficient funds')) {
            showError('Insufficient BNB balance');
        } else if (error.message.includes('not whitelisted')) {
            showError('You are not whitelisted for the private sale. Please wait for the public sale or contact support.');
        } else {
            showError('Purchase failed: ' + (error.reason || error.message));
        }
    }
}

async function getBNBPrice() {
    try {
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=binancecoin&vs_currencies=usd');
        const data = await response.json();
        return data.binancecoin.usd;
    } catch (error) {
        console.error('Failed to fetch BNB price:', error);
        return 584;
    }
}

function handleAccountsChanged(accounts) {
    if (accounts.length === 0) {
        location.reload();
    } else if (accounts[0] !== userAddress) {
        location.reload();
    }
}

function updateStatus(message, type) {
    const statusDiv = document.getElementById('statusMessage');
    statusDiv.textContent = message;
    statusDiv.className = 'alert alert-' + type;
    statusDiv.style.display = 'block';
    
    if (type === 'success') {
        setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 10000);
    }
}

function showError(message) {
    updateStatus('❌ ' + message, 'danger');
}

document.addEventListener('DOMContentLoaded', async () => {
    await loadABIs();
    
    if (typeof window.ethereum !== 'undefined') {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
            await connectWallet();
        }
    }
    
    setInterval(async () => {
        if (userAddress) {
            await loadSaleInfo();
        }
    }, 30000);
});
