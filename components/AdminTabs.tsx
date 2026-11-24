"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export default function AdminTabs() {
  const pathname = usePathname();
  const tabs = [
    { href: "/admin/users", label: "People" },
    { href: "/admin/history", label: "Activity" },
  ];

  return (
    <div className="flex bg-nexus-card border border-nexus-border rounded-xl p-1 w-fit">
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "text-xs px-4 py-2 rounded-lg transition-colors press",
              active ? "bg-nexus-green text-black font-semibold" : "text-white/50 hover:text-white"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
