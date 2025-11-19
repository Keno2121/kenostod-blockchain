const https = require('https');

class MultiExchangeAPI {
    constructor() {
        this.cache = {
            binance: {},
            coinbase: {},
            kraken: {},
            kucoin: {},
            lastUpdate: {}
        };
        
        this.cacheExpiry = 60000;
        
        this.symbols = {
            BTC: { binance: 'BTCUSDT', coinbase: 'BTC-USD', kraken: 'XBTUSD', kucoin: 'BTC-USDT' },
            ETH: { binance: 'ETHUSDT', coinbase: 'ETH-USD', kraken: 'ETHUSD', kucoin: 'ETH-USDT' },
            BNB: { binance: 'BNBUSDT', coinbase: 'BNB-USD', kraken: 'BNBUSD', kucoin: 'BNB-USDT' },
            ADA: { binance: 'ADAUSDT', coinbase: 'ADA-USD', kraken: 'ADAUSD', kucoin: 'ADA-USDT' },
            DOGE: { binance: 'DOGEUSDT', coinbase: 'DOGE-USD', kraken: 'XDGUSD', kucoin: 'DOGE-USDT' },
            XRP: { binance: 'XRPUSDT', coinbase: 'XRP-USD', kraken: 'XRPUSD', kucoin: 'XRP-USDT' },
            SOL: { binance: 'SOLUSDT', coinbase: 'SOL-USD', kraken: 'SOLUSD', kucoin: 'SOL-USDT' },
            DOT: { binance: 'DOTUSDT', coinbase: 'DOT-USD', kraken: 'DOTUSD', kucoin: 'DOT-USDT' },
            MATIC: { binance: 'MATICUSDT', coinbase: 'MATIC-USD', kucoin: 'MATIC-USDT' },
            LTC: { binance: 'LTCUSDT', coinbase: 'LTC-USD', kraken: 'LTCUSD', kucoin: 'LTC-USDT' }
        };
    }
    
    httpsGet(url) {
        return new Promise((resolve, reject) => {
            https.get(url, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch (err) {
                        reject(new Error(`Parse error: ${err.message}`));
                    }
                });
            }).on('error', reject);
        });
    }
    
    async fetchBinancePrice(symbol) {
        const pair = this.symbols[symbol]?.binance;
        if (!pair) return null;
        
        try {
            const url = `https://data-api.binance.vision/api/v3/ticker/price?symbol=${pair}`;
            const data = await this.httpsGet(url);
            return parseFloat(data.price);
        } catch (err) {
            console.error(`Binance ${symbol} fetch error:`, err.message);
            return null;
        }
    }
    
    async fetchCoinbasePrice(symbol) {
        const pair = this.symbols[symbol]?.coinbase;
        if (!pair) return null;
        
        try {
            const url = `https://api.coinbase.com/v2/prices/${pair}/spot`;
            const data = await this.httpsGet(url);
            return parseFloat(data.data.amount);
        } catch (err) {
            console.error(`Coinbase ${symbol} fetch error:`, err.message);
            return null;
        }
    }
    
    async fetchKrakenPrice(symbol) {
        const pair = this.symbols[symbol]?.kraken;
        if (!pair) return null;
        
        try {
            const url = `https://api.kraken.com/0/public/Ticker?pair=${pair}`;
            const data = await this.httpsGet(url);
            
            if (data.error && data.error.length > 0) {
                throw new Error(data.error.join(', '));
            }
            
            const resultKey = Object.keys(data.result)[0];
            return parseFloat(data.result[resultKey].c[0]);
        } catch (err) {
            console.error(`Kraken ${symbol} fetch error:`, err.message);
            return null;
        }
    }
    
    async fetchKuCoinPrice(symbol) {
        const pair = this.symbols[symbol]?.kucoin;
        if (!pair) return null;
        
        try {
            const url = `https://api.kucoin.com/api/v1/market/orderbook/level1?symbol=${pair}`;
            const data = await this.httpsGet(url);
            
            if (data.code === '200000' && data.data) {
                return parseFloat(data.data.price);
            }
            return null;
        } catch (err) {
            console.error(`KuCoin ${symbol} fetch error:`, err.message);
            return null;
        }
    }
    
    async fetchAllExchangePrices(symbol) {
        const now = Date.now();
        
        if (this.cache.lastUpdate[symbol] && (now - this.cache.lastUpdate[symbol]) < this.cacheExpiry) {
            return {
                symbol,
                binance: this.cache.binance[symbol],
                coinbase: this.cache.coinbase[symbol],
                kraken: this.cache.kraken[symbol],
                kucoin: this.cache.kucoin[symbol],
                cached: true
            };
        }
        
        const [binancePrice, coinbasePrice, krakenPrice, kucoinPrice] = await Promise.all([
            this.fetchBinancePrice(symbol),
            this.fetchCoinbasePrice(symbol),
            this.fetchKrakenPrice(symbol),
            this.fetchKuCoinPrice(symbol)
        ]);
        
        this.cache.binance[symbol] = binancePrice;
        this.cache.coinbase[symbol] = coinbasePrice;
        this.cache.kraken[symbol] = krakenPrice;
        this.cache.kucoin[symbol] = kucoinPrice;
        this.cache.lastUpdate[symbol] = now;
        
        return {
            symbol,
            binance: binancePrice,
            coinbase: coinbasePrice,
            kraken: krakenPrice,
            kucoin: kucoinPrice,
            cached: false
        };
    }
    
    async fetchAllCryptoPrices() {
        const symbols = Object.keys(this.symbols);
        const results = await Promise.all(
            symbols.map(symbol => this.fetchAllExchangePrices(symbol))
        );
        
        const priceData = {};
        results.forEach(result => {
            priceData[result.symbol] = {
                binance: result.binance,
                coinbase: result.coinbase,
                kraken: result.kraken,
                kucoin: result.kucoin
            };
        });
        
        return priceData;
    }
    
    calculateAveragePrice(symbol, exchangePrices) {
        if (!exchangePrices) return null;
        
        const prices = [
            exchangePrices.binance,
            exchangePrices.coinbase,
            exchangePrices.kraken,
            exchangePrices.kucoin
        ].filter(p => p !== null);
        
        if (prices.length === 0) return null;
        
        return prices.reduce((sum, price) => sum + price, 0) / prices.length;
    }
}

module.exports = MultiExchangeAPI;
