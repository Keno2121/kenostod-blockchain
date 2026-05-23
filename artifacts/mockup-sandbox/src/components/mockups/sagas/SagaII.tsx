import { SagaBase } from "./_shared/SagaBase";

export function SagaII() {
  return (
    <SagaBase data={{
      number: "II",
      episode: "The Banking Evolution",
      title: "Real Money.\nReal Power.\nReal Freedom.",
      tagline: "We're not building on top of the old banking system — we're replacing it. KUTL Card turns KENO into everyday purchasing power.",
      features: [
        { icon: "💳", label: "KUTL Card — Powered by Rain.xyz", desc: "Spend KENO anywhere Visa is accepted. Instant conversion, zero friction." },
        { icon: "🏦", label: "Mercury Bank USD Cashout", desc: "Bridge crypto to USD and withdraw to your bank account globally." },
        { icon: "🔐", label: "B.U.K. Dual-Chip Security Card", desc: "Proprietary backup key system. Your assets protected even if everything fails." },
        { icon: "⚡", label: "Zero Minimum Balance", desc: "No credit checks. No rejection. Open to everyone, everywhere." },
      ],
      stat: { value: "2.4B", label: "Unbanked people globally — our primary market. Starting with South Africa." },
      accentColor: "#00C9A7",
      glowColor: "#00C9A7",
    }} />
  );
}
