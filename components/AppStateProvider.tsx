"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { AppState } from "@/lib/types";

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
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const res = await fetch("/api/state", { cache: "no-store" });
      if (res.ok) setState((await res.json()) as AppState);
    } catch {
      /* offline - keep last state */
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, []);

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
    <AppContext.Provider
      value={{ state, loading, refresh: load, reload: load }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
