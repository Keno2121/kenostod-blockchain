import type {
  OnRpcRequestHandler,
  OnTransactionHandler,
  OnInstallHandler,
  OnCronjobHandler,
} from '@metamask/snaps-sdk';
import { panel, text, heading, divider, copyable, row, bold } from '@metamask/snaps-sdk';

// ── UTL Protocol Contract Addresses (BSC Mainnet v1.1 — ACTIVE) ────────────
const CONTRACTS = {
  keno:         '0x65791E0B5Cbac5F40c76cDe31bf4F074D982FD0E',
  staking:      '0x77C3946A9FD5F509584F94e81C43efb25120c837',
  feeCollector: '0xb9489B33Bd9bB835139369b1dD282fB44B2273d8',
  treasury:     '0x54A01A5bf5096c351F166C15143eA9a9Af393C84',
  distribution: '0xdeE5a5456e394DB34F03c770e81eDC9B7F8FE167',
  farm:         '0x37D320A881CcF553F6cd757f0A33743ae01A2644',
  utlHook:      '0xAF810a663995DCe98c5D7EdF5C970446A33bAA74',
};

// ── UTL Protocol API — standalone endpoint, independent of any academy ──────
// This subdomain can be hosted anywhere; it has no dependency on Kenostod Academy.
const UTL_API = 'https://utl.kenostodblockchain.com';

// ── UTL Protocol dApp URL ───────────────────────────────────────────────────
const UTL_DAPP = 'https://utl.kenostodblockchain.com';

// ── Loyalty Tiers (mirrors UTLFeeCollector.js) ─────────────────────────────
const TIERS: Record<string, { min: number; label: string; discount: number; multiplier: string }> = {
  BRONZE:   { min: 0,     label: 'Bronze',   discount: 0,    multiplier: '1.0x' },
  SILVER:   { min: 100,   label: 'Silver',   discount: 0.05, multiplier: '1.2x' },
  GOLD:     { min: 500,   label: 'Gold',     discount: 0.10, multiplier: '1.5x' },
  PLATINUM: { min: 2000,  label: 'Platinum', discount: 0.15, multiplier: '2.0x' },
  DIAMOND:  { min: 10000, label: 'Diamond',  discount: 0.20, multiplier: '3.0x' },
};

// ── MEV Risk Thresholds ────────────────────────────────────────────────────
const MEV_HIGH_RISK_WEI   = BigInt('100000000000000000');   // 0.1 BNB
const MEV_MEDIUM_RISK_WEI = BigInt('10000000000000000');    // 0.01 BNB
const KNOWN_MEV_TARGETS   = ['pancake', 'swap', 'router', 'exchange'];

