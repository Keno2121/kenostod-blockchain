function KenoLogo({ size = 512 }: { size?: number }) {
  const s = size;
  const cx = s / 2, cy = s / 2;
  const outerR = s * 0.46;
  const innerR = s * 0.40;
  const bars = 9;
  const barAreaH = innerR * 1.52;
  const barAreaTop = cy - barAreaH / 2 + s * 0.01;
  const minBarW = innerR * 0.28;
  const maxBarW = innerR * 1.78;
  const barH = (barAreaH / bars) * 0.72;
  const barGap = (barAreaH / bars) * 0.28;
  const fontSize = s * 0.28;
  const kenoFontSize = s * 0.085;

  return (
    <svg
      viewBox={`0 0 ${s} ${s}`}
      width={s} height={s}
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "block" }}
    >
      <defs>
        <radialGradient id={`bg-${s}`} cx="50%" cy="60%" r="55%">
          <stop offset="0%" stopColor="#1a1108" />
          <stop offset="100%" stopColor="#07060a" />
        </radialGradient>
        <linearGradient id={`bar-${s}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#c49a20" />
          <stop offset="50%" stopColor="#e8c040" />
          <stop offset="100%" stopColor="#d4af37" />
        </linearGradient>
        <linearGradient id={`ring-${s}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f0d060" />
          <stop offset="50%" stopColor="#d4af37" />
          <stop offset="100%" stopColor="#a07820" />
        </linearGradient>
        <filter id={`glow-${s}`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation={s * 0.012} result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id={`kglow-${s}`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation={s * 0.022} result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <clipPath id={`inner-${s}`}>
          <circle cx={cx} cy={cy} r={innerR} />
        </clipPath>
      </defs>

      {/* Outer coin ring */}
      <circle cx={cx} cy={cy} r={outerR + s * 0.015} fill={`url(#ring-${s})`} />
      <circle cx={cx} cy={cy} r={outerR} fill={`url(#bg-${s})`} />
      <circle cx={cx} cy={cy} r={innerR + s * 0.008} fill="none" stroke="#d4af37" strokeWidth={s * 0.006} strokeOpacity="0.4" />

      {/* Pyramid bars clipped to inner circle */}
      <g clipPath={`url(#inner-${s})`}>
        {Array.from({ length: bars }).map((_, i) => {
          const progress = i / (bars - 1);
          const bw = minBarW + progress * (maxBarW - minBarW);
          const by = barAreaTop + i * (barH + barGap);
          const bx = cx - bw / 2;
          const opacity = 0.25 + progress * 0.65;
          return (
            <rect
              key={i}
              x={bx} y={by} width={bw} height={barH}
              rx={barH * 0.35}
              fill={`url(#bar-${s})`}
              fillOpacity={opacity}
            />
          );
        })}
      </g>

      {/* K letterform */}
      <text
        x={cx} y={cy + fontSize * 0.34}
        textAnchor="middle"
        fontSize={fontSize}
        fontWeight="900"
        fontFamily="'Arial Black', 'Impact', sans-serif"
        fill="#d4af37"
        filter={`url(#kglow-${s})`}
        letterSpacing="-2"
      >K</text>

      {/* KENO arc text (only at larger sizes) */}
      {size >= 96 && (
        <>
          <path id={`arc-${s}`}
            d={`M ${cx - outerR * 0.76} ${cy + outerR * 0.62} A ${outerR * 0.82} ${outerR * 0.82} 0 0 1 ${cx + outerR * 0.76} ${cy + outerR * 0.62}`}
            fill="none" />
          <text fontSize={kenoFontSize} fontWeight="700" fontFamily="'Arial', sans-serif" fill="#d4af37" fillOpacity="0.9" letterSpacing={size * 0.018}>
            <textPath href={`#arc-${s}`} startOffset="50%" textAnchor="middle">KENO</textPath>
          </text>
        </>
      )}

      {/* Inner glow ring */}
      <circle cx={cx} cy={cy} r={outerR} fill="none"
        stroke="#f0d060" strokeWidth={s * 0.003} strokeOpacity="0.25" filter={`url(#glow-${s})`} />
    </svg>
  );
}

export function KenoEmblem() {
  return (
    <div style={{ minHeight: "100vh", background: "#0a090e", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 32, padding: "32px 20px", fontFamily: "system-ui, sans-serif" }}>

      <div style={{ textAlign: "center" }}>
        <div style={{ color: "#d4af37", fontSize: 10, letterSpacing: 6, textTransform: "uppercase", opacity: 0.6, marginBottom: 6 }}>Official Token Logo</div>
        <div style={{ color: "#fff", fontSize: 20, fontWeight: 700, letterSpacing: 2 }}>KENO · BEP-20 · BSC</div>
      </div>

      {/* Hero — 256px display */}
      <div style={{ background: "rgba(212,175,55,0.04)", border: "1px solid rgba(212,175,55,0.15)", borderRadius: 20, padding: 32, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        <KenoLogo size={256} />
        <div style={{ color: "rgba(212,175,55,0.5)", fontSize: 10, letterSpacing: 3 }}>512 × 512 EXPORT</div>
      </div>

      {/* Size previews */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", maxWidth: 520 }}>
        <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 10, letterSpacing: 3, textTransform: "uppercase", textAlign: "center" }}>How It Looks At Every Size</div>

        {[
          { size: 128, label: "CoinGecko / CMC profile" },
          { size: 64,  label: "PancakeSwap listing" },
          { size: 32,  label: "Wallet token list" },
          { size: 20,  label: "Tab favicon" },
        ].map(({ size, label }) => (
          <div key={size} style={{ display: "flex", alignItems: "center", gap: 16, background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "10px 16px", border: "1px solid rgba(255,255,255,0.06)" }}>
            <KenoLogo size={size} />
            <div>
              <div style={{ color: "#fff", fontSize: 12, fontWeight: 600 }}>{size}px</div>
              <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 10, marginTop: 2 }}>{label}</div>
            </div>
            {/* PancakeSwap-style row mock for 64px */}
            {size === 64 && (
              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10, background: "#1a1035", borderRadius: 8, padding: "8px 14px" }}>
                <KenoLogo size={28} />
                <div>
                  <div style={{ color: "#fff", fontSize: 13, fontWeight: 700 }}>KENO</div>
                  <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 10 }}>$0.0042</div>
                </div>
                <div style={{ marginLeft: 12, color: "#4ade80", fontSize: 11, fontWeight: 600 }}>+8.3%</div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
        {["PancakeSwap", "CoinGecko", "CoinMarketCap", "Trust Wallet", "Phantom", "MetaMask"].map(p => (
          <div key={p} style={{ background: "rgba(212,175,55,0.07)", border: "1px solid rgba(212,175,55,0.2)", borderRadius: 20, padding: "5px 14px", color: "#d4af37", fontSize: 10, fontWeight: 600, letterSpacing: 1 }}>
            {p}
          </div>
        ))}
      </div>

      <div style={{ color: "rgba(255,255,255,0.2)", fontSize: 9, letterSpacing: 2, textAlign: "center" }}>
        PNG · 512×512 · Transparent-ready · The Sovereign Economy
      </div>
    </div>
  );
}
