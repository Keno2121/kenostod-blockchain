const API_BASE = '';
let ec;

function initializeApp() {
    try {
        if (typeof elliptic === 'undefined') {
            console.error('Elliptic library not found');
            setTimeout(initializeApp, 500);
            return;
        }
        const EC = elliptic.ec;
        ec = new EC('secp256k1');
        console.log('✅ Cryptography library loaded successfully');
        loadStats();
        setInterval(loadStats, 10000);
        updateCryptoTicker();
        setInterval(updateCryptoTicker, 30000);
    } catch (error) {
        console.error('Failed to initialize:', error);
        setTimeout(initializeApp, 500);
    }
}

async function updateCryptoTicker() {
    try {
        const [statsResponse, pricesResponse, txResponse] = await Promise.all([
            fetch(`${API_BASE}/api/stats`),
            fetch(`${API_BASE}/api/crypto-prices`),
            fetch(`${API_BASE}/api/recent-transactions?limit=5`)
        ]);

        const stats = await statsResponse.json();
        const prices = await pricesResponse.json();
        const recentTx = await txResponse.json();

        let tickerHTML = '';

        // Add Kenostod stats
        tickerHTML += `
            <span class="ticker-item">
                <span class="ticker-emoji">⛓️</span>
                <span class="ticker-label">KENO Supply:</span>
                <span class="ticker-value">${stats.supply?.circulatingSupply || 0}</span>
            </span>
            <span class="ticker-item">
                <span class="ticker-emoji">📦</span>
                <span class="ticker-label">Blocks:</span>
                <span class="ticker-value">${stats.totalBlocks}</span>
            </span>
            <span class="ticker-item">
                <span class="ticker-emoji">💸</span>
                <span class="ticker-label">Transactions:</span>
                <span class="ticker-value">${stats.totalTransactions}</span>
            </span>
        `;

        // Add crypto market prices with defensive guards
        const cryptoList = [
            { key: 'bitcoin', emoji: '₿', label: 'BTC' },
            { key: 'ethereum', emoji: 'Ξ', label: 'ETH' },
            { key: 'solana', emoji: '◎', label: 'SOL' },
            { key: 'cardano', emoji: '₳', label: 'ADA' },
            { key: 'ripple', emoji: '✕', label: 'XRP' },
            { key: 'polkadot', emoji: '●', label: 'DOT' },
            { key: 'dogecoin', emoji: 'Ð', label: 'DOGE' },
            { key: 'polygon', emoji: '⬡', label: 'MATIC' },
            { key: 'chainlink', emoji: '⬢', label: 'LINK' },
            { key: 'litecoin', emoji: 'Ł', label: 'LTC' }
        ];

        cryptoList.forEach(crypto => {
            if (prices[crypto.key] && prices[crypto.key].usd) {
                const price = Number(prices[crypto.key].usd) || 0;
                const change = Number(prices[crypto.key].usd_24h_change) || 0;
                const volume = prices[crypto.key].usd_24h_vol;
                const marketCap = prices[crypto.key].usd_market_cap;
                
                let priceDisplay = price >= 1 
                    ? `$${price.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}` 
                    : `$${price.toFixed(6)}`;
                
                tickerHTML += `
                    <span class="ticker-item">
                        <span class="ticker-emoji">${crypto.emoji}</span>
                        <span class="ticker-label">${crypto.label}:</span>
                        <span class="ticker-value">${priceDisplay}</span>
                        <span class="ticker-value ${change >= 0 ? 'ticker-up' : 'ticker-down'}">
                            ${change >= 0 ? '↑' : '↓'}${Math.abs(change).toFixed(2)}%
                        </span>
                    </span>
                `;
                
                if (volume && crypto.label === 'BTC') {
                    const volDisplay = volume >= 1e9 
                        ? `$${(volume / 1e9).toFixed(2)}B` 
                        : volume >= 1e6 
                            ? `$${(volume / 1e6).toFixed(2)}M` 
                            : `$${(volume / 1e3).toFixed(2)}K`;
                    
                    tickerHTML += `
                        <span class="ticker-item">
                            <span class="ticker-emoji">📊</span>
                            <span class="ticker-label">BTC 24h Vol:</span>
                            <span class="ticker-value">${volDisplay}</span>
                        </span>
                    `;
                }
            }
        });

        // Add recent Kenostod transactions
        if (recentTx && recentTx.length > 0) {
            recentTx.slice(0, 3).forEach(tx => {
                tickerHTML += `
                    <span class="ticker-item">
                        <span class="ticker-emoji">💰</span>
                        <span class="ticker-label">${tx.from} → ${tx.to}:</span>
                        <span class="ticker-value">${tx.amount} KENO</span>
                    </span>
                `;
            });
        }

        // Create seamless infinite scroll by duplicating content
        const tickerContent = document.getElementById('tickerContent');
        tickerContent.innerHTML = tickerHTML + tickerHTML + tickerHTML;

    } catch (error) {
        console.error('Error updating ticker:', error);
        document.getElementById('tickerContent').innerHTML = `
            <span class="ticker-item">
                <span class="ticker-emoji">⛓️</span>
                <span class="ticker-label">Kenostod Blockchain</span>
                <span class="ticker-value">Live</span>
            </span>
        `;
    }
}

function ensureECLoaded() {
    if (!ec) {
        if (typeof elliptic !== 'undefined') {
            const EC = elliptic.ec;
            ec = new EC('secp256k1');
            console.log('EC initialized on demand');
        } else {
            throw new Error('Cryptography library not loaded. Please refresh the page and wait a moment before sending transactions.');
        }
    }
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
        document.getElementById('miningReward').textContent = `${data.miningReward} KENO`;
        document.getElementById('isValid').textContent = data.isValid ? '✅ Valid' : '❌ Invalid';
        
        if (data.supply) {
            document.getElementById('circulatingSupply').textContent = `${data.supply.circulatingSupply} KENO`;
        }
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
    const message = document.getElementById('txMessage').value || '';
    const privateKey = document.getElementById('txPrivateKey').value || document.getElementById('myPrivateKey').value;
    
    if (!fromAddress || !toAddress || !amount || !privateKey) {
        showError('txResult', 'Please fill in all required fields');
        return;
    }
    
    try {
        // Use simple server-side signing endpoint
        const response = await fetch(`${API_BASE}/api/transaction/simple`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fromAddress,
                toAddress,
                amount,
                fee,
                privateKey,
                message
            })
        });

        const data = await response.json();
        
        if (data.error) {
            showError('txResult', data.error);
            return;
        }
        
        const resultDiv = document.getElementById('txResult');
        resultDiv.className = 'result success';
        resultDiv.innerHTML = `
            <h4>✅ Transaction Created Successfully!</h4>
            <p><strong>Transaction Hash:</strong> <code>${data.transactionHash.substring(0, 20)}...</code></p>
            <p><strong>From:</strong> ${data.transaction.fromAddress.substring(0, 20)}...</p>
            <p><strong>To:</strong> ${data.transaction.toAddress.substring(0, 20)}...</p>
            <p><strong>Amount:</strong> ${data.transaction.amount} KENO</p>
            <p><strong>Fee:</strong> ${data.transaction.fee} KENO</p>
            ${message ? `<p><strong>Message:</strong> "${message}"</p>` : ''}
            <p style="color: #ff9800; font-weight: bold; margin-top: 15px;">⏱️ You have 5 MINUTES to cancel this transaction!</p>
            <p style="color: #666;">Go to "View Pending Transactions" to cancel it before it's mined into a block.</p>
        `;
        
        loadStats();
    } catch (error) {
        showError('txResult', error.message);
    }
}

