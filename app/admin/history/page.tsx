"use client";

import { useEffect, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { formatBytes, formatTime, cn } from "@/lib/utils";

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

export default function AdminHistoryPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/transfers", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setRows(d.transfers ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          Activity <ShieldCheck className="w-5 h-5 text-nexus-green" />
        </h1>
        <p className="text-sm text-white/45 mt-0.5">
          Every transfer on the system — including ones people removed.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-white/50">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-nexus-border bg-nexus-card p-10 text-center text-sm text-white/45">
          No transfers yet
        </div>
      ) : (
        <div className="rounded-2xl border border-nexus-border bg-nexus-card overflow-hidden divide-y divide-nexus-border">
          {rows.map((r) => {
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
