import { useEffect, useRef } from "react";

const GOLD1 = "#f0c040";
const GOLD2 = "#d4af37";
const GOLD3 = "#b8860b";
const CREAM = "#fff8e7";
const BG_TOP = "#1a2a10";
const BG_BOT = "#0a0a0a";

/* ── Icon: Open Crown ─────────────────────────────────────── */
function CrownIcon({ cx, cy, size = 36 }: { cx: number; cy: number; size?: number }) {
  const s = size / 36;
  const t = (x: number, y: number) => `${cx + x * s},${cy + y * s}`;
  return (
    <g filter="url(#glow-icon)">
      {/* Crown base band */}
      <rect x={cx - 20 * s} y={cy + 10 * s} width={40 * s} height={8 * s} rx={2 * s} fill={GOLD1} />
      {/* Crown body */}
      <polygon
        points={`${t(-20, 10)} ${t(-20, -2)} ${t(-10, -14)} ${t(0, -4)} ${t(10, -14)} ${t(20, -2)} ${t(20, 10)}`}
        fill={GOLD2}
        stroke={GOLD1}
        strokeWidth={1.2 * s}
        strokeLinejoin="round"
      />
      {/* Jewels on points */}
      <circle cx={cx - 10 * s} cy={cy - 14 * s} r={3.5 * s} fill={CREAM} stroke={GOLD3} strokeWidth={0.8 * s} />
      <circle cx={cx} cy={cy - 4 * s} r={3.5 * s} fill={GOLD1} stroke={GOLD3} strokeWidth={0.8 * s} />
      <circle cx={cx + 10 * s} cy={cy - 14 * s} r={3.5 * s} fill={CREAM} stroke={GOLD3} strokeWidth={0.8 * s} />
      {/* Center jewel on band */}
      <circle cx={cx} cy={cy + 14 * s} r={3 * s} fill={CREAM} stroke={GOLD3} strokeWidth={0.8 * s} />
    </g>
  );
}

/* ── Icon: Open Book ──────────────────────────────────────── */
function BookIcon({ cx, cy, size = 36 }: { cx: number; cy: number; size?: number }) {
  const s = size / 36;
  return (
    <g filter="url(#glow-icon)">
      {/* Left page */}
      <path
        d={`M ${cx - 2 * s},${cy - 18 * s} C ${cx - 12 * s},${cy - 18 * s} ${cx - 22 * s},${cy - 14 * s} ${cx - 22 * s},${cy - 10 * s} L ${cx - 22 * s},${cy + 16 * s} C ${cx - 22 * s},${cy + 18 * s} ${cx - 20 * s},${cy + 20 * s} ${cx - 2 * s},${cy + 18 * s} Z`}
        fill={GOLD2}
        stroke={GOLD1}
        strokeWidth={1 * s}
      />
      {/* Right page */}
      <path
        d={`M ${cx + 2 * s},${cy - 18 * s} C ${cx + 12 * s},${cy - 18 * s} ${cx + 22 * s},${cy - 14 * s} ${cx + 22 * s},${cy - 10 * s} L ${cx + 22 * s},${cy + 16 * s} C ${cx + 22 * s},${cy + 18 * s} ${cx + 20 * s},${cy + 20 * s} ${cx + 2 * s},${cy + 18 * s} Z`}
        fill={GOLD2}
        stroke={GOLD1}
        strokeWidth={1 * s}
      />
      {/* Spine */}
      <rect x={cx - 2.5 * s} y={cy - 18 * s} width={5 * s} height={36 * s} rx={1.5 * s} fill={GOLD1} />
      {/* Left page lines */}
      {[-8, -2, 4, 10].map((y, i) => (
        <line key={i} x1={cx - 18 * s} y1={cy + y * s} x2={cx - 5 * s} y2={cy + y * s} stroke={CREAM} strokeWidth={1 * s} strokeOpacity="0.5" />
      ))}
      {/* Right page lines */}
      {[-8, -2, 4, 10].map((y, i) => (
        <line key={i} x1={cx + 5 * s} y1={cy + y * s} x2={cx + 18 * s} y2={cy + y * s} stroke={CREAM} strokeWidth={1 * s} strokeOpacity="0.5" />
      ))}
    </g>
  );
}

/* ── Icon: Chariot Wheel ──────────────────────────────────── */
function WheelIcon({ cx, cy, size = 36 }: { cx: number; cy: number; size?: number }) {
  const R = size * 0.52;
  const Ri = R * 0.28;
  const spokes = 8;
  return (
    <g filter="url(#glow-icon)">
      {/* Outer ring */}
      <circle cx={cx} cy={cy} r={R} fill="none" stroke={GOLD1} strokeWidth={4 * (size / 36)} />
      {/* Inner hub */}
      <circle cx={cx} cy={cy} r={Ri} fill={GOLD2} stroke={GOLD1} strokeWidth={2 * (size / 36)} />
      {/* Spokes */}
      {Array.from({ length: spokes }).map((_, i) => {
        const angle = (i * Math.PI * 2) / spokes;
        return (
          <line
            key={i}
            x1={cx + Math.cos(angle) * Ri}
            y1={cy + Math.sin(angle) * Ri}
            x2={cx + Math.cos(angle) * R}
            y2={cy + Math.sin(angle) * R}
            stroke={GOLD1}
            strokeWidth={2.5 * (size / 36)}
            strokeLinecap="round"
          />
        );
      })}
      {/* Center dot */}
      <circle cx={cx} cy={cy} r={4 * (size / 36)} fill={CREAM} />
    </g>
  );
}

