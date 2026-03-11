let currentWallet = '';
let activeLoan = null;
let profileData = null;
let currentOpportunities = [];

document.addEventListener('DOMContentLoaded', () => {
    loadStats();
    loadOpportunities();
    loadLeaderboard();
    
    const walletInput = document.getElementById('walletAddress');
    if (walletInput) {
        walletInput.addEventListener('blur', checkForActiveLoan);
    }
    
    setInterval(loadOpportunities, 30000);
    setInterval(loadStats, 60000);
});

async function checkForActiveLoan() {
    const walletAddress = document.getElementById('walletAddress').value.trim();
    if (!walletAddress) return;
    
    try {
        const response = await fetch(`/api/arbitrage/active-loan/${walletAddress}`);
        const data = await response.json();
        
        if (data.success && data.hasActiveLoan) {
            currentWallet = walletAddress;
            activeLoan = data.loan;
            displayActiveLoan();
            document.getElementById('viewProfileBtn').style.display = 'block';
            showAlert('You have an active flash loan! Repay it before taking a new one.', 'info');
        }
    } catch (error) {
        console.error('Error checking active loan:', error);
    }
}

function showAlert(message, type = 'info') {
    const alertContainer = document.getElementById('alertContainer');
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;
    alertContainer.appendChild(alert);
    
    setTimeout(() => {
        alert.remove();
    }, 5000);
}

async function loadStats() {
    try {
        const response = await fetch('/api/arbitrage/stats');
        const data = await response.json();
        
        if (data.success) {
            const stats = data.stats;
            document.getElementById('statTotalLoans').textContent = stats.totalLoans.toLocaleString();
            document.getElementById('statTotalProfit').textContent = stats.totalProfitGenerated.toFixed(2);
            document.getElementById('statTotalTraders').textContent = stats.totalTraders.toLocaleString();
            document.getElementById('statTotalBonuses').textContent = stats.totalBonusesPaid.toFixed(2);
        }
    } catch (error) {
        console.error('Failed to load stats:', error);
    }
}

