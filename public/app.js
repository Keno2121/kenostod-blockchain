const API_BASE = '';
let ec;

function loadApp() {
    const EC = elliptic.ec;
    ec = new EC('secp256k1');
    loadStats();
    setInterval(loadStats, 10000);
}

function openTab(button, tabName) {
    const tabContents = document.getElementsByClassName('tab-content');
    for (let i = 0; i < tabContents.length; i++) {
        tabContents[i].classList.remove('active');
    }
    
    const tabButtons = document.getElementsByClassName('tab-btn');
    for (let i = 0; i < tabButtons.length; i++) {
        tabButtons[i].classList.remove('active');
    }
    
    document.getElementById(tabName).classList.add('active');
    button.classList.add('active');
}

async function loadStats() {
    try {
        const response = await fetch(`${API_BASE}/api/stats`);
        const data = await response.json();
        
        document.getElementById('totalBlocks').textContent = data.totalBlocks;
        document.getElementById('totalTransactions').textContent = data.totalTransactions;
        document.getElementById('difficulty').textContent = data.difficulty;
        document.getElementById('pendingTransactions').textContent = data.pendingTransactions;
        document.getElementById('isValid').textContent = data.isValid ? '✅ Valid' : '❌ Invalid';
        document.getElementById('miningReward').textContent = `${data.miningReward} KENO`;
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

async function createWallet() {
    try {
        const response = await fetch(`${API_BASE}/api/wallet/create`, {
            method: 'POST'
        });
        const data = await response.json();
        
        const resultDiv = document.getElementById('newWallet');
        resultDiv.className = 'result success';
        resultDiv.innerHTML = `
            <h4>New Wallet Created!</h4>
            <p><strong>Address:</strong> <code>${data.address}</code></p>
            <p><strong>Private Key:</strong> <code>${data.privateKey}</code></p>
            <p style="color: #dc3545; margin-top: 10px;">⚠️ ${data.warning}</p>
            <button onclick="useThisWallet('${data.address}', '${data.privateKey}')" class="btn btn-secondary" style="margin-top: 10px;">Use This Wallet</button>
        `;
    } catch (error) {
        showError('newWallet', error.message);
    }
}

function useThisWallet(address, privateKey) {
    document.getElementById('myAddress').value = address;
    document.getElementById('myPrivateKey').value = privateKey;
    alert('Wallet loaded! You can now use it to send transactions.');
}

async function checkBalance() {
    const address = document.getElementById('balanceAddress').value;
    if (!address) {
        showError('balanceResult', 'Please enter an address');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/balance/${address}`);
        const data = await response.json();
        
        if (data.error) {
            showError('balanceResult', data.error);
            return;
        }
        
        const resultDiv = document.getElementById('balanceResult');
        resultDiv.className = 'result success';
        resultDiv.innerHTML = `
            <h4>Balance Information</h4>
            <p><strong>Address:</strong> <code>${data.address.substring(0, 20)}...</code></p>
            <p><strong>Balance:</strong> ${data.balance} ${data.token}</p>
        `;
    } catch (error) {
        showError('balanceResult', error.message);
    }
}

async function sendTransaction() {
    const fromAddress = document.getElementById('txFromAddress').value || document.getElementById('myAddress').value;
    const toAddress = document.getElementById('txToAddress').value;
    const amount = parseFloat(document.getElementById('txAmount').value);
    const fee = parseFloat(document.getElementById('txFee').value);
    const privateKey = document.getElementById('txPrivateKey').value || document.getElementById('myPrivateKey').value;
    
    if (!fromAddress || !toAddress || !amount || !privateKey) {
        showError('txResult', 'Please fill in all fields');
        return;
    }
    
    try {
        const timestamp = Date.now();
        const hashTx = CryptoJS.SHA256(fromAddress + toAddress + amount + fee + timestamp).toString();
        
        const key = ec.keyFromPrivate(privateKey, 'hex');
        
        if (key.getPublic('hex') !== fromAddress) {
            showError('txResult', 'Private key does not match the from address!');
            return;
        }
        
        const sig = key.sign(hashTx, 'base64');
        const signature = sig.toDER('hex');
        
        const signedTransaction = {
            fromAddress: fromAddress,
            toAddress: toAddress,
            amount: amount,
            fee: fee,
            timestamp: timestamp,
            signature: signature
        };
        
        const txResponse = await fetch(`${API_BASE}/api/transaction`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(signedTransaction)
        });
        
        const txData = await txResponse.json();
        
        if (txData.error) {
            showError('txResult', txData.error);
            return;
        }
        
        const resultDiv = document.getElementById('txResult');
        resultDiv.className = 'result success';
        resultDiv.innerHTML = `
            <h4>Transaction Created Successfully!</h4>
            <p><strong>Transaction Hash:</strong> <code>${txData.transactionHash}</code></p>
            <p><strong>Amount:</strong> ${txData.transaction.amount} KENO</p>
            <p><strong>Fee:</strong> ${txData.transaction.fee} KENO</p>
            <p>✅ Transaction is now pending. Mine a block to confirm it!</p>
            <p style="color: #28a745; margin-top: 10px;">🔒 Transaction signed locally - private key never left your browser!</p>
        `;
        
        loadStats();
    } catch (error) {
        showError('txResult', error.message);
    }
}

async function mineBlock() {
    const minerAddress = document.getElementById('minerAddress').value || document.getElementById('myAddress').value;
    
    if (!minerAddress) {
        showError('miningResult', 'Please enter a miner address');
        return;
    }
    
    const resultDiv = document.getElementById('miningResult');
    resultDiv.className = 'result';
    resultDiv.innerHTML = '<p class="loading">⛏️ Mining in progress... Please wait...</p>';
    
    try {
        const response = await fetch(`${API_BASE}/api/mine`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ minerAddress })
        });
        
        const data = await response.json();
        
        if (data.error) {
            showError('miningResult', data.error);
            return;
        }
        
        resultDiv.className = 'result success';
        resultDiv.innerHTML = `
            <h4>Block Mined Successfully!</h4>
            <p>✅ ${data.message}</p>
            <p><strong>Your Balance:</strong> ${data.balance} KENO</p>
            <p><strong>Block Height:</strong> ${data.blockHeight}</p>
        `;
        
        loadStats();
    } catch (error) {
        showError('miningResult', error.message);
    }
}

async function loadBlockchain() {
    const resultDiv = document.getElementById('blockchainData');
    resultDiv.innerHTML = '<p class="loading">Loading blockchain...</p>';
    
    try {
        const response = await fetch(`${API_BASE}/api/blockchain`);
        const data = await response.json();
        
        let html = '';
        data.chain.forEach((block, index) => {
            html += `
                <div class="block-item">
                    <h4>Block #${index}</h4>
                    <p><strong>Hash:</strong> <code>${block.hash}</code></p>
                    <p><strong>Previous Hash:</strong> <code>${block.previousHash}</code></p>
                    <p><strong>Timestamp:</strong> ${new Date(block.timestamp).toLocaleString()}</p>
                    <p><strong>Nonce:</strong> ${block.nonce}</p>
                    <p><strong>Transactions:</strong> ${block.transactions.length}</p>
                    ${block.transactions.map(tx => `
                        <div class="transaction-item">
                            <strong>From:</strong> ${tx.fromAddress ? tx.fromAddress.substring(0, 20) + '...' : 'Mining Reward'}<br>
                            <strong>To:</strong> ${tx.toAddress.substring(0, 20)}...<br>
                            <strong>Amount:</strong> ${tx.amount} KENO
                        </div>
                    `).join('')}
                </div>
            `;
        });
        
        resultDiv.innerHTML = html;
    } catch (error) {
        resultDiv.innerHTML = `<p class="result error">Error: ${error.message}</p>`;
    }
}

async function loadTransactions() {
    const address = document.getElementById('historyAddress').value;
    if (!address) {
        showError('transactionHistory', 'Please enter an address');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/transactions/${address}`);
        const data = await response.json();
        
        const resultDiv = document.getElementById('transactionHistory');
        
        if (data.transactions.length === 0) {
            resultDiv.className = 'result';
            resultDiv.innerHTML = '<p>No transactions found for this address.</p>';
            return;
        }
        
        let html = '<h4>Transaction History</h4>';
        data.transactions.forEach(tx => {
            const isSender = tx.fromAddress === address;
            html += `
                <div class="transaction-item">
                    <strong>${isSender ? 'Sent' : 'Received'}:</strong> ${tx.amount} KENO<br>
                    <strong>${isSender ? 'To' : 'From'}:</strong> <code>${isSender ? tx.toAddress.substring(0, 30) : (tx.fromAddress ? tx.fromAddress.substring(0, 30) : 'Mining Reward')}...</code><br>
                    <strong>Fee:</strong> ${tx.fee} KENO<br>
                    <strong>Time:</strong> ${new Date(tx.timestamp).toLocaleString()}
                </div>
            `;
        });
        
        resultDiv.className = 'result success';
        resultDiv.innerHTML = html;
    } catch (error) {
        showError('transactionHistory', error.message);
    }
}

function showError(elementId, message) {
    const element = document.getElementById(elementId);
    element.className = 'result error';
    element.innerHTML = `<p>❌ Error: ${message}</p>`;
}