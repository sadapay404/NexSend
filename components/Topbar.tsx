"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = {
  user: { displayName: string; username: string; role: string };
};

const TITLES: Record<string, string> = {
  "/": "Send",
  "/receive": "Receive",
  "/history": "History",
  "/settings": "Settings",
  "/admin/users": "Users",
  "/admin/history": "Activity",
};

export default function Topbar({ user }: Props) {
  const pathname = usePathname();
  const title = TITLES[pathname] ?? "NexSend";
  const initials = user.displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  return (
    <header className="md:hidden sticky top-0 z-30 bg-black/85 backdrop-blur-xl border-b border-nexus-border">
      <div className="flex items-center gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2.5 press">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.jpg"
            alt="NexSend"
            className="w-9 h-9 rounded-xl object-cover tilt"
          />
          <span className="leading-tight">
            <span className="block text-sm font-bold tracking-tight">NexSend</span>
            <span className="block text-[10px] text-white/35 leading-tight">
              Digital Sheikh Nexus
            </span>
          </span>
        </Link>

        <span className="ml-auto text-xs font-medium text-white/50">{title}</span>

        <Link
          href="/settings"
          aria-label="Settings"
          className="ml-1 w-9 h-9 rounded-full bg-white/10 grid place-items-center text-[11px] font-bold press"
        >
          {initials || "?"}
        </Link>
      </div>
    </header>
  );
}
