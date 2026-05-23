import { SagaBase } from "./_shared/SagaBase";

export function SagaIII() {
  return (
    <SagaBase data={{
      number: "III",
      episode: "The Knowledge Economy",
      title: "Learn the System.\nOwn the Outcome.",
      tagline: "Education is the first act of financial sovereignty. Complete courses, earn KENO rewards, and unlock access to everything the platform offers.",
      features: [
        { icon: "📚", label: "21 Courses — Earn While You Learn", desc: "Complete financial literacy and blockchain courses, get paid in KENO automatically." },
        { icon: "🎓", label: "Wealth Builder Scholarships", desc: "Grants and scholarships funded by the protocol — no debt, no gatekeeping." },
        { icon: "💰", label: "Royalty Revenue Sharing", desc: "Top students earn passive royalties from the ecosystem they help build." },
        { icon: "👕", label: "G.I.F.T. Apparel Access", desc: "Unlock exclusive branded merchandise rewards tied to your learning progress." },
      ],
      stat: { value: "21", label: "Courses live now — from blockchain basics to advanced DeFi and financial sovereignty." },
      accentColor: "#7C5CFC",
      glowColor: "#7C5CFC",
    }} />
  );
}
