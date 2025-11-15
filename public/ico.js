const BSC_CHAIN_ID = '0x38';
const BSC_RPC_URL = 'https://bsc-dataseed.binance.org/';
const KENO_TOKEN_ADDRESS = '0x65791E0B5Cbac5F40c76cDe31bf4F074D982FD0E';
const PRESALE_CONTRACT_ADDRESS = '0xE26D6fcf7f3d560a8acEB43fa904Bef31b1fB6D0';

let web3Provider = null;
let readOnlyProvider = null;
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
        
        // Initialize read-only provider for viewing stats without wallet connection
        readOnlyProvider = new ethers.providers.JsonRpcProvider(BSC_RPC_URL);
        presaleContract = new ethers.Contract(PRESALE_CONTRACT_ADDRESS, presaleABI, readOnlyProvider);
        
        // Load stats immediately (no wallet required)
        await loadSaleInfo();
        
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
        
        // Upgrade to signer-backed contracts (for transactions)
        kenoContract = new ethers.Contract(KENO_TOKEN_ADDRESS, kenoABI, signer);
        presaleContract = new ethers.Contract(PRESALE_CONTRACT_ADDRESS, presaleABI, signer);
        
        document.getElementById('walletAddress').textContent = 
            userAddress.slice(0, 6) + '...' + userAddress.slice(-4);
        document.getElementById('connectWallet').style.display = 'none';
        document.getElementById('walletInfo').style.display = 'block';
        document.getElementById('presaleForm').style.display = 'block';
        document.getElementById('notConnected').style.display = 'none';
        
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
    if (!presaleContract) {
        console.log('⚠️ Presale contract not initialized yet');
        showPresaleUnavailable();
        return;
    }
    
    try {
        console.log('📊 Loading sale information...');
        
        // Get presale status (returns object with all status fields)
        console.log('📡 Fetching presale status...');
        const status = await presaleContract.getPresaleStatus();
        console.log('✅ Status:', status);
        
        console.log('📡 Fetching isPaused...');
        const isPaused = await presaleContract.paused();
        console.log('✅ isPaused:', isPaused);
        
        console.log('📡 Fetching prices...');
        const privateSalePrice = await presaleContract.PRIVATE_SALE_PRICE();
        const publicSalePrice = await presaleContract.PUBLIC_SALE_PRICE();
        const totalPrivate = await presaleContract.totalTokensSoldPrivate();
        const totalPublic = await presaleContract.totalTokensSoldPublic();
        const totalRaised = await presaleContract.totalEthRaised();
        console.log('✅ All data fetched successfully');
        
        // Calculate total tokens sold
        const totalSold = totalPrivate.add(totalPublic);
        console.log('💰 Total sold:', totalSold.toString());
        
        let currentPhase = 'Not Started';
        let currentPrice = publicSalePrice;
        
        if (isPaused) {
            currentPhase = 'Paused';
        } else if (status.privateSaleActive) {
            currentPhase = 'Private Sale';
            currentPrice = privateSalePrice;
        } else if (status.publicSaleActive) {
            currentPhase = 'Public Sale';
            currentPrice = publicSalePrice;
        }
        
        console.log('📈 Current phase:', currentPhase);
        console.log('💵 Current price:', currentPrice.toString());
        
        console.log('🖼️ Updating DOM elements...');
        document.getElementById('salePhase').textContent = currentPhase;
        document.getElementById('currentPrice').textContent = 
            parseFloat(ethers.utils.formatEther(currentPrice)).toFixed(6) + ' BNB';
        document.getElementById('tokensSold').textContent = 
            (parseFloat(ethers.utils.formatEther(totalSold)) / 1000000).toFixed(2) + 'M';
        
        console.log('💲 Fetching BNB price...');
        const bnbRaised = parseFloat(ethers.utils.formatEther(totalRaised));
        const bnbPrice = await getBNBPrice();
        console.log('✅ BNB price:', bnbPrice);
        const usdRaised = bnbRaised * bnbPrice;
        document.getElementById('totalRaised').textContent = 
            '$' + usdRaised.toLocaleString(undefined, { maximumFractionDigits: 0 });
        
        console.log('✅ Sale info loaded and displayed successfully!');
        
        // Show/hide form based on sale status
        if (isPaused) {
            document.getElementById('presaleClosed').style.display = 'block';
            document.getElementById('presaleClosed').innerHTML = 
                '<h3>⏸️ Presale Paused</h3><p>The presale is currently paused. Please check back later.</p>';
            document.getElementById('presaleForm').style.display = 'none';
        } else if (!status.privateSaleActive && !status.publicSaleActive) {
            document.getElementById('presaleClosed').style.display = 'block';
            const privateSaleStart = await presaleContract.privateSaleStart();
            const startDate = new Date(parseInt(privateSaleStart) * 1000);
            document.getElementById('presaleClosed').innerHTML = 
                '<h3>⏰ Coming Soon</h3><p>Private sale starts on ' + 
                startDate.toLocaleString() + '</p>';
            document.getElementById('presaleForm').style.display = 'none';
        } else {
            // Sale is active - show the form and hide closed message
            document.getElementById('presaleClosed').style.display = 'none';
            document.getElementById('presaleForm').style.display = 'block';
        }
        
    } catch (error) {
        console.log('ℹ️ Could not load sale information (this is normal if MetaMask is not installed or network is unavailable)');
        showPresaleUnavailable(error);
    }
}

