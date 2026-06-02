'use strict';

/**
 * QCT × Hyperliquid — Configuration
 * All endpoints, constants, and coin references for the Hive on HL.
 */

const config = {

  // ── Hyperliquid API ──────────────────────────────────────────────────────
  HL_INFO_URL:     'https://api.hyperliquid.xyz/info',
  HL_EXCHANGE_URL: 'https://api.hyperliquid.xyz/exchange',
  HL_WS_URL:       'wss://api.hyperliquid.xyz/ws',

  // ── QCT on Base (source chain — monitored for cascade events) ───────────
  QCT_ADDRESS:  '0x137a5Fc22a76Ec42490F2421a81935d124baE714',
  BASE_RPC:     'https://mainnet.base.org',

  // ── Wallet ───────────────────────────────────────────────────────────────
  // Uses QCT_DEPLOYER_KEY — same EVM key works on HL (EVM address = HL address)
  get WALLET_KEY() { return process.env.QCT_DEPLOYER_KEY; },

  // ── HL Coin names (as HL expects them) ───────────────────────────────────
  // Before QCT HIP-1 launches, bot trades correlated pairs to build capital
  COINS: {
    ETH:  'ETH',
    BTC:  'BTC',
    HYPE: 'HYPE',
    SOL:  'SOL',
    QCT:  'QCT',   // set after HIP-1 completes
  },

  // ── Prosperity Cascade — mirrors QCT on-chain splits ────────────────────
  CASCADE: {
    L1_INSTANT:  0.40,   // 40% → distributed to vault depositors immediately
    L2_24H:      0.30,   // 30% → stakers (24h lock tier)
    L3_48H:      0.20,   // 20% → liquidity fortress reinvest
    L4_72H:      0.10,   // 10% → treasury QCT buyback + burn
  },

  // ── Kaprekar profit splits (applied to vault trading profits) ────────────
  KAPREKAR: {
    REINVEST: 0.60,
    POCKET:   0.25,
    BURN:     0.15,
  },

  // ── Vault tiers (Temporal Taxonomy on HL) ────────────────────────────────
  VAULT_TIERS: {
    SQUIRE:   { lockDays: 30,  multiplier: 1.00, label: 'Squire'   },
    KNIGHT:   { lockDays: 90,  multiplier: 1.18, label: 'Knight'   },
    LORD:     { lockDays: 180, multiplier: 1.38, label: 'Lord'     },
    SOVEREIGN:{ lockDays: 365, multiplier: 1.62, label: 'Sovereign' }, // ≈ φ
  },

  // ── Arb engine parameters ────────────────────────────────────────────────
  ARB: {
    MIN_SPREAD_PCT:      0.15,   // minimum spread % to trigger arb
    MAX_POSITION_USD:    500,    // max single position (scales with capital)
    SCAN_INTERVAL_MS:    5000,   // check every 5 seconds
    FUNDING_MIN_RATE:    0.01,   // minimum 8h funding rate to act on (1%)
  },

  // ── Builder code (register at app.hyperliquid.xyz/referral) ─────────────
  BUILDER_CODE: process.env.HL_BUILDER_CODE || '',
  BUILDER_FEE_BPS: 10,   // 0.1% — max allowed by HL

  // ── Nash target ──────────────────────────────────────────────────────────
  MONTHLY_TARGET_USD: 3000,

  // ── Reporting ────────────────────────────────────────────────────────────
  REPORT_INTERVAL_MS:  60 * 60 * 1000,   // hourly P&L report
  RAMANUJAN_MILESTONE: 1729,              // USD milestone for Ramanujan alert
};

module.exports = config;