async function loadPendingTransactions() {
    const address = document.getElementById('pendingAddress').value;
    if (!address) {
        showError('pendingTxList', 'Please enter your address');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/transaction/pending/${address}`);
        const data = await response.json();

        const resultDiv = document.getElementById('pendingTxList');

        if (data.length === 0) {
            resultDiv.className = 'result';
            resultDiv.innerHTML = '<p>No pending transactions found for this address.</p>';
            return;
        }

        let html = '<h4>Your Pending Transactions (5-Minute Reversal Window)</h4>';
        data.forEach(tx => {
            const timeRemaining = tx.timeRemaining || 0;
            const seconds = Math.floor(timeRemaining / 1000);
            const canCancel = tx.canBeCancelled && timeRemaining > 0;

            html += `
                <div class="transaction-item" style="border: 1px solid #ddd; padding: 10px; margin: 10px 0; border-radius: 5px;">
                    <p><strong>To:</strong> ${tx.toAddress.substring(0, 20)}...</p>
                    <p><strong>Amount:</strong> ${tx.amount} KENO</p>
                    <p><strong>Time Remaining:</strong> ${canCancel ? `⏱️ ${seconds}s` : '❌ Expired'}</p>
                    ${tx.message ? `<p><strong>Message:</strong> ${tx.message}</p>` : ''}
                    ${canCancel ? 
                        `<button onclick="cancelTransaction('${tx.hash}', '${address}')" class="btn btn-danger">🔄 Cancel Transaction</button>` :
                        '<p style="color: #888;">Cannot cancel (past 5-minute window)</p>'
                    }
                </div>
            `;
        });

        resultDiv.className = 'result success';
        resultDiv.innerHTML = html;
    } catch (error) {
        showError('pendingTxList', error.message);
    }
}

async function cancelTransaction(txHash, senderAddress) {
    if (!confirm('Are you sure you want to cancel this transaction?')) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/transaction/cancel`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transactionHash: txHash, senderAddress })
        });

        const data = await response.json();

        if (data.error) {
            alert('Error: ' + data.error);
            return;
        }

        alert('Transaction cancelled successfully!');
        loadPendingTransactions();
        loadStats();
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

function toggleScheduleOptions() {
    const type = document.getElementById('schedType').value;
    document.getElementById('recurringOptions').style.display = type === 'recurring' ? 'block' : 'none';
}

async function createScheduledPayment() {
    const fromAddress = document.getElementById('schedFromAddress').value;
    const toAddress = document.getElementById('schedToAddress').value;
    const amount = parseFloat(document.getElementById('schedAmount').value);
    const fee = parseFloat(document.getElementById('schedFee').value);
    const type = document.getElementById('schedType').value;
    const startDate = new Date(document.getElementById('schedStartDate').value).getTime();
    const privateKey = document.getElementById('schedPrivateKey').value;

    if (!fromAddress || !toAddress || !amount || !privateKey || !startDate) {
        showError('schedResult', 'Please fill in all required fields');
        return;
    }

    let schedule;
    if (type === 'oneTime') {
        schedule = {
            type: 'oneTime',
            executeAt: startDate
        };
    } else {
        const interval = document.getElementById('schedInterval').value;
        const occurrences = parseInt(document.getElementById('schedOccurrences').value);
        schedule = {
            type: 'recurring',
            startDate: startDate,
            interval: interval,
            maxOccurrences: occurrences
        };
    }

    try {
        const timestamp = Date.now();
        const hashData = fromAddress + toAddress + amount + fee + JSON.stringify(schedule) + timestamp;
        const hashTx = CryptoJS.SHA256(hashData).toString();

        const key = ec.keyFromPrivate(privateKey, 'hex');
        const sig = key.sign(hashTx, 'base64');
        const signature = sig.toDER('hex');

        const scheduledTx = {
            fromAddress,
            toAddress,
            amount,
            fee,
            schedule,
            timestamp,
            signature
        };

        const response = await fetch(`${API_BASE}/api/scheduled/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(scheduledTx)
        });

        const data = await response.json();

        if (data.error) {
            showError('schedResult', data.error);
            return;
        }

        const resultDiv = document.getElementById('schedResult');
        resultDiv.className = 'result success';
        resultDiv.innerHTML = `
            <h4>Scheduled Payment Created!</h4>
            <p><strong>Schedule ID:</strong> <code>${data.scheduleId}</code></p>
            <p><strong>Type:</strong> ${type}</p>
            <p>${data.message}</p>
        `;
    } catch (error) {
        showError('schedResult', error.message);
    }
}

async function viewScheduledPayments() {
    const address = document.getElementById('schedViewAddress').value;
    if (!address) {
        showError('schedList', 'Please enter your address');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/scheduled/list/${address}`);
        const data = await response.json();

        const resultDiv = document.getElementById('schedList');

        if (data.scheduled.length === 0) {
            resultDiv.className = 'result';
            resultDiv.innerHTML = '<p>No scheduled payments found.</p>';
            return;
        }

        let html = '<h4>Your Scheduled Payments</h4>';
        data.scheduled.forEach(sched => {
            html += `
                <div class="transaction-item" style="border: 1px solid #ddd; padding: 10px; margin: 10px 0; border-radius: 5px;">
                    <p><strong>To:</strong> ${sched.toAddress.substring(0, 20)}...</p>
                    <p><strong>Amount:</strong> ${sched.amount} KENO per payment</p>
                    <p><strong>Type:</strong> ${sched.schedule.type}</p>
                    <p><strong>Status:</strong> ${sched.status}</p>
                    ${sched.schedule.type === 'recurring' ? 
                        `<p><strong>Executed:</strong> ${sched.executionCount}/${sched.schedule.maxOccurrences}</p>` : 
                        ''}
                    ${sched.status === 'active' ? 
                        `<button onclick="cancelScheduledPayment('${sched.id}', '${address}')" class="btn btn-danger">Cancel</button>` :
                        ''}
                </div>
            `;
        });

        resultDiv.className = 'result success';
        resultDiv.innerHTML = html;
    } catch (error) {
        showError('schedList', error.message);
    }
}

