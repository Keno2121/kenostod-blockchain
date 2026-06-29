import React, { useState } from "react";

const VOLUMES = [
  { label: "$500K/day", daily: 500_000 },
  { label: "$1M/day",   daily: 1_000_000 },
  { label: "$5M/day",   daily: 5_000_000 },
  { label: "$10M/day",  daily: 10_000_000 },
];

const HOOK_FEE = 0.0009; // 0.09%
const STAKER_SHARE = 0.60;
const TREASURY_SHARE = 0.40;

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

export default function InvestorPitch() {
  const [volIdx, setVolIdx] = useState(1);
  const vol = VOLUMES[volIdx];
  const dailyFee      = vol.daily * HOOK_FEE;
  const stakerDaily   = dailyFee * STAKER_SHARE;
  const treasuryDaily = dailyFee * TREASURY_SHARE;
  const stakerMonthly = stakerDaily * 30;
  const stakerAnnual  = stakerDaily * 365;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white font-sans flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#0f0f1a] to-[#0a0a0f] border-b border-[#1e1e3a] px-10 py-8">
        <div className="absolute top-0 right-0 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-amber-500/5 rounded-full blur-2xl translate-y-1/2 -translate-x-1/4" />

        <div className="relative flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center text-sm font-bold">U</div>
              <span className="text-xs uppercase tracking-widest text-violet-400 font-semibold">UTL Protocol · T.D.I.R. Foundation</span>
            </div>
            <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-white via-violet-200 to-purple-400 bg-clip-text text-transparent">
              UTLHook
            </h1>
            <p className="text-lg text-gray-400 mt-1 font-light">Automated On-Chain Fee Engine for PancakeSwap v4</p>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500 mb-1">KENO Token · BSC Mainnet</div>
            <div className="font-mono text-xs text-violet-400 bg-violet-500/10 border border-violet-500/20 rounded px-2 py-1">
              0x65791E0B...D982FD0E
            </div>
            <div className="flex items-center justify-end gap-2 mt-2">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs text-green-400">Contracts Live on BSC</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 px-10 py-8 space-y-8">

        {/* Tagline */}
        <div className="bg-gradient-to-r from-violet-500/10 to-purple-600/5 border border-violet-500/20 rounded-2xl px-8 py-5 text-center">
          <p className="text-xl font-semibold text-white leading-relaxed">
            Every KENO swap on PancakeSwap permanently routes{" "}
            <span className="text-violet-400">0.09% to KENO stakers</span> —
            <br />
            <span className="text-gray-300 font-normal text-lg">no middleman · no claiming required · no human can turn it off</span>
          </p>
        </div>

        {/* Revenue Flow */}
        <div>
          <h2 className="text-xs uppercase tracking-widest text-gray-500 mb-4">Revenue Flow</h2>
          <div className="flex items-stretch gap-3">
            {[
              { label: "KENO Swap", sub: "PancakeSwap v4 Pool", color: "from-amber-500/20 to-orange-600/10", border: "border-amber-500/30", icon: "⇄" },
              { label: "UTLHook", sub: "afterSwap · 0.09% fee", color: "from-violet-500/20 to-purple-600/10", border: "border-violet-500/30", icon: "⚡" },
              { label: "FeeCollector", sub: "On-chain router", color: "from-blue-500/20 to-indigo-600/10", border: "border-blue-500/30", icon: "⬡" },
            ].map((step, i) => (
              <React.Fragment key={step.label}>
                <div className={`flex-1 bg-gradient-to-br ${step.color} border ${step.border} rounded-xl p-4 flex flex-col items-center justify-center text-center`}>
                  <div className="text-2xl mb-2">{step.icon}</div>
                  <div className="font-semibold text-white text-sm">{step.label}</div>
                  <div className="text-xs text-gray-400 mt-1">{step.sub}</div>
                </div>
                {i < 2 && (
                  <div className="flex items-center text-gray-600">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <path d="M4 10h12M12 6l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                )}
              </React.Fragment>
            ))}
            <div className="flex items-center text-gray-600">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M4 10h12M12 6l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            {/* Split */}
            <div className="flex-[1.4] flex flex-col gap-2">
              <div className="flex-1 bg-gradient-to-br from-green-500/20 to-emerald-600/10 border border-green-500/30 rounded-xl p-3 flex flex-col justify-center">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-green-400 text-sm">60% → Stakers</div>
                    <div className="text-xs text-gray-400">KENO stakers earn USDC</div>
                  </div>
                  <div className="text-green-400 font-bold text-lg">60%</div>
                </div>
              </div>
              <div className="flex-1 bg-gradient-to-br from-amber-500/20 to-yellow-600/10 border border-amber-500/30 rounded-xl p-3 flex flex-col justify-center">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-amber-400 text-sm">40% → Treasury</div>
                    <div className="text-xs text-gray-400">Ops · Scholarship · TDIR</div>
                  </div>
                  <div className="text-amber-400 font-bold text-lg">40%</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Revenue Calculator */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs uppercase tracking-widest text-gray-500">Live Revenue Projections</h2>
            <div className="flex gap-2">
              {VOLUMES.map((v, i) => (
                <button
                  key={v.label}
                  onClick={() => setVolIdx(i)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                    i === volIdx
                      ? "bg-violet-600 text-white"
                      : "bg-white/5 text-gray-400 hover:bg-white/10"
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4">
            {[
              { label: "Daily Hook Fees", value: fmt(dailyFee), sub: "0.09% of swap volume", color: "violet" },
              { label: "Staker Daily Yield", value: fmt(stakerDaily), sub: "60% of hook fees", color: "green" },
              { label: "Staker Monthly", value: fmt(stakerMonthly), sub: "Compounding potential", color: "blue" },
              { label: "Staker Annual", value: fmt(stakerAnnual), sub: "Passive USDC income", color: "amber" },
            ].map(card => {
              const colors: Record<string, string> = {
                violet: "from-violet-500/20 border-violet-500/30 text-violet-400",
                green:  "from-green-500/20  border-green-500/30  text-green-400",
                blue:   "from-blue-500/20   border-blue-500/30   text-blue-400",
                amber:  "from-amber-500/20  border-amber-500/30  text-amber-400",
              };
              const cls = colors[card.color];
              return (
                <div key={card.label} className={`bg-gradient-to-br ${cls.split(" ")[0]} to-transparent border ${cls.split(" ")[1]} rounded-xl p-5`}>
                  <div className={`text-2xl font-bold ${cls.split(" ")[2]} mb-1`}>{card.value}</div>
                  <div className="text-white text-sm font-medium">{card.label}</div>
                  <div className="text-gray-500 text-xs mt-1">{card.sub}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Why Now + Contract Status */}
        <div className="grid grid-cols-2 gap-6">
          {/* Why Now */}
          <div>
            <h2 className="text-xs uppercase tracking-widest text-gray-500 mb-4">Why Now</h2>
            <div className="space-y-3">
              {[
                { icon: "🥇", text: "First-mover on PancakeSwap v4 hooks on BSC — v4 launched Q4 2024" },
                { icon: "🔒", text: "Trustless & immutable — smart contract enforces distribution, no admin override" },
                { icon: "📈", text: "Revenue scales linearly with KENO trading volume — no operational cost increase" },
                { icon: "🌍", text: "Targeting 2.4B unbanked via KENO — growing base = growing volume = growing yield" },
              ].map(item => (
                <div key={item.text} className="flex items-start gap-3 bg-white/3 border border-white/8 rounded-xl px-4 py-3">
                  <span className="text-lg flex-shrink-0">{item.icon}</span>
                  <span className="text-sm text-gray-300 leading-relaxed">{item.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Deployed Contracts */}
          <div>
            <h2 className="text-xs uppercase tracking-widest text-gray-500 mb-4">Deployed Infrastructure (BSC Mainnet)</h2>
            <div className="space-y-2">
              {[
                { name: "UTLTreasury v1.1",    addr: "0x54A01A5bf5096c351F166C15143eA9a9Af393C84", status: "live" },
                { name: "UTLStaking v1.1",     addr: "0x77C3946A9FD5F509584F94e81C43efb25120c837", status: "live" },
                { name: "UTLFeeCollector v1.0", addr: "0xfE537c43d202C455Cedc141B882c808287BB662f", status: "live" },
                { name: "UTLDistribution v1.0", addr: "0xE6918cdBB9D8cd0d3532A88D974734B2F1A793c7", status: "live" },
                { name: "UTLHook",              addr: "Deploying — PancakeSwap v4 afterSwap",      status: "pending" },
              ].map(c => (
                <div key={c.name} className="flex items-center justify-between bg-white/3 border border-white/8 rounded-lg px-4 py-2.5">
                  <div>
                    <div className="text-sm font-medium text-white">{c.name}</div>
                    <div className="font-mono text-xs text-gray-500 mt-0.5">{c.addr.length > 20 ? c.addr.slice(0, 22) + "…" : c.addr}</div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    c.status === "live"
                      ? "bg-green-500/15 text-green-400 border border-green-500/25"
                      : "bg-amber-500/15 text-amber-400 border border-amber-500/25"
                  }`}>
                    {c.status === "live" ? "● Live" : "◌ Pending"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-white/8 pt-6 flex items-center justify-between text-xs text-gray-600">
          <div>Kenostod Blockchain Academy LLC · T.D.I.R. Foundation · Wyoming SPDI Charter Applicant</div>
          <div className="flex items-center gap-4">
            <span>CoinGecko Listed</span>
            <span>·</span>
            <span>Rain.xyz Card Partner</span>
            <span>·</span>
            <span>OpenAI GPT-4o Support</span>
          </div>
        </div>

      </div>
    </div>
  );
}