async function loadOpportunities() {
    try {
        const response = await fetch('/api/arbitrage/opportunities');
        const data = await response.json();
        
        const loading = document.getElementById('opportunitiesLoading');
        const list = document.getElementById('opportunitiesList');
        
        loading.style.display = 'none';
        list.style.display = 'block';
        
        if (data.success && data.opportunities.length > 0) {
            currentOpportunities = data.opportunities;
            list.innerHTML = data.opportunities.map((opp, index) => {
                const profitPct = opp.profitPercent || opp.percentageDiff || 0;
                return `
                <div class="opportunity-card" id="opp-${index}">
                    <div class="opportunity-profit">+${profitPct.toFixed(2)}% Profit Potential</div>
                    <div class="opportunity-details">
                        <div>
                            <strong>Buy:</strong> ${opp.buyExchange}<br>
                            Price: $${opp.buyPrice.toFixed(4)}
                        </div>
                        <div>
                            <strong>Sell:</strong> ${opp.sellExchange}<br>
                            Price: $${opp.sellPrice.toFixed(4)}
                        </div>
                    </div>
                    <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e2e8f0;">
                        <button onclick="executeArbitrage(${index})" class="btn-execute-arb" style="width: 100%; padding: 12px; background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 0.95rem;">
                            Execute This Arbitrage
                        </button>
                        <small style="color: #64748b; display: block; margin-top: 8px; text-align: center;">
                            Calculates profit automatically based on your loan
                        </small>
                    </div>
                </div>
            `}).join('');
        } else {
            list.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #64748b;">
                    <div style="font-size: 3rem; margin-bottom: 15px;">📊</div>
                    <p>No arbitrage opportunities detected right now.</p>
                    <small>We scan exchanges every 30 seconds for price differentials ≥2%</small>
                </div>
            `;
        }
    } catch (error) {
        console.error('Failed to load opportunities:', error);
        document.getElementById('opportunitiesList').innerHTML = `
            <div style="text-align: center; padding: 40px; color: #ef4444;">
                <p>Error loading opportunities. Please try again.</p>
            </div>
        `;
    }
}

async function loadLeaderboard() {
    try {
        const response = await fetch('/api/arbitrage/leaderboard?limit=10');
        const data = await response.json();
        
        const loading = document.getElementById('leaderboardLoading');
        const content = document.getElementById('leaderboardContent');
        
        loading.style.display = 'none';
        content.style.display = 'block';
        
        if (data.success && data.leaderboard.length > 0) {
            const table = `
                <table class="leaderboard-table">
                    <thead>
                        <tr>
                            <th>Rank</th>
                            <th>Trader</th>
                            <th>Total Profit</th>
                            <th>Successful Trades</th>
                            <th>Level</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.leaderboard.map((trader, index) => {
                            const rank = index + 1;
                            const rankClass = rank === 1 ? 'rank-1' : rank === 2 ? 'rank-2' : rank === 3 ? 'rank-3' : 'rank-other';
                            const levelBadge = getLevelBadge(trader.reputationLevel);
                            
                            return `
                                <tr>
                                    <td>
                                        <span class="rank-badge ${rankClass}">${rank}</span>
                                    </td>
                                    <td>
                                        <span style="font-family: 'Courier New', monospace; font-size: 0.85rem;">
                                            ${trader.walletAddress.substring(0, 20)}...
                                        </span>
                                    </td>
                                    <td>
                                        <strong style="color: #10b981;">${trader.totalProfit.toFixed(2)} KENO</strong>
                                    </td>
                                    <td>${trader.successfulLoans}</td>
                                    <td>${levelBadge}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            `;
            content.innerHTML = table;
        } else {
            content.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #64748b;">
                    <div style="font-size: 3rem; margin-bottom: 15px;">🏆</div>
                    <p>No traders yet. Be the first to join the revolution!</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Failed to load leaderboard:', error);
        document.getElementById('leaderboardContent').innerHTML = `
            <div style="text-align: center; padding: 40px; color: #ef4444;">
                <p>Error loading leaderboard. Please try again.</p>
            </div>
        `;
    }
}

function getLevelBadge(level) {
    const badges = {
        beginner: '<span class="badge" style="background: #e2e8f0; color: #64748b;">Beginner</span>',
        bronze: '<span class="badge badge-bronze">🥉 Bronze</span>',
        silver: '<span class="badge badge-silver">🥈 Silver</span>',
        gold: '<span class="badge badge-gold">🥇 Gold</span>',
        platinum: '<span class="badge badge-platinum">💎 Platinum</span>'
    };
    return badges[level] || badges.beginner;
}

async function createFlashLoan() {
    const walletAddress = document.getElementById('walletAddress').value.trim();
    const amount = parseFloat(document.getElementById('loanAmount').value);
    
    if (!walletAddress) {
        showAlert('Please enter your wallet address', 'error');
        return;
    }
    
    if (!amount || amount < 100 || amount > 10000) {
        showAlert('Loan amount must be between 100 and 10,000 KENO', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/arbitrage/flash-loan/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                walletAddress,
                amount,
                purpose: 'Arbitrage trading'
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert(data.message, 'success');
            currentWallet = walletAddress;
            activeLoan = data;
            displayActiveLoan();
            document.getElementById('viewProfileBtn').style.display = 'block';
            loadStats();
        } else {
            showAlert(data.error, 'error');
        }
    } catch (error) {
        console.error('Flash loan error:', error);
        showAlert('Failed to create flash loan. Please try again.', 'error');
    }
}

function displayActiveLoan() {
    const loanInfo = document.getElementById('activeLoanInfo');
    
    if (activeLoan) {
        const expiresIn = Math.floor((activeLoan.expiresAt - Date.now()) / 1000);
        const minutes = Math.floor(expiresIn / 60);
        const seconds = expiresIn % 60;
        const isExpired = expiresIn <= 0;
        
        loanInfo.innerHTML = `
            <div class="loan-info" style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); padding: 20px; border-radius: 12px; margin-bottom: 20px; border: 2px solid #f59e0b;">
                <h3 style="color: #92400e; margin-bottom: 15px;">⚡ Active Flash Loan</h3>
                <div class="loan-details" style="display: grid; gap: 10px; margin-bottom: 15px;">
                    <div class="loan-detail-item" style="display: flex; justify-content: space-between;">
                        <span class="loan-detail-label" style="color: #78350f; font-weight: 600;">Loan ID:</span>
                        <span class="loan-detail-value" style="color: #92400e; font-family: monospace; font-size: 0.85rem;">${activeLoan.loanId}</span>
                    </div>
                    <div class="loan-detail-item" style="display: flex; justify-content: space-between;">
                        <span class="loan-detail-label" style="color: #78350f; font-weight: 600;">Amount:</span>
                        <span class="loan-detail-value" style="color: #92400e; font-weight: 700;">${activeLoan.amount} KENO</span>
                    </div>
                    <div class="loan-detail-item" style="display: flex; justify-content: space-between;">
                        <span class="loan-detail-label" style="color: #78350f; font-weight: 600;">Status:</span>
                        <span class="loan-detail-value" style="color: ${isExpired ? '#dc2626' : '#059669'}; font-weight: 700;">${isExpired ? 'EXPIRED' : `${minutes}m ${seconds}s remaining`}</span>
                    </div>
                    <div class="loan-detail-item" style="display: flex; justify-content: space-between;">
                        <span class="loan-detail-label" style="color: #78350f; font-weight: 600;">Fee:</span>
                        <span class="loan-detail-value" style="color: #059669; font-weight: 700;">0% (FREE)</span>
                    </div>
                </div>
                <div style="background: rgba(255,255,255,0.7); padding: 12px; border-radius: 8px; margin-bottom: 15px;">
                    <p style="color: #78350f; font-size: 0.9rem; margin: 0;">
                        <strong>How to repay:</strong> Click "Repay Loan Now" below. Enter any profit you made from arbitrage trading (enter 0 if none). The loan amount will be returned and your profit recorded.
                    </p>
                </div>
                <button class="btn btn-danger" onclick="repayLoan()" style="width: 100%; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 14px; border-radius: 8px; font-size: 1rem; font-weight: 700; border: none; cursor: pointer;">
                    💰 Repay Loan Now
                </button>
            </div>
        `;
        
        if (!isExpired) {
            setTimeout(() => {
                if (activeLoan) displayActiveLoan();
            }, 1000);
        }
    } else {
        loanInfo.innerHTML = '';
    }
}

async function repayLoan() {
    if (!activeLoan || !currentWallet) {
        showAlert('No active loan found', 'error');
        return;
    }
    
    const profit = await showCustomPrompt('Enter your arbitrage profit in KENO (enter 0 if no profit):', '0', '💰');
    
    if (profit === null) return;
    
    const profitAmount = parseFloat(profit) || 0;
    
    try {
        const response = await fetch('/api/arbitrage/flash-loan/repay', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                walletAddress: currentWallet,
                loanId: activeLoan.loanId,
                profit: profitAmount
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            let message = data.message;
            if (data.bonusEarned > 0) {
                message += ` Bonus earned: ${data.bonusEarned.toFixed(2)} KENO!`;
            }
            if (typeof showCustomAlert === 'function') {
                showCustomAlert(message, '✅');
            } else {
                showAlert(message, 'success');
            }
            activeLoan = null;
            displayActiveLoan();
            loadStats();
            loadLeaderboard();
        } else {
            if (typeof showCustomAlert === 'function') {
                showCustomAlert(data.error, '❌');
            } else {
                showAlert(data.error, 'error');
            }
            if (data.penaltyApplied) {
                activeLoan = null;
                displayActiveLoan();
            }
        }
    } catch (error) {
        console.error('Repayment error:', error);
        if (typeof showCustomAlert === 'function') {
            showCustomAlert('Failed to repay loan. Please try again.', '❌');
        } else {
            showAlert('Failed to repay loan. Please try again.', 'error');
        }
    }
}

async function executeArbitrage(opportunityIndex) {
    const opp = currentOpportunities[opportunityIndex];
    if (!opp) {
        showAlert('Opportunity expired. Please refresh the page.', 'error');
        return;
    }
    
    if (!activeLoan || !currentWallet) {
        showAlert('You need an active flash loan first! Get a loan, then execute arbitrage.', 'info');
        return;
    }
    
    const loanAmount = activeLoan.amount;
    const profitPct = opp.profitPercent || opp.percentageDiff || 0;
    const fees = loanAmount * 0.003;
    const grossProfit = loanAmount * (profitPct / 100);
    const netProfit = Math.max(0, grossProfit - fees);
    
    const breakdown = `
ARBITRAGE CALCULATION

Your Loan: ${loanAmount.toLocaleString()} KENO

Step 1: Buy ${opp.asset || 'Token'} on ${opp.buyExchange}
   Price: $${opp.buyPrice.toFixed(4)}

Step 2: Sell on ${opp.sellExchange}
   Price: $${opp.sellPrice.toFixed(4)}

Price Spread: ${profitPct.toFixed(2)}%

Gross Profit: ${grossProfit.toFixed(2)} KENO
Trading Fees (~0.3%): -${fees.toFixed(2)} KENO
━━━━━━━━━━━━━━━━━━━━━━━
NET PROFIT: ${netProfit.toFixed(2)} KENO

Execute this arbitrage trade?`;

    const confirmed = await showCustomConfirm(breakdown, '📊');
    
    if (!confirmed) return;
    
    try {
        const response = await fetch('/api/arbitrage/flash-loan/repay', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                walletAddress: currentWallet,
                loanId: activeLoan.loanId,
                profit: netProfit
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            let message = `Arbitrage executed successfully!\n\nProfit: ${netProfit.toFixed(2)} KENO`;
            if (data.bonusEarned > 0) {
                message += `\nBonus earned: ${data.bonusEarned.toFixed(2)} KENO!`;
            }
            if (typeof showCustomAlert === 'function') {
                showCustomAlert(message, '🎉');
            } else {
                showAlert(message, 'success');
            }
            activeLoan = null;
            displayActiveLoan();
            loadStats();
            loadLeaderboard();
        } else {
            if (typeof showCustomAlert === 'function') {
                showCustomAlert(data.error, '❌');
            } else {
                showAlert(data.error, 'error');
            }
        }
    } catch (error) {
        console.error('Arbitrage execution error:', error);
        if (typeof showCustomAlert === 'function') {
            showCustomAlert('Failed to execute arbitrage. Please try again.', '❌');
        } else {
            showAlert('Failed to execute arbitrage. Please try again.', 'error');
        }
    }
}

async function loadProfile() {
    if (!currentWallet) {
        const wallet = document.getElementById('walletAddress').value.trim();
        if (!wallet) {
            showAlert('Please enter a wallet address first', 'error');
            return;
        }
        currentWallet = wallet;
    }
    
    try {
        const response = await fetch(`/api/arbitrage/profile/${currentWallet}`);
        const data = await response.json();
        
        if (data.success) {
            profileData = data.profile;
            displayProfile();
        } else {
            showAlert('Profile not found. Take a flash loan first to create your profile!', 'info');
        }
    } catch (error) {
        console.error('Profile load error:', error);
        showAlert('Failed to load profile. Please try again.', 'error');
    }
}

function displayProfile() {
    if (!profileData) return;
    
    const alertContainer = document.getElementById('alertContainer');
    const profileHTML = `
        <div class="profile-card" style="margin-bottom: 20px;">
            <h2>👤 Your Arbitrage Profile</h2>
            <div class="profile-address">${profileData.walletAddress}</div>
            
            <div class="profile-stats">
                <div class="profile-stat">
                    <div class="profile-stat-value">${profileData.successfulLoans}</div>
                    <div class="profile-stat-label">Successful Trades</div>
                </div>
                <div class="profile-stat">
                    <div class="profile-stat-value">${profileData.totalProfit.toFixed(2)}</div>
                    <div class="profile-stat-label">Total Profit (KENO)</div>
                </div>
                <div class="profile-stat">
                    <div class="profile-stat-value">#${profileData.rank}</div>
                    <div class="profile-stat-label">Global Rank</div>
                </div>
            </div>
            
            <div style="margin-top: 25px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.2);">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong>Reputation Level:</strong> ${getLevelBadge(profileData.reputationLevel)}
                    </div>
                    <div>
                        <strong>Loan Limit:</strong> ${profileData.loanLimit.toLocaleString()} KENO
                    </div>
                </div>
            </div>
            
            ${profileData.badges && profileData.badges.length > 0 ? `
                <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.2);">
                    <strong>🏆 Earned Badges:</strong><br>
                    <div style="margin-top: 10px;">
                        ${profileData.badges.map(badge => `<span class="badge" style="background: #fbbf24; color: #92400e; margin: 5px;">${badge}</span>`).join('')}
                    </div>
                </div>
            ` : ''}
        </div>
    `;
    
    const existingProfile = document.querySelector('.profile-card');
    if (existingProfile) {
        existingProfile.remove();
    }
    
    alertContainer.insertAdjacentHTML('afterend', profileHTML);
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function checkWithdrawBalance() {
    const walletAddress = document.getElementById('withdrawWalletAddress').value.trim();
    const statusDiv = document.getElementById('withdrawalStatus');
    const profileInfo = document.getElementById('withdrawalProfileInfo');
    
    if (!walletAddress) {
        statusDiv.innerHTML = '<p style="color: #fef08a;">Please enter your wallet address</p>';
        return;
    }
    
    try {
        const response = await fetch(`/api/arbitrage/profile/${walletAddress}`);
        const data = await response.json();
        
        if (data.success && data.profile) {
            const availableBalance = data.profile.totalProfit + data.profile.totalBonusEarned;
            profileInfo.innerHTML = `
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px;">
                    <div>
                        <div style="font-size: 1.5rem; font-weight: 700;">${data.profile.totalProfit.toFixed(2)}</div>
                        <div style="opacity: 0.8; font-size: 0.85rem;">Arbitrage Profits</div>
                    </div>
                    <div>
                        <div style="font-size: 1.5rem; font-weight: 700;">${data.profile.totalBonusEarned.toFixed(2)}</div>
                        <div style="opacity: 0.8; font-size: 0.85rem;">Bonus Earnings</div>
                    </div>
                </div>
                <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid rgba(255,255,255,0.2);">
                    <div style="font-size: 1.8rem; font-weight: 700;">${availableBalance.toFixed(2)} KENO</div>
                    <div style="opacity: 0.8;">Available for Withdrawal</div>
                </div>
            `;
            document.getElementById('withdrawAmount').max = availableBalance;
            statusDiv.innerHTML = '<p style="color: #a7f3d0;">Balance loaded successfully!</p>';
        } else {
            profileInfo.innerHTML = '<p style="opacity: 0.8;">No trading profile found for this wallet. Complete some FAL trades first!</p>';
            statusDiv.innerHTML = '';
        }
    } catch (error) {
        console.error('Error checking balance:', error);
        statusDiv.innerHTML = '<p style="color: #fef08a;">Error checking balance. Please try again.</p>';
    }
}

async function submitWithdrawalRequest() {
    const walletAddress = document.getElementById('withdrawWalletAddress').value.trim();
    const metaMaskAddress = document.getElementById('withdrawMetaMaskAddress').value.trim();
    const amount = parseFloat(document.getElementById('withdrawAmount').value);
    const statusDiv = document.getElementById('withdrawalStatus');
    
    if (!walletAddress) {
        statusDiv.innerHTML = '<p style="color: #fef08a;">Please enter your simulator wallet address</p>';
        return;
    }
    
    if (!metaMaskAddress || !metaMaskAddress.startsWith('0x') || metaMaskAddress.length !== 42) {
        statusDiv.innerHTML = '<p style="color: #fef08a;">Please enter a valid MetaMask address (starts with 0x, 42 characters)</p>';
        return;
    }
    
    if (!amount || amount <= 0) {
        statusDiv.innerHTML = '<p style="color: #fef08a;">Please enter a valid withdrawal amount</p>';
        return;
    }
    
    try {
        statusDiv.innerHTML = '<p>Submitting withdrawal request...</p>';
        
        const response = await fetch('/api/fal/withdrawal/request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                simulatorWallet: walletAddress,
                metaMaskWallet: metaMaskAddress,
                amount: amount
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            statusDiv.innerHTML = `
                <div style="background: rgba(255,255,255,0.2); padding: 15px; border-radius: 10px; margin-top: 10px;">
                    <p style="font-weight: 700; margin-bottom: 10px;">Withdrawal Request Submitted!</p>
                    <p style="opacity: 0.9;">Request ID: ${data.requestId}</p>
                    <p style="opacity: 0.9;">Amount: ${amount.toFixed(2)} KENO</p>
                    <p style="opacity: 0.9; margin-top: 10px;">An admin will review your request. Once approved, tokens will be sent to your MetaMask wallet.</p>
                </div>
            `;
            document.getElementById('withdrawAmount').value = '';
        } else {
            statusDiv.innerHTML = `<p style="color: #fef08a;">Error: ${data.error}</p>`;
        }
    } catch (error) {
        console.error('Error submitting withdrawal:', error);
        statusDiv.innerHTML = '<p style="color: #fef08a;">Error submitting request. Please try again.</p>';
    }
}

