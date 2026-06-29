const crypto = require('crypto');

class PaymentGateway {
    constructor(blockchain, merchantAccount, merchantIncentives = null) {
        this.blockchain = blockchain;
        this.merchantAccount = merchantAccount;
        this.merchantIncentives = merchantIncentives;
        this.paymentRequests = new Map();
        this.invoices = [];
    }

    createPaymentRequest(merchantId, purchaseDetails) {
        const merchant = this.merchantAccount.getMerchant(merchantId);
        if (!merchant) {
            throw new Error('Merchant not found');
        }
        
        const {
            amount,
            currency = 'USD',
            description,
            customerEmail,
            orderId,
            metadata = {}
        } = purchaseDetails;
        
        const amountKENO = currency === 'KENO' 
            ? amount 
            : this.merchantAccount.convertUSDtoKENO(amount);
        
        const amountUSD = currency === 'USD' 
            ? amount 
            : this.merchantAccount.convertKENOtoUSD(amount);
        
        const paymentRequestId = 'PAYREQ_' + crypto.randomBytes(16).toString('hex');
        
        const paymentRequest = {
            paymentRequestId,
            merchantId,
            merchantName: merchant.businessName,
            merchantWallet: merchant.walletAddress,
            amountKENO,
            amountUSD,
            originalAmount: amount,
            originalCurrency: currency,
            description,
            customerEmail,
            orderId,
            metadata,
            createdAt: Date.now(),
            expiresAt: Date.now() + (30 * 60 * 1000), // 30 minutes
            status: 'pending',
            paymentUrl: null,
            qrCode: null,
            transactionHash: null
        };
        
        paymentRequest.paymentUrl = this.generatePaymentUrl(paymentRequestId);
        paymentRequest.qrCode = this.generateQRCodeData(paymentRequest);
        
        this.paymentRequests.set(paymentRequestId, paymentRequest);
        return paymentRequest;
    }

    generatePaymentUrl(paymentRequestId) {
        return `https://kenostod.com/pay/${paymentRequestId}`;
    }

    generateQRCodeData(paymentRequest) {
        return {
            protocol: 'kenostod',
            address: paymentRequest.merchantWallet,
            amount: paymentRequest.amountKENO,
            message: paymentRequest.description,
            paymentRequestId: paymentRequest.paymentRequestId,
            qrString: `kenostod:${paymentRequest.merchantWallet}?amount=${paymentRequest.amountKENO}&message=${encodeURIComponent(paymentRequest.description)}&id=${paymentRequest.paymentRequestId}`
        };
    }

    processPayment(paymentRequestId, transaction) {
        const paymentRequest = this.paymentRequests.get(paymentRequestId);
        if (!paymentRequest) {
            throw new Error('Payment request not found');
        }
        
        if (paymentRequest.status !== 'pending') {
            throw new Error('Payment request already processed');
        }
        
        if (Date.now() > paymentRequest.expiresAt) {
            paymentRequest.status = 'expired';
            throw new Error('Payment request expired');
        }
        
        if (!transaction.isValid()) {
            throw new Error('Invalid transaction signature');
        }
        
        if (transaction.toAddress !== paymentRequest.merchantWallet) {
            throw new Error('Payment sent to wrong address');
        }
        
        if (transaction.amount < paymentRequest.amountKENO) {
            throw new Error('Insufficient payment amount');
        }
        
        const txHash = transaction.calculateHash();
        const isInChain = this.blockchain.chain.some(block => 
            block.transactions.some(tx => tx.calculateHash && tx.calculateHash() === txHash)
        );
        
        if (!isInChain) {
            throw new Error('Transaction must be confirmed (mined into a block) before payment can be completed. Please wait for the transaction to be mined.');
        }
        
        paymentRequest.status = 'completed';
        paymentRequest.completedAt = Date.now();
        paymentRequest.transactionHash = txHash;
        paymentRequest.customerWallet = transaction.fromAddress;
        
        const payment = this.merchantAccount.recordPayment(paymentRequest.merchantId, {
            paymentRequestId,
            amountKENO: paymentRequest.amountKENO,
            amountUSD: paymentRequest.amountUSD,
            transactionHash: transaction.hash,
            customerWallet: transaction.fromAddress,
            customerEmail: paymentRequest.customerEmail,
            orderId: paymentRequest.orderId,
            description: paymentRequest.description,
            metadata: paymentRequest.metadata
        });
        
        let cashbackResult = null;
        if (this.merchantIncentives) {
            try {
                cashbackResult = this.merchantIncentives.applyCashback(
                    paymentRequest.merchantId,
                    paymentRequest.amountKENO
                );
                console.log(`💰 Cashback applied: ${cashbackResult.cashback} KENO (${(cashbackResult.cashbackRate * 100).toFixed(1)}%)`);
            } catch (error) {
                console.error('Error applying cashback:', error.message);
            }
        }
        
        return {
            paymentRequest,
            payment,
            transaction,
            cashback: cashbackResult
        };
    }

