import { SagaBase } from "./_shared/SagaBase";

export function SagaV() {
  return (
    <SagaBase data={{
      number: "V",
      episode: "The Digital Frontier",
      title: "Your Empire.\nBuilt in a\nDigital World.",
      tagline: "The Sovereign Economy Metaverse isn't a game — it's a parallel economy where virtual land, digital commerce, and governance converge.",
      features: [
        { icon: "🏙️", label: "Virtual Land as NFT Parcels", desc: "Own, develop, and sell digital real estate in 15+ independent 3D Storehouses." },
        { icon: "🎭", label: "Customizable Sovereign Avatars", desc: "Your digital identity in the economy — unique, tradeable, yours forever." },
        { icon: "🏛️", label: "KENO as Native Metaverse Currency", desc: "The only currency accepted in the Sovereign Economy digital world." },
        { icon: "🗳️", label: "DAO Governance Rights", desc: "Land owners and KENO holders vote on the future of the entire ecosystem." },
      ],
      stat: { value: "15+", label: "3D Storehouse districts — each an independent economy within the sovereign world." },
      accentColor: "#06D6A0",
      glowColor: "#06D6A0",
    }} />
  );
}