async function cancelScheduledPayment(scheduleId, address) {
    if (!confirm('Cancel this scheduled payment?')) return;

    try {
        const response = await fetch(`${API_BASE}/api/scheduled/cancel`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ scheduleId, senderAddress: address })
        });

        const data = await response.json();

        if (data.error) {
            alert('Error: ' + data.error);
            return;
        }

        alert('Scheduled payment cancelled!');
        viewScheduledPayments();
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

async function setupRecovery() {
    const walletAddress = document.getElementById('recoveryWalletAddress').value;
    const guardianInput = document.getElementById('guardianAddresses').value;
    const threshold = parseInt(document.getElementById('recoveryThreshold').value);

    if (!walletAddress || !guardianInput) {
        showError('recoverySetupResult', 'Please fill in all fields');
        return;
    }

    const guardians = guardianInput.split(',').map(g => g.trim()).filter(g => g);

    if (guardians.length < 2) {
        showError('recoverySetupResult', 'Minimum 2 guardians required');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/recovery/setup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ walletAddress, guardians, threshold })
        });

        const data = await response.json();

        if (data.error) {
            showError('recoverySetupResult', data.error);
            return;
        }

        const resultDiv = document.getElementById('recoverySetupResult');
        resultDiv.className = 'result success';
        resultDiv.innerHTML = `
            <h4>Recovery System Setup!</h4>
            <p>✅ ${data.message}</p>
            <p><strong>Guardians:</strong> ${data.guardians.length}</p>
            <p><strong>Required Approvals:</strong> ${data.threshold}</p>
        `;
    } catch (error) {
        showError('recoverySetupResult', error.message);
    }
}

async function initiateRecovery() {
    const oldAddress = document.getElementById('lostAddress').value;
    const newAddress = document.getElementById('newAddress').value;
    const initiatorAddress = document.getElementById('initiatorAddress').value;

    if (!oldAddress || !newAddress || !initiatorAddress) {
        showError('recoveryInitResult', 'Please fill in all fields');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/recovery/initiate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ oldAddress, newAddress, initiatorAddress })
        });

        const data = await response.json();

        if (data.error) {
            showError('recoveryInitResult', data.error);
            return;
        }

        const resultDiv = document.getElementById('recoveryInitResult');
        resultDiv.className = 'result success';
        resultDiv.innerHTML = `
            <h4>Recovery Request Initiated!</h4>
            <p>✅ ${data.message}</p>
            <p><strong>Request ID:</strong> <code>${data.request.id}</code></p>
            <p><strong>Required Approvals:</strong> ${data.request.threshold}</p>
            <p>Guardians have been notified. Request expires in 7 days.</p>
        `;
    } catch (error) {
        showError('recoveryInitResult', error.message);
    }
}

async function viewRecoveryRequests() {
    const guardianAddress = document.getElementById('guardianAddress').value;
    if (!guardianAddress) {
        showError('guardianRequests', 'Please enter your guardian address');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/recovery/guardian/${guardianAddress}`);
        const data = await response.json();

        const resultDiv = document.getElementById('guardianRequests');

        if (data.length === 0) {
            resultDiv.className = 'result';
            resultDiv.innerHTML = '<p>No recovery requests found.</p>';
            return;
        }

        let html = '<h4>Recovery Requests</h4>';
        data.forEach(req => {
            html += `
                <div class="transaction-item" style="border: 1px solid #ddd; padding: 10px; margin: 10px 0; border-radius: 5px;">
                    <p><strong>Request ID:</strong> ${req.id}</p>
                    <p><strong>Old Address:</strong> ${req.oldAddress.substring(0, 20)}...</p>
                    <p><strong>New Address:</strong> ${req.newAddress.substring(0, 20)}...</p>
                    <p><strong>Approvals:</strong> ${req.approvals}/${req.threshold}</p>
                    <p><strong>Status:</strong> ${req.status}</p>
                    ${req.status === 'pending' ? `
                        <button onclick="approveRecovery('${req.id}', '${guardianAddress}')" class="btn btn-primary">Approve</button>
                        <button onclick="rejectRecovery('${req.id}', '${guardianAddress}')" class="btn btn-danger">Reject</button>
                    ` : ''}
                    ${req.status === 'approved' ? `
                        <button onclick="executeRecovery('${req.id}')" class="btn btn-primary">Execute Recovery</button>
                    ` : ''}
                </div>
            `;
        });

        resultDiv.className = 'result success';
        resultDiv.innerHTML = html;
    } catch (error) {
        showError('guardianRequests', error.message);
    }
}

async function approveRecovery(requestId, guardianAddress) {
    try {
        const response = await fetch(`${API_BASE}/api/recovery/approve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ requestId, guardianAddress })
        });

        const data = await response.json();

        if (data.error) {
            alert('Error: ' + data.error);
            return;
        }

        alert('Recovery request approved!');
        viewRecoveryRequests();
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

async function rejectRecovery(requestId, guardianAddress) {
    try {
        const response = await fetch(`${API_BASE}/api/recovery/reject`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ requestId, guardianAddress })
        });

        const data = await response.json();

        if (data.error) {
            alert('Error: ' + data.error);
            return;
        }

        alert('Recovery request rejected.');
        viewRecoveryRequests();
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

async function executeRecovery(requestId) {
    if (!confirm('Execute wallet recovery? This will transfer funds to the new address.')) return;

    try {
        const response = await fetch(`${API_BASE}/api/recovery/execute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ requestId })
        });

        const data = await response.json();

        if (data.error) {
            alert('Error: ' + data.error);
            return;
        }

        alert('Recovery executed! Funds will be transferred when the next block is mined.');
        viewRecoveryRequests();
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

async function submitRating() {
    const txHash = document.getElementById('ratingTxHash').value;
    const raterAddress = document.getElementById('raterAddress').value;
    const rating = parseInt(document.getElementById('rating').value);
    const comment = document.getElementById('ratingComment').value || '';

    if (!txHash || !raterAddress) {
        showError('ratingResult', 'Please fill in required fields');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/reputation/rate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transactionHash: txHash, raterAddress, rating, comment })
        });

        const data = await response.json();

        if (data.error) {
            showError('ratingResult', data.error);
            return;
        }

        const resultDiv = document.getElementById('ratingResult');
        resultDiv.className = 'result success';
        resultDiv.innerHTML = `
            <h4>Rating Submitted!</h4>
            <p>✅ ${data.message}</p>
            <p><strong>Your Rating:</strong> ${'⭐'.repeat(rating)}</p>
        `;
    } catch (error) {
        showError('ratingResult', error.message);
    }
}

async function checkReputation() {
    const address = document.getElementById('repAddress').value;
    if (!address) {
        showError('repResult', 'Please enter an address');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/reputation/${address}`);
        const data = await response.json();

        const resultDiv = document.getElementById('repResult');
        resultDiv.className = 'result success';
        resultDiv.innerHTML = `
            <h4>Reputation Score</h4>
            <p><strong>Address:</strong> ${address.substring(0, 20)}...</p>
            <p><strong>Average Rating:</strong> ${data.averageScore.toFixed(2)} ${'⭐'.repeat(Math.round(data.averageScore))}</p>
            <p><strong>Total Ratings:</strong> ${data.totalRatings}</p>
            <p><strong>Trust Level:</strong> ${data.trustLevel}</p>
            <p><strong>Rating Breakdown:</strong></p>
            <ul>
                ${Object.entries(data.breakdown).map(([stars, count]) => `<li>${stars} stars: ${count}</li>`).join('')}
            </ul>
        `;
    } catch (error) {
        showError('repResult', error.message);
    }
}

