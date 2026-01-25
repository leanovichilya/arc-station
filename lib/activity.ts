export type ActivityEvent = {
  id: string;
  label: string;
  timestamp: number;
  txHash?: string;
  chainKey?: string;
};

const STORAGE_KEY = "arc-station-activity";

export function getActivity(): ActivityEvent[] {
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

export function setActivity(events: ActivityEvent[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
}

export function clearActivity() {
  setActivity([]);
}

export function addActivity(event: ActivityEvent) {
  const next = [event, ...getActivity()];
  setActivity(next);
}
