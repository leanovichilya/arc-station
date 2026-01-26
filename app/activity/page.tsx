"use client";

import { useEffect, useState } from "react";
import { clearEvents, listEvents } from "@/lib/activity";
import type { ActivityEvent } from "@/shared/types";
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
                const sourceHash = event.tx?.sourceTxHash;
                const destHash = event.tx?.destTxHash;
                const sourceUrl =
                  event.refs?.explorerSourceUrl ??
                  (sourceHash && event.chains?.sourceChainId
                    ? getExplorerTxUrl(event.chains.sourceChainId, sourceHash)
                    : "");
                const destUrl =
                  event.refs?.explorerDestUrl ??
                  (destHash && event.chains?.destChainId
                    ? getExplorerTxUrl(event.chains.destChainId, destHash)
                    : "");
                const links = [
                  sourceHash && sourceUrl
                    ? { label: "Source", hash: sourceHash, url: sourceUrl }
                    : null,
                  destHash && destUrl
                    ? { label: "Dest", hash: destHash, url: destUrl }
                    : null,
                ].filter(
                  (link): link is { label: string; hash: string; url: string } =>
                    Boolean(link)
                );
                const kindLabel =
                  event.signals?.items?.[0] &&
                  event.signals.items[0].startsWith("wallet.")
                    ? event.signals.items[0]
                    : event.kind;
                return (
                  <tr key={event.id}>
                    <td className="px-3 py-2 text-zinc-600">
                      {new Date(event.createdAt).toLocaleString()}
                    </td>
                    <td className="px-3 py-2">{kindLabel}</td>
                    <td className="px-3 py-2">{event.status}</td>
                    <td className="px-3 py-2">
                      {links.length > 0 ? (
                        <div className="flex flex-col gap-1">
                          {links.map((link) => (
                            <a
                              className="text-blue-600 underline"
                              href={link.url}
                              key={`${link.label}-${link.hash}`}
                              rel="noreferrer"
                              target="_blank"
                            >
                              {link.label}: {link.hash}
                            </a>
                          ))}
                        </div>
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
