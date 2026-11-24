import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { isR2Configured } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET() {
  const out: Record<string, unknown> = {
    app: "ok",
    database: "unknown",
    storage: isR2Configured() ? "r2" : "local-disk",
  };

  try {
    const rows = await query<{ n: string }>("SELECT COUNT(*)::text AS n FROM users");
    out.database = "ok";
    out.users = Number(rows[0]?.n ?? 0);
  } catch (e) {
    out.database = "error";
    out.databaseError = (e as Error).message.slice(0, 160);
  }

  return NextResponse.json(out, { headers: { "Cache-Control": "no-store" } });
}
