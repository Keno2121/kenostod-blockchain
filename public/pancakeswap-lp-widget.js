/**
 * PancakeSwap LP Funder Widget — by Kenostod
 * Lets any web3 site's users add liquidity to a configurable PancakeSwap V2 pool
 * directly without leaving the host site.
 *
 * Default: KENO/BNB pool on BSC
 *
 * Embed:
 *   <script src="https://kenostodblockchain.com/pancakeswap-lp-widget.js"
 *           data-token="0x48bb049afe50b050b458624dc6233acd51024ab4"
 *           data-token-symbol="KENO"
 *           data-pair-name="KENO/BNB"
 *           data-site-id="YOUR_SITE_ID"></script>
 */
(function () {
  'use strict';

  /* ── Config from data attributes ── */
  const SCRIPT_TAG   = document.currentScript || (function () {
    const tags = document.querySelectorAll('script[data-site-id], script[src*="pancakeswap-lp-widget"]');
    return tags[tags.length - 1];
  })();

  const TOKEN0_ADDR   = (SCRIPT_TAG ? SCRIPT_TAG.getAttribute('data-token') : null)
                        || '0x48bb049afe50b050b458624dc6233acd51024ab4'; // KENO default
  const TOKEN0_SYMBOL = (SCRIPT_TAG ? SCRIPT_TAG.getAttribute('data-token-symbol') : null)
                        || 'KENO';
  const PAIR_NAME     = (SCRIPT_TAG ? SCRIPT_TAG.getAttribute('data-pair-name') : null)
                        || 'KENO/BNB';
  const SITE_ID       = (SCRIPT_TAG ? SCRIPT_TAG.getAttribute('data-site-id') : null)
                        || 'demo';
  const API_BASE      = (SCRIPT_TAG ? (SCRIPT_TAG.getAttribute('data-api-url') || 'https://kenostodblockchain.com') : 'https://kenostodblockchain.com');

  /* ── PancakeSwap V2 Constants (BSC) ── */
  const BSC_CHAIN_ID  = '0x38'; // 56
  const BSC_RPC       = 'https://bsc-dataseed.binance.org';
  const ROUTER_ADDR   = '0x10ED43C718714eb63d5aA57B78B54704E256024E';
  const FACTORY_ADDR  = '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73';
  const WBNB_ADDR     = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';

  /* Detect if token1 is native BNB (widget uses addLiquidityETH) */
  const IS_BNB_PAIR = TOKEN0_ADDR.toLowerCase() !== WBNB_ADDR.toLowerCase();
  // For ERC20/ERC20 pairs token1 would be supplied via data-token1 — default BNB pair
  const TOKEN1_SYMBOL = 'BNB';

  /* ── In-memory state ── */
  let _panelOpen      = false;
  let _account        = null;
  let _token0Decimals = null;
  let _reserveCache   = null;   // { r0, r1, ts }
  let _token0Balance  = null;
  let _bnbBalance     = null;
  let _allowance      = null;

  /* ═════════════════════════════════════════
   *  ABI encoding helpers (no ethers needed)
   * ═════════════════════════════════════════ */

  function hexPad(val, bytes) {
    // val can be BigInt, number, or hex string
    let h = typeof val === 'bigint'
      ? val.toString(16)
      : typeof val === 'number'
      ? val.toString(16)
      : val.replace(/^0x/i, '');
    return h.padStart(bytes * 2, '0');
  }

  function encodeAddress(addr) {
    return hexPad(addr.replace(/^0x/i, ''), 32);
  }

  function encodeUint256(val) {
    return hexPad(BigInt(val), 32);
  }

  function encodeFnCall(selector, ...params) {
    return '0x' + selector + params.join('');
  }

  /* ── Function selectors (keccak4 pre-computed) ── */
  const SEL = {
    balanceOf:    '70a08231',
    decimals:     '313ce567',
    allowance:    'dd62ed3e',
    approve:      '095ea7b3',
    getReserves:  '0902f1ac',
    getPair:      'e6a43905',
    addLiqETH:    'f305d719',
    addLiq:       'e8e33700',
  };

  /* ── RPC call helper ── */
  async function rpcCall(method, params) {
    const r = await fetch(BSC_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    });
    const j = await r.json();
    if (j.error) throw new Error(j.error.message || JSON.stringify(j.error));
    return j.result;
  }

  async function ethCall(to, data) {
    return rpcCall('eth_call', [{ to, data }, 'latest']);
  }

  /* ── Decode uint256 from 32-byte hex result ── */
  function decodeUint(hex) {
    if (!hex || hex === '0x') return 0n;
    return BigInt(hex.slice(0, 66));
  }

  /* ── On-chain reads ── */

  async function getDecimals(token) {
    const res = await ethCall(token, '0x' + SEL.decimals);
    return Number(decodeUint(res));
  }

  async function getBalance(token, addr) {
    const data = encodeFnCall(SEL.balanceOf, encodeAddress(addr));
    const res  = await ethCall(token, data);
    return decodeUint(res);
  }

  async function getBNBBalance(addr) {
    const res = await rpcCall('eth_getBalance', [addr, 'latest']);
    return BigInt(res);
  }

  async function getAllowance(token, owner, spender) {
    const data = encodeFnCall(SEL.allowance, encodeAddress(owner), encodeAddress(spender));
    const res  = await ethCall(token, data);
    return decodeUint(res);
  }

  async function getPairAddress() {
    const data = encodeFnCall(SEL.getPair, encodeAddress(TOKEN0_ADDR), encodeAddress(WBNB_ADDR));
    const res  = await ethCall(FACTORY_ADDR, data);
    if (!res || res === '0x' || res === '0x' + '0'.repeat(64)) return null;
    return '0x' + res.slice(26); // last 20 bytes = address
  }

  async function getReserves(pairAddr) {
    const now = Date.now();
    if (_reserveCache && now - _reserveCache.ts < 30_000) return _reserveCache;

    const res = await ethCall(pairAddr, '0x' + SEL.getReserves);
    if (!res || res === '0x') return null;

    // getReserves returns (uint112 r0, uint112 r1, uint32 ts) packed
    const r0 = BigInt('0x' + res.slice(2, 66));
    const r1 = BigInt('0x' + res.slice(66, 130));

    _reserveCache = { r0, r1, ts: now };
    return _reserveCache;
  }

  /* ── Format helpers ── */

  function fmt(bigint, decimals, displayDecimals) {
    if (!decimals) decimals = 18;
    const d = displayDecimals ?? 4;
    const unit = 10n ** BigInt(decimals);
    const whole = bigint / unit;
    const frac  = bigint % unit;
    const fracStr = frac.toString().padStart(decimals, '0').slice(0, d);
    return `${whole}.${fracStr}`;
  }

  function parseUnits(val, decimals) {
    if (!val || isNaN(parseFloat(val))) return 0n;
    const [whole, frac = ''] = String(parseFloat(val).toFixed(decimals)).split('.');
    const fracPadded = frac.padEnd(decimals, '0').slice(0, decimals);
    return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fracPadded);
  }

  function slippage(amount, pct) {
    // pct = 1 → 1% slippage → min = amount * 99 / 100
    return (amount * BigInt(100 - pct)) / 100n;
  }

  /* ── Deadline: 20 minutes from now ── */
  function deadline() {
    return Math.floor(Date.now() / 1000) + 1200;
  }

  /* ═════════════════════════════════════
   *  CSS
   * ═════════════════════════════════════ */

  const STYLE = `
    #lp-widget-fab {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 2147483646;
      display: flex;
      align-items: center;
      gap: 9px;
      padding: 13px 20px;
      background: linear-gradient(135deg, #0070f3, #00b4d8);
      border: none;
      border-radius: 50px;
      color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 4px 24px rgba(0,112,243,0.45);
      transition: transform 0.15s, box-shadow 0.15s;
      letter-spacing: 0.02em;
    }
    #lp-widget-fab:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 32px rgba(0,112,243,0.55);
    }
    #lp-widget-fab:active { transform: translateY(0); }

    #lp-widget-panel {
      position: fixed;
      bottom: 86px;
      right: 24px;
      z-index: 2147483647;
      width: 360px;
      background: linear-gradient(160deg, #080d1a 0%, #0d1529 100%);
      border: 1px solid rgba(0,180,216,0.25);
      border-radius: 20px;
      box-shadow: 0 16px 64px rgba(0,0,0,0.7), 0 0 0 1px rgba(0,180,216,0.1);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      overflow: hidden;
      animation: lp-slide-up 0.28s cubic-bezier(0.34,1.56,0.64,1);
    }
    #lp-widget-panel.lp-closing {
      animation: lp-slide-down 0.22s ease-in forwards;
    }
    @keyframes lp-slide-up {
      from { transform: translateY(24px); opacity: 0; }
      to   { transform: translateY(0);   opacity: 1; }
    }
    @keyframes lp-slide-down {
      from { transform: translateY(0);   opacity: 1; }
      to   { transform: translateY(24px); opacity: 0; }
    }

    .lp-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 18px 20px 14px;
      border-bottom: 1px solid rgba(0,180,216,0.12);
    }
    .lp-header-left {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .lp-header-icon {
      width: 36px; height: 36px;
      background: linear-gradient(135deg, #0070f3, #00b4d8);
      border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      font-size: 18px;
    }
    .lp-header-title {
      font-size: 15px; font-weight: 700; color: #e5e7eb;
    }
    .lp-header-sub {
      font-size: 11px; color: #6b7280; margin-top: 2px;
    }
    .lp-close {
      background: none; border: none; color: #6b7280;
      font-size: 20px; cursor: pointer; padding: 4px;
      line-height: 1; transition: color 0.15s; border-radius: 6px;
    }
    .lp-close:hover { color: #e5e7eb; background: rgba(255,255,255,0.06); }

    .lp-pool-stats {
      display: flex;
      gap: 0;
      border-bottom: 1px solid rgba(0,180,216,0.12);
    }
    .lp-stat {
      flex: 1;
      text-align: center;
      padding: 12px 8px;
    }
    .lp-stat:not(:last-child) {
      border-right: 1px solid rgba(0,180,216,0.12);
    }
    .lp-stat-val {
      font-size: 14px; font-weight: 700;
      color: #38bdf8;
    }
    .lp-stat-label {
      font-size: 10px; color: #6b7280; margin-top: 2px;
      text-transform: uppercase; letter-spacing: 0.05em;
    }

    .lp-body { padding: 18px 20px; }

    .lp-balances {
      display: flex; gap: 10px; margin-bottom: 16px;
    }
    .lp-bal-chip {
      flex: 1;
      background: rgba(0,180,216,0.06);
      border: 1px solid rgba(0,180,216,0.15);
      border-radius: 10px;
      padding: 10px 12px;
      font-size: 12px;
      color: #9ca3af;
    }
    .lp-bal-chip b {
      display: block;
      font-size: 14px;
      color: #e5e7eb;
      margin-top: 2px;
      font-weight: 700;
    }

    .lp-input-row {
      margin-bottom: 10px;
    }
    .lp-input-label {
      font-size: 11px; font-weight: 600; color: #6b7280;
      text-transform: uppercase; letter-spacing: 0.05em;
      margin-bottom: 5px; display: flex; justify-content: space-between;
    }
    .lp-input-label span { color: #38bdf8; cursor: pointer; font-weight: 600; }
    .lp-input-label span:hover { color: #7dd3fc; }
    .lp-input {
      width: 100%; padding: 11px 14px;
      background: rgba(0,0,0,0.3);
      border: 1px solid rgba(0,180,216,0.2);
      border-radius: 10px;
      color: #e5e7eb; font-size: 15px;
      outline: none; transition: border-color 0.15s, box-shadow 0.15s;
      box-sizing: border-box;
    }
    .lp-input:focus {
      border-color: rgba(0,180,216,0.5);
      box-shadow: 0 0 0 3px rgba(0,180,216,0.1);
    }
    .lp-input::placeholder { color: #374151; }

    .lp-ratio-hint {
      font-size: 11px; color: #6b7280;
      text-align: center; margin: 4px 0 14px;
    }

    .lp-lp-estimate {
      background: rgba(56,189,248,0.07);
      border: 1px solid rgba(56,189,248,0.18);
      border-radius: 10px;
      padding: 11px 14px;
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 14px;
    }
    .lp-lp-estimate-label { font-size: 12px; color: #6b7280; }
    .lp-lp-estimate-val   { font-size: 14px; font-weight: 700; color: #38bdf8; }

    .lp-action-btn {
      width: 100%; padding: 13px;
      background: linear-gradient(135deg, #0070f3, #00b4d8);
      border: none; border-radius: 12px; color: #fff;
      font-size: 15px; font-weight: 700; cursor: pointer;
      transition: opacity 0.15s, transform 0.1s;
      letter-spacing: 0.02em;
    }
    .lp-action-btn:hover:not(:disabled) {
      opacity: 0.88; transform: translateY(-1px);
    }
    .lp-action-btn:active:not(:disabled) { transform: translateY(0); }
    .lp-action-btn:disabled {
      opacity: 0.38; cursor: not-allowed; transform: none;
    }

    .lp-msg {
      margin-top: 10px; padding: 11px 14px;
      border-radius: 10px; font-size: 13px;
      display: none;
    }
    .lp-msg.success {
      background: rgba(52,211,153,0.1);
      border: 1px solid rgba(52,211,153,0.3);
      color: #34d399; display: block;
    }
    .lp-msg.error {
      background: rgba(248,113,113,0.08);
      border: 1px solid rgba(248,113,113,0.3);
      color: #f87171; display: block;
    }
    .lp-msg.info {
      background: rgba(56,189,248,0.08);
      border: 1px solid rgba(56,189,248,0.2);
      color: #7dd3fc; display: block;
    }

    .lp-footer {
      padding: 10px 20px 14px;
      text-align: center;
      font-size: 11px; color: #374151;
    }
    .lp-footer a {
      color: #4b5563; text-decoration: none;
    }
    .lp-footer a:hover { color: #38bdf8; }

    .lp-connect-view {
      padding: 28px 20px;
      text-align: center;
    }
    .lp-connect-icon { font-size: 36px; margin-bottom: 12px; }
    .lp-connect-msg {
      font-size: 14px; color: #9ca3af; margin-bottom: 18px; line-height: 1.5;
    }
    .lp-no-pool {
      padding: 24px 20px;
      text-align: center;
      font-size: 13px;
      color: #f59e0b;
    }
    .lp-spinner {
      display: inline-block;
      width: 16px; height: 16px;
      border: 2px solid rgba(255,255,255,0.2);
      border-top-color: #fff;
      border-radius: 50%;
      animation: lp-spin 0.7s linear infinite;
      vertical-align: middle; margin-right: 6px;
    }
    @keyframes lp-spin { to { transform: rotate(360deg); } }
  `;

  /* ═════════════════════════════════════
   *  Inject CSS + FAB
   * ═════════════════════════════════════ */

  function injectBase() {
    if (document.getElementById('lp-widget-style')) return;

    const style = document.createElement('style');
    style.id = 'lp-widget-style';
    style.textContent = STYLE;
    document.head.appendChild(style);

    const fab = document.createElement('button');
    fab.id = 'lp-widget-fab';
    fab.innerHTML = '💧 Add Liquidity';
    fab.addEventListener('click', togglePanel);
    document.body.appendChild(fab);
  }

  /* ═════════════════════════════════════
   *  Panel lifecycle
   * ═════════════════════════════════════ */

  function togglePanel() {
    if (_panelOpen) {
      closePanel();
    } else {
      openPanel();
    }
  }

  function closePanel() {
    const panel = document.getElementById('lp-widget-panel');
    if (!panel) return;
    _panelOpen = false;
    panel.classList.add('lp-closing');
    setTimeout(() => panel.remove(), 230);
  }

  async function openPanel() {
    _panelOpen = true;
    renderLoadingPanel();
    await loadPanel();
  }

  function renderLoadingPanel() {
    let panel = document.getElementById('lp-widget-panel');
    if (panel) panel.remove();

    panel = document.createElement('div');
    panel.id = 'lp-widget-panel';
    panel.innerHTML = `
      <div class="lp-header">
        <div class="lp-header-left">
          <div class="lp-header-icon">💧</div>
          <div>
            <div class="lp-header-title">${PAIR_NAME} Pool</div>
            <div class="lp-header-sub">PancakeSwap V2 · BSC</div>
          </div>
        </div>
        <button class="lp-close" id="lp-close-btn">×</button>
      </div>
      <div style="padding:40px 20px;text-align:center">
        <span class="lp-spinner"></span>
        <span style="color:#6b7280;font-size:13px">Loading pool data…</span>
      </div>
    `;
    document.body.appendChild(panel);
    document.getElementById('lp-close-btn').addEventListener('click', closePanel);
  }

  async function loadPanel() {
    try {
      /* 1. Check BSC chain */
      const chainId = await window.ethereum?.request({ method: 'eth_chainId' }).catch(() => null);
      if (!window.ethereum) {
        renderNoWalletPanel();
        return;
      }
      if (chainId !== BSC_CHAIN_ID) {
        renderWrongChainPanel(chainId);
        return;
      }

      /* 2. Get account */
      const accounts = await window.ethereum.request({ method: 'eth_accounts' }).catch(() => []);
      _account = accounts[0] || null;

      /* 3. Fetch pool data */
      const pairAddr = await getPairAddress();
      if (!pairAddr) {
        renderNoPoolPanel();
        return;
      }

      /* 4. Get decimals (cache) */
      if (!_token0Decimals) {
        _token0Decimals = await getDecimals(TOKEN0_ADDR);
      }

      /* 5. Get reserves */
      const reserves = await getReserves(pairAddr);

      /* 6. Pool stats from API (TVL etc) - fire and forget, update if it lands */
      fetchPoolStats(pairAddr);

      /* 7. Balances if connected */
      if (_account) {
        await refreshBalances();
      }

      renderMainPanel(pairAddr, reserves);

    } catch (e) {
      renderErrorPanel(e.message);
    }
  }

  async function refreshBalances() {
    if (!_account) return;
    try {
      [_token0Balance, _bnbBalance, _allowance] = await Promise.all([
        getBalance(TOKEN0_ADDR, _account),
        getBNBBalance(_account),
        getAllowance(TOKEN0_ADDR, _account, ROUTER_ADDR),
      ]);
    } catch (_) {}
  }

  /* ── Pool stats cache (populated by API) ── */
  let _tvl   = null;
  let _price = null;

  async function fetchPoolStats() {
    try {
      const r = await fetch(`${API_BASE}/api/lp-widget/pool-stats?pair=${encodeURIComponent(PAIR_NAME)}&token=${TOKEN0_ADDR}`);
      const d = await r.json();
      if (d.ok) {
        _tvl   = d.tvl   || null;
        _price = d.price || null;
        // Refresh price display if panel open
        const tvlEl = document.getElementById('lp-stat-tvl');
        const priceEl = document.getElementById('lp-stat-price');
        if (tvlEl && _tvl)   tvlEl.textContent   = '$' + Number(_tvl).toLocaleString(undefined, { maximumFractionDigits: 0 });
        if (priceEl && _price) priceEl.textContent = '$' + Number(_price).toFixed(4);
      }
    } catch (_) {}
  }

  /* ═════════════════════════════════════
   *  Panel renders
   * ═════════════════════════════════════ */

  function renderNoWalletPanel() {
    setBody(`
      <div class="lp-connect-view">
        <div class="lp-connect-icon">🦊</div>
        <div class="lp-connect-msg">No Web3 wallet detected.<br/>Install MetaMask to add liquidity.</div>
        <a href="https://metamask.io/download/" target="_blank" style="
          display:inline-block;padding:11px 24px;background:linear-gradient(135deg,#f6851b,#e2761b);
          border-radius:10px;color:#fff;font-weight:700;font-size:14px;text-decoration:none">
          Get MetaMask →
        </a>
      </div>
    `);
  }

  function renderWrongChainPanel() {
    setBody(`
      <div class="lp-connect-view">
        <div class="lp-connect-icon">⛓️</div>
        <div class="lp-connect-msg">Wrong network detected.<br/>Please switch to <b style="color:#f59e0b">BNB Smart Chain</b> to continue.</div>
        <button class="lp-action-btn" style="max-width:220px;margin:0 auto;display:block" id="lp-switch-chain">
          Switch to BSC
        </button>
      </div>
    `);
    document.getElementById('lp-switch-chain').addEventListener('click', async () => {
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: BSC_CHAIN_ID }],
        });
        await loadPanel();
      } catch (e) {
        if (e.code === 4902) {
          try {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: BSC_CHAIN_ID,
                chainName: 'BNB Smart Chain',
                nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
                rpcUrls: ['https://bsc-dataseed.binance.org'],
                blockExplorerUrls: ['https://bscscan.com'],
              }],
            });
            await loadPanel();
          } catch (_) {}
        }
      }
    });
  }

  function renderNoPoolPanel() {
    setBody(`
      <div class="lp-no-pool">
        ⚠️ Pool not found on PancakeSwap V2.<br/>
        <span style="color:#6b7280;font-size:12px;margin-top:6px;display:block">
          ${PAIR_NAME} pair does not exist yet.
        </span>
      </div>
    `);
  }

  function renderErrorPanel(msg) {
    setBody(`
      <div class="lp-no-pool" style="color:#f87171">
        ❌ Error loading pool<br/>
        <span style="color:#6b7280;font-size:12px;margin-top:6px;display:block">${msg}</span>
      </div>
    `);
  }

  function renderMainPanel(pairAddr, reserves) {
    const panel = document.getElementById('lp-widget-panel');
    if (!panel) return;

    /* Compute ratio: how much BNB per 1 TOKEN0 */
    const ratio = reserves && reserves.r0 > 0n
      ? Number(reserves.r1) / Number(reserves.r0) * (10 ** (_token0Decimals - 18))
      : null;

    const t0Bal = _token0Balance !== null
      ? fmt(_token0Balance, _token0Decimals, 4)
      : '—';
    const bnbBal = _bnbBalance !== null
      ? fmt(_bnbBalance, 18, 4)
      : '—';

    const tvlText   = _tvl   ? '$' + Number(_tvl).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—';
    const priceText = _price ? '$' + Number(_price).toFixed(4) : (ratio ? (ratio * /* BNB price ~$600 assumed */ 600).toFixed(4) + '≈' : '—');

    const notConnected = !_account;

    panel.innerHTML = `
      <div class="lp-header">
        <div class="lp-header-left">
          <div class="lp-header-icon">💧</div>
          <div>
            <div class="lp-header-title">${PAIR_NAME} Pool</div>
            <div class="lp-header-sub">PancakeSwap V2 · BSC</div>
          </div>
        </div>
        <button class="lp-close" id="lp-close-btn">×</button>
      </div>

      <div class="lp-pool-stats">
        <div class="lp-stat">
          <div class="lp-stat-val" id="lp-stat-tvl">${tvlText}</div>
          <div class="lp-stat-label">TVL</div>
        </div>
        <div class="lp-stat">
          <div class="lp-stat-val" id="lp-stat-price">${priceText}</div>
          <div class="lp-stat-label">${TOKEN0_SYMBOL} Price</div>
        </div>
        <div class="lp-stat">
          <div class="lp-stat-val">${ratio ? ratio.toFixed(6) : '—'}</div>
          <div class="lp-stat-label">BNB per ${TOKEN0_SYMBOL}</div>
        </div>
      </div>

      <div class="lp-body">
        ${notConnected ? `
          <div style="text-align:center;margin-bottom:16px">
            <div style="font-size:13px;color:#6b7280;margin-bottom:12px">Connect wallet to add liquidity</div>
            <button class="lp-action-btn" id="lp-connect-btn">🔗 Connect Wallet</button>
          </div>
        ` : `
          <div class="lp-balances">
            <div class="lp-bal-chip">
              ${TOKEN0_SYMBOL}<b id="lp-bal-t0">${t0Bal}</b>
            </div>
            <div class="lp-bal-chip">
              BNB<b id="lp-bal-bnb">${bnbBal}</b>
            </div>
          </div>

          <div class="lp-input-row">
            <div class="lp-input-label">
              ${TOKEN0_SYMBOL} Amount
              <span id="lp-max-t0">MAX</span>
            </div>
            <input class="lp-input" type="number" id="lp-in-t0" placeholder="0.0" min="0" step="any"/>
          </div>

          <div class="lp-ratio-hint" id="lp-ratio-hint">
            ${ratio ? `= <span id="lp-bnb-equiv">0.0000</span> BNB at current pool ratio` : 'Pool ratio loading…'}
          </div>

          <div class="lp-input-row">
            <div class="lp-input-label">
              BNB Amount
              <span id="lp-max-bnb">MAX</span>
            </div>
            <input class="lp-input" type="number" id="lp-in-bnb" placeholder="0.0" min="0" step="any"/>
          </div>

          <div class="lp-lp-estimate">
            <div class="lp-lp-estimate-label">Estimated LP tokens</div>
            <div class="lp-lp-estimate-val" id="lp-est-lp">—</div>
          </div>

          <button class="lp-action-btn" id="lp-action-btn">
            ${_allowance === null || _allowance === 0n ? `Approve ${TOKEN0_SYMBOL}` : 'Add Liquidity'}
          </button>
          <div class="lp-msg" id="lp-msg"></div>
        `}
      </div>

      <div class="lp-footer">
        Powered by <a href="https://kenostodblockchain.com/lp-widget" target="_blank">Kenostod LP Widget</a>
        · <a href="https://pancakeswap.finance/add/${TOKEN0_ADDR}/${WBNB_ADDR}" target="_blank">Open on PancakeSwap ↗</a>
      </div>
    `;

    document.getElementById('lp-close-btn').addEventListener('click', closePanel);

    if (notConnected) {
      document.getElementById('lp-connect-btn').addEventListener('click', connectWallet);
      return;
    }

    /* Wire up inputs */
    const inT0  = document.getElementById('lp-in-t0');
    const inBnb = document.getElementById('lp-in-bnb');
    const actionBtn = document.getElementById('lp-action-btn');

    /* Ratio-based auto-fill */
    let updating = false;
    inT0.addEventListener('input', () => {
      if (updating) return;
      updating = true;
      const v = parseFloat(inT0.value) || 0;
      if (ratio && v > 0) {
        inBnb.value = (v * ratio).toFixed(8);
      }
      updateEstimate(ratio);
      updateActionLabel();
      updating = false;
    });

    inBnb.addEventListener('input', () => {
      if (updating) return;
      updating = true;
      const v = parseFloat(inBnb.value) || 0;
      if (ratio && v > 0) {
        inT0.value = (v / ratio).toFixed(8);
      }
      updateEstimate(ratio);
      updateActionLabel();
      updating = false;
    });

    /* MAX buttons */
    document.getElementById('lp-max-t0').addEventListener('click', () => {
      if (_token0Balance === null) return;
      inT0.value = fmt(_token0Balance, _token0Decimals, 8);
      inT0.dispatchEvent(new Event('input'));
    });
    document.getElementById('lp-max-bnb').addEventListener('click', () => {
      if (_bnbBalance === null) return;
      // Leave 0.005 BNB for gas
      const safe = _bnbBalance > 5_000_000_000_000_000n
        ? _bnbBalance - 5_000_000_000_000_000n
        : 0n;
      inBnb.value = fmt(safe, 18, 8);
      inBnb.dispatchEvent(new Event('input'));
    });

    /* Action button */
    actionBtn.addEventListener('click', () => handleAction(pairAddr, reserves));

    function updateEstimate(ratio) {
      const t0v   = parseFloat(inT0.value) || 0;
      const bnbv  = parseFloat(inBnb.value) || 0;
      const lpEl  = document.getElementById('lp-est-lp');
      if (!lpEl) return;
      if (t0v > 0 && ratio && reserves) {
        // LP estimate: min(t0/r0, bnb/r1) * totalSupply — we approximate from reserves
        const r0f = Number(reserves.r0) / (10 ** _token0Decimals);
        const r1f = Number(reserves.r1) / 1e18;
        const share = Math.min(t0v / r0f, bnbv / r1f);
        lpEl.textContent = (share * 100).toFixed(6) + '% pool share';
      } else {
        lpEl.textContent = '—';
      }
    }

    function updateActionLabel() {
      if (!actionBtn) return;
      const needsApprove = _allowance !== null && _allowance === 0n;
      const t0v = parseFloat(inT0.value) || 0;
      const t0Wei = parseUnits(String(t0v), _token0Decimals);
      const stillNeedsApprove = t0Wei > 0n && (_allowance === null || _allowance < t0Wei);
      actionBtn.textContent = stillNeedsApprove
        ? `Approve ${TOKEN0_SYMBOL}`
        : 'Add Liquidity';
    }
  }

  /* ═════════════════════════════════════
   *  Connect wallet
   * ═════════════════════════════════════ */

  async function connectWallet() {
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      _account = accounts[0] || null;
      if (_account) {
        await refreshBalances();
        const pairAddr = await getPairAddress();
        const reserves = pairAddr ? await getReserves(pairAddr) : null;
        if (!pairAddr || !reserves) { renderNoPoolPanel(); return; }
        renderMainPanel(pairAddr, reserves);
      }
    } catch (e) {
      showMsg('error', e.message || 'Connection rejected');
    }
  }

  /* ═════════════════════════════════════
   *  Approve + Add Liquidity flow
   * ═════════════════════════════════════ */

  async function handleAction(pairAddr, reserves) {
    const inT0  = document.getElementById('lp-in-t0');
    const inBnb = document.getElementById('lp-in-bnb');
    const btn   = document.getElementById('lp-action-btn');
    if (!inT0 || !inBnb || !btn) return;

    const t0Val  = parseFloat(inT0.value)  || 0;
    const bnbVal = parseFloat(inBnb.value) || 0;

    if (t0Val <= 0 || bnbVal <= 0) {
      showMsg('error', 'Enter amounts for both tokens.');
      return;
    }

    const t0Wei  = parseUnits(String(t0Val),  _token0Decimals);
    const bnbWei = parseUnits(String(bnbVal), 18);

    /* Check if approval needed */
    const needsApprove = _allowance === null || _allowance < t0Wei;

    if (needsApprove) {
      await doApprove(t0Wei, btn);
      return;
    }

    await doAddLiquidity(t0Wei, bnbWei, btn);
  }

  async function doApprove(t0Wei, btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="lp-spinner"></span>Approving…';
    showMsg('info', `Approving ${TOKEN0_SYMBOL} spend…`);

    try {
      /* Approve max uint256 for smooth UX */
      const MAX = '0x' + 'f'.repeat(64);
      const data = encodeFnCall(SEL.approve, encodeAddress(ROUTER_ADDR), MAX.slice(2));

      const txHash = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [{
          from: _account,
          to:   TOKEN0_ADDR,
          data,
        }],
      });

      showMsg('info', `Approval tx sent: ${txHash.slice(0, 14)}… waiting for confirmation`);
      await waitForTx(txHash);

      /* Refresh allowance */
      _allowance = await getAllowance(TOKEN0_ADDR, _account, ROUTER_ADDR);
      showMsg('success', `✓ ${TOKEN0_SYMBOL} approved! Now click "Add Liquidity".`);
      btn.disabled = false;
      btn.textContent = 'Add Liquidity';

    } catch (e) {
      btn.disabled = false;
      btn.textContent = `Approve ${TOKEN0_SYMBOL}`;
      showMsg('error', e.message || 'Approval cancelled');
    }
  }

  async function doAddLiquidity(t0Wei, bnbWei, btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="lp-spinner"></span>Adding Liquidity…';
    showMsg('info', 'Please confirm in your wallet…');

    try {
      const t0Min  = slippage(t0Wei, 1);  // 1% slippage
      const bnbMin = slippage(bnbWei, 1);
      const dl     = deadline();

      let txHash;

      if (IS_BNB_PAIR) {
        // addLiquidityETH(token, amountTokenDesired, amountTokenMin, amountETHMin, to, deadline)
        const data = encodeFnCall(
          SEL.addLiqETH,
          encodeAddress(TOKEN0_ADDR),
          encodeUint256(t0Wei),
          encodeUint256(t0Min),
          encodeUint256(bnbMin),
          encodeAddress(_account),
          encodeUint256(dl),
        );

        txHash = await window.ethereum.request({
          method: 'eth_sendTransaction',
          params: [{
            from:  _account,
            to:    ROUTER_ADDR,
            data,
            value: '0x' + bnbWei.toString(16),
            gas:   '0x' + (350000).toString(16),
          }],
        });
      } else {
        // ERC20/ERC20 (not default, but here for completeness)
        // addLiquidity(tokenA,tokenB,amtADesired,amtBDesired,amtAMin,amtBMin,to,deadline)
        showMsg('error', 'ERC20/ERC20 pairs not yet supported — use BNB pair');
        btn.disabled = false;
        btn.textContent = 'Add Liquidity';
        return;
      }

      showMsg('info', `Tx sent: ${txHash.slice(0, 14)}… waiting for confirmation`);
      await waitForTx(txHash);

      /* Refresh balances */
      await refreshBalances();

      showMsg('success', `🎉 Liquidity added! View on BscScan: bscscan.com/tx/${txHash.slice(0, 18)}…`);
      btn.disabled = false;
      btn.textContent = 'Add More Liquidity';

      /* Update balance display */
      const t0El  = document.getElementById('lp-bal-t0');
      const bnbEl = document.getElementById('lp-bal-bnb');
      if (t0El && _token0Balance !== null)  t0El.textContent = fmt(_token0Balance, _token0Decimals, 4);
      if (bnbEl && _bnbBalance !== null)    bnbEl.textContent = fmt(_bnbBalance, 18, 4);

    } catch (e) {
      btn.disabled = false;
      btn.textContent = 'Add Liquidity';
      showMsg('error', e.message || 'Transaction rejected');
    }
  }

  /* ── Poll for tx receipt ── */
  async function waitForTx(txHash, timeoutMs) {
    const t0 = Date.now();
    const TO  = timeoutMs || 120_000;
    while (Date.now() - t0 < TO) {
      await sleep(2500);
      try {
        const receipt = await rpcCall('eth_getTransactionReceipt', [txHash]);
        if (receipt && receipt.status !== undefined) {
          if (receipt.status === '0x0' || receipt.status === 0) {
            throw new Error('Transaction failed on-chain');
          }
          return receipt;
        }
      } catch (e) {
        if (e.message.includes('failed on-chain')) throw e;
      }
    }
    throw new Error('Transaction timed out waiting for confirmation');
  }

  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  /* ── Helpers ── */

  function setBody(html) {
    const panel = document.getElementById('lp-widget-panel');
    if (!panel) return;
    // Keep header, replace body
    const header = panel.querySelector('.lp-header');
    panel.innerHTML = '';
    if (header) panel.appendChild(header);
    const body = document.createElement('div');
    body.innerHTML = html;
    panel.appendChild(body);
    const footer = document.createElement('div');
    footer.className = 'lp-footer';
    footer.innerHTML = `Powered by <a href="https://kenostodblockchain.com/lp-widget" target="_blank">Kenostod LP Widget</a>`;
    panel.appendChild(footer);
    document.getElementById('lp-close-btn')?.addEventListener('click', closePanel);
  }

  function showMsg(type, text) {
    const el = document.getElementById('lp-msg');
    if (!el) return;
    el.className = `lp-msg ${type}`;
    el.textContent = text;
    el.style.display = 'block';
  }

  /* ═════════════════════════════════════
   *  External API
   * ═════════════════════════════════════ */

  window.LPWidget = {
    open:  () => { if (!_panelOpen) openPanel(); },
    close: () => { if (_panelOpen) closePanel(); },
    toggle: togglePanel,
    siteId: SITE_ID,
    pairName: PAIR_NAME,
    version: '1.0.0',
  };

  /* ── Boot ── */
  function boot() {
    injectBase();
    // Listen for account changes
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', async (accounts) => {
        _account = accounts[0] || null;
        _token0Balance = null;
        _bnbBalance = null;
        _allowance  = null;
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
