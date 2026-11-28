"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { deviceKey } from "@/lib/device-client";

export default function LoginPage() {
  const params = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          password,
          deviceKey: deviceKey() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not sign in");
        setLoading(false);
        return;
      }
      const next = params.get("next");
      const target = next && next !== "/login" ? next : "/";
      // Full navigation on purpose: it guarantees the cookie is sent with the
      // very first request for the app shell, so the state provider starts
      // from a signed-in page instead of a half-loaded one.
      window.location.replace(target);
    } catch {
      setError("Network error. Try again.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5">
      <div className="w-full max-w-sm animate-fade-up">
        <div className="flex flex-col items-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.jpg"
            alt="Digital Sheikh Nexus"
            className="w-20 h-20 rounded-2xl object-cover mb-5 animate-float tilt"
          />
          <h1 className="text-2xl font-bold tracking-tight">NexSend</h1>
          <p className="text-sm text-white/50 mt-1">
            Digital Sheikh Nexus Training Institute
          </p>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-white/60 mb-1.5">
              Username
            </label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              className="w-full bg-nexus-card border border-nexus-border rounded-xl px-4 py-3.5 text-sm outline-none focus:border-nexus-green focus:shadow-[0_0_0_3px_rgba(0,166,81,0.15)] transition-all"
              placeholder="Your username"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-white/60 mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                type={show ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="w-full bg-nexus-card border border-nexus-border rounded-xl px-4 py-3.5 pr-11 text-sm outline-none focus:border-nexus-green focus:shadow-[0_0_0_3px_rgba(0,166,81,0.15)] transition-all"
                placeholder="Your password"
              />
              <button
                type="button"
                onClick={() => setShow(!show)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                tabIndex={-1}
                aria-label={show ? "Hide password" : "Show password"}
              >
                {show ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {error && (
            <p className="animate-pop text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !username || !password}
            className="w-full bg-nexus-green text-black font-semibold rounded-xl py-3.5 text-sm hover:bg-[#009648] hover:shadow-[0_12px_34px_-12px_rgba(0,166,81,0.9)] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none transition-all flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Sign in
          </button>
        </form>

        <p className="text-center text-xs text-white/30 mt-8">
          Accounts are created by the administrator.
        </p>
      </div>
    </div>
  );
}
