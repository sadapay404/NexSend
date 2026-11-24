"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { ArrowDownLeft, ArrowUpRight, X } from "lucide-react";
import type { AppState } from "@/lib/types";

type Toast = { id: string; text: string; kind: "in" | "out" };

type Ctx = {
  state: AppState | null;
  loading: boolean;
  refresh: () => Promise<void>;
  reload: () => Promise<void>;
};

const AppContext = createContext<Ctx>({
  state: null,
  loading: true,
  refresh: async () => {},
  reload: async () => {},
});

const POLL_MS = 3000;

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState | null>(null);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const inFlight = useRef(false);
  const seenIncoming = useRef<Set<string>>(new Set());
  const deliveredSeen = useRef<Set<string>>(new Set());
  const firstLoad = useRef(true);

  const push = useCallback((text: string, kind: "in" | "out") => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev.slice(-2), { id, text, kind }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const res = await fetch("/api/state", { cache: "no-store" });
      if (!res.ok) return;
      const next = (await res.json()) as AppState;

      if (!firstLoad.current) {
        for (const t of next.incoming) {
          if (t.expired) continue;
          if (!seenIncoming.current.has(t.id) && t.myStatus !== "declined") {
            push(
              `${t.senderName} sent you ${
                t.fileName ? t.fileName : t.type === "clipboard" ? "clipboard text" : "text"
              }`,
              "in"
            );
          }
        }
        for (const t of next.sent) {
          for (const r of t.recipients) {
            const key = `${t.id}:${r.id}`;
            if (r.status === "downloaded" && !deliveredSeen.current.has(key)) {
              push(`${r.displayName} downloaded ${t.fileName ?? "your text"}`, "out");
            }
            if (r.status === "downloaded") deliveredSeen.current.add(key);
          }
        }
      }

      next.incoming
        .filter((t) => t.myStatus !== "declined")
        .forEach((t) => seenIncoming.current.add(t.id));
      next.sent.forEach((t) =>
        t.recipients.forEach((r) => {
          if (r.status === "downloaded") deliveredSeen.current.add(`${t.id}:${r.id}`);
        })
      );

      firstLoad.current = false;
      setState(next);
    } catch {
      /* offline - keep last state */
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, [push]);

  useEffect(() => {
    load();
    const tick = () => {
      if (document.visibilityState === "visible") load();
    };
    const id = setInterval(tick, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [load]);

  return (
    <AppContext.Provider value={{ state, loading, refresh: load, reload: load }}>
      {children}
      <div className="fixed z-50 bottom-4 right-4 left-4 sm:left-auto flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex items-center gap-2.5 rounded-xl border border-nexus-border bg-nexus-card/95 backdrop-blur px-3.5 py-3 shadow-xl shadow-black/50 max-w-sm ml-auto"
          >
            {t.kind === "in" ? (
              <ArrowDownLeft className="w-4 h-4 text-nexus-green shrink-0" />
            ) : (
              <ArrowUpRight className="w-4 h-4 text-nexus-green shrink-0" />
            )}
            <p className="text-xs text-white/85 flex-1">{t.text}</p>
            <button
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
              className="text-white/30 hover:text-white"
              aria-label="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
