"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Send, Inbox, History, Settings, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useApp } from "./AppStateProvider";

type Props = {
  user: { displayName: string; username: string; role: string };
};

export default function Topbar({ user }: Props) {
  const pathname = usePathname();
  const { state } = useApp();
  const pending = state?.pendingCount ?? 0;

  const items = [
    { href: "/", label: "Send", icon: Send },
    { href: "/incoming", label: "Incoming", icon: Inbox },
    { href: "/history", label: "History", icon: History },
    { href: "/settings", label: "Settings", icon: Settings },
  ];
  if (user.role === "admin") {
    items.push({ href: "/admin/users", label: "Users", icon: Users });
  }

  return (
    <header className="md:hidden border-b border-nexus-border bg-nexus-dark sticky top-0 z-10">
      <div className="flex items-center gap-3 px-4 py-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.jpg"
          alt="NexSend"
          className="w-8 h-8 rounded-md object-cover"
        />
        <span className="font-bold">NexSend</span>
        <span className="text-xs text-white/50 ml-auto">{user.displayName}</span>
      </div>
      <nav className="flex gap-1 px-3 pb-3 overflow-x-auto">
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg text-sm whitespace-nowrap",
                active
                  ? "bg-nexus-green text-black font-medium"
                  : "text-white/70 hover:bg-white/5"
              )}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
              {item.href === "/incoming" && pending > 0 && (
                <span className="text-[10px] font-bold bg-nexus-green text-black rounded-full min-w-4 h-4 px-1 grid place-items-center">
                  {pending}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
