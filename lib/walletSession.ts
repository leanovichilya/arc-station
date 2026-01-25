const KEY = "arc-wallet-disconnected";

export function isWalletDisconnected() {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(KEY) === "1";
}

export function setWalletDisconnected(value: boolean) {
  if (typeof window === "undefined") return;
  if (value) {
    localStorage.setItem(KEY, "1");
  } else {
    localStorage.removeItem(KEY);
  }
}
