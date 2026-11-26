import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { handleError, requireAdmin } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await requireAdmin();
    const limit = Math.min(
      Number(new URL(req.url).searchParams.get("limit") ?? 200),
      500,
    );

    const rows = await query(
      `SELECT t.id, t.type, t.file_name, t.file_size, t.text_content, t.status,
              t.mime_type, t.created_at, t.expires_at, t.deleted_by_sender,
              (t.storage_key IS NOT NULL AND t.status = 'ready'
                AND t.expires_at > NOW()) AS available,
              s.display_name AS sender_name,
              COALESCE(
                (SELECT json_agg(json_build_object(
                    'id', r.recipient_id,
                    'displayName', ru.display_name,
                    'status', r.status,
                    'deleted', r.deleted
                  ) ORDER BY ru.display_name)
                 FROM transfer_recipients r
                 JOIN users ru ON ru.id = r.recipient_id
                 WHERE r.transfer_id = t.id),
                '[]'::json
              ) AS recipients
       FROM transfers t
       JOIN users s ON s.id = t.sender_id
       ORDER BY t.created_at DESC
       LIMIT $1`,
      [limit],
    );

    return NextResponse.json({ transfers: rows });
  } catch (e) {
    return handleError(e);
  }
}
