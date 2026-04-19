const PILLARS = [
  { name: "T.D.I.R.", sub: "Foundation" },
  { name: "Academy", sub: "21 Courses" },
  { name: "KUTL Card", sub: "Cybrid + Rain" },
  { name: "KENO", sub: "BEP-20 · 1B" },
  { name: "UTL Protocol", sub: "5 Contracts" },
  { name: "UTLFarm", sub: "Staking" },
  { name: "B.U.K.", sub: "Banking" },
  { name: "G.I.F.T.", sub: "Apparel" },
  { name: "Solar Bunker", sub: "Energy" },
];

export function NonagonPrism() {
  const cx = 210, cy = 210, R = 160, n = 9;
  const vertices = PILLARS.map((_, i) => {
    const a = ((i * 360) / n - 90) * (Math.PI / 180);
    return { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) };
  });

  const edges: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      edges.push([i, j]);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#04080f", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "monospace", padding: "32px 16px" }}>
      <link href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />

      <div style={{ color: "#00e5ff", fontSize: 10, letterSpacing: 5, textTransform: "uppercase", marginBottom: 8, opacity: 0.6, fontFamily: "'Space Mono', monospace" }}>
        KENOSTOD · BLOCKCHAIN
      </div>
      <h1 style={{ color: "#fff", fontSize: 26, fontWeight: 700, margin: "0 0 4px", letterSpacing: 3, textAlign: "center", fontFamily: "'Space Mono', monospace" }}>KENO</h1>
      <div style={{ color: "#00e5ff", fontSize: 11, letterSpacing: 4, marginBottom: 28, fontFamily: "'Space Mono', monospace", opacity: 0.8 }}>THE NONAGON PRISM</div>

      <svg viewBox="0 0 420 420" width={340} height={340} style={{ overflow: "visible" }}>
        <defs>
          <radialGradient id="prismGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#00e5ff" stopOpacity="0.06" />
            <stop offset="70%" stopColor="#7c3aed" stopOpacity="0.04" />
            <stop offset="100%" stopColor="#04080f" stopOpacity="0" />
          </radialGradient>
          <filter id="nodeGlow">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="lineGlow">
            <feGaussianBlur stdDeviation="1.5" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        <circle cx={cx} cy={cy} r={R + 30} fill="url(#prismGlow)" />

        {edges.map(([i, j], idx) => {
          const dist = Math.sqrt(Math.pow(vertices[i].x - vertices[j].x, 2) + Math.pow(vertices[i].y - vertices[j].y, 2));
          const isEdge = Math.abs(i - j) === 1 || (i === 0 && j === n - 1);
          const opacity = isEdge ? 0.5 : Math.max(0.02, 0.25 - dist / 900);
          const color = isEdge ? "#00e5ff" : "#7c3aed";
          return (
            <line key={idx}
              x1={vertices[i].x} y1={vertices[i].y}
              x2={vertices[j].x} y2={vertices[j].y}
              stroke={color} strokeWidth={isEdge ? 1.5 : 0.5}
              strokeOpacity={opacity}
              filter={isEdge ? "url(#lineGlow)" : undefined}
            />
          );
        })}

        <polygon
          points={vertices.map(v => `${v.x},${v.y}`).join(" ")}
          fill="none" stroke="#00e5ff" strokeWidth="2" strokeOpacity="0.6"
          filter="url(#lineGlow)"
        />

        <circle cx={cx} cy={cy} r={52} fill="#04080f" stroke="#00e5ff" strokeWidth="1.5" strokeOpacity="0.7" filter="url(#nodeGlow)" />
        <circle cx={cx} cy={cy} r={40} fill="#04080f" stroke="#7c3aed" strokeWidth="1" strokeOpacity="0.5" />

        <text x={cx} y={cy - 8} textAnchor="middle" fill="#00e5ff" fontSize="28" fontWeight="700" fontFamily="'Space Mono', monospace" filter="url(#nodeGlow)">K</text>
        <text x={cx} y={cy + 18} textAnchor="middle" fill="#7c3aed" fontSize="8" fontFamily="'Space Mono', monospace" letterSpacing="3" opacity="0.9">SOVEREIGN</text>

        {vertices.map((v, i) => {
          const a = ((i * 360) / n - 90) * (Math.PI / 180);
          const lx = cx + (R + 28) * Math.cos(a);
          const ly = cy + (R + 28) * Math.sin(a);
          const anchor = lx > cx + 10 ? "start" : lx < cx - 10 ? "end" : "middle";
          return (
            <g key={i}>
              <circle cx={v.x} cy={v.y} r={8} fill="#04080f" stroke="#00e5ff" strokeWidth="1.5" filter="url(#nodeGlow)" />
              <circle cx={v.x} cy={v.y} r={3} fill="#00e5ff" opacity="0.9" />
              <text x={lx} y={ly - 5} textAnchor={anchor} fill="#fff" fontSize="8.5" fontWeight="700" fontFamily="'Space Mono', monospace" opacity="0.95">
                {PILLARS[i].name}
              </text>
              <text x={lx} y={ly + 8} textAnchor={anchor} fill="#7c3aed" fontSize="7" fontFamily="'Space Mono', monospace" opacity="0.7">
                {PILLARS[i].sub}
              </text>
            </g>
          );
        })}

        {[R * 0.35, R * 0.55, R * 0.75].map((r, i) => (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke="#00e5ff" strokeWidth="0.3" strokeOpacity={0.08 + i * 0.04} strokeDasharray="3 9" />
        ))}
      </svg>

      <div style={{ marginTop: 20, display: "flex", gap: 16, color: "rgba(255,255,255,0.25)", fontSize: 10, fontFamily: "'Space Mono', monospace", letterSpacing: 1 }}>
        <span>BNB SMART CHAIN</span>
        <span>·</span>
        <span>1,000,000,000 KENO</span>
        <span>·</span>
        <span>9 PILLARS</span>
      </div>
    </div>
  );
}
