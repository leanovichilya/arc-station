"use client";

import { useEffect, useState } from "react";
import { CHAINS } from "@/lib/chains";
import { onWalletState } from "@/lib/walletState";
import { isWalletDisconnected } from "@/lib/walletSession";

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
};

const DEFAULT_CHAIN_ID = CHAINS[0]?.chainId ?? null;

export default function NetworkSwitcher() {
  const [targetChainId, setTargetChainId] = useState<number | null>(
    DEFAULT_CHAIN_ID,
  );
  const [pendingChainId, setPendingChainId] = useState<number | null>(null);
  const [walletChainId, setWalletChainId] = useState<number | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSwitching, setIsSwitching] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showMismatchWarning, setShowMismatchWarning] = useState(false);

  useEffect(() => {
    const ethereum = (window as { ethereum?: EthereumProvider }).ethereum;
    if (!ethereum) return;
    const handleAccounts = (accounts: unknown) => {
      if (isWalletDisconnected()) {
        setAddress(null);
        return;
      }
      const list = Array.isArray(accounts) ? accounts : [];
      const next = typeof list[0] === "string" ? list[0] : null;
      setAddress(next);
    };
    const handleChain = (id: unknown) => {
      if (typeof id === "string") {
        const parsed = id.startsWith("0x") ? parseInt(id, 16) : Number(id);
        setWalletChainId(Number.isFinite(parsed) ? parsed : null);
      } else if (typeof id === "number") {
        setWalletChainId(id);
      } else {
        setWalletChainId(null);
      }
    };
    ethereum
      .request({ method: "eth_accounts" })
      .then(handleAccounts)
      .catch(() => {});
    ethereum
      .request({ method: "eth_chainId" })
      .then(handleChain)
      .catch(() => {});
    const unsubscribe = onWalletState((state) => {
      setAddress(state.address);
      setWalletChainId(state.chainId);
    });
    ethereum.on?.("accountsChanged", handleAccounts);
    ethereum.on?.("chainChanged", handleChain);
    return () => {
      unsubscribe();
      ethereum.removeListener?.("accountsChanged", handleAccounts);
      ethereum.removeListener?.("chainChanged", handleChain);
    };
  }, []);

  const pendingChain = pendingChainId
    ? CHAINS.find((chain) => chain.chainId === pendingChainId)
    : null;
  const isConnected = Boolean(address);
  const isMismatch =
    isConnected &&
    targetChainId !== null &&
    walletChainId !== null &&
    targetChainId !== walletChainId;

  useEffect(() => {
    if (!isMismatch) {
      setShowMismatchWarning(false);
    }
  }, [isMismatch]);

  const onSwitch = async (nextChainId: number) => {
    setError(null);
    if (!nextChainId) {
      setError("Select a network first");
      return;
    }
    const ethereum = (window as { ethereum?: EthereumProvider }).ethereum;
    if (!ethereum) {
      setError("No wallet found");
      return;
    }
    setIsSwitching(true);
    try {
      await ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: `0x${nextChainId.toString(16)}` }],
      });
    } catch (err) {
      const code =
        typeof err === "object" && err && "code" in err
          ? Number((err as { code?: number }).code)
          : null;
      if (code === 4902) {
        setError("Network not available in wallet");
      } else {
        setError("Failed to switch network");
      }
    } finally {
      setIsSwitching(false);
    }
  };

  const onSelectChange = (value: string) => {
    const next = Number(value);
    if (!Number.isFinite(next)) return;
    if (next === targetChainId) return;
    setError(null);
    setPendingChainId(next);
    setShowConfirm(true);
  };

  const onConfirmSwitch = async () => {
    if (!pendingChainId) {
      setShowConfirm(false);
      return;
    }
    setShowMismatchWarning(false);
    setTargetChainId(pendingChainId);
    await onSwitch(pendingChainId);
    setPendingChainId(null);
    setShowConfirm(false);
  };

  const onCancelSwitch = () => {
    setShowConfirm(false);
    setPendingChainId(null);
    if (isMismatch) {
      setShowMismatchWarning(true);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      {showMismatchWarning && isMismatch ? (
        <span className="text-red-600">неправильная сеть</span>
      ) : null}
      <div className="flex items-center gap-2">
        <select
          className="h-8 rounded border border-zinc-300 bg-white px-2 text-xs"
          value={targetChainId ?? ""}
          onChange={(event) => onSelectChange(event.target.value)}
        >
          {CHAINS.map((chain) => (
            <option key={chain.chainId} value={chain.chainId}>
              {chain.name}
            </option>
          ))}
        </select>
      </div>
      {error ? <span className="text-red-600">{error}</span> : null}
      {showConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded border border-zinc-200 bg-white p-4 text-sm shadow-lg">
            <div className="text-base font-semibold">Switch network?</div>
            <p className="mt-2 text-zinc-600">
              Switch wallet to {pendingChain?.name ?? "selected network"}.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={onCancelSwitch}
                className="h-9 rounded border border-zinc-300 px-3"
                disabled={isSwitching}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirmSwitch}
                className="h-9 rounded bg-zinc-900 px-3 font-medium text-white"
                disabled={isSwitching}
              >
                {isSwitching ? "Switching..." : "Switch"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
