import { useEffect, useRef } from "react";

const KENO_GOLD = "#d4af37";
const SHIELD_BLUE = "#4db8ff";
const QCT_PURPLE = "#a855f7";
const BG = "#060610";

export default function TrinityCrown() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let t = 0;
    let raf: number;
    const animate = () => {
      t++;
      if (ref.current) {
        const shimmer = (Math.sin(t * 0.03) + 1) / 2;
        ref.current.style.setProperty("--shimmer", `${shimmer}`);
      }
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div ref={ref} style={{ background: `radial-gradient(ellipse at center, #0d0d20 0%, ${BG} 100%)`, width: "100%", height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'Georgia', serif" }}>

      <svg width="380" height="340" viewBox="0 0 380 340">
        <defs>
          <filter id="glow-gold">
            <feGaussianBlur stdDeviation="6" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="glow-sm">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <linearGradient id="base-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={SHIELD_BLUE} stopOpacity="0.8" />
            <stop offset="50%" stopColor={KENO_GOLD} />
            <stop offset="100%" stopColor={QCT_PURPLE} stopOpacity="0.8" />
          </linearGradient>
          <linearGradient id="center-tri" x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor={KENO_GOLD} />
            <stop offset="100%" stopColor="#b8860b" />
          </linearGradient>
          <linearGradient id="left-tri" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={SHIELD_BLUE} />
            <stop offset="100%" stopColor="#1e6ea3" />
          </linearGradient>
          <linearGradient id="right-tri" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={QCT_PURPLE} />
            <stop offset="100%" stopColor="#6b21a8" />
          </linearGradient>
        </defs>

        {/* Background glow */}
        <ellipse cx="190" cy="180" rx="160" ry="120" fill={KENO_GOLD} fillOpacity="0.04" />

        {/* === LEFT SPIRE (SHIELD) === */}
        {/* Shadow/depth */}
        <polygon points="80,260 130,90 180,260" fill={SHIELD_BLUE} opacity="0.12" transform="translate(3,4)" />
        {/* Main triangle */}
        <polygon points="80,260 130,90 180,260" fill="url(#left-tri)" opacity="0.92" filter="url(#glow-sm)" />
        {/* Edge highlight */}
        <polygon points="80,260 130,90 180,260" fill="none" stroke={SHIELD_BLUE} strokeWidth="1.5" strokeOpacity="0.5" />
        {/* Inner shine */}
        <polygon points="105,220 130,118 155,220" fill="#ffffff" fillOpacity="0.06" />

        {/* === RIGHT SPIRE (QCT) === */}
        <polygon points="200,260 250,90 300,260" fill={QCT_PURPLE} opacity="0.12" transform="translate(3,4)" />
        <polygon points="200,260 250,90 300,260" fill="url(#right-tri)" opacity="0.92" filter="url(#glow-sm)" />
        <polygon points="200,260 250,90 300,260" fill="none" stroke={QCT_PURPLE} strokeWidth="1.5" strokeOpacity="0.5" />
        <polygon points="225,220 250,118 275,220" fill="#ffffff" fillOpacity="0.06" />

        {/* === CENTER SPIRE (KENO) — tallest, front === */}
        <polygon points="140,262 190,40 240,262" fill={KENO_GOLD} opacity="0.15" transform="translate(3,5)" />
        <polygon points="140,262 190,40 240,262" fill="url(#center-tri)" opacity="0.95" filter="url(#glow-gold)" />
        <polygon points="140,262 190,40 240,262" fill="none" stroke={KENO_GOLD} strokeWidth="2" strokeOpacity="0.7" />
        <polygon points="165,230 190,68 215,230" fill="#ffffff" fillOpacity="0.08" />

        {/* === Crown base band === */}
        <rect x="65" y="258" width="250" height="16" rx="3" fill="url(#base-grad)" opacity="0.95" />
        <rect x="65" y="258" width="250" height="16" rx="3" fill="none" stroke={KENO_GOLD} strokeWidth="0.5" strokeOpacity="0.4" />

        {/* Gem dots on each tip */}
        <circle cx="130" cy="90" r="7" fill={SHIELD_BLUE} filter="url(#glow-gold)" />
        <circle cx="250" cy="90" r="7" fill={QCT_PURPLE} filter="url(#glow-gold)" />
        <circle cx="190" cy="40" r="9" fill={KENO_GOLD} filter="url(#glow-gold)" />
        <circle cx="190" cy="40" r="4" fill="#fff" fillOpacity="0.9" />

        {/* Tick marks on base */}
        {[85, 107, 152, 190, 228, 273, 295].map((x, i) => (
          <rect key={i} x={x - 1} y={255} width="2" height={i === 3 ? 24 : 18} fill="#ffffff" fillOpacity="0.3" />
        ))}

        {/* Labels inside triangles */}
        <text x="130" y="210" textAnchor="middle" fill="#ffffff" fontSize="9" fontWeight="bold" letterSpacing="1" opacity="0.8">SHIELD</text>
        <text x="250" y="210" textAnchor="middle" fill="#ffffff" fontSize="9" fontWeight="bold" letterSpacing="1" opacity="0.8">QCT</text>
        <text x="190" y="220" textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="bold" letterSpacing="1" opacity="0.9">KENO</text>

        {/* Weight labels */}
        <text x="130" y="230" textAnchor="middle" fill={SHIELD_BLUE} fontSize="8" opacity="0.7">35%</text>
        <text x="250" y="230" textAnchor="middle" fill={QCT_PURPLE} fontSize="8" opacity="0.7">25%</text>
        <text x="190" y="242" textAnchor="middle" fill={KENO_GOLD} fontSize="8" opacity="0.8">40%</text>
      </svg>

      <div style={{ marginTop: 0, textAlign: "center" }}>
        <div style={{ color: "#ffffff", fontSize: 28, fontWeight: "bold", letterSpacing: 8, textTransform: "uppercase", textShadow: `0 0 20px ${KENO_GOLD}44` }}>
          TRINITY
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center", marginTop: 4 }}>
          <div style={{ height: 1, width: 40, background: `linear-gradient(to right, transparent, ${KENO_GOLD})` }} />
          <div style={{ color: KENO_GOLD, fontSize: 10, letterSpacing: 4 }}>INDEX</div>
          <div style={{ height: 1, width: 40, background: `linear-gradient(to left, transparent, ${KENO_GOLD})` }} />
        </div>
        <div style={{ color: "#ffffff", fontSize: 10, opacity: 0.35, letterSpacing: 2, marginTop: 8 }}>
          THE SOVEREIGN ECONOMY
        </div>
      </div>

      <div style={{ marginTop: 20, color: "#ffffff", fontSize: 10, opacity: 0.25, letterSpacing: 3 }}>
        CONCEPT B · CROWN OF THREE
      </div>
    </div>
  );
}
