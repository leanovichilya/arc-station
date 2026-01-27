"use client";

import { useEffect, useMemo, useState } from "react";
import WalletConnect from "@/components/WalletConnect";
import { addEvent } from "@/lib/activity";
import { CHAINS } from "@/lib/chains";
import { onWalletState } from "@/lib/walletState";
import { isWalletDisconnected } from "@/lib/walletSession";
import type { ActivityEvent, ActivityStatus } from "@/shared/types";

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
};

export default function BridgePage() {
  const storageKey = "arc-bridge-progress";
  const defaultSource = CHAINS[0]?.chainId ?? 0;
  const defaultDest = CHAINS[1]?.chainId ?? defaultSource;

  const [sourceChainId, setSourceChainId] = useState(defaultSource);
  const [destChainId, setDestChainId] = useState(defaultDest);
  const [amount, setAmount] = useState("");
  const [stepIndex, setStepIndex] = useState<number | null>(null);
  const [transferId, setTransferId] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as {
          sourceChainId?: number;
          destChainId?: number;
          amount?: string;
          stepIndex?: number | null;
          transferId?: string | null;
        };
        if (typeof parsed.sourceChainId === "number") {
          setSourceChainId(parsed.sourceChainId);
        }
        if (typeof parsed.destChainId === "number") {
          setDestChainId(parsed.destChainId);
        }
        if (typeof parsed.amount === "string") {
          setAmount(parsed.amount);
        }
        if (typeof parsed.stepIndex === "number" || parsed.stepIndex === null) {
          setStepIndex(parsed.stepIndex ?? null);
        }
        if (typeof parsed.transferId === "string" || parsed.transferId === null) {
          setTransferId(parsed.transferId ?? null);
        }
      } catch {}
    }
    setIsHydrated(true);
  }, [storageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isHydrated) return;
    const payload = {
      sourceChainId,
      destChainId,
      amount,
      stepIndex,
      transferId,
    };
    localStorage.setItem(storageKey, JSON.stringify(payload));
  }, [
    amount,
    destChainId,
    isHydrated,
    sourceChainId,
    stepIndex,
    storageKey,
    transferId,
  ]);

  useEffect(() => {
    const ethereum = (window as { ethereum?: EthereumProvider }).ethereum;
    if (!ethereum) return;
    const handleAccounts = (accounts: unknown) => {
      if (isWalletDisconnected()) {
        setWalletAddress(null);
        return;
      }
      const list = Array.isArray(accounts) ? accounts : [];
      const next = typeof list[0] === "string" ? list[0] : null;
      setWalletAddress(next);
    };
    ethereum
      .request({ method: "eth_accounts" })
      .then(handleAccounts)
      .catch(() => {});
    const unsubscribe = onWalletState((state) => setWalletAddress(state.address));
    ethereum.on?.("accountsChanged", handleAccounts);
    return () => {
      unsubscribe();
      ethereum.removeListener?.("accountsChanged", handleAccounts);
    };
  }, []);

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

  const progressLabel = useMemo(() => {
    if (stepIndex === null) return "Idle";
    if (stepIndex >= steps.length) return "Completed";
    return `Step ${stepIndex + 1} of ${steps.length}`;
  }, [stepIndex, steps.length]);

  const isConnected = Boolean(walletAddress);
  const hasActiveFlow = stepIndex !== null && stepIndex < steps.length;
  const isComplete = stepIndex !== null && stepIndex >= steps.length;

  const ensureIntentId = () => {
    if (transferId) return transferId;
    const next = crypto.randomUUID();
    setTransferId(next);
    return next;
  };

  const recordBridgeEvent = (status: ActivityStatus, intentId: string) => {
    if (!walletAddress) return;
    const actor = walletAddress.toLowerCase();
    const amountDigits = amount.replace(/\D/g, "");
    const event: ActivityEvent = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      actor,
      app: "arc-stable-toolbox",
      intentId,
      kind: "bridge",
      status,
      chains: {
        sourceChainId,
        destChainId,
      },
      ...(amountDigits
        ? {
            token: {
              symbol: "USDC",
              amount: amountDigits,
            },
          }
        : {}),
    };
    addEvent(event);
  };

  const onStart = () => {
    if (!isConnected) return;
    if (hasActiveFlow) return;
    const intentId = crypto.randomUUID();
    setTransferId(intentId);
    setStepIndex(0);
    recordBridgeEvent("started", intentId);
  };

  const onNext = () => {
    if (!isConnected) return;
    if (!hasActiveFlow) return;
    if (stepIndex < steps.length) {
      const statusByStep: ActivityStatus[] = [
        "approved",
        "submitted",
        "attested",
        "completed",
      ];
      const nextStatus = statusByStep[stepIndex] ?? "completed";
      setStepIndex(stepIndex + 1);
      const intentId = ensureIntentId();
      recordBridgeEvent(nextStatus, intentId);
    }
  };

  const onReset = () => {
    setStepIndex(null);
    setTransferId(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem(storageKey);
    }
  };

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
              <select
                className="h-10 w-full rounded border border-zinc-300 px-3"
                value={sourceChainId}
                onChange={(event) =>
                  setSourceChainId(Number(event.target.value))
                }
              >
                {CHAINS.map((chain) => (
                  <option key={chain.chainId} value={chain.chainId}>
                    {chain.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm">
              <span className="text-zinc-600">To</span>
              <select
                className="h-10 w-full rounded border border-zinc-300 px-3"
                value={destChainId}
                onChange={(event) => setDestChainId(Number(event.target.value))}
              >
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
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
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
            <button
              className="h-10 w-full rounded bg-zinc-900 text-sm font-medium text-white"
              onClick={onStart}
              disabled={!isConnected || hasActiveFlow}
            >
              {!isConnected
                ? "Connect wallet to start"
                : hasActiveFlow
                  ? "Bridge in progress"
                  : "Start bridge"}
            </button>
          </div>
        </div>

        <div className="space-y-4 rounded border border-zinc-200 p-4">
          <div className="flex items-center justify-between text-sm font-medium">
            <span>Progress</span>
            <span className="text-xs font-normal text-zinc-500">
              {progressLabel}
            </span>
          </div>
          {transferId ? (
            <div className="rounded border border-zinc-200 px-3 py-2 text-xs text-zinc-600">
              Transfer ID: {transferId}
            </div>
          ) : null}
          <div className="space-y-3">
            {steps.map((step, index) => {
              const status =
                stepIndex === null
                  ? "Pending"
                  : stepIndex >= steps.length
                    ? "Done"
                    : index < stepIndex
                      ? "Done"
                      : index === stepIndex
                        ? "In progress"
                        : "Pending";
              return (
                <div key={step.title} className="flex gap-3">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs ${
                      status === "Done"
                        ? "border-emerald-500 text-emerald-600"
                        : status === "In progress"
                          ? "border-zinc-900 text-zinc-900"
                          : "border-zinc-300 text-zinc-500"
                    }`}
                  >
                    {index + 1}
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm">{step.title}</div>
                    <div className="text-xs text-zinc-500">
                      {step.description}
                    </div>
                    <div className="text-[11px] uppercase text-zinc-400">
                      {status}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="h-9 rounded border border-zinc-300 px-3 text-xs"
              onClick={onNext}
              disabled={!isConnected || !hasActiveFlow || isComplete}
            >
              Next step
            </button>
            <button
              className="h-9 rounded border border-zinc-300 px-3 text-xs"
              onClick={onReset}
            >
              Reset
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
