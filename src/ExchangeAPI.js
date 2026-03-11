const crypto = require('crypto');

class ExchangeAPI {
    constructor(blockchain, bankingAPI = null) {
        this.blockchain = blockchain;
        this.bankingAPI = bankingAPI;
        this.orderBook = {
            bids: [], // Buy orders
            asks: []  // Sell orders
        };
        this.trades = [];
        this.tradingPairs = new Map();
        this.marketData = {
            KENO_USD: {
                lastPrice: 0.50,
                high24h: 0.52,
                low24h: 0.48,
                volume24h: 0,
                priceChange24h: 0.02,
                priceChangePercent24h: 4.17
            },
            KENO_BTC: {
                lastPrice: 0.00001,
                high24h: 0.000011,
                low24h: 0.000009,
                volume24h: 0,
                priceChange24h: 0.000001,
                priceChangePercent24h: 11.11
            },
            KENO_ETH: {
                lastPrice: 0.00025,
                high24h: 0.00027,
                low24h: 0.00023,
                volume24h: 0,
                priceChange24h: 0.00002,
                priceChangePercent24h: 8.70
            }
        };
        
        this.initializeTradingPairs();
    }
    
    setBankingAPI(bankingAPI) {
        this.bankingAPI = bankingAPI;
    }

    initializeTradingPairs() {
        this.addTradingPair('KENO', 'USD', 0.001, 1000000);
        this.addTradingPair('KENO', 'BTC', 0.00000001, 10);
        this.addTradingPair('KENO', 'ETH', 0.0000001, 100);
        this.seedOrderBook();
    }
    
    seedOrderBook() {
        const marketMakerAddress = '04' + 'a'.repeat(128);
        
        const buyOrders = [
            { pair: 'KENO_USD', price: 0.50, quantity: 10000 },
            { pair: 'KENO_USD', price: 0.49, quantity: 15000 },
            { pair: 'KENO_USD', price: 0.48, quantity: 20000 },
            { pair: 'KENO_USD', price: 0.47, quantity: 25000 },
            { pair: 'KENO_USD', price: 0.46, quantity: 30000 }
        ];
        
        buyOrders.forEach(orderData => {
            const order = {
                orderId: 'ORD_SEED_' + crypto.randomBytes(8).toString('hex'),
                userAddress: marketMakerAddress,
                pair: orderData.pair,
                side: 'buy',
                orderType: 'limit',
                quantity: orderData.quantity,
                price: orderData.price,
                filledQuantity: 0,
                remainingQuantity: orderData.quantity,
                status: 'open',
                createdAt: Date.now(),
                signature: 'SEED_ORDER'
            };
            this.orderBook.bids.push(order);
        });
        
        this.orderBook.bids.sort((a, b) => b.price - a.price);
        
        console.log(`📊 Exchange initialized with ${buyOrders.length} market maker buy orders`);
    }

    addTradingPair(baseAsset, quoteAsset, minOrderSize, maxOrderSize) {
        const pairSymbol = `${baseAsset}_${quoteAsset}`;
        this.tradingPairs.set(pairSymbol, {
            baseAsset,
            quoteAsset,
            minOrderSize,
            maxOrderSize,
            isActive: true,
            tradingFee: 0.005 // 0.5% trading fee (platform revenue)
        });
    }

    getTradingPairs() {
        return Array.from(this.tradingPairs.entries()).map(([symbol, pair]) => ({
            symbol,
            ...pair
        }));
    }

    getMarketData(pair = 'KENO_USD') {
        return this.marketData[pair] || null;
    }

    getAllMarketData() {
        return this.marketData;
    }

