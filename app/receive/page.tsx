"use client";

import { useState } from "react";
import { Inbox, Loader2 } from "lucide-react";
import { useApp } from "@/components/AppStateProvider";
import TransferCard from "@/components/TransferCard";
import { cn } from "@/lib/utils";

export default function ReceivePage() {
  const { state, loading, refresh } = useApp();
  const [showExpired, setShowExpired] = useState(false);

  if (loading && !state) {
    return (
      <div className="flex items-center gap-2 text-sm text-white/50">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading
      </div>
    );
  }

  const incoming = state?.incoming ?? [];
  const live = incoming.filter((t) => !t.expired);
  const expired = incoming.filter((t) => t.expired);
  const pending = live.filter((t) => t.myStatus === "pending");

  return (
    <div className="space-y-5">
      <div className="hidden md:block">
        <h1 className="text-2xl font-bold tracking-tight">Receive</h1>
        <p className="text-sm text-white/45 mt-0.5">
          {pending.length > 0 ? `${pending.length} waiting` : "Nothing waiting"}
        </p>
      </div>

      {pending.length > 0 && (
        <p className="md:hidden text-xs text-white/45">
          {pending.length} waiting for you
        </p>
      )}

      {live.length === 0 && (
        <div className="rounded-2xl border border-nexus-border bg-nexus-card p-12 text-center animate-pop">
          <Inbox className="w-9 h-9 mx-auto text-white/20" />
          <p className="text-sm text-white/50 mt-3">Nothing waiting</p>
        </div>
      )}

      <div className="space-y-3 stagger">
        {live.map((item) => (
          <TransferCard
            key={item.id}
            item={item}
            perspective="received"
            onChanged={refresh}
          />
        ))}
      </div>

      {expired.length > 0 && (
        <div>
          <button
            onClick={() => setShowExpired(!showExpired)}
            className="text-xs font-semibold uppercase tracking-wider text-white/40 hover:text-white press"
          >
            Expired ({expired.length}) {showExpired ? "−" : "+"}
          </button>
          <div className={cn("space-y-3 mt-3", showExpired ? "block" : "hidden")}>
            {expired.map((item) => (
              <TransferCard
                key={item.id}
                item={item}
                perspective="received"
                onChanged={refresh}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
