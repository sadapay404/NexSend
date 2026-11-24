"use client";

import { useEffect, useMemo, useState } from "react";
import { History as HistoryIcon, Loader2, Search } from "lucide-react";
import TransferCard from "@/components/TransferCard";
import { useApp } from "@/components/AppStateProvider";
import { cn } from "@/lib/utils";
import type { TransferItem } from "@/lib/types";

type Scope = "all" | "sent" | "received";

export default function HistoryPage() {
  const { refresh: refreshState } = useApp();
  const [scope, setScope] = useState<Scope>("all");
  const [query, setQuery] = useState("");
  const [data, setData] = useState<{ incoming: TransferItem[]; sent: TransferItem[] } | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/history", { cache: "no-store" });
    if (res.ok) setData(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const rows = useMemo(() => {
    const incoming = (data?.incoming ?? []).map((t) => ({ ...t, _p: "received" as const }));
    const sent = (data?.sent ?? []).map((t) => ({ ...t, _p: "sent" as const }));
    let all = [...incoming, ...sent].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    if (scope === "sent") all = all.filter((t) => t._p === "sent");
    if (scope === "received") all = all.filter((t) => t._p === "received");
    if (query.trim()) {
      const q = query.toLowerCase();
      all = all.filter((t) =>
        [
          t.fileName ?? "",
          t.text ?? "",
          t.senderName,
          ...t.recipients.map((r) => r.displayName),
        ]
          .join(" ")
          .toLowerCase()
          .includes(q)
      );
    }
    return all;
  }, [data, scope, query]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="hidden md:block">
          <h1 className="text-2xl font-bold tracking-tight">History</h1>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 sticky top-[57px] md:static z-20 bg-black md:bg-transparent py-1 md:py-0 -mx-4 px-4 md:mx-0 md:px-0">
        <div className="flex bg-nexus-card border border-nexus-border rounded-xl p-1">
          {(["all", "sent", "received"] as Scope[]).map((s) => (
            <button
              key={s}
              onClick={() => setScope(s)}
              className={cn(
                "text-xs px-3 py-1.5 rounded-lg capitalize",
                scope === s ? "bg-nexus-green text-black font-semibold" : "text-white/50"
              )}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-4 h-4 text-white/30 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or file"
            className="w-full bg-nexus-card border border-nexus-border rounded-xl pl-9 pr-3 py-2.5 text-sm outline-none focus:border-nexus-green"
          />
        </div>
      </div>

      {loading && !data ? (
        <div className="flex items-center gap-2 text-sm text-white/50">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-nexus-border bg-nexus-card p-10 text-center">
          <HistoryIcon className="w-8 h-8 mx-auto text-white/20" />
          <p className="text-sm text-white/50 mt-3">No transfers yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((item) => (
            <TransferCard
              key={`${item._p}-${item.id}`}
              item={item}
              perspective={item._p}
              onChanged={() => {
                load();
                refreshState();
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
