import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { handleError, requireUser } from "@/lib/api";
import { abortMultipart, deleteObject } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const user = await requireUser();
    const body = await req.json().catch(() => ({}));
    const status = body.status;
    if (status !== "accepted" && status !== "declined") {
      return NextResponse.json({ error: "Bad status" }, { status: 400 });
    }

    const row = await queryOne<{ expires_at: string; status: string }>(
      `SELECT t.expires_at, tr.status
       FROM transfer_recipients tr
       JOIN transfers t ON t.id = tr.transfer_id
       WHERE tr.transfer_id = $1 AND tr.recipient_id = $2`,
      [params.id, user.userId],
    );
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (new Date(row.expires_at).getTime() < Date.now()) {
      await query(
        `UPDATE transfer_recipients SET status = 'expired', updated_at = NOW()
         WHERE transfer_id = $1 AND recipient_id = $2`,
        [params.id, user.userId],
      );
      return NextResponse.json(
        { error: "This transfer expired" },
        { status: 410 },
      );
    }

    await query(
      `UPDATE transfer_recipients SET status = $1, updated_at = NOW()
       WHERE transfer_id = $2 AND recipient_id = $3`,
      [status, params.id, user.userId],
    );

    /*
     * A decline throws the payload away: nobody is left waiting for it, so the
     * bytes leave R2 (freeing the storage meter) and the text is wiped from the
     * database. Only the metadata survives, so history still shows the attempt.
     */
    if (status === "declined") {
      const left = await queryOne<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM transfer_recipients
         WHERE transfer_id = $1 AND status IN ('pending','accepted','downloaded')`,
        [params.id],
      );
      if (Number(left?.n ?? 0) === 0) {
        const t = await queryOne<{
          storage_key: string | null;
          upload_id: string | null;
          status: string;
        }>(
          `SELECT storage_key, upload_id, status FROM transfers WHERE id = $1`,
          [params.id],
        );
        if (t?.storage_key) {
          if (t.upload_id) await abortMultipart(t.storage_key, t.upload_id);
          if (t.status === "ready") {
            await deleteObject(t.storage_key).catch(() => undefined);
          }
        }
        await query(
          `UPDATE transfers
              SET storage_key = NULL,
                  storage_kind = NULL,
                  text_content = NULL,
                  file_size = NULL,
                  upload_id = NULL
            WHERE id = $1`,
          [params.id],
        );
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