async function viewTopRated() {
    try {
        const response = await fetch(`${API_BASE}/api/reputation/top?limit=10`);
        const data = await response.json();

        const resultDiv = document.getElementById('topRated');

        if (data.topRated.length === 0) {
            resultDiv.className = 'result';
            resultDiv.innerHTML = '<p>No rated addresses yet.</p>';
            return;
        }

        let html = '<h4>🏆 Top 10 Most Trusted Addresses</h4><ol>';
        data.topRated.forEach((item, index) => {
            html += `
                <li style="margin: 10px 0;">
                    <strong>${item.address.substring(0, 20)}...</strong><br>
                    Average: ${item.averageScore.toFixed(2)} ${'⭐'.repeat(Math.round(item.averageScore))} 
                    (${item.totalRatings} ratings) - ${item.trustLevel}
                </li>
            `;
        });
        html += '</ol>';

        resultDiv.className = 'result success';
        resultDiv.innerHTML = html;
    } catch (error) {
        showError('topRated', error.message);
    }
}

function updateParameterInfo() {
    const param = document.getElementById('proposalParameter').value;
    const infoElement = document.getElementById('parameterInfo');
    
    if (param === 'miningReward') {
        infoElement.textContent = 'Enter value between 0 and 1000 KENO';
    } else if (param === 'difficulty') {
        infoElement.textContent = 'Enter value between 1 and 10';
    } else if (param === 'minimumFee') {
        infoElement.textContent = 'Enter value between 0 and 10 KENO';
    }
}

async function createProposal() {
    const proposerAddress = document.getElementById('proposerAddress').value;
    const title = document.getElementById('proposalTitle').value;
    const description = document.getElementById('proposalDescription').value;
    const parameterName = document.getElementById('proposalParameter').value;
    const newValue = parseFloat(document.getElementById('proposalValue').value);

    if (!proposerAddress || !title || !description || isNaN(newValue)) {
        showError('proposalResult', 'Please fill in all fields');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/governance/propose`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ proposerAddress, title, description, parameterName, newValue })
        });

        const data = await response.json();

        if (data.error) {
            showError('proposalResult', data.error);
            return;
        }

        const resultDiv = document.getElementById('proposalResult');
        resultDiv.className = 'result success';
        resultDiv.innerHTML = `
            <h4>Proposal Created!</h4>
            <p>✅ ${data.message}</p>
            <p><strong>Proposal ID:</strong> ${data.proposal.id}</p>
            <p><strong>Title:</strong> ${data.proposal.title}</p>
            <p>Voting period: 7 days</p>
        `;
    } catch (error) {
        showError('proposalResult', error.message);
    }
}

async function viewActiveProposals() {
    try {
        const response = await fetch(`${API_BASE}/api/governance/proposals/active`);
        const data = await response.json();

        const resultDiv = document.getElementById('activeProposals');

        if (data.proposals.length === 0) {
            resultDiv.className = 'result';
            resultDiv.innerHTML = '<p>No active proposals.</p>';
            return;
        }

        let html = '<h4>Active Proposals</h4>';
        data.proposals.forEach(prop => {
            const timeLeft = Math.max(0, prop.expiresAt - Date.now());
            const daysLeft = Math.floor(timeLeft / (24 * 60 * 60 * 1000));
            const hoursLeft = Math.floor((timeLeft % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));

            html += `
                <div class="transaction-item" style="border: 1px solid #ddd; padding: 10px; margin: 10px 0; border-radius: 5px;">
                    <h4>${prop.title}</h4>
                    <p><strong>ID:</strong> ${prop.id}</p>
                    <p><strong>Description:</strong> ${prop.description}</p>
                    <p><strong>Parameter:</strong> ${prop.parameterName}</p>
                    <p><strong>Current Value:</strong> ${prop.currentValue} → <strong>Proposed:</strong> ${prop.newValue}</p>
                    <p><strong>Time Remaining:</strong> ${daysLeft}d ${hoursLeft}h</p>
                    <p><strong>Yes Votes:</strong> ${prop.yesVotingPower} | <strong>No Votes:</strong> ${prop.noVotingPower}</p>
                    <div style="margin-top: 10px;">
                        <input type="text" id="voterAddr_${prop.id}" placeholder="Your address" class="input-field" style="margin-bottom: 5px;">
                        <button onclick="voteOnProposal('${prop.id}', 'yes')" class="btn btn-primary" style="margin-right: 5px;">Vote YES</button>
                        <button onclick="voteOnProposal('${prop.id}', 'no')" class="btn btn-danger">Vote NO</button>
                    </div>
                </div>
            `;
        });

        resultDiv.className = 'result success';
        resultDiv.innerHTML = html;
    } catch (error) {
        showError('activeProposals', error.message);
    }
}

async function voteOnProposal(proposalId, vote) {
    const voterAddress = document.getElementById(`voterAddr_${proposalId}`).value;
    
    if (!voterAddress) {
        alert('Please enter your address');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/governance/vote`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ proposalId, voterAddress, vote })
        });

        const data = await response.json();

        if (data.error) {
            alert('Error: ' + data.error);
            return;
        }

        alert(`Vote cast: ${vote.toUpperCase()}!`);
        viewActiveProposals();
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

