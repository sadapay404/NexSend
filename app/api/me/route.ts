import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { handleError, requireUser } from "@/lib/api";
import { createSession, setSessionCookie } from "@/lib/auth";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({
  displayName: z.string().trim().min(1).max(60),
});

export async function PATCH(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Display name must be 1-60 characters" },
        { status: 400 }
      );
    }

    await query(`UPDATE users SET display_name = $1, updated_at = NOW() WHERE id = $2`, [
      parsed.data.displayName,
      user.userId,
    ]);

    const token = await createSession({ ...user, displayName: parsed.data.displayName });
    setSessionCookie(token);

    return NextResponse.json({ displayName: parsed.data.displayName });
  } catch (e) {
    return handleError(e);
  }
}
