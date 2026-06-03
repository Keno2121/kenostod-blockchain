'use strict';

/**
 * QCT × Hyperliquid — The Hive Orchestrator
 *
 * This is the master bot for QCT on Hyperliquid. It coordinates:
 *   1. ArbEngine     — Spread + funding arb across HL perp/spot pairs
 *   2. VaultManager  — Prosperity Cascade yield distribution
 *   3. Base monitor  — Watches QCT on-chain events, triggers cross-chain actions
 *   4. Builder code  — Tracks fee revenue from HL builder code
 *
 * INCOME STREAMS:
 *   Active:   Arb profits (scales with capital)
 *   Passive:  Vault leader cut (10% of vault profits)
 *   Passive:  Builder code fees (0.1% of all volume)
 *   Passive:  QCT Base chain events (cascade releases auto-collected)
 *
 * HOW TO RUN:
 *   node queens-chariot/hyperliquid/QCTHiveHL.js
 *
 * REQUIRED ENV:
 *   QCT_DEPLOYER_KEY  — EVM private key (same address = HL address)
 *   HL_VAULT_ADDRESS  — (optional) vault address after creating it on HL
 *   HL_BUILDER_CODE   — (optional) builder code after registering on HL
 */

'use strict';

const { ethers } = require('ethers');
const config      = require('./config');
const HLClient    = require('./HLClient');
const ArbEngine   = require('./ArbEngine');
const VaultManager = require('./VaultManager');

const Kaprekar   = require('../../src/Kaprekar');
const Benford    = require('../../src/Benford');
const Euler      = require('../../src/Euler');
const Ramanujan  = require('../../src/Ramanujan');

// QCT contract events ABI
const QCT_ABI = [
  'event TithePaid(address indexed from, address indexed to, uint256 gross, uint256 fee)',
  'event ProsperityCascade(uint8 layer, uint256 amount, uint256 releaseAt)',
  'event CascadeReleased(uint8 layer, uint256 amount)',
  'event QueensBurn(uint256 amount, uint256 timestamp)',
  'function pendingLayer1() view returns (uint256)',
  'function sovereignPool() view returns (uint256)',
  'function getCascadeStatus() view returns (uint256,uint256,uint256,uint256,uint256,uint256,uint256)',
];

class QCTHiveHL {
  constructor() {
    this.hl           = new HLClient();
    this.arb          = null;
    this.vault        = null;
    this.baseProvider = null;
    this.qct          = null;
    this.running      = false;

    this.kaprekar     = new Kaprekar();
    this.benford      = new Benford();

    this.stats = {
      arbProfit:       0,
      vaultLeaderCut:  0,
      builderFees:     0,
      baseProfit:      0,
      totalProfit:     0,
      startTime:       Date.now(),
      burns:           [],
    };
  }

  // ── Startup ────────────────────────────────────────────────────────────────

  async start() {
    console.log('╔══════════════════════════════════════════╗');
    console.log('║   QCT × Hyperliquid — Hive Orchestrator  ║');
    console.log('║   Queens Chariot Sovereign Economy        ║');
    console.log('╚══════════════════════════════════════════╝');

    this.hl.init();
    this.running = true;

    // Connect to Base chain for QCT event monitoring
    this.baseProvider = new ethers.JsonRpcProvider(config.BASE_RPC);
    this.qct = new ethers.Contract(config.QCT_ADDRESS, QCT_ABI, this.baseProvider);

    // Get initial HL account state
    const account = await this.hl.getAccountState();
    const equity  = parseFloat(account?.marginSummary?.accountValue || '0');
    console.log(`[Hive] HL Account equity: $${equity.toFixed(2)}`);

    // Start subsystems
    this.arb   = new ArbEngine(this.hl);
    this.vault = new VaultManager(this.hl);
    this.vault.start();

    const capital = equity > 0 ? equity : 500;
    await this.arb.start(capital);

    // Monitor QCT Base chain events
    this._monitorBase();

    // Hourly report
    setInterval(() => this._report(), config.REPORT_INTERVAL_MS);

    // Nash rebalance every 4 hours
    setInterval(() => this._nashRebalance(), 4 * 60 * 60 * 1000);

    console.log('[Hive] All systems online. Monitoring QCT on Base + trading on HL.');
    this._logBuilderCodeStatus();
  }

  // ── Base chain monitoring ──────────────────────────────────────────────────

