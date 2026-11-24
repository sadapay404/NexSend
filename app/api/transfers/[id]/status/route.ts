import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { handleError, requireUser } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
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
      [params.id, user.userId]
    );
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (new Date(row.expires_at).getTime() < Date.now()) {
      await query(
        `UPDATE transfer_recipients SET status = 'expired', updated_at = NOW()
         WHERE transfer_id = $1 AND recipient_id = $2`,
        [params.id, user.userId]
      );
      return NextResponse.json({ error: "This transfer expired" }, { status: 410 });
    }

    await query(
      `UPDATE transfer_recipients SET status = $1, updated_at = NOW()
       WHERE transfer_id = $2 AND recipient_id = $3`,
      [status, params.id, user.userId]
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
