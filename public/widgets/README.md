# Kenostod Embeddable Widgets

Three drop-in widgets that connect directly to **BOT Chain (chainId 677)**.  
Each is a self-contained HTML file — no build step, no npm install.

---

## Widgets

| Widget | URL | What it does |
|--------|-----|--------------|
| UTL Send | `/widgets/utl-send` | Send BOT via UTL FeeCollector |
| FAL Pool | `/widgets/fal-pool` | Deposit KENO into FAL Pool, claim BOT rewards |
| FALP Stake | `/widgets/falp-stake` | Stake/unstake KENO in UTL Staking, claim BOT |

---

## Embed as an `<iframe>`

```html
<!-- UTL Send widget (light theme) -->
<iframe
  src="https://kenostodblockchain.com/widgets/utl-send"
  width="440"
  height="420"
  frameborder="0"
  style="border-radius: 12px; border: 1px solid #e2e8f0;"
  allow="clipboard-write"
></iframe>

<!-- FAL Pool widget (dark theme) -->
<iframe
  src="https://kenostodblockchain.com/widgets/fal-pool?theme=dark"
  width="440"
  height="560"
  frameborder="0"
  style="border-radius: 12px; border: 1px solid #334155; background: #0f172a;"
  allow="clipboard-write"
></iframe>

<!-- FALP Staking widget (dark theme) -->
<iframe
  src="https://kenostodblockchain.com/widgets/falp-stake?theme=dark"
  width="440"
  height="560"
  frameborder="0"
  style="border-radius: 12px; border: 1px solid #334155; background: #0f172a;"
  allow="clipboard-write"
></iframe>
```

---

## URL Parameters

| Parameter | Values | Default | Description |
|-----------|--------|---------|-------------|
| `theme` | `light` / `dark` | `light` | Widget colour scheme |

**FAL Pool only:**

| Parameter | Values | Default | Description |
|-----------|--------|---------|-------------|
| `lockTier` | `0` – `3` | `0` | Pre-select a lock tier (0=Flexible, 1=7d, 2=30d, 3=90d) |

---

## Contracts (BOT Chain mainnet)

| Contract | Address |
|----------|---------|
| UTL FeeCollector | `0xBb44a52b2B69D820cA1792Ca9a496e9F00B2F9E7` |
| UTL Staking | `0xd6a73bc00f623f893831B623efdA9901CAF58e63` |
| FAL Pool | `0x5065DDd17B35427131d7EA0387Ba68dC26d61fD1` |
| KENO (BOT Chain) | `0x137a5Fc22a76Ec42490F2421a81935d124baE714` |

---

## Embed as a `<script>` loader

For pages where iframes are blocked, use an inline script to mount the widget inside a `<div>`:

```html
<!-- Place a container where you want the widget to appear -->
<div id="utl-widget"></div>

<script>
(function() {
  var iframe = document.createElement('iframe');
  iframe.src = 'https://kenostodblockchain.com/widgets/utl-send?theme=dark';
  iframe.width  = '100%';
  iframe.height = '420';
  iframe.frameBorder = '0';
  iframe.style.cssText = 'border-radius:12px;max-width:440px;display:block;';
  iframe.allow = 'clipboard-write';
  document.getElementById('utl-widget').appendChild(iframe);
})();
</script>
```

Replace `utl-widget` and the `src` URL with the desired widget.

---

## WalletConnect

Widgets auto-detect the network and switch to BOT Chain 677 after connect.  
On mobile, they redirect to MetaMask deep-link instead of showing a QR code.  
The WalletConnect project ID is loaded server-side from `WALLETCONNECT_PROJECT_ID`.

---

## Telegram Mini-App

Widgets work inside Telegram Mini-Apps. Set the `<iframe>` `allow` attribute to include `clipboard-write` and ensure your bot's domain whitelist includes `kenostodblockchain.com`.
