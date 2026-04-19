function KenoLogo({ size = 512 }: { size?: number }) {
  const s = size;
  const cx = s / 2;
  const cy = s / 2;
  const coinR = s * 0.46;
  const ringW = s * 0.028;

  // Pyramid lives in lower 58% of coin interior
  const bars = 9;
  const pyramidTop = cy - s * 0.07;
  const pyramidBottom = cy + s * 0.34;
  const pyramidH = pyramidBottom - pyramidTop;
  const maxHalfW = s * 0.32;   // widest bar half-width (bottom)
  const minHalfW = s * 0.045;  // narrowest bar half-width (top)
  const totalGap = pyramidH * 0.22;
  const barH = (pyramidH - totalGap) / bars;
  const gapH = totalGap / (bars - 1);

  // K sits in upper portion — clear space above pyramid
  const kY = cy - s * 0.17;
  const kSize = s * 0.22;

  return (
    <svg viewBox={`0 0 ${s} ${s}`} width={s} height={s} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id={`coinbg${s}`} cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#18120a" />
          <stop offset="100%" stopColor="#080508" />
        </radialGradient>
        <linearGradient id={`ring${s}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f5df80" />
          <stop offset="40%" stopColor="#d4af37" />
          <stop offset="100%" stopColor="#9a7515" />
        </linearGradient>
        <linearGradient id={`bar${s}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#a07010" />
          <stop offset="40%" stopColor="#d4af37" />
          <stop offset="60%" stopColor="#e8c84a" />
          <stop offset="100%" stopColor="#a07010" />
        </linearGradient>
        <filter id={`glow${s}`}>
          <feGaussianBlur stdDeviation={s * 0.018} result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <clipPath id={`coin${s}`}>
          <circle cx={cx} cy={cy} r={coinR - ringW - s * 0.005} />
        </clipPath>
        {/* Triangle clip for the bars so they form a perfect pyramid silhouette */}
        <clipPath id={`tri${s}`}>
          <polygon points={`${cx},${pyramidTop} ${cx + maxHalfW},${pyramidBottom} ${cx - maxHalfW},${pyramidBottom}`} />
        </clipPath>
      </defs>

      {/* Coin outer ring */}
      <circle cx={cx} cy={cy} r={coinR} fill={`url(#ring${s})`} />
      {/* Thin bright highlight ring inside */}
      <circle cx={cx} cy={cy} r={coinR - ringW * 0.3} fill="none" stroke="#f5e090" strokeWidth={s * 0.004} strokeOpacity="0.5" />
      {/* Coin background */}
      <circle cx={cx} cy={cy} r={coinR - ringW} fill={`url(#coinbg${s})`} />

      {/* Divider line separating K from pyramid */}
      <line
        x1={cx - s * 0.28} y1={cy - s * 0.005}
        x2={cx + s * 0.28} y2={cy - s * 0.005}
        stroke="#d4af37" strokeWidth={s * 0.004} strokeOpacity="0.25"
      />

      {/* Pyramid — bars clipped to triangle so they form a solid pyramid silhouette */}
      <g clipPath={`url(#tri${s})`}>
        {Array.from({ length: bars }).map((_, i) => {
          const progress = i / (bars - 1); // 0 = top (narrow), 1 = bottom (wide)
          const by = pyramidTop + i * (barH + gapH);
          const halfW = minHalfW + progress * (maxHalfW - minHalfW);
          const bx = cx - halfW;
          const brightness = 0.45 + progress * 0.55;
          return (
            <rect
              key={i}
              x={bx} y={by} width={halfW * 2} height={barH}
              rx={barH * 0.3}
              fill={`url(#bar${s})`}
              fillOpacity={brightness}
            />
          );
        })}
      </g>

      {/* K sits cleanly above the pyramid in its own space */}
      <text
        x={cx}
        y={kY + kSize * 0.38}
        textAnchor="middle"
        dominantBaseline="auto"
        fontSize={kSize}
        fontWeight="900"
        fontFamily="'Arial Black', 'Impact', 'Helvetica Neue', sans-serif"
        fill="#d4af37"
        filter={`url(#glow${s})`}
      >
        K
      </text>

      {/* KENO arc text along bottom ring — only at sizes ≥ 80 */}
      {size >= 80 && (() => {
        const arcR = coinR - ringW - s * 0.065;
        const startAngle = 150 * (Math.PI / 180);
        const endAngle = 30 * (Math.PI / 180);
        const x1 = cx + arcR * Math.cos(startAngle);
        const y1 = cy + arcR * Math.sin(startAngle);
        const x2 = cx + arcR * Math.cos(endAngle + 2 * Math.PI);
        const y2 = cy + arcR * Math.sin(endAngle + 2 * Math.PI);
        const arcId = `arc${s}`;
        return (
          <>
            <path id={arcId} d={`M ${x1} ${y1} A ${arcR} ${arcR} 0 1 1 ${x2} ${y2}`} fill="none" />
            <text fontSize={s * 0.072} fontWeight="800" fontFamily="'Arial Black', sans-serif" fill="#d4af37" fillOpacity="0.85" letterSpacing={s * 0.025}>
              <textPath href={`#${arcId}`} startOffset="50%" textAnchor="middle">KENO</textPath>
            </text>
          </>
        );
      })()}

      {/* Inner glow on ring */}
      <circle cx={cx} cy={cy} r={coinR - ringW} fill="none"
        stroke="#f0d870" strokeWidth={s * 0.004} strokeOpacity="0.15"
        filter={`url(#glow${s})`}
      />
    </svg>
  );
}

export function KenoEmblem() {
  return (
    <div style={{
      minHeight: "100vh", background: "#0a090e",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      gap: 28, padding: "28px 20px",
      fontFamily: "system-ui, -apple-system, sans-serif"
    }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ color: "#d4af37", fontSize: 10, letterSpacing: 6, textTransform: "uppercase", opacity: 0.55, marginBottom: 6 }}>
          Official Token Logo
        </div>
        <div style={{ color: "#fff", fontSize: 20, fontWeight: 700, letterSpacing: 2 }}>KENO · BEP-20 · BSC</div>
      </div>

      {/* Hero display */}
      <div style={{ background: "rgba(212,175,55,0.04)", border: "1px solid rgba(212,175,55,0.18)", borderRadius: 20, padding: 28 }}>
        <KenoLogo size={240} />
        <div style={{ color: "rgba(212,175,55,0.45)", fontSize: 9, letterSpacing: 3, textAlign: "center", marginTop: 10 }}>512 × 512 EXPORT</div>
      </div>

      {/* Size scale previews */}
      <div style={{ width: "100%", maxWidth: 500 }}>
        <div style={{ color: "rgba(255,255,255,0.28)", fontSize: 9, letterSpacing: 3, textTransform: "uppercase", textAlign: "center", marginBottom: 12 }}>
          How It Looks At Every Size
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            { size: 96,  label: "96px", ctx: "CoinGecko / CMC" },
            { size: 48,  label: "48px", ctx: "PancakeSwap listing" },
            { size: 32,  label: "32px", ctx: "Wallet token list" },
            { size: 20,  label: "20px", ctx: "Favicon / tab icon" },
          ].map(({ size, label, ctx }) => (
            <div key={size} style={{
              display: "flex", alignItems: "center", gap: 14,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 10, padding: "10px 14px"
            }}>
              <div style={{ width: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <KenoLogo size={size} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: "#fff", fontSize: 12, fontWeight: 600 }}>{label}</div>
                <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 10, marginTop: 2 }}>{ctx}</div>
              </div>
              {/* PancakeSwap row mock at 48px */}
              {size === 48 && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#1a1035", borderRadius: 8, padding: "6px 12px" }}>
                  <KenoLogo size={24} />
                  <div>
                    <div style={{ color: "#fff", fontSize: 12, fontWeight: 700 }}>KENO</div>
                    <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 9 }}>$0.0042</div>
                  </div>
                  <div style={{ marginLeft: 8, color: "#4ade80", fontSize: 10, fontWeight: 600 }}>+8.3%</div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Platform tags */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
        {["PancakeSwap", "CoinGecko", "CoinMarketCap", "Trust Wallet", "MetaMask"].map(p => (
          <div key={p} style={{
            background: "rgba(212,175,55,0.07)", border: "1px solid rgba(212,175,55,0.2)",
            borderRadius: 20, padding: "4px 12px",
            color: "#d4af37", fontSize: 10, fontWeight: 600, letterSpacing: 0.5
          }}>{p}</div>
        ))}
      </div>
    </div>
  );
}
