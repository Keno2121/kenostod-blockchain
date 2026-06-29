const PILLARS = [
  { name: "T.D.I.R. Foundation", icon: "⬡", desc: "The Sovereign Root" },
  { name: "Academy", icon: "◈", desc: "21 Courses · Knowledge" },
  { name: "UTL Protocol", icon: "◉", desc: "5 BSC Smart Contracts" },
  { name: "KUTL Card", icon: "▣", desc: "Cybrid · Rain.xyz" },
  { name: "UTLFarm", icon: "◆", desc: "Staking · Yield" },
  { name: "B.U.K.", icon: "◈", desc: "Banking Under KENO" },
  { name: "Solar Bunker", icon: "◎", desc: "Energy Sovereignty" },
  { name: "G.I.F.T. Apparel", icon: "◇", desc: "Sovereign Identity" },
  { name: "KENO Token", icon: "★", desc: "1B · BEP-20 · BSC" },
];

export function InversionPillar() {
  const maxW = 520;
  const minBarW = 120;

  return (
    <div style={{ minHeight: "100vh", background: "#080608", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "sans-serif", padding: "32px 20px" }}>
      <link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;600;700&family=Orbitron:wght@700;900&display=swap" rel="stylesheet" />

      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={{ color: "#d4af37", fontSize: 10, letterSpacing: 6, textTransform: "uppercase", opacity: 0.7, fontFamily: "'Rajdhani', sans-serif", marginBottom: 6 }}>
          The Inversion Principle
        </div>
        <div style={{ color: "#fff", fontSize: 24, fontWeight: 900, fontFamily: "'Orbitron', sans-serif", letterSpacing: 2 }}>KENO TOKEN</div>
        <div style={{ color: "rgba(212,175,55,0.6)", fontSize: 11, marginTop: 4, fontFamily: "'Rajdhani', sans-serif", letterSpacing: 3 }}>
          Value Flows Down · To The People
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
        <div style={{ width: 30, height: 1, background: "linear-gradient(to right, transparent, #d4af37)" }} />
        <div style={{ color: "#d4af37", fontSize: 9, letterSpacing: 4, opacity: 0.5, fontFamily: "'Rajdhani', sans-serif" }}>FOUNDATION</div>
        <div style={{ width: 30, height: 1, background: "linear-gradient(to left, transparent, #d4af37)" }} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, width: "100%", maxWidth: maxW + 40 }}>
        {PILLARS.map((p, i) => {
          const progress = i / (PILLARS.length - 1);
          const barW = minBarW + progress * (maxW - minBarW);
          const goldStart = `hsl(${43 - progress * 12}, ${65 + progress * 20}%, ${38 + progress * 22}%)`;
          const goldEnd = `hsl(${43 - progress * 8}, ${55 + progress * 15}%, ${28 + progress * 15}%)`;
          const isLast = i === PILLARS.length - 1;
          return (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", position: "relative" }}>
              {i === 0 && (
                <div style={{ width: 0, height: 0, borderLeft: "12px solid transparent", borderRight: "12px solid transparent", borderBottom: "14px solid rgba(212,175,55,0.25)", marginBottom: -2 }} />
              )}
              <div style={{
                width: barW,
                height: isLast ? 48 : 38,
                background: isLast
                  ? `linear-gradient(135deg, #d4af37, #f0d060, #d4af37)`
                  : `linear-gradient(135deg, ${goldStart}, ${goldEnd})`,
                borderRadius: isLast ? 8 : 4,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0 16px",
                position: "relative",
                boxShadow: isLast
                  ? "0 0 24px rgba(212,175,55,0.5), 0 0 48px rgba(212,175,55,0.15)"
                  : `0 2px 8px rgba(0,0,0,0.4)`,
                border: isLast ? "1px solid rgba(255,220,80,0.6)" : "1px solid rgba(212,175,55,0.15)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: isLast ? 16 : 13, opacity: 0.8, color: isLast ? "#0a0a0a" : "#fff" }}>{p.icon}</span>
                  <span style={{
                    color: isLast ? "#0a0a0a" : "#fff",
                    fontSize: isLast ? 13 : 11,
                    fontWeight: isLast ? 900 : 700,
                    fontFamily: isLast ? "'Orbitron', sans-serif" : "'Rajdhani', sans-serif",
                    letterSpacing: isLast ? 2 : 1,
                  }}>{p.name}</span>
                </div>
                <span style={{
                  color: isLast ? "rgba(0,0,0,0.6)" : "rgba(255,255,255,0.4)",
                  fontSize: 9,
                  fontFamily: "'Rajdhani', sans-serif",
                  letterSpacing: 1,
                  textAlign: "right",
                  maxWidth: 100,
                  lineHeight: 1.3,
                }}>{p.desc}</span>
              </div>
              {i < PILLARS.length - 1 && (
                <div style={{ display: "flex", gap: 4, marginTop: 1 }}>
                  {[...Array(3)].map((_, j) => (
                    <div key={j} style={{ width: 2, height: 3, background: "rgba(212,175,55,0.3)", borderRadius: 1 }} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 20 }}>
        <div style={{ width: 30, height: 1, background: "linear-gradient(to right, transparent, #d4af37)" }} />
        <div style={{ color: "#d4af37", fontSize: 9, letterSpacing: 4, opacity: 0.5, fontFamily: "'Rajdhani', sans-serif" }}>THE SOVEREIGN PEOPLE</div>
        <div style={{ width: 30, height: 1, background: "linear-gradient(to left, transparent, #d4af37)" }} />
      </div>

      <div style={{ marginTop: 20, display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
        {["Strong", "Unbreakable", "Yours"].map((word, i) => (
          <div key={i} style={{ color: "rgba(212,175,55,0.5)", fontSize: 10, letterSpacing: 3, fontFamily: "'Rajdhani', sans-serif", textTransform: "uppercase" }}>
            {i > 0 && <span style={{ marginRight: 12, opacity: 0.3 }}>·</span>}
            {word}
          </div>
        ))}
      </div>
    </div>
  );
}
