import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { handleError, requireUser } from "@/lib/api";
import {
  autoAcceptMode,
  favoriteIdsOf,
  listIncoming,
  listPeople,
  listSent,
} from "@/lib/transfers";
import type { AppState } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();

    await query(`UPDATE users SET last_seen = NOW() WHERE id = $1`, [user.userId]);

    // Lazy expiry: bytes die after 1 hour, metadata stays.
    await query(
      `UPDATE transfer_recipients tr
       SET status = 'expired', updated_at = NOW()
       FROM transfers t
       WHERE tr.transfer_id = t.id
         AND tr.status IN ('pending','accepted')
         AND t.expires_at < NOW()`
    );

    const [favIds, incoming, sent, mode] = await Promise.all([
      favoriteIdsOf(user.userId),
      listIncoming(user.userId),
      listSent(user.userId),
      autoAcceptMode(user.userId),
    ]);

    const people = await listPeople(user.userId, favIds);

    const state: AppState = {
      me: {
        id: user.userId,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
        autoAccept: mode,
      },
      people,
      incoming,
      sent,
      pendingCount: incoming.filter((t) => t.myStatus === "pending" && !t.expired)
        .length,
    };

    return NextResponse.json(state);
  } catch (e) {
    return handleError(e);
  }
}
