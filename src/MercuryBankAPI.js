const crypto = require('crypto');

class MercuryBankAPI {
    constructor() {
        this.apiKey = process.env.MERCURY_API_KEY;
        this.accountId = process.env.MERCURY_ACCOUNT_ID;
        this.baseUrl = 'https://api.mercury.com/api/v1';
        this.isConfigured = !!this.apiKey;
        this.accountsFetched = false;
        this.accounts = [];
        
        if (this.apiKey) {
            console.log('✅ Mercury Bank API key configured');
            this.initializeAccounts();
        } else {
            console.log('⚠️ Mercury Bank API not configured - running in stub mode');
        }
    }

    async initializeAccounts() {
        try {
            const response = await fetch(`${this.baseUrl}/accounts`, {
                method: 'GET',
                headers: this.getAuthHeaders()
            });

            if (response.ok) {
                const data = await response.json();
                this.accounts = data.accounts || [];
                if (this.accounts.length > 0) {
                    this.accountId = this.accounts[0].id;
                    console.log(`✅ Mercury account auto-detected: ${this.accounts[0].name} (${this.accountId})`);
                }
                this.accountsFetched = true;
            } else {
                console.log('⚠️ Mercury API: Could not fetch accounts -', response.status);
            }
        } catch (error) {
            console.log('⚠️ Mercury API initialization error:', error.message);
        }
    }

    getAuthHeaders() {
        return {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
        };
    }

    async getAccountBalance() {
        if (!this.isConfigured) {
            return { success: false, error: 'Mercury API not configured', stubMode: true };
        }

        try {
            const response = await fetch(`${this.baseUrl}/accounts/${this.accountId}`, {
                method: 'GET',
                headers: this.getAuthHeaders()
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            return { 
                success: true, 
                balance: data.availableBalance,
                accountName: data.name
            };
        } catch (error) {
            console.error('Mercury API error:', error.message);
            return { success: false, error: error.message };
        }
    }

    async initiateACHTransfer(recipientDetails) {
        const { 
            amount, 
            recipientName, 
            routingNumber, 
            accountNumber, 
            accountType = 'checking',
            memo 
        } = recipientDetails;

        if (!this.isConfigured) {
            console.log('📤 [STUB] Mercury ACH Transfer:', {
                amount,
                recipientName,
                routingNumber: routingNumber.substring(0, 4) + '****',
                accountType,
                memo
            });
            
            return { 
                success: true, 
                stubMode: true,
                transferId: 'STUB-' + Date.now().toString(36).toUpperCase(),
                message: 'Transfer queued (Mercury API not yet configured)',
                estimatedArrival: '1-3 business days after Mercury approval'
            };
        }

        try {
            const response = await fetch(`${this.baseUrl}/accounts/${this.accountId}/transactions`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({
                    recipientName,
                    amount: Math.round(amount * 100),
                    paymentMethod: 'ach',
                    routingNumber,
                    accountNumber,
                    accountType,
                    note: memo || 'Kenostod KENO Token Withdrawal'
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP ${response.status}`);
            }

            const data = await response.json();
            console.log('✅ Mercury ACH transfer initiated:', data.id);
            
            return { 
                success: true, 
                transferId: data.id,
                status: data.status,
                estimatedArrival: data.estimatedDeliveryDate
            };
        } catch (error) {
            console.error('Mercury ACH transfer error:', error.message);
            return { success: false, error: error.message };
        }
    }

    async getTransferStatus(transferId) {
        if (!this.isConfigured) {
            return { 
                success: true, 
                stubMode: true,
                status: 'pending',
                message: 'Mercury API not configured'
            };
        }

        try {
            const response = await fetch(`${this.baseUrl}/transactions/${transferId}`, {
                method: 'GET',
                headers: this.getAuthHeaders()
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            return { 
                success: true, 
                status: data.status,
                amount: data.amount / 100,
                createdAt: data.createdAt
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    encryptAccountNumber(accountNumber) {
        const encryptionKey = process.env.BANK_ENCRYPTION_KEY;
        if (!encryptionKey) {
            throw new Error('BANK_ENCRYPTION_KEY environment variable is required for secure storage');
        }
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-cbc', 
            crypto.createHash('sha256').update(encryptionKey).digest(), 
            iv
        );
        let encrypted = cipher.update(accountNumber, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return iv.toString('hex') + ':' + encrypted;
    }

    decryptAccountNumber(encryptedData) {
        const encryptionKey = process.env.BANK_ENCRYPTION_KEY;
        if (!encryptionKey) {
            throw new Error('BANK_ENCRYPTION_KEY environment variable is required for decryption');
        }
        const [ivHex, encrypted] = encryptedData.split(':');
        const iv = Buffer.from(ivHex, 'hex');
        const decipher = crypto.createDecipheriv('aes-256-cbc',
            crypto.createHash('sha256').update(encryptionKey).digest(),
            iv
        );
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }
}

module.exports = MercuryBankAPI;
