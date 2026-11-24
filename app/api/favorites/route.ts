import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { handleError, requireUser } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json().catch(() => ({}));
    const targetId = body.userId as string;
    const favorite = Boolean(body.favorite);

    if (!targetId || targetId === user.userId) {
      return NextResponse.json({ error: "Bad request" }, { status: 400 });
    }

    if (favorite) {
      await query(
        `INSERT INTO favorites (user_id, favorite_user_id) VALUES ($1,$2)
         ON CONFLICT (user_id, favorite_user_id) DO NOTHING`,
        [user.userId, targetId]
      );
    } else {
      await query(
        `DELETE FROM favorites WHERE user_id = $1 AND favorite_user_id = $2`,
        [user.userId, targetId]
      );
    }

    return NextResponse.json({ ok: true, favorite });
  } catch (e) {
    return handleError(e);
  }
}
