import { NextResponse } from "next/server";
import { dbEngine, dbError, query } from "@/lib/db";
import { isR2Configured } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET() {
  const out: Record<string, unknown> = {
    app: "ok",
    engine: dbEngine(),
    database: "unknown",
    storage: isR2Configured() ? "r2" : "local-disk",
    missingStorageVars: [
      "R2_ACCOUNT_ID",
      "R2_ACCESS_KEY_ID",
      "R2_SECRET_ACCESS_KEY",
      "R2_BUCKET",
    ].filter((v) => !process.env[v]),
  };

  try {
    const rows = await query<{ n: string }>("SELECT COUNT(*)::text AS n FROM users");
    out.database = "ok";
    out.users = Number(rows[0]?.n ?? 0);
    out.engine = dbEngine();
    if (dbError()) out.postgresError = dbError()?.slice(0, 200);
  } catch (e) {
    out.database = "error";
    out.databaseError = (e as Error).message.slice(0, 200);
  }

  return NextResponse.json(out, { headers: { "Cache-Control": "no-store" } });
}
