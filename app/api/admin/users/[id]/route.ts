import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { handleError, requireAdmin } from "@/lib/api";
import { hashPassword } from "@/lib/password";
import { z } from "zod";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3)
    .max(32)
    .regex(/^[a-zA-Z0-9._-]+$/, "Letters, numbers, dot, dash and underscore only")
    .optional(),
  displayName: z.string().trim().min(1).max(60).optional(),
  password: z.string().min(4).max(128).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await requireAdmin();
    const body = await req.json().catch(() => ({}));
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid details" },
        { status: 400 }
      );
    }

    const target = await queryOne<{ id: string; username: string }>(
      `SELECT id, username FROM users WHERE id = $1`,
      [params.id]
    );
    if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const { username, displayName, password } = parsed.data;

    if (username && username.toLowerCase() !== target.username.toLowerCase()) {
      const clash = await queryOne(
        `SELECT 1 FROM users WHERE lower(username) = lower($1) AND id <> $2`,
        [username, params.id]
      );
      if (clash) {
        return NextResponse.json({ error: "That username is taken" }, { status: 409 });
      }
      await query(`UPDATE users SET username = $1, updated_at = NOW() WHERE id = $2`, [
        username,
        params.id,
      ]);
    }

    if (displayName) {
      await query(
        `UPDATE users SET display_name = $1, updated_at = NOW() WHERE id = $2`,
        [displayName, params.id]
      );
    }

    if (password) {
      const hash = await hashPassword(password);
      await query(
        `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
        [hash, params.id]
      );
    }

    return NextResponse.json({ ok: true, self: admin.userId === params.id });
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await requireAdmin();
    if (admin.userId === params.id) {
      return NextResponse.json(
        { error: "You cannot delete your own account" },
        { status: 400 }
      );
    }

    const target = await queryOne<{ role: string }>(
      `SELECT role FROM users WHERE id = $1`,
      [params.id]
    );
    if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });
    if (target.role === "admin") {
      return NextResponse.json(
        { error: "Admin accounts cannot be removed here" },
        { status: 400 }
      );
    }

    await query(`DELETE FROM users WHERE id = $1`, [params.id]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
