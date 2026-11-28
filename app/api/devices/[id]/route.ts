import { NextResponse } from "next/server";
import { handleError, requireUser } from "@/lib/api";
import { signOutDevice } from "@/lib/devices";

export const dynamic = "force-dynamic";

/** Sign a device out from wherever you are. */
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const user = await requireUser();
    const ok = await signOutDevice(user.userId, params.id);
    if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
