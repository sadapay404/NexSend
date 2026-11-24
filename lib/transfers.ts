import { query } from "./db";
import type {
  RecipientStatus,
  TransferItem,
  TransferType,
  Person,
} from "./types";

export const ONLINE_WINDOW_SECONDS = 75;

type TransferRow = Record<string, any>;

function mapTransfer(
  row: TransferRow,
  recipients: TransferItem["recipients"]
): TransferItem {
  return {
    id: row.id,
    type: row.type as TransferType,
    title: row.title ?? null,
    text: row.text_content ?? null,
    fileName: row.file_name ?? null,
    fileSize: row.file_size ? Number(row.file_size) : null,
    mimeType: row.mime_type ?? null,
    status: row.status,
    createdAt: new Date(row.created_at).toISOString(),
    expiresAt: new Date(row.expires_at).toISOString(),
    expired: new Date(row.expires_at).getTime() < Date.now(),
    senderId: row.sender_id,
    senderName: row.sender_name ?? "",
    myStatus: (row.my_status as RecipientStatus) ?? null,
    recipients,
  };
}

async function recipientsFor(
  transferIds: string[]
): Promise<Map<string, TransferItem["recipients"]>> {
  const map = new Map<string, TransferItem["recipients"]>();
  if (transferIds.length === 0) return map;
  const rows = await query<{
    transfer_id: string;
    id: string;
    display_name: string;
    status: RecipientStatus;
  }>(
    `SELECT tr.transfer_id, tr.recipient_id AS id, u.display_name, tr.status
     FROM transfer_recipients tr
     JOIN users u ON u.id = tr.recipient_id
     WHERE tr.transfer_id = ANY($1::uuid[])`,
    [transferIds]
  );
  for (const r of rows) {
    const arr = map.get(r.transfer_id) ?? [];
    arr.push({ id: r.id, displayName: r.display_name, status: r.status });
    map.set(r.transfer_id, arr);
  }
  return map;
}

export async function listIncoming(
  userId: string,
  limit = 60
): Promise<TransferItem[]> {
  const rows = await query(
    `SELECT t.*, u.display_name AS sender_name, tr.status AS my_status
     FROM transfer_recipients tr
     JOIN transfers t ON t.id = tr.transfer_id
     JOIN users u ON u.id = t.sender_id
     WHERE tr.recipient_id = $1 AND tr.deleted = FALSE
     ORDER BY t.created_at DESC
     LIMIT $2`,
    [userId, limit]
  );
  const recips = await recipientsFor(rows.map((r) => r.id as string));
  return rows.map((r) => mapTransfer(r, recips.get(r.id as string) ?? []));
}

export async function listSent(
  userId: string,
  limit = 60
): Promise<TransferItem[]> {
  const rows = await query(
    `SELECT t.*, u.display_name AS sender_name
     FROM transfers t
     JOIN users u ON u.id = t.sender_id
     WHERE t.sender_id = $1 AND t.deleted_by_sender = FALSE
     ORDER BY t.created_at DESC
     LIMIT $2`,
    [userId, limit]
  );
  const recips = await recipientsFor(rows.map((r) => r.id as string));
  return rows.map((r) => mapTransfer(r, recips.get(r.id as string) ?? []));
}

export async function listPeople(
  userId: string,
  favoriteIds: string[]
): Promise<Person[]> {
  const rows = await query<{
    id: string;
    display_name: string;
    role: string;
    last_seen: string | null;
  }>(
    `SELECT id, display_name, role, last_seen
     FROM users
     WHERE id <> $1
     ORDER BY display_name ASC`,
    [userId]
  );
  const now = Date.now();
  return rows.map((r) => ({
    id: r.id,
    displayName: r.display_name,
    isAdmin: r.role === "admin",
    favorite: favoriteIds.includes(r.id),
    online:
      r.last_seen !== null &&
      now - new Date(r.last_seen).getTime() < ONLINE_WINDOW_SECONDS * 1000,
  }));
}

export async function favoriteIdsOf(userId: string): Promise<string[]> {
  const rows = await query<{ favorite_user_id: string }>(
    `SELECT favorite_user_id FROM favorites WHERE user_id = $1`,
    [userId]
  );
  return rows.map((r) => r.favorite_user_id);
}

export async function autoAcceptMode(
  userId: string
): Promise<"none" | "favs" | "all"> {
  const rows = await query<{ auto_accept_mode: "none" | "favs" | "all" }>(
    `SELECT auto_accept_mode FROM settings WHERE user_id = $1`,
    [userId]
  );
  return rows[0]?.auto_accept_mode ?? "none";
}

export async function shouldAutoAccept(
  recipientId: string,
  senderId: string
): Promise<boolean> {
  const mode = await autoAcceptMode(recipientId);
  if (mode === "all") return true;
  if (mode === "favs") {
    const rows = await query(
      `SELECT 1 FROM favorites WHERE user_id = $1 AND favorite_user_id = $2`,
      [recipientId, senderId]
    );
    return rows.length > 0;
  }
  return false;
}

export function summarize(rows: TransferItem[]) {
  const pending = rows.filter((r) => r.myStatus === "pending" && !r.expired);
  return {
    pendingCount: pending.length,
  };
}
