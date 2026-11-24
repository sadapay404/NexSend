"use client";

import { useEffect, useState } from "react";

function remaining(expiresAt: string) {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return null;
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function Countdown({ expiresAt }: { expiresAt: string }) {
  const [label, setLabel] = useState(() => remaining(expiresAt));

  useEffect(() => {
    setLabel(remaining(expiresAt));
    const id = setInterval(() => setLabel(remaining(expiresAt)), 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  if (!label) return <span className="text-white/35">Expired</span>;
  return <span className="text-nexus-green">{label} left</span>;
}
