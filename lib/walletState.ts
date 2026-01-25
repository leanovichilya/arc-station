export type WalletState = {
  address: string | null;
  chainId: number | null;
};

const EVENT_NAME = "arc-wallet-state";

export function emitWalletState(state: WalletState) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: state }));
}

export function onWalletState(handler: (state: WalletState) => void) {
  if (typeof window === "undefined") return () => {};
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<WalletState>).detail;
    if (!detail) return;
    handler(detail);
  };
  window.addEventListener(EVENT_NAME, listener);
  return () => window.removeEventListener(EVENT_NAME, listener);
}
