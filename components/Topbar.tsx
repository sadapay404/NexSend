"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Avatar from "./Avatar";
import { useApp } from "./AppStateProvider";

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
  const { state } = useApp();
  const title = TITLES[pathname] ?? "NexSend";

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

        <Link href="/settings" aria-label="Settings" className="ml-1 press">
          <Avatar
            name={state?.me.displayName ?? user.displayName}
            userId={state?.me.id}
            updatedAt={state?.me.avatarUpdatedAt ?? null}
            size={36}
            className="ring-1 ring-white/15"
          />
        </Link>
      </div>
    </header>
  );
}
