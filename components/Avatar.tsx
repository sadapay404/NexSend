"use client";

import { cn } from "@/lib/utils";

type Props = {
  name: string;
  userId?: string;
  updatedAt?: string | null;
  size?: number;
  className?: string;
  textClassName?: string;
};

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "?"
  );
}

export default function Avatar({
  name,
  userId,
  updatedAt,
  size = 36,
  className,
  textClassName,
}: Props) {
  const src =
    userId && updatedAt
      ? `/api/avatar/${userId}?v=${encodeURIComponent(updatedAt)}`
      : null;

  return (
    <span
      style={{ width: size, height: size }}
      className={cn(
        "relative shrink-0 rounded-full overflow-hidden grid place-items-center bg-white/10 font-bold select-none",
        className
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={name}
          className="w-full h-full object-cover"
          loading="lazy"
          draggable={false}
        />
      ) : (
        <span
          className={cn("text-white", textClassName)}
          style={{ fontSize: Math.max(10, Math.round(size * 0.34)) }}
        >
          {initials(name)}
        </span>
      )}
    </span>
  );
}
