import { NextResponse } from "next/server";
import { handleError, requireAdmin } from "@/lib/api";
import { sweepExpired } from "@/lib/cleanup";
import { resolveAlerts, storageUsage } from "@/lib/quota";

export const dynamic = "force-dynamic";

/** Admin: delete expired objects now and report the new usage. */
export async function POST() {
  try {
    await requireAdmin();
    const removed = await sweepExpired(500).catch(() => 0);
    const usage = await storageUsage();
    if (usage.used < usage.limit) {
      await resolveAlerts("storage-full");
      await resolveAlerts("storage-warning");
    }
    return NextResponse.json({ ok: true, removed, usage });
  } catch (e) {
    return handleError(e);
  }
}
