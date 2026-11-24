import { NextResponse } from "next/server";
import { handleError, requireUser } from "@/lib/api";
import { listIncoming, listSent } from "@/lib/transfers";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const scope = new URL(req.url).searchParams.get("scope") ?? "all";

    const [incoming, sent] = await Promise.all([
      scope === "sent" ? [] : listIncoming(user.userId, 200),
      scope === "incoming" ? [] : listSent(user.userId, 200),
    ]);

    return NextResponse.json({ incoming, sent });
  } catch (e) {
    return handleError(e);
  }
}
