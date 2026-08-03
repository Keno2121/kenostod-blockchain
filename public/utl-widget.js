/**
 * UTL Reversal Widget — by Kenostod
 * Gives any web3 app a 5-minute "undo" window on every transaction.
 * Free tier: 1 undo/day per site.  Paid: 25 KENO/month, unlimited.
 *
 * Embed:
 *   <script src="https://kenostodblockchain.com/utl-widget.js"
 *           data-site-id="YOUR_SITE_ID"></script>
 */
(function () {
  'use strict';

  /* ── Config ── */
  const SCRIPT_TAG  = document.currentScript || (function () {
    const tags = document.querySelectorAll('script[data-site-id]');
    return tags[tags.length - 1];
  })();
  const SITE_ID     = SCRIPT_TAG ? SCRIPT_TAG.getAttribute('data-site-id') : 'demo';
  const API_BASE    = SCRIPT_TAG ? (SCRIPT_TAG.getAttribute('data-api-url') || 'https://kenostodblockchain.com') : 'https://kenostodblockchain.com';
  const WINDOW_SECS = 300; // 5 minutes

  /* ── State ── */
  const activeToasts = new Map(); // txHash → { toast, interval }

  /* ── Styles ── */
  const STYLE = `
    #utl-widget-container {
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 2147483647;
      display: flex;
      flex-direction: column;
      gap: 10px;
      pointer-events: none;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    .utl-toast {
      background: linear-gradient(135deg, #0f1117 0%, #1a1f2e 100%);
      border: 1px solid rgba(139, 92, 246, 0.4);
      border-radius: 14px;
      padding: 14px 16px;
      width: 300px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(139,92,246,0.1);
      pointer-events: all;
      animation: utl-slide-in 0.3s cubic-bezier(0.34,1.56,0.64,1);
      position: relative;
      overflow: hidden;
    }
    .utl-toast.utl-closing {
      animation: utl-slide-out 0.25s ease-in forwards;
    }
    @keyframes utl-slide-in {
      from { transform: translateX(120%); opacity: 0; }
      to   { transform: translateX(0);   opacity: 1; }
    }
    @keyframes utl-slide-out {
      from { transform: translateX(0);   opacity: 1; }
      to   { transform: translateX(120%); opacity: 0; }
    }
    .utl-toast-bar {
      position: absolute;
      bottom: 0; left: 0;
      height: 3px;
      background: linear-gradient(90deg, #8b5cf6, #6366f1);
      border-radius: 0 0 0 14px;
      transition: width 1s linear;
    }
    .utl-toast-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
    }
    .utl-toast-title {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      font-weight: 600;
      color: #a78bfa;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .utl-toast-title svg {
      flex-shrink: 0;
    }
    .utl-toast-close {
      background: none;
      border: none;
      color: #6b7280;
      cursor: pointer;
      padding: 2px;
      line-height: 1;
      font-size: 16px;
      transition: color 0.15s;
    }
    .utl-toast-close:hover { color: #d1d5db; }
    .utl-toast-tx {
      font-size: 11px;
      color: #6b7280;
      margin-bottom: 10px;
      font-family: 'Courier New', monospace;
    }
    .utl-toast-countdown {
      font-size: 13px;
      color: #e5e7eb;
      margin-bottom: 12px;
    }
    .utl-toast-countdown span {
      font-weight: 700;
      color: #a78bfa;
      font-variant-numeric: tabular-nums;
    }
    .utl-toast-btn {
      width: 100%;
      padding: 9px;
      background: linear-gradient(135deg, #7c3aed, #6366f1);
      border: none;
      border-radius: 8px;
      color: #fff;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.15s, transform 0.1s;
      letter-spacing: 0.02em;
    }
    .utl-toast-btn:hover  { opacity: 0.88; transform: translateY(-1px); }
    .utl-toast-btn:active { transform: translateY(0); }
    .utl-toast-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }
    .utl-toast-powered {
      margin-top: 8px;
      text-align: center;
      font-size: 10px;
      color: #374151;
    }
    .utl-toast-powered a {
      color: #6b7280;
      text-decoration: none;
    }
    .utl-toast-powered a:hover { color: #a78bfa; }
    .utl-toast-success {
      text-align: center;
      padding: 6px 0;
      font-size: 13px;
      color: #34d399;
      font-weight: 600;
    }
    .utl-toast-error {
      text-align: center;
      padding: 6px 0;
      font-size: 12px;
      color: #f87171;
    }
  `;

  /* ── Inject styles + container ── */
  function injectUI() {
    if (document.getElementById('utl-widget-styles')) return;
    const style = document.createElement('style');
    style.id = 'utl-widget-styles';
    style.textContent = STYLE;
    document.head.appendChild(style);

    const container = document.createElement('div');
    container.id = 'utl-widget-container';
    document.body.appendChild(container);
  }

  /* ── Format tx hash ── */
  function shortHash(hash) {
    if (!hash || hash.length < 10) return hash;
    return hash.slice(0, 8) + '…' + hash.slice(-6);
  }

  /* ── Format time ── */
  function fmtTime(secs) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  /* ── Show toast ── */
  function showToast(txHash, userAddress) {
    if (activeToasts.has(txHash)) return;
    injectUI();

    const container = document.getElementById('utl-widget-container');
    const toast = document.createElement('div');
    toast.className = 'utl-toast';
    toast.dataset.tx = txHash;

    let remaining = WINDOW_SECS;
    const pct = () => (remaining / WINDOW_SECS) * 100;

    toast.innerHTML = `
      <div class="utl-toast-bar" style="width:100%"></div>
      <div class="utl-toast-header">
        <div class="utl-toast-title">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
            <path d="M3 3v5h5"/>
          </svg>
          UTL Undo Window
        </div>
        <button class="utl-toast-close" title="Dismiss">×</button>
      </div>
      <div class="utl-toast-tx">TX: ${shortHash(txHash)}</div>
      <div class="utl-toast-countdown">Window closes in <span class="utl-time">${fmtTime(remaining)}</span></div>
      <button class="utl-toast-btn">⟳ Undo Transaction</button>
      <div class="utl-toast-powered">Powered by <a href="https://kenostodblockchain.com" target="_blank">UTL · Kenostod</a></div>
    `;

    container.appendChild(toast);

    const bar      = toast.querySelector('.utl-toast-bar');
    const timeEl   = toast.querySelector('.utl-time');
    const btn      = toast.querySelector('.utl-toast-btn');
    const closeBtn = toast.querySelector('.utl-toast-close');

    /* Countdown */
    const interval = setInterval(() => {
      remaining--;
      timeEl.textContent = fmtTime(remaining);
      bar.style.width = pct() + '%';
      if (remaining <= 60) bar.style.background = 'linear-gradient(90deg,#f59e0b,#ef4444)';
      if (remaining <= 0) closeToast(txHash);
    }, 1000);

    activeToasts.set(txHash, { toast, interval });

    /* Close button */
    closeBtn.addEventListener('click', () => closeToast(txHash));

    /* Undo button */
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.textContent = 'Processing…';
      try {
        const res  = await fetch(`${API_BASE}/api/utl/widget/undo`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ siteId: SITE_ID, txHash, userAddress }),
        });
        const data = await res.json();
        if (data.ok) {
          toast.querySelector('.utl-toast-countdown').style.display = 'none';
          btn.style.display = 'none';
          const msg = document.createElement('div');
          msg.className = 'utl-toast-success';
          msg.textContent = '✓ Reversal submitted — funds returning';
          toast.insertBefore(msg, toast.querySelector('.utl-toast-powered'));
          setTimeout(() => closeToast(txHash), 4000);
        } else {
          btn.disabled = false;
          btn.textContent = '⟳ Undo Transaction';
          const err = document.createElement('div');
          err.className = 'utl-toast-error';
          err.textContent = data.error || 'Undo unavailable — try again';
          toast.insertBefore(err, toast.querySelector('.utl-toast-powered'));
          setTimeout(() => err.remove(), 3500);
        }
      } catch (e) {
        btn.disabled = false;
        btn.textContent = '⟳ Undo Transaction';
      }
    });
  }

  /* ── Close toast ── */
  function closeToast(txHash) {
    const entry = activeToasts.get(txHash);
    if (!entry) return;
    clearInterval(entry.interval);
    entry.toast.classList.add('utl-closing');
    setTimeout(() => entry.toast.remove(), 280);
    activeToasts.delete(txHash);
  }

  /* ── Intercept window.ethereum ── */
  function hookEthereum(provider) {
    if (!provider || provider.__utl_hooked) return;
    provider.__utl_hooked = true;

    const origRequest = provider.request.bind(provider);
    provider.request = async function (args) {
      const result = await origRequest(args);
      if (args.method === 'eth_sendTransaction' || args.method === 'eth_sendRawTransaction') {
        const txHash = typeof result === 'string' ? result : null;
        if (txHash && txHash.startsWith('0x')) {
          /* Register with Kenostod backend */
          const from = args.params?.[0]?.from || '';
          registerTx(txHash, from);
          /* Show the undo toast */
          setTimeout(() => showToast(txHash, from), 300);
        }
      }
      return result;
    };
  }

  /* ── Register tx with Kenostod ── */
  async function registerTx(txHash, userAddress) {
    try {
      await fetch(`${API_BASE}/api/utl/widget/register-tx`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ siteId: SITE_ID, txHash, userAddress, amount: 0, currency: 'ETH' }),
      });
    } catch (_) {}
  }

  /* ── Watch for ethereum provider ── */
  function watchProvider() {
    if (window.ethereum) {
      hookEthereum(window.ethereum);
      /* Also hook any injected providers array (EIP-5749) */
      if (window.ethereum.providers) {
        window.ethereum.providers.forEach(hookEthereum);
      }
    }
    /* Listen for provider announcement (EIP-6963) */
    window.addEventListener('eip6963:announceProvider', (e) => {
      if (e.detail?.provider) hookEthereum(e.detail.provider);
    });
    window.dispatchEvent(new Event('eip6963:requestProvider'));
  }

  /* ── External API for non-web3 sites ── */
  window.UTL = {
    /**
     * Call this manually after your own transaction goes through:
     * UTL.trackTransaction({ txHash: '0x...', userAddress: '0x...' })
     */
    trackTransaction: function ({ txHash, userAddress = '' }) {
      if (!txHash) return;
      registerTx(txHash, userAddress);
      showToast(txHash, userAddress);
    },
    /**
     * Programmatically trigger an undo (returns a Promise):
     * UTL.undo({ txHash: '0x...', userAddress: '0x...' })
     */
    undo: async function ({ txHash, userAddress = '' }) {
      const res  = await fetch(`${API_BASE}/api/utl/widget/undo`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ siteId: SITE_ID, txHash, userAddress }),
      });
      return res.json();
    },
    siteId: SITE_ID,
    version: '1.0.0',
  };

  /* ── Boot ── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', watchProvider);
  } else {
    watchProvider();
  }

})();
