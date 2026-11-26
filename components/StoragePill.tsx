"use client";

import { cn, formatBytes } from "@/lib/utils";
import type { StorageInfo } from "@/lib/types";

export default function StoragePill({
  storage,
  className,
  compact = false,
}: {
  storage: StorageInfo | undefined;
  className?: string;
  compact?: boolean;
}) {
  const used = storage?.used ?? 0;
  const limit = storage?.limit ?? 9 * 1024 * 1024 * 1024;
  const percent = storage?.percent ?? 0;

  const tone =
    percent >= 95
      ? "bg-[#ff5a5a]"
      : percent >= 80
        ? "bg-[#f0b429]"
        : "bg-nexus-green";

  return (
    <div className={cn("w-full", className)}>
      {!compact && (
        <div className="flex items-center justify-between mb-1.5 text-[11px]">
          <span className="text-white/40 uppercase tracking-wider font-semibold">
            Storage
          </span>
          <span className="text-white/60 tabular-nums">
            {formatBytes(used)} of {formatBytes(limit)}
          </span>
        </div>
      )}
      <div
        className="relative h-2.5 w-full rounded-full bg-white/8 overflow-hidden"
        role="progressbar"
        aria-valuenow={Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
        title={`${formatBytes(used)} of ${formatBytes(limit)} used`}
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-700 ease-out",
            tone
          )}
          style={{ width: `${Math.max(percent > 0 ? 1.5 : 0, percent)}%` }}
        >
          <div className="h-full w-full rounded-full opacity-60 bg-gradient-to-r from-transparent to-white/40" />
        </div>
      </div>
    </div>
  );
}
