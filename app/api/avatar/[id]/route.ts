import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const row = await queryOne<{
    avatar: Buffer | null;
    avatar_mime: string | null;
    avatar_updated_at: string | null;
  }>(
    `SELECT avatar, avatar_mime, avatar_updated_at FROM users WHERE id = $1`,
    [params.id]
  );

  if (!row?.avatar) {
    return new NextResponse("No avatar", { status: 404 });
  }

  const bytes = Buffer.isBuffer(row.avatar)
    ? row.avatar
    : Buffer.from(row.avatar as unknown as Uint8Array);

  const body = new Uint8Array(bytes);

  return new NextResponse(body, {
    headers: {
      "Content-Type": row.avatar_mime ?? "image/jpeg",
      "Content-Length": String(bytes.length),
      "Cache-Control": "private, max-age=300",
      ETag: `"${row.avatar_updated_at ?? "0"}"`,
    },
  });
}
