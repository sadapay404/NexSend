import { query } from "./db";
import { deleteObject } from "./storage";

let lastSweep = 0;
export const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Bytes live for one hour. Metadata stays forever; only the object is removed.
 */
export async function sweepExpired(limit = 10): Promise<number> {
  const rows = await query<{ id: string; storage_key: string }>(
    `SELECT id, storage_key FROM transfers
     WHERE storage_key IS NOT NULL
       AND expires_at < NOW()
     ORDER BY expires_at ASC
     LIMIT $1`,
    [limit]
  );

  for (const row of rows) {
    try {
      await deleteObject(row.storage_key);
    } catch {
      /* already gone */
    }
    await query(`UPDATE transfers SET storage_key = NULL WHERE id = $1`, [row.id]);
  }

  await query(
    `UPDATE transfer_recipients tr
     SET status = 'expired', updated_at = NOW()
     FROM transfers t
     WHERE tr.transfer_id = t.id
       AND tr.status IN ('pending','accepted')
       AND t.expires_at < NOW()`
  );

  return rows.length;
}

export function shouldSweep(): boolean {
  const now = Date.now();
  if (now - lastSweep < SWEEP_INTERVAL_MS) return false;
  lastSweep = now;
  return true;
}
