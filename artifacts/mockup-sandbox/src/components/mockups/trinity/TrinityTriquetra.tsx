import { useEffect, useRef } from "react";

const KENO_GOLD = "#d4af37";
const SHIELD_BLUE = "#4db8ff";
const QCT_PURPLE = "#a855f7";
const BG = "#0a0a0f";

export default function TrinityTriquetra() {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    let frame = 0;
    let raf: number;
    const animate = () => {
      frame++;
      const svg = svgRef.current;
      if (svg) {
        const rot = svg.querySelector("#rot-group");
        if (rot) rot.setAttribute("transform", `rotate(${frame * 0.18}, 200, 200)`);
        const pulse = 1 + Math.sin(frame * 0.04) * 0.03;
        const glow = svg.querySelector("#glow-group");
        if (glow) glow.setAttribute("transform", `scale(${pulse}) translate(${200 * (1 - pulse)}, ${200 * (1 - pulse)})`);
      }
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, []);

  const R = 80;
  const cx = 200, cy = 200;
  const offset = 48;

  const centers = [
    { x: cx, y: cy - offset, color: KENO_GOLD, label: "KENO", sub: "BSC · 40%" },
    { x: cx - offset * 0.866, y: cy + offset * 0.5, color: SHIELD_BLUE, label: "SHIELD", sub: "SOL · 35%" },
    { x: cx + offset * 0.866, y: cy + offset * 0.5, color: QCT_PURPLE, label: "QCT", sub: "HL · 25%" },
  ];

  return (
    <div style={{ background: BG, width: "100%", height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'Georgia', serif" }}>
      <svg ref={svgRef} width="400" height="400" viewBox="0 0 400 400">
        <defs>
          {centers.map((c, i) => (
            <radialGradient key={i} id={`grad${i}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={c.color} stopOpacity="0.7" />
              <stop offset="100%" stopColor={c.color} stopOpacity="0.0" />
            </radialGradient>
          ))}
          <filter id="glow-f">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="glow-lg">
            <feGaussianBlur stdDeviation="10" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Background glow halos */}
        <g id="glow-group">
          {centers.map((c, i) => (
            <circle key={i} cx={c.x} cy={c.y} r={R + 30} fill={`url(#grad${i})`} opacity="0.5" />
          ))}
        </g>

        {/* Rotating triquetra loops */}
        <g id="rot-group">
          {centers.map((c, i) => (
            <circle
              key={i}
              cx={c.x}
              cy={c.y}
              r={R}
              fill="none"
              stroke={c.color}
              strokeWidth="5"
              strokeOpacity="0.9"
              filter="url(#glow-f)"
            />
          ))}
        </g>

        {/* Static outer ring */}
        <circle cx={cx} cy={cy} r={130} fill="none" stroke="#ffffff" strokeWidth="1" strokeOpacity="0.08" />
        <circle cx={cx} cy={cy} r={135} fill="none" stroke={KENO_GOLD} strokeWidth="0.5" strokeOpacity="0.3" strokeDasharray="4 8" />

        {/* Center convergence dot */}
        <circle cx={cx} cy={cy} r={10} fill="#ffffff" opacity="0.95" filter="url(#glow-lg)" />
        <circle cx={cx} cy={cy} r={5} fill={KENO_GOLD} />

        {/* Token dots on their circles */}
        {centers.map((c, i) => (
          <g key={i}>
            <circle cx={c.x} cy={c.y - R} r={6} fill={c.color} filter="url(#glow-f)" />
          </g>
        ))}

        {/* Labels outside */}
        <text x={cx} y={cy - offset - R - 16} textAnchor="middle" fill={KENO_GOLD} fontSize="13" fontWeight="bold" letterSpacing="2">KENO</text>
        <text x={cx - (offset * 0.866) - R * 0.7} y={cy + offset * 0.5 + R * 0.5 + 12} textAnchor="middle" fill={SHIELD_BLUE} fontSize="13" fontWeight="bold" letterSpacing="2">SHIELD</text>
        <text x={cx + (offset * 0.866) + R * 0.7} y={cy + offset * 0.5 + R * 0.5 + 12} textAnchor="middle" fill={QCT_PURPLE} fontSize="13" fontWeight="bold" letterSpacing="2">QCT</text>
      </svg>

      <div style={{ marginTop: -20, textAlign: "center" }}>
        <div style={{ color: "#ffffff", fontSize: 26, fontWeight: "bold", letterSpacing: 6, textTransform: "uppercase" }}>
          TRINITY
        </div>
        <div style={{ color: KENO_GOLD, fontSize: 11, letterSpacing: 4, marginTop: 4, opacity: 0.8 }}>
          INDEX · ONE CONTRACT · THREE ECOSYSTEMS
        </div>
        <div style={{ display: "flex", gap: 24, marginTop: 16, justifyContent: "center" }}>
          {[
            { label: "KENO", pct: "40%", color: KENO_GOLD },
            { label: "SHIELD", pct: "35%", color: SHIELD_BLUE },
            { label: "QCT", pct: "25%", color: QCT_PURPLE },
          ].map(t => (
            <div key={t.label} style={{ textAlign: "center" }}>
              <div style={{ color: t.color, fontSize: 12, fontWeight: "bold", letterSpacing: 1 }}>{t.label}</div>
              <div style={{ color: "#ffffff", fontSize: 11, opacity: 0.6 }}>{t.pct}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 24, color: "#ffffff", fontSize: 10, opacity: 0.3, letterSpacing: 3 }}>
        CONCEPT A · TRIQUETRA
      </div>
    </div>
  );
}
