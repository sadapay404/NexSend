"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Star, Moon, Languages, ShieldCheck } from "lucide-react";
import { useApp } from "@/components/AppStateProvider";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const { state, refresh } = useApp();
  const me = state?.me;
  const [displayName, setDisplayName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [nameMsg, setNameMsg] = useState("");
  const [mode, setMode] = useState<"none" | "favs" | "all">("none");
  const [savingMode, setSavingMode] = useState(false);
  const hydrated = useRef(false);

  useEffect(() => {
    if (!me || hydrated.current) return;
    hydrated.current = true;
    setDisplayName(me.displayName);
    setMode(me.autoAccept);
  }, [me]);

  if (!me) {
    return (
      <div className="flex items-center gap-2 text-sm text-white/50">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading
      </div>
    );
  }

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    setSavingName(true);
    setNameMsg("");
    try {
      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName }),
      });
      const data = await res.json();
      setNameMsg(res.ok ? "Saved" : data.error ?? "Could not save");
      if (res.ok) {
        await refresh();
      }
    } finally {
      setSavingName(false);
      setTimeout(() => setNameMsg(""), 2500);
    }
  }

  async function changeMode(next: "none" | "favs" | "all") {
    setMode(next);
    setSavingMode(true);
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ autoAccept: next }),
    });
    setSavingMode(false);
    refresh();
  }

  const favorites = (state?.people ?? []).filter((p) => p.favorite);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-white/45 mt-0.5">Your account and receiving rules</p>
      </div>

      {/* Profile */}
      <section className="rounded-2xl border border-nexus-border bg-nexus-card overflow-hidden">
        <h2 className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-white/40 border-b border-nexus-border">
          Profile
        </h2>
        <form onSubmit={saveName} className="p-4 space-y-4">
          <div>
            <label className="block text-xs text-white/50 mb-1.5">Display name</label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={60}
              className="w-full bg-black/40 border border-nexus-border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-nexus-green"
            />
            <p className="text-[11px] text-white/30 mt-1">
              This is the name other people see when they send to you.
            </p>
          </div>

          <div>
            <label className="block text-xs text-white/50 mb-1.5">Username</label>
            <input
              value={me.username}
              readOnly
              className="w-full bg-black/20 border border-nexus-border rounded-xl px-3.5 py-2.5 text-sm text-white/50 outline-none cursor-not-allowed"
            />
            <p className="text-[11px] text-white/30 mt-1">
              Private. Only the administrator can change your username and password.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={savingName || displayName.trim() === me.displayName}
              className="bg-nexus-green text-black text-sm font-semibold px-4 py-2 rounded-lg hover:bg-[#009648] disabled:opacity-30"
            >
              {savingName ? "Saving" : "Save"}
            </button>
            {nameMsg && <span className="text-xs text-nexus-green">{nameMsg}</span>}
          </div>
        </form>
      </section>

      {/* Receiving */}
      <section className="rounded-2xl border border-nexus-border bg-nexus-card overflow-hidden">
        <h2 className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-white/40 border-b border-nexus-border flex items-center gap-2">
          Receiving
          {savingMode && <Loader2 className="w-3 h-3 animate-spin" />}
        </h2>
        <div className="p-2">
          {[
            {
              value: "none" as const,
              title: "Ask me every time",
              desc: "Accepted manually. This is the default.",
            },
            {
              value: "favs" as const,
              title: "Auto-accept favorites",
              desc: "People you starred are accepted the moment they send.",
            },
            {
              value: "all" as const,
              title: "Auto-accept everyone",
              desc: "Every incoming transfer is accepted without asking.",
            },
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => changeMode(option.value)}
              className={cn(
                "w-full flex items-start gap-3 p-3 rounded-xl text-left transition-colors",
                mode === option.value ? "bg-nexus-green/10" : "hover:bg-white/5"
              )}
            >
              <span
                className={cn(
                  "mt-0.5 w-4 h-4 rounded-full border-2 grid place-items-center shrink-0",
                  mode === option.value ? "border-nexus-green" : "border-white/25"
                )}
              >
                {mode === option.value && (
                  <span className="w-2 h-2 rounded-full bg-nexus-green" />
                )}
              </span>
              <span>
                <span className="block text-sm font-medium">{option.title}</span>
                <span className="block text-[11px] text-white/40 mt-0.5">
                  {option.desc}
                </span>
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Favorites */}
      <section className="rounded-2xl border border-nexus-border bg-nexus-card overflow-hidden">
        <h2 className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-white/40 border-b border-nexus-border">
          Favorites
        </h2>
        <div className="p-2">
          {(state?.people ?? []).length === 0 && (
            <p className="text-sm text-white/40 p-3">No other accounts yet.</p>
          )}
          {(state?.people ?? []).map((person) => (
            <div
              key={person.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5"
            >
              <span
                className={cn(
                  "w-2 h-2 rounded-full shrink-0",
                  person.online ? "bg-nexus-green" : "bg-white/20"
                )}
              />
              <span className="text-sm flex-1 truncate">{person.displayName}</span>
              <button
                onClick={() =>
                  fetch("/api/favorites", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      userId: person.id,
                      favorite: !person.favorite,
                    }),
                  }).then(refresh)
                }
                aria-label={person.favorite ? "Unstar" : "Star"}
                className="p-1.5 rounded-lg hover:bg-white/10"
              >
                <Star
                  className={cn(
                    "w-4 h-4",
                    person.favorite
                      ? "text-nexus-green fill-nexus-green"
                      : "text-white/30"
                  )}
                />
              </button>
            </div>
          ))}
        </div>
        {favorites.length > 0 && (
          <p className="px-4 pb-3 text-[11px] text-white/30">
            {favorites.length} favorite{favorites.length > 1 ? "s" : ""}
          </p>
        )}
      </section>

      {/* Appearance / language */}
      <section className="rounded-2xl border border-nexus-border bg-nexus-card overflow-hidden">
        <h2 className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-white/40 border-b border-nexus-border">
          Appearance
        </h2>
        <div className="p-2">
          <div className="flex items-center gap-3 px-3 py-2.5">
            <Moon className="w-4 h-4 text-nexus-green" />
            <span className="text-sm flex-1">Dark</span>
            <Check className="w-4 h-4 text-nexus-green" />
          </div>
          <div className="flex items-center gap-3 px-3 py-2.5 opacity-60">
            <Languages className="w-4 h-4" />
            <span className="text-sm flex-1">English</span>
            <span className="text-[11px] text-white/35">Only language</span>
          </div>
        </div>
      </section>

      {/* About */}
      <section className="rounded-2xl border border-nexus-border bg-nexus-card overflow-hidden">
        <h2 className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-white/40 border-b border-nexus-border">
          About
        </h2>
        <div className="p-4 space-y-2 text-xs text-white/45">
          <p className="flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-nexus-green" />
            Signed in for 30 days on this device
          </p>
          <p>Files are removed from storage 1 hour after sending.</p>
          <p>History is kept until you remove it. The administrator can see it too.</p>
          <p className="pt-2 text-white/25">NexSend · {me.role === "admin" ? "Administrator" : "Member"}</p>
        </div>
      </section>

      <form action="/api/auth/logout" method="POST">
        <button className="w-full rounded-xl border border-nexus-border py-3 text-sm text-red-400 hover:bg-red-500/10">
          Sign out
        </button>
      </form>
    </div>
  );
}
