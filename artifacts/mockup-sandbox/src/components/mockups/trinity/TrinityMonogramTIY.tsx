import { useEffect, useRef } from "react";

export default function TrinityMonogramTIY() {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    let t = 0, raf: number;
    const go = () => {
      t++;
      const svg = svgRef.current;
      if (svg) {
        const p  = (Math.sin(t * 0.018) + 1) / 2;
        const p2 = (Math.sin(t * 0.018 + Math.PI) + 1) / 2;
        const aura = svg.querySelector<SVGElement>("#tiy-aura");
        if (aura) aura.style.opacity = `${0.22 + p * 0.18}`;
        // The I-bar pulses independently
        const ibar = svg.querySelector<SVGElement>("#tiy-ibar-glow");
        if (ibar) ibar.style.opacity = `${0.4 + p2 * 0.5}`;
        const ring = svg.querySelector<SVGElement>("#tiy-ring");
        if (ring) ring.setAttribute("transform", `rotate(${-t * 0.05}, 200, 218)`);
      }
      raf = requestAnimationFrame(go);
    };
    raf = requestAnimationFrame(go);
    return () => cancelAnimationFrame(raf);
  }, []);

  const CX = 200, TOP = 108, JY = 215, BOT = 352;
  const BAR_L = 94, BAR_R = 306;     // T crossbar — widest
  const ARM_L = 133, ARM_R = 267;    // Y arm endpoints on crossbar line

  // I-bar: cuts across the Y arms at 55% of the way from TOP to JY
  const I_Y = TOP + (JY - TOP) * 0.52;  // ≈ 168
  // Where the Y arms pass at that height:
  const frac = (I_Y - TOP) / (JY - TOP);
  const I_L = ARM_L + (CX - ARM_L) * frac;  // left arm x at I_Y
  const I_R = ARM_R + (CX - ARM_R) * frac;  // right arm x at I_Y
  // I-bar extends a little beyond the arm positions
  const IB_L = I_L - 10, IB_R = I_R + 10;

  const SW = 16;

  return (
    <div style={{
      background: "radial-gradient(ellipse at 50% 38%, #100d1a 0%, #050508 72%)",
      width: "100%", height: "100vh",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      fontFamily: "'Georgia', serif",
    }}>
      <svg ref={svgRef} width="400" height="440" viewBox="0 0 400 440">
        <defs>
          {/* T + Y — warm gold */}
          <linearGradient id="tiy-gold-v" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"   stopColor="#ffe97a" />
            <stop offset="40%"  stopColor="#d4af37" />
            <stop offset="100%" stopColor="#7a5800" />
          </linearGradient>

          {/* I — cooler, brighter gold to contrast */}
          <linearGradient id="tiy-i-gold" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor="#fff1a0" />
            <stop offset="50%"  stopColor="#ffe97a" />
            <stop offset="100%" stopColor="#fff1a0" />
          </linearGradient>

          <radialGradient id="tiy-aura-g" cx="50%" cy="44%" r="50%">
            <stop offset="0%"   stopColor="#c084fc" stopOpacity="0.22" />
            <stop offset="45%"  stopColor="#d4af37" stopOpacity="0.18" />
            <stop offset="100%" stopColor="transparent" stopOpacity="0"  />
          </radialGradient>

          <filter id="tiy-glow" x="-45%" y="-45%" width="190%" height="190%">
            <feGaussianBlur stdDeviation="10" result="b" />
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id="tiy-glow-sm" x="-25%" y="-25%" width="150%" height="150%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id="tiy-i-glow" x="-60%" y="-200%" width="220%" height="500%">
            <feGaussianBlur stdDeviation="7" result="b" />
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        {/* Aura */}
        <ellipse id="tiy-aura" cx={CX} cy="218" rx="185" ry="165" fill="url(#tiy-aura-g)" />

        {/* Outer ring */}
        <circle cx={CX} cy="218" r="170" fill="none" stroke="#d4af37" strokeWidth="0.5" strokeOpacity="0.12" />
        <circle id="tiy-ring" cx={CX} cy="218" r="178"
          fill="none" stroke="#c084fc" strokeWidth="0.7"
          strokeOpacity="0.15" strokeDasharray="4 14" />

        {/* ══ Heavy glow layer ══ */}
        <g filter="url(#tiy-glow)" strokeLinecap="round" strokeLinejoin="round"
           stroke="#d4af37" strokeWidth={SW + 12} fill="none" strokeOpacity="0.45">
          <line x1={BAR_L} y1={TOP}  x2={BAR_R} y2={TOP}  />
          <line x1={CX}    y1={TOP}  x2={CX}    y2={BOT}  />
          <line x1={ARM_L} y1={TOP}  x2={CX}    y2={JY}   />
          <line x1={ARM_R} y1={TOP}  x2={CX}    y2={JY}   />
        </g>

        {/* ══ T + Y crisp strokes ══ */}
        <g filter="url(#tiy-glow-sm)" strokeLinecap="round" strokeLinejoin="round"
           stroke="url(#tiy-gold-v)" strokeWidth={SW} fill="none">
          <line x1={BAR_L} y1={TOP} x2={BAR_R} y2={TOP} />
          <line x1={CX}    y1={TOP} x2={CX}    y2={BOT} />
          <line x1={ARM_L} y1={TOP} x2={CX}    y2={JY}  />
          <line x1={ARM_R} y1={TOP} x2={CX}    y2={JY}  />
        </g>

        {/* ══ I — the inner bar, a third element, brighter ══ */}
        {/* Glow for I */}
        <line id="tiy-ibar-glow"
          x1={IB_L} y1={I_Y} x2={IB_R} y2={I_Y}
          stroke="#ffe97a" strokeWidth={SW + 8}
          strokeLinecap="round" filter="url(#tiy-i-glow)" strokeOpacity="0.6" />
        {/* Crisp I */}
        <line
          x1={IB_L} y1={I_Y} x2={IB_R} y2={I_Y}
          stroke="url(#tiy-i-gold)" strokeWidth={SW - 2}
          strokeLinecap="round" filter="url(#tiy-glow-sm)" />

        {/* ══ Terminal dots ══ */}
        {/* T crossbar ends */}
        {[BAR_L, BAR_R].map((x, i) => (
          <circle key={i} cx={x} cy={TOP} r={SW / 2 + 1.5}
            fill="#ffe97a" filter="url(#tiy-glow-sm)" />
        ))}
        {/* I bar ends */}
        {[IB_L, IB_R].map((x, i) => (
          <circle key={i} cx={x} cy={I_Y} r={SW / 2 - 1}
            fill="#fff1a0" filter="url(#tiy-glow-sm)" opacity="0.85" />
        ))}
        {/* Y junction */}
        <circle cx={CX} cy={JY} r={8} fill="#ffe97a" filter="url(#tiy-glow)" />
        <circle cx={CX} cy={JY} r={4} fill="#ffffff" />
        {/* Bottom */}
        <circle cx={CX} cy={BOT} r={SW / 2 + 1} fill="#d4af37" filter="url(#tiy-glow-sm)" />

        {/* ══ Letter annotation (tiny, faint — the decode) ══ */}
        <text x={BAR_L - 18} y={TOP + 5} fill="#d4af37" fontSize="9"
          fontStyle="italic" opacity="0.22" textAnchor="middle">T</text>
        <text x={CX} y={I_Y - 16} fill="#ffe97a" fontSize="9"
          fontStyle="italic" opacity="0.22" textAnchor="middle">I</text>
        <text x={CX + 40} y={JY - 20} fill="#d4af37" fontSize="9"
          fontStyle="italic" opacity="0.22" textAnchor="middle">Y</text>

        {/* ══ TRINITY INDEX label ══ */}
        <line x1={CX - 90} y1={396} x2={CX + 90} y2={396}
          stroke="#d4af37" strokeWidth="0.6" strokeOpacity="0.28" />
        <text x={CX} y="419" textAnchor="middle"
          fill="#d4af37" fontSize="22" fontWeight="bold" letterSpacing="10">
          TRINITY
        </text>
        <text x={CX} y="435" textAnchor="middle"
          fill="#c084fc" fontSize="9" letterSpacing="8" opacity="0.5">
          INDEX
        </text>
      </svg>

      <div style={{ marginTop: -10, textAlign: "center" }}>
        <div style={{ color: "#d4af37", fontSize: 10, opacity: 0.32, letterSpacing: 4 }}>
          T · I · Y — three letters, one sovereign mark
        </div>
      </div>
    </div>
  );
}
