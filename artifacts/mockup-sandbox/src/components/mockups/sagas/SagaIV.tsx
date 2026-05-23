import { SagaBase } from "./_shared/SagaBase";

export function SagaIV() {
  return (
    <SagaBase data={{
      number: "IV",
      episode: "The DeFi Protocol",
      title: "The Protocol\nThat Pays You Back.",
      tagline: "UTL doesn't just move money — it redistributes it. Every fee, every swap, every transaction flows back to the people who power the network.",
      features: [
        { icon: "🔄", label: "UTL Fee Redistribution Protocol", desc: "Every transaction fee is collected and redistributed to KENO stakers automatically." },
        { icon: "⚡", label: "Flash Arbitrage Loans (FAL)", desc: "Institutional-grade arb strategies available to retail traders through KENO." },
        { icon: "🌊", label: "PancakeSwap v4 UTLHook Integration", desc: "Embedded directly in DEX infrastructure. Fees captured at the swap level." },
        { icon: "📈", label: "KENO Staking Rewards", desc: "Lock KENO, earn a share of all protocol fees distributed weekly in USDC." },
      ],
      stat: { value: "80+", label: "Live API endpoints powering real-time DeFi data, staking, and fee tracking." },
      accentColor: "#FF6B35",
      glowColor: "#FF6B35",
    }} />
  );
}
