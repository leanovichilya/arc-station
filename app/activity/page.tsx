"use client";

import { useEffect, useState } from "react";

type ActivityItem = {
  id: string;
  label: string;
  ts: number;
};

const STORAGE_KEY = "arc-station-activity";

export default function ActivityPage() {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [label, setLabel] = useState("");

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as ActivityItem[];
      if (Array.isArray(parsed)) setItems(parsed);
    } catch {}
  }, []);

  const saveItems = (next: ActivityItem[]) => {
    setItems(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const addItem = () => {
    const value = label.trim();
    if (!value) return;
    const next = [
      { id: crypto.randomUUID(), label: value, ts: Date.now() },
      ...items,
    ];
    setLabel("");
    saveItems(next);
  };

  const clearItems = () => {
    saveItems([]);
  };

  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold">Activity</h1>
      <div className="flex flex-wrap gap-2">
        <input
          className="h-9 w-64 rounded border border-zinc-300 px-3 text-sm"
          placeholder="Action"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <button
          className="h-9 rounded bg-zinc-900 px-3 text-sm font-medium text-white"
          onClick={addItem}
        >
          Add
        </button>
        <button
          className="h-9 rounded border border-zinc-300 px-3 text-sm"
          onClick={clearItems}
        >
          Clear
        </button>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-zinc-600">No activity yet.</p>
      ) : (
        <ul className="divide-y divide-zinc-200 text-sm">
          {items.map((item) => (
            <li key={item.id} className="py-2">
              <div className="font-medium">{item.label}</div>
              <div className="text-xs text-zinc-500">
                {new Date(item.ts).toLocaleString()}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
