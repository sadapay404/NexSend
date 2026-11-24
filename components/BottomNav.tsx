"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Send, Inbox, History, Settings, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useApp } from "./AppStateProvider";

type Props = {
  role: string;
};

export default function BottomNav({ role }: Props) {
  const pathname = usePathname();
  const { state } = useApp();
  const pending = state?.pendingCount ?? 0;

  const items = [
    { href: "/", label: "Send", icon: Send },
    { href: "/receive", label: "Receive", icon: Inbox },
    { href: "/history", label: "History", icon: History },
    ...(role === "admin"
      ? [{ href: "/admin/users", label: "Users", icon: Users }]
      : []),
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-nexus-border bg-black/90 backdrop-blur-xl pb-safe">
      <div className="flex items-stretch">
        {items.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="relative flex-1 flex flex-col items-center gap-1 pt-2.5 pb-2 press"
            >
              <span className="relative">
                <item.icon
                  className={cn(
                    "w-[22px] h-[22px] transition-transform duration-200",
                    active ? "text-nexus-green scale-110" : "text-white/45"
                  )}
                  strokeWidth={active ? 2.4 : 2}
                />
                {item.href === "/receive" && pending > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-nexus-green text-black text-[10px] font-bold grid place-items-center">
                    {pending}
                  </span>
                )}
              </span>
              <span
                className={cn(
                  "text-[10px] tracking-wide transition-colors",
                  active ? "text-nexus-green font-semibold" : "text-white/40"
                )}
              >
                {item.label}
              </span>
              <span
                className={cn(
                  "absolute top-0 h-[2px] rounded-full bg-nexus-green transition-all duration-300",
                  active ? "w-8 opacity-100" : "w-0 opacity-0"
                )}
              />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
