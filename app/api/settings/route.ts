import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { handleError, requireUser } from "@/lib/api";
import { autoAcceptMode } from "@/lib/transfers";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();
    return NextResponse.json({ autoAccept: await autoAcceptMode(user.userId) });
  } catch (e) {
    return handleError(e);
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json().catch(() => ({}));
    const mode = body.autoAccept;
    if (!["none", "favs", "all"].includes(mode)) {
      return NextResponse.json({ error: "Bad value" }, { status: 400 });
    }
    await query(
      `INSERT INTO settings (user_id, auto_accept_mode, updated_at)
       VALUES ($1,$2,NOW())
       ON CONFLICT (user_id)
       DO UPDATE SET auto_accept_mode = EXCLUDED.auto_accept_mode, updated_at = NOW()`,
      [user.userId, mode]
    );
    return NextResponse.json({ autoAccept: mode });
  } catch (e) {
    return handleError(e);
  }
}
