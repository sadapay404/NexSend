"use client";

import { useEffect, useState } from "react";
import { Loader2, Search, ShieldCheck, X } from "lucide-react";
import { formatBytes, formatTime, cn } from "@/lib/utils";
import AdminTabs from "@/components/AdminTabs";

type Row = {
  id: string;
  type: string;
  file_name: string | null;
  file_size: string | null;
  text_content: string | null;
  status: string;
  created_at: string;
  expires_at: string;
  deleted_by_sender: boolean;
  sender_name: string;
  recipients: { id: string; displayName: string; status: string; deleted: boolean }[];
};

const KINDS = [
  { key: "all", label: "All" },
  { key: "text", label: "Text" },
  { key: "image", label: "Images" },
  { key: "video", label: "Videos" },
  { key: "file", label: "Files" },
] as const;

type Kind = (typeof KINDS)[number]["key"];

function matchesKind(type: string, kind: Kind): boolean {
  if (kind === "all") return true;
  if (kind === "text") return type === "text" || type === "clipboard";
  return type === kind || (kind === "file" && type === "folder");
}

export default function AdminHistoryPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<Kind>("all");

  const visible = rows.filter((r) => {
    if (!matchesKind(r.type, kind)) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [
      r.file_name ?? "",
      r.text_content ?? "",
      r.sender_name,
      r.type,
      ...r.recipients.map((x) => x.displayName),
    ]
      .join(" ")
      .toLowerCase()
      .includes(q);
  });

  useEffect(() => {
    fetch("/api/admin/transfers", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setRows(d.transfers ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-5">
      <AdminTabs />

      <div>
        <h1 className="text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2">
          Activity <ShieldCheck className="w-5 h-5 text-nexus-green" />
        </h1>
        <p className="text-xs md:text-sm text-white/45 mt-0.5">
          Every transfer, including removed ones.
        </p>
      </div>

      <div className="space-y-2">
        <div className="relative">
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

        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
          {KINDS.map((k) => (
            <button
              key={k.key}
              onClick={() => setKind(k.key)}
              className={cn(
                "shrink-0 text-xs px-3 py-1.5 rounded-full border transition-all",
                kind === k.key
                  ? "bg-nexus-green/15 border-nexus-green/50 text-nexus-green font-semibold"
                  : "bg-nexus-card border-nexus-border text-white/50 hover:text-white hover:border-white/25"
              )}
            >
              {k.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-white/50">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-nexus-border bg-nexus-card p-10 text-center text-sm text-white/45">
          {rows.length === 0 ? "No transfers yet" : "Nothing matches that filter"}
        </div>
      ) : (
        <div className="rounded-2xl border border-nexus-border bg-nexus-card overflow-hidden divide-y divide-nexus-border">
          {visible.map((r) => {
            const expired = new Date(r.expires_at).getTime() < Date.now();
            return (
              <div key={r.id} className="p-3.5">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {r.file_name ??
                        (r.text_content ? r.text_content.slice(0, 70) : r.type)}
                    </p>
                    <p className="text-[11px] text-white/35 mt-0.5">
                      {r.sender_name} →{" "}
                      {r.recipients.map((x) => x.displayName).join(", ") || "—"} ·{" "}
                      {formatTime(r.created_at)}
                      {r.file_size ? ` · ${formatBytes(Number(r.file_size))}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span
                      className={cn(
                        "text-[11px] px-2 py-0.5 rounded-md",
                        expired
                          ? "bg-white/5 text-white/35"
                          : "bg-nexus-green/10 text-nexus-green"
                      )}
                    >
                      {expired ? "Expired" : "Live"}
                    </span>
                    {r.deleted_by_sender && (
                      <span className="text-[10px] text-white/30">removed by sender</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
