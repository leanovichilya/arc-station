export type ActivityEvent = {
  id: string;
  createdAt: number;
  intentId: string;
  actor: string;
  kind: string;
  status: string;
  chains: number[];
  token: string;
  tx: {
    hash?: string;
    chainId?: number;
  };
  refs: Record<string, string>;
  meta: Record<string, string | number | boolean | null>;
};

const STORAGE_KEY = "arc-station-activity";

export function listEvents(): ActivityEvent[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as ActivityEvent[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function addEvent(event: ActivityEvent) {
  if (typeof window === "undefined") return;
  const next = [event, ...listEvents()];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function clearEvents() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}
