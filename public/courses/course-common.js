// Kenostod Academy - Shared Course Functionality
// Wallet Connection & KENO Reward System

(function() {
    // Load enrollment modal script
    if (!document.querySelector('script[src="/enrollment-modal.js"]')) {
        const script = document.createElement('script');
        script.src = '/enrollment-modal.js';
        document.head.appendChild(script);
    }
    
    // Get connected wallet
    function getConnectedWallet() {
        return localStorage.getItem('userWalletAddress') || localStorage.getItem('walletAddress') || null;
    }
    
    // Get enrolled student from localStorage
    function getEnrolledStudent() {
        try {
            const stored = localStorage.getItem('kenostod_enrolled_student');
            if (stored) return JSON.parse(stored);
        } catch (e) {}
        return null;
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
            localStorage.setItem('walletAddress', address);
            localStorage.setItem('userWallet', address);
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
        localStorage.setItem('walletAddress', address);
        localStorage.setItem('userWallet', address);
        closeModal();
        renderWalletStatus();
        showToast('Wallet address saved!', 'success');
    }

    // Disconnect wallet
    function disconnect() {
        localStorage.removeItem('userWalletAddress');
        localStorage.removeItem('walletAddress');
        localStorage.removeItem('userWallet');
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
        const enrolledStudent = getEnrolledStudent();
        
        // Use enrolled student email if available, otherwise from localStorage
        const userEmail = enrolledStudent?.email || localStorage.getItem('userEmail') || '';
        
        if (!walletAddress) {
            console.log('No wallet connected - showing connect prompt');
            showToast('Connect wallet to receive 250 KENO!', 'info');
            setTimeout(() => showWalletConnectModal(), 1500);
            return { success: false, reason: 'no_wallet' };
        }
        
        // Check if student is enrolled - if not, show enrollment modal
        if (!enrolledStudent && window.EnrollmentModal) {
            console.log('Student not enrolled - showing enrollment modal');
            return new Promise((resolve) => {
                window.EnrollmentModal.show(async (student) => {
                    // After enrollment, credit the reward
                    const result = await submitCourseReward(student.walletAddress, student.email, courseName, courseId);
                    resolve(result);
                });
            });
        }
        
        return await submitCourseReward(walletAddress, userEmail, courseName, courseId);
    }
    
    // Submit course reward to API
    async function submitCourseReward(walletAddress, email, courseName, courseId) {
        try {
            const response = await fetch('/api/wealth/rewards/course-complete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    walletAddress: walletAddress,
                    email: email,
                    courseName: courseName,
                    courseId: courseId
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                showRewardSuccessModal(walletAddress, courseName);
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

    // Show reward success modal with clear information
    function showRewardSuccessModal(walletAddress, courseName) {
        const existing = document.getElementById('reward-success-modal');
        if (existing) existing.remove();
        
        const modal = document.createElement('div');
        modal.id = 'reward-success-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10002;
        `;
        
        const shortWallet = walletAddress.slice(0,6) + '...' + walletAddress.slice(-4);
        
        modal.innerHTML = `
            <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 40px; border-radius: 20px; max-width: 420px; width: 90%; text-align: center; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; border: 2px solid #10b981; box-shadow: 0 0 40px rgba(16, 185, 129, 0.3);">
                <div style="font-size: 64px; margin-bottom: 16px;">🎉</div>
                <h2 style="margin: 0 0 8px 0; color: #10b981; font-size: 28px;">Course Complete!</h2>
                <p style="color: #a5b4fc; margin-bottom: 24px; font-size: 16px;">${courseName}</p>
                
                <div style="background: rgba(16, 185, 129, 0.15); border: 2px solid #10b981; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                    <div style="font-size: 42px; font-weight: 700; color: #10b981;">+250 KENO</div>
                    <div style="color: #6ee7b7; margin-top: 8px; font-size: 14px;">Credited to your account</div>
                </div>
                
                <div style="background: rgba(59, 130, 246, 0.15); border: 1px solid #3b82f6; border-radius: 10px; padding: 16px; margin-bottom: 20px; text-align: left;">
                    <div style="color: #93c5fd; font-size: 12px; font-weight: 600; margin-bottom: 8px;">📍 WHERE TO FIND YOUR REWARDS:</div>
                    <div style="color: white; font-size: 14px; margin-bottom: 8px;">
                        <strong>1. Wealth Builder Page</strong> - View all your earned KENO
                    </div>
                    <div style="color: white; font-size: 14px;">
                        <strong>2. MetaMask</strong> - After on-chain delivery (within 24h)
                    </div>
                </div>
                
                <div style="background: rgba(139, 92, 246, 0.15); border: 1px solid #8b5cf6; border-radius: 8px; padding: 12px; margin-bottom: 20px;">
                    <div style="color: #c4b5fd; font-size: 11px;">Connected Wallet</div>
                    <div style="color: #a78bfa; font-size: 13px; font-weight: 600;">${shortWallet}</div>
                </div>
                
                <button onclick="document.getElementById('reward-success-modal').remove()" style="width: 100%; background: linear-gradient(135deg, #10b981, #059669); border: none; color: white; padding: 16px; border-radius: 12px; font-size: 16px; font-weight: 700; cursor: pointer; margin-bottom: 10px;">
                    Continue Learning
                </button>
                <button onclick="window.location.href='/wealth-builder.html'" style="width: 100%; background: transparent; border: 2px solid #8b5cf6; color: #a78bfa; padding: 14px; border-radius: 12px; font-size: 14px; cursor: pointer;">
                    View My Rewards →
                </button>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    // Check course access (subscription OR scholarship)
    async function checkCourseAccess(courseId) {
        if (courseId === 1) return { hasAccess: true, reason: 'free' };
        
        const subscriptionActive = localStorage.getItem('subscriptionActive') === 'true';
        if (subscriptionActive) return { hasAccess: true, reason: 'subscription' };
        
        const scholarshipActive = localStorage.getItem('scholarshipActive') === 'true';
        if (scholarshipActive) return { hasAccess: true, reason: 'scholarship' };
        
        const email = localStorage.getItem('userEmail');
        const wallet = localStorage.getItem('userWalletAddress') || localStorage.getItem('walletAddress');
        
        if (email || wallet) {
            try {
                const param = email ? 'email=' + encodeURIComponent(email) : 'wallet=' + encodeURIComponent(wallet);
                const response = await fetch('/api/wealth/scholarships/check-access?' + param);
                const data = await response.json();
                if (data.hasScholarship) {
                    localStorage.setItem('scholarshipActive', 'true');
                    if (email) localStorage.setItem('userEmail', email);
                    return { hasAccess: true, reason: 'scholarship' };
                }
            } catch (e) { console.log('Scholarship check failed'); }
        }
        return { hasAccess: false, reason: 'none' };
    }

    async function checkScholarshipByEmail(email) {
        if (!email) return false;
        try {
            const response = await fetch('/api/wealth/scholarships/check-access?email=' + encodeURIComponent(email));
            const data = await response.json();
            if (data.hasScholarship) {
                localStorage.setItem('scholarshipActive', 'true');
                localStorage.setItem('userEmail', email);
                return true;
            }
        } catch (e) { console.log('Scholarship check failed'); }
        return false;
    }

    function showPremiumLock() {
        if (document.getElementById('premium-lock-overlay')) return;
        const overlay = document.createElement('div');
        overlay.id = 'premium-lock-overlay';
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.95);display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px;box-sizing:border-box;';
        overlay.innerHTML = `
            <div style="background:linear-gradient(135deg,#1a1a2e,#16213e);border:2px solid #d4af37;border-radius:20px;padding:40px;max-width:500px;text-align:center;width:100%;">
                <div style="font-size:60px;margin-bottom:20px;">🔒</div>
                <h2 style="color:#d4af37;font-size:28px;margin-bottom:15px;">Premium Course</h2>
                <p style="color:#ccc;margin-bottom:25px;line-height:1.6;">This course requires a subscription or approved scholarship.</p>
                
                <div style="background:rgba(59,130,246,0.1);border:1px solid #3b82f6;border-radius:12px;padding:20px;margin-bottom:25px;">
                    <div style="color:#93c5fd;font-size:14px;margin-bottom:12px;font-weight:600;">Already have an approved scholarship?</div>
                    <input type="email" id="scholarship-email-check" placeholder="Enter your email..." style="width:100%;padding:12px;border-radius:8px;border:1px solid #4b5563;background:#1f2937;color:white;font-size:14px;margin-bottom:12px;box-sizing:border-box;">
                    <button onclick="window.kenostodWallet.verifyScholarship()" style="background:linear-gradient(135deg,#8b5cf6,#7c3aed);color:white;padding:12px 24px;border:none;border-radius:8px;font-weight:600;cursor:pointer;width:100%;">Verify Scholarship Access</button>
                    <div id="scholarship-check-result" style="margin-top:10px;font-size:13px;"></div>
                </div>
                
                <div style="display:flex;gap:15px;justify-content:center;flex-wrap:wrap;">
                    <a href="/index.html#courses" style="background:linear-gradient(135deg,#10b981,#059669);color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Subscribe Now</a>
                    <a href="/wealth-builder.html" style="background:linear-gradient(135deg,#3b82f6,#2563eb);color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Apply for Scholarship</a>
                    <a href="/courses/course-1-wallet.html" style="background:rgba(255,255,255,0.1);color:#ccc;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;border:1px solid #555;">Try Course 1 Free</a>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
    }

    async function verifyScholarshipFromLock() {
        const email = document.getElementById('scholarship-email-check')?.value?.trim();
        const resultDiv = document.getElementById('scholarship-check-result');
        if (!email) {
            if (resultDiv) resultDiv.innerHTML = '<span style="color:#ef4444;">Please enter your email address</span>';
            return;
        }
        if (resultDiv) resultDiv.innerHTML = '<span style="color:#fbbf24;">Checking...</span>';
        const hasAccess = await checkScholarshipByEmail(email);
        if (hasAccess) {
            if (resultDiv) resultDiv.innerHTML = '<span style="color:#10b981;">Scholarship verified! Reloading...</span>';
            setTimeout(() => location.reload(), 1000);
        } else {
            if (resultDiv) resultDiv.innerHTML = '<span style="color:#ef4444;">No scholarship found for this email. Apply for one or subscribe.</span>';
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
        toast: showToast,
        checkAccess: checkCourseAccess,
        showLock: showPremiumLock,
        verifyScholarship: verifyScholarshipFromLock
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

    // ========================================
    // COURSE PROGRESS TRACKING SYSTEM
    // ========================================
    
    function initCourseProgress() {
        const courseMatch = window.location.pathname.match(/course-(\d+)/);
        if (!courseMatch) return;
        const courseId = parseInt(courseMatch[1]);
        
        const sections = document.querySelectorAll('.lesson-section, section[id]');
        if (sections.length === 0) return;
        
        const progressKey = `course${courseId}_section_progress`;
        let sectionProgress = {};
        try { sectionProgress = JSON.parse(localStorage.getItem(progressKey) || '{}'); } catch(e) {}
        
        const timeKey = `course${courseId}_time_spent`;
        let totalTimeSpent = parseInt(localStorage.getItem(timeKey) || '0');
        let sectionStartTime = Date.now();
        
        setInterval(() => {
            totalTimeSpent += 1;
            localStorage.setItem(timeKey, totalTimeSpent.toString());
        }, 1000);
        
        const progressBar = document.createElement('div');
        progressBar.id = 'course-progress-bar';
        progressBar.style.cssText = 'position:fixed;bottom:0;left:0;width:100%;z-index:9998;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';
        progressBar.innerHTML = `
            <div style="background:rgba(15,23,42,0.95);border-top:2px solid #3b82f6;padding:8px 20px;display:flex;align-items:center;justify-content:space-between;gap:16px;backdrop-filter:blur(10px);">
                <div style="display:flex;align-items:center;gap:12px;flex:1;">
                    <span style="color:#94a3b8;font-size:12px;font-weight:600;white-space:nowrap;">PROGRESS</span>
                    <div style="flex:1;background:#1e293b;border-radius:10px;height:8px;overflow:hidden;min-width:100px;">
                        <div id="progress-fill" style="height:100%;background:linear-gradient(90deg,#3b82f6,#10b981);border-radius:10px;transition:width 0.5s ease;width:0%;"></div>
                    </div>
                    <span id="progress-pct" style="color:#60a5fa;font-size:12px;font-weight:700;min-width:35px;">0%</span>
                </div>
                <div style="display:flex;align-items:center;gap:8px;">
                    <span style="color:#94a3b8;font-size:11px;">TIME:</span>
                    <span id="time-display" style="color:#fbbf24;font-size:12px;font-weight:700;">0:00</span>
                </div>
                <div id="sections-complete" style="color:#94a3b8;font-size:11px;white-space:nowrap;">0/0 sections</div>
            </div>
        `;
        document.body.appendChild(progressBar);
        document.body.style.paddingBottom = '50px';
        
        const allSections = [];
        sections.forEach(section => {
            if (section.id && section.id !== 'quizResult') {
                allSections.push(section.id);
            }
        });
        
        function updateProgress() {
            const completed = Object.keys(sectionProgress).filter(k => sectionProgress[k]).length;
            const total = allSections.length;
            const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
            
            const fill = document.getElementById('progress-fill');
            const pctEl = document.getElementById('progress-pct');
            const secEl = document.getElementById('sections-complete');
            if (fill) fill.style.width = pct + '%';
            if (pctEl) pctEl.textContent = pct + '%';
            if (secEl) secEl.textContent = completed + '/' + total + ' sections';
        }
        
        function updateTimeDisplay() {
            const el = document.getElementById('time-display');
            if (!el) return;
            const hrs = Math.floor(totalTimeSpent / 3600);
            const mins = Math.floor((totalTimeSpent % 3600) / 60);
            const secs = totalTimeSpent % 60;
            if (hrs > 0) {
                el.textContent = hrs + ':' + String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
            } else {
                el.textContent = mins + ':' + String(secs).padStart(2, '0');
            }
        }
        
        setInterval(updateTimeDisplay, 1000);
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && entry.intersectionRatio > 0.3) {
                    const sectionId = entry.target.id;
                    if (sectionId && allSections.includes(sectionId)) {
                        setTimeout(() => {
                            sectionProgress[sectionId] = true;
                            localStorage.setItem(progressKey, JSON.stringify(sectionProgress));
                            updateProgress();
                        }, 5000);
                    }
                }
            });
        }, { threshold: 0.3 });
        
        sections.forEach(section => {
            if (section.id && allSections.includes(section.id)) {
                observer.observe(section);
            }
        });
        
        updateProgress();
        updateTimeDisplay();
    }
    
    window.kenostodCourse = {
        initProgress: initCourseProgress
    };

    // Initialize on page load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            renderWalletStatus();
            initCourseProgress();
        });
    } else {
        renderWalletStatus();
        initCourseProgress();
    }
})();
