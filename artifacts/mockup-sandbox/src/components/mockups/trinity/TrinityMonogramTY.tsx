import { useEffect, useRef } from "react";

export default function TrinityMonogramTY() {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    let t = 0, raf: number;
    const go = () => {
      t++;
      const svg = svgRef.current;
      if (svg) {
        // Slow breathing pulse on the outer glow
        const p = (Math.sin(t * 0.018) + 1) / 2;
        const aura = svg.querySelector<SVGElement>("#ty-aura");
        if (aura) aura.style.opacity = `${0.25 + p * 0.2}`;
        // Rotate outer dashed ring slowly
        const ring = svg.querySelector<SVGElement>("#ty-dashed");
        if (ring) ring.setAttribute("transform", `rotate(${t * 0.06}, 200, 215)`);
      }
      raf = requestAnimationFrame(go);
    };
    raf = requestAnimationFrame(go);
    return () => cancelAnimationFrame(raf);
  }, []);

  // ── Geometry ──
  const CX = 200, TOP = 112, JY = 210, BOT = 348;
  const BAR_L = 98, BAR_R = 302;   // T crossbar — extends wide
  const ARM_L = 136, ARM_R = 264;  // Y arm endpoints on the crossbar line
  // (crossbar extends 38px beyond each arm endpoint on both sides)

  const SW = 17; // stroke weight

  return (
    <div style={{
      background: "radial-gradient(ellipse at 50% 38%, #111820 0%, #06080a 70%)",
      width: "100%", height: "100vh",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      fontFamily: "'Georgia', serif",
    }}>
      <svg ref={svgRef} width="400" height="430" viewBox="0 0 400 430">
        <defs>
          {/* Gold gradient along the stroke */}
          <linearGradient id="ty-gold" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"   stopColor="#ffe97a" />
            <stop offset="35%"  stopColor="#d4af37" />
            <stop offset="100%" stopColor="#8b6914" />
          </linearGradient>

          {/* Outer aura */}
          <radialGradient id="ty-aura-grad" cx="50%" cy="45%" r="50%">
            <stop offset="0%"   stopColor="#d4af37" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#d4af37" stopOpacity="0"   />
          </radialGradient>

          {/* Glow filter — heavy */}
          <filter id="ty-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="9" result="blur" />
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>

          {/* Glow filter — light (for crisp layer) */}
          <filter id="ty-glow-sm" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        {/* Background aura */}
        <ellipse id="ty-aura" cx={CX} cy="215" rx="180" ry="155" fill="url(#ty-aura-grad)" />

        {/* Outer decorative ring */}
        <circle cx={CX} cy="215" r="168" fill="none" stroke="#d4af37" strokeWidth="0.6" strokeOpacity="0.15" />
        <circle id="ty-dashed" cx={CX} cy="215" r="176"
          fill="none" stroke="#d4af37" strokeWidth="0.8"
          strokeOpacity="0.18" strokeDasharray="5 12" />

        {/* ══ Layer 1: Heavy glow (blurred, thick) ══ */}
        <g filter="url(#ty-glow)" strokeLinecap="round" strokeLinejoin="round"
           stroke="#d4af37" strokeWidth={SW + 10} fill="none" strokeOpacity="0.55">
          {/* T crossbar */}
          <line x1={BAR_L} y1={TOP} x2={BAR_R} y2={TOP} />
          {/* T/Y shared spine */}
          <line x1={CX} y1={TOP} x2={CX} y2={BOT} />
          {/* Y left arm */}
          <line x1={ARM_L} y1={TOP} x2={CX} y2={JY} />
          {/* Y right arm */}
          <line x1={ARM_R} y1={TOP} x2={CX} y2={JY} />
        </g>

        {/* ══ Layer 2: Crisp gold strokes ══ */}
        <g filter="url(#ty-glow-sm)" strokeLinecap="round" strokeLinejoin="round"
           stroke="url(#ty-gold)" strokeWidth={SW} fill="none">
          {/* T crossbar — full width */}
          <line x1={BAR_L} y1={TOP} x2={BAR_R} y2={TOP} />
          {/* Spine (T stem + Y stem, shared) */}
          <line x1={CX} y1={TOP} x2={CX} y2={BOT} />
          {/* Y left arm — meets crossbar INSIDE the T ends */}
          <line x1={ARM_L} y1={TOP} x2={CX} y2={JY} />
          {/* Y right arm */}
          <line x1={ARM_R} y1={TOP} x2={CX} y2={JY} />
        </g>

        {/* ══ Cap dots at crossbar ends (T terminals) ══ */}
        {[BAR_L, BAR_R].map((x, i) => (
          <circle key={i} cx={x} cy={TOP} r={SW / 2 + 1}
            fill="#ffe97a" filter="url(#ty-glow-sm)" />
        ))}

        {/* Junction accent circle */}
        <circle cx={CX} cy={JY} r={7} fill="#ffe97a" filter="url(#ty-glow)" />
        <circle cx={CX} cy={JY} r={3.5} fill="#ffffff" />

        {/* Bottom cap dot */}
        <circle cx={CX} cy={BOT} r={SW / 2 + 1} fill="#d4af37" filter="url(#ty-glow-sm)" />

        {/* ══ Hidden-letter hint lines (very faint) ══ */}
        {/* Faint vertical T outline — shows where T lives */}
        <line x1={CX} y1={TOP - 18} x2={CX} y2={TOP + 4}
          stroke="#d4af37" strokeWidth="1" strokeOpacity="0.15" />

        {/* ══ TRINITY INDEX label ══ */}
        <line x1={CX - 85} y1={390} x2={CX + 85} y2={390}
          stroke="#d4af37" strokeWidth="0.6" strokeOpacity="0.3" />
        <text x={CX} y="413" textAnchor="middle"
          fill="#d4af37" fontSize="22" fontWeight="bold" letterSpacing="10">
          TRINITY
        </text>
        <text x={CX} y="428" textAnchor="middle"
          fill="#d4af37" fontSize="9" letterSpacing="8" opacity="0.55">
          INDEX
        </text>
      </svg>

      {/* Decode hint */}
      <div style={{ marginTop: -8, textAlign: "center" }}>
        <div style={{ color: "#d4af37", fontSize: 10, opacity: 0.35, letterSpacing: 4 }}>
          T · Y — two letters, one mark
        </div>
      </div>
    </div>
  );
}
