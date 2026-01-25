"use client";

import { useEffect, useState } from "react";

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
};

export default function WalletConnect() {
  const [address, setAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ethereum = (window as { ethereum?: EthereumProvider }).ethereum;
    if (!ethereum) return;
    const handleAccounts = (accounts: unknown) => {
      const list = Array.isArray(accounts) ? accounts : [];
      const next = typeof list[0] === "string" ? list[0] : null;
      setAddress(next);
    };
    ethereum
      .request({ method: "eth_accounts" })
      .then(handleAccounts)
      .catch(() => {});
    const onAccountsChanged = (accounts: unknown) => handleAccounts(accounts);
    ethereum.on?.("accountsChanged", onAccountsChanged);
    return () => {
      ethereum.removeListener?.("accountsChanged", onAccountsChanged);
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
      setAddress(accounts?.[0] ?? null);
    } catch {
      setError("Connection rejected");
    }
  };

  const onDisconnect = () => {
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
