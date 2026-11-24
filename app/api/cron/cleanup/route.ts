import { NextResponse } from "next/server";
import { sweepExpired } from "@/lib/cleanup";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // no secret configured: allow Vercel cron only
  const header = req.headers.get("authorization") ?? "";
  return header === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (req.headers.get("x-vercel-cron") === null && !authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let removed = 0;
  for (let i = 0; i < 5; i++) {
    const n = await sweepExpired(50);
    removed += n;
    if (n < 50) break;
  }
  return NextResponse.json({ ok: true, removed });
}
