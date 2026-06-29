// Each letter K·E·N·O sits on its own gold tier — together they form the pyramid.
// K = narrowest at top, O = widest at foundation. The letters ARE the pyramid.

const LETTERS = ["K", "E", "N", "O"];

function KenoLogo({ size = 512 }: { size?: number }) {
  const s = size;
  const cx = s / 2;
  const cy = s / 2;
  const coinR = s * 0.46;
  const ringW = s * 0.028;
  const innerR = coinR - ringW;

  // Tier layout — 4 letter tiers forming a pyramid
  const tiers = 4;
  const pyramidPad = s * 0.06; // padding from inner circle edge
  const pyramidTop = cy - s * 0.27;
  const pyramidBottom = cy + s * 0.28;
  const totalH = pyramidBottom - pyramidTop;
  const gap = s * 0.022;
  const tierH = (totalH - gap * (tiers - 1)) / tiers;

  // Width: each tier is wider going down
  const minHalfW = s * 0.07;
  const maxHalfW = innerR - pyramidPad;

  // Font sizes scale with tier
  const minFontSize = tierH * 0.52;
  const maxFontSize = tierH * 0.78;

  return (
    <svg viewBox={`0 0 ${s} ${s}`} width={s} height={s} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id={`bg${s}`} cx="50%" cy="45%" r="65%">
          <stop offset="0%" stopColor="#1c1408" />
          <stop offset="100%" stopColor="#07060b" />
        </radialGradient>
        <linearGradient id={`ring${s}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f5e080" />
          <stop offset="45%" stopColor="#d4af37" />
          <stop offset="100%" stopColor="#8a6010" />
        </linearGradient>
        {LETTERS.map((_, i) => {
          const prog = i / (tiers - 1);
          const lightness = 32 + prog * 18;
          const sat = 68 + prog * 18;
          return (
            <linearGradient key={i} id={`tier${s}${i}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={`hsl(42,${sat - 15}%,${lightness - 8}%)`} />
              <stop offset="35%" stopColor={`hsl(44,${sat}%,${lightness + 10}%)`} />
              <stop offset="65%" stopColor={`hsl(44,${sat}%,${lightness + 14}%)`} />
              <stop offset="100%" stopColor={`hsl(42,${sat - 15}%,${lightness - 8}%)`} />
            </linearGradient>
          );
        })}
        <filter id={`glow${s}`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation={s * 0.016} result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id={`softglow${s}`} x="-15%" y="-15%" width="130%" height="130%">
          <feGaussianBlur stdDeviation={s * 0.008} result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <clipPath id={`coin${s}`}>
          <circle cx={cx} cy={cy} r={innerR} />
        </clipPath>
      </defs>

      {/* Outer ring */}
      <circle cx={cx} cy={cy} r={coinR} fill={`url(#ring${s})`} />
      <circle cx={cx} cy={cy} r={coinR - ringW * 0.25} fill="none"
        stroke="#f8e898" strokeWidth={s * 0.004} strokeOpacity="0.45" />
      {/* Inner background */}
      <circle cx={cx} cy={cy} r={innerR} fill={`url(#bg${s})`} />

      {/* Letter tiers — clipped to coin */}
      <g clipPath={`url(#coin${s})`}>
        {LETTERS.map((letter, i) => {
          const prog = i / (tiers - 1); // 0=top(K) → 1=bottom(O)
          const halfW = minHalfW + prog * (maxHalfW - minHalfW);
          const ty = pyramidTop + i * (tierH + gap);
          const fontSize = minFontSize + prog * (maxFontSize - minFontSize);
          const fontWeight = 700 + prog * 200; // 700 → 900
          const barRx = tierH * 0.28;

          return (
            <g key={i}>
              {/* Gold bar — the pyramid tier */}
              <rect
                x={cx - halfW} y={ty}
                width={halfW * 2} height={tierH}
                rx={barRx}
                fill={`url(#tier${s}${i})`}
                filter={i === tiers - 1 ? `url(#softglow${s})` : undefined}
              />
              {/* Letter engraved dark on gold bar */}
              <text
                x={cx}
                y={ty + tierH * 0.5}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={fontSize}
                fontWeight={Math.round(fontWeight / 100) * 100}
                fontFamily="'Arial Black', 'Impact', 'Helvetica Neue', sans-serif"
                fill="#0c0a06"
                fillOpacity="0.82"
                letterSpacing={prog * fontSize * 0.08}
              >
                {letter}
              </text>
            </g>
          );
        })}
      </g>

      {/* Subtle inner glow ring */}
      <circle cx={cx} cy={cy} r={innerR - s * 0.005} fill="none"
        stroke="#f0d060" strokeWidth={s * 0.005} strokeOpacity="0.12"
        filter={`url(#glow${s})`}
      />

      {/* Dot separators between ring and tiers — only at larger sizes */}
      {size >= 128 && [0, 60, 120, 180, 240, 300].map((deg, i) => {
        const rad = deg * Math.PI / 180;
        const dotR = innerR - s * 0.02;
        return (
          <circle key={i}
            cx={cx + dotR * Math.cos(rad)}
            cy={cy + dotR * Math.sin(rad)}
            r={s * 0.008}
            fill="#d4af37" fillOpacity="0.2"
          />
        );
      })}
    </svg>
  );
}

