import { useEffect, useRef } from "react";

const PILLARS = [
  "Academy",
  "KUTL Card",
  "KENO Token",
  "UTL Protocol",
  "UTLFarm",
  "B.U.K.",
  "G.I.F.T.",
  "Solar Bunker",
  "T.D.I.R.",
];

export function SovereignMandala() {
  const rotRef = useRef<SVGGElement>(null);
  useEffect(() => {
    let angle = 0;
    const id = setInterval(() => {
      angle += 0.12;
      if (rotRef.current) rotRef.current.setAttribute("transform", `rotate(${angle} 200 200)`);
    }, 16);
    return () => clearInterval(id);
  }, []);

  const cx = 200, cy = 200, outerR = 170, innerR = 72, midR = 115;
  const n = PILLARS.length;

  const segments = PILLARS.map((label, i) => {
    const startAngle = ((i * 360) / n - 90) * (Math.PI / 180);
    const endAngle = (((i + 1) * 360) / n - 90) * (Math.PI / 180);
    const x1 = cx + outerR * Math.cos(startAngle);
    const y1 = cy + outerR * Math.sin(startAngle);
    const x2 = cx + outerR * Math.cos(endAngle);
    const y2 = cy + outerR * Math.sin(endAngle);
    const xi1 = cx + innerR * Math.cos(startAngle);
    const yi1 = cy + innerR * Math.sin(startAngle);
    const xi2 = cx + innerR * Math.cos(endAngle);
    const yi2 = cy + innerR * Math.sin(endAngle);
    const path = `M ${xi1} ${yi1} L ${x1} ${y1} A ${outerR} ${outerR} 0 0 1 ${x2} ${y2} L ${xi2} ${yi2} A ${innerR} ${innerR} 0 0 0 ${xi1} ${yi1} Z`;
    const midAngle = ((i + 0.5) * 360) / n - 90;
    const midRad = midAngle * (Math.PI / 180);
    const lx = cx + midR * Math.cos(midRad);
    const ly = cy + midR * Math.sin(midRad);
    const gold = ["#d4af37", "#c9a227", "#bf9521", "#b5881b", "#d4af37", "#c9a227", "#bf9521", "#b5881b", "#d4af37"];
    return { path, lx, ly, midAngle, label, color: gold[i] };
  });

  return (
    <div style={{ minHeight: "100vh", background: "#06060d", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'Rajdhani', sans-serif", padding: "32px 16px" }}>
      <link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;600;700&display=swap" rel="stylesheet" />

      <div style={{ color: "#d4af37", fontSize: 11, letterSpacing: 6, textTransform: "uppercase", marginBottom: 8, opacity: 0.7 }}>Kenostod Blockchain Academy</div>
      <h1 style={{ color: "#fff", fontSize: 28, fontWeight: 700, margin: "0 0 4px", letterSpacing: 2, textAlign: "center" }}>KENO Token</h1>
      <div style={{ color: "#d4af37", fontSize: 13, letterSpacing: 3, marginBottom: 32, textAlign: "center" }}>The Sovereign Mandala</div>

      <svg viewBox="0 0 400 400" width={340} height={340} style={{ overflow: "visible" }}>
        <defs>
          <radialGradient id="bgGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#d4af37" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#06060d" stopOpacity="0" />
          </radialGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        <circle cx={cx} cy={cy} r={185} fill="url(#bgGlow)" />
        <circle cx={cx} cy={cy} r={outerR + 6} fill="none" stroke="#d4af37" strokeWidth="1" opacity="0.3" />
        <circle cx={cx} cy={cy} r={innerR - 4} fill="none" stroke="#d4af37" strokeWidth="1" opacity="0.2" />

        <g ref={rotRef} transform={`rotate(0 ${cx} ${cy})`}>
          {segments.map((s, i) => (
            <g key={i}>
              <path d={s.path} fill={s.color} fillOpacity={i % 2 === 0 ? 0.18 : 0.10} stroke={s.color} strokeWidth="0.5" strokeOpacity="0.6" />
            </g>
          ))}

          {PILLARS.map((_, i) => {
            const a = ((i * 360) / n - 90) * (Math.PI / 180);
            const ox = cx + (outerR + 2) * Math.cos(a);
            const oy = cy + (outerR + 2) * Math.sin(a);
            const ix = cx + innerR * Math.cos(a);
            const iy = cy + innerR * Math.sin(a);
            return <line key={i} x1={ix} y1={iy} x2={ox} y2={oy} stroke="#d4af37" strokeWidth="0.5" strokeOpacity="0.5" />;
          })}
        </g>

        {segments.map((s, i) => {
          const rad = s.midAngle * (Math.PI / 180);
          const lx = cx + midR * Math.cos(rad);
          const ly = cy + midR * Math.sin(rad);
          const rot = s.midAngle + 90;
          const short = s.label.length > 6 ? s.label.replace("Protocol", "Proto").replace("Bunker", "Bnkr") : s.label;
          return (
            <text key={i} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle"
              transform={`rotate(${rot} ${lx} ${ly})`}
              fill="#fff" fontSize="8.5" fontWeight="600" fontFamily="Rajdhani, sans-serif" letterSpacing="0.5" opacity="0.9">
              {short}
            </text>
          );
        })}

        <circle cx={cx} cy={cy} r={innerR - 5} fill="#0a0a14" />
        <circle cx={cx} cy={cy} r={innerR - 5} fill="none" stroke="#d4af37" strokeWidth="1.5" filter="url(#glow)" opacity="0.8" />

        <text x={cx} y={cy - 2} textAnchor="middle" dominantBaseline="middle" fill="#d4af37"
          fontSize="36" fontWeight="700" fontFamily="Rajdhani, sans-serif" filter="url(#glow)">K</text>
        <text x={cx} y={cy + 22} textAnchor="middle" fill="#d4af37" fontSize="8" fontFamily="Rajdhani, sans-serif" letterSpacing="3" opacity="0.7">KENO</text>

        <circle cx={cx} cy={cy} r={2} fill="#d4af37" opacity="0.9" />

        {[0.4, 0.6, 0.8, 1.0].map((op, i) => (
          <circle key={i} cx={cx} cy={cy} r={outerR + 15 + i * 10} fill="none" stroke="#d4af37" strokeWidth="0.3" strokeOpacity={op * 0.15} strokeDasharray="4 8" />
        ))}
      </svg>

      <div style={{ marginTop: 28, display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", maxWidth: 360 }}>
        {PILLARS.map((p, i) => (
          <div key={i} style={{ background: "rgba(212,175,55,0.08)", border: "1px solid rgba(212,175,55,0.25)", borderRadius: 6, padding: "4px 10px", color: "#d4af37", fontSize: 11, fontWeight: 600, letterSpacing: 1 }}>
            {i + 1}. {p}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 24, color: "rgba(255,255,255,0.3)", fontSize: 10, letterSpacing: 2, textTransform: "uppercase" }}>
        9 Pillars · 1 Sovereign Economy · BEP-20 · 1B Supply
      </div>
    </div>
  );
}
