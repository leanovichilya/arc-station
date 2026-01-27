"use client";

import { useEffect, useMemo, useState } from "react";
import WalletConnect from "@/components/WalletConnect";
import { addEvent } from "@/lib/activity";
import {
  createBrowserAdapter,
  getBridgeChainName,
  getBridgeKit,
  getTokenMessengerV2Address,
} from "@/lib/bridgeKit";
import { CHAINS } from "@/lib/chains";
import { onWalletState } from "@/lib/walletState";
import { isWalletDisconnected } from "@/lib/walletSession";
import type { ActivityEvent, ActivityStatus } from "@/shared/types";
import type { EIP1193Provider } from "viem";

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
  const [isBridging, setIsBridging] = useState(false);
  const [bridgeError, setBridgeError] = useState<string | null>(null);
  const [failedStep, setFailedStep] = useState<number | null>(null);

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
          failedStep?: number | null;
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
        if (typeof parsed.failedStep === "number" || parsed.failedStep === null) {
          setFailedStep(parsed.failedStep ?? null);
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
      failedStep,
    };
    localStorage.setItem(storageKey, JSON.stringify(payload));
  }, [
    amount,
    destChainId,
    isHydrated,
    failedStep,
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
    if (failedStep !== null) return "Failed";
    if (stepIndex === null) return "Idle";
    if (stepIndex >= steps.length) return "Completed";
    return `Step ${stepIndex + 1} of ${steps.length}`;
  }, [failedStep, stepIndex, steps.length]);

  const isConnected = Boolean(walletAddress);
  const isFailed = failedStep !== null;
  const hasActiveFlow = stepIndex !== null && stepIndex < steps.length && !isFailed;
  const isBusy = isBridging || hasActiveFlow;
  const sourceChainName =
    CHAINS.find((chain) => chain.chainId === sourceChainId)?.name ??
    "source chain";
  const tokenMessengerAddress = getTokenMessengerV2Address(sourceChainId);

  const toUsdcBaseUnits = (value: string) => {
    const trimmed = value.trim();
    if (!/^\d+(\.\d+)?$/.test(trimmed)) return "";
    const [whole, fraction = ""] = trimmed.split(".");
    const padded = `${fraction}000000`.slice(0, 6);
    const combined = `${whole}${padded}`.replace(/^0+(?=\d)/, "");
    return combined === "" ? "0" : combined;
  };

  const recordBridgeEvent = (
    status: ActivityStatus,
    intentId: string,
    txInfo?: {
      sourceTxHash?: string;
      destTxHash?: string;
      explorerSourceUrl?: string;
      explorerDestUrl?: string;
    }
  ) => {
    if (!walletAddress) return;
    const actor = walletAddress.toLowerCase();
    const amountBaseUnits = toUsdcBaseUnits(amount);
    const txPayload = txInfo
      ? {
          ...(txInfo.sourceTxHash ? { sourceTxHash: txInfo.sourceTxHash } : {}),
          ...(txInfo.destTxHash ? { destTxHash: txInfo.destTxHash } : {}),
        }
      : null;
    const refsPayload = txInfo
      ? {
          ...(txInfo.explorerSourceUrl
            ? { explorerSourceUrl: txInfo.explorerSourceUrl }
            : {}),
          ...(txInfo.explorerDestUrl
            ? { explorerDestUrl: txInfo.explorerDestUrl }
            : {}),
        }
      : null;
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
      ...(amountBaseUnits && amountBaseUnits !== "0"
        ? {
            token: {
              symbol: "USDC",
              amount: amountBaseUnits,
            },
          }
        : {}),
      ...(txPayload && Object.keys(txPayload).length > 0
        ? { tx: txPayload }
        : {}),
      ...(refsPayload && Object.keys(refsPayload).length > 0
        ? { refs: refsPayload }
        : {}),
    };
    addEvent(event);
  };

  const onStart = async () => {
    if (!isConnected || isBusy) return;
    setBridgeError(null);
    setFailedStep(null);

    const fromChain = getBridgeChainName(sourceChainId);
    const toChain = getBridgeChainName(destChainId);
    if (!fromChain || !toChain) {
      setBridgeError("Unsupported chain");
      return;
    }
    if (fromChain === toChain) {
      setBridgeError("Select different chains");
      return;
    }
    const amountValue = amount.trim();
    const amountBaseUnits = toUsdcBaseUnits(amountValue);
    if (!amountBaseUnits || amountBaseUnits === "0") {
      setBridgeError("Enter a valid amount");
      return;
    }
    const ethereum = (window as { ethereum?: EthereumProvider }).ethereum;
    if (!ethereum) {
      setBridgeError("No wallet found");
      return;
    }

    const intentId = crypto.randomUUID();
    setTransferId(intentId);
    setStepIndex(0);
    recordBridgeEvent("started", intentId);
    setIsBridging(true);

    const kit = getBridgeKit();
    const emitter = kit as {
      on: (event: string, handler: (event: unknown) => void) => void;
      off?: (event: string, handler: (event: unknown) => void) => void;
    };
    const adapter = await createBrowserAdapter(
      ethereum as unknown as EIP1193Provider
    );
    let lastStepIndex = 0;

    const handleEvent = (event: {
      method?: string;
      values?: { txHash?: string; explorerUrl?: string };
    }) => {
      const method = event.method;
      if (!method) return;
      if (method === "approve") {
        lastStepIndex = 1;
        setStepIndex(1);
        recordBridgeEvent("approved", intentId, {
          sourceTxHash: event.values?.txHash,
          explorerSourceUrl: event.values?.explorerUrl,
        });
        return;
      }
      if (method === "burn") {
        lastStepIndex = 2;
        setStepIndex(2);
        recordBridgeEvent("submitted", intentId, {
          sourceTxHash: event.values?.txHash,
          explorerSourceUrl: event.values?.explorerUrl,
        });
        return;
      }
      if (method === "fetchAttestation" || method === "attestation") {
        lastStepIndex = 3;
        setStepIndex(3);
        recordBridgeEvent("attested", intentId);
        return;
      }
      if (method === "mint") {
        lastStepIndex = steps.length;
        setStepIndex(steps.length);
        recordBridgeEvent("completed", intentId, {
          destTxHash: event.values?.txHash,
          explorerDestUrl: event.values?.explorerUrl,
        });
      }
    };

    emitter.on("*", handleEvent);
    try {
      const result = await kit.bridge({
        from: { adapter, chain: fromChain },
        to: { adapter, chain: toChain },
        amount: amountValue,
      });
      if (result?.state === "error") {
        setFailedStep(lastStepIndex);
        setBridgeError("Bridge failed");
        recordBridgeEvent("failed", intentId);
      } else {
        setStepIndex(steps.length);
      }
    } catch (error) {
      setFailedStep(lastStepIndex);
      setBridgeError("Bridge failed");
      recordBridgeEvent("failed", intentId);
    } finally {
      emitter.off?.("*", handleEvent);
      setIsBridging(false);
    }
  };

  const onReset = () => {
    setStepIndex(null);
    setTransferId(null);
    setBridgeError(null);
    setFailedStep(null);
    setIsBridging(false);
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
                disabled={isBusy}
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
                disabled={isBusy}
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
                  disabled={isBusy}
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
            <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              <div className="font-medium text-amber-800">Before you start</div>
              <div className="mt-1">
                You will approve USDC and sign transactions. Verify the spender
                address for {sourceChainName} before approving.
              </div>
              <div className="mt-2 text-[11px] text-amber-800">
                TokenMessengerV2
              </div>
              <div className="break-all font-mono text-[11px] text-amber-900">
                {tokenMessengerAddress ?? "Unknown"}
              </div>
            </div>
            {!isConnected ? (
              <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                Wallet disconnected — connect to continue.
              </div>
            ) : null}
            <button
              className="h-10 w-full rounded bg-zinc-900 text-sm font-medium text-white"
              onClick={onStart}
              disabled={!isConnected || isBusy}
            >
              {!isConnected
                ? "Connect wallet to start"
                : isBusy
                  ? "Bridge in progress"
                  : isFailed
                    ? "Retry bridge"
                    : "Start bridge"}
            </button>
            {bridgeError ? (
              <div className="text-xs text-red-600">{bridgeError}</div>
            ) : null}
            <div className="text-xs text-zinc-500">Status: {progressLabel}</div>
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
                failedStep !== null
                  ? index < failedStep
                    ? "Done"
                    : index === failedStep
                      ? "Failed"
                      : "Pending"
                  : stepIndex === null
                    ? "Pending"
                    : stepIndex >= steps.length
                      ? "Done"
                      : index < stepIndex
                        ? "Done"
                        : index === stepIndex
                          ? isBridging
                            ? "In progress"
                            : "Done"
                          : "Pending";
              return (
                <div key={step.title} className="flex gap-3">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs ${
                      status === "Done"
                        ? "border-emerald-500 text-emerald-600"
                        : status === "Failed"
                          ? "border-red-500 text-red-600"
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