/* ── Main component ───────────────────────────────────────── */
export default function TrinityHeraldic() {
  const svgRef = useRef<SVGSVGElement>(null);

  /* Subtle shimmer */
  useEffect(() => {
    let t = 0, raf: number;
    const go = () => {
      t++;
      const svg = svgRef.current;
      if (svg) {
        const shimmer = (Math.sin(t * 0.02) + 1) / 2;
        const aura = svg.querySelector<SVGElement>("#aura");
        if (aura) aura.style.opacity = `${0.18 + shimmer * 0.12}`;
      }
      raf = requestAnimationFrame(go);
    };
    raf = requestAnimationFrame(go);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Triquetra geometry — three interlocking pointed ovals
  // Each oval is a vesica piscis drawn with two large arcs
  const CX = 200, CY = 195;
  const R = 90;   // oval radius
  const D = 54;   // center separation (< R for overlap)

  // The three oval-center pairs (each oval is formed by two circles)
  // Top oval (crown): centered going upward
  // Bot-left oval (book): centered going lower-left
  // Bot-right oval (wheel): centered going lower-right

  // Triquetra path — classic three-loop construction
  // Using the "three circles" approach:
  // Circle A center: (CX, CY - D)  → top
  // Circle B center: (CX - D*sin60, CY + D*cos60) → bottom-left
  // Circle C center: (CX + D*sin60, CY + D*cos60) → bottom-right
  const sin60 = Math.sqrt(3) / 2;
  const centers = [
    { x: CX,              y: CY - D,             icon: "crown",  label: "SHIELD",  weight: "35%", color: "#4db8ff" },
    { x: CX - D * sin60,  y: CY + D * 0.5,       icon: "book",   label: "KENO",    weight: "40%", color: GOLD2     },
    { x: CX + D * sin60,  y: CY + D * 0.5,       icon: "wheel",  label: "QCT",     weight: "25%", color: "#a855f7" },
  ];

  // Icon positions — further out from each circle center
  const iconOffset = R * 0.72;
  const iconPositions = [
    { x: CX,                         y: CY - D - iconOffset * 0.9,  size: 38 },
    { x: CX - (D + iconOffset) * sin60 * 0.95, y: CY + (D + iconOffset * 0.7) * 0.5, size: 34 },
    { x: CX + (D + iconOffset) * sin60 * 0.95, y: CY + (D + iconOffset * 0.7) * 0.5, size: 34 },
  ];

  return (
    <div style={{
      background: `radial-gradient(ellipse at 50% 35%, ${BG_TOP} 0%, ${BG_BOT} 75%)`,
      width: "100%", height: "100vh",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      fontFamily: "'Georgia', 'Times New Roman', serif",
    }}>

      <svg ref={svgRef} width="400" height="420" viewBox="0 0 400 420">
        <defs>
          {/* Gold gradient for the triquetra fill */}
          <linearGradient id="gold-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="#f9e07a" />
            <stop offset="40%"  stopColor={GOLD2} />
            <stop offset="100%" stopColor={GOLD3} />
          </linearGradient>

          {/* Radial aura behind the symbol */}
          <radialGradient id="aura-grad" cx="50%" cy="48%" r="50%">
            <stop offset="0%"   stopColor={GOLD2}    stopOpacity="0.35" />
            <stop offset="60%"  stopColor={GOLD3}    stopOpacity="0.12" />
            <stop offset="100%" stopColor="transparent" stopOpacity="0"  />
          </radialGradient>

          {/* Glow filter for the triquetra lines */}
          <filter id="glow-line" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="5" result="b" />
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>

          {/* Softer glow for icons */}
          <filter id="glow-icon" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="3.5" result="b" />
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>

          {/* Drop shadow */}
          <filter id="shadow">
            <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor={GOLD3} floodOpacity="0.5" />
          </filter>
        </defs>

        {/* Aura glow behind everything */}
        <ellipse id="aura" cx={CX} cy={CY} rx="175" ry="160" fill="url(#aura-grad)" />

        {/* ── Triquetra — three interlocking circles (large arcs) ── */}
        {/* We draw each circle as a full stroke, creating the triquetra
            The weave effect is approximated by draw order + opacity */}

        {/* Layer 1: thick glow halos */}
        {centers.map((c, i) => (
          <circle
            key={`halo${i}`}
            cx={c.x} cy={c.y} r={R}
            fill="none"
            stroke="url(#gold-grad)"
            strokeWidth="20"
            strokeOpacity="0.15"
          />
        ))}

        {/* Layer 2: the actual triquetra rings */}
        {centers.map((c, i) => (
          <circle
            key={`ring${i}`}
            cx={c.x} cy={c.y} r={R}
            fill="none"
            stroke="url(#gold-grad)"
            strokeWidth="7"
            strokeOpacity="0.95"
            filter="url(#glow-line)"
          />
        ))}

        {/* ── Center convergence — small gold triangle + star ── */}
        <polygon
          points={`${CX},${CY - 16} ${CX - 14},${CY + 8} ${CX + 14},${CY + 8}`}
          fill={GOLD1}
          fillOpacity="0.25"
          stroke={GOLD1}
          strokeWidth="1.5"
          strokeOpacity="0.8"
        />
        <circle cx={CX} cy={CY} r={9} fill={GOLD1} filter="url(#glow-line)" />
        <circle cx={CX} cy={CY} r={4} fill={CREAM} />

        {/* ── Decorative outer ring ── */}
        <circle cx={CX} cy={CY} r={152} fill="none" stroke={GOLD2} strokeWidth="1" strokeOpacity="0.2" strokeDasharray="6 10" />
        <circle cx={CX} cy={CY} r={158} fill="none" stroke={GOLD2} strokeWidth="0.5" strokeOpacity="0.1" />

        {/* ── Tick marks on outer ring ── */}
        {Array.from({ length: 36 }).map((_, i) => {
          const angle = (i * Math.PI * 2) / 36;
          const isMain = i % 3 === 0;
          const r1 = isMain ? 145 : 149;
          return (
            <line
              key={i}
              x1={CX + Math.cos(angle) * r1}
              y1={CY + Math.sin(angle) * r1}
              x2={CX + Math.cos(angle) * 152}
              y2={CY + Math.sin(angle) * 152}
              stroke={GOLD2}
              strokeWidth={isMain ? 1.5 : 0.8}
              strokeOpacity={isMain ? 0.5 : 0.2}
            />
          );
        })}

        {/* ── Icons ── */}
        <CrownIcon cx={iconPositions[0].x} cy={iconPositions[0].y} size={iconPositions[0].size} />
        <BookIcon  cx={iconPositions[1].x} cy={iconPositions[1].y} size={iconPositions[1].size} />
        <WheelIcon cx={iconPositions[2].x} cy={iconPositions[2].y} size={iconPositions[2].size} />

        {/* ── Token label beneath each icon ── */}
        {/* SHIELD above */}
        <text x={iconPositions[0].x} y={iconPositions[0].y - iconPositions[0].size / 2 - 12} textAnchor="middle" fill={GOLD1} fontSize="11" fontWeight="bold" letterSpacing="3">SHIELD</text>

        {/* KENO bottom-left */}
        <text x={iconPositions[1].x - 8} y={iconPositions[1].y + iconPositions[1].size / 2 + 16} textAnchor="middle" fill={GOLD1} fontSize="11" fontWeight="bold" letterSpacing="3">KENO</text>

        {/* QCT bottom-right */}
        <text x={iconPositions[2].x + 8} y={iconPositions[2].y + iconPositions[2].size / 2 + 16} textAnchor="middle" fill={GOLD1} fontSize="11" fontWeight="bold" letterSpacing="3">QCT</text>

        {/* Weight badges */}
        {centers.map((c, i) => {
          const pos = iconPositions[i];
          const yOff = i === 0 ? -iconPositions[0].size / 2 - 24 : pos.size / 2 + 28;
          const xOff = i === 0 ? 0 : i === 1 ? -8 : 8;
          return (
            <text key={i}
              x={pos.x + xOff} y={pos.y + yOff}
              textAnchor="middle" fill={GOLD2} fontSize="9" opacity="0.65" letterSpacing="1"
            >
              {c.weight}
            </text>
          );
        })}

        {/* TRINITY INDEX title area — sits below the symbol */}
        <line x1={CX - 80} y1={370} x2={CX + 80} y2={370} stroke={GOLD2} strokeWidth="0.7" strokeOpacity="0.4" />
        <text x={CX} y={392} textAnchor="middle" fill={GOLD1} fontSize="24" fontWeight="bold" letterSpacing="10" filter="url(#shadow)">
          TRINITY
        </text>
        <text x={CX} y={410} textAnchor="middle" fill={GOLD2} fontSize="10" letterSpacing="8" opacity="0.75">
          INDEX
        </text>
      </svg>

      {/* Token row */}
      <div style={{ display: "flex", gap: 28, marginTop: 6, justifyContent: "center" }}>
        {[
          { label: "👑 King's Shield", sub: "SHIELD · 35%", color: "#4db8ff" },
          { label: "📖 Kenostod",      sub: "KENO · 40%",  color: GOLD2     },
          { label: "⚔️ Queens Chariot", sub: "QCT · 25%",  color: "#a855f7" },
        ].map(t => (
          <div key={t.label} style={{ textAlign: "center" }}>
            <div style={{ color: t.color, fontSize: 10, fontWeight: "bold", letterSpacing: 1 }}>{t.label}</div>
            <div style={{ color: "#ffffff", fontSize: 9, opacity: 0.45, marginTop: 2 }}>{t.sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