// ── State Interface ────────────────────────────────────────────────────────
interface UTLSnapState {
  walletAddress:       string;
  isOptedIn:           boolean;
  kenoStaked:          string;
  tier:                string;
  totalTollPaid:       number;
  totalRewardsEarned:  number;
  govWeight:           number;
  transactionCount:    number;
  mevBlocked:          number;
  autoCompound:        boolean;
  falAlertsEnabled:    boolean;
  joinedAt:            string;
  lastSync:            string;
  weeklyStats: {
    txCount:   number;
    feePaid:   number;
    rewards:   number;
    weekStart: string;
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────
async function getState(): Promise<UTLSnapState> {
  const state = await snap.request({ method: 'snap_manageState', params: { operation: 'get' } });
  return (state as UTLSnapState) || defaultState();
}

function defaultState(): UTLSnapState {
  return {
    walletAddress: '', isOptedIn: false, kenoStaked: '0',
    tier: 'BRONZE', totalTollPaid: 0, totalRewardsEarned: 0,
    govWeight: 0, transactionCount: 0, mevBlocked: 0,
    autoCompound: false, falAlertsEnabled: true,
    joinedAt: '', lastSync: '',
    weeklyStats: { txCount: 0, feePaid: 0, rewards: 0, weekStart: new Date().toISOString() },
  };
}

async function saveState(state: UTLSnapState): Promise<void> {
  await snap.request({ method: 'snap_manageState', params: { operation: 'update', newState: state as any } });
}

function computeTier(totalTollPaid: number): string {
  if (totalTollPaid >= 10000) return 'DIAMOND';
  if (totalTollPaid >= 2000)  return 'PLATINUM';
  if (totalTollPaid >= 500)   return 'GOLD';
  if (totalTollPaid >= 100)   return 'SILVER';
  return 'BRONZE';
}

function tierEmoji(tier: string): string {
  const map: Record<string,string> = { BRONZE:'🥉', SILVER:'🥈', GOLD:'🏆', PLATINUM:'💎', DIAMOND:'👑' };
  return map[tier] || '🥉';
}

function formatKeno(amount: number): string {
  if (amount >= 1000000) return `${(amount/1000000).toFixed(2)}M`;
  if (amount >= 1000)    return `${(amount/1000).toFixed(2)}K`;
  return amount.toFixed(4);
}

function mevRisk(valueBigInt: bigint, toAddress: string): 'HIGH' | 'MEDIUM' | 'LOW' {
  const lowerTo = toAddress?.toLowerCase() || '';
  const isSwap  = KNOWN_MEV_TARGETS.some(k => lowerTo.includes(k));
  if (valueBigInt >= MEV_HIGH_RISK_WEI && isSwap) return 'HIGH';
  if (valueBigInt >= MEV_MEDIUM_RISK_WEI || isSwap) return 'MEDIUM';
  return 'LOW';
}

// ── Standalone wallet profile fetch — hits UTL Protocol API only ────────────
// Fails gracefully: if the API is down, all callers fall back to local state.
async function fetchWalletProfile(wallet: string): Promise<any> {
  try {
    const res = await fetch(`${UTL_API}/api/utl/fee/wallet/${wallet}`, { signal: AbortSignal.timeout(5000) });
    if (res.ok) return await res.json();
  } catch (_) {}
  return null;
}

async function fetchStats(): Promise<any> {
  try {
    const res = await fetch(`${UTL_API}/api/utl/fee/stats`, { signal: AbortSignal.timeout(5000) });
    if (res.ok) return await res.json();
  } catch (_) {}
  return null;
}

async function syncWalletProfile(state: UTLSnapState): Promise<UTLSnapState> {
  if (!state.walletAddress) return state;
  const data = await fetchWalletProfile(state.walletAddress);
  if (data?.success && data.profile) {
    state.totalTollPaid     = data.profile.totalTollPaid || state.totalTollPaid;
    state.govWeight         = data.governance?.effectiveWeight || state.govWeight;
    state.tier              = computeTier(state.totalTollPaid);
    state.lastSync          = new Date().toISOString();
  }
  return state;
}

// ═══════════════════════════════════════════════════════════════════════════
// ON INSTALL — Welcome screen
// ═══════════════════════════════════════════════════════════════════════════
export const onInstall: OnInstallHandler = async () => {
  await snap.request({
    method: 'snap_dialog',
    params: {
      type: 'alert',
      content: panel([
        heading('UTL Protocol is now in your wallet'),
        divider(),
        text('Every transaction you make will now show you what hidden fees are being extracted — and how to stop them.'),
        divider(),
        text('**What UTL does for you:**'),
        text('🔍  X-Ray every transaction for MEV risk before you sign'),
        text('💰  Earn 60% of all captured protocol fees as a KENO staker'),
        text('🏆  Build your loyalty tier automatically with every interaction'),
        text('🗳️  Earn governance weight — your voice in how the protocol runs'),
        text('⚡  Get Flash Arbitrage Loan opportunity alerts'),
        divider(),
        text(`**Next step:** Visit ${UTL_DAPP} to connect your wallet and stake KENO.`),
        divider(),
        text('UTL Protocol — Code is Law — 6 live contracts on BSC Mainnet'),
        copyable(CONTRACTS.feeCollector),
      ]),
    },
  });
};

// ═══════════════════════════════════════════════════════════════════════════
// ON TRANSACTION — Fee X-Ray fires before every transaction
// ═══════════════════════════════════════════════════════════════════════════
export const onTransaction: OnTransactionHandler = async ({ transaction }) => {
  const state = await getState();

  const valueBigInt = transaction.value ? BigInt(transaction.value as string) : BigInt(0);
  const valueEth    = Number(valueBigInt) / 1e18;
  const toAddr      = (transaction.to as string) || '';
  const risk        = mevRisk(valueBigInt, toAddr);
  const isRoutedUTL = toAddr.toLowerCase() === CONTRACTS.feeCollector.toLowerCase();

  // Update transaction count and weekly stats
  state.transactionCount += 1;
  state.weeklyStats.txCount += 1;
  if (risk === 'HIGH') state.mevBlocked += 1;
  await saveState(state);

  const riskLabel = risk === 'HIGH'   ? '🔴 HIGH — MEV bots targeting this tx'
                  : risk === 'MEDIUM' ? '🟡 MEDIUM — Slippage exposure detected'
                  : '🟢 LOW — No significant MEV risk';

  const slippageEst = valueEth * (risk === 'HIGH' ? 0.012 : risk === 'MEDIUM' ? 0.006 : 0.002);
  const lpFeeEst    = valueEth * 0.0025;
  const totalLeak   = slippageEst + lpFeeEst;

  const tier = TIERS[state.tier] || TIERS.BRONZE;
  const discount = tier.discount;
  const utlFee   = valueEth * 0.001 * (1 - discount);

  if (!state.isOptedIn) {
    return {
      content: panel([
        heading('🔍 UTL Fee X-Ray'),
        divider(),
        row('MEV Risk', text(riskLabel)),
        row('Est. Slippage Loss', text(`${slippageEst.toFixed(6)} BNB`)),
        row('LP Spread Fee',      text(`${lpFeeEst.toFixed(6)} BNB`)),
        row('Total Leaking Out',  text(`~${totalLeak.toFixed(6)} BNB → anonymous extractors`)),
        divider(),
        text('**UTL Protocol can capture this instead of losing it.**'),
        text(`Stake KENO at ${UTL_DAPP} and earn from every transaction in the network.`),
        divider(),
        text('UTL Protocol · Fee Redistribution Layer · BSC Mainnet'),
      ]),
    };
  }

  return {
    content: panel([
      heading(`${tierEmoji(state.tier)} UTL Fee X-Ray — ${tier.label} Member`),
      divider(),

      heading('Hidden Fee Alert'),
      row('MEV Risk Level',    text(riskLabel)),
      row('Est. Slippage',     text(`${slippageEst.toFixed(6)} BNB leaking to bots`)),
      row('LP Spread',         text(`${lpFeeEst.toFixed(6)} BNB to anonymous LPs`)),
      row('Total Drain',       text(`~${totalLeak.toFixed(6)} BNB leaving ecosystem`)),
      divider(),

      heading('Your UTL Position'),
      row('Routing via UTL',   text(isRoutedUTL ? '✅ FeeCollector — staying in ecosystem' : '↩️ Route through UTL dApp to capture')),
      row('UTL Toll (you pay)', text(`${utlFee.toFixed(6)} BNB at ${tier.multiplier} — ${(discount*100).toFixed(0)}% discount`)),
      row('Your Tier',          text(`${tierEmoji(state.tier)} ${tier.label}`)),
      row('KENO Staked',        text(`${formatKeno(parseFloat(state.kenoStaked))} KENO`)),
      row('Total Rewards',      text(`${formatKeno(state.totalRewardsEarned)} KENO earned`)),
      row('Gov. Weight',        text(`${state.govWeight.toFixed(1)} voting power`)),
      divider(),

      heading('Your Numbers'),
      row('Total Transactions',  text(`${state.transactionCount}`)),
      row('MEV Events Flagged',  text(`${state.mevBlocked}`)),
      row('Total Toll Paid',     text(`${formatKeno(state.totalTollPaid)} KENO → building tier`)),
      divider(),

      text(state.autoCompound
        ? '🔄 Auto-compound: ON — rewards auto-restaked'
        : `📥 Auto-compound: OFF — claim manually at ${UTL_DAPP}`),
      divider(),
      text('_UTL Protocol · Code is Law · BSC Mainnet_'),
    ]),
  };
};

// ═══════════════════════════════════════════════════════════════════════════
// CRONJOB — Weekly report + FAL alerts (runs daily at 9AM UTC)
// ═══════════════════════════════════════════════════════════════════════════
export const onCronjob: OnCronjobHandler = async ({ request }) => {
  if (request.method !== 'dailyCheck') return;

  const state = await getState();
  if (!state.isOptedIn) return;

  // Sync from UTL Protocol API
  const synced = await syncWalletProfile(state);
  await saveState(synced);

  // Weekly report on Sundays
  const today = new Date();
  if (today.getDay() === 0) {
    const weekRewards = synced.weeklyStats.rewards;
    await snap.request({
      method: 'snap_notify',
      params: {
        type: 'inApp',
        message: `📊 UTL Weekly: ${synced.weeklyStats.txCount} txs · ${formatKeno(weekRewards)} KENO earned · Tier: ${tierEmoji(synced.tier)} ${TIERS[synced.tier]?.label}`,
      },
    });

    // Reset weekly stats
    synced.weeklyStats = { txCount: 0, feePaid: 0, rewards: 0, weekStart: today.toISOString() };
    await saveState(synced);
  }

  // FAL alert check — hits UTL Protocol API, not any academy endpoint
  if (synced.falAlertsEnabled) {
    try {
      const res = await fetch(`${UTL_API}/api/arbitrage/opportunities`, { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        const opps = await res.json();
        const top  = Array.isArray(opps) ? opps[0] : opps?.opportunities?.[0];
        if (top && top.profitPercent > 0.5) {
          await snap.request({
            method: 'snap_notify',
            params: {
              type: 'inApp',
              message: `⚡ FAL™ Alert: ${top.profitPercent?.toFixed(2)}% arbitrage opportunity on ${top.pair || 'KENO'} — visit ${UTL_DAPP}/fal`,
            },
          });
        }
      }
    } catch (_) {}
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// RPC HANDLERS — All user-triggered commands
// ═══════════════════════════════════════════════════════════════════════════
export const onRpcRequest: OnRpcRequestHandler = async ({ origin, request }) => {
  let state = await getState();

  switch (request.method) {

    // ── ACTIVATE ──────────────────────────────────────────────────────────
    case 'utl_activate': {
      const params = request.params as { walletAddress?: string } | undefined;
      state.isOptedIn     = true;
      state.walletAddress = params?.walletAddress || '';
      state.joinedAt      = new Date().toISOString();
      state = await syncWalletProfile(state);
      await saveState(state);

      return snap.request({
        method: 'snap_dialog',
        params: {
          type: 'alert',
          content: panel([
            heading('✅ UTL Protocol Activated'),
            divider(),
            text('You are now an active UTL participant. Every transaction will now show you the full hidden fee picture.'),
            divider(),
            text('**Your starting position:**'),
            row('Tier',         text(`${tierEmoji(state.tier)} ${TIERS[state.tier]?.label || 'Bronze'}`)),
            row('Total Toll',   text(`${formatKeno(state.totalTollPaid)} KENO (building toward Silver)`)),
            row('Gov. Weight',  text(`${state.govWeight.toFixed(1)}`)),
            divider(),
            text('**How to earn:**'),
            text(`1. Stake KENO at ${UTL_DAPP}`),
            text('2. Receive 60% of all FeeCollector revenue'),
            text('3. Every toll you pay raises your tier and governance weight'),
            text('4. Higher tiers = lower toll rate + more reward share'),
            divider(),
            text('**Loyalty Tier Roadmap:**'),
            text('🥉 Bronze  — 0 KENO toll     (starting here)'),
            text('🥈 Silver  — 100 KENO toll    (+5% discount, early access)'),
            text('🏆 Gold    — 500 KENO toll    (+10% discount, propose votes)'),
            text('💎 Platinum — 2,000 KENO toll (+15% discount, 2x weight)'),
            text('👑 Diamond — 10,000 KENO toll (+20% discount, advisory seat)'),
            divider(),
            text('FeeCollector Contract:'),
            copyable(CONTRACTS.feeCollector),
          ]),
        },
      });
    }

    // ── DASHBOARD ─────────────────────────────────────────────────────────
    case 'utl_dashboard': {
      state = await syncWalletProfile(state);
      await saveState(state);
      const tier = TIERS[state.tier] || TIERS.BRONZE;
      const nextTierEntry = Object.entries(TIERS).find(([,v]) => v.min > state.totalTollPaid);
      const nextTierGap   = nextTierEntry ? nextTierEntry[1].min - state.totalTollPaid : 0;

      return snap.request({
        method: 'snap_dialog',
        params: {
          type: 'alert',
          content: panel([
            heading(`${tierEmoji(state.tier)} UTL Dashboard — ${tier.label}`),
            divider(),

            heading('Earnings'),
            row('KENO Staked',       text(`${formatKeno(parseFloat(state.kenoStaked))} KENO`)),
            row('Rewards Earned',    text(`${formatKeno(state.totalRewardsEarned)} KENO`)),
            row('Your Fee Share',    text('60% of all network toll collections')),
            row('Auto-Compound',     text(state.autoCompound ? '🔄 ON' : 'OFF')),
            divider(),

            heading('Tier & Governance'),
            row('Current Tier',      text(`${tierEmoji(state.tier)} ${tier.label} (${tier.multiplier} weight)`)),
            row('Toll Discount',     text(`${(tier.discount*100).toFixed(0)}% off your tolls`)),
            row('Total Toll Paid',   text(`${formatKeno(state.totalTollPaid)} KENO`)),
            row('To Next Tier',      text(nextTierEntry ? `${formatKeno(nextTierGap)} KENO more → ${nextTierEntry[0]}` : '👑 MAX TIER')),
            row('Governance Weight', text(`${state.govWeight.toFixed(1)} voting power`)),
            row('Can Propose',       text(state.tier === 'GOLD' || state.tier === 'PLATINUM' || state.tier === 'DIAMOND' ? '✅ Yes' : 'Reach Gold tier')),
            divider(),

            heading('Activity'),
            row('Transactions',      text(`${state.transactionCount}`)),
            row('MEV Events Flagged',text(`${state.mevBlocked}`)),
            row('Member Since',      text(state.joinedAt ? new Date(state.joinedAt).toLocaleDateString() : '—')),
            row('Last Sync',         text(state.lastSync ? new Date(state.lastSync).toLocaleDateString() : '—')),
            divider(),

            text(`Visit ${UTL_DAPP} to stake, claim, and vote.`),
          ]),
        },
      });
    }

    // ── EARNINGS BREAKDOWN ────────────────────────────────────────────────
    case 'utl_earnings': {
      const stats = await fetchStats();
      const networkTotal    = stats?.totalCollected || 0;
      const stakersTotal    = stats?.totalDistributed?.stakers || 0;
      const foundationTotal = stats?.totalDistributed?.foundation || 0;
      const treasuryTotal   = stats?.totalDistributed?.treasury || 0;

      return snap.request({
        method: 'snap_dialog',
        params: {
          type: 'alert',
          content: panel([
            heading('💰 UTL Earnings Breakdown'),
            divider(),

            heading('Network Revenue (All Sources)'),
            row('Total Collected',       text(`${formatKeno(networkTotal)} KENO`)),
            row('→ To All Stakers',      text(`${formatKeno(stakersTotal)} KENO (60%)`)),
            row('→ T.D.I.R. Foundation', text(`${formatKeno(foundationTotal)} KENO (25%)`)),
            row('→ Treasury',            text(`${formatKeno(treasuryTotal)} KENO (15%)`)),
            divider(),

            heading('Your Position'),
            row('KENO Staked',         text(`${formatKeno(parseFloat(state.kenoStaked))} KENO`)),
            row('Your Rewards Earned', text(`${formatKeno(state.totalRewardsEarned)} KENO`)),
            row('Tier Multiplier',     text(TIERS[state.tier]?.multiplier || '1.0x')),
            divider(),

            heading('Fee Sources Earning You Money'),
            text('Every time anyone uses UTL Protocol:'),
            text('• Distribution toll (1%) — KENO distributions'),
            text('• Staking toll (0.5%) — stake/unstake events'),
            text('• FAL™ completion fee (0.09%) — flash loans'),
            text('• Partner integration license — 3rd party platforms'),
            text('• Cross-chain bridge fee (0.3%) — KENO transfers'),
            text('• Yield optimization fee (2% of yield)'),
            divider(),
            text('All 60% of all the above flows to KENO stakers automatically.'),
            text('Your stake earns proportionally. Stake more → earn more.'),
            divider(),
            text(`Stake at ${UTL_DAPP} to activate earnings.`),
          ]),
        },
      });
    }

    // ── MEV PROTECTION INFO ───────────────────────────────────────────────
    case 'utl_mevInfo': {
      return snap.request({
        method: 'snap_dialog',
        params: {
          type: 'alert',
          content: panel([
            heading('🛡️ MEV Protection — How It Works'),
            divider(),
            text('**MEV (Maximal Extractable Value)** is money being silently stolen from your transactions by bots watching the mempool.'),
            divider(),
            heading('What Happens Without UTL'),
            text('1. You submit a swap in MetaMask'),
            text('2. A bot detects it in the public mempool'),
            text('3. Bot buys first, pushing price up (front-run)'),
            text('4. Your swap executes at worse price'),
            text('5. Bot sells immediately (back-run)'),
            text('6. Bot profits. You lost value. No one told you.'),
            divider(),
            heading('What UTL X-Ray Does'),
            text('✅ Flags high-risk transactions BEFORE you sign'),
            text('✅ Shows estimated value being extracted'),
            text('✅ Tracks your MEV exposure over time'),
            text('✅ Routes through FeeCollector to capture extractable value back'),
            divider(),
            row('MEV Events You Flagged', text(`${state.mevBlocked}`)),
            divider(),
            heading('Route Through UTL to Capture It'),
            text('Instead of bots taking the spread, UTL FeeCollector captures it and distributes 60% to KENO stakers — including you.'),
            divider(),
            text('FeeCollector:'),
            copyable(CONTRACTS.feeCollector),
          ]),
        },
      });
    }

    // ── GOVERNANCE ────────────────────────────────────────────────────────
    case 'utl_governance': {
      const canPropose = ['GOLD','PLATINUM','DIAMOND'].includes(state.tier);
      const canVote    = state.totalTollPaid >= 10;

      let activeProposals: any[] = [];
      try {
        const res = await fetch(`${UTL_API}/api/governance/proposals/active`, { signal: AbortSignal.timeout(4000) });
        if (res.ok) { const d = await res.json(); activeProposals = d.proposals || []; }
      } catch (_) {}

      const topProp = activeProposals[0];

      return snap.request({
        method: 'snap_dialog',
        params: {
          type: 'alert',
          content: panel([
            heading('🗳️ UTL Governance'),
            divider(),
            row('Your Tier',          text(`${tierEmoji(state.tier)} ${TIERS[state.tier]?.label}`)),
            row('Governance Weight',  text(`${state.govWeight.toFixed(1)} voting power`)),
            row('Can Vote',           text(canVote ? '✅ Yes — you have voting rights' : '❌ Pay 10+ KENO in tolls to unlock')),
            row('Can Propose',        text(canPropose ? '✅ Yes — Gold+ tier' : `❌ Reach Gold tier (${500 - state.totalTollPaid > 0 ? formatKeno(500 - state.totalTollPaid) : '0'} KENO more)`)),
            divider(),
            heading('Active Proposals'),
            ...(topProp ? [
              row('Title',    text(topProp.title || 'See dApp')),
              row('Status',   text(topProp.status || 'Active')),
              text(`Vote at ${UTL_DAPP}/governance`),
            ] : [
              text('No active proposals right now.'),
              text(`Visit ${UTL_DAPP}/governance to stay updated.`),
            ]),
            divider(),
            heading('Your Governance Rights by Tier'),
            text('🥉 Bronze  — Observer (no vote)'),
            text('🥈 Silver  — Community Member (vote when 10+ KENO toll paid)'),
            text('🏆 Gold    — Active Contributor (vote + propose)'),
            text('💎 Platinum — Protocol Elder (2x vote weight)'),
            text('👑 Diamond — Founding Voice (3x weight + advisory seat)'),
            divider(),
            text('Your voice grows with your participation. The more you use UTL, the louder you get.'),
          ]),
        },
      });
    }

    // ── FAL ALERTS TOGGLE ─────────────────────────────────────────────────
    case 'utl_toggleFAL': {
      state.falAlertsEnabled = !state.falAlertsEnabled;
      await saveState(state);
      return snap.request({
        method: 'snap_dialog',
        params: {
          type: 'alert',
          content: panel([
            heading('⚡ Flash Arbitrage Loan Alerts'),
            text(state.falAlertsEnabled
              ? '✅ FAL™ alerts are ON. You will be notified when profitable arbitrage opportunities open up.'
              : '🔕 FAL™ alerts are OFF.'),
            divider(),
            text('Flash Arbitrage Loans let you borrow, profit, and repay in one block — 0% default risk by design.'),
            text('The 0.09% FAL fee stays inside UTL instead of going to Aave.'),
            text(`Visit ${UTL_DAPP}/fal to participate.`),
          ]),
        },
      });
    }

    // ── AUTO-COMPOUND TOGGLE ──────────────────────────────────────────────
    case 'utl_toggleAutoCompound': {
      state.autoCompound = !state.autoCompound;
      await saveState(state);
      return snap.request({
        method: 'snap_dialog',
        params: {
          type: 'alert',
          content: panel([
            heading('🔄 Auto-Compound'),
            text(state.autoCompound
              ? '✅ Auto-compound ON — your staking rewards are automatically restaked. Compounding accelerates your tier growth and future earnings.'
              : `Auto-compound OFF — rewards accumulate and can be claimed manually at ${UTL_DAPP}.`),
          ]),
        },
      });
    }

    // ── UPDATE STAKE ─────────────────────────────────────────────────────
    case 'utl_updateStake': {
      const params = request.params as { kenoAmount: string } | undefined;
      if (!params?.kenoAmount) return { success: false, error: 'kenoAmount required' };
      state.kenoStaked = params.kenoAmount;
      state.tier       = computeTier(state.totalTollPaid);
      await saveState(state);

      await snap.request({
        method: 'snap_notify',
        params: {
          type: 'inApp',
          message: `🏆 UTL: Stake updated — ${formatKeno(parseFloat(params.kenoAmount))} KENO · Tier: ${tierEmoji(state.tier)} ${TIERS[state.tier]?.label}`,
        },
      });

      return { success: true, tier: state.tier, kenoStaked: state.kenoStaked };
    }

    // ── CLAIM REWARDS ─────────────────────────────────────────────────────
    case 'utl_claimRewards': {
      return snap.request({
        method: 'snap_dialog',
        params: {
          type: 'confirmation',
          content: panel([
            heading('📥 Claim Staking Rewards'),
            text(`Pending: **${formatKeno(state.totalRewardsEarned)} KENO**`),
            divider(),
            text('Claiming transfers your staking rewards to your wallet.'),
            text('BSC gas fees apply. After claiming, rewards reset to 0.'),
            divider(),
            text('Staking Contract:'),
            copyable(CONTRACTS.staking),
            divider(),
            text('**Confirm to proceed?**'),
          ]),
        },
      });
    }

    // ── STATS (machine-readable) ──────────────────────────────────────────
    case 'utl_getStats': {
      return {
        isOptedIn: state.isOptedIn, tier: state.tier,
        kenoStaked: state.kenoStaked, totalTollPaid: state.totalTollPaid,
        totalRewardsEarned: state.totalRewardsEarned, govWeight: state.govWeight,
        transactionCount: state.transactionCount, mevBlocked: state.mevBlocked,
        autoCompound: state.autoCompound, falAlertsEnabled: state.falAlertsEnabled,
        joinedAt: state.joinedAt, contracts: CONTRACTS,
      };
    }

    // ── GET CONTRACTS ─────────────────────────────────────────────────────
    case 'utl_getContracts': {
      return { network: 'BSC Mainnet', chainId: 56, ...CONTRACTS };
    }

    // ── SYNC ─────────────────────────────────────────────────────────────
    case 'utl_sync': {
      state = await syncWalletProfile(state);
      await saveState(state);
      return { success: true, tier: state.tier, totalTollPaid: state.totalTollPaid, govWeight: state.govWeight };
    }

    // ── OPT OUT ──────────────────────────────────────────────────────────
    case 'utl_deactivate': {
      state.isOptedIn = false;
      await saveState(state);
      return snap.request({
        method: 'snap_dialog',
        params: {
          type: 'alert',
          content: panel([
            heading('UTL Deactivated'),
            text('UTL Protocol has been deactivated. Your tier and toll history are preserved.'),
            text('Staked KENO remains in the staking contract until you unstake.'),
            text('Reactivate anytime via utl_activate.'),
          ]),
        },
      });
    }

    default:
      throw new Error(`Unknown UTL method: ${request.method}`);
  }
};
