import { NextResponse } from "next/server";
import { handleError, requireUser } from "@/lib/api";
import { listDevices, recordDevice } from "@/lib/devices";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const user = await requireUser();

    // Cookies minted before devices existed carry no id: adopt this one now.
    let currentId = user.deviceId ?? null;
    if (!currentId) {
      const device = await recordDevice(
        user.userId,
        req.headers.get("user-agent"),
      );
      currentId = device.id;
    }

    const devices = await listDevices(user.userId, currentId);

    return NextResponse.json(
      { devices, currentId },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return handleError(e);
  }
}
