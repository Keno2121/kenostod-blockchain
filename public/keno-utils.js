/* Kenostod shared utilities — branded modal, MetaMask mobile detection */

function kenoAlert(message, type) {
    return new Promise(resolve => {
        const existing = document.getElementById('__kenoModal');
        if (existing) existing.remove();

        const color = type === 'error' ? '#ef4444'
                    : type === 'warn'  ? '#f5c842'
                    : '#10b981';

        const overlay = document.createElement('div');
        overlay.id = '__kenoModal';
        overlay.style.cssText = [
            'position:fixed','top:0','left:0','right:0','bottom:0',
            'background:rgba(0,0,0,0.75)','z-index:999999',
            'display:flex','align-items:center','justify-content:center','padding:20px'
        ].join(';');

        overlay.innerHTML = `
            <div style="background:#1a1f2e;border:1px solid ${color}44;border-radius:16px;
                        padding:24px;max-width:360px;width:100%;
                        box-shadow:0 20px 60px rgba(0,0,0,0.6);font-family:inherit">
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;
                            border-bottom:1px solid rgba(255,255,255,0.08);padding-bottom:14px">
                    <img src="/logo.png" style="height:28px;border-radius:6px"
                         onerror="this.style.display='none'">
                    <span style="color:#f5c842;font-weight:700;font-size:0.95rem">Kenostod Academy</span>
                    <button id="__kenoModalClose"
                            style="margin-left:auto;background:none;border:none;color:#888;
                                   font-size:1.6rem;cursor:pointer;line-height:1;padding:0">×</button>
                </div>
                <div style="color:#e2e8f0;font-size:0.95rem;line-height:1.5;margin-bottom:20px">${message}</div>
                <button id="__kenoModalOk"
                        style="width:100%;background:linear-gradient(135deg,${color},${color}cc);
                               color:#fff;border:none;border-radius:8px;padding:12px;
                               font-size:1rem;font-weight:700;cursor:pointer">OK</button>
            </div>`;

        document.body.appendChild(overlay);

        const close = () => { overlay.remove(); resolve(); };
        document.getElementById('__kenoModalOk').onclick = close;
        document.getElementById('__kenoModalClose').onclick = close;
        overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    });
}

function kenoMetaMaskPrompt() {
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const deepLink = `https://metamask.app.link/dapp/${window.location.host}${window.location.pathname}`;

    const mobileMsg = `
        <div style="text-align:center">
            <div style="font-size:2.5rem;margin-bottom:8px">🦊</div>
            <div style="font-weight:700;font-size:1.1rem;margin-bottom:8px;color:#f5c842">
                Open in MetaMask Browser
            </div>
            <div style="color:#94a3b8;font-size:0.875rem;margin-bottom:20px">
                On mobile, you must open this page <strong style="color:#e2e8f0">inside the MetaMask app</strong>
                — Chrome and Safari can't connect to MetaMask directly.
            </div>
            <a href="${deepLink}"
               style="display:block;background:linear-gradient(135deg,#f5c842,#c9a227);
                      color:#000;padding:14px;border-radius:10px;font-weight:700;
                      text-decoration:none;font-size:1rem;margin-bottom:10px">
                📱 Open This Page in MetaMask
            </a>
            <div style="color:#64748b;font-size:0.75rem">
                Or open MetaMask → tap the Browser icon at the bottom → paste this URL
            </div>
        </div>`;

    const desktopMsg = `
        <div>
            <div style="font-weight:700;margin-bottom:8px;color:#f5c842">MetaMask Not Detected</div>
            <div style="color:#94a3b8;font-size:0.875rem">
                Please install the MetaMask browser extension from
                <a href="https://metamask.io" target="_blank"
                   style="color:#f5c842">metamask.io</a>
                then refresh this page.
            </div>
        </div>`;

    return kenoAlert(isMobile ? mobileMsg : desktopMsg, 'warn');
}
