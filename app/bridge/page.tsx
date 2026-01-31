"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { createPublicClient, custom, formatUnits, getAddress, http } from "viem";
import { addEvent } from "@/lib/activity";
import {
  createBrowserAdapter,
  getBridgeChainName,
  getBridgeKit,
  getTokenMessengerV2Address,
} from "@/lib/bridgeKit";
import { CHAINS, getExplorerTxUrl } from "@/lib/chains";
import { loadSelectedChain, onSelectedChain } from "@/lib/selectedChain";
import { getUsdcToken } from "@/lib/tokens";
import { onWalletState } from "@/lib/walletState";
import { isWalletDisconnected } from "@/lib/walletSession";
import type { ActivityEvent, ActivityStatus } from "@/shared/types";
import type { EIP1193Provider } from "viem";

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
};

const ERC20_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const pickAlternateChainId = (fromChainId: number, currentDest: number) => {
  if (currentDest && currentDest !== fromChainId) return currentDest;
  const fallback = CHAINS.find((chain) => chain.chainId !== fromChainId);
  return fallback?.chainId ?? fromChainId;
};

export default function BridgePage() {
  const storageKey = "arc-bridge-progress";
  const defaultSource = CHAINS[0]?.chainId ?? 0;
  const defaultDest = CHAINS[1]?.chainId ?? defaultSource;
  const staleMs = 10 * 60 * 1000;

  const [sourceChainId, setSourceChainId] = useState(defaultSource);
  const [destChainId, setDestChainId] = useState(defaultDest);
  const [amount, setAmount] = useState("");
  const [stepIndex, setStepIndex] = useState<number | null>(null);
  const [transferId, setTransferId] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isBridging, setIsBridging] = useState(false);
  const [bridgeError, setBridgeError] = useState<string | null>(null);
  const [bridgeErrorDetail, setBridgeErrorDetail] = useState<string | null>(null);
  const [failedStep, setFailedStep] = useState<number | null>(null);
  const [stepTxs, setStepTxs] = useState<
    Record<number, { txHash?: string; explorerUrl?: string }>
  >({});
  const [balanceBaseUnits, setBalanceBaseUnits] = useState<bigint | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [balanceWarning, setBalanceWarning] = useState<string | null>(null);
  const [balanceSwitchError, setBalanceSwitchError] = useState<string | null>(
    null
  );
  const [balanceSwitching, setBalanceSwitching] = useState(false);
  const [amountPercent, setAmountPercent] = useState(0);
  const isConnected = Boolean(walletAddress);
  const [balanceSource, setBalanceSource] = useState<"erc20" | "native" | null>(
    null
  );
  const [walletChainId, setWalletChainId] = useState<number | null>(null);
  const sourceChainName =
    CHAINS.find((chain) => chain.chainId === sourceChainId)?.name ??
    "source chain";

  useEffect(() => {
    const saved = loadSelectedChain();
    if (saved && saved !== sourceChainId) {
      setSourceChainId(saved);
      setDestChainId((prev) => pickAlternateChainId(saved, prev));
    }
    const unsubscribe = onSelectedChain((chainId) => {
      setSourceChainId(chainId);
      setDestChainId((prev) => pickAlternateChainId(chainId, prev));
    });
    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    setDestChainId((prev) => pickAlternateChainId(sourceChainId, prev));
  }, [sourceChainId]);

  const parseUsdcToBaseUnits = (value: string) => {
    const trimmed = value.trim();
    if (!/^\d+(\.\d+)?$/.test(trimmed)) return "";
    const [whole, fraction = ""] = trimmed.split(".");
    const padded = `${fraction}000000`.slice(0, 6);
    const combined = `${whole}${padded}`.replace(/^0+(?=\d)/, "");
    return combined === "" ? "0" : combined;
  };

  const formatUsdcBaseUnits = (value: bigint) => {
    const formatted = formatUnits(value, 6);
    return formatted.replace(/\.?0+$/, "");
  };

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
          lastUpdated?: string;
          stepTxs?: Record<string, { txHash?: string; explorerUrl?: string }>;
        };
        const lastUpdated = parsed.lastUpdated
          ? Date.parse(parsed.lastUpdated)
          : null;
        const hasAnyTx = parsed.stepTxs
          ? Object.values(parsed.stepTxs).some((value) => Boolean(value?.txHash))
          : false;
        if (
          parsed.stepIndex !== null &&
          typeof parsed.stepIndex === "number" &&
          !hasAnyTx
        ) {
          localStorage.removeItem(storageKey);
          setIsHydrated(true);
          return;
        }
        if (lastUpdated && Date.now() - lastUpdated > staleMs) {
          localStorage.removeItem(storageKey);
          setIsHydrated(true);
          return;
        }
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
        if (parsed.stepTxs) {
          const normalized: Record<number, { txHash?: string; explorerUrl?: string }> =
            {};
          for (const [key, value] of Object.entries(parsed.stepTxs)) {
            const index = Number(key);
            if (!Number.isFinite(index)) continue;
            normalized[index] = value ?? {};
          }
          setStepTxs(normalized);
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
      lastUpdated: new Date().toISOString(),
      stepTxs,
    };
    localStorage.setItem(storageKey, JSON.stringify(payload));
  }, [
    amount,
    destChainId,
    isHydrated,
    sourceChainId,
    stepTxs,
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
    ethereum
      .request({ method: "eth_chainId" })
      .then((id) => {
        if (typeof id === "string") {
          const parsed = id.startsWith("0x") ? parseInt(id, 16) : Number(id);
          setWalletChainId(Number.isFinite(parsed) ? parsed : null);
        } else if (typeof id === "number") {
          setWalletChainId(id);
        }
      })
      .catch(() => {});
    const unsubscribe = onWalletState((state) => {
      setWalletAddress(state.address);
      setWalletChainId(state.chainId);
    });
    ethereum.on?.("accountsChanged", handleAccounts);
    const onChainChanged = (id: unknown) => {
      if (typeof id === "string") {
        const parsed = id.startsWith("0x") ? parseInt(id, 16) : Number(id);
        setWalletChainId(Number.isFinite(parsed) ? parsed : null);
      } else if (typeof id === "number") {
        setWalletChainId(id);
      } else {
        setWalletChainId(null);
      }
    };
    ethereum.on?.("chainChanged", onChainChanged);
    return () => {
      unsubscribe();
      ethereum.removeListener?.("accountsChanged", handleAccounts);
      ethereum.removeListener?.("chainChanged", onChainChanged);
    };
  }, []);

  useEffect(() => {
    if (!isConnected || !walletAddress) {
      setBalanceBaseUnits(null);
      setBalanceError(null);
      setBalanceWarning(null);
      setBalanceLoading(false);
      setBalanceSource(null);
      return;
    }
    const token = getUsdcToken(sourceChainId);
    const rpcUrl = CHAINS.find((chain) => chain.chainId === sourceChainId)?.rpcUrl;
    if (!token) {
      setBalanceBaseUnits(null);
      setBalanceError("USDC address not configured");
      return;
    }
    let active = true;
    setBalanceLoading(true);
    setBalanceError(null);
    setBalanceWarning(null);
    setBalanceSwitchError(null);
    setBalanceSource(null);
    const load = async () => {
      const ethereum = (window as { ethereum?: EthereumProvider }).ethereum;
      if (!ethereum) {
        setBalanceBaseUnits(null);
        setBalanceError("Wallet not available");
        setBalanceLoading(false);
        return;
      }
      let currentChainId: number | null = null;
      try {
        const id = await ethereum.request({ method: "eth_chainId" });
        if (typeof id === "string") {
          const parsed = id.startsWith("0x") ? parseInt(id, 16) : Number(id);
          currentChainId = Number.isFinite(parsed) ? parsed : null;
        } else if (typeof id === "number") {
          currentChainId = id;
        }
        if (currentChainId !== walletChainId) {
          setWalletChainId(currentChainId);
        }
      } catch {
        currentChainId = walletChainId;
      }
      const needsSwitch =
        !currentChainId || currentChainId !== sourceChainId;
      if (needsSwitch) {
        setBalanceWarning(`Switch wallet to ${sourceChainName} to load balance`);
      }

      const readViaRpc = async () => {
        if (!rpcUrl) {
          throw new Error("RPC URL not configured");
        }
        const tokenAddress = getAddress(token.address);
        const accountAddress = getAddress(walletAddress);
        const rpcClient = createPublicClient({ transport: http(rpcUrl) });
        const value = (await rpcClient.readContract({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [accountAddress],
        })) as bigint;
        return value;
      };

      try {
        const value = await readViaRpc();
        if (!active) return;
        setBalanceBaseUnits(value);
        setBalanceSource("erc20");
        return;
      } catch (error) {
        if (!active) return;
        if (error instanceof Error && error.message === "RPC URL not configured") {
          setBalanceError("RPC URL not configured");
          setBalanceLoading(false);
          return;
        }
        const message =
          error instanceof Error && error.message
            ? `RPC error: ${error.message}`
            : "Failed to load balance from RPC";
        setBalanceError(message);
        setBalanceBaseUnits(null);
      } finally {
        if (!active) return;
        setBalanceLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [isConnected, sourceChainId, walletAddress, walletChainId, sourceChainName]);

  useEffect(() => {
    if (!balanceBaseUnits || balanceBaseUnits === 0n) {
      setAmountPercent(0);
      return;
    }
    const baseUnits = parseUsdcToBaseUnits(amount);
    if (!baseUnits) {
      setAmountPercent(0);
      return;
    }
    const percent = Number((BigInt(baseUnits) * 100n) / balanceBaseUnits);
    const clamped = Math.max(0, Math.min(100, percent));
    setAmountPercent(clamped);
  }, [amount, balanceBaseUnits]);

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

  const isFailed = failedStep !== null;
  const hasActiveFlow = stepIndex !== null && stepIndex < steps.length && !isFailed;
  const isBusy = isBridging || hasActiveFlow;
  const tokenMessengerAddress = getTokenMessengerV2Address(sourceChainId);
  const balanceLabel = useMemo(() => {
    if (balanceLoading) return "Loading...";
    if (balanceError) return balanceError;
    if (balanceBaseUnits === null) return "-";
    return `${formatUsdcBaseUnits(balanceBaseUnits)} USDC`;
  }, [balanceBaseUnits, balanceError, balanceLoading]);

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
    const amountBaseUnits = parseUsdcToBaseUnits(amount);
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
    setBridgeErrorDetail(null);
    setFailedStep(null);
    setStepTxs({});

    if (!walletChainId || walletChainId !== sourceChainId) {
      setBridgeError(`Switch wallet to ${sourceChainName} before bridging`);
      return;
    }

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
    const amountBaseUnits = parseUsdcToBaseUnits(amountValue);
    if (!amountBaseUnits || amountBaseUnits === "0") {
      setBridgeError("Enter a valid amount");
      return;
    }
    const normalizedAmount = formatUsdcBaseUnits(BigInt(amountBaseUnits));
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
      console.info("bridge:event", event);
      const method = event.method;
      if (!method) return;
      if (method === "approve") {
        lastStepIndex = 1;
        setStepIndex(1);
        if (event.values?.txHash) {
          setStepTxs((prev) => ({
            ...prev,
            0: {
              txHash: event.values?.txHash,
              explorerUrl: event.values?.explorerUrl,
            },
          }));
        }
        recordBridgeEvent("approved", intentId, {
          sourceTxHash: event.values?.txHash,
          explorerSourceUrl: event.values?.explorerUrl,
        });
        return;
      }
      if (method === "burn") {
        lastStepIndex = 2;
        setStepIndex(2);
        if (event.values?.txHash) {
          setStepTxs((prev) => ({
            ...prev,
            1: {
              txHash: event.values?.txHash,
              explorerUrl: event.values?.explorerUrl,
            },
          }));
        }
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
        if (event.values?.txHash) {
          setStepTxs((prev) => ({
            ...prev,
            3: {
              txHash: event.values?.txHash,
              explorerUrl: event.values?.explorerUrl,
            },
          }));
        }
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
        amount: normalizedAmount,
      });
      if (result?.state === "error") {
        setFailedStep(lastStepIndex);
        setBridgeError("Bridge failed");
        setBridgeErrorDetail(JSON.stringify(result, null, 2));
        recordBridgeEvent("failed", intentId);
      } else {
        setStepIndex(steps.length);
        const ethereum = (window as { ethereum?: EthereumProvider }).ethereum;
        if (ethereum) {
          try {
            await ethereum.request({
              method: "wallet_switchEthereumChain",
              params: [{ chainId: `0x${sourceChainId.toString(16)}` }],
            });
          } catch {}
        }
      }
    } catch (error) {
      console.error("bridge:error", error);
      setFailedStep(lastStepIndex);
      setBridgeError("Bridge failed");
      if (error instanceof Error) {
        setBridgeErrorDetail(error.message);
      } else {
        setBridgeErrorDetail(JSON.stringify(error));
      }
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
    setAmountPercent(0);
    if (typeof window !== "undefined") {
      localStorage.removeItem(storageKey);
    }
  };

  const onPercentChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextPercent = Number(event.target.value);
    setAmountPercent(nextPercent);
    if (!balanceBaseUnits) {
      return;
    }
    const nextValue = (balanceBaseUnits * BigInt(nextPercent)) / 100n;
    setAmount(formatUsdcBaseUnits(nextValue));
  };

  const onUseMax = () => {
    if (!balanceBaseUnits) return;
    setAmount(formatUsdcBaseUnits(balanceBaseUnits));
  };

  const onSwitchWalletToSource = async () => {
    setBalanceSwitchError(null);
    const ethereum = (window as { ethereum?: EthereumProvider }).ethereum;
    if (!ethereum) {
      setBalanceSwitchError("No wallet found");
      return;
    }
    setBalanceSwitching(true);
    try {
      await ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: `0x${sourceChainId.toString(16)}` }],
      });
    } catch (err) {
      const code =
        typeof err === "object" && err && "code" in err
          ? Number((err as { code?: number }).code)
          : null;
      if (code === 4902) {
        setBalanceSwitchError("Network not available in wallet");
      } else {
        setBalanceSwitchError("Failed to switch network");
      }
    } finally {
      setBalanceSwitching(false);
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
                {CHAINS.filter((chain) => chain.chainId !== sourceChainId).map(
                  (chain) => (
                    <option key={chain.chainId} value={chain.chainId}>
                      {chain.name}
                    </option>
                  )
                )}
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
            <div className="space-y-2 md:col-span-2">
              <div className="flex items-center justify-between text-xs text-zinc-500">
                <span>Balance: {balanceLabel}</span>
                <button
                  className="rounded border border-zinc-300 px-2 py-1 text-[11px] uppercase"
                  onClick={onUseMax}
                  type="button"
                  disabled={!balanceBaseUnits || isBusy}
                >
                  Max
                </button>
              </div>
              <input
                className="w-full accent-zinc-900"
                type="range"
                min={0}
                max={100}
                step={5}
                value={amountPercent}
                onChange={onPercentChange}
                disabled={!balanceBaseUnits || isBusy}
                list="bridge-amount-marks"
              />
              <datalist id="bridge-amount-marks">
                <option value="0" label="0%" />
                <option value="25" label="25%" />
                <option value="50" label="50%" />
                <option value="75" label="75%" />
                <option value="100" label="100%" />
              </datalist>
              <div className="flex justify-between text-[11px] text-zinc-500">
                <span>0%</span>
                <span>25%</span>
                <span>50%</span>
                <span>75%</span>
                <span>100%</span>
              </div>
              {balanceWarning ? (
                <div className="space-y-1 text-[11px] text-amber-700">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="rounded border border-amber-400 px-2 py-0.5 text-[11px] text-amber-800"
                      onClick={onSwitchWalletToSource}
                      disabled={
                        !walletChainId ||
                        walletChainId === sourceChainId ||
                        balanceSwitching
                      }
                    >
                      {balanceSwitching ? "Switching..." : "Switch wallet"}
                    </button>
                    <span>to {sourceChainName} to load balance</span>
                  </div>
                  {balanceSwitchError ? (
                    <div className="text-red-600">{balanceSwitchError}</div>
                  ) : null}
                </div>
              ) : balanceSource === "native" ? (
                <div className="text-[11px] text-amber-700">
                  Using native Arc balance (converted to 6 decimals).
                </div>
              ) : null}
              {balanceError ? (
                <div className="text-[11px] text-amber-700">{balanceError}</div>
              ) : null}
            </div>
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
              <div className="space-y-1 text-xs text-red-600">
                <div>{bridgeError}</div>
                {bridgeErrorDetail ? (
                  <pre className="whitespace-pre-wrap break-words text-[11px] text-red-700">
                    {bridgeErrorDetail}
                  </pre>
                ) : null}
              </div>
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
                    {stepTxs[index]?.txHash ? (
                      <a
                        className="text-[11px] text-zinc-700 underline"
                        href={
                          stepTxs[index]?.explorerUrl ??
                          getExplorerTxUrl(
                            index < 3 ? sourceChainId : destChainId,
                            stepTxs[index]?.txHash ?? ""
                          )
                        }
                        target="_blank"
                        rel="noreferrer"
                      >
                        View transaction
                      </a>
                    ) : null}
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
