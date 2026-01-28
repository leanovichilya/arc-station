const STORAGE_KEY = "arc-selected-chain";
const EVENT_NAME = "arc-selected-chain";

export function loadSelectedChain() {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  const value = raw ? Number(raw) : NaN;
  return Number.isFinite(value) ? value : null;
}

export function emitSelectedChain(chainId: number) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, String(chainId));
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: chainId }));
}

export function onSelectedChain(handler: (chainId: number) => void) {
  if (typeof window === "undefined") return () => {};
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<number>).detail;
    if (typeof detail !== "number") return;
    handler(detail);
  };
  window.addEventListener(EVENT_NAME, listener);
  return () => window.removeEventListener(EVENT_NAME, listener);
}
