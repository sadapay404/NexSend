"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [key, setKey] = useState(pathname);

  useEffect(() => {
    setKey(pathname);
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname]);

  return (
    <div key={key} className="animate-fade-up">
      {children}
    </div>
  );
}
