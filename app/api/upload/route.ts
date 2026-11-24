import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { handleError, requireUser } from "@/lib/api";
import { isR2Configured, saveLocalStream } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function PUT(req: Request) {
  try {
    const user = await requireUser();
    if (isR2Configured()) {
      return NextResponse.json({ error: "Direct upload not available" }, { status: 400 });
    }

    const transferId = new URL(req.url).searchParams.get("transferId");
    if (!transferId) {
      return NextResponse.json({ error: "Missing transfer" }, { status: 400 });
    }
    if (!req.body) {
      return NextResponse.json({ error: "Empty upload" }, { status: 400 });
    }

    const t = await queryOne<{ storage_key: string }>(
      `SELECT storage_key FROM transfers
       WHERE id = $1 AND sender_id = $2 AND status = 'uploading'`,
      [transferId, user.userId]
    );
    if (!t?.storage_key) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const size = await saveLocalStream(t.storage_key, req.body);
    return NextResponse.json({ ok: true, size });
  } catch (e) {
    return handleError(e);
  }
}
