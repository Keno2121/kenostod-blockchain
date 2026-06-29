// Kenostod Android App Bridge
// This file enables communication between the web app and native Android features

class KenostodAndroidBridge {
    constructor() {
        this.isAndroid = false;
        this.icoPlugin = null;
        this.init();
    }

    async init() {
        if (window.Capacitor && window.Capacitor.isNativePlatform()) {
            this.isAndroid = window.Capacitor.getPlatform() === 'android';
            
            if (this.isAndroid && window.Capacitor.Plugins.ICOPlugin) {
                this.icoPlugin = window.Capacitor.Plugins.ICOPlugin;
                console.log('✅ Android bridge initialized');
                
                const status = await this.icoPlugin.isAndroidApp();
                console.log('Android app status:', status);
                
                this.setupAndroidFeatures();
            }
        }
    }

    setupAndroidFeatures() {
        if (!this.isAndroid) return;

        document.addEventListener('DOMContentLoaded', () => {
            this.addShareButton();
            this.addICOShortcut();
            this.updateUIForAndroid();
        });
    }

    addShareButton() {
        const shareButtons = document.querySelectorAll('[data-android-share]');
        shareButtons.forEach(btn => {
            btn.addEventListener('click', () => this.shareICO());
        });

        const style = document.createElement('style');
        style.textContent = `
            .android-share-btn {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border: none;
                padding: 12px 24px;
                border-radius: 25px;
                font-weight: bold;
                cursor: pointer;
                margin: 10px 0;
                display: inline-block;
            }
        `;
        document.head.appendChild(style);

        const existingShareBtn = document.querySelector('.share-ico-btn');
        if (!existingShareBtn) {
            const shareBtn = document.createElement('button');
            shareBtn.className = 'android-share-btn';
            shareBtn.textContent = '📱 Share KENO ICO';
            shareBtn.onclick = () => this.shareICO();
            
            const revenueTab = document.querySelector('#revenue');
            if (revenueTab) {
                revenueTab.insertBefore(shareBtn, revenueTab.firstChild);
            }
        }
    }

    addICOShortcut() {
        const icoButton = document.createElement('div');
        icoButton.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #667eea;
            color: white;
            padding: 15px 25px;
            border-radius: 50px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.3);
            cursor: pointer;
            z-index: 10000;
            font-weight: bold;
        `;
        icoButton.textContent = '🚀 ICO Presale';
        icoButton.onclick = () => this.openICO();
        document.body.appendChild(icoButton);
    }

    updateUIForAndroid() {
        console.log('📱 Running in Android app - UI optimized');
        
        document.body.classList.add('android-app');
        
        const androidStyle = document.createElement('style');
        androidStyle.textContent = `
            body.android-app {
                -webkit-user-select: none;
                -webkit-tap-highlight-color: transparent;
            }
            
            body.android-app button:active,
            body.android-app .tab:active {
                transform: scale(0.95);
            }
            
            body.android-app input,
            body.android-app textarea {
                font-size: 16px;
            }
        `;
        document.head.appendChild(androidStyle);
    }

    async shareICO(customMessage) {
        if (!this.icoPlugin) {
            console.warn('ICO Plugin not available');
            return;
        }

        try {
            const message = customMessage || 'Join the KENO Token ICO and be part of the blockchain education revolution!';
            await this.icoPlugin.shareICO({
                message: message,
                url: 'https://kenostodblockchain.com'
            });
            console.log('✅ ICO shared successfully');
        } catch (error) {
            console.error('Share failed:', error);
        }
    }

    async openICO() {
        if (!this.icoPlugin) {
            window.location.href = '/presale.html';
            return;
        }

        try {
            await this.icoPlugin.openICO();
        } catch (error) {
            console.error('Failed to open ICO:', error);
            window.location.href = '/presale.html';
        }
    }

    async checkICOStatus() {
        if (!this.icoPlugin) {
            return null;
        }

        try {
            const status = await this.icoPlugin.checkICOStatus();
            return status;
        } catch (error) {
            console.error('Failed to check ICO status:', error);
            return null;
        }
    }

    async getKenoBalance(walletAddress) {
        if (!this.icoPlugin) {
            console.warn('ICO Plugin not available');
            return null;
        }

        try {
            const result = await this.icoPlugin.getKenoBalance({ walletAddress });
            return result;
        } catch (error) {
            console.error('Failed to get KENO balance:', error);
            return null;
        }
    }
}

if (typeof window !== 'undefined') {
    window.KenostodAndroid = new KenostodAndroidBridge();
}

console.log('🔗 Kenostod Android Bridge loaded');