async function viewGovernanceStats() {
    try {
        const response = await fetch(`${API_BASE}/api/governance/stats`);
        const data = await response.json();

        const resultDiv = document.getElementById('govStats');
        resultDiv.className = 'result success';
        resultDiv.innerHTML = `
            <h4>Governance Statistics</h4>
            <p><strong>Total Proposals:</strong> ${data.totalProposals}</p>
            <p><strong>Active Proposals:</strong> ${data.activeProposals}</p>
            <p><strong>Approved:</strong> ${data.approvedProposals}</p>
            <p><strong>Rejected:</strong> ${data.rejectedProposals}</p>
            <p><strong>Executed:</strong> ${data.executedProposals}</p>
            <p><strong>Voting Period:</strong> ${data.votingPeriodDays} days</p>
            <p><strong>Minimum Participation:</strong> ${data.minimumParticipation}</p>
            <p><strong>Approval Threshold:</strong> ${data.approvalThreshold}</p>
        `;
    } catch (error) {
        showError('govStats', error.message);
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
                            <strong>Amount:</strong> ${tx.amount} KENO<br>
                            ${tx.message ? `<strong>Message:</strong> ${tx.message}<br>` : ''}
                            <strong>Hash:</strong> <code>${tx.calculateHash ? tx.calculateHash() : 'N/A'}</code>
                        </div>
                    `).join('')}
                </div>
            `;
        });
        
        resultDiv.innerHTML = html;
    } catch (error) {
        showError('blockchainData', 'Error loading blockchain: ' + error.message);
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
            html += `
                <div class="transaction-item">
                    <strong>From:</strong> ${tx.fromAddress || 'Mining Reward'}<br>
                    <strong>To:</strong> ${tx.toAddress}<br>
                    <strong>Amount:</strong> ${tx.amount} KENO<br>
                    <strong>Fee:</strong> ${tx.fee} KENO<br>
                    ${tx.message ? `<strong>Message:</strong> ${tx.message}<br>` : ''}
                    <strong>Timestamp:</strong> ${new Date(tx.timestamp).toLocaleString()}
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

async function togglePoRVMode() {
    try {
        const response = await fetch(`${API_BASE}/api/porv/toggle`, {
            method: 'POST'
        });
        const data = await response.json();
        
        const resultDiv = document.getElementById('porvModeStatus');
        resultDiv.className = 'result success';
        resultDiv.innerHTML = `
            <h4>PoRV Mode Updated</h4>
            <p><strong>Status:</strong> ${data.enabled ? '🧠 PoRV Enabled' : '⛏️ PoW Enabled'}</p>
            <p>${data.enabled ? 'Mining now requires completing computational jobs for RVTs' : 'Mining uses traditional proof-of-work'}</p>
        `;
    } catch (error) {
        showError('porvModeStatus', error.message);
    }
}

async function loadComputationalJobs() {
    try {
        const response = await fetch(`${API_BASE}/api/porv/jobs`);
        const data = await response.json();
        
        const resultDiv = document.getElementById('jobsList');
        
        if (!data.jobs || data.jobs.length === 0) {
            resultDiv.className = 'result';
            resultDiv.innerHTML = '<p>No computational jobs available. Create one in the Enterprise tab!</p>';
            return;
        }
        
        let html = '<h4>Available Computational Jobs</h4>';
        data.jobs.forEach(job => {
            html += `
                <div class="transaction-item">
                    <strong>Job ID:</strong> ${job.jobId}<br>
                    <strong>Type:</strong> ${job.jobType}<br>
                    <strong>Status:</strong> <span style="color: ${job.status === 'pending' ? '#f39c12' : job.status === 'completed' ? '#3498db' : '#2ecc71'}">${job.status.toUpperCase()}</span><br>
                    <strong>Upfront Fee:</strong> ${job.upfrontFee} KENO<br>
                    <strong>Royalty Rate:</strong> ${job.royaltyRate}%<br>
                    <strong>Client ID:</strong> ${job.clientId}<br>
                    ${job.rvtId ? `<strong>RVT Issued:</strong> ${job.rvtId}<br>` : ''}
                    <strong>Created:</strong> ${new Date(job.createdAt).toLocaleString()}
                </div>
            `;
        });
        
        resultDiv.className = 'result success';
        resultDiv.innerHTML = html;
    } catch (error) {
        showError('jobsList', error.message);
    }
}

async function minePoRVBlock() {
    const minerAddress = document.getElementById('porvMinerAddress').value;
    const jobId = document.getElementById('porvJobId').value;
    
    if (!minerAddress) {
        showError('porvMiningResult', 'Please enter a miner address');
        return;
    }
    
    const resultDiv = document.getElementById('porvMiningResult');
    resultDiv.className = 'result';
    resultDiv.innerHTML = '<p>Mining PoRV block...</p>';
    
    try {
        const url = jobId ? `${API_BASE}/api/porv/mine/${jobId}` : `${API_BASE}/api/porv/mine`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ minerAddress })
        });
        const data = await response.json();
        
        let html = '<h4>PoRV Block Mined Successfully!</h4>';
        if (data.job) {
            html += `
                <div class="transaction-item">
                    <strong>Job ID:</strong> ${data.job.jobId}<br>
                    <strong>Job Type:</strong> ${data.job.jobType}<br>
                    <strong>Upfront Fee Earned:</strong> ${data.job.upfrontFee} KENO<br>
                    <strong>Royalty Rate:</strong> ${data.job.royaltyRate}%
                </div>
            `;
        }
        
        if (data.rvt) {
            html += `
                <div class="transaction-item" style="background: linear-gradient(135deg, rgba(142, 45, 226, 0.1), rgba(74, 0, 224, 0.1)); border-left: 4px solid #8e2de2;">
                    <h4>💎 Residual Value Token Issued!</h4>
                    <strong>RVT ID:</strong> ${data.rvt.rvtId}<br>
                    <strong>Holder:</strong> ${data.rvt.holderAddress}<br>
                    <strong>Block Height:</strong> ${data.rvt.blockHeight}<br>
                    <strong>Status:</strong> ${data.rvt.isActive ? '✅ Active' : '❌ Inactive'}<br>
                    <p style="margin-top: 10px; color: #8e2de2; font-weight: 600;">
                        🎉 You now earn perpetual royalties from commercial usage of this computational work!
                    </p>
                </div>
            `;
        }
        
        if (data.block) {
            html += `
                <div class="transaction-item">
                    <strong>Block Hash:</strong> <code>${data.block.hash}</code><br>
                    <strong>Block Height:</strong> ${data.block.index || 'N/A'}<br>
                    <strong>Transactions:</strong> ${data.block.transactions?.length || 0}
                </div>
            `;
        }
        
        resultDiv.className = 'result success';
        resultDiv.innerHTML = html;
    } catch (error) {
        showError('porvMiningResult', error.message);
    }
}

async function loadPoRVStats() {
    try {
        const response = await fetch(`${API_BASE}/api/porv/stats`);
        const data = await response.json();
        
        const resultDiv = document.getElementById('porvStats');
        let html = '<h4>PoRV System Statistics</h4>';
        html += `
            <div class="stats-grid">
                <div class="transaction-item">
                    <strong>PoRV Mode:</strong> ${data.enabled ? '🧠 Enabled' : '⛏️ Disabled'}<br>
                    <strong>Total Jobs:</strong> ${data.totalJobs}<br>
                    <strong>Pending Jobs:</strong> ${data.pendingJobs}<br>
                    <strong>Completed Jobs:</strong> ${data.completedJobs}<br>
                    <strong>Deployed Jobs:</strong> ${data.deployedJobs}
                </div>
                <div class="transaction-item">
                    <strong>Total RVTs:</strong> ${data.totalRVTs}<br>
                    <strong>Active RVTs:</strong> ${data.activeRVTs}<br>
                    <strong>Total Royalties Collected:</strong> ${data.totalRoyalties?.toFixed(2) || 0} KENO<br>
                    <strong>Total Tokens Burned:</strong> ${data.totalBurned?.toFixed(2) || 0} KENO
                </div>
            </div>
        `;
        
        resultDiv.className = 'result success';
        resultDiv.innerHTML = html;
    } catch (error) {
        showError('porvStats', error.message);
    }
}

async function loadMyRVTs() {
    const holderAddress = document.getElementById('rvtHolderAddress').value;
    if (!holderAddress) {
        showError('rvtPortfolioList', 'Please enter your address');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/porv/rvts/holder/${holderAddress}`);
        const data = await response.json();
        
        const resultDiv = document.getElementById('rvtPortfolioList');
        
        if (!data.rvts || data.rvts.length === 0) {
            resultDiv.className = 'result';
            resultDiv.innerHTML = '<p>No RVTs found for this address. Mine a PoRV block to earn one!</p>';
            return;
        }
        
        let html = `<h4>Your RVT Portfolio (${data.rvts.length} tokens)</h4>`;
        data.rvts.forEach(rvt => {
            html += `
                <div class="transaction-item" style="background: linear-gradient(135deg, rgba(142, 45, 226, 0.1), rgba(74, 0, 224, 0.1)); border-left: 4px solid #8e2de2;">
                    <strong>RVT ID:</strong> ${rvt.rvtId}<br>
                    <strong>Job ID:</strong> ${rvt.jobId}<br>
                    <strong>Computation Type:</strong> ${rvt.computationType}<br>
                    <strong>Block Height:</strong> ${rvt.blockHeight}<br>
                    <strong>Status:</strong> ${rvt.isActive ? '✅ Active (Earning Royalties)' : '❌ Inactive'}<br>
                    <strong>Issued:</strong> ${new Date(rvt.issuedAt).toLocaleString()}<br>
                    ${rvt.totalRoyaltiesEarned ? `<strong>Total Royalties Earned:</strong> ${rvt.totalRoyaltiesEarned.toFixed(2)} KENO<br>` : ''}
                </div>
            `;
        });
        
        resultDiv.className = 'result success';
        resultDiv.innerHTML = html;
    } catch (error) {
        showError('rvtPortfolioList', error.message);
    }
}

