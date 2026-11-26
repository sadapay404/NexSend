"use client";

import { useEffect, useRef, useState } from "react";
import { cn, formatBytes } from "@/lib/utils";
import type { StorageInfo } from "@/lib/types";

/** Smoothly counts to a new value instead of jumping. Honours reduced motion. */
function useTween(value: number, ms = 900) {
  const [display, setDisplay] = useState(0);
  const shown = useRef(0);

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      shown.current = value;
      setDisplay(value);
      return;
    }

    const from = shown.current;
    const t0 = performance.now();
    let raf = 0;

    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      const next = from + (value - from) * eased;
      shown.current = next;
      setDisplay(next);
      if (p < 1) raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);

  return display;
}

export default function StoragePill({
  storage,
  className,
}: {
  storage: StorageInfo | undefined;
  className?: string;
}) {
  const used = storage?.used ?? 0;
  const limit = storage?.limit ?? 9 * 1024 * 1024 * 1024;
  const percent = Math.min(100, storage?.percent ?? 0);

  const animated = useTween(used);
  const [amount, unit] = formatBytes(animated).split(" ");

  return (
    <div className={cn("w-full animate-fade-up", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="flex items-baseline gap-1.5 tabular-nums">
          <span className="text-3xl font-semibold tracking-tight leading-none">
            {amount}
          </span>
          <span className="text-sm font-medium text-white/45">{unit}</span>
        </p>
        <p className="text-xs text-white/30 tabular-nums">
          of {formatBytes(limit)}
        </p>
      </div>

      <div
        className="relative mt-4 h-2.5 w-full rounded-full bg-white/[0.06] overflow-hidden ring-1 ring-inset ring-white/[0.06]"
        role="progressbar"
        aria-valuenow={Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Storage used"
      >
        <div
          className={cn(
            "relative h-full rounded-full transition-[width,background] duration-700 ease-out",
            "bg-gradient-to-r shadow-[0_0_14px_rgba(0,166,81,0.45)]",
            percent >= 95
              ? "from-[#ff6b6b] to-[#e03131] shadow-[0_0_14px_rgba(224,49,49,0.5)]"
              : percent >= 80
                ? "from-[#f7c948] to-[#00a651] shadow-[0_0_14px_rgba(247,201,72,0.35)]"
                : "from-[#007a3d] via-[#00A651] to-[#22e07e]"
          )}
          style={{ width: `${percent > 0 ? Math.max(percent, 1.5) : 0}%` }}
        >
          {/* travelling sheen */}
          <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-full">
            <span className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/35 to-transparent animate-sheen" />
          </span>
          {/* bright head at the fill edge */}
          {percent > 1 && (
            <span className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 h-2.5 w-2.5 rounded-full bg-white/90 blur-[2px]" />
          )}
        </div>
      </div>
    </div>
  );
}
