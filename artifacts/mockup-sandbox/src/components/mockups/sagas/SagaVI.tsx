import { SagaBase } from "./_shared/SagaBase";

export function SagaVI() {
  return (
    <SagaBase data={{
      number: "VI",
      episode: "The Security Fortress",
      title: "Your Keys.\nYour Sovereignty.\nYour Survival.",
      tagline: "When grids go down, banks close, and networks fail — the Solar Bunker keeps your assets alive. Sovereignty doesn't need permission to exist.",
      features: [
        { icon: "🔑", label: "B.U.K. — Back Up Key System", desc: "Proprietary dual-chip card stores your encrypted backup offline. Unbreakable." },
        { icon: "☀️", label: "Solar Bunker Hardware Protocol", desc: "Ruggedized, solar-powered nodes built for zero-infrastructure environments." },
        { icon: "📡", label: "Offline-First Architecture", desc: "Full blockchain functionality without internet. Mesh network capable." },
        { icon: "🌍", label: "South Africa Launch Market", desc: "Built for communities where power and connectivity are not guaranteed." },
      ],
      stat: { value: "100%", label: "Solar-powered. Off-grid. Censorship-resistant. The last resort that always works." },
      accentColor: "#FFB703",
      glowColor: "#FFB703",
    }} />
  );
}