export function KenoEmblem() {
  return (
    <div style={{
      minHeight: "100vh", background: "#09080d",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      gap: 28, padding: "28px 20px",
      fontFamily: "system-ui, -apple-system, sans-serif"
    }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ color: "#d4af37", fontSize: 10, letterSpacing: 6, textTransform: "uppercase", opacity: 0.5, marginBottom: 6 }}>
          Official Token Logo
        </div>
        <div style={{ color: "#fff", fontSize: 18, fontWeight: 700, letterSpacing: 2 }}>KENO · BEP-20 · BSC</div>
      </div>

      {/* Hero */}
      <div style={{ background: "rgba(212,175,55,0.04)", border: "1px solid rgba(212,175,55,0.15)", borderRadius: 20, padding: 28, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
        <KenoLogo size={240} />
        <div style={{ color: "rgba(212,175,55,0.4)", fontSize: 9, letterSpacing: 3 }}>512 × 512 EXPORT</div>
      </div>

      {/* Size previews */}
      <div style={{ width: "100%", maxWidth: 500 }}>
        <div style={{ color: "rgba(255,255,255,0.25)", fontSize: 9, letterSpacing: 3, textTransform: "uppercase", textAlign: "center", marginBottom: 12 }}>
          How It Looks At Every Size
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            { size: 96,  label: "96px",  ctx: "CoinGecko / CMC" },
            { size: 48,  label: "48px",  ctx: "PancakeSwap listing" },
            { size: 32,  label: "32px",  ctx: "Wallet token list" },
            { size: 20,  label: "20px",  ctx: "Favicon / tab icon" },
          ].map(({ size, label, ctx }) => (
            <div key={size} style={{
              display: "flex", alignItems: "center", gap: 14,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.05)",
              borderRadius: 10, padding: "10px 14px"
            }}>
              <div style={{ width: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <KenoLogo size={size} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: "#fff", fontSize: 12, fontWeight: 600 }}>{label}</div>
                <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 10, marginTop: 2 }}>{ctx}</div>
              </div>
              {size === 48 && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#1a1035", borderRadius: 8, padding: "6px 12px" }}>
                  <KenoLogo size={24} />
                  <div>
                    <div style={{ color: "#fff", fontSize: 12, fontWeight: 700 }}>KENO</div>
                    <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 9 }}>$0.0042</div>
                  </div>
                  <div style={{ marginLeft: 8, color: "#4ade80", fontSize: 10, fontWeight: 600 }}>+8.3%</div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
        {["PancakeSwap", "CoinGecko", "CoinMarketCap", "Trust Wallet", "MetaMask"].map(p => (
          <div key={p} style={{
            background: "rgba(212,175,55,0.07)", border: "1px solid rgba(212,175,55,0.2)",
            borderRadius: 20, padding: "4px 12px",
            color: "#d4af37", fontSize: 10, fontWeight: 600
          }}>{p}</div>
        ))}
      </div>
    </div>
  );
}
