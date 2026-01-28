"use client";

import { useEffect, useState } from "react";
import { emitWalletState, onWalletState } from "@/lib/walletState";
import { isWalletDisconnected, setWalletDisconnected } from "@/lib/walletSession";

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
};

export default function WalletStatus() {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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
        const parsed = id.startsWith("0x")
          ? parseInt(id, 16)
          : Number(id);
        setChainId(Number.isFinite(parsed) ? parsed : null);
      } else if (typeof id === "number") {
        setChainId(id);
      } else {
        setChainId(null);
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
      setChainId(state.chainId);
    });
    ethereum.on?.("accountsChanged", handleAccounts);
    ethereum.on?.("chainChanged", handleChain);
    return () => {
      unsubscribe();
      ethereum.removeListener?.("accountsChanged", handleAccounts);
      ethereum.removeListener?.("chainChanged", handleChain);
    };
  }, []);

  const onConnect = async () => {
    setError(null);
    const ethereum = (window as { ethereum?: EthereumProvider }).ethereum;
    if (!ethereum) {
      setError("No wallet found");
      return;
    }
    try {
      setWalletDisconnected(false);
      const accounts = (await ethereum.request({
        method: "eth_requestAccounts",
      })) as string[];
      const nextAddress = accounts?.[0] ?? null;
      setAddress(nextAddress);
      emitWalletState({ address: nextAddress, chainId });
    } catch {
      setError("Connection rejected");
    }
  };

  const onDisconnect = () => {
    setWalletDisconnected(true);
    emitWalletState({ address: null, chainId });
    setAddress(null);
  };

  const onCopy = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setError("Copy failed");
    }
  };

  return (
    <div className="flex items-center gap-2 text-xs text-zinc-600">
      <span className="font-mono text-zinc-900">
        {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "-"}
      </span>
      {address ? (
        <button
          type="button"
          className="h-8 rounded border border-zinc-300 px-2 text-xs text-zinc-900"
          onClick={onCopy}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      ) : null}
      {address ? (
        <button
          type="button"
          className="h-8 rounded border border-zinc-300 px-3 text-xs text-zinc-900"
          onClick={onDisconnect}
        >
          Disconnect
        </button>
      ) : (
        <button
          type="button"
          className="h-8 rounded bg-zinc-900 px-3 text-xs font-medium text-white"
          onClick={onConnect}
        >
          Connect wallet
        </button>
      )}
      {error ? <span className="text-red-600">{error}</span> : null}
    </div>
  );
}
