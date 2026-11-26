"use client";

import { cn, formatBytes } from "@/lib/utils";
import type { StorageInfo } from "@/lib/types";

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

  const tone =
    percent >= 95
      ? "from-[#ff7a7a] to-[#e03131]"
      : percent >= 80
        ? "from-[#ffd166] to-[#e8a317]"
        : "from-[#00c862] to-[#00A651]";

  const label = percent >= 95 ? "Full" : percent >= 80 ? "Filling up" : "Healthy";

  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-xs text-white/70 tabular-nums">
          <span className="text-sm font-semibold text-white">
            {formatBytes(used)}
          </span>{" "}
          of {formatBytes(limit)}
        </span>
        <span
          className={cn(
            "text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border",
            percent >= 95
              ? "text-[#ff7a7a] border-[#ff7a7a]/40 bg-[#ff7a7a]/10"
              : percent >= 80
                ? "text-[#ffd166] border-[#ffd166]/40 bg-[#ffd166]/10"
                : "text-nexus-green border-nexus-green/40 bg-nexus-green/10"
          )}
        >
          {label}
        </span>
      </div>

      {/* Track + proportional fill, both outlined so the pill shape always reads. */}
      <div
        className="relative h-4 w-full rounded-full border border-white/15 bg-black/60 p-[3px] shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)] overflow-hidden"
        role="progressbar"
        aria-valuenow={Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Storage used"
        title={`${formatBytes(used)} of ${formatBytes(limit)} used`}
      >
        <div
          className={cn(
            "h-full rounded-full bg-gradient-to-r transition-[width] duration-700 ease-out",
            "shadow-[0_0_10px_-2px_rgba(0,166,81,0.55)]",
            tone
          )}
          style={{ width: `${percent > 0 ? Math.max(percent, 2) : 0}%` }}
        />
        {/* centre reading, sits above the fill */}
        <span className="absolute inset-0 grid place-items-center text-[9px] font-semibold tracking-wide text-white/70 tabular-nums">
          {percent.toFixed(0)}%
        </span>
      </div>
    </div>
  );
}
