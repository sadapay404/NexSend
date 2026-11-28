"use client";

import { useEffect, useState } from "react";
import { Loader2, Monitor, Smartphone, Tablet } from "lucide-react";
import { cn } from "@/lib/utils";

type Device = {
  id: string;
  label: string;
  browser: string | null;
  os: string | null;
  kind: "phone" | "tablet" | "desktop";
  firstSeen: string;
  lastSeen: string;
  current: boolean;
};

function ago(iso: string) {
  const mins = Math.max(
    0,
    Math.round((Date.now() - new Date(iso).getTime()) / 60000),
  );
  if (mins < 2) return "Active now";
  if (mins < 60) return `${mins} minutes ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.round(days / 30);
  return `${months} ${months === 1 ? "month" : "months"} ago`;
}

export default function DevicesCard() {
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/devices", { cache: "no-store" })
        .then(async (r) => {
          if (!r.ok) throw new Error("Could not load devices");
          return r.json();
        })
        .then((d) => {
          if (!alive) return;
          const list: Device[] = [...(d.devices ?? [])].sort((a, b) => {
            if (a.current !== b.current) return a.current ? -1 : 1;
            return (
              new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime()
            );
          });
          setDevices(list);
        })
        .catch(() => alive && setError("Could not load devices"));

    load();
    const timer = setInterval(load, 45000);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

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
          {devices.map((device) => {
            const Icon =
              device.kind === "phone"
                ? Smartphone
                : device.kind === "tablet"
                  ? Tablet
                  : Monitor;
            return (
              <div
                key={device.id}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors",
                  device.current ? "bg-nexus-green/[0.06]" : "hover:bg-white/5",
                )}
              >
                <span
                  className={cn(
                    "grid h-9 w-9 shrink-0 place-items-center rounded-xl border",
                    device.current
                      ? "border-nexus-green/40 bg-nexus-green/10 text-nexus-green"
                      : "border-nexus-border bg-black/40 text-white/40",
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <span className="truncate">{device.label}</span>
                    {device.current && (
                      <span className="shrink-0 rounded-md bg-nexus-green/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-nexus-green">
                        Current Device
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-[11px] text-white/35 truncate">
                    {device.current
                      ? "Signed in on this device"
                      : ago(device.lastSeen)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
