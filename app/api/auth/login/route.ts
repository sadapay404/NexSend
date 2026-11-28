import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { createSession, setSessionCookie, verifyPassword } from "@/lib/auth";
import { handleError } from "@/lib/api";
import { z } from "zod";
import { clientIp, recordDevice } from "@/lib/devices";

const schema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  deviceKey: z.string().max(64).optional(),
});

const attempts = new Map<string, { count: number; until: number }>();

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Enter username and password" },
        { status: 400 }
      );
    }

    const key = parsed.data.username.trim().toLowerCase();
    const record = attempts.get(key);
    if (record && record.count >= 8 && Date.now() < record.until) {
      return NextResponse.json(
        { error: "Too many attempts. Try again in a few minutes." },
        { status: 429 }
      );
    }

    const user = await queryOne<{
      id: string;
      username: string;
      password_hash: string;
      display_name: string;
      role: "admin" | "user";
    }>(
      `SELECT id, username, password_hash, display_name, role
       FROM users WHERE lower(username) = $1`,
      [key]
    );

    const ok = user
      ? await verifyPassword(parsed.data.password, user.password_hash)
      : false;

    if (!user || !ok) {
      const next = record && Date.now() < record.until ? record.count + 1 : 1;
      attempts.set(key, { count: next, until: Date.now() + 10 * 60 * 1000 });
      return NextResponse.json(
        { error: "Wrong username or password" },
        { status: 401 }
      );
    }

    attempts.delete(key);

    // Never let device bookkeeping stand between someone and their account.
    const device = await recordDevice(
      user.id,
      req.headers.get("user-agent"),
      clientIp(req),
      parsed.data.deviceKey
    ).catch(() => null);

    const token = await createSession({
      userId: user.id,
      username: user.username,
      displayName: user.display_name,
      role: user.role,
      deviceId: device?.id,
    });
    setSessionCookie(token);

    await query(`UPDATE users SET last_seen = NOW() WHERE id = $1`, [user.id]);

    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        role: user.role,
      },
    });
  } catch (e) {
    return handleError(e);
  }
}
