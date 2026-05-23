import { SagaBase } from "./_shared/SagaBase";

export function SagaI() {
  return (
    <SagaBase data={{
      number: "I",
      episode: "The Token Revolution",
      title: "One Token.\nOne Billion Lives.",
      tagline: "KENO isn't just a cryptocurrency — it's the engine powering a new financial civilization built for the people who were left behind.",
      features: [
        { icon: "🪙", label: "1 Billion Supply — Fixed Forever", desc: "BEP-20 on Binance Smart Chain. No inflation. No hidden mints." },
        { icon: "🔥", label: "Deflationary by Design", desc: "KENO burns with every transaction, increasing scarcity over time." },
        { icon: "🚀", label: "ICO Presale Opening Soon", desc: "Early supporters get priority access before public exchange listing." },
        { icon: "🌍", label: "Built for 2.4 Billion Unbanked", desc: "Targeting South Africa first — then the world. No bank account required." },
      ],
      stat: { value: "1,000,000,000", label: "KENO — Total supply. Audited. Locked. Immutable on-chain." },
      accentColor: "#D4A017",
      glowColor: "#D4A017",
    }} />
  );
}