function showPresaleUnavailable(error) {
    // Show user-friendly message instead of spamming console errors
    const statusElements = ['salePhase', 'currentPrice', 'tokensSold', 'totalRaised'];
    statusElements.forEach(id => {
        const element = document.getElementById(id);
        if (element) element.textContent = '--';
    });
    
    const presaleClosed = document.getElementById('presaleClosed');
    if (presaleClosed) {
        presaleClosed.style.display = 'block';
        presaleClosed.innerHTML = `
            <h3>🌐 Network Connection Required</h3>
            <p>Unable to load presale information. This could be because:</p>
            <ul style="text-align: left; margin: 15px auto; max-width: 400px;">
                <li>You need to install <a href="https://metamask.io/download/" target="_blank" style="color: #f2a900; text-decoration: underline;">MetaMask</a></li>
                <li>Your internet connection is unavailable</li>
                <li>The BSC network is temporarily unreachable</li>
            </ul>
            <p>To participate in the ICO, please install MetaMask and connect to Binance Smart Chain.</p>
        `;
    }
    
    const presaleForm = document.getElementById('presaleForm');
    if (presaleForm) {
        presaleForm.style.display = 'none';
    }
}

async function loadUserBalance() {
    try {
        const balance = await web3Provider.getBalance(userAddress);
        document.getElementById('walletBalance').textContent = 
            parseFloat(ethers.utils.formatEther(balance)).toFixed(4);
            
    } catch (error) {
        console.error('Failed to load balance:', error);
    }
}

async function calculateTokens() {
    const bnbAmount = document.getElementById('bnbAmount').value;
    
    if (!bnbAmount || parseFloat(bnbAmount) <= 0) {
        document.getElementById('kenoAmount').textContent = '0 KENO';
        updateBonusCalculator(0, false);
        // Disable buy button when input is empty/invalid
        const buyBtn = document.getElementById('buyButton');
        if (buyBtn) buyBtn.disabled = true;
        return;
    }
    
    if (!presaleContract) {
        document.getElementById('kenoAmount').textContent = '0 KENO';
        updateBonusCalculator(0, false);
        // Disable buy button when contract not loaded
        const buyBtn = document.getElementById('buyButton');
        if (buyBtn) buyBtn.disabled = true;
        return;
    }
    
    try {
        const status = await presaleContract.getPresaleStatus();
        const price = status.privateSaleActive ? 
            await presaleContract.PRIVATE_SALE_PRICE() :
            await presaleContract.PUBLIC_SALE_PRICE();
        
        const bnbWei = ethers.utils.parseEther(bnbAmount);
        const tokens = bnbWei.mul(ethers.utils.parseEther('1')).div(price);
        
        const totalTokens = parseFloat(ethers.utils.formatEther(tokens));
        document.getElementById('kenoAmount').textContent = 
            totalTokens.toLocaleString(undefined, { maximumFractionDigits: 0 }) + ' KENO';
        
        updateBonusCalculator(totalTokens, status.privateSaleActive);
        
        // Enable/disable buy button based on validation
        const buyBtn = document.getElementById('buyButton');
        if (buyBtn) {
            const isValid = bnbAmount && parseFloat(bnbAmount) >= 0.01 && parseFloat(bnbAmount) <= 2;
            buyBtn.disabled = !isValid;
        }
            
    } catch (error) {
        console.error('Calculation error:', error);
    }
}

