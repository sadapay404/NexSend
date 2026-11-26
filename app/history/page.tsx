"use client";

import { useEffect, useMemo, useState } from "react";
import { History as HistoryIcon, Loader2, Search, X } from "lucide-react";
import TransferCard from "@/components/TransferCard";
import { useApp } from "@/components/AppStateProvider";
import { cn } from "@/lib/utils";
import type { TransferItem } from "@/lib/types";

type Scope = "all" | "sent" | "received";
type Kind = "all" | "text" | "image" | "video" | "file";

const KINDS: { key: Kind; label: string }[] = [
  { key: "all", label: "All" },
  { key: "text", label: "Text" },
  { key: "image", label: "Images" },
  { key: "video", label: "Videos" },
  { key: "file", label: "Files" },
];

function matchesKind(type: string, kind: Kind): boolean {
  if (kind === "all") return true;
  if (kind === "text") return type === "text" || type === "clipboard";
  if (kind === "image") return type === "image";
  if (kind === "video") return type === "video";
  return type === "file" || type === "folder";
}

export default function HistoryPage() {
  const { refresh: refreshState } = useApp();
  const [scope, setScope] = useState<Scope>("all");
  const [kind, setKind] = useState<Kind>("all");
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

  const byScope = useMemo(() => {
    const incoming = (data?.incoming ?? []).map((t) => ({ ...t, _p: "received" as const }));
    const sent = (data?.sent ?? []).map((t) => ({ ...t, _p: "sent" as const }));
    let all = [...incoming, ...sent].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    if (scope === "sent") all = all.filter((t) => t._p === "sent");
    if (scope === "received") all = all.filter((t) => t._p === "received");
    return all;
  }, [data, scope]);

  const rows = useMemo(() => {
    let all = byScope.filter((t) => matchesKind(t.type, kind));
    const q = query.trim().toLowerCase();
    if (q) {
      all = all.filter((t) =>
        [
          t.fileName ?? "",
          t.text ?? "",
          t.senderName,
          t.type,
          ...t.recipients.map((r) => r.displayName),
        ]
          .join(" ")
          .toLowerCase()
          .includes(q)
      );
    }
    return all;
  }, [byScope, kind, query]);

  const filtered = kind !== "all" || query.trim().length > 0 || scope !== "all";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="hidden md:block">
          <h1 className="text-2xl font-bold tracking-tight">History</h1>
        </div>
      </div>

      <div className="sticky top-[57px] md:static z-20 bg-black md:bg-transparent py-1 md:py-0 -mx-4 px-4 md:mx-0 md:px-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex bg-nexus-card border border-nexus-border rounded-xl p-1">
            {(["all", "sent", "received"] as Scope[]).map((s) => (
              <button
                key={s}
                onClick={() => setScope(s)}
                className={cn(
                  "text-xs px-3 py-1.5 rounded-lg capitalize transition-colors",
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
              placeholder="Search files, messages, people"
              className="w-full bg-nexus-card border border-nexus-border rounded-xl pl-9 pr-9 py-2.5 text-sm outline-none focus:border-nexus-green"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
          {KINDS.map((k) => {
            const active = kind === k.key;
            return (
              <button
                key={k.key}
                onClick={() => setKind(k.key)}
                className={cn(
                  "shrink-0 text-xs px-3 py-1.5 rounded-full border transition-all",
                  active
                    ? "bg-nexus-green/15 border-nexus-green/50 text-nexus-green font-semibold"
                    : "bg-nexus-card border-nexus-border text-white/50 hover:text-white hover:border-white/25"
                )}
              >
                {k.label}
              </button>
            );
          })}

          {filtered && !loading && (
            <button
              onClick={() => {
                setKind("all");
                setQuery("");
                setScope("all");
              }}
              className="shrink-0 text-xs px-2.5 py-1.5 text-white/40 hover:text-white transition-colors"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {filtered && !loading && rows.length > 0 && (
        <p className="text-[11px] text-white/35 -mt-1">
          {rows.length} of {byScope.length} shown
        </p>
      )}

      {loading && !data ? (
        <div className="flex items-center gap-2 text-sm text-white/50">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-nexus-border bg-nexus-card p-10 text-center">
          <HistoryIcon className="w-8 h-8 mx-auto text-white/20" />
          <p className="text-sm text-white/50 mt-3">
            {filtered ? "Nothing matches that filter" : "No transfers yet"}
          </p>
          {filtered && (
            <button
              onClick={() => {
                setKind("all");
                setQuery("");
                setScope("all");
              }}
              className="mt-3 text-xs text-nexus-green hover:underline"
            >
              Clear filters
            </button>
          )}
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
