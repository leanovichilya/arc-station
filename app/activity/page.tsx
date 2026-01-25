"use client";

import { useEffect, useState } from "react";
import { ActivityEvent, clearActivity, getActivity } from "@/lib/activity";

export default function ActivityPage() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);

  useEffect(() => {
    setEvents(getActivity());
  }, []);

  const onClear = () => {
    clearActivity();
    setEvents([]);
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Activity</h1>
        <button
          className="h-9 rounded border border-zinc-300 px-3 text-sm"
          onClick={onClear}
        >
          Clear
        </button>
      </div>
      {events.length === 0 ? (
        <p className="text-sm text-zinc-600">No activity yet.</p>
      ) : (
        <div className="overflow-x-auto rounded border border-zinc-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-zinc-600">
              <tr>
                <th className="px-3 py-2 font-medium">Time</th>
                <th className="px-3 py-2 font-medium">Event</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {events.map((event) => (
                <tr key={event.id}>
                  <td className="px-3 py-2 text-zinc-600">
                    {new Date(event.timestamp).toLocaleString()}
                  </td>
                  <td className="px-3 py-2">{event.label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