async function loadRVTDetails() {
    const rvtId = document.getElementById('rvtDetailsId').value;
    if (!rvtId) {
        showError('rvtDetailsResult', 'Please enter an RVT ID');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/porv/rvt/${rvtId}`);
        const data = await response.json();
        
        const resultDiv = document.getElementById('rvtDetailsResult');
        let html = '<h4>RVT Details</h4>';
        html += `
            <div class="transaction-item" style="background: linear-gradient(135deg, rgba(142, 45, 226, 0.1), rgba(74, 0, 224, 0.1)); border-left: 4px solid #8e2de2;">
                <strong>RVT ID:</strong> ${data.rvt.rvtId}<br>
                <strong>Job ID:</strong> ${data.rvt.jobId}<br>
                <strong>Holder Address:</strong> ${data.rvt.holderAddress}<br>
                <strong>Computation Type:</strong> ${data.rvt.computationType}<br>
                <strong>Block Height:</strong> ${data.rvt.blockHeight}<br>
                <strong>Status:</strong> ${data.rvt.isActive ? '✅ Active' : '❌ Inactive'}<br>
                <strong>Issued:</strong> ${new Date(data.rvt.issuedAt).toLocaleString()}<br>
                ${data.rvt.totalRoyaltiesEarned ? `<strong>Total Royalties Earned:</strong> ${data.rvt.totalRoyaltiesEarned.toFixed(2)} KENO<br>` : ''}
                ${data.rvt.metadata ? `<strong>Metadata:</strong> ${JSON.stringify(data.rvt.metadata)}<br>` : ''}
            </div>
        `;
        
        resultDiv.className = 'result success';
        resultDiv.innerHTML = html;
    } catch (error) {
        showError('rvtDetailsResult', error.message);
    }
}

async function loadAllRVTs() {
    try {
        const response = await fetch(`${API_BASE}/api/porv/rvts`);
        const data = await response.json();
        
        const resultDiv = document.getElementById('allRVTsList');
        
        if (!data.rvts || data.rvts.length === 0) {
            resultDiv.className = 'result';
            resultDiv.innerHTML = '<p>No RVTs have been issued yet.</p>';
            return;
        }
        
        let html = `<h4>All Issued RVTs (${data.rvts.length} total)</h4>`;
        data.rvts.forEach(rvt => {
            html += `
                <div class="transaction-item" style="background: linear-gradient(135deg, rgba(142, 45, 226, 0.1), rgba(74, 0, 224, 0.1)); border-left: 4px solid #8e2de2;">
                    <strong>RVT ID:</strong> ${rvt.rvtId}<br>
                    <strong>Holder:</strong> ${rvt.holderAddress?.substring(0, 20)}...<br>
                    <strong>Type:</strong> ${rvt.computationType}<br>
                    <strong>Status:</strong> ${rvt.isActive ? '✅ Active' : '❌ Inactive'}
                </div>
            `;
        });
        
        resultDiv.className = 'result success';
        resultDiv.innerHTML = html;
    } catch (error) {
        showError('allRVTsList', error.message);
    }
}

async function registerEnterpriseClient() {
    const clientName = document.getElementById('clientName').value;
    const walletAddress = document.getElementById('clientWalletAddress').value;
    
    if (!clientName || !walletAddress) {
        showError('registerClientResult', 'Please fill in all fields');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/porv/enterprise/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: clientName, walletAddress })
        });
        const data = await response.json();
        
        const resultDiv = document.getElementById('registerClientResult');
        resultDiv.className = 'result success';
        resultDiv.innerHTML = `
            <h4>Enterprise Client Registered Successfully!</h4>
            <div class="transaction-item">
                <strong>Client ID:</strong> ${data.client.clientId}<br>
                <strong>Name:</strong> ${data.client.name}<br>
                <strong>Wallet Address:</strong> ${data.client.walletAddress}<br>
                <strong>Status:</strong> ${data.client.isActive ? '✅ Active' : '❌ Inactive'}<br>
                <strong>Registered:</strong> ${new Date(data.client.registeredAt).toLocaleString()}<br>
                <p style="margin-top: 10px; color: #3498db; font-weight: 600;">
                    Save your Client ID! You'll need it to create computational jobs.
                </p>
            </div>
        `;
    } catch (error) {
        showError('registerClientResult', error.message);
    }
}

async function createComputationalJob() {
    const clientId = document.getElementById('jobClientId').value;
    const jobType = document.getElementById('jobType').value;
    const parametersStr = document.getElementById('jobParameters').value;
    const upfrontFee = parseFloat(document.getElementById('jobUpfrontFee').value);
    const royaltyRate = parseFloat(document.getElementById('jobRoyaltyRate').value);
    const privateKey = document.getElementById('jobClientPrivateKey').value;
    
    if (!clientId || !parametersStr || !upfrontFee || !royaltyRate || !privateKey) {
        showError('createJobResult', 'Please fill in all fields');
        return;
    }
    
    try {
        const parameters = JSON.parse(parametersStr);
        
        const clientResponse = await fetch(`${API_BASE}/api/porv/enterprise/client/${clientId}`);
        const clientData = await clientResponse.json();
        const clientWallet = clientData.client.walletAddress;
        
        const tempJobId = 'TEMP_' + Date.now();
        const escrowAddress = 'JOB_ESCROW_' + tempJobId;
        
        const escrowPayment = await signTransaction(
            clientWallet,
            escrowAddress,
            upfrontFee,
            1,
            `Job escrow payment for ${jobType}`,
            privateKey
        );
        
        const response = await fetch(`${API_BASE}/api/porv/enterprise/job`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                clientId,
                jobType,
                parameters,
                upfrontFee,
                royaltyRate,
                escrowPaymentTx: escrowPayment
            })
        });
        const data = await response.json();
        
        const resultDiv = document.getElementById('createJobResult');
        resultDiv.className = 'result success';
        resultDiv.innerHTML = `
            <h4>Computational Job Created Successfully!</h4>
            <div class="transaction-item">
                <strong>Job ID:</strong> ${data.job.jobId}<br>
                <strong>Type:</strong> ${data.job.jobType}<br>
                <strong>Status:</strong> ${data.job.status.toUpperCase()}<br>
                <strong>Upfront Fee:</strong> ${data.job.upfrontFee} KENO (escrowed)<br>
                <strong>Royalty Rate:</strong> ${data.job.royaltyRate}%<br>
                <strong>Escrow Address:</strong> ${data.job.escrowAddress}<br>
                <p style="margin-top: 10px; color: #2ecc71; font-weight: 600;">
                    ✅ Escrow payment signed and verified! Job is now available for miners.
                </p>
            </div>
        `;
    } catch (error) {
        showError('createJobResult', error.message);
    }
}

async function recordAPIUsage() {
    const jobId = document.getElementById('usageJobId').value;
    const revenue = parseFloat(document.getElementById('usageRevenue').value);
    const privateKey = document.getElementById('usageClientPrivateKey').value;
    
    if (!jobId || !revenue || !privateKey) {
        showError('usageResult', 'Please fill in all fields');
        return;
    }
    
    try {
        const jobResponse = await fetch(`${API_BASE}/api/porv/job/${jobId}`);
        const jobData = await jobResponse.json();
        
        const clientResponse = await fetch(`${API_BASE}/api/porv/enterprise/client/${jobData.job.clientId}`);
        const clientData = await clientResponse.json();
        const clientWallet = clientData.client.walletAddress;
        
        const royaltyAmount = Math.floor((revenue * jobData.job.royaltyRate) / 100);
        const royaltyPoolAddress = 'ROYALTY_POOL_' + jobId;
        
        const royaltyPayment = await signTransaction(
            clientWallet,
            royaltyPoolAddress,
            royaltyAmount,
            1,
            `Royalty payment for ${jobId}`,
            privateKey
        );
        
        const response = await fetch(`${API_BASE}/api/porv/api-usage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jobId,
                revenueGenerated: revenue,
                royaltyPaymentTx: royaltyPayment
            })
        });
        const data = await response.json();
        
        const resultDiv = document.getElementById('usageResult');
        resultDiv.className = 'result success';
        resultDiv.innerHTML = `
            <h4>API Usage Recorded & Royalties Distributed!</h4>
            <div class="transaction-item">
                <strong>Revenue:</strong> $${revenue}<br>
                <strong>Royalty Amount:</strong> ${data.royalty} KENO<br>
                <strong>Distribution:</strong><br>
                &nbsp;&nbsp;• Miner (50%): ${data.distribution.minerPayout} KENO<br>
                &nbsp;&nbsp;• Burned (40%): ${data.distribution.burnAmount} KENO<br>
                &nbsp;&nbsp;• Treasury (10%): ${data.distribution.treasuryAmount} KENO<br>
                <p style="margin-top: 10px; color: #2ecc71; font-weight: 600;">
                    ✅ Royalty payment signed, verified, and automatically distributed!
                </p>
            </div>
        `;
    } catch (error) {
        showError('usageResult', error.message);
    }
}

