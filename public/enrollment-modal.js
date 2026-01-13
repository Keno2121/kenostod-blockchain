(function() {
    'use strict';
    
    const ENROLLMENT_KEY = 'kenostod_enrolled_student';
    
    window.EnrollmentModal = {
        isOpen: false,
        onEnrollCallback: null,
        
        getEnrolledStudent: function() {
            try {
                const stored = localStorage.getItem(ENROLLMENT_KEY);
                if (stored) {
                    return JSON.parse(stored);
                }
            } catch (e) {
                console.error('Error reading enrollment data:', e);
            }
            return null;
        },
        
        saveEnrollment: function(student) {
            try {
                localStorage.setItem(ENROLLMENT_KEY, JSON.stringify(student));
            } catch (e) {
                console.error('Error saving enrollment data:', e);
            }
        },
        
        checkEnrollment: async function(walletAddress) {
            try {
                const response = await fetch(`/api/students/check/${walletAddress}`);
                const data = await response.json();
                if (data.success && data.enrolled) {
                    this.saveEnrollment(data.student);
                    return data.student;
                }
            } catch (e) {
                console.error('Error checking enrollment:', e);
            }
            return null;
        },
        
        createModal: function() {
            if (document.getElementById('enrollmentModal')) return;
            
            const modalHTML = `
                <div id="enrollmentModal" class="enrollment-modal-overlay" style="display: none;">
                    <div class="enrollment-modal-content">
                        <div class="enrollment-modal-header">
                            <img src="/logo.png" alt="Kenostod" style="width: 60px; height: 60px; margin-bottom: 10px;">
                            <h2>Welcome to Kenostod Academy!</h2>
                            <p>Please enroll to track your progress and earn KENO rewards</p>
                        </div>
                        <form id="enrollmentForm" class="enrollment-form">
                            <div class="form-group">
                                <label for="enrollName">Full Name *</label>
                                <input type="text" id="enrollName" name="name" required placeholder="Enter your full name" autocomplete="name">
                            </div>
                            <div class="form-group">
                                <label for="enrollEmail">Email Address *</label>
                                <input type="email" id="enrollEmail" name="email" required placeholder="your@email.com" autocomplete="email">
                            </div>
                            <div class="form-group">
                                <label for="enrollWallet">Wallet Address * <small>(BSC/BEP-20)</small></label>
                                <input type="text" id="enrollWallet" name="walletAddress" required placeholder="0x..." pattern="^0x[a-fA-F0-9]{40}$">
                                <small class="wallet-help">Don't have a wallet? <a href="/student-guide-metamask.html" target="_blank">Create one with MetaMask</a></small>
                            </div>
                            <div class="form-group">
                                <label for="enrollCountry">Country (Optional)</label>
                                <input type="text" id="enrollCountry" name="country" placeholder="Your country">
                            </div>
                            <div class="form-group">
                                <label for="enrollReferral">Referral Code (Optional)</label>
                                <input type="text" id="enrollReferral" name="referralCode" placeholder="If you have one">
                            </div>
                            <div id="enrollmentError" class="enrollment-error" style="display: none;"></div>
                            <button type="submit" class="enrollment-submit-btn">
                                <span class="btn-text">Enroll & Start Learning</span>
                                <span class="btn-loading" style="display: none;">Enrolling...</span>
                            </button>
                        </form>
                        <p class="enrollment-footer">
                            By enrolling, you agree to our <a href="/terms-of-service.html" target="_blank">Terms of Service</a> 
                            and <a href="/privacy-policy.html" target="_blank">Privacy Policy</a>
                        </p>
                    </div>
                </div>
                <style>
                    .enrollment-modal-overlay {
                        position: fixed;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        background: rgba(0,0,0,0.85);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        z-index: 10000;
                        padding: 20px;
                    }
                    .enrollment-modal-content {
                        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                        border-radius: 20px;
                        padding: 40px;
                        max-width: 480px;
                        width: 100%;
                        max-height: 90vh;
                        overflow-y: auto;
                        border: 1px solid rgba(255,255,255,0.1);
                        box-shadow: 0 20px 60px rgba(0,0,0,0.5);
                    }
                    .enrollment-modal-header {
                        text-align: center;
                        margin-bottom: 30px;
                    }
                    .enrollment-modal-header h2 {
                        color: #ffd700;
                        margin: 0 0 10px 0;
                        font-size: 1.5rem;
                    }
                    .enrollment-modal-header p {
                        color: #94a3b8;
                        margin: 0;
                    }
                    .enrollment-form .form-group {
                        margin-bottom: 20px;
                    }
                    .enrollment-form label {
                        display: block;
                        color: #e2e8f0;
                        margin-bottom: 8px;
                        font-weight: 500;
                    }
                    .enrollment-form label small {
                        color: #64748b;
                        font-weight: 400;
                    }
                    .enrollment-form input {
                        width: 100%;
                        padding: 12px 16px;
                        background: rgba(255,255,255,0.05);
                        border: 1px solid rgba(255,255,255,0.2);
                        border-radius: 10px;
                        color: #e2e8f0;
                        font-size: 1rem;
                        font-family: inherit;
                        transition: border-color 0.2s;
                    }
                    .enrollment-form input:focus {
                        outline: none;
                        border-color: #ffd700;
                    }
                    .enrollment-form input::placeholder {
                        color: #64748b;
                    }
                    .wallet-help {
                        display: block;
                        margin-top: 6px;
                        color: #64748b;
                        font-size: 0.85rem;
                    }
                    .wallet-help a {
                        color: #3b82f6;
                        text-decoration: none;
                    }
                    .enrollment-error {
                        background: rgba(239, 68, 68, 0.2);
                        border: 1px solid rgba(239, 68, 68, 0.5);
                        color: #f87171;
                        padding: 12px 16px;
                        border-radius: 8px;
                        margin-bottom: 20px;
                        font-size: 0.9rem;
                    }
                    .enrollment-submit-btn {
                        width: 100%;
                        padding: 14px;
                        background: linear-gradient(135deg, #ffd700 0%, #f59e0b 100%);
                        color: #1a1a2e;
                        border: none;
                        border-radius: 10px;
                        font-size: 1.1rem;
                        font-weight: 700;
                        cursor: pointer;
                        font-family: inherit;
                        transition: transform 0.2s, box-shadow 0.2s;
                    }
                    .enrollment-submit-btn:hover {
                        transform: translateY(-2px);
                        box-shadow: 0 8px 20px rgba(255, 215, 0, 0.3);
                    }
                    .enrollment-submit-btn:disabled {
                        opacity: 0.7;
                        cursor: not-allowed;
                        transform: none;
                    }
                    .enrollment-footer {
                        text-align: center;
                        margin-top: 20px;
                        color: #64748b;
                        font-size: 0.85rem;
                    }
                    .enrollment-footer a {
                        color: #3b82f6;
                        text-decoration: none;
                    }
                    @media (max-width: 600px) {
                        .enrollment-modal-content {
                            padding: 24px;
                        }
                        .enrollment-modal-header h2 {
                            font-size: 1.3rem;
                        }
                    }
                </style>
            `;
            
            document.body.insertAdjacentHTML('beforeend', modalHTML);
            
            const form = document.getElementById('enrollmentForm');
            form.addEventListener('submit', (e) => this.handleSubmit(e));
        },
        
        show: function(callback) {
            this.createModal();
            this.onEnrollCallback = callback;
            document.getElementById('enrollmentModal').style.display = 'flex';
            document.body.style.overflow = 'hidden';
            this.isOpen = true;
            
            // Pre-fill wallet if MetaMask is connected
            if (window.ethereum && window.ethereum.selectedAddress) {
                document.getElementById('enrollWallet').value = window.ethereum.selectedAddress;
            }
        },
        
        hide: function() {
            const modal = document.getElementById('enrollmentModal');
            if (modal) {
                modal.style.display = 'none';
            }
            document.body.style.overflow = '';
            this.isOpen = false;
        },
        
        handleSubmit: async function(e) {
            e.preventDefault();
            
            const form = e.target;
            const submitBtn = form.querySelector('.enrollment-submit-btn');
            const btnText = submitBtn.querySelector('.btn-text');
            const btnLoading = submitBtn.querySelector('.btn-loading');
            const errorDiv = document.getElementById('enrollmentError');
            
            const formData = {
                name: form.name.value.trim(),
                email: form.email.value.trim(),
                walletAddress: form.walletAddress.value.trim(),
                country: form.country.value.trim() || null,
                referralCode: form.referralCode.value.trim() || null
            };
            
            submitBtn.disabled = true;
            btnText.style.display = 'none';
            btnLoading.style.display = 'inline';
            errorDiv.style.display = 'none';
            
            try {
                const response = await fetch('/api/students/enroll', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
                });
                
                const data = await response.json();
                
                if (data.success) {
                    this.saveEnrollment(data.student);
                    this.hide();
                    
                    if (this.onEnrollCallback) {
                        this.onEnrollCallback(data.student);
                    }
                    
                    if (!data.alreadyEnrolled) {
                        this.showWelcomeMessage(data.student.name);
                    }
                } else {
                    errorDiv.textContent = data.error || 'Enrollment failed. Please try again.';
                    errorDiv.style.display = 'block';
                }
            } catch (error) {
                console.error('Enrollment error:', error);
                errorDiv.textContent = 'Connection error. Please check your internet and try again.';
                errorDiv.style.display = 'block';
            } finally {
                submitBtn.disabled = false;
                btnText.style.display = 'inline';
                btnLoading.style.display = 'none';
            }
        },
        
        showWelcomeMessage: function(name) {
            const welcomeHTML = `
                <div id="enrollmentWelcome" style="
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                    color: white;
                    padding: 20px 24px;
                    border-radius: 12px;
                    box-shadow: 0 10px 30px rgba(16, 185, 129, 0.4);
                    z-index: 10001;
                    max-width: 350px;
                    animation: slideIn 0.3s ease;
                ">
                    <div style="font-size: 1.5rem; margin-bottom: 8px;">Welcome, ${name}!</div>
                    <p style="margin: 0; opacity: 0.9;">You're now enrolled at Kenostod Academy. Complete courses to earn KENO rewards!</p>
                </div>
                <style>
                    @keyframes slideIn {
                        from { transform: translateX(100%); opacity: 0; }
                        to { transform: translateX(0); opacity: 1; }
                    }
                </style>
            `;
            
            document.body.insertAdjacentHTML('beforeend', welcomeHTML);
            
            setTimeout(() => {
                const welcome = document.getElementById('enrollmentWelcome');
                if (welcome) {
                    welcome.style.transition = 'opacity 0.3s';
                    welcome.style.opacity = '0';
                    setTimeout(() => welcome.remove(), 300);
                }
            }, 5000);
        },
        
        requireEnrollment: async function(callback) {
            const stored = this.getEnrolledStudent();
            if (stored && stored.walletAddress) {
                const verified = await this.checkEnrollment(stored.walletAddress);
                if (verified) {
                    if (callback) callback(verified);
                    return verified;
                }
            }
            
            this.show(callback);
            return null;
        }
    };
    
    console.log('Enrollment modal loaded');
})();
