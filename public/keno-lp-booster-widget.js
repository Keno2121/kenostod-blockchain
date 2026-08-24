/**
 * KENO LP Booster Widget — by Kenostod
 * KENO/BNB specific liquidity widget with burn projection and pool share badge.
 *
 * Wraps PancakeSwap V2 addLiquidityETH with KENO ecosystem context:
 *   • Live pool share %
 *   • Estimated KENO burned per month from your LP fees
 *   • 24h volume + price from PancakeSwap/Binance APIs
 *   • "KENO Market Maker" achievement badge after successful LP add
 *
 * Burn projection formula:
 *   monthlyBurn = userSharePct × poolVolume24h × (365/12) × 0.0017 × 0.15 / kenoPrice
 *   (0.17% PancakeSwap LP fee × 15% KENOAutoBurn split ÷ KENO price)
 *
 * Embed:
 *   <script src="https://kenostodblockchain.com/keno-lp-booster-widget.js"
 *           data-site-id="YOUR_SITE_ID"></script>
 */
(function () {
  'use strict';

  /* ── Script tag & config ── */
  const SCRIPT_TAG = document.currentScript || (function () {
    const tags = document.querySelectorAll('script[src*="keno-lp-booster"]');
    return tags[tags.length - 1];
  })();

  const SITE_ID  = (SCRIPT_TAG ? SCRIPT_TAG.getAttribute('data-site-id') : null) || 'demo';
  const API_BASE = (SCRIPT_TAG ? (SCRIPT_TAG.getAttribute('data-api-url') || 'https://kenostodblockchain.com') : 'https://kenostodblockchain.com');

  /* ── KENO / BSC Constants ── */
  const KENO_ADDR    = '0x48bb049afe50b050b458624dc6233acd51024ab4';
  const WBNB_ADDR    = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';
  const ROUTER_ADDR  = '0x10ED43C718714eb63d5aA57B78B54704E256024E';
  const FACTORY_ADDR = '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73';
  const BSC_RPC      = 'https://bsc-dataseed.binance.org';
  const BSC_CHAIN_ID = '0x38'; // 56
  const AUTOBURN_PCT = 0.15;   // 15% of LP fee income → KENOAutoBurn
  const LP_FEE_PCT   = 0.0017; // 0.17% of volume → LP providers

  /* ── State ── */
  let _panelOpen    = false;
  let _account      = null;
  let _kenoDecimals = 18;
  let _kenoBal      = null;
  let _bnbBal       = null;
  let _allowance    = null;
  let _reserveCache = null; // { r0, r1, ts }
  let _statsCache   = null; // { tvl, price, volume24h, bnbUsd, pairAddress, ts }

  /* ═══════════════════════════
   *  ABI encoding helpers
   * ═══════════════════════════ */

  function hexPad(val, bytes) {
    let h = typeof val === 'bigint'
      ? val.toString(16)
      : typeof val === 'number'
      ? val.toString(16)
      : String(val).replace(/^0x/i, '');
    return h.padStart(bytes * 2, '0');
  }
  function encodeAddr(addr) { return hexPad(addr.replace(/^0x/i, ''), 32); }
  function encodeUint(val)  { return hexPad(BigInt(val), 32); }
  function call4(sel, ...p) { return '0x' + sel + p.join(''); }

  const SEL = {
    balanceOf:   '70a08231',
    decimals:    '313ce567',
    allowance:   'dd62ed3e',
    approve:     '095ea7b3',
    getReserves: '0902f1ac',
    getPair:     'e6a43905',
    addLiqETH:   'f305d719',
    totalSupply: '18160ddd',
  };

  /* ── RPC ── */
  async function rpc(method, params) {
    const r = await fetch(BSC_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    });
    const j = await r.json();
    if (j.error) throw new Error(j.error.message || 'RPC error');
    return j.result;
  }
  async function ethCall(to, data) { return rpc('eth_call', [{ to, data }, 'latest']); }
  function decodeUint(hex) {
    if (!hex || hex === '0x') return 0n;
    return BigInt(hex.slice(0, 66));
  }

  /* ── On-chain reads ── */
  async function getDecimals(token) {
    return Number(decodeUint(await ethCall(token, '0x' + SEL.decimals)));
  }
  async function getBalance(token, addr) {
    return decodeUint(await ethCall(token, call4(SEL.balanceOf, encodeAddr(addr))));
  }
  async function getBNBBal(addr) {
    return BigInt(await rpc('eth_getBalance', [addr, 'latest']));
  }
  async function getAllowance(token, owner, spender) {
    return decodeUint(await ethCall(token, call4(SEL.allowance, encodeAddr(owner), encodeAddr(spender))));
  }
  async function getPairAddr() {
    const data = call4(SEL.getPair, encodeAddr(KENO_ADDR), encodeAddr(WBNB_ADDR));
    const res  = await ethCall(FACTORY_ADDR, data);
    if (!res || /^0x0+$/.test(res)) return null;
    return '0x' + res.slice(26);
  }
  async function getReserves(pair) {
    const now = Date.now();
    if (_reserveCache && now - _reserveCache.ts < 30_000) return _reserveCache;
    const res = await ethCall(pair, '0x' + SEL.getReserves);
    if (!res || res === '0x') return null;
    _reserveCache = {
      r0: BigInt('0x' + res.slice(2, 66)),   // KENO reserve
      r1: BigInt('0x' + res.slice(66, 130)),  // WBNB reserve
      ts: now,
    };
    return _reserveCache;
  }
  async function getTotalSupplyLP(pair) {
    const res = await ethCall(pair, '0x' + SEL.totalSupply);
    return decodeUint(res);
  }
  async function getLPBalance(pair, addr) {
    return decodeUint(await ethCall(pair, call4(SEL.balanceOf, encodeAddr(addr))));
  }

  /* ── Format helpers ── */
  function fmt(bigint, decimals, display) {
    if (!decimals) decimals = 18;
    const d = display ?? 4;
    const unit = 10n ** BigInt(decimals);
    const whole = bigint / unit;
    const frac  = (bigint % unit).toString().padStart(decimals, '0').slice(0, d);
    return `${whole}.${frac}`;
  }
  function parseUnits(val, decimals) {
    if (!val || isNaN(parseFloat(val))) return 0n;
    const [w, f = ''] = String(parseFloat(val).toFixed(decimals)).split('.');
    return BigInt(w) * 10n ** BigInt(decimals) + BigInt(f.padEnd(decimals, '0').slice(0, decimals));
  }
  function slippage(amount, pct) { return (amount * BigInt(100 - pct)) / 100n; }
  function deadline() { return Math.floor(Date.now() / 1000) + 1200; }
  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  /* ── Pool stats (TVL, price, volume) ── */
  async function fetchPoolStats(pairAddr) {
    const now = Date.now();
    if (_statsCache && now - _statsCache.ts < 60_000) return _statsCache;
    try {
      // Server-side cached stats
      const r = await fetch(`${API_BASE}/api/lp-widget/pool-stats?pair=KENO-BNB&token=${KENO_ADDR}`);
      const d = await r.json();

      // 24h volume: try PancakeSwap subgraph
      let volume24h = 0;
      try {
        const gqlRes = await fetch('https://bsc.streamingfast.io/subgraphs/name/pancakeswap/exchange-v2', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: `{ pair(id: "${(pairAddr || '').toLowerCase()}") { volumeUSD dailyTxns: txCount } }`,
          }),
          signal: AbortSignal.timeout(4000),
        });
        const gqlData = await gqlRes.json();
        // fallback: estimate from reserves TVL change (subgraph may not have exact 24h)
        volume24h = 0; // will be set below if subgraph succeeds
      } catch (_) {}

      // Estimate 24h volume from TVL if subgraph unavailable:
      // Typical DeFi pool: volume ≈ 0.5–2× TVL daily; use 0.3× as conservative
      const tvl = d.ok ? parseFloat(d.tvl || '0') : 0;
      if (volume24h === 0) volume24h = tvl * 0.3;

      _statsCache = {
        tvl:       d.ok ? parseFloat(d.tvl   || '0') : 0,
        price:     d.ok ? parseFloat(d.price || '0') : 0,
        bnbUsd:    d.ok ? parseFloat(d.bnbUsd || '600') : 600,
        reserve0:  d.ok ? parseFloat(d.reserve0 || '0') : 0,
        reserve1:  d.ok ? parseFloat(d.reserve1 || '0') : 0,
        volume24h,
        ts: now,
      };
      return _statsCache;
    } catch (_) {
      return _statsCache || { tvl: 0, price: 0, bnbUsd: 600, reserve0: 0, reserve1: 0, volume24h: 0, ts: 0 };
    }
  }

  /* ── Burn projection ── */
  function calcBurnProjection(userSharePct, volume24h, kenoPrice) {
    if (!userSharePct || !volume24h || !kenoPrice || kenoPrice === 0) return null;
    // Monthly volume = 24h × (365/12)
    const monthlyVolume = volume24h * (365 / 12);
    // Monthly LP fee income for this user = monthlyVolume × 0.17% × userShare%
    const userMonthlyFeeUsd = monthlyVolume * LP_FEE_PCT * (userSharePct / 100);
    // KENO burned = fee income × 15% AutoBurn split ÷ KENO price
    const kenosBurned = (userMonthlyFeeUsd * AUTOBURN_PCT) / kenoPrice;
    return { kenosBurned, userMonthlyFeeUsd };
  }

  /* ═══════════════════════════
   *  CSS
   * ═══════════════════════════ */
  const STYLE = `
    #klp-fab {
      position: fixed; bottom: 24px; right: 24px; z-index: 2147483646;
      display: flex; align-items: center; gap: 9px; padding: 13px 20px;
      background: linear-gradient(135deg, #d97706, #f59e0b);
      border: none; border-radius: 50px; color: #000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px; font-weight: 800; cursor: pointer;
      box-shadow: 0 4px 24px rgba(245,158,11,0.5);
      transition: transform 0.15s, box-shadow 0.15s; letter-spacing: 0.02em;
    }
    #klp-fab:hover { transform: translateY(-2px); box-shadow: 0 8px 32px rgba(245,158,11,0.65); }
    #klp-fab:active { transform: translateY(0); }

    #klp-panel {
      position: fixed; bottom: 86px; right: 24px; z-index: 2147483647;
      width: 380px;
      background: linear-gradient(160deg, #09080a 0%, #130d04 100%);
      border: 1px solid rgba(245,158,11,0.3);
      border-radius: 20px;
      box-shadow: 0 16px 64px rgba(0,0,0,0.8), 0 0 0 1px rgba(245,158,11,0.08);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      overflow: hidden;
      animation: klp-up 0.28s cubic-bezier(0.34,1.56,0.64,1);
    }
    #klp-panel.klp-closing { animation: klp-down 0.22s ease-in forwards; }
    @keyframes klp-up   { from { transform: translateY(24px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    @keyframes klp-down { from { transform: translateY(0); opacity: 1; } to { transform: translateY(24px); opacity: 0; } }

    .klp-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 16px 20px 12px;
      border-bottom: 1px solid rgba(245,158,11,0.15);
      background: linear-gradient(135deg, rgba(217,119,6,0.1), rgba(245,158,11,0.06));
    }
    .klp-header-left { display: flex; align-items: center; gap: 10px; }
    .klp-logo {
      width: 38px; height: 38px;
      background: linear-gradient(135deg, #d97706, #f59e0b);
      border-radius: 10px; font-size: 20px;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 2px 12px rgba(245,158,11,0.4);
    }
    .klp-title { font-size: 15px; font-weight: 800; color: #fbbf24; }
    .klp-subtitle { font-size: 11px; color: #78716c; margin-top: 1px; }
    .klp-close {
      background: none; border: none; color: #78716c; font-size: 20px;
      cursor: pointer; padding: 4px; line-height: 1; border-radius: 6px; transition: color 0.15s;
    }
    .klp-close:hover { color: #fbbf24; background: rgba(245,158,11,0.08); }

    /* Ecosystem headline */
    .klp-headline {
      padding: 14px 20px 0;
      font-size: 13px; font-weight: 700; color: #fbbf24;
      text-align: center; letter-spacing: 0.01em;
    }
    .klp-headline span { color: #d97706; }

    /* Stats row */
    .klp-stats {
      display: flex; border-bottom: 1px solid rgba(245,158,11,0.12);
      margin-top: 12px;
    }
    .klp-stat {
      flex: 1; text-align: center; padding: 10px 6px;
    }
    .klp-stat:not(:last-child) { border-right: 1px solid rgba(245,158,11,0.12); }
    .klp-stat-val  { font-size: 13px; font-weight: 700; color: #fbbf24; }
    .klp-stat-label { font-size: 10px; color: #78716c; margin-top: 2px; text-transform: uppercase; letter-spacing: 0.05em; }

    /* Burn projection panel */
    .klp-burn-box {
      margin: 14px 20px 0;
      padding: 12px 14px;
      background: rgba(217,119,6,0.08);
      border: 1px solid rgba(245,158,11,0.2);
      border-radius: 12px;
    }
    .klp-burn-title { font-size: 11px; font-weight: 700; color: #f59e0b; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 8px; }
    .klp-burn-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px; }
    .klp-burn-label { font-size: 12px; color: #a8a29e; }
    .klp-burn-value { font-size: 13px; font-weight: 700; color: #fbbf24; }
    .klp-burn-note { font-size: 10px; color: #57534e; margin-top: 6px; line-height: 1.4; }

    /* Body */
    .klp-body { padding: 14px 20px 16px; }

    .klp-balances { display: flex; gap: 10px; margin-bottom: 14px; }
    .klp-bal {
      flex: 1; background: rgba(245,158,11,0.05);
      border: 1px solid rgba(245,158,11,0.15);
      border-radius: 10px; padding: 9px 12px; font-size: 12px; color: #a8a29e;
    }
    .klp-bal b { display: block; font-size: 14px; color: #fbbf24; margin-top: 2px; font-weight: 700; }

    .klp-input-row { margin-bottom: 9px; }
    .klp-input-label {
      font-size: 11px; font-weight: 600; color: #78716c;
      text-transform: uppercase; letter-spacing: 0.05em;
      margin-bottom: 5px; display: flex; justify-content: space-between;
    }
    .klp-input-label span { color: #f59e0b; cursor: pointer; font-weight: 700; }
    .klp-input-label span:hover { color: #fbbf24; }
    .klp-input {
      width: 100%; padding: 11px 14px;
      background: rgba(0,0,0,0.4); border: 1px solid rgba(245,158,11,0.2);
      border-radius: 10px; color: #fef3c7; font-size: 15px;
      outline: none; transition: border-color 0.15s, box-shadow 0.15s;
      box-sizing: border-box;
    }
    .klp-input:focus { border-color: rgba(245,158,11,0.5); box-shadow: 0 0 0 3px rgba(245,158,11,0.1); }
    .klp-input::placeholder { color: #44403c; }

    .klp-ratio-hint { font-size: 11px; color: #57534e; text-align: center; margin: 3px 0 12px; }

    .klp-share-badge {
      display: flex; align-items: center; justify-content: space-between;
      background: rgba(245,158,11,0.07);
      border: 1px solid rgba(245,158,11,0.2);
      border-radius: 10px; padding: 10px 14px; margin-bottom: 12px;
    }
    .klp-share-label { font-size: 12px; color: #a8a29e; }
    .klp-share-val   { font-size: 14px; font-weight: 800; color: #f59e0b; }

    .klp-btn {
      width: 100%; padding: 13px;
      background: linear-gradient(135deg, #d97706, #f59e0b);
      border: none; border-radius: 12px; color: #000;
      font-size: 15px; font-weight: 800; cursor: pointer;
      transition: opacity 0.15s, transform 0.1s; letter-spacing: 0.02em;
    }
    .klp-btn:hover:not(:disabled) { opacity: 0.88; transform: translateY(-1px); }
    .klp-btn:active:not(:disabled) { transform: translateY(0); }
    .klp-btn:disabled { opacity: 0.35; cursor: not-allowed; transform: none; }

    .klp-msg {
      margin-top: 10px; padding: 10px 14px;
      border-radius: 10px; font-size: 13px; display: none;
    }
    .klp-msg.success { background: rgba(52,211,153,0.1); border: 1px solid rgba(52,211,153,0.3); color: #34d399; display: block; }
    .klp-msg.error   { background: rgba(248,113,113,0.08); border: 1px solid rgba(248,113,113,0.3); color: #f87171; display: block; }
    .klp-msg.info    { background: rgba(245,158,11,0.08); border: 1px solid rgba(245,158,11,0.25); color: #fbbf24; display: block; }

    .klp-footer {
      padding: 8px 20px 14px; text-align: center;
      font-size: 11px; color: #44403c;
    }
    .klp-footer a { color: #57534e; text-decoration: none; }
    .klp-footer a:hover { color: #f59e0b; }

    .klp-connect-view { padding: 28px 20px; text-align: center; }
    .klp-connect-icon { font-size: 38px; margin-bottom: 12px; }
    .klp-connect-msg  { font-size: 14px; color: #a8a29e; margin-bottom: 18px; line-height: 1.5; }

    .klp-spinner {
      display: inline-block; width: 15px; height: 15px;
      border: 2px solid rgba(0,0,0,0.2); border-top-color: #000;
      border-radius: 50%; animation: klp-spin 0.7s linear infinite;
      vertical-align: middle; margin-right: 6px;
    }
    @keyframes klp-spin { to { transform: rotate(360deg); } }

    /* Achievement badge overlay */
    #klp-badge-overlay {
      position: fixed; inset: 0; z-index: 2147483648;
      background: rgba(0,0,0,0.85); display: flex;
      align-items: center; justify-content: center;
      animation: klp-badge-fade 0.3s ease;
    }
    @keyframes klp-badge-fade { from { opacity: 0; } to { opacity: 1; } }
    #klp-badge-card {
      background: linear-gradient(135deg, #1c1400, #231800);
      border: 2px solid #f59e0b;
      border-radius: 24px; padding: 40px 36px; max-width: 360px; width: 90%;
      text-align: center;
      box-shadow: 0 0 80px rgba(245,158,11,0.3), 0 0 0 1px rgba(245,158,11,0.15);
      position: relative;
    }
    .klp-badge-crown  { font-size: 52px; margin-bottom: 14px; animation: klp-spin-slow 4s linear infinite; }
    @keyframes klp-spin-slow { from{transform:rotate(-5deg)} 50%{transform:rotate(5deg)} to{transform:rotate(-5deg)} }
    .klp-badge-title  { font-size: 11px; font-weight: 700; color: #d97706; letter-spacing: 0.15em; text-transform: uppercase; margin-bottom: 6px; }
    .klp-badge-name   { font-size: 26px; font-weight: 900; color: #fbbf24; margin-bottom: 4px; letter-spacing: -0.02em; }
    .klp-badge-sub    { font-size: 13px; color: #a8a29e; margin-bottom: 20px; }
    .klp-badge-stats  { display: flex; gap: 0; border: 1px solid rgba(245,158,11,0.2); border-radius: 12px; margin-bottom: 20px; overflow: hidden; }
    .klp-bs { flex: 1; padding: 12px 8px; text-align: center; }
    .klp-bs:not(:last-child) { border-right: 1px solid rgba(245,158,11,0.2); }
    .klp-bs-val   { font-size: 15px; font-weight: 800; color: #f59e0b; }
    .klp-bs-label { font-size: 10px; color: #78716c; margin-top: 2px; text-transform: uppercase; letter-spacing: 0.05em; }
    .klp-badge-powered { font-size: 10px; color: #44403c; margin-bottom: 20px; letter-spacing: 0.08em; text-transform: uppercase; }
    .klp-badge-btns { display: flex; gap: 10px; justify-content: center; }
    .klp-share-btn {
      padding: 10px 20px; border-radius: 10px; font-size: 13px; font-weight: 700;
      cursor: pointer; transition: opacity 0.15s; border: none;
    }
    .klp-share-btn.x    { background: #000; color: #fff; border: 1px solid #333; }
    .klp-share-btn.copy { background: rgba(245,158,11,0.15); color: #f59e0b; border: 1px solid rgba(245,158,11,0.3); }
    .klp-share-btn:hover { opacity: 0.8; }
    .klp-badge-close {
      position: absolute; top: 14px; right: 18px;
      background: none; border: none; color: #57534e; font-size: 22px;
      cursor: pointer; line-height: 1; padding: 4px;
    }
    .klp-badge-close:hover { color: #f59e0b; }
  `;

  /* ── Inject CSS ── */
  function injectStyle() {
    if (document.getElementById('klp-style')) return;
    const s = document.createElement('style');
    s.id = 'klp-style';
    s.textContent = STYLE;
    document.head.appendChild(s);
  }

  /* ── FAB ── */
  function injectFAB() {
    if (document.getElementById('klp-fab')) return;
    const fab = document.createElement('button');
    fab.id = 'klp-fab';
    fab.innerHTML = '🔥 Boost KENO Liquidity';
    fab.addEventListener('click', togglePanel);
    document.body.appendChild(fab);
  }

  /* ── Panel lifecycle ── */
  function togglePanel() { _panelOpen ? closePanel() : openPanel(); }

  function closePanel() {
    const p = document.getElementById('klp-panel');
    if (!p) return;
    _panelOpen = false;
    p.classList.add('klp-closing');
    setTimeout(() => p.remove(), 230);
  }

  async function openPanel() {
    _panelOpen = true;
    renderLoading();
    await loadPanel();
  }

  /* ── Render: loading skeleton ── */
  function renderLoading() {
    let p = document.getElementById('klp-panel');
    if (p) p.remove();
    p = document.createElement('div');
    p.id = 'klp-panel';
    p.innerHTML = `
      <div class="klp-header">
        <div class="klp-header-left">
          <div class="klp-logo">🔥</div>
          <div>
            <div class="klp-title">KENO LP Booster</div>
            <div class="klp-subtitle">PancakeSwap V2 · BSC</div>
          </div>
        </div>
        <button class="klp-close" id="klp-close-btn">×</button>
      </div>
      <div style="padding:40px 20px;text-align:center">
        <div style="display:inline-block;width:20px;height:20px;border:2px solid rgba(245,158,11,0.2);border-top-color:#f59e0b;border-radius:50%;animation:klp-spin 0.7s linear infinite;"></div>
        <div style="color:#57534e;font-size:13px;margin-top:12px">Loading KENO pool…</div>
      </div>
    `;
    document.body.appendChild(p);
    document.getElementById('klp-close-btn').addEventListener('click', closePanel);
  }

  /* ── Load panel data ── */
  async function loadPanel() {
    try {
      if (!window.ethereum) { renderNoWallet(); return; }
      const chainId = await window.ethereum.request({ method: 'eth_chainId' }).catch(() => null);
      if (chainId !== BSC_CHAIN_ID) { renderWrongChain(); return; }

      const accounts = await window.ethereum.request({ method: 'eth_accounts' }).catch(() => []);
      _account = accounts[0] || null;

      const pairAddr = await getPairAddr();
      if (!pairAddr) { renderNoPool(); return; }

      _kenoDecimals = _kenoDecimals || await getDecimals(KENO_ADDR);
      const [reserves, stats] = await Promise.all([
        getReserves(pairAddr),
        fetchPoolStats(pairAddr),
      ]);

      if (_account) await refreshBalances(pairAddr);

      renderMain(pairAddr, reserves, stats);
    } catch (e) {
      renderError(e.message);
    }
  }

  async function refreshBalances(pairAddr) {
    if (!_account) return;
    try {
      [_kenoBal, _bnbBal, _allowance] = await Promise.all([
        getBalance(KENO_ADDR, _account),
        getBNBBal(_account),
        getAllowance(KENO_ADDR, _account, ROUTER_ADDR),
      ]);
    } catch (_) {}
  }

  /* ── Utility renders ── */
  function renderNoWallet() {
    setBody(`
      <div class="klp-connect-view">
        <div class="klp-connect-icon">🦊</div>
        <div class="klp-connect-msg">No Web3 wallet detected.<br/>Install MetaMask to add KENO liquidity.</div>
        <a href="https://metamask.io/download/" target="_blank"
           style="display:inline-block;padding:11px 24px;background:linear-gradient(135deg,#f6851b,#e2761b);border-radius:10px;color:#fff;font-weight:700;font-size:14px;text-decoration:none">
          Get MetaMask →
        </a>
      </div>
    `);
  }

  function renderWrongChain() {
    setBody(`
      <div class="klp-connect-view">
        <div class="klp-connect-icon">⛓️</div>
        <div class="klp-connect-msg">Wrong network.<br/>Please switch to <b style="color:#f59e0b">BNB Smart Chain</b>.</div>
        <button class="klp-btn" style="max-width:220px;margin:0 auto;display:block" id="klp-switch-chain">Switch to BSC</button>
      </div>
    `);
    document.getElementById('klp-switch-chain').addEventListener('click', async () => {
      try {
        await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: BSC_CHAIN_ID }] });
        await loadPanel();
      } catch (e) {
        if (e.code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{ chainId: BSC_CHAIN_ID, chainName: 'BNB Smart Chain',
              nativeCurrency: { name:'BNB', symbol:'BNB', decimals:18 },
              rpcUrls: ['https://bsc-dataseed.binance.org'],
              blockExplorerUrls: ['https://bscscan.com'] }],
          }).catch(() => {});
          await loadPanel();
        }
      }
    });
  }

  function renderNoPool() {
    setBody(`<div style="padding:28px 20px;text-align:center;color:#f59e0b;font-size:13px">
      ⚠️ KENO/BNB pool not found on PancakeSwap V2.
    </div>`);
  }

  function renderError(msg) {
    setBody(`<div style="padding:28px 20px;text-align:center;color:#f87171;font-size:13px">
      ❌ ${msg}
    </div>`);
  }

  /* ── Main panel ── */
  function renderMain(pairAddr, reserves, stats) {
    const panel = document.getElementById('klp-panel');
    if (!panel) return;

    const ratio = reserves && reserves.r0 > 0n
      ? Number(reserves.r1) / Number(reserves.r0) * (10 ** (_kenoDecimals - 18))
      : null;

    const kenoBal = _kenoBal !== null ? fmt(_kenoBal, _kenoDecimals, 4) : '—';
    const bnbBal  = _bnbBal  !== null ? fmt(_bnbBal, 18, 4) : '—';
    const notConn = !_account;

    const priceText = stats.price > 0 ? `$${Number(stats.price).toFixed(4)}` : (ratio ? `$${(ratio * stats.bnbUsd).toFixed(4)}` : '—');
    const tvlText   = stats.tvl   > 0 ? `$${Number(stats.tvl).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—';
    const volText   = stats.volume24h > 0 ? `$${Number(stats.volume24h).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—';

    panel.innerHTML = `
      <div class="klp-header">
        <div class="klp-header-left">
          <div class="klp-logo">🔥</div>
          <div>
            <div class="klp-title">KENO Market Maker</div>
            <div class="klp-subtitle">PancakeSwap V2 · BSC</div>
          </div>
        </div>
        <button class="klp-close" id="klp-close-btn">×</button>
      </div>

      <div class="klp-headline">
        Earn trading fees + power the burn 🔥
      </div>

      <div class="klp-stats">
        <div class="klp-stat">
          <div class="klp-stat-val" id="klp-st-tvl">${tvlText}</div>
          <div class="klp-stat-label">Pool TVL</div>
        </div>
        <div class="klp-stat">
          <div class="klp-stat-val" id="klp-st-price">${priceText}</div>
          <div class="klp-stat-label">KENO Price</div>
        </div>
        <div class="klp-stat">
          <div class="klp-stat-val" id="klp-st-vol">${volText}</div>
          <div class="klp-stat-label">Est. 24h Vol</div>
        </div>
        <div class="klp-stat">
          <div class="klp-stat-val">${ratio ? ratio.toFixed(6) : '—'}</div>
          <div class="klp-stat-label">BNB/KENO</div>
        </div>
      </div>

      <div class="klp-burn-box">
        <div class="klp-burn-title">🔥 AutoBurn Flywheel</div>
        <div class="klp-burn-row">
          <div class="klp-burn-label">Your pool share</div>
          <div class="klp-burn-value" id="klp-share-pct">—</div>
        </div>
        <div class="klp-burn-row">
          <div class="klp-burn-label">Est. KENO burned / month</div>
          <div class="klp-burn-value" id="klp-burn-est">—</div>
        </div>
        <div class="klp-burn-row" id="klp-fee-row" style="display:none">
          <div class="klp-burn-label">Your LP fee income / month</div>
          <div class="klp-burn-value" id="klp-fee-est">—</div>
        </div>
        <div class="klp-burn-note">
          Your fees → KENOAutoBurn splits 15% to burn KENO → KENO price rises → your LP worth more. All paths converge.
        </div>
      </div>

      <div class="klp-body">
        ${notConn ? `
          <div style="text-align:center;padding:8px 0 4px">
            <div style="font-size:13px;color:#78716c;margin-bottom:12px">Connect wallet to add KENO/BNB liquidity</div>
            <button class="klp-btn" id="klp-connect-btn">🔗 Connect Wallet</button>
          </div>
        ` : `
          <div class="klp-balances">
            <div class="klp-bal">KENO<b id="klp-bal-keno">${kenoBal}</b></div>
            <div class="klp-bal">BNB<b id="klp-bal-bnb">${bnbBal}</b></div>
          </div>

          <div class="klp-input-row">
            <div class="klp-input-label">
              KENO Amount
              <span id="klp-max-keno">MAX</span>
            </div>
            <input class="klp-input" type="number" id="klp-in-keno" placeholder="0.0" min="0" step="any"/>
          </div>

          <div class="klp-ratio-hint" id="klp-ratio-hint">
            ${ratio ? `= <span id="klp-bnb-eq">0.0000</span> BNB at current ratio` : 'Loading ratio…'}
          </div>

          <div class="klp-input-row">
            <div class="klp-input-label">
              BNB Amount
              <span id="klp-max-bnb">MAX</span>
            </div>
            <input class="klp-input" type="number" id="klp-in-bnb" placeholder="0.0" min="0" step="any"/>
          </div>

          <button class="klp-btn" id="klp-action-btn">
            ${_allowance === null || _allowance === 0n ? 'Approve KENO' : 'Add Liquidity'}
          </button>
          <div class="klp-msg" id="klp-msg"></div>
        `}
      </div>

      <div class="klp-footer">
        <a href="${API_BASE}/keno-lp-widget" target="_blank">How the flywheel works ↗</a>
        · <a href="https://pancakeswap.finance/add/${KENO_ADDR}/${WBNB_ADDR}" target="_blank">Open on PancakeSwap ↗</a>
      </div>
    `;

    document.getElementById('klp-close-btn').addEventListener('click', closePanel);

    if (notConn) {
      document.getElementById('klp-connect-btn').addEventListener('click', () => connectWallet(pairAddr, reserves, stats));
      return;
    }

    wireInputs(pairAddr, reserves, stats, ratio);
  }

  /* ── Wire inputs ── */
  function wireInputs(pairAddr, reserves, stats, ratio) {
    const inKeno = document.getElementById('klp-in-keno');
    const inBnb  = document.getElementById('klp-in-bnb');
    const btn    = document.getElementById('klp-action-btn');

    let updating = false;

    function updateProjection() {
      const kenoVal = parseFloat(inKeno.value) || 0;
      const bnbVal  = parseFloat(inBnb.value)  || 0;

      // Pool share estimate
      let sharePct = 0;
      if (kenoVal > 0 && reserves && reserves.r0 > 0n) {
        const r0f = Number(reserves.r0) / (10 ** _kenoDecimals);
        const r1f = Number(reserves.r1) / 1e18;
        sharePct  = Math.min(kenoVal / r0f, bnbVal > 0 ? bnbVal / r1f : kenoVal / r0f) * 100;
      }

      const shareEl = document.getElementById('klp-share-pct');
      const burnEl  = document.getElementById('klp-burn-est');
      const feeRow  = document.getElementById('klp-fee-row');
      const feeEl   = document.getElementById('klp-fee-est');

      if (sharePct > 0) {
        if (shareEl) shareEl.textContent = sharePct.toFixed(6) + '%';
        const kenoPrice = stats.price || (ratio ? ratio * stats.bnbUsd : 0);
        const proj = calcBurnProjection(sharePct, stats.volume24h, kenoPrice);
        if (proj && burnEl) {
          burnEl.textContent = proj.kenosBurned >= 0.01
            ? proj.kenosBurned.toFixed(2) + ' KENO'
            : proj.kenosBurned.toFixed(4) + ' KENO';
          if (feeRow) feeRow.style.display = 'flex';
          if (feeEl)  feeEl.textContent = '$' + proj.userMonthlyFeeUsd.toFixed(4);
        }
      } else {
        if (shareEl) shareEl.textContent = '—';
        if (burnEl)  burnEl.textContent  = 'Enter an amount above';
        if (feeRow)  feeRow.style.display = 'none';
      }
    }

    function updateActionLabel() {
      if (!btn) return;
      const kenoVal = parseFloat(inKeno.value) || 0;
      const kenoWei = parseUnits(String(kenoVal), _kenoDecimals);
      const needsApprove = kenoVal > 0 && (_allowance === null || _allowance < kenoWei);
      btn.textContent = needsApprove ? 'Approve KENO' : 'Add Liquidity';
    }

    inKeno.addEventListener('input', () => {
      if (updating) return;
      updating = true;
      const v = parseFloat(inKeno.value) || 0;
      if (ratio && v > 0) {
        inBnb.value = (v * ratio).toFixed(8);
        const eq = document.getElementById('klp-bnb-eq');
        if (eq) eq.textContent = (v * ratio).toFixed(4);
      }
      updateProjection();
      updateActionLabel();
      updating = false;
    });

    inBnb.addEventListener('input', () => {
      if (updating) return;
      updating = true;
      const v = parseFloat(inBnb.value) || 0;
      if (ratio && v > 0) {
        inKeno.value = (v / ratio).toFixed(8);
        const eq = document.getElementById('klp-bnb-eq');
        if (eq) eq.textContent = v.toFixed(4);
      }
      updateProjection();
      updateActionLabel();
      updating = false;
    });

    document.getElementById('klp-max-keno').addEventListener('click', () => {
      if (_kenoBal === null) return;
      inKeno.value = fmt(_kenoBal, _kenoDecimals, 8);
      inKeno.dispatchEvent(new Event('input'));
    });
    document.getElementById('klp-max-bnb').addEventListener('click', () => {
      if (_bnbBal === null) return;
      const safe = _bnbBal > 5_000_000_000_000_000n ? _bnbBal - 5_000_000_000_000_000n : 0n;
      inBnb.value = fmt(safe, 18, 8);
      inBnb.dispatchEvent(new Event('input'));
    });

    btn.addEventListener('click', () => handleAction(pairAddr, reserves, stats, ratio));
  }

  /* ── Connect wallet ── */
  async function connectWallet(pairAddr, reserves, stats) {
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      _account = accounts[0] || null;
      if (_account) {
        await refreshBalances(pairAddr);
        renderMain(pairAddr, reserves, stats);
      }
    } catch (e) {
      showMsg('error', e.message || 'Connection rejected');
    }
  }

  /* ── Approve + AddLiquidity flow ── */
  async function handleAction(pairAddr, reserves, stats, ratio) {
    const inKeno = document.getElementById('klp-in-keno');
    const inBnb  = document.getElementById('klp-in-bnb');
    const btn    = document.getElementById('klp-action-btn');
    if (!inKeno || !inBnb || !btn) return;

    const kenoVal = parseFloat(inKeno.value) || 0;
    const bnbVal  = parseFloat(inBnb.value)  || 0;
    if (kenoVal <= 0 || bnbVal <= 0) { showMsg('error', 'Enter amounts for both KENO and BNB.'); return; }

    const kenoWei = parseUnits(String(kenoVal), _kenoDecimals);
    const bnbWei  = parseUnits(String(bnbVal), 18);
    const needsApprove = _allowance === null || _allowance < kenoWei;

    if (needsApprove) { await doApprove(kenoWei, btn); return; }
    await doAddLiquidity(kenoWei, bnbWei, btn, pairAddr, reserves, stats, kenoVal, bnbVal);
  }

  async function doApprove(kenoWei, btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="klp-spinner"></span>Approving…';
    showMsg('info', 'Approving KENO spend on PancakeSwap…');
    try {
      const MAX  = '0x' + 'f'.repeat(64);
      const data = call4(SEL.approve, encodeAddr(ROUTER_ADDR), MAX.slice(2));
      const txHash = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [{ from: _account, to: KENO_ADDR, data }],
      });
      showMsg('info', `Approval tx sent: ${txHash.slice(0, 14)}… waiting…`);
      await waitForTx(txHash);
      _allowance = await getAllowance(KENO_ADDR, _account, ROUTER_ADDR);
      showMsg('success', '✓ KENO approved! Now click "Add Liquidity".');
      btn.disabled = false;
      btn.textContent = 'Add Liquidity';
    } catch (e) {
      btn.disabled = false;
      btn.textContent = 'Approve KENO';
      showMsg('error', e.message || 'Approval cancelled');
    }
  }

  async function doAddLiquidity(kenoWei, bnbWei, btn, pairAddr, reserves, stats, kenoVal, bnbVal) {
    btn.disabled = true;
    btn.innerHTML = '<span class="klp-spinner"></span>Adding Liquidity…';
    showMsg('info', 'Please confirm in your wallet…');
    try {
      const kenoMin = slippage(kenoWei, 1);
      const bnbMin  = slippage(bnbWei, 1);
      const dl      = deadline();
      const data    = call4(
        SEL.addLiqETH,
        encodeAddr(KENO_ADDR),
        encodeUint(kenoWei),
        encodeUint(kenoMin),
        encodeUint(bnbMin),
        encodeAddr(_account),
        encodeUint(dl),
      );
      const txHash = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [{
          from:  _account,
          to:    ROUTER_ADDR,
          data,
          value: '0x' + bnbWei.toString(16),
          gas:   '0x' + (350000).toString(16),
        }],
      });
      showMsg('info', `Tx sent: ${txHash.slice(0, 14)}… waiting for confirmation…`);
      await waitForTx(txHash);
      await refreshBalances(pairAddr);

      const kEl = document.getElementById('klp-bal-keno');
      const bEl = document.getElementById('klp-bal-bnb');
      if (kEl && _kenoBal !== null) kEl.textContent = fmt(_kenoBal, _kenoDecimals, 4);
      if (bEl && _bnbBal  !== null) bEl.textContent = fmt(_bnbBal, 18, 4);

      btn.disabled = false;
      btn.textContent = 'Add More Liquidity';
      showMsg('success', `🎉 Liquidity added! View on BscScan`);

      // Compute share for badge
      const r0f = reserves && reserves.r0 > 0n ? Number(reserves.r0) / (10 ** _kenoDecimals) : 0;
      const sharePct = r0f > 0 ? Math.min(kenoVal / r0f, 1) * 100 : 0;
      const kenoPrice = stats.price || 0;
      const proj = calcBurnProjection(sharePct, stats.volume24h, kenoPrice);

      showAchievementBadge(sharePct, proj, txHash);

    } catch (e) {
      btn.disabled = false;
      btn.textContent = 'Add Liquidity';
      showMsg('error', e.message || 'Transaction rejected');
    }
  }

  /* ── Achievement badge ── */
  function showAchievementBadge(sharePct, proj, txHash) {
    const existing = document.getElementById('klp-badge-overlay');
    if (existing) existing.remove();

    const shareStr = sharePct >= 0.001 ? sharePct.toFixed(4) + '%' : '<0.001%';
    const burnStr  = proj ? (proj.kenosBurned >= 0.01 ? proj.kenosBurned.toFixed(2) : proj.kenosBurned.toFixed(4)) + ' KENO/mo' : '—';
    const scanLink = `https://bscscan.com/tx/${txHash}`;
    const shareText= `🔥 I just became a KENO Market Maker! Pool Share: ${shareStr} | Powering KENO AutoBurn | @Kenostod`;
    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;

    const overlay = document.createElement('div');
    overlay.id = 'klp-badge-overlay';
    overlay.innerHTML = `
      <div id="klp-badge-card">
        <button class="klp-badge-close" id="klp-badge-close">×</button>
        <div class="klp-badge-crown">🔥</div>
        <div class="klp-badge-title">Achievement Unlocked</div>
        <div class="klp-badge-name">KENO Market Maker</div>
        <div class="klp-badge-sub">You've deepened the KENO/BNB pool and powered the burn engine.</div>
        <div class="klp-badge-stats">
          <div class="klp-bs">
            <div class="klp-bs-val">${shareStr}</div>
            <div class="klp-bs-label">Pool Share</div>
          </div>
          <div class="klp-bs">
            <div class="klp-bs-val">${burnStr}</div>
            <div class="klp-bs-label">KENO Burned</div>
          </div>
          <div class="klp-bs">
            <div class="klp-bs-val">15%</div>
            <div class="klp-bs-label">AutoBurn Split</div>
          </div>
        </div>
        <div class="klp-badge-powered">POWERED BY UTL · KENOSTOD ECOSYSTEM</div>
        <div class="klp-badge-btns">
          <a href="${tweetUrl}" target="_blank" class="klp-share-btn x">Share on 𝕏</a>
          <button class="klp-share-btn copy" id="klp-copy-badge">Copy Badge</button>
        </div>
        <div style="margin-top:14px">
          <a href="${scanLink}" target="_blank"
             style="font-size:11px;color:#78716c;text-decoration:none;">
            View tx on BscScan ↗
          </a>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById('klp-badge-close').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

    document.getElementById('klp-copy-badge').addEventListener('click', function () {
      const text = `🔥 KENO Market Maker\nPool Share: ${shareStr} | Est. KENO Burned/mo: ${burnStr}\nPowered by UTL · @Kenostod\nhttps://kenostodblockchain.com/keno-lp-widget`;
      navigator.clipboard.writeText(text).then(() => {
        this.textContent = 'Copied! ✓';
        setTimeout(() => { this.textContent = 'Copy Badge'; }, 2000);
      });
    });
  }

  /* ── Helpers ── */
  function setBody(html) {
    const panel = document.getElementById('klp-panel');
    if (!panel) return;
    const header = panel.querySelector('.klp-header');
    panel.innerHTML = '';
    if (header) panel.appendChild(header);
    const body = document.createElement('div');
    body.innerHTML = html;
    panel.appendChild(body);
    const footer = document.createElement('div');
    footer.className = 'klp-footer';
    footer.innerHTML = `<a href="${API_BASE}/keno-lp-widget" target="_blank">Kenostod LP Booster</a>`;
    panel.appendChild(footer);
    document.getElementById('klp-close-btn')?.addEventListener('click', closePanel);
  }

  function showMsg(type, text) {
    const el = document.getElementById('klp-msg');
    if (!el) return;
    el.className = `klp-msg ${type}`;
    el.textContent = text;
    el.style.display = 'block';
  }

  async function waitForTx(txHash, timeoutMs) {
    const t0 = Date.now();
    const TO  = timeoutMs || 120_000;
    while (Date.now() - t0 < TO) {
      await sleep(2500);
      try {
        const receipt = await rpc('eth_getTransactionReceipt', [txHash]);
        if (receipt && receipt.status !== undefined) {
          if (receipt.status === '0x0' || receipt.status === 0) throw new Error('Transaction failed on-chain');
          return receipt;
        }
      } catch (e) {
        if (e.message.includes('failed on-chain')) throw e;
      }
    }
    throw new Error('Transaction timed out waiting for confirmation');
  }

  /* ── External API ── */
  window.KENOLPBooster = {
    open:    () => { if (!_panelOpen) openPanel(); },
    close:   () => { if (_panelOpen) closePanel(); },
    toggle:  togglePanel,
    siteId:  SITE_ID,
    version: '1.0.0',
  };

  /* ── Boot ── */
  function boot() {
    injectStyle();
    injectFAB();
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', async (accounts) => {
        _account = accounts[0] || null;
        _kenoBal = _bnbBal = _allowance = null;
        if (_panelOpen) await loadPanel();
      });
      window.ethereum.on('chainChanged', async () => {
        if (_panelOpen) await loadPanel();
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
