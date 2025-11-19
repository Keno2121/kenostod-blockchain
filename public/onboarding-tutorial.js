class OnboardingTutorial {
    constructor() {
        this.currentStep = 0;
        this.steps = [
            {
                title: "Welcome to Kenostod! 🎉",
                message: "Let's get you started with a quick 3-minute tour. We'll create your wallet, make your first transaction, and explore the revolutionary Arbitrage Revolution system!",
                target: null,
                position: "center",
                action: null
            },
            {
                title: "Step 1: Create Your Wallet 👛",
                message: "First, let's create your KENO wallet. This is where you'll store your cryptocurrency. Click the 'Create Wallet' button to get started!",
                target: ".tab-btn",
                position: "bottom",
                action: () => {
                    document.querySelector('.tab-btn').click();
                }
            },
            {
                title: "Your Wallet is Ready! ✅",
                message: "Great! Your wallet has been created. You now have a unique address and private key. The private key is super important - it's like your password. Keep it safe!",
                target: "#walletAddress",
                position: "bottom",
                action: null
            },
            {
                title: "Step 2: Get Some Free KENO 🎁",
                message: "Let's get you some KENO tokens to start trading! Click the 'Mine Block' button to earn 100 KENO tokens instantly.",
                target: ".tab-btn:nth-child(5)",
                position: "bottom",
                action: () => {
                    const miningTab = document.querySelectorAll('.tab-btn')[4];
                    if (miningTab) miningTab.click();
                }
            },
            {
                title: "Congratulations! 💰",
                message: "You've just mined your first block and earned 100 KENO! Check your balance in the Wallet tab. This is real blockchain technology in action!",
                target: "#balance",
                position: "bottom",
                action: null
            },
            {
                title: "Step 3: Explore Arbitrage Revolution ⚡",
                message: "Now for the exciting part! Our revolutionary Arbitrage system lets you borrow up to 10,000 KENO with ZERO fees and earn bonuses on profits. Ready to see it?",
                target: null,
                position: "center",
                action: null
            },
            {
                title: "Tutorial Complete! 🎊",
                message: "You're all set! You can now: Create wallets, Send KENO, Mine blocks, Trade with arbitrage, and Join the ICO. Need help? Our AI assistant is always available in the bottom right corner!",
                target: null,
                position: "center",
                action: () => {
                    localStorage.setItem('kenostod_tutorial_completed', 'true');
                }
            }
        ];
        this.overlay = null;
        this.modal = null;
    }

    start() {
        if (localStorage.getItem('kenostod_tutorial_completed')) {
            const restart = confirm('You've already completed the tutorial. Would you like to see it again?');
            if (!restart) return;
        }
        
        this.currentStep = 0;
        this.showStep();
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
            background: rgba(0, 0, 0, 0.8);
            z-index: 9998;
            backdrop-filter: blur(3px);
        `;
        document.body.appendChild(this.overlay);
    }

    createModal(step) {
        this.modal = document.createElement('div');
        this.modal.className = 'tutorial-modal';
        this.modal.style.cssText = `
            position: fixed;
            z-index: 9999;
            background: white;
            border-radius: 15px;
            padding: 30px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            max-width: 500px;
            width: 90%;
            animation: slideIn 0.3s ease-out;
        `;

        const progress = ((this.currentStep + 1) / this.steps.length) * 100;

        this.modal.innerHTML = `
            <div style="margin-bottom: 20px;">
                <div style="background: #e5e7eb; height: 6px; border-radius: 3px; overflow: hidden;">
                    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); height: 100%; width: ${progress}%; transition: width 0.3s ease;"></div>
                </div>
                <p style="color: #6b7280; margin-top: 10px; font-size: 0.9em;">Step ${this.currentStep + 1} of ${this.steps.length}</p>
            </div>
            <h2 style="color: #111827; margin-bottom: 15px; font-size: 1.8em;">${step.title}</h2>
            <p style="color: #374151; line-height: 1.6; font-size: 1.1em; margin-bottom: 30px;">${step.message}</p>
            <div style="display: flex; gap: 15px; justify-content: flex-end;">
                ${this.currentStep > 0 ? '<button class="tutorial-btn-secondary" onclick="tutorial.previousStep()">← Back</button>' : ''}
                ${this.currentStep < this.steps.length - 1 ? 
                    '<button class="tutorial-btn-primary" onclick="tutorial.nextStep()">Next →</button>' : 
                    '<button class="tutorial-btn-primary" onclick="tutorial.complete()">🎉 Finish</button>'}
                <button class="tutorial-btn-skip" onclick="tutorial.skip()">Skip Tutorial</button>
            </div>
        `;

        if (step.position === 'center') {
            this.modal.style.top = '50%';
            this.modal.style.left = '50%';
            this.modal.style.transform = 'translate(-50%, -50%)';
        }

        document.body.appendChild(this.modal);

        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from { opacity: 0; transform: translate(-50%, -40%); }
                to { opacity: 1; transform: translate(-50%, -50%); }
            }
            .tutorial-btn-primary {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border: none;
                padding: 12px 24px;
                border-radius: 8px;
                font-size: 1em;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
            }
            .tutorial-btn-primary:hover {
                transform: translateY(-2px);
                box-shadow: 0 5px 20px rgba(102,126,234,0.4);
            }
            .tutorial-btn-secondary {
                background: white;
                color: #667eea;
                border: 2px solid #667eea;
                padding: 12px 24px;
                border-radius: 8px;
                font-size: 1em;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
            }
            .tutorial-btn-secondary:hover {
                background: #f3f4f6;
            }
            .tutorial-btn-skip {
                background: transparent;
                color: #6b7280;
                border: none;
                padding: 12px 24px;
                font-size: 0.95em;
                cursor: pointer;
                text-decoration: underline;
            }
        `;
        document.head.appendChild(style);
    }

    highlightElement(selector) {
        const element = document.querySelector(selector);
        if (element) {
            element.style.position = 'relative';
            element.style.zIndex = '10000';
            element.style.boxShadow = '0 0 0 4px #667eea, 0 0 30px rgba(102,126,234,0.6)';
            element.style.borderRadius = '8px';
            element.style.transition = 'all 0.3s ease';
        }
    }

    removeHighlight() {
        document.querySelectorAll('*').forEach(el => {
            if (el.style.zIndex === '10000') {
                el.style.zIndex = '';
                el.style.boxShadow = '';
            }
        });
    }

    showStep() {
        this.cleanup();
        
        const step = this.steps[this.currentStep];
        
        this.createOverlay();
        this.createModal(step);
        
        if (step.target) {
            this.highlightElement(step.target);
        }
        
        if (step.action && this.currentStep > 0) {
            setTimeout(() => {
                if (step.action) step.action();
            }, 500);
        }
    }

    nextStep() {
        if (this.currentStep < this.steps.length - 1) {
            this.currentStep++;
            this.showStep();
        }
    }

    previousStep() {
        if (this.currentStep > 0) {
            this.currentStep--;
            this.showStep();
        }
    }

    skip() {
        if (confirm('Are you sure you want to skip the tutorial? You can restart it anytime from the help menu.')) {
            this.cleanup();
            localStorage.setItem('kenostod_tutorial_skipped', 'true');
        }
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
            background: white;
            padding: 40px;
            border-radius: 20px;
            text-align: center;
            z-index: 10001;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            max-width: 500px;
        `;
        celebrationModal.innerHTML = `
            <div style="font-size: 4em; margin-bottom: 20px;">🎉</div>
            <h2 style="color: #111827; margin-bottom: 15px;">Congratulations!</h2>
            <p style="color: #374151; margin-bottom: 30px; line-height: 1.6;">
                You've completed the Kenostod onboarding! You're now ready to trade, mine, and explore the world's first arbitrage-native cryptocurrency.
            </p>
            <button onclick="this.parentElement.remove()" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; padding: 15px 30px; border-radius: 8px; font-size: 1.1em; font-weight: 600; cursor: pointer;">
                🚀 Start Trading
            </button>
        `;
        document.body.appendChild(celebrationModal);
        
        setTimeout(() => {
            celebrationModal.remove();
        }, 5000);
    }

    cleanup() {
        this.removeHighlight();
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

const tutorial = new OnboardingTutorial();

document.addEventListener('DOMContentLoaded', () => {
    if (!localStorage.getItem('kenostod_tutorial_completed') && 
        !localStorage.getItem('kenostod_tutorial_skipped') &&
        window.location.pathname === '/' || window.location.pathname === '/index.html') {
        
        setTimeout(() => {
            const shouldStart = confirm('Welcome to Kenostod! Would you like a quick 3-minute guided tour?');
            if (shouldStart) {
                tutorial.start();
            } else {
                localStorage.setItem('kenostod_tutorial_skipped', 'true');
            }
        }, 2000);
    }
});