    getPaymentRequest(paymentRequestId) {
        return this.paymentRequests.get(paymentRequestId);
    }

    getPaymentRequestsByMerchant(merchantId) {
        return Array.from(this.paymentRequests.values())
            .filter(pr => pr.merchantId === merchantId);
    }

    createInvoice(merchantId, invoiceDetails) {
        const merchant = this.merchantAccount.getMerchant(merchantId);
        if (!merchant) {
            throw new Error('Merchant not found');
        }
        
        const {
            items,
            customerName,
            customerEmail,
            billingAddress,
            dueDate,
            notes
        } = invoiceDetails;
        
        const subtotalUSD = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const taxRate = 0.08;
        const taxUSD = subtotalUSD * taxRate;
        const totalUSD = subtotalUSD + taxUSD;
        const totalKENO = this.merchantAccount.convertUSDtoKENO(totalUSD);
        
        const invoice = {
            invoiceId: 'INV_' + crypto.randomBytes(12).toString('hex').toUpperCase(),
            merchantId,
            merchantName: merchant.businessName,
            items,
            customerName,
            customerEmail,
            billingAddress,
            subtotalUSD,
            taxUSD,
            taxRate,
            totalUSD,
            totalKENO,
            createdAt: Date.now(),
            dueDate: dueDate || Date.now() + (30 * 24 * 60 * 60 * 1000),
            status: 'unpaid',
            notes,
            paymentRequestId: null,
            paidAt: null
        };
        
        this.invoices.push(invoice);
        return invoice;
    }

    payInvoice(invoiceId) {
        const invoice = this.invoices.find(inv => inv.invoiceId === invoiceId);
        if (!invoice) {
            throw new Error('Invoice not found');
        }
        
        if (invoice.status !== 'unpaid') {
            throw new Error('Invoice already paid');
        }
        
        const paymentRequest = this.createPaymentRequest(invoice.merchantId, {
            amount: invoice.totalUSD,
            currency: 'USD',
            description: `Payment for Invoice ${invoice.invoiceId}`,
            customerEmail: invoice.customerEmail,
            orderId: invoice.invoiceId,
            metadata: { type: 'invoice', invoiceId: invoice.invoiceId }
        });
        
        invoice.paymentRequestId = paymentRequest.paymentRequestId;
        return { invoice, paymentRequest };
    }

    markInvoicePaid(invoiceId, paymentId) {
        const invoice = this.invoices.find(inv => inv.invoiceId === invoiceId);
        if (!invoice) {
            throw new Error('Invoice not found');
        }
        
        invoice.status = 'paid';
        invoice.paidAt = Date.now();
        invoice.paymentId = paymentId;
        return invoice;
    }

    getInvoice(invoiceId) {
        return this.invoices.find(inv => inv.invoiceId === invoiceId);
    }

    getInvoicesByMerchant(merchantId) {
        return this.invoices.filter(inv => inv.merchantId === merchantId);
    }
}

module.exports = PaymentGateway;
