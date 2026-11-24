import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { handleError, requireUser } from "@/lib/api";
import { abortMultipart, deleteObject } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireUser();

    const t = await queryOne<{
      sender_id: string;
      storage_key: string | null;
      upload_id: string | null;
      status: string;
    }>(
      `SELECT sender_id, storage_key, upload_id, status FROM transfers WHERE id = $1`,
      [params.id]
    );
    if (!t) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (t.sender_id === user.userId) {
      await query(`UPDATE transfers SET deleted_by_sender = TRUE WHERE id = $1`, [
        params.id,
      ]);
      // Nobody can use the bytes any more, so remove them now.
      if (t.storage_key) {
        if (t.upload_id) await abortMultipart(t.storage_key, t.upload_id);
        if (t.status === "ready") await deleteObject(t.storage_key);
      }
      await query(
        `UPDATE transfer_recipients SET status = 'expired', updated_at = NOW()
         WHERE transfer_id = $1 AND status IN ('pending','accepted')`,
        [params.id]
      );
      return NextResponse.json({ ok: true });
    }

    const recipient = await queryOne(
      `SELECT 1 FROM transfer_recipients WHERE transfer_id = $1 AND recipient_id = $2`,
      [params.id, user.userId]
    );
    if (!recipient) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await query(
      `UPDATE transfer_recipients SET deleted = TRUE, updated_at = NOW()
       WHERE transfer_id = $1 AND recipient_id = $2`,
      [params.id, user.userId]
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
