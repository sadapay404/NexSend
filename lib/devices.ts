import { createHash } from "crypto";
import { query, queryOne } from "./db";

export type DeviceKind = "phone" | "tablet" | "desktop";

export type DeviceInfo = {
  fingerprint: string;
  label: string;
  browser: string;
  os: string;
  kind: DeviceKind;
};

export type DeviceRow = {
  id: string;
  label: string;
  browser: string | null;
  os: string | null;
  kind: DeviceKind;
  firstSeen: string;
  lastSeen: string;
  current: boolean;
};

/**
 * One row per browser-and-system pair, not one per user-agent string. Chrome
 * bumps its version every few weeks; treating that as a new device is exactly
 * the duplicate noise Google's device list is famous for, so the fingerprint
 * deliberately ignores version numbers.
 */
export function describeDevice(
  userAgent: string | null | undefined,
): DeviceInfo {
  const ua = userAgent ?? "";

  let os = "Unknown";
  if (/Android/i.test(ua)) os = "Android";
  else if (/iPhone|iPod/i.test(ua)) os = "iOS";
  else if (/iPad/i.test(ua)) os = "iPadOS";
  else if (/Windows NT/i.test(ua)) os = "Windows";
  else if (/Mac OS X|Macintosh/i.test(ua)) os = "macOS";
  else if (/CrOS/i.test(ua)) os = "ChromeOS";
  else if (/Linux/i.test(ua)) os = "Linux";

  let browser = "Browser";
  if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/OPR\/|Opera/i.test(ua)) browser = "Opera";
  else if (/SamsungBrowser/i.test(ua)) browser = "Samsung Internet";
  else if (/Firefox\/|FxiOS/i.test(ua)) browser = "Firefox";
  else if (/CriOS|Chrome\//i.test(ua)) browser = "Chrome";
  else if (/Safari\//i.test(ua)) browser = "Safari";

  const kind: DeviceKind = /iPad|Tablet/i.test(ua)
    ? "tablet"
    : /Mobile|iPhone|iPod|Android/i.test(ua)
      ? "phone"
      : "desktop";

  const label = os === "Unknown" ? browser : `${browser} on ${os}`;
  const fingerprint = createHash("sha256")
    .update(`${browser}|${os}|${kind}`.toLowerCase())
    .digest("hex")
    .slice(0, 32);

  return { fingerprint, label, browser, os, kind };
}

/** Remember this device, or just bump its last-seen stamp. */
export async function recordDevice(
  userId: string,
  userAgent: string | null | undefined,
): Promise<{ id: string } & DeviceInfo> {
  const info = describeDevice(userAgent);
  const row = await queryOne<{ id: string }>(
    `INSERT INTO devices (user_id, fingerprint, label, browser, os, kind, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (user_id, fingerprint) DO UPDATE
       SET last_seen = NOW(),
           label = EXCLUDED.label,
           browser = EXCLUDED.browser,
           os = EXCLUDED.os,
           kind = EXCLUDED.kind,
           user_agent = EXCLUDED.user_agent
     RETURNING id`,
    [
      userId,
      info.fingerprint,
      info.label,
      info.browser,
      info.os,
      info.kind,
      userAgent ?? "",
    ],
  );
  return { id: row!.id, ...info };
}

export async function touchDevice(deviceId: string | null | undefined) {
  if (!deviceId) return;
  await query(
    `UPDATE devices SET last_seen = NOW()
     WHERE id = $1 AND (last_seen IS NULL OR last_seen < NOW() - INTERVAL '30 seconds')`,
    [deviceId],
  ).catch(() => undefined);
}

export async function listDevices(
  userId: string,
  currentId: string | null,
): Promise<DeviceRow[]> {
  const rows = await query<{
    id: string;
    label: string;
    browser: string | null;
    os: string | null;
    kind: DeviceKind | null;
    first_seen: string;
    last_seen: string;
  }>(
    `SELECT id, label, browser, os, kind, first_seen, last_seen
     FROM devices
     WHERE user_id = $1
     ORDER BY (last_seen > NOW() - INTERVAL '5 minutes') DESC, last_seen DESC`,
    [userId],
  );

  return rows.map((r) => ({
    id: r.id,
    label: r.label,
    browser: r.browser,
    os: r.os,
    kind: r.kind ?? "desktop",
    firstSeen: new Date(r.first_seen).toISOString(),
    lastSeen: new Date(r.last_seen).toISOString(),
    current: r.id === currentId,
  }));
}