    createOrder(orderDetails) {
        const {
            userAddress,
            pair,
            side, // 'buy' or 'sell'
            orderType, // 'market' or 'limit'
            quantity,
            price,
            signature,
            timestamp
        } = orderDetails;
        
        if (!signature || !timestamp) {
            throw new Error('Order signature and timestamp required');
        }
        
        const CryptoJS = require('crypto-js');
        const EC = require('./secp256k1-compat').ec;
        const ec = new EC('secp256k1');
        
        try {
            const orderData = userAddress + pair + side + orderType + quantity + (price || 0) + timestamp;
            const hash = CryptoJS.SHA256(orderData).toString();
            
            const publicKey = ec.keyFromPublic(userAddress, 'hex');
            const isValid = publicKey.verify(hash, signature);
            
            if (!isValid) {
                throw new Error('Invalid order signature');
            }
        } catch (error) {
            throw new Error('Order signature verification failed: ' + error.message);
        }
        
        if (!this.tradingPairs.has(pair)) {
            throw new Error('Invalid trading pair');
        }
        
        const pairInfo = this.tradingPairs.get(pair);
        
        if (quantity < pairInfo.minOrderSize || quantity > pairInfo.maxOrderSize) {
            throw new Error(`Order size must be between ${pairInfo.minOrderSize} and ${pairInfo.maxOrderSize}`);
        }
        
        if (side === 'buy' && pair.endsWith('_USD') && this.bankingAPI) {
            const userBalance = this.bankingAPI.getFiatBalance(userAddress);
            const oppositeBook = this.orderBook.asks;
            
            if (orderType === 'market' && oppositeBook.length > 0) {
                let estimatedCost = 0;
                let remainingQty = quantity;
                
                for (const ask of oppositeBook) {
                    if (remainingQty <= 0) break;
                    const fillQty = Math.min(remainingQty, ask.remainingQuantity);
                    estimatedCost += fillQty * ask.price;
                    remainingQty -= fillQty;
                }
                
                const fee = estimatedCost * 0.005; // 0.5% trading fee
                const totalRequired = estimatedCost + fee;
                
                if (userBalance < totalRequired) {
                    throw new Error(`Insufficient USD balance. Required: $${totalRequired.toFixed(2)}, Available: $${userBalance.toFixed(2)}`);
                }
            } else if (orderType === 'limit' && price) {
                const estimatedCost = quantity * price;
                const fee = estimatedCost * 0.005; // 0.5% trading fee
                const totalRequired = estimatedCost + fee;
                
                if (userBalance < totalRequired) {
                    throw new Error(`Insufficient USD balance. Required: $${totalRequired.toFixed(2)}, Available: $${userBalance.toFixed(2)}`);
                }
            }
        }
        
        const order = {
            orderId: 'ORD_' + crypto.randomBytes(16).toString('hex'),
            userAddress,
            pair,
            side,
            orderType,
            quantity,
            price: orderType === 'market' ? null : price,
            filledQuantity: 0,
            remainingQuantity: quantity,
            status: 'open',
            createdAt: Date.now(),
            signature
        };
        
        if (orderType === 'limit') {
            if (side === 'buy') {
                this.orderBook.bids.push(order);
                this.orderBook.bids.sort((a, b) => b.price - a.price);
            } else {
                this.orderBook.asks.push(order);
                this.orderBook.asks.sort((a, b) => a.price - b.price);
            }
        } else {
            this.executeMarketOrder(order);
        }
        
        return order;
    }

    executeMarketOrder(order) {
        const oppositeBook = order.side === 'buy' ? this.orderBook.asks : this.orderBook.bids;
        let remainingQty = order.quantity;
        
        while (remainingQty > 0 && oppositeBook.length > 0) {
            const matchOrder = oppositeBook[0];
            const fillQty = Math.min(remainingQty, matchOrder.remainingQuantity);
            
            this.executeTrade({
                buyOrder: order.side === 'buy' ? order : matchOrder,
                sellOrder: order.side === 'sell' ? order : matchOrder,
                quantity: fillQty,
                price: matchOrder.price
            });
            
            remainingQty -= fillQty;
            order.filledQuantity += fillQty;
            matchOrder.filledQuantity += fillQty;
            matchOrder.remainingQuantity -= fillQty;
            
            if (matchOrder.remainingQuantity === 0) {
                matchOrder.status = 'filled';
                oppositeBook.shift();
            }
        }
        
        if (remainingQty === 0) {
            order.status = 'filled';
        } else {
            order.status = 'partially_filled';
        }
        
        order.remainingQuantity = remainingQty;
    }

    executeTrade(tradeDetails) {
        const { buyOrder, sellOrder, quantity, price } = tradeDetails;
        
        const TRADING_FEE_RATE = 0.005; // 0.5% platform trading fee
        
        const trade = {
            tradeId: 'TRD_' + crypto.randomBytes(12).toString('hex'),
            pair: buyOrder.pair,
            buyOrderId: buyOrder.orderId,
            sellOrderId: sellOrder.orderId,
            buyer: buyOrder.userAddress,
            seller: sellOrder.userAddress,
            quantity,
            price,
            total: quantity * price,
            fee: (quantity * price) * TRADING_FEE_RATE,
            timestamp: Date.now()
        };
        
        this.trades.push(trade);
        
        const pair = buyOrder.pair;
        if (this.marketData[pair]) {
            this.marketData[pair].lastPrice = price;
            this.marketData[pair].volume24h += quantity;
        }
        
        if (this.bankingAPI && pair.endsWith('_USD')) {
            const totalUSD = quantity * price;
            const fee = totalUSD * TRADING_FEE_RATE;
            const netUSD = totalUSD - fee;
            
            const currentSellerBalance = this.bankingAPI.fiatBalances.get(sellOrder.userAddress) || 0;
            this.bankingAPI.fiatBalances.set(sellOrder.userAddress, currentSellerBalance + netUSD);
            
            const currentBuyerBalance = this.bankingAPI.fiatBalances.get(buyOrder.userAddress) || 0;
            this.bankingAPI.fiatBalances.set(buyOrder.userAddress, currentBuyerBalance - totalUSD);
            
            this.bankingAPI.saveFiatBalances();
            
            console.log(`💱 Trade executed: ${sellOrder.userAddress.substring(0, 10)}... sold ${quantity} KENO for $${netUSD.toFixed(2)} (fee: $${fee.toFixed(2)})`);
            console.log(`   Seller USD balance: $${currentSellerBalance.toFixed(2)} → $${(currentSellerBalance + netUSD).toFixed(2)}`);
        }
        
        // Record trading fee in revenue tracker
        if (this.revenueTracker) {
            try {
                this.revenueTracker.recordTradingFee({
                    buyerAddress: buyOrder.userAddress,
                    sellerAddress: sellOrder.userAddress,
                    quantity,
                    price,
                    pair
                });
            } catch (error) {
                console.error('Error recording trading fee:', error.message);
            }
        }
        
        return trade;
    }

