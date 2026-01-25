"use client";

import { useEffect, useState } from "react";
import { addEvent, ActivityEvent } from "@/lib/activity";
import { emitWalletState } from "@/lib/walletState";

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
};

export default function WalletConnect() {
  const [address, setAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);

  useEffect(() => {
    const ethereum = (window as { ethereum?: EthereumProvider }).ethereum;
    if (!ethereum) return;
    const handleAccounts = (accounts: unknown) => {
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
    const onAccountsChanged = (accounts: unknown) => handleAccounts(accounts);
    const onChainChanged = (id: unknown) => handleChain(id);
    ethereum.on?.("accountsChanged", onAccountsChanged);
    ethereum.on?.("chainChanged", onChainChanged);
    return () => {
      ethereum.removeListener?.("accountsChanged", onAccountsChanged);
      ethereum.removeListener?.("chainChanged", onChainChanged);
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
      const accounts = (await ethereum.request({
        method: "eth_requestAccounts",
      })) as string[];
      const nextAddress = accounts?.[0] ?? null;
      setAddress(nextAddress);
      emitWalletState({ address: nextAddress, chainId });
      if (nextAddress) {
        const event: ActivityEvent = {
          id: crypto.randomUUID(),
          createdAt: Date.now(),
          intentId: crypto.randomUUID(),
          actor: nextAddress,
          kind: "wallet.connect",
          status: "success",
          chains: chainId ? [chainId] : [],
          token: "",
          tx: {},
          refs: {},
          meta: {},
        };
        addEvent(event);
      }
    } catch {
      setError("Connection rejected");
    }
  };

  const onDisconnect = () => {
    if (address) {
      const event: ActivityEvent = {
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        intentId: crypto.randomUUID(),
        actor: address,
        kind: "wallet.disconnect",
        status: "success",
        chains: chainId ? [chainId] : [],
        token: "",
        tx: {},
        refs: {},
        meta: {},
      };
      addEvent(event);
    }
    emitWalletState({ address: null, chainId });
    setAddress(null);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      {address ? (
        <>
          <span className="rounded border border-zinc-300 px-2 py-1">
            {address}
          </span>
          <button
            className="h-9 rounded border border-zinc-300 px-3"
            onClick={onDisconnect}
          >
            Disconnect
          </button>
        </>
      ) : (
        <button
          className="h-9 rounded bg-zinc-900 px-3 font-medium text-white"
          onClick={onConnect}
        >
          Connect Wallet
        </button>
      )}
      {error ? <span className="text-red-600">{error}</span> : null}
    </div>
  );
}
