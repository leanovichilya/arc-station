"use client";

import { useEffect, useState } from "react";
import { onWalletState } from "@/lib/walletState";

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
};

export default function WalletStatus() {
  const [address, setAddress] = useState<string | null>(null);
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

  const short =
    address && address.length > 10
      ? `${address.slice(0, 6)}...${address.slice(-4)}`
      : address;

  return (
    <div className="flex items-center gap-3 text-xs text-zinc-600">
      <span>{address ? "Connected" : "Not connected"}</span>
      {address ? <span>Chain: {chainId ?? "-"}</span> : null}
      {short ? <span>{short}</span> : null}
    </div>
  );
}