    cancelOrder(orderId, userAddress) {
        const bidIndex = this.orderBook.bids.findIndex(o => o.orderId === orderId && o.userAddress === userAddress);
        if (bidIndex !== -1) {
            const order = this.orderBook.bids[bidIndex];
            order.status = 'cancelled';
            this.orderBook.bids.splice(bidIndex, 1);
            return order;
        }
        
        const askIndex = this.orderBook.asks.findIndex(o => o.orderId === orderId && o.userAddress === userAddress);
        if (askIndex !== -1) {
            const order = this.orderBook.asks[askIndex];
            order.status = 'cancelled';
            this.orderBook.asks.splice(askIndex, 1);
            return order;
        }
        
        throw new Error('Order not found or unauthorized');
    }

    getOrderBook(pair = 'KENO_USD', depth = 20) {
        const pairOrders = {
            bids: this.orderBook.bids.filter(o => o.pair === pair).slice(0, depth),
            asks: this.orderBook.asks.filter(o => o.pair === pair).slice(0, depth)
        };
        
        const aggregateBids = this.aggregateOrders(pairOrders.bids);
        const aggregateAsks = this.aggregateOrders(pairOrders.asks);
        
        return {
            pair,
            timestamp: Date.now(),
            bids: aggregateBids,
            asks: aggregateAsks
        };
    }

    aggregateOrders(orders) {
        const priceMap = new Map();
        
        orders.forEach(order => {
            const price = order.price;
            if (priceMap.has(price)) {
                priceMap.set(price, priceMap.get(price) + order.remainingQuantity);
            } else {
                priceMap.set(price, order.remainingQuantity);
            }
        });
        
        return Array.from(priceMap.entries()).map(([price, quantity]) => ({
            price,
            quantity
        }));
    }

    getRecentTrades(pair = 'KENO_USD', limit = 50) {
        return this.trades
            .filter(t => t.pair === pair)
            .slice(-limit)
            .reverse();
    }

    getUserOrders(userAddress, status = null) {
        const allOrders = [...this.orderBook.bids, ...this.orderBook.asks];
        let userOrders = allOrders.filter(o => o.userAddress === userAddress);
        
        if (status) {
            userOrders = userOrders.filter(o => o.status === status);
        }
        
        return userOrders;
    }

    getUserTrades(userAddress, limit = 50) {
        return this.trades
            .filter(t => t.buyer === userAddress || t.seller === userAddress)
            .slice(-limit)
            .reverse();
    }

    getTickerData(pair = 'KENO_USD') {
        const marketData = this.marketData[pair];
        if (!marketData) {
            throw new Error('Invalid trading pair');
        }
        
        const recentTrades = this.getRecentTrades(pair, 100);
        const volume = recentTrades.reduce((sum, t) => sum + t.quantity, 0);
        
        return {
            symbol: pair,
            lastPrice: marketData.lastPrice,
            priceChange: marketData.priceChange24h,
            priceChangePercent: marketData.priceChangePercent24h,
            high: marketData.high24h,
            low: marketData.low24h,
            volume: volume,
            timestamp: Date.now()
        };
    }

    updateMarketPrice(pair, newPrice) {
        if (this.marketData[pair]) {
            const oldPrice = this.marketData[pair].lastPrice;
            this.marketData[pair].lastPrice = newPrice;
            this.marketData[pair].priceChange24h = newPrice - oldPrice;
            this.marketData[pair].priceChangePercent24h = ((newPrice - oldPrice) / oldPrice) * 100;
        }
    }

    createDepositAddress(userAddress) {
        return {
            depositAddress: 'DEPOSIT_' + crypto.randomBytes(20).toString('hex'),
            userAddress,
            createdAt: Date.now(),
            memo: crypto.randomBytes(8).toString('hex').toUpperCase()
        };
    }

    processWithdrawal(withdrawalDetails) {
        const {
            userAddress,
            destinationAddress,
            amount,
            asset = 'KENO',
            signature
        } = withdrawalDetails;
        
        const withdrawal = {
            withdrawalId: 'WD_' + crypto.randomBytes(16).toString('hex'),
            userAddress,
            destinationAddress,
            amount,
            asset,
            fee: amount * 0.001,
            netAmount: amount * 0.999,
            status: 'pending',
            createdAt: Date.now(),
            signature,
            txHash: null
        };
        
        return withdrawal;
    }
}

module.exports = ExchangeAPI;