function updateBonusCalculator(totalTokens, isPrivateSale) {
    const privateSaleEnd = new Date('November 18, 2025 23:59:59 UTC').getTime();
    const now = Date.now();
    const privateSaleActive = isPrivateSale && (now < privateSaleEnd);
    
    if (!privateSaleActive) {
        document.getElementById('bonusCalculator').style.display = 'none';
        return;
    }
    
    document.getElementById('bonusCalculator').style.display = 'block';
    
    const baseTokens = totalTokens / 1.2;
    const bonusTokens = totalTokens - baseTokens;
    
    document.getElementById('baseTokens').textContent = 
        baseTokens.toLocaleString(undefined, { maximumFractionDigits: 0 }) + ' KENO';
    document.getElementById('bonusTokens').textContent = 
        '+' + bonusTokens.toLocaleString(undefined, { maximumFractionDigits: 0 }) + ' KENO';
    document.getElementById('totalValue').textContent = 
        totalTokens.toLocaleString(undefined, { maximumFractionDigits: 0 }) + ' KENO';
    
    const publicSalePrice = 0.05;
    const bonusValueUSD = bonusTokens * publicSalePrice;
    document.getElementById('bonusUSD').textContent = 
        '$' + bonusValueUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
        document.getElementById('transactionStatus').innerHTML = 
            `<a href="https://bscscan.com/tx/${tx.hash}" target="_blank">View on BSCScan</a>`;
        document.getElementById('transactionStatus').style.display = 'block';
        
        const receipt = await tx.wait();
        
        updateStatus('🎉 Purchase successful! Your KENO tokens will be available after the presale ends.', 'success');
        
        await loadSaleInfo();
        await loadUserBalance();
        
        document.getElementById('bnbAmount').value = '';
        document.getElementById('kenoAmount').textContent = '0 KENO';
        
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
    const statusDiv = document.getElementById('transactionStatus');
    if (!statusDiv) return;
    
    statusDiv.textContent = message;
    statusDiv.className = 'tx-status alert alert-' + type;
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

async function initializeICOPage() {
    // Wait for ethers.js to be available
    if (typeof ethers === 'undefined' || typeof ethers.providers === 'undefined') {
        console.log('⏳ Waiting for ethers.js to load...');
        setTimeout(initializeICOPage, 200);
        return;
    }
    
    console.log('✅ ethers.js loaded successfully!');
    
    await loadABIs();
    
    // Wire up Connect Wallet button
    const connectBtn = document.getElementById('connectWallet');
    if (connectBtn) {
        connectBtn.addEventListener('click', connectWallet);
    }
    
    // Wire up BNB amount input for real-time calculation
    const bnbInput = document.getElementById('bnbAmount');
    if (bnbInput) {
        bnbInput.addEventListener('input', calculateTokens);
    }
    
    // Wire up Buy button
    const buyBtn = document.getElementById('buyButton');
    if (buyBtn) {
        buyBtn.addEventListener('click', buyTokens);
    }
    
    // Auto-connect if already connected
    if (typeof window.ethereum !== 'undefined') {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
            await connectWallet();
        }
    }
    
    // Refresh stats every 30 seconds (works with or without wallet connection)
    setInterval(async () => {
        if (presaleContract) {
            await loadSaleInfo();
        }
    }, 30000);
}

// Use both DOMContentLoaded and window.onload for better mobile support
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeICOPage);
} else {
    // DOM already loaded
    initializeICOPage();
}

// Fallback for mobile browsers
window.addEventListener('load', function() {
    if (typeof ethers === 'undefined') {
        console.log('⚠️ Retrying initialization after window load...');
        setTimeout(initializeICOPage, 500);
    }
});
