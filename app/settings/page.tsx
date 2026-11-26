"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Star, Moon, Languages, Camera } from "lucide-react";
import { useApp } from "@/components/AppStateProvider";
import Avatar from "@/components/Avatar";
import StoragePill from "@/components/StoragePill";
import { fileToAvatarDataUrl } from "@/lib/image";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const { state, refresh, patchMe, patchPerson } = useApp();
  const avatarInput = useRef<HTMLInputElement>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
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
        patchMe({ displayName });
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
      <div className="hidden md:block">
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
      </div>

      {/* Storage */}
      <section className="lift rounded-2xl border border-nexus-border bg-nexus-card overflow-hidden">
        <h2 className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-white/40 border-b border-nexus-border">
          Storage
        </h2>
        <div className="p-4">
          <StoragePill storage={state?.storage} />
        </div>
      </section>

      {/* Profile */}
      <section className="lift rounded-2xl border border-nexus-border bg-nexus-card overflow-hidden">
        <h2 className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-white/40 border-b border-nexus-border">
          Profile
        </h2>
        <form onSubmit={saveName} className="p-4 space-y-4">
          <div className="flex items-center gap-4">
            <Avatar
              name={me.displayName}
              userId={me.id}
              updatedAt={me.avatarUpdatedAt}
              size={64}
              className="ring-2 ring-white/10"
              textClassName="text-lg"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => avatarInput.current?.click()}
                  disabled={avatarBusy}
                  className="text-xs bg-white/10 hover:bg-white/15 active:scale-95 transition-all px-3 py-2 rounded-lg inline-flex items-center gap-1.5 disabled:opacity-50"
                >
                  {avatarBusy ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Camera className="w-3.5 h-3.5" />
                  )}
                  {me.avatarUpdatedAt ? "Change photo" : "Add photo"}
                </button>
                {me.avatarUpdatedAt && (
                  <button
                    type="button"
                    onClick={async () => {
                      setAvatarBusy(true);
                      await fetch("/api/me/avatar", { method: "DELETE" });
                      patchMe({ avatarUpdatedAt: null });
                      setAvatarBusy(false);
                      refresh();
                    }}
                    className="text-xs text-white/40 hover:text-red-400 transition-colors px-2 py-2"
                  >
                    Remove
                  </button>
                )}
              </div>
              <p className="text-[11px] text-white/30 mt-1.5">
                Only you can change this.
              </p>
            </div>
            <input
              ref={avatarInput}
              type="file"
              accept="image/*"
              hidden
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                setAvatarBusy(true);
                try {
                  const dataUrl = await fileToAvatarDataUrl(file);
                  const res = await fetch("/api/me/avatar", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ image: dataUrl }),
                  });
                  const data = await res.json().catch(() => ({}));
                  if (res.ok) {
                    patchMe({ avatarUpdatedAt: data.avatarUpdatedAt });
                    refresh();
                  } else {
                    setNameMsg(data.error ?? "Could not save photo");
                  }
                } catch (err) {
                  setNameMsg((err as Error).message);
                } finally {
                  setAvatarBusy(false);
                }
              }}
            />
          </div>

          <div>
            <label className="block text-xs text-white/50 mb-1.5">Display name</label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={60}
              className="w-full bg-black/40 border border-nexus-border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-nexus-green"
            />
            <p className="text-[11px] text-white/30 mt-1">
              The name others see when they send to you
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
              Private. Only the administrator can change this and your password.
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
      <section className="lift rounded-2xl border border-nexus-border bg-nexus-card overflow-hidden">
        <h2 className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-white/40 border-b border-nexus-border flex items-center gap-2">
          Receiving
          {savingMode && <Loader2 className="w-3 h-3 animate-spin" />}
        </h2>
        <div className="p-2">
          {[
            {
              value: "none" as const,
              title: "Ask me every time",
              desc: "Accept each transfer yourself",
            },
            {
              value: "favs" as const,
              title: "Auto-accept favorites",
              desc: "Favorites are accepted instantly",
            },
            {
              value: "all" as const,
              title: "Auto-accept everyone",
              desc: "Everything is accepted instantly",
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
      <section className="lift rounded-2xl border border-nexus-border bg-nexus-card overflow-hidden">
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
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors"
            >
              <Avatar
                name={person.displayName}
                userId={person.id}
                updatedAt={person.avatarUpdatedAt}
                size={28}
              />
              <span className="text-sm flex-1 truncate">{person.displayName}</span>
              <button
                onClick={() => {
                  const next = !person.favorite;
                  patchPerson(person.id, { favorite: next });
                  fetch("/api/favorites", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ userId: person.id, favorite: next }),
                  }).then(() => refresh());
                }}
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
      <section className="lift rounded-2xl border border-nexus-border bg-nexus-card overflow-hidden">
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

      {/* Credits */}
      <section className="lift rounded-2xl border border-nexus-border bg-nexus-card overflow-hidden">
        <h2 className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-white/40 border-b border-nexus-border">
          About
        </h2>
        <div className="p-4 space-y-3 text-sm">
          {[
            ["Created by", "Mubashir"],
            ["Co-creator", "Sir Sheikh Arsalan"],
            ["Created for", "Digital Sheikh Nexus"],
            ["Copyright", "© 2026 Digital Sheikh Nexus"],
          ].map(([label, value]) => (
            <div key={label} className="flex items-baseline justify-between gap-4">
              <span className="text-xs text-white/35">{label}</span>
              <span className="text-sm text-right">{value}</span>
            </div>
          ))}
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
