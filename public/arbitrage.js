let currentWallet = '';
let activeLoan = null;
let profileData = null;

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
            list.innerHTML = data.opportunities.map(opp => {
                const profitPct = opp.profitPercent || opp.percentageDiff || 0;
                return `
                <div class="opportunity-card">
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
                        <small style="color: #64748b;">
                            💡 Use flash loan to execute this arbitrage instantly!
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
