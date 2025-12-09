// Kenostod Academy - Shared Course Functionality
// Wallet Connection & KENO Reward System

(function() {
    // Get connected wallet
    function getConnectedWallet() {
        return localStorage.getItem('userWalletAddress') || localStorage.getItem('walletAddress') || null;
    }

    // Render wallet status widget
    function renderWalletStatus() {
        const existingWidget = document.getElementById('wallet-connection-widget');
        if (existingWidget) existingWidget.remove();
        
        const wallet = getConnectedWallet();
        const widget = document.createElement('div');
        widget.id = 'wallet-connection-widget';
        widget.style.cssText = `
            position: fixed;
            top: 16px;
            right: 16px;
            z-index: 9999;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        `;
        
        if (wallet) {
            widget.innerHTML = `
                <div style="background: linear-gradient(135deg, #d1fae5, #a7f3d0); border: 2px solid #10b981; border-radius: 12px; padding: 12px 20px; display: flex; align-items: center; gap: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
                    <span style="font-size: 20px;">💰</span>
                    <div>
                        <div style="font-size: 11px; color: #059669; font-weight: 600;">WALLET CONNECTED</div>
                        <div style="font-size: 13px; color: #065f46; font-weight: 700;">${wallet.slice(0,6)}...${wallet.slice(-4)}</div>
                    </div>
                    <button onclick="window.kenostodWallet.disconnect()" style="background: #fee2e2; border: 1px solid #ef4444; color: #dc2626; padding: 6px 12px; border-radius: 6px; font-size: 11px; cursor: pointer; font-weight: 600;">Disconnect</button>
                </div>
            `;
        } else {
            widget.innerHTML = `
                <div style="background: linear-gradient(135deg, #fef3c7, #fde68a); border: 2px solid #f59e0b; border-radius: 12px; padding: 12px 20px; display: flex; align-items: center; gap: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
                    <span style="font-size: 20px;">⚠️</span>
                    <div>
                        <div style="font-size: 11px; color: #92400e; font-weight: 600;">NO WALLET CONNECTED</div>
                        <div style="font-size: 12px; color: #b45309;">Connect to earn KENO</div>
                    </div>
                    <button onclick="window.kenostodWallet.showModal()" style="background: linear-gradient(135deg, #10b981, #059669); border: none; color: white; padding: 8px 16px; border-radius: 6px; font-size: 12px; cursor: pointer; font-weight: 700;">Connect Wallet</button>
                </div>
            `;
        }
        
        document.body.appendChild(widget);
    }

    // Show wallet connect modal
    function showWalletConnectModal() {
        const existing = document.getElementById('wallet-connect-modal');
        if (existing) existing.remove();
        
        const modal = document.createElement('div');
        modal.id = 'wallet-connect-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;
        
        const hasMetaMask = typeof window.ethereum !== 'undefined';
        
        modal.innerHTML = `
            <div style="background: white; padding: 40px; border-radius: 16px; max-width: 450px; width: 90%; text-align: center; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                <div style="font-size: 48px; margin-bottom: 16px;">💼</div>
                <h2 style="margin: 0 0 8px 0; color: #1f2937; font-size: 24px;">Connect Your Wallet</h2>
                <p style="color: #6b7280; margin-bottom: 24px; font-size: 14px;">Connect to receive 250 KENO tokens for each course you complete!</p>
                
                ${hasMetaMask ? `
                    <button onclick="window.kenostodWallet.connectMetaMask()" style="width: 100%; background: linear-gradient(135deg, #f97316, #ea580c); border: none; color: white; padding: 16px; border-radius: 12px; font-size: 16px; font-weight: 700; cursor: pointer; margin-bottom: 12px; display: flex; align-items: center; justify-content: center; gap: 12px;">
                        🦊 Connect MetaMask
                    </button>
                ` : ''}
                
                <div style="color: #9ca3af; font-size: 12px; margin: 16px 0;">OR</div>
                
                <div style="text-align: left; margin-bottom: 16px;">
                    <label style="font-size: 13px; color: #374151; font-weight: 600;">Enter Wallet Address</label>
                    <input type="text" id="manual-wallet-input" placeholder="0x..." style="width: 100%; padding: 14px; border: 2px solid #e5e7eb; border-radius: 10px; font-size: 14px; margin-top: 8px; box-sizing: border-box;">
                </div>
                
                <button onclick="window.kenostodWallet.connectManual()" style="width: 100%; background: linear-gradient(135deg, #10b981, #059669); border: none; color: white; padding: 14px; border-radius: 10px; font-size: 15px; font-weight: 700; cursor: pointer; margin-bottom: 12px;">
                    Save Wallet Address
                </button>
                
                <button onclick="window.kenostodWallet.closeModal()" style="width: 100%; background: #f3f4f6; border: none; color: #6b7280; padding: 12px; border-radius: 10px; font-size: 14px; cursor: pointer;">
                    Cancel
                </button>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    // Connect via MetaMask
    async function connectMetaMask() {
        try {
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            const address = accounts[0];
            localStorage.setItem('userWalletAddress', address);
            closeModal();
            renderWalletStatus();
            showToast('Wallet connected successfully!', 'success');
        } catch (error) {
            console.error('MetaMask connection failed:', error);
            showToast('Connection failed. Please try again.', 'error');
        }
    }

    // Connect manually
    function connectManual() {
        const input = document.getElementById('manual-wallet-input');
        const address = input.value.trim();
        
        if (!address) {
            showToast('Please enter a wallet address', 'error');
            return;
        }
        
        if (!address.startsWith('0x') || address.length !== 42) {
            showToast('Please enter a valid wallet address (0x...)', 'error');
            return;
        }
        
        localStorage.setItem('userWalletAddress', address);
        closeModal();
        renderWalletStatus();
        showToast('Wallet address saved!', 'success');
    }

    // Disconnect wallet
    function disconnect() {
        localStorage.removeItem('userWalletAddress');
        localStorage.removeItem('walletAddress');
        renderWalletStatus();
        showToast('Wallet disconnected', 'info');
    }

    // Close modal
    function closeModal() {
        const modal = document.getElementById('wallet-connect-modal');
        if (modal) modal.remove();
    }

    // Show toast notification
    function showToast(message, type) {
        const existing = document.querySelectorAll('.kenostod-toast');
        existing.forEach(t => t.remove());
        
        const toast = document.createElement('div');
        toast.className = 'kenostod-toast';
        const colors = {
            success: { bg: '#d1fae5', border: '#10b981', text: '#065f46' },
            error: { bg: '#fee2e2', border: '#ef4444', text: '#991b1b' },
            info: { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' }
        };
        const c = colors[type] || colors.info;
        
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: ${c.bg};
            border: 2px solid ${c.border};
            color: ${c.text};
            padding: 14px 28px;
            border-radius: 10px;
            font-weight: 600;
            z-index: 10001;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        `;
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => toast.remove(), 3000);
    }

    // Credit KENO reward for course completion
    async function creditCourseReward(courseId, courseName) {
        const walletAddress = getConnectedWallet();
        const userEmail = localStorage.getItem('userEmail') || '';
        
        if (!walletAddress) {
            console.log('No wallet connected - showing connect prompt');
            showToast('Connect wallet to receive 250 KENO!', 'info');
            setTimeout(() => showWalletConnectModal(), 1500);
            return { success: false, reason: 'no_wallet' };
        }
        
        try {
            const response = await fetch('/api/wealth/rewards/course-complete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    walletAddress: walletAddress,
                    email: userEmail,
                    courseName: courseName,
                    courseId: courseId
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                showToast('🎉 250 KENO credited to your wallet!', 'success');
                return { success: true };
            } else {
                console.warn('Reward not credited:', result.error);
                if (result.error && result.error.includes('already')) {
                    showToast('Course already completed!', 'info');
                }
                return { success: false, reason: result.error };
            }
        } catch (error) {
            console.error('Error crediting KENO reward:', error);
            return { success: false, reason: error.message };
        }
    }

    // Expose global API
    window.kenostodWallet = {
        getWallet: getConnectedWallet,
        render: renderWalletStatus,
        showModal: showWalletConnectModal,
        closeModal: closeModal,
        connectMetaMask: connectMetaMask,
        connectManual: connectManual,
        disconnect: disconnect,
        creditReward: creditCourseReward,
        toast: showToast
    };

    // Course name mapping
    const courseNames = {
        1: 'Course 1: Wallet Management & Cryptography',
        2: 'Course 2: Transactions & Digital Signatures',
        3: 'Course 3: Transaction Reversal',
        4: 'Course 4: Scheduled Transactions',
        5: 'Course 5: Social Recovery',
        6: 'Course 6: Encrypted Messages',
        7: 'Course 7: Reputation System',
        8: 'Course 8: Governance',
        9: 'Course 9: Proof of Work',
        10: 'Course 10: Proof of Residual Value',
        11: 'Course 11: RVT Portfolio Management',
        12: 'Course 12: Enterprise Integration',
        13: 'Course 13: Royalties System',
        14: 'Course 14: Merchant Gateway',
        15: 'Course 15: Banking System',
        16: 'Course 16: Exchange Platform',
        17: 'Course 17: Financial Literacy',
        18: 'Course 18: Investment Strategies',
        19: 'Course 19: Wealth Building',
        20: 'Course 20: Generational Wealth',
        21: 'Course 21: Economic Empowerment'
    };

    // Monitor localStorage for course completions
    const originalSetItem = localStorage.setItem;
    localStorage.setItem = function(key, value) {
        originalSetItem.apply(this, arguments);
        
        // Check if this is a course completion
        const match = key.match(/^course(\d+)_completed$/);
        if (match && value === 'true') {
            const courseId = parseInt(match[1]);
            const courseName = courseNames[courseId] || `Course ${courseId}`;
            
            // Check if we haven't already credited this course in this session
            const creditedKey = `course${courseId}_keno_credited`;
            if (!sessionStorage.getItem(creditedKey)) {
                sessionStorage.setItem(creditedKey, 'true');
                creditCourseReward(courseId, courseName);
            }
        }
    };

    // Initialize on page load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', renderWalletStatus);
    } else {
        renderWalletStatus();
    }
})();