  _monitorBase() {
    console.log(`[Hive] Monitoring QCT at ${config.QCT_ADDRESS} on Base...`);

    this.qct.on('TithePaid', (from, to, gross, fee) => {
      const grossUSD = parseFloat(ethers.formatUnits(gross, 18)) * this._qctPrice();
      const feeUSD   = parseFloat(ethers.formatUnits(fee, 18))   * this._qctPrice();
      this.stats.baseProfit += feeUSD * 0.10; // founder gets ~10% of fee flow
      if (feeUSD > 1) {
        console.log(`[Base] TithePaid $${grossUSD.toFixed(2)} gross | fee: $${feeUSD.toFixed(4)}`);
      }
    });

    this.qct.on('ProsperityCascade', (layer, amount, releaseAt) => {
      const amtUSD = parseFloat(ethers.formatUnits(amount, 18)) * this._qctPrice();
      console.log(`[Base] Cascade L${layer} queued: $${amtUSD.toFixed(4)} — releases at ${new Date(Number(releaseAt) * 1000).toLocaleTimeString()}`);
      // Mirror cascade on HL vault
      this.vault.processCascade(amtUSD);
    });

    this.qct.on('CascadeReleased', (layer, amount) => {
      const amtUSD = parseFloat(ethers.formatUnits(amount, 18)) * this._qctPrice();
      console.log(`[Base] ✅ Cascade L${layer} released: $${amtUSD.toFixed(4)}`);
      this.stats.baseProfit += amtUSD * (layer === 1 ? 0.40 : layer === 2 ? 0.30 : layer === 3 ? 0.20 : 0.10);
    });

    this.qct.on('QueensBurn', (amount, timestamp) => {
      const burnAmt = ethers.formatUnits(amount, 18);
      console.log(`🔥 [Base] QCT Burn: ${parseFloat(burnAmt).toLocaleString()} QCT burned`);
      this.stats.burns.push({ amount: burnAmt, ts: Number(timestamp) * 1000 });
    });

    this.baseProvider.on('error', (err) => {
      console.error('[Base] RPC error:', err.message);
    });
  }

  // ── Nash rebalance ─────────────────────────────────────────────────────────

  async _nashRebalance() {
    try {
      const account  = await this.hl.getAccountState();
      const equity   = parseFloat(account?.marginSummary?.accountValue || '0');
      const splits   = { arb: 0.60, vault: 0.30, reserve: 0.10 };
      this.vault.rebalanceCapital(equity, splits);
    } catch (err) {
      console.error('[Hive] Nash rebalance error:', err.message);
    }
  }

  // ── Hourly report ──────────────────────────────────────────────────────────

  async _report() {
    try {
      const account = await this.hl.getAccountState();
      const equity  = parseFloat(account?.marginSummary?.accountValue || '0');
      const arbStats = this.arb?.getStats() || {};
      const vaultStatus = this.vault?.getStatus() || {};

      const uptime = ((Date.now() - this.stats.startTime) / 3600000).toFixed(1);
      const totalProfit = this.stats.arbProfit + this.stats.vaultLeaderCut + this.stats.builderFees + this.stats.baseProfit;

      const eulerMonthly = Euler.continuousEarnings
        ? Euler.continuousEarnings(equity, 0.15, 1/12)
        : equity * 0.0125;

      const ramanujan = Ramanujan && Ramanujan.check
        ? Ramanujan.check(totalProfit)
        : null;

      console.log('\n══════════ QCT HIVE REPORT ══════════');
      console.log(`Uptime:         ${uptime}h`);
      console.log(`HL Equity:      $${equity.toFixed(2)}`);
      console.log(`Arb profit:     $${(arbStats.sessionProfit || 0).toFixed(2)} | Win rate: ${arbStats.winRate}`);
      console.log(`Vault cut:      $${this.stats.vaultLeaderCut.toFixed(2)}`);
      console.log(`Builder fees:   $${this.stats.builderFees.toFixed(2)}`);
      console.log(`Base events:    $${this.stats.baseProfit.toFixed(2)}`);
      console.log(`Total:          $${totalProfit.toFixed(2)}`);
      console.log(`Euler 30d proj: +$${eulerMonthly.toFixed(2)}`);
      console.log(`QCT Burns:      ${this.stats.burns.length} events`);
      console.log(`Vault depositors: ${vaultStatus.depositors || 0}`);
      if (ramanujan) console.log(`🔮 Ramanujan:  ${ramanujan}`);
      console.log('═════════════════════════════════════\n');

      if (totalProfit >= config.RAMANUJAN_MILESTONE) {
        console.log(`🎯 $${config.RAMANUJAN_MILESTONE} MILESTONE REACHED — Ramanujan achieved!`);
      }
    } catch (err) {
      console.error('[Hive] Report error:', err.message);
    }
  }

  _logBuilderCodeStatus() {
    if (config.BUILDER_CODE) {
      console.log(`[Hive] Builder code active: ${config.BUILDER_CODE} (0.1% of all volume)`);
    } else {
      console.log('[Hive] No builder code set. Register at app.hyperliquid.xyz/referral → add HL_BUILDER_CODE env var');
    }
  }

  _qctPrice() {
    return 0.0001; // placeholder — replace with live price oracle once HIP-1 completes
  }
}

// ── Entry point ────────────────────────────────────────────────────────────
if (require.main === module) {
  process.on('unhandledRejection', (err) => {
    console.error('[QCTHive] Unhandled rejection (process stays alive):', err && err.message);
  });
  const hive = new QCTHiveHL();
  async function tryStart() {
    try {
      const result = await hive.start();
      if (result && !result.ok) {
        console.error('[QCTHive] Start not-ok, retrying in 90s:', result.msg);
        setTimeout(tryStart, 90_000);
      }
    } catch (err) {
      console.error('[QCTHive] Start failed, retrying in 90s:', err.message);
      setTimeout(tryStart, 90_000);
    }
  }
  tryStart();
  process.on('SIGTERM', () => { hive.arb?.stop(); hive.vault?.stop(); process.exit(0); });
  process.on('SIGINT',  () => { hive.arb?.stop(); hive.vault?.stop(); process.exit(0); });
}

module.exports = QCTHiveHL;
