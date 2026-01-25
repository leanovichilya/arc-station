"use client";

import { useEffect, useState } from "react";
import { ActivityEvent, clearEvents, listEvents } from "@/lib/activity";
import { getExplorerTxUrl } from "@/lib/chains";

export default function ActivityPage() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);

  useEffect(() => {
    setEvents(listEvents());
  }, []);

  const onClear = () => {
    clearEvents();
    setEvents([]);
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Activity</h1>
          <div className="text-sm text-zinc-600">Actor: not connected</div>
        </div>
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
                <th className="px-3 py-2 font-medium">Kind</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Tx</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {events.map((event) => {
                const txHash = event.tx?.hash;
                const chainId = event.tx?.chainId;
                const txUrl =
                  txHash && chainId
                    ? getExplorerTxUrl(chainId, txHash)
                    : "";
                return (
                  <tr key={event.id}>
                    <td className="px-3 py-2 text-zinc-600">
                      {new Date(event.createdAt).toLocaleString()}
                    </td>
                    <td className="px-3 py-2">{event.kind}</td>
                    <td className="px-3 py-2">{event.status}</td>
                    <td className="px-3 py-2">
                      {txUrl ? (
                        <a
                          className="text-blue-600 underline"
                          href={txUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {txHash}
                        </a>
                      ) : (
                        <span className="text-zinc-500">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
