import WalletConnect from "@/components/WalletConnect";
import { CHAINS } from "@/lib/chains";

export default function BridgePage() {
  const steps = [
    {
      title: "Approve",
      description: "Approve USDC spending for the bridge.",
    },
    {
      title: "Burn",
      description: "Burn USDC on the source chain.",
    },
    {
      title: "Attestation",
      description: "Wait for Circle attestation.",
    },
    {
      title: "Mint",
      description: "Mint USDC on the destination chain.",
    },
  ];

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Bridge</h1>
          <p className="text-sm text-zinc-600">
            Move USDC between networks using Circle CCTP.
          </p>
        </div>
        <WalletConnect />
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <div className="space-y-6 rounded border border-zinc-200 p-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm">
              <span className="text-zinc-600">From</span>
              <select className="h-10 w-full rounded border border-zinc-300 px-3">
                {CHAINS.map((chain) => (
                  <option key={chain.chainId} value={chain.chainId}>
                    {chain.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm">
              <span className="text-zinc-600">To</span>
              <select className="h-10 w-full rounded border border-zinc-300 px-3">
                {CHAINS.map((chain) => (
                  <option key={chain.chainId} value={chain.chainId}>
                    {chain.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm md:col-span-2">
              <span className="text-zinc-600">Amount</span>
              <div className="flex items-center rounded border border-zinc-300 px-3">
                <input
                  className="h-10 flex-1 bg-transparent text-sm outline-none"
                  placeholder="0.00"
                />
                <span className="text-xs text-zinc-500">USDC</span>
              </div>
            </label>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-zinc-500">
              <span>Estimated time</span>
              <span>~5-15 min</span>
            </div>
            <button className="h-10 w-full rounded bg-zinc-900 text-sm font-medium text-white">
              Start bridge
            </button>
          </div>
        </div>

        <div className="space-y-4 rounded border border-zinc-200 p-4">
          <div className="text-sm font-medium">Progress</div>
          <div className="space-y-3">
            {steps.map((step, index) => (
              <div key={step.title} className="flex gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-300 text-xs">
                  {index + 1}
                </div>
                <div className="space-y-1">
                  <div className="text-sm">{step.title}</div>
                  <div className="text-xs text-zinc-500">
                    {step.description}
                  </div>
                  <div className="text-[11px] uppercase text-zinc-400">
                    Pending
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
