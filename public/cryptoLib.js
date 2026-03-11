const WALLET_STORAGE_KEY = 'kenostod_wallet_state';

function getWalletState() {
    try {
        const stored = localStorage.getItem(WALLET_STORAGE_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
        
        const urlParams = new URLSearchParams(window.location.search);
        const walletParam = urlParams.get('wallet');
        if (walletParam) {
            return { publicKey: walletParam };
        }
        
        return null;
    } catch (error) {
        console.error('Error getting wallet state:', error);
        return null;
    }
}

function setWalletState(publicKey, privateKey = null) {
    try {
        const state = { publicKey };
        if (privateKey) {
            state.privateKey = privateKey;
        }
        localStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(state));
        return true;
    } catch (error) {
        console.error('Error setting wallet state:', error);
        return false;
    }
}

function clearWalletState() {
    try {
        localStorage.removeItem(WALLET_STORAGE_KEY);
        return true;
    } catch (error) {
        console.error('Error clearing wallet state:', error);
        return false;
    }
}

console.log('✅ Cryptography library loaded successfully');
