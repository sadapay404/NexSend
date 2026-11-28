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

/** Whatever the browser was willing to tell us about the hardware. */
export type DeviceMeta = {
  model?: string;
  platform?: string;
  platformVersion?: string;
  screen?: string;
  memory?: number;
  threads?: number;
  timezone?: string;
  language?: string;
};

export type DeviceRow = {
  id: string;
  name: string;
  label: string;
  model: string | null;
  browser: string | null;
  os: string | null;
  kind: DeviceKind;
  ip: string | null;
  meta: DeviceMeta;
  firstSeen: string;
  lastSeen: string;
  signedOutAt: string | null;
  online: boolean;
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

export function clientIp(req: Request): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim().slice(0, 64);
  return req.headers.get("x-real-ip")?.slice(0, 64) ?? null;
}

/** Remember this device, or just bump its last-seen stamp. */
export async function recordDevice(
  userId: string,
  userAgent: string | null | undefined,
  ip?: string | null,
): Promise<{ id: string } & DeviceInfo> {
  const info = describeDevice(userAgent);
  const row = await queryOne<{ id: string }>(
    `INSERT INTO devices (user_id, fingerprint, label, browser, os, kind, user_agent, ip)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (user_id, fingerprint) DO UPDATE
       SET last_seen = NOW(),
           signed_out_at = NULL,
           label = EXCLUDED.label,
           browser = EXCLUDED.browser,
           os = EXCLUDED.os,
           kind = EXCLUDED.kind,
           user_agent = EXCLUDED.user_agent,
           ip = COALESCE(EXCLUDED.ip, devices.ip)
     RETURNING id`,
    [
      userId,
      info.fingerprint,
      info.label,
      info.browser,
      info.os,
      info.kind,
      userAgent ?? "",
      ip ?? null,
    ],
  );
  revCache.delete(row!.id);
  return { id: row!.id, ...info };
}

const touchCache = new Set<string>();

export async function touchDevice(deviceId: string | null | undefined) {
  if (!deviceId) return;
  // The poll runs every few seconds; 30 s is plenty of resolution for "online".
  if (touchCache.has(deviceId)) return;
  touchCache.add(deviceId);
  setTimeout(() => touchCache.delete(deviceId), 20_000).unref?.();
  await query(
    `UPDATE devices SET last_seen = NOW()
     WHERE id = $1 AND (last_seen IS NULL OR last_seen < NOW() - INTERVAL '20 seconds')`,
    [deviceId],
  ).catch(() => undefined);
}

/** Store what the browser reported about the hardware. */
export async function describeHardware(
  deviceId: string,
  meta: DeviceMeta,
  ip?: string | null,
) {
  const model = meta.model?.trim().slice(0, 80) || null;
  await query(
    `UPDATE devices
        SET model = COALESCE($2, model),
            meta = COALESCE($3::jsonb, meta),
            ip = COALESCE($4, ip),
            last_seen = NOW()
      WHERE id = $1`,
    [deviceId, model, JSON.stringify(meta), ip ?? null],
  );
}

export async function signOutDevice(userId: string, deviceId: string) {
  const row = await queryOne<{ id: string }>(
    `UPDATE devices SET signed_out_at = NOW()
     WHERE id = $1 AND user_id = $2
     RETURNING id`,
    [deviceId, userId],
  );
  revCache.delete(deviceId);
  return Boolean(row);
}

/*
 * Remote sign-out has to bite quickly, but not at the cost of a database round
 * trip on every request: a short-lived cache keeps it to one query per device
 * per 10 seconds.
 */
type Revocation = { signedOutAt: number | null; at: number };
const revCache = new Map<string, Revocation>();

export async function isDeviceRevoked(
  deviceId: string | null | undefined,
  issuedAt?: number,
): Promise<boolean> {
  if (!deviceId) return false;
  const now = Date.now();
  let entry = revCache.get(deviceId);
  if (!entry || now - entry.at > 10_000) {
    const row = await queryOne<{ signed_out_at: string | null }>(
      `SELECT signed_out_at FROM devices WHERE id = $1`,
      [deviceId],
    ).catch(() => null);
    if (!row) return false; // unknown row: never lock someone out
    entry = {
      signedOutAt: row.signed_out_at
        ? new Date(row.signed_out_at).getTime()
        : null,
      at: now,
    };
    revCache.set(deviceId, entry);
  }
  if (!entry.signedOutAt) return false;
  if (!issuedAt) return true;
  return entry.signedOutAt >= issuedAt * 1000;
}

export async function listDevices(
  userId: string,
  currentId: string | null,
): Promise<DeviceRow[]> {
  const rows = await query<{
    id: string;
    label: string;
    model: string | null;
    browser: string | null;
    os: string | null;
    kind: DeviceKind | null;
    ip: string | null;
    meta: DeviceMeta | null;
    first_seen: string;
    last_seen: string;
    signed_out_at: string | null;
    online: boolean;
  }>(
    `SELECT id, label, model, browser, os, kind, ip, meta,
            first_seen, last_seen, signed_out_at,
            (last_seen > NOW() - INTERVAL '75 seconds'
              AND (signed_out_at IS NULL OR last_seen > signed_out_at)) AS online
     FROM devices
     WHERE user_id = $1
     ORDER BY (last_seen > NOW() - INTERVAL '75 seconds') DESC, last_seen DESC`,
    [userId],
  );

  return rows.map((r) => ({
    id: r.id,
    // A real model name beats a generic "Chrome on Android" every time.
    name: r.model ? `${r.model} · ${r.browser ?? "Browser"}` : r.label,
    label: r.label,
    model: r.model,
    browser: r.browser,
    os: r.os,
    kind: r.kind ?? "desktop",
    ip: r.ip,
    meta: r.meta ?? {},
    firstSeen: new Date(r.first_seen).toISOString(),
    lastSeen: new Date(r.last_seen).toISOString(),
    signedOutAt: r.signed_out_at
      ? new Date(r.signed_out_at).toISOString()
      : null,
    online: Boolean(r.online),
    current: r.id === currentId,
  }));
}
