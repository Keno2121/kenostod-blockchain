import React from "react";

export interface SagaData {
  number: string;
  episode: string;
  title: string;
  tagline: string;
  features: { icon: string; label: string; desc: string }[];
  stat: { value: string; label: string };
  accentColor: string;
  glowColor: string;
}

export function SagaBase({ data }: { data: SagaData }) {
  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: "#06060E",
        fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Top accent bar */}
      <div style={{ height: 5, background: `linear-gradient(90deg, ${data.accentColor}, #fff2, transparent)`, flexShrink: 0 }} />

      {/* Background glow */}
      <div style={{
        position: "absolute",
        top: -80,
        right: -80,
        width: 400,
        height: 400,
        borderRadius: "50%",
        background: data.glowColor,
        filter: "blur(120px)",
        opacity: 0.18,
        pointerEvents: "none",
      }} />

      {/* Header row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "22px 28px 0", flexShrink: 0 }}>
        <div style={{
          background: data.accentColor,
          color: "#000",
          fontWeight: 800,
          fontSize: 11,
          letterSpacing: 3,
          padding: "5px 14px",
          borderRadius: 30,
          textTransform: "uppercase",
        }}>
          SAGA {data.number}
        </div>
        <div style={{ color: "#ffffff55", fontSize: 10, letterSpacing: 3, textTransform: "uppercase", fontWeight: 600 }}>
          THE SOVEREIGN ECONOMY
        </div>
      </div>

      {/* Episode label */}
      <div style={{ padding: "18px 28px 0", flexShrink: 0 }}>
        <div style={{ color: data.accentColor, fontSize: 11, letterSpacing: 4, textTransform: "uppercase", fontWeight: 700, opacity: 0.85 }}>
          {data.episode}
        </div>
      </div>

      {/* Main title */}
      <div style={{ padding: "10px 28px 0", flexShrink: 0 }}>
        <h1 style={{
          color: "#FFFFFF",
          fontSize: 34,
          fontWeight: 900,
          lineHeight: 1.1,
          margin: 0,
          letterSpacing: -1,
          fontFamily: "'Playfair Display', Georgia, serif",
        }}>
          {data.title}
        </h1>
      </div>

      {/* Divider */}
      <div style={{ margin: "16px 28px", height: 1, background: `linear-gradient(90deg, ${data.accentColor}88, transparent)`, flexShrink: 0 }} />

      {/* Tagline */}
      <div style={{ padding: "0 28px", flexShrink: 0 }}>
        <p style={{ color: "#aaaacc", fontSize: 13, margin: 0, lineHeight: 1.5, fontStyle: "italic" }}>
          {data.tagline}
        </p>
      </div>

      {/* Features list */}
      <div style={{ padding: "18px 28px 0", flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
        {data.features.map((f, i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <div style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: `${data.accentColor}22`,
              border: `1px solid ${data.accentColor}44`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 15,
              flexShrink: 0,
            }}>
              {f.icon}
            </div>
            <div>
              <div style={{ color: "#ffffff", fontSize: 13, fontWeight: 700, lineHeight: 1.3 }}>{f.label}</div>
              <div style={{ color: "#8888aa", fontSize: 11, lineHeight: 1.4, marginTop: 1 }}>{f.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Stat bar */}
      <div style={{
        margin: "16px 28px",
        padding: "14px 18px",
        background: `${data.accentColor}12`,
        border: `1px solid ${data.accentColor}30`,
        borderRadius: 12,
        display: "flex",
        alignItems: "center",
        gap: 14,
        flexShrink: 0,
      }}>
        <div style={{ color: data.accentColor, fontSize: 26, fontWeight: 900, letterSpacing: -1 }}>{data.stat.value}</div>
        <div style={{ color: "#888899", fontSize: 11, lineHeight: 1.4 }}>{data.stat.label}</div>
      </div>

      {/* Footer */}
      <div style={{
        padding: "0 28px 18px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 22,
            height: 22,
            borderRadius: "50%",
            background: `linear-gradient(135deg, ${data.accentColor}, #fff2)`,
            border: `1.5px solid ${data.accentColor}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 9,
            fontWeight: 900,
            color: "#000",
          }}>K</div>
          <span style={{ color: "#ffffff88", fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>$KENO</span>
        </div>
        <div style={{ color: "#ffffff33", fontSize: 9, letterSpacing: 2, textTransform: "uppercase" }}>
          sovereigneconomy.io
        </div>
        <div style={{
          color: data.accentColor,
          fontSize: 9,
          fontWeight: 800,
          letterSpacing: 2,
          textTransform: "uppercase",
          opacity: 0.7,
        }}>
          #{data.episode.replace(/\s/g, "")}
        </div>
      </div>

      {/* Bottom accent bar */}
      <div style={{ height: 3, background: `linear-gradient(90deg, transparent, ${data.accentColor}66, transparent)`, flexShrink: 0 }} />
    </div>
  );
}
