"use client";

import { useState } from "react";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { useApp } from "./AppStateProvider";

export default function AlertBanner() {
  const { state, refresh } = useApp();
  const [clearing, setClearing] = useState(false);
  const alerts = state?.adminAlerts ?? [];
  if (state?.me.role !== "admin" || alerts.length === 0) return null;

  const full = alerts.some((a) => a.kind === "storage-full");

  async function clearSpace() {
    setClearing(true);
    await fetch("/api/admin/storage/sweep", { method: "POST" }).catch(() => {});
    await refresh();
    setClearing(false);
  }

  return (
    <div
      className={`mb-4 rounded-2xl border p-3.5 flex items-start gap-3 ${
        full
          ? "border-[#ff5a5a]/40 bg-[#ff5a5a]/10"
          : "border-[#f0b429]/40 bg-[#f0b429]/10"
      }`}
    >
      <AlertTriangle
        className={`w-4 h-4 mt-0.5 shrink-0 ${full ? "text-[#ff5a5a]" : "text-[#f0b429]"}`}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">
          {full ? "Storage full — uploads are blocked" : "Storage is filling up"}
        </p>
        <p className="text-xs text-white/50 mt-0.5">{alerts[0].message}</p>
      </div>
      <button
        onClick={clearSpace}
        disabled={clearing}
        className="shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold bg-white/10 hover:bg-white/15 disabled:opacity-50 px-3 py-2 rounded-lg transition-colors"
      >
        {clearing ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Trash2 className="w-3.5 h-3.5" />
        )}
        Clear expired
      </button>
    </div>
  );
}
