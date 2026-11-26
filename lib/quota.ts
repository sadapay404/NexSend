import { query, queryOne } from "./db";

/**
 * Hard ceiling below Cloudflare R2's 10 GB free tier. Nothing may ever be
 * uploaded past this, so the card on file can never be charged.
 */
export const STORAGE_LIMIT_BYTES = 9 * 1024 * 1024 * 1024;
/** Warn the admin once usage crawls past this. */
export const STORAGE_WARN_BYTES = 8 * 1024 * 1024 * 1024;

export type StorageUsage = {
  used: number;
  limit: number;
  warn: number;
  free: number;
  percent: number;
};

export type AdminAlert = {
  id: string;
  kind: string;
  message: string;
  createdAt: string;
};

export function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** i;
  const digits = i >= 3 ? 1 : value >= 10 ? 0 : 1;
  return `${value.toFixed(digits)} ${units[i]}`;
}

/**
 * Bytes currently occupying storage: every transfer that still owns an object
 * and has not expired yet.
 */
export async function storageUsage(): Promise<StorageUsage> {
  const row = await queryOne<{ used: string | null; files: string | null }>(
    `SELECT COALESCE(SUM(file_size), 0)::text AS used,
            COUNT(*)::text AS files
     FROM transfers
     WHERE storage_key IS NOT NULL AND expires_at > NOW()`
  );
  const used = Number(row?.used ?? 0);
  return {
    used,
    limit: STORAGE_LIMIT_BYTES,
    warn: STORAGE_WARN_BYTES,
    free: Math.max(0, STORAGE_LIMIT_BYTES - used),
    percent: Math.min(100, (used / STORAGE_LIMIT_BYTES) * 100),
  };
}

/** Only one open alert per kind, so the admin is told once, not every poll. */
export async function raiseAlert(kind: string, message: string): Promise<void> {
  const open = await queryOne<{ id: string }>(
    `SELECT id FROM alerts WHERE kind = $1 AND resolved_at IS NULL LIMIT 1`,
    [kind]
  );
  if (open) return;
  await query(`INSERT INTO alerts (kind, message) VALUES ($1, $2)`, [
    kind,
    message,
  ]);
}

export async function resolveAlerts(kind: string): Promise<void> {
  await query(
    `UPDATE alerts SET resolved_at = NOW()
     WHERE kind = $1 AND resolved_at IS NULL`,
    [kind]
  );
}

export async function openAlerts(): Promise<AdminAlert[]> {
  const rows = await query<{ id: string; kind: string; message: string; created_at: string }>(
    `SELECT id, kind, message, created_at FROM alerts
     WHERE resolved_at IS NULL
     ORDER BY created_at DESC
     LIMIT 5`
  );
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    message: r.message,
    createdAt: new Date(r.created_at).toISOString(),
  }));
}

/**
 * Called before a file transfer is created. Returns the usage after any
 * attempted reclaim so callers can report honest numbers.
 */
export async function checkRoom(bytes: number): Promise<{
  ok: boolean;
  usage: StorageUsage;
  reclaim: () => Promise<void>;
}> {
  let usage = await storageUsage();
  const reclaim = async () => {
    const { sweepExpired } = await import("./cleanup");
    await sweepExpired(200).catch(() => undefined);
  };

  if (usage.used + bytes <= usage.limit) {
    if (usage.used >= STORAGE_WARN_BYTES) {
      await raiseAlert(
        "storage-warning",
        `Storage is at ${formatSize(usage.used)} of ${formatSize(
          usage.limit
        )}. Uploads stop at the limit — expired files can be cleared from Admin.`
      );
    }
    return { ok: true, usage, reclaim };
  }

  // Over the line: expired objects may still be sitting in the bucket.
  await reclaim();
  usage = await storageUsage();

  if (usage.used + bytes <= usage.limit) {
    return { ok: true, usage, reclaim };
  }

  await raiseAlert(
    "storage-full",
    `Storage is full: ${formatSize(usage.used)} of ${formatSize(
      usage.limit
    )} used. New file uploads are blocked until files expire or space is cleared.`
  );
  return { ok: false, usage, reclaim };
}
