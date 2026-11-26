import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { handleError, requireUser } from "@/lib/api";
import {
  autoAcceptMode,
  favoriteIdsOf,
  listIncoming,
  listPeople,
  listSent,
} from "@/lib/transfers";
import { shouldSweep, sweepExpired } from "@/lib/cleanup";
import { openAlerts, resolveAlerts, storageUsage } from "@/lib/quota";
import type { AppState } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();

    // Presence only needs a heartbeat every 30 seconds, not on every poll.
    await query(
      `UPDATE users SET last_seen = NOW()
       WHERE id = $1 AND (last_seen IS NULL OR last_seen < NOW() - INTERVAL '30 seconds')`,
      [user.userId]
    );

    if (shouldSweep()) {
      await sweepExpired(3).catch(() => undefined);
    }

    const [favIds, incoming, sent, mode, avatarRow] = await Promise.all([
      favoriteIdsOf(user.userId),
      listIncoming(user.userId, 25),
      listSent(user.userId, 25),
      autoAcceptMode(user.userId),
      queryOne<{ avatar_updated_at: string | null }>(
        `SELECT avatar_updated_at FROM users WHERE id = $1`,
        [user.userId]
      ),
    ]);

    const people = await listPeople(user.userId, favIds);
    const storage = await storageUsage();

    // A full-storage alarm clears itself as soon as there is room again.
    if (storage.used < storage.limit) {
      await resolveAlerts("storage-full").catch(() => undefined);
    }
    const adminAlerts =
      user.role === "admin"
        ? await openAlerts().catch(() => [])
        : [];

    const state: AppState = {
      me: {
        id: user.userId,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
        autoAccept: mode,
        avatarUpdatedAt: avatarRow?.avatar_updated_at
          ? new Date(avatarRow.avatar_updated_at).toISOString()
          : null,
      },
      people,
      incoming,
      sent,
      pendingCount: incoming.filter((t) => t.myStatus === "pending" && !t.expired)
        .length,
      storage,
      adminAlerts,
    };

    return NextResponse.json(state, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return handleError(e);
  }
}
