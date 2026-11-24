import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { handleError, requireUser } from "@/lib/api";

export const dynamic = "force-dynamic";

const MAX_BYTES = 400 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json().catch(() => ({}));
    const dataUrl = typeof body.image === "string" ? body.image : "";

    const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(
      dataUrl
    );
    if (!match) {
      return NextResponse.json({ error: "Use a JPEG, PNG or WebP image" }, { status: 400 });
    }

    const mime = match[1];
    if (!ALLOWED.includes(mime)) {
      return NextResponse.json({ error: "Unsupported image type" }, { status: 400 });
    }

    const bytes = Buffer.from(match[2], "base64");
    if (bytes.length > MAX_BYTES) {
      return NextResponse.json({ error: "Image is too large" }, { status: 413 });
    }

    const updated = await query<{ avatar_updated_at: string }>(
      `UPDATE users
       SET avatar = $1, avatar_mime = $2, avatar_updated_at = NOW()
       WHERE id = $3
       RETURNING avatar_updated_at`,
      [bytes, mime, user.userId]
    );

    return NextResponse.json({
      ok: true,
      avatarUpdatedAt: updated[0]?.avatar_updated_at ?? new Date().toISOString(),
    });
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE() {
  try {
    const user = await requireUser();
    await query(
      `UPDATE users
       SET avatar = NULL, avatar_mime = NULL, avatar_updated_at = NULL
       WHERE id = $1`,
      [user.userId]
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
