import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { handleError, requireUser } from "@/lib/api";
import {
  completeMultipart,
  isR2Configured,
  listUploadedParts,
  localExists,
} from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireUser();
    const body = await req.json().catch(() => ({}));

    const t = await queryOne<{ storage_key: string; upload_id: string | null }>(
      `SELECT storage_key, upload_id FROM transfers
       WHERE id = $1 AND sender_id = $2`,
      [params.id, user.userId]
    );
    if (!t) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (t.upload_id && isR2Configured()) {
      const parts = Array.isArray(body.parts) && body.parts.length
        ? body.parts
        : await listUploadedParts(t.storage_key, t.upload_id);
      if (parts.length === 0) {
        return NextResponse.json({ error: "No parts uploaded" }, { status: 400 });
      }
      await completeMultipart(t.storage_key, t.upload_id, parts);
    } else if (!isR2Configured() && !localExists(t.storage_key)) {
      return NextResponse.json({ error: "Upload incomplete" }, { status: 400 });
    }

    await query(
      `UPDATE transfers
       SET status = 'ready', expires_at = NOW() + INTERVAL '1 hour'
       WHERE id = $1`,
      [params.id]
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
