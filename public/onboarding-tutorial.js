class InteractiveTutorial {
    constructor() {
        this.currentStep = 0;
        this.overlay = null;
        this.modal = null;
        this.verificationInterval = null;
        this.initialBalance = null;
        
        this.steps = [
            {
                title: "Welcome to Kenostod Academy! 🎓",
                message: "Ready to learn blockchain and earn KENO - the world's first Knowledge Utility Token? This interactive tutorial will guide you step-by-step. You'll actually DO each task, not just read about it!",
                instruction: null,
                buttonText: "Let's Begin!",
                requiresAction: false,
                verification: null
            },
            {
                title: "Step 1: Create Your Wallet 👛",
                message: "Every blockchain journey starts with a wallet. Your wallet is like a digital bank account that only YOU control.",
                instruction: "👆 Click the <strong>'Wallet'</strong> tab above, then click <strong>'Create Wallet'</strong> to generate your personal KENO wallet.",
                buttonText: null,
                requiresAction: true,
                actionLabel: "Waiting for you to create a wallet...",
                successLabel: "✅ Wallet Created! Great job!",
                verification: () => {
                    const newWalletDiv = document.getElementById('newWallet');
                    const myAddressInput = document.getElementById('myAddress');
                    const hasNewWallet = newWalletDiv && newWalletDiv.innerHTML && 
                                         newWalletDiv.innerHTML.includes('New Wallet Created');
                    const hasLoadedWallet = myAddressInput && myAddressInput.value && 
                                            myAddressInput.value.length > 10;
                    return hasNewWallet || hasLoadedWallet;
                }
            },
            {
                title: "Your Wallet is Ready! 🔐",
                message: "Excellent! You now have your own KENO wallet with a unique address. This address is like your account number - you can share it to receive KENO.",
                instruction: "⚠️ <strong>Important:</strong> Your Private Key is shown below. In real blockchain, NEVER share this with anyone! It's like the password to your bank account.",
                buttonText: "I Understand - Continue",
                requiresAction: false,
                verification: null
            },
            {
                title: "Step 2: Mine Your First KENO 💎",
                message: "Now let's earn some KENO! Mining is how new cryptocurrency is created. You'll solve a puzzle and earn tokens as a reward.",
                instruction: "👆 Click the <strong>'Mining'</strong> tab above, then click <strong>'Mine Block'</strong> to earn your first 100 KENO tokens!",
                buttonText: null,
                requiresAction: true,
                actionLabel: "Waiting for you to mine a block...",
                successLabel: "✅ Block Mined! You earned 100 KENO!",
                verification: () => {
                    const balance = document.getElementById('balance');
                    if (!balance) return false;
                    const currentBalance = parseFloat(balance.textContent) || 0;
                    if (this.initialBalance === null) {
                        this.initialBalance = currentBalance;
                    }
                    return currentBalance > this.initialBalance;
                }
            },
            {
                title: "You're a Miner Now! ⛏️",
                message: "Congratulations! You just created a new block on the blockchain and earned KENO tokens. This is real blockchain technology - the same concept Bitcoin uses!",
                instruction: "Check your <strong>Wallet</strong> tab to see your new balance. You now have spending money for the next steps!",
                buttonText: "Continue to Transactions",
                requiresAction: false,
                verification: null
            },
            {
                title: "Step 3: Send a Transaction 💸",
                message: "Blockchain's power is sending value anywhere instantly. Let's make your first transaction!",
                instruction: "👆 Click the <strong>'Transactions'</strong> tab above. Enter any wallet address and amount, then click <strong>'Send KENO'</strong>.",
                buttonText: null,
                requiresAction: true,
                actionLabel: "Waiting for you to send a transaction...",
                successLabel: "✅ Transaction Sent! You're a pro!",
                verification: () => {
                    const txResult = document.getElementById('txResult');
                    if (!txResult) return false;
                    return txResult.classList.contains('success') && 
                           txResult.innerHTML.includes('Transaction Created Successfully');
                }
            },
            {
                title: "Step 4: Explore Flash Arbitrage ⚡",
                message: "Here's what makes KENO special - Flash Arbitrage Loans! Borrow up to 10,000 KENO with ZERO collateral, use it for arbitrage trading, and keep the profits.",
                instruction: "👆 Click the <strong>'Arbitrage'</strong> tab to explore the revolutionary FAL™ system that generates passive income.",
                buttonText: null,
                requiresAction: true,
                actionLabel: "Waiting for you to open Arbitrage...",
                successLabel: "✅ Welcome to the Arbitrage Revolution!",
                verification: () => {
                    const arbitrageTab = document.querySelector('.tab-btn.active');
                    return arbitrageTab && arbitrageTab.textContent.toLowerCase().includes('arbitrage');
                }
            },
            {
                title: "Tutorial Complete! 🎉",
                message: "You've mastered the basics of Kenostod Academy! You learned how to: create a wallet, mine KENO, send transactions, and explore Flash Arbitrage.",
                instruction: "<strong>Next Steps:</strong><br>• Complete the 21 courses to earn 5,250 KENO<br>• Join the ICO to get bonus tokens<br>• Use FAL™ to generate passive income<br>• Join our community of blockchain pioneers!",
                buttonText: "🚀 Start My Journey!",
                requiresAction: false,
                verification: null,
                onComplete: () => {
                    localStorage.setItem('kenostod_tutorial_completed', 'true');
                }
            }
        ];
    }

    start() {
        if (localStorage.getItem('kenostod_tutorial_completed')) {
            this.showRestartPrompt();
            return;
        }
        
        this.currentStep = 0;
        this.initialBalance = null;
        this.showStep();
    }

    showRestartPrompt() {
        const promptModal = document.createElement('div');
        promptModal.id = 'tutorialRestartPrompt';
        promptModal.innerHTML = `
            <style>
                .tutorial-prompt-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.7);
                    z-index: 10000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    backdrop-filter: blur(3px);
                    animation: fadeIn 0.3s ease;
                }
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                .tutorial-prompt-box {
                    background: linear-gradient(145deg, #1a1a2e, #16213e);
                    border: 2px solid #667eea;
                    border-radius: 20px;
                    padding: 35px 40px;
                    max-width: 450px;
                    width: 90%;
                    text-align: center;
                    box-shadow: 0 25px 80px rgba(0,0,0,0.5), 0 0 40px rgba(102,126,234,0.2);
                    animation: slideUp 0.4s ease;
                }
                @keyframes slideUp {
                    from { transform: translateY(30px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                .tutorial-prompt-icon {
                    font-size: 3.5em;
                    margin-bottom: 15px;
                }
                .tutorial-prompt-title {
                    color: white;
                    font-size: 1.5em;
                    font-weight: 700;
                    margin-bottom: 12px;
                }
                .tutorial-prompt-message {
                    color: #a0a0a0;
                    font-size: 1em;
                    line-height: 1.6;
                    margin-bottom: 25px;
                }
                .tutorial-prompt-buttons {
                    display: flex;
                    gap: 12px;
                    justify-content: center;
                    flex-wrap: wrap;
                }
                .tutorial-prompt-btn {
                    padding: 12px 25px;
                    border-radius: 10px;
                    font-size: 1em;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    border: none;
                }
                .tutorial-prompt-btn-primary {
                    background: linear-gradient(135deg, #667eea, #764ba2);
                    color: white;
                }
                .tutorial-prompt-btn-primary:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 25px rgba(102,126,234,0.4);
                }
                .tutorial-prompt-btn-secondary {
                    background: transparent;
                    color: #888;
                    border: 1px solid #444;
                }
                .tutorial-prompt-btn-secondary:hover {
                    background: rgba(255,255,255,0.05);
                    color: #aaa;
                }
            </style>
            <div class="tutorial-prompt-overlay">
                <div class="tutorial-prompt-box">
                    <div class="tutorial-prompt-icon">🎓</div>
                    <h2 class="tutorial-prompt-title">Welcome Back!</h2>
                    <p class="tutorial-prompt-message">You've completed the tutorial before. Would you like to go through it again?</p>
                    <div class="tutorial-prompt-buttons">
                        <button class="tutorial-prompt-btn tutorial-prompt-btn-primary" onclick="window._tutorialRestartYes()">Yes, Restart Tutorial</button>
                        <button class="tutorial-prompt-btn tutorial-prompt-btn-secondary" onclick="window._tutorialRestartNo()">No Thanks</button>
                    </div>
                </div>
            </div>
        `;
        
        const self = this;
        window._tutorialRestartYes = function() {
            document.getElementById('tutorialRestartPrompt').remove();
            self.currentStep = 0;
            self.initialBalance = null;
            self.showStep();
        };
        window._tutorialRestartNo = function() {
            document.getElementById('tutorialRestartPrompt').remove();
        };
        
        document.body.appendChild(promptModal);
    }

    createOverlay() {
        this.overlay = document.createElement('div');
        this.overlay.className = 'tutorial-overlay';
        this.overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            z-index: 9998;
            backdrop-filter: blur(2px);
            pointer-events: none;
        `;
        document.body.appendChild(this.overlay);
    }

    createModal(step) {
        this.modal = document.createElement('div');
        this.modal.className = 'tutorial-modal';
        
        const progress = ((this.currentStep + 1) / this.steps.length) * 100;
        const isActionStep = step.requiresAction;

        this.modal.innerHTML = `
            <style>
                @keyframes tutorialSlideIn {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes tutorialPulse {
                    0%, 100% { box-shadow: 0 0 0 0 rgba(102, 126, 234, 0.4); }
                    50% { box-shadow: 0 0 0 10px rgba(102, 126, 234, 0); }
                }
                @keyframes tutorialBounce {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-5px); }
                }
                .tutorial-modal-container {
                    position: fixed;
                    bottom: 20px;
                    left: 50%;
                    transform: translateX(-50%);
                    z-index: 9999;
                    background: linear-gradient(145deg, #1a1a2e, #16213e);
                    border: 2px solid #667eea;
                    border-radius: 20px;
                    padding: 25px 30px;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.5), 0 0 30px rgba(102,126,234,0.2);
                    max-width: 600px;
                    width: 90%;
                    animation: tutorialSlideIn 0.4s ease-out;
                    color: white;
                }
                .tutorial-progress-bar {
                    background: #2d2d44;
                    height: 8px;
                    border-radius: 4px;
                    overflow: hidden;
                    margin-bottom: 15px;
                }
                .tutorial-progress-fill {
                    background: linear-gradient(90deg, #667eea, #764ba2);
                    height: 100%;
                    width: ${progress}%;
                    transition: width 0.5s ease;
                    border-radius: 4px;
                }
                .tutorial-step-counter {
                    color: #a0a0a0;
                    font-size: 0.85em;
                    margin-bottom: 10px;
                }
                .tutorial-title {
                    font-size: 1.5em;
                    font-weight: 700;
                    margin-bottom: 12px;
                    color: #fff;
                }
                .tutorial-message {
                    color: #d0d0d0;
                    line-height: 1.6;
                    margin-bottom: 15px;
                    font-size: 1em;
                }
                .tutorial-instruction {
                    background: rgba(102, 126, 234, 0.15);
                    border-left: 4px solid #667eea;
                    padding: 15px;
                    border-radius: 0 10px 10px 0;
                    margin-bottom: 20px;
                    color: #e0e0e0;
                    animation: tutorialPulse 2s infinite;
                }
                .tutorial-action-status {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 12px 15px;
                    background: ${isActionStep ? 'rgba(255, 193, 7, 0.15)' : 'rgba(76, 175, 80, 0.15)'};
                    border-radius: 10px;
                    margin-bottom: 20px;
                    font-weight: 500;
                }
                .tutorial-action-status.pending {
                    color: #ffc107;
                }
                .tutorial-action-status.complete {
                    background: rgba(76, 175, 80, 0.2);
                    color: #4caf50;
                }
                .tutorial-spinner {
                    width: 20px;
                    height: 20px;
                    border: 3px solid rgba(255, 193, 7, 0.3);
                    border-top-color: #ffc107;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                .tutorial-btn {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    border: none;
                    padding: 14px 28px;
                    border-radius: 10px;
                    font-size: 1em;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                }
                .tutorial-btn:hover:not(:disabled) {
                    transform: translateY(-2px);
                    box-shadow: 0 10px 30px rgba(102,126,234,0.4);
                }
                .tutorial-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                .tutorial-btn-skip {
                    background: transparent;
                    color: #888;
                    border: none;
                    padding: 10px 15px;
                    font-size: 0.9em;
                    cursor: pointer;
                    text-decoration: underline;
                    margin-left: 10px;
                }
                .tutorial-btn-skip:hover {
                    color: #aaa;
                }
                .tutorial-btn-skip-step {
                    background: rgba(255,255,255,0.1);
                    color: #ccc;
                    border: 1px solid #555;
                    padding: 10px 20px;
                    font-size: 0.9em;
                    cursor: pointer;
                    border-radius: 8px;
                    margin-left: 10px;
                }
                .tutorial-btn-skip-step:hover {
                    background: rgba(255,255,255,0.2);
                    color: #fff;
                }
                .tutorial-buttons {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    flex-wrap: wrap;
                }
                .tutorial-checkmark {
                    font-size: 1.2em;
                    animation: tutorialBounce 0.5s ease;
                }
            </style>
            <div class="tutorial-modal-container">
                <div class="tutorial-progress-bar">
                    <div class="tutorial-progress-fill"></div>
                </div>
                <div class="tutorial-step-counter">Step ${this.currentStep + 1} of ${this.steps.length}</div>
                <h2 class="tutorial-title">${step.title}</h2>
                <p class="tutorial-message">${step.message}</p>
                ${step.instruction ? `<div class="tutorial-instruction">${step.instruction}</div>` : ''}
                ${isActionStep ? `
                    <div class="tutorial-action-status pending" id="tutorialActionStatus">
                        <div class="tutorial-spinner"></div>
                        <span id="tutorialStatusText">${step.actionLabel}</span>
                    </div>
                ` : ''}
                <div class="tutorial-buttons">
                    ${step.buttonText ? `
                        <button class="tutorial-btn" id="tutorialNextBtn" ${isActionStep ? 'disabled' : ''}>
                            ${step.buttonText}
                        </button>
                    ` : `
                        <button class="tutorial-btn" id="tutorialNextBtn" disabled>
                            Continue →
                        </button>
                    `}
                    ${isActionStep ? `<button class="tutorial-btn-skip-step" id="tutorialSkipStepBtn">Skip This Step →</button>` : ''}
                    <button class="tutorial-btn-skip" id="tutorialSkipBtn">Exit Tutorial</button>
                </div>
            </div>
        `;

        document.body.appendChild(this.modal);

        const nextBtn = document.getElementById('tutorialNextBtn');
        const skipBtn = document.getElementById('tutorialSkipBtn');
        const skipStepBtn = document.getElementById('tutorialSkipStepBtn');

        if (nextBtn) {
            nextBtn.addEventListener('click', () => this.nextStep());
        }
        if (skipBtn) {
            skipBtn.addEventListener('click', () => this.skip());
        }
        if (skipStepBtn) {
            skipStepBtn.addEventListener('click', () => this.skipStep());
        }

        if (isActionStep && step.verification) {
            this.startVerification(step);
        }
    }

    startVerification(step) {
        if (this.verificationInterval) {
            clearInterval(this.verificationInterval);
        }

        this.verificationInterval = setInterval(() => {
            if (step.verification()) {
                this.onStepComplete(step);
            }
        }, 500);
    }

    onStepComplete(step) {
        if (this.verificationInterval) {
            clearInterval(this.verificationInterval);
            this.verificationInterval = null;
        }

        const statusDiv = document.getElementById('tutorialActionStatus');
        const statusText = document.getElementById('tutorialStatusText');
        const nextBtn = document.getElementById('tutorialNextBtn');

        if (statusDiv) {
            statusDiv.classList.remove('pending');
            statusDiv.classList.add('complete');
            statusDiv.innerHTML = `
                <span class="tutorial-checkmark">✅</span>
                <span>${step.successLabel}</span>
            `;
        }

        if (nextBtn) {
            nextBtn.disabled = false;
            nextBtn.innerHTML = 'Continue →';
        }

        if (step.onComplete) {
            step.onComplete();
        }
    }

    showStep() {
        this.cleanup();
        
        const step = this.steps[this.currentStep];
        
        this.createOverlay();
        this.createModal(step);
    }

    nextStep() {
        if (this.currentStep < this.steps.length - 1) {
            this.currentStep++;
            this.showStep();
        } else {
            this.complete();
        }
    }

    skip() {
        const skipModal = document.createElement('div');
        skipModal.id = 'tutorialSkipPrompt';
        skipModal.innerHTML = `
            <style>
                .skip-prompt-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.8);
                    z-index: 10001;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    backdrop-filter: blur(3px);
                    animation: skipFadeIn 0.2s ease;
                }
                @keyframes skipFadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                .skip-prompt-box {
                    background: linear-gradient(145deg, #1a1a2e, #16213e);
                    border: 2px solid #ff9800;
                    border-radius: 18px;
                    padding: 30px 35px;
                    max-width: 400px;
                    width: 90%;
                    text-align: center;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.5);
                    animation: skipSlideUp 0.3s ease;
                }
                @keyframes skipSlideUp {
                    from { transform: translateY(20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                .skip-prompt-icon { font-size: 2.5em; margin-bottom: 12px; }
                .skip-prompt-title { color: white; font-size: 1.3em; font-weight: 600; margin-bottom: 10px; }
                .skip-prompt-message { color: #a0a0a0; font-size: 0.95em; line-height: 1.5; margin-bottom: 20px; }
                .skip-prompt-buttons { display: flex; gap: 12px; justify-content: center; }
                .skip-btn { padding: 10px 22px; border-radius: 8px; font-size: 0.95em; font-weight: 600; cursor: pointer; transition: all 0.2s; border: none; }
                .skip-btn-confirm { background: #ff9800; color: white; }
                .skip-btn-confirm:hover { background: #f57c00; }
                .skip-btn-cancel { background: transparent; color: #888; border: 1px solid #444; }
                .skip-btn-cancel:hover { background: rgba(255,255,255,0.05); }
            </style>
            <div class="skip-prompt-overlay">
                <div class="skip-prompt-box">
                    <div class="skip-prompt-icon">⚠️</div>
                    <h3 class="skip-prompt-title">Skip Tutorial?</h3>
                    <p class="skip-prompt-message">You can restart the tutorial anytime from the Tutorial link in the menu.</p>
                    <div class="skip-prompt-buttons">
                        <button class="skip-btn skip-btn-confirm" onclick="window._skipConfirm()">Yes, Skip</button>
                        <button class="skip-btn skip-btn-cancel" onclick="window._skipCancel()">Continue Learning</button>
                    </div>
                </div>
            </div>
        `;
        
        const self = this;
        window._skipConfirm = function() {
            document.getElementById('tutorialSkipPrompt').remove();
            self.cleanup();
            localStorage.setItem('kenostod_tutorial_skipped', 'true');
        };
        window._skipCancel = function() {
            document.getElementById('tutorialSkipPrompt').remove();
        };
        
        document.body.appendChild(skipModal);
    }

    skipStep() {
        if (this.verificationInterval) {
            clearInterval(this.verificationInterval);
            this.verificationInterval = null;
        }
        this.nextStep();
    }

    complete() {
        this.cleanup();
        localStorage.setItem('kenostod_tutorial_completed', 'true');
        
        const celebrationModal = document.createElement('div');
        celebrationModal.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: linear-gradient(145deg, #1a1a2e, #16213e);
            border: 2px solid #4caf50;
            padding: 50px;
            border-radius: 25px;
            text-align: center;
            z-index: 10001;
            box-shadow: 0 30px 80px rgba(0,0,0,0.5), 0 0 50px rgba(76, 175, 80, 0.3);
            max-width: 500px;
            color: white;
            animation: celebrationPop 0.5s ease-out;
        `;
        celebrationModal.innerHTML = `
            <style>
                @keyframes celebrationPop {
                    from { transform: translate(-50%, -50%) scale(0.5); opacity: 0; }
                    to { transform: translate(-50%, -50%) scale(1); opacity: 1; }
                }
                @keyframes confetti {
                    0% { transform: translateY(-100%) rotate(0deg); opacity: 1; }
                    100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
                }
            </style>
            <div style="font-size: 5em; margin-bottom: 20px;">🎓</div>
            <h2 style="margin-bottom: 15px; font-size: 1.8em;">Welcome to Kenostod!</h2>
            <p style="color: #a0a0a0; margin-bottom: 30px; line-height: 1.7;">
                You've completed your first lesson! Now you're ready to explore the full platform, complete courses, and start earning real KENO tokens.
            </p>
            <button onclick="this.parentElement.remove()" style="
                background: linear-gradient(135deg, #4caf50, #45a049);
                color: white;
                border: none;
                padding: 16px 35px;
                border-radius: 12px;
                font-size: 1.1em;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
            ">
                🚀 Explore the Platform
            </button>
        `;
        document.body.appendChild(celebrationModal);
        
        setTimeout(() => {
            if (celebrationModal.parentElement) {
                celebrationModal.remove();
            }
        }, 10000);
    }

    cleanup() {
        if (this.verificationInterval) {
            clearInterval(this.verificationInterval);
            this.verificationInterval = null;
        }
        if (this.overlay) {
            this.overlay.remove();
            this.overlay = null;
        }
        if (this.modal) {
            this.modal.remove();
            this.modal = null;
        }
    }
}

const tutorial = new InteractiveTutorial();

document.addEventListener('DOMContentLoaded', () => {
    const isMainPage = window.location.pathname === '/' || 
                       window.location.pathname === '/index.html' ||
                       window.location.pathname.endsWith('/');
    
    if (!localStorage.getItem('kenostod_tutorial_completed') && 
        !localStorage.getItem('kenostod_tutorial_skipped') &&
        isMainPage) {
        
        setTimeout(() => {
            showWelcomePrompt();
        }, 1500);
    }
});

function showWelcomePrompt() {
    const welcomeModal = document.createElement('div');
    welcomeModal.id = 'tutorialWelcomePrompt';
    welcomeModal.innerHTML = `
        <style>
            .welcome-prompt-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.75);
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
                backdrop-filter: blur(4px);
                animation: welcomeFadeIn 0.4s ease;
            }
            @keyframes welcomeFadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            .welcome-prompt-box {
                background: linear-gradient(145deg, #1a1a2e, #16213e);
                border: 2px solid #4CAF50;
                border-radius: 24px;
                padding: 40px 45px;
                max-width: 500px;
                width: 90%;
                text-align: center;
                box-shadow: 0 30px 100px rgba(0,0,0,0.6), 0 0 50px rgba(76,175,80,0.2);
                animation: welcomeSlideUp 0.5s ease;
            }
            @keyframes welcomeSlideUp {
                from { transform: translateY(40px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
            .welcome-prompt-icon {
                font-size: 4em;
                margin-bottom: 15px;
                animation: welcomeBounce 1s ease infinite;
            }
            @keyframes welcomeBounce {
                0%, 100% { transform: translateY(0); }
                50% { transform: translateY(-8px); }
            }
            .welcome-prompt-title {
                color: white;
                font-size: 1.8em;
                font-weight: 700;
                margin-bottom: 15px;
            }
            .welcome-prompt-subtitle {
                color: #4CAF50;
                font-size: 1.1em;
                font-weight: 600;
                margin-bottom: 20px;
            }
            .welcome-prompt-message {
                color: #b0b0b0;
                font-size: 1em;
                line-height: 1.7;
                margin-bottom: 25px;
            }
            .welcome-prompt-features {
                display: flex;
                gap: 15px;
                justify-content: center;
                margin-bottom: 30px;
                flex-wrap: wrap;
            }
            .welcome-feature {
                background: rgba(76,175,80,0.1);
                border: 1px solid rgba(76,175,80,0.3);
                padding: 10px 15px;
                border-radius: 10px;
                color: #4CAF50;
                font-size: 0.9em;
                font-weight: 500;
            }
            .welcome-prompt-buttons {
                display: flex;
                gap: 15px;
                justify-content: center;
                flex-wrap: wrap;
            }
            .welcome-prompt-btn {
                padding: 14px 30px;
                border-radius: 12px;
                font-size: 1.05em;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
                border: none;
            }
            .welcome-prompt-btn-primary {
                background: linear-gradient(135deg, #4CAF50, #45a049);
                color: white;
            }
            .welcome-prompt-btn-primary:hover {
                transform: translateY(-3px);
                box-shadow: 0 10px 30px rgba(76,175,80,0.4);
            }
            .welcome-prompt-btn-secondary {
                background: transparent;
                color: #888;
                border: 1px solid #444;
            }
            .welcome-prompt-btn-secondary:hover {
                background: rgba(255,255,255,0.05);
                color: #aaa;
            }
            .welcome-time {
                color: #666;
                font-size: 0.85em;
                margin-top: 15px;
            }
        </style>
        <div class="welcome-prompt-overlay">
            <div class="welcome-prompt-box">
                <div class="welcome-prompt-icon">🎓</div>
                <h2 class="welcome-prompt-title">Welcome to Kenostod Academy!</h2>
                <p class="welcome-prompt-subtitle">Learn Blockchain by Doing</p>
                <p class="welcome-prompt-message">Ready for an interactive hands-on tutorial? You'll actually create a wallet, mine KENO tokens, and make real transactions!</p>
                <div class="welcome-prompt-features">
                    <span class="welcome-feature">👛 Create Wallet</span>
                    <span class="welcome-feature">⛏️ Mine KENO</span>
                    <span class="welcome-feature">💸 Send Transactions</span>
                </div>
                <div class="welcome-prompt-buttons">
                    <button class="welcome-prompt-btn welcome-prompt-btn-primary" onclick="window._welcomeYes()">Start Tutorial</button>
                    <button class="welcome-prompt-btn welcome-prompt-btn-secondary" onclick="window._welcomeNo()">Skip for Now</button>
                </div>
                <p class="welcome-time">Takes about 3 minutes</p>
            </div>
        </div>
    `;
    
    window._welcomeYes = function() {
        document.getElementById('tutorialWelcomePrompt').remove();
        tutorial.start();
    };
    window._welcomeNo = function() {
        document.getElementById('tutorialWelcomePrompt').remove();
        localStorage.setItem('kenostod_tutorial_skipped', 'true');
    };
    
    document.body.appendChild(welcomeModal);
}

window.restartTutorial = function() {
    localStorage.removeItem('kenostod_tutorial_completed');
    localStorage.removeItem('kenostod_tutorial_skipped');
    tutorial.start();
};
