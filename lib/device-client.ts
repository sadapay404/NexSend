"use client";

const FLAG = "nexsend:identified:v1";
const KEY = "nexsend:device-key:v1";

/**
 * A random, permanent id for this browser profile. It is the only thing that
 * can tell two identical Android phones apart — their user-agents and even
 * their model hints can be equal, so the user-agent cannot be the identity.
 */
export function deviceKey(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = localStorage.getItem(KEY);
    if (existing) return existing;
    const created = crypto.randomUUID();
    localStorage.setItem(KEY, created);
    return created;
  } catch {
    return "";
  }
}

/**
 * Browsers refuse to publish the hardware name in the user-agent (Apple never
 * does, Chrome only via Client Hints on Android), so the only place the model
 * can be read is right here in the page. Send it once per session.
 */
export async function identifyDevice() {
  if (typeof window === "undefined") return;
  try {
    if (sessionStorage.getItem(FLAG)) return;
    sessionStorage.setItem(FLAG, "1");
  } catch {
    /* storage blocked - still try once */
  }

  try {
    const uad = (navigator as any).userAgentData;
    let model = "";
    let platformVersion = "";
    if (uad?.getHighEntropyValues) {
      const high = await uad
        .getHighEntropyValues(["model", "platformVersion"])
        .catch(() => null);
      model = high?.model ?? "";
      platformVersion = high?.platformVersion ?? "";
    }

    await fetch("/api/devices/identify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceKey: deviceKey() || undefined,
        model: model || undefined,
        platform: uad?.platform || undefined,
        platformVersion: platformVersion || undefined,
        screen:
          typeof screen !== "undefined"
            ? `${screen.width}×${screen.height}`
            : undefined,
        memory: (navigator as any).deviceMemory ?? undefined,
        threads: navigator.hardwareConcurrency ?? undefined,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        language: navigator.language,
      }),
    });
  } catch {
    /* nothing here is worth interrupting anyone over */
  }
}
