import { useEffect, useRef } from "react";

const KENO_GOLD   = "#d4af37";
const SHIELD_BLUE = "#38bdf8";
const QCT_PURPLE  = "#c084fc";
const BG = "#05050f";

export default function TrinityBorromean() {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    let t = 0;
    let raf: number;
    const animate = () => {
      t++;
      const svg = svgRef.current;
      if (!svg) { raf = requestAnimationFrame(animate); return; }

      // Pulse the glow intensity
      const p = (Math.sin(t * 0.025) + 1) / 2;
      const rings = svg.querySelectorAll(".glow-ring");
      rings.forEach((r, i) => {
        const offsets = [0, 0.33, 0.66];
        const pi = (Math.sin(t * 0.025 + offsets[i] * Math.PI * 2) + 1) / 2;
        (r as SVGElement).style.opacity = `${0.5 + pi * 0.5}`;
      });

      const centerDot = svg.querySelector("#center-star");
      if (centerDot) {
        const s = 1 + Math.sin(t * 0.05) * 0.2;
        (centerDot as SVGElement).setAttribute("transform", `scale(${s}) translate(${200 * (1 - s)}, ${200 * (1 - s)})`);
      }

      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Borromean ring centers — equilateral triangle arrangement
  const R = 72;       // ring radius
  const sep = 60;     // center separation
  const cx = 200, cy = 195;

  const rings = [
    // Top — KENO gold
    { x: cx,                        y: cy - sep * 0.65, color: KENO_GOLD,   label: "KENO",   weight: "40%", chain: "BSC" },
    // Bottom-left — SHIELD
    { x: cx - sep * 0.866,          y: cy + sep * 0.5,  color: SHIELD_BLUE, label: "SHIELD", weight: "35%", chain: "SOL" },
    // Bottom-right — QCT
    { x: cx + sep * 0.866,          y: cy + sep * 0.5,  color: QCT_PURPLE,  label: "QCT",    weight: "25%", chain: "HL"  },
  ];

  // Center of all three circles
  const triCx = cx;
  const triCy = cy + (sep * 0.5 - sep * 0.65) / 2;

  return (
    <div style={{ background: BG, width: "100%", height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "monospace" }}>

      <svg ref={svgRef} width="400" height="400" viewBox="0 0 400 400">
        <defs>
          {rings.map((r, i) => (
            <radialGradient key={`rg${i}`} id={`rg${i}`} cx="50%" cy="50%" r="60%">
              <stop offset="0%" stopColor={r.color} stopOpacity="0.0" />
              <stop offset="60%" stopColor={r.color} stopOpacity="0.12" />
              <stop offset="100%" stopColor={r.color} stopOpacity="0.25" />
            </radialGradient>
          ))}
          <radialGradient id="center-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
            <stop offset="40%" stopColor={KENO_GOLD} stopOpacity="0.8" />
            <stop offset="100%" stopColor={KENO_GOLD} stopOpacity="0" />
          </radialGradient>
          <filter id="glow-ring-f">
            <feGaussianBlur stdDeviation="5" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="glow-c">
            <feGaussianBlur stdDeviation="8" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="glow-sm">
            <feGaussianBlur stdDeviation="2.5" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Subtle background grid */}
        <g opacity="0.04">
          {Array.from({ length: 9 }).map((_, i) => (
            <line key={`gh${i}`} x1="0" y1={i * 50} x2="400" y2={i * 50} stroke="#ffffff" strokeWidth="0.5" />
          ))}
          {Array.from({ length: 9 }).map((_, i) => (
            <line key={`gv${i}`} x1={i * 50} y1="0" x2={i * 50} y2="400" stroke="#ffffff" strokeWidth="0.5" />
          ))}
        </g>

        {/* Outer constellation circle */}
        <circle cx={cx} cy={cy} r={148} fill="none" stroke="#ffffff" strokeWidth="0.5" strokeOpacity="0.06" strokeDasharray="3 9" />

        {/* Fill halos (semi-transparent fills) */}
        {rings.map((r, i) => (
          <circle key={`fill${i}`} cx={r.x} cy={r.y} r={R} fill={`url(#rg${i})`} />
        ))}

        {/* Main rings — glow versions (blurred, fat, behind) */}
        {rings.map((r, i) => (
          <circle
            key={`glow${i}`}
            className="glow-ring"
            cx={r.x} cy={r.y} r={R}
            fill="none"
            stroke={r.color}
            strokeWidth="14"
            strokeOpacity="0.25"
            filter="url(#glow-ring-f)"
          />
        ))}

        {/* Main rings — crisp, on top */}
        {rings.map((r, i) => (
          <circle
            key={`ring${i}`}
            cx={r.x} cy={r.y} r={R}
            fill="none"
            stroke={r.color}
            strokeWidth="3.5"
            strokeOpacity="0.95"
          />
        ))}

        {/* Center convergence glow */}
        <circle cx={triCx} cy={triCy} r={28} fill="url(#center-glow)" opacity="0.6" filter="url(#glow-c)" />

        {/* Center star / TRINITY mark */}
        <g id="center-star">
          {/* 6-point star for TRINITY (2 overlapping triangles = Star of David shape, recolored) */}
          {[0, 60, 120, 180, 240, 300].map((angle, i) => {
            const rad = (angle * Math.PI) / 180;
            const x2 = triCx + Math.cos(rad) * 14;
            const y2 = triCy + Math.sin(rad) * 14;
            return <line key={i} x1={triCx} y1={triCy} x2={x2} y2={y2} stroke={KENO_GOLD} strokeWidth="1.5" strokeOpacity="0.9" filter="url(#glow-sm)" />;
          })}
          <circle cx={triCx} cy={triCy} r={6} fill={KENO_GOLD} filter="url(#glow-c)" />
          <circle cx={triCx} cy={triCy} r={2.5} fill="#ffffff" />
        </g>

        {/* Node dots at each ring's top */}
        {rings.map((r, i) => {
          const angles = [-Math.PI / 2, (Math.PI * 5) / 6, Math.PI / 6];
          return (
            <circle
              key={`node${i}`}
              cx={r.x + Math.cos(angles[i]) * R}
              cy={r.y + Math.sin(angles[i]) * R}
              r={5}
              fill={r.color}
              filter="url(#glow-sm)"
            />
          );
        })}

        {/* Token labels */}
        {/* KENO — top */}
        <text x={rings[0].x} y={rings[0].y - R - 18} textAnchor="middle" fill={KENO_GOLD} fontSize="12" fontWeight="bold" letterSpacing="3">KENO</text>
        <text x={rings[0].x} y={rings[0].y - R - 6} textAnchor="middle" fill={KENO_GOLD} fontSize="9" opacity="0.6">{rings[0].weight} · {rings[0].chain}</text>

        {/* SHIELD — bottom-left */}
        <text x={rings[1].x - 30} y={rings[1].y + R + 18} textAnchor="middle" fill={SHIELD_BLUE} fontSize="12" fontWeight="bold" letterSpacing="3">SHIELD</text>
        <text x={rings[1].x - 30} y={rings[1].y + R + 30} textAnchor="middle" fill={SHIELD_BLUE} fontSize="9" opacity="0.6">{rings[1].weight} · {rings[1].chain}</text>

        {/* QCT — bottom-right */}
        <text x={rings[2].x + 30} y={rings[2].y + R + 18} textAnchor="middle" fill={QCT_PURPLE} fontSize="12" fontWeight="bold" letterSpacing="3">QCT</text>
        <text x={rings[2].x + 30} y={rings[2].y + R + 30} textAnchor="middle" fill={QCT_PURPLE} fontSize="9" opacity="0.6">{rings[2].weight} · {rings[2].chain}</text>
      </svg>

      <div style={{ marginTop: -30, textAlign: "center" }}>
        <div style={{ color: "#ffffff", fontSize: 26, fontWeight: "bold", letterSpacing: 10, fontFamily: "monospace", textShadow: `0 0 30px ${KENO_GOLD}66` }}>
          TRINITY
        </div>
        <div style={{ color: KENO_GOLD, fontSize: 10, letterSpacing: 5, marginTop: 5, opacity: 0.7 }}>
          ◈ INDEX ◈
        </div>
        <div style={{ color: "#ffffff", fontSize: 9, opacity: 0.25, letterSpacing: 2, marginTop: 6 }}>
          SOVEREIGN · ECONOMY · PROTOCOL
        </div>
      </div>

      <div style={{ marginTop: 18, color: "#ffffff", fontSize: 10, opacity: 0.2, letterSpacing: 3 }}>
        CONCEPT C · BORROMEAN RINGS
      </div>
    </div>
  );
}
