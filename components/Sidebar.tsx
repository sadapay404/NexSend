"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Send, Inbox, History, Settings, Users, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useApp } from "./AppStateProvider";

type Props = {
  user: { displayName: string; username: string; role: string };
};

export default function Sidebar({ user }: Props) {
  const pathname = usePathname();
  const { state } = useApp();
  const pending = state?.pendingCount ?? 0;

  const items = [
    { href: "/", label: "Send", icon: Send },
    { href: "/receive", label: "Receive", icon: Inbox },
    { href: "/history", label: "History", icon: History },
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  if (user.role === "admin") {
    items.push({ href: "/admin/users", label: "Users", icon: Users });
  }

  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-nexus-border bg-nexus-dark">
      <div className="p-5 border-b border-nexus-border">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.jpg"
            alt="Digital Sheikh Nexus"
            className="w-10 h-10 rounded-xl object-cover tilt"
          />
          <div>
            <p className="font-bold leading-tight">NexSend</p>
            <p className="text-xs text-white/50 leading-tight">Digital Sheikh Nexus</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {items.map((item) => {
          const active =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium",
                "transition-all duration-200",
                active
                  ? "bg-nexus-green text-black shadow-[0_6px_20px_-8px_rgba(0,166,81,0.9)]"
                  : "text-white/70 hover:bg-white/5 hover:text-white hover:translate-x-0.5"
              )}
            >
              <item.icon
                className={cn(
                  "w-5 h-5 transition-transform duration-200",
                  !active && "group-hover:scale-110"
                )}
              />
              {item.label}
              {item.href === "/receive" && pending > 0 && (
                <span
                  className={cn(
                    "ml-auto text-[10px] font-bold rounded-full min-w-5 h-5 px-1.5 grid place-items-center",
                    active ? "bg-black text-nexus-green" : "bg-nexus-green text-black"
                  )}
                >
                  {pending}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-nexus-border">
        <div className="px-3 py-2">
          <p className="text-sm font-medium truncate">{user.displayName}</p>
          <p className="text-xs text-white/40 truncate">@{user.username}</p>
        </div>
        <form action="/api/auth/logout" method="POST">
          <button
            type="submit"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/70 hover:bg-white/5 hover:text-white w-full transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Logout
          </button>
        </form>
      </div>
    </aside>
  );
}
