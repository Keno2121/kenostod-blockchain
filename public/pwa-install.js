let deferredPrompt = null;

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
}

window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    showInstallBanner();
});

window.addEventListener('appinstalled', () => {
    hideInstallBanner();
    deferredPrompt = null;
});

function showInstallBanner() {
    const existing = document.getElementById('pwa-install-banner');
    if (existing) return;

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    if (isStandalone) return;

    const banner = document.createElement('div');
    banner.id = 'pwa-install-banner';
    banner.style.cssText = `
        position: fixed; bottom: 0; left: 0; right: 0; z-index: 9999;
        background: linear-gradient(135deg, #1e293b, #0f172a);
        border-top: 1px solid rgba(99,102,241,0.4);
        padding: 14px 20px;
        display: flex; align-items: center; gap: 14px;
        font-family: 'Segoe UI', sans-serif;
        animation: slideUp 0.3s ease;
    `;

    const style = document.createElement('style');
    style.textContent = `@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`;
    document.head.appendChild(style);

    if (isIOS) {
        banner.innerHTML = `
            <img src="/icons/icon-192.png" style="width:44px;height:44px;border-radius:10px;flex-shrink:0;">
            <div style="flex:1;">
                <div style="font-weight:700;color:white;font-size:0.9rem;">Install Kenostod Academy</div>
                <div style="color:#94a3b8;font-size:0.78rem;margin-top:2px;">Tap <strong style="color:#f8fafc;">Share</strong> then <strong style="color:#f8fafc;">"Add to Home Screen"</strong></div>
            </div>
            <button onclick="document.getElementById('pwa-install-banner').remove()" style="background:none;border:none;color:#64748b;font-size:1.3rem;cursor:pointer;padding:4px;">✕</button>
        `;
    } else {
        banner.innerHTML = `
            <img src="/icons/icon-192.png" style="width:44px;height:44px;border-radius:10px;flex-shrink:0;">
            <div style="flex:1;">
                <div style="font-weight:700;color:white;font-size:0.9rem;">Install Kenostod Academy</div>
                <div style="color:#94a3b8;font-size:0.78rem;margin-top:2px;">Add to your home screen — works like a real app</div>
            </div>
            <button onclick="installPWA()" style="background:linear-gradient(135deg,#6366f1,#4f46e5);color:white;border:none;padding:8px 16px;border-radius:8px;font-size:0.82rem;font-weight:600;cursor:pointer;flex-shrink:0;">Install</button>
            <button onclick="document.getElementById('pwa-install-banner').remove()" style="background:none;border:none;color:#64748b;font-size:1.3rem;cursor:pointer;padding:4px;">✕</button>
        `;
    }

    document.body.appendChild(banner);
}

function hideInstallBanner() {
    const banner = document.getElementById('pwa-install-banner');
    if (banner) banner.remove();
}

async function installPWA() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') hideInstallBanner();
    deferredPrompt = null;
}
