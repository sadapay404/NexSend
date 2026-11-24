"use client";

import { useEffect, useState } from "react";
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  KeyRound,
  X,
  ShieldCheck,
} from "lucide-react";
import { cn, formatTime } from "@/lib/utils";
import AdminTabs from "@/components/AdminTabs";

type AdminUser = {
  id: string;
  username: string;
  display_name: string;
  role: "admin" | "user";
  created_at: string;
  last_seen: string | null;
  sent_count: string;
  received_count: string;
};

type Form = {
  id?: string;
  username: string;
  displayName: string;
  password: string;
};

const empty: Form = { username: "", displayName: "", password: "" };

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/admin/users", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      setUsers(data.users);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    setError("");
    try {
      const editing = Boolean(form.id);
      const payload: Record<string, string> = {
        username: form.username,
        displayName: form.displayName,
      };
      if (form.password) payload.password = form.password;

      const res = await fetch(
        editing ? `/api/admin/users/${form.id}` : "/api/admin/users",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            editing ? payload : { ...payload, password: form.password }
          ),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not save");
        return;
      }
      setForm(null);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setError(data.error ?? "Could not delete");
    setConfirmDelete(null);
    setBusy(false);
    await load();
  }

  const online = (u: AdminUser) =>
    u.last_seen && Date.now() - new Date(u.last_seen).getTime() < 75_000;

  return (
    <div className="space-y-5">
      <AdminTabs />

      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">People</h1>
          <p className="text-xs md:text-sm text-white/45 mt-0.5">
            {users.length} account{users.length === 1 ? "" : "s"}
          </p>
        </div>
        <button
          onClick={() => {
            setForm(empty);
            setError("");
          }}
          className="inline-flex items-center gap-2 bg-nexus-green text-black text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-[#009648] active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4" />
          Add user
        </button>
      </div>

      {error && !form && (
        <p className="text-sm text-red-400 bg-red-500/10 rounded-xl px-3 py-2">{error}</p>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-white/50">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading
        </div>
      ) : (
        <div className="rounded-2xl border border-nexus-border bg-nexus-card overflow-hidden divide-y divide-nexus-border">
          {users.map((u) => (
            <div key={u.id} className="p-3.5 flex items-center gap-3 hover:bg-white/[0.03] transition-colors">
              <span className="relative shrink-0">
                <span
                  className={cn(
                    "w-9 h-9 rounded-full grid place-items-center text-xs font-bold",
                    u.role === "admin"
                      ? "bg-nexus-green text-black"
                      : "bg-white/10 text-white"
                  )}
                >
                  {u.display_name.slice(0, 2).toUpperCase()}
                </span>
                <span
                  className={cn(
                    "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-nexus-card",
                    online(u) ? "bg-nexus-green" : "bg-white/25"
                  )}
                />
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate flex items-center gap-1.5">
                  {u.display_name}
                  {u.role === "admin" && (
                    <ShieldCheck className="w-3.5 h-3.5 text-nexus-green" />
                  )}
                </p>
                <p className="text-[11px] text-white/35 truncate">
                  @{u.username} · {online(u) ? "online" : u.last_seen ? `seen ${formatTime(u.last_seen)}` : "never signed in"}
                </p>
              </div>

              <div className="hidden sm:flex flex-col items-end text-[11px] text-white/30 w-24">
                <span>{u.sent_count} sent</span>
                <span>{u.received_count} received</span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    setForm({
                      id: u.id,
                      username: u.username,
                      displayName: u.display_name,
                      password: "",
                    });
                    setError("");
                  }}
                  aria-label="Edit"
                  className="p-2 rounded-lg hover:bg-white/10 text-white/50 hover:text-white"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                {u.role !== "admin" && (
                  <button
                    onClick={() => setConfirmDelete(u.id)}
                    aria-label="Delete"
                    className="p-2 rounded-lg hover:bg-red-500/10 text-white/50 hover:text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / edit dialog */}
      {form && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <form
            onSubmit={save}
            className="w-full max-w-sm rounded-2xl border border-nexus-border bg-nexus-card p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">
                {form.id ? "Edit user" : "Add user"}
              </h2>
              <button
                type="button"
                onClick={() => setForm(null)}
                className="p-1 text-white/40 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs text-white/50 mb-1">Display name</label>
              <input
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                required
                maxLength={60}
                className="w-full bg-black/40 border border-nexus-border rounded-lg px-3 py-2 text-sm outline-none focus:border-nexus-green"
              />
            </div>

            <div>
              <label className="block text-xs text-white/50 mb-1">Username</label>
              <input
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                required
                autoCapitalize="none"
                spellCheck={false}
                className="w-full bg-black/40 border border-nexus-border rounded-lg px-3 py-2 text-sm outline-none focus:border-nexus-green"
              />
            </div>

            <div>
              <label className="block text-xs text-white/50 mb-1">
                {form.id ? "New password (leave empty to keep)" : "Password"}
              </label>
              <div className="relative">
                <KeyRound className="w-3.5 h-3.5 text-white/25 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required={!form.id}
                  className="w-full bg-black/40 border border-nexus-border rounded-lg pl-9 pr-3 py-2 text-sm outline-none focus:border-nexus-green"
                />
              </div>
            </div>

            {error && <p className="text-xs text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={busy}
              className="w-full bg-nexus-green text-black text-sm font-semibold py-2.5 rounded-lg hover:bg-[#009648] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              {form.id ? "Save changes" : "Create user"}
            </button>
          </form>
        </div>
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl border border-nexus-border bg-nexus-card p-4">
            <h2 className="text-sm font-semibold">Delete this account?</h2>
            <p className="text-xs text-white/40 mt-1">
              Their transfers disappear from everyone&apos;s lists.
            </p>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 border border-nexus-border rounded-lg py-2 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => remove(confirmDelete)}
                disabled={busy}
                className="flex-1 bg-red-500/90 text-black font-semibold rounded-lg py-2 text-sm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
