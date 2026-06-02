'use strict';

/**
 * QCT × Hyperliquid — Low-level API Client
 * Handles signed requests to HL exchange + unsigned info queries.
 */

const axios   = require('axios');
const { ethers } = require('ethers');
const config  = require('./config');

class HLClient {
  constructor() {
    this.wallet = null;
    this.address = null;
  }

  init() {
    let key = config.WALLET_KEY;
    if (!key) throw new Error('QCT_DEPLOYER_KEY not set');
    if (!key.startsWith('0x')) key = '0x' + key;
    this.wallet  = new ethers.Wallet(key);
    this.address = this.wallet.address;
    console.log('[HLClient] Wallet:', this.address);
    return this;
  }

  // ── Info (unsigned) ───────────────────────────────────────────────────────

  async getAccountState() {
    return this._info({ type: 'clearinghouseState', user: this.address });
  }

  async getAllMids() {
    return this._info({ type: 'allMids' });
  }

  async getMeta() {
    return this._info({ type: 'meta' });
  }

  async getSpotMeta() {
    return this._info({ type: 'spotMeta' });
  }

  async getSpotBalances() {
    return this._info({ type: 'spotClearinghouseState', user: this.address });
  }

  async getOrderBook(coin) {
    return this._info({ type: 'l2Book', coin });
  }

  async getFundingHistory(coin, startTime) {
    return this._info({ type: 'fundingHistory', coin, startTime });
  }

  async getOpenOrders() {
    return this._info({ type: 'openOrders', user: this.address });
  }

  async getVaultDetails(vaultAddress) {
    return this._info({ type: 'vaultDetails', user: this.address, vaultAddress });
  }

  async _info(payload) {
    const res = await axios.post(config.HL_INFO_URL, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000,
    });
    return res.data;
  }

  // ── Exchange (signed) ─────────────────────────────────────────────────────

  async placeOrder({ coin, isBuy, sz, limitPx, orderType = 'Limit', reduceOnly = false, cloid = null }) {
    const action = {
      type: 'order',
      orders: [{
        a:  this._coinIndex(coin),
        b:  isBuy,
        p:  limitPx.toString(),
        s:  sz.toString(),
        r:  reduceOnly,
        t:  orderType === 'Market'
              ? { market: {} }
              : { limit: { tif: 'Gtc' } },
        ...(cloid ? { c: cloid } : {}),
      }],
      grouping: 'na',
    };
    return this._exchange(action);
  }

  async cancelOrder({ coin, oid }) {
    const action = {
      type: 'cancel',
      cancels: [{ a: this._coinIndex(coin), o: oid }],
    };
    return this._exchange(action);
  }

  async marketOrder({ coin, isBuy, sz }) {
    const book = await this.getOrderBook(coin);
    const side = isBuy ? book.levels[1] : book.levels[0]; // asks/bids
    const topLevel = side[0];
    if (!topLevel) throw new Error(`No ${isBuy ? 'ask' : 'bid'} liquidity for ${coin}`);
    const slippage = isBuy ? 1.003 : 0.997;
    const px = parseFloat(topLevel[0]) * slippage;
    return this.placeOrder({ coin, isBuy, sz, limitPx: px, orderType: 'Market' });
  }

  async _exchange(action) {
    const timestamp = Date.now();
    const nonce = timestamp;

    const phantomAgent = {
      source: 'a',
      connectionId: ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify({ action, nonce }))),
    };

    const signature = await this.wallet.signTypedData(
      {
        chainId: 1337,
        name: 'Exchange',
        verifyingContract: '0x0000000000000000000000000000000000000000',
        version: '1',
      },
      {
        Agent: [
          { name: 'source',       type: 'string'  },
          { name: 'connectionId', type: 'bytes32'  },
        ],
      },
      phantomAgent
    );

    const payload = { action, nonce, signature };
    const res = await axios.post(config.HL_EXCHANGE_URL, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000,
    });
    return res.data;
  }

  _coinIndex(coin) {
    return coin;
  }
}

module.exports = HLClient;