async function viewEnterpriseClient() {
    const clientId = document.getElementById('viewClientId').value;
    if (!clientId) {
        showError('clientDashboard', 'Please enter a client ID');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/porv/enterprise/client/${clientId}`);
        const data = await response.json();
        
        const resultDiv = document.getElementById('clientDashboard');
        let html = '<h4>Enterprise Client Dashboard</h4>';
        html += `
            <div class="transaction-item">
                <strong>Client ID:</strong> ${data.client.clientId}<br>
                <strong>Name:</strong> ${data.client.name}<br>
                <strong>Wallet Address:</strong> ${data.client.walletAddress}<br>
                <strong>Status:</strong> ${data.client.isActive ? '✅ Active' : '❌ Inactive'}<br>
                <strong>Jobs Created:</strong> ${data.client.jobsCreated?.length || 0}<br>
                <strong>Total Paid:</strong> ${data.client.totalPaid?.toFixed(2) || 0} KENO<br>
                <strong>Total Royalties:</strong> ${data.client.totalRoyalties?.toFixed(2) || 0} KENO<br>
                <strong>Registered:</strong> ${new Date(data.client.registeredAt).toLocaleString()}
            </div>
        `;
        
        resultDiv.className = 'result success';
        resultDiv.innerHTML = html;
    } catch (error) {
        showError('clientDashboard', error.message);
    }
}

async function viewAllClients() {
    try {
        const response = await fetch(`${API_BASE}/api/porv/enterprise/clients`);
        const data = await response.json();
        
        const resultDiv = document.getElementById('allClientsList');
        
        if (!data.clients || data.clients.length === 0) {
            resultDiv.className = 'result';
            resultDiv.innerHTML = '<p>No enterprise clients registered yet.</p>';
            return;
        }
        
        let html = `<h4>All Enterprise Clients (${data.clients.length} total)</h4>`;
        data.clients.forEach(client => {
            html += `
                <div class="transaction-item">
                    <strong>Client ID:</strong> ${client.clientId}<br>
                    <strong>Name:</strong> ${client.name}<br>
                    <strong>Jobs:</strong> ${client.jobsCreated?.length || 0}<br>
                    <strong>Total Paid:</strong> ${client.totalPaid?.toFixed(2) || 0} KENO<br>
                    <strong>Status:</strong> ${client.isActive ? '✅ Active' : '❌ Inactive'}
                </div>
            `;
        });
        
        resultDiv.className = 'result success';
        resultDiv.innerHTML = html;
    } catch (error) {
        showError('allClientsList', error.message);
    }
}

async function loadRoyaltyCollections() {
    const jobId = document.getElementById('royaltyJobId').value;
    
    try {
        const url = jobId 
            ? `${API_BASE}/api/porv/royalties/job/${jobId}`
            : `${API_BASE}/api/porv/royalties`;
        const response = await fetch(url);
        const data = await response.json();
        
        const resultDiv = document.getElementById('royaltyCollectionsList');
        
        if (!data.collections || data.collections.length === 0) {
            resultDiv.className = 'result';
            resultDiv.innerHTML = '<p>No royalty collections found.</p>';
            return;
        }
        
        let html = `<h4>Royalty Collections (${data.collections.length} total)</h4>`;
        data.collections.forEach(collection => {
            html += `
                <div class="transaction-item">
                    <strong>Collection ID:</strong> ${collection.collectionId}<br>
                    <strong>Job ID:</strong> ${collection.jobId}<br>
                    <strong>RVT ID:</strong> ${collection.rvtId}<br>
                    <strong>Amount:</strong> ${collection.amount} KENO<br>
                    <strong>Source:</strong> ${collection.source}<br>
                    <strong>Status:</strong> ${collection.distributed ? '✅ Distributed' : '⏳ Pending'}<br>
                    <strong>Collected:</strong> ${new Date(collection.collectedAt).toLocaleString()}
                </div>
            `;
        });
        
        resultDiv.className = 'result success';
        resultDiv.innerHTML = html;
    } catch (error) {
        showError('royaltyCollectionsList', error.message);
    }
}

async function loadBurnStats() {
    try {
        const response = await fetch(`${API_BASE}/api/porv/burns/stats`);
        const data = await response.json();
        
        const resultDiv = document.getElementById('burnStats');
        let html = '<h4>Token Burn Statistics</h4>';
        html += `
            <div class="transaction-item" style="background: linear-gradient(135deg, rgba(231, 76, 60, 0.1), rgba(192, 57, 43, 0.1)); border-left: 4px solid #e74c3c;">
                <strong>Total Burned:</strong> ${data.stats.totalBurned} KENO<br>
                <strong>Burn Count:</strong> ${data.stats.burnCount} burns<br>
                <strong>Last Burn:</strong> ${data.stats.lastBurnDate ? new Date(data.stats.lastBurnDate).toLocaleString() : 'Never'}<br>
                <strong>Burn Wallet:</strong> <code>${data.stats.burnAddress}</code><br>
                <p style="margin-top: 10px; color: #e74c3c; font-weight: 600;">
                    🔥 40% of all royalties are permanently burned, reducing total supply!
                </p>
            </div>
        `;
        
        resultDiv.className = 'result success';
        resultDiv.innerHTML = html;
    } catch (error) {
        showError('burnStats', error.message);
    }
}

async function loadBurnHistory() {
    try {
        const response = await fetch(`${API_BASE}/api/porv/burns`);
        const data = await response.json();
        
        const resultDiv = document.getElementById('burnHistory');
        
        if (!data.burns || data.burns.length === 0) {
            resultDiv.className = 'result';
            resultDiv.innerHTML = '<p>No burns recorded yet.</p>';
            return;
        }
        
        let html = `<h4>Burn History (${data.burns.length} total burns)</h4>`;
        data.burns.forEach(burn => {
            html += `
                <div class="transaction-item" style="background: linear-gradient(135deg, rgba(231, 76, 60, 0.1), rgba(192, 57, 43, 0.1)); border-left: 4px solid #e74c3c;">
                    <strong>Burn ID:</strong> ${burn.burnId}<br>
                    <strong>Amount:</strong> ${burn.amount} KENO<br>
                    <strong>Source:</strong> ${burn.source}<br>
                    <strong>Transaction Hash:</strong> <code>${burn.transactionHash || 'N/A'}</code><br>
                    <strong>Burned:</strong> ${new Date(burn.burnedAt).toLocaleString()}
                </div>
            `;
        });
        
        resultDiv.className = 'result success';
        resultDiv.innerHTML = html;
    } catch (error) {
        showError('burnHistory', error.message);
    }
}

async function loadSupplyAnalytics() {
    try {
        const statsResponse = await fetch(`${API_BASE}/api/stats`);
        const statsData = await statsResponse.json();
        
        const porvResponse = await fetch(`${API_BASE}/api/porv/stats`);
        const porvData = await porvResponse.json();
        
        const resultDiv = document.getElementById('supplyAnalytics');
        const totalMinted = statsData.supply?.totalMinted || 0;
        const totalBurned = porvData.totalBurned || 0;
        const circulatingSupply = statsData.supply?.circulatingSupply || 0;
        const burnRate = totalMinted > 0 ? ((totalBurned / totalMinted) * 100).toFixed(2) : 0;
        
        let html = '<h4>Supply Analytics</h4>';
        html += `
            <div class="stats-grid">
                <div class="transaction-item">
                    <strong>Total Minted:</strong> ${totalMinted} KENO<br>
                    <strong>Total Burned:</strong> ${totalBurned} KENO<br>
                    <strong>Circulating Supply:</strong> ${circulatingSupply} KENO<br>
                    <strong>Burn Rate:</strong> ${burnRate}%
                </div>
                <div class="transaction-item" style="background: linear-gradient(135deg, rgba(46, 204, 113, 0.1), rgba(39, 174, 96, 0.1)); border-left: 4px solid #2ecc71;">
                    <h4>Deflationary Impact</h4>
                    <p>Every royalty payment burns 40% of tokens permanently.</p>
                    <p>As more AI/ML models generate revenue, more tokens are burned.</p>
                    <p style="color: #2ecc71; font-weight: 600; margin-top: 10px;">
                        Result: Decreasing supply + Increasing demand = Higher value! 📈
                    </p>
                </div>
            </div>
        `;
        
        resultDiv.className = 'result success';
        resultDiv.innerHTML = html;
    } catch (error) {
        showError('supplyAnalytics', error.message);
    }
}

async function signTransaction(fromAddress, toAddress, amount, fee, message, privateKeyHex) {
    if (!ec) {
        throw new Error('Elliptic library not initialized');
    }
    
    const keyPair = ec.keyFromPrivate(privateKeyHex, 'hex');
    const publicKey = keyPair.getPublic('hex');
    
    if (publicKey !== fromAddress) {
        throw new Error('Private key does not match from address');
    }
    
    const timestamp = Date.now();
    const txData = fromAddress + toAddress + amount + fee + message + timestamp;
    const hash = CryptoJS.SHA256(txData).toString();
    const signature = keyPair.sign(hash, 'hex').toDER('hex');
    
    return {
        fromAddress,
        toAddress,
        amount,
        fee,
        message,
        timestamp,
        signature
    };
}
