import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { handleError, requireAdmin } from "@/lib/api";
import { hashPassword } from "@/lib/password";
import { z } from "zod";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters")
    .max(32)
    .regex(/^[a-zA-Z0-9._-]+$/, "Letters, numbers, dot, dash and underscore only"),
  displayName: z.string().trim().min(1).max(60),
  password: z.string().min(4, "Password must be at least 4 characters").max(128),
});

export async function GET() {
  try {
    await requireAdmin();
    const users = await query(
      `SELECT u.id, u.username, u.display_name, u.role, u.created_at, u.last_seen,
              (SELECT COUNT(*) FROM transfers t WHERE t.sender_id = u.id) AS sent_count,
              (SELECT COUNT(*) FROM transfer_recipients r WHERE r.recipient_id = u.id) AS received_count
       FROM users u
       ORDER BY u.role DESC, u.display_name ASC`
    );
    return NextResponse.json({ users });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const body = await req.json().catch(() => ({}));
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid details" },
        { status: 400 }
      );
    }

    const { username, displayName, password } = parsed.data;
    const existing = await queryOne(`SELECT 1 FROM users WHERE lower(username) = lower($1)`, [
      username,
    ]);
    if (existing) {
      return NextResponse.json({ error: "That username is taken" }, { status: 409 });
    }

    const hash = await hashPassword(password);
    const created = await queryOne<{ id: string }>(
      `INSERT INTO users (username, password_hash, display_name, role)
       VALUES ($1,$2,$3,'user') RETURNING id`,
      [username, hash, displayName]
    );

    return NextResponse.json({ id: created?.id });
  } catch (e) {
    return handleError(e);
  }
}
