"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  Globe,
  Loader2,
  LogOut,
  Monitor,
  Smartphone,
  Tablet,
  X,
} from "lucide-react";
import { cn, formatTime } from "@/lib/utils";
import { deviceKey } from "@/lib/device-client";

type Device = {
  id: string;
  name: string;
  label: string;
  model: string | null;
  browser: string | null;
  os: string | null;
  kind: "phone" | "tablet" | "desktop";
  ip: string | null;
  meta: {
    platform?: string;
    platformVersion?: string;
    screen?: string;
    memory?: number;
    threads?: number;
    timezone?: string;
    language?: string;
  };
  firstSeen: string;
  lastSeen: string;
  signedOutAt: string | null;
  online: boolean;
  current: boolean;
};

function ago(iso: string) {
  const mins = Math.max(
    0,
    Math.round((Date.now() - new Date(iso).getTime()) / 60000),
  );
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} ${mins === 1 ? "minute" : "minutes"} ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.round(days / 30);
  return `${months} ${months === 1 ? "month" : "months"} ago`;
}

/** What the row says under the name. */
function statusLine(device: Device) {
  if (device.current)
    return device.signedOutAt ? "Signed out" : "Signed in on this device";
  if (device.signedOutAt) return `Signed out ${ago(device.signedOutAt)}`;
  if (device.online) return "Active now";
  return ago(device.lastSeen);
}

function DeviceIcon({
  kind,
  className,
}: {
  kind: Device["kind"];
  className?: string;
}) {
  const Icon =
    kind === "phone" ? Smartphone : kind === "tablet" ? Tablet : Monitor;
  return <Icon className={className} />;
}

export default function DevicesCard() {
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<Device | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () =>
    fetch(`/api/devices?key=${encodeURIComponent(deviceKey())}`, {
      cache: "no-store",
    })
      .then(async (r) => {
        if (!r.ok) throw new Error("Could not load devices");
        return r.json();
      })
      .then((d) => {
        const list: Device[] = [...(d.devices ?? [])].sort((a, b) => {
          if (a.current !== b.current) return a.current ? -1 : 1;
          if (Boolean(a.signedOutAt) !== Boolean(b.signedOutAt))
            return a.signedOutAt ? 1 : -1;
          return (
            new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime()
          );
        });
        setDevices(list);
        setOpen((prev) =>
          prev ? (list.find((d2) => d2.id === prev.id) ?? null) : null,
        );
      })
      .catch(() => setError("Could not load devices"));

  useEffect(() => {
    let alive = true;
    const tick = () => alive && load();
    tick();
    const timer = setInterval(tick, 45000);
    const onFocus = () => tick();
    window.addEventListener("focus", onFocus);
    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  async function signOut(device: Device) {
    setBusy(true);
    try {
      await fetch(`/api/devices/${device.id}`, { method: "DELETE" });
      if (device.current) {
        await fetch("/api/auth/logout", { method: "POST" }).catch(
          () => undefined,
        );
        window.location.href = "/login";
        return;
      }
      await load();
      setOpen(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="lift rounded-2xl border border-nexus-border bg-nexus-card overflow-hidden">
      <h2 className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-white/40 border-b border-nexus-border">
        Devices
      </h2>

      {error && <p className="p-4 text-sm text-red-400">{error}</p>}

      {!devices && !error && (
        <div className="flex items-center gap-2 p-4 text-sm text-white/50">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading
        </div>
      )}

      {devices && (
        <div className="p-2">
          {devices.length === 0 && (
            <p className="p-3 text-sm text-white/40">No devices yet.</p>
          )}
          {devices.map((device) => (
            <button
              key={device.id}
              onClick={() => setOpen(device)}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all active:scale-[0.99]",
                device.current
                  ? "bg-nexus-green/[0.06] hover:bg-nexus-green/[0.1]"
                  : "hover:bg-white/5",
              )}
            >
              <span
                className={cn(
                  "relative grid h-9 w-9 shrink-0 place-items-center rounded-xl border",
                  device.current
                    ? "border-nexus-green/40 bg-nexus-green/10 text-nexus-green"
                    : "border-nexus-border bg-black/40 text-white/40",
                )}
              >
                <DeviceIcon kind={device.kind} className="h-4 w-4" />
                {device.online && (
                  <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-nexus-green ring-2 ring-nexus-card" />
                )}
              </span>

              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <span className="truncate">{device.name}</span>
                  {device.current && (
                    <span className="shrink-0 rounded-md bg-nexus-green/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-nexus-green">
                      Current Device
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block truncate text-[11px] text-white/35">
                  {statusLine(device)}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm animate-fade-up sm:items-center sm:p-6"
            onClick={() => setOpen(null)}
            role="dialog"
            aria-modal="true"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md overflow-hidden rounded-t-2xl border border-nexus-border bg-nexus-card shadow-2xl sm:rounded-2xl"
            >
              <div className="flex items-start gap-3 border-b border-nexus-border px-4 py-3">
                <span
                  className={cn(
                    "mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl border",
                    open.current
                      ? "border-nexus-green/40 bg-nexus-green/10 text-nexus-green"
                      : "border-nexus-border bg-black/40 text-white/40",
                  )}
                >
                  <DeviceIcon kind={open.kind} className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{open.name}</p>
                  <p className="mt-0.5 text-[11px] text-white/35">
                    {open.current ? "This device, right now" : statusLine(open)}
                  </p>
                </div>
                <button
                  onClick={() => setOpen(null)}
                  aria-label="Close"
                  className="shrink-0 rounded-lg p-1.5 text-white/40 transition-all hover:bg-white/5 hover:text-white active:scale-90"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-1.5 px-4 py-3 text-[13px]">
                <Detail label="Browser" value={open.browser} />
                <Detail
                  label="System"
                  value={
                    open.os && open.meta.platformVersion
                      ? `${open.os} ${open.meta.platformVersion}`
                      : open.os
                  }
                />
                <Detail label="Screen" value={open.meta.screen} />
                <Detail
                  label="Memory"
                  value={open.meta.memory ? `${open.meta.memory} GB` : null}
                />
                <Detail
                  label="CPU threads"
                  value={open.meta.threads ? String(open.meta.threads) : null}
                />
                <Detail label="Time zone" value={open.meta.timezone} />
                <Detail label="Language" value={open.meta.language} />
                <Detail label="IP address" value={open.ip} mono />
                <Detail label="First seen" value={formatTime(open.firstSeen)} />
                <Detail
                  label="Last active"
                  value={
                    open.online && !open.current
                      ? "Active now"
                      : formatTime(open.lastSeen)
                  }
                />
              </div>

              <div className="flex items-center gap-2 border-t border-nexus-border px-4 py-3">
                {open.signedOutAt && !open.current ? (
                  <span className="inline-flex items-center gap-2 text-xs text-white/40">
                    <LogOut className="h-3.5 w-3.5" />
                    Signed out {ago(open.signedOutAt)}
                  </span>
                ) : (
                  <button
                    onClick={() => signOut(open)}
                    disabled={busy}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold transition-all active:scale-95 disabled:opacity-50",
                      open.current
                        ? "border border-nexus-border text-white/80 hover:border-white/30 hover:text-white"
                        : "bg-red-500/15 text-red-400 hover:bg-red-500/25",
                    )}
                  >
                    {busy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <LogOut className="h-4 w-4" />
                    )}
                    {open.current ? "Sign out" : "Sign out this device"}
                  </button>
                )}
                <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-white/25">
                  <Globe className="h-3 w-3" />
                  {open.meta.platform ?? "Web"}
                </span>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </section>
  );
}

function Detail({
  label,
  value,
  mono,
}: {
  label: string;
  value?: string | null;
  mono?: boolean;
}) {
  if (!value) return null;
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="shrink-0 text-[11px] uppercase tracking-wider text-white/25">
        {label}
      </span>
      <span
        className={cn("text-right text-white/70", mono && "font-mono text-xs")}
      >
        {value}
      </span>
    </div>
  );
}
