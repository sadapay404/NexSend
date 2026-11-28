import { NextResponse } from "next/server";
import { z } from "zod";
import { handleError, requireUser } from "@/lib/api";
import { createSession, setSessionCookie } from "@/lib/auth";
import {
  clientIp,
  describeHardware,
  deviceKeyMatches,
  recordDevice,
} from "@/lib/devices";

export const dynamic = "force-dynamic";

/**
 * Browsers hide the hardware name from the user-agent, but Chrome and Edge on
 * Android will hand it over through User-Agent Client Hints. The client reads
 * those and posts them here, which is how "Chrome on Android" becomes
 * "Pixel 7 · Chrome". It also carries the browser's permanent device key, which
 * is the only reliable way to tell two identical phones apart.
 */
const schema = z.object({
  deviceKey: z.string().max(64).optional(),
  model: z.string().max(80).optional(),
  platform: z.string().max(40).optional(),
  platformVersion: z.string().max(40).optional(),
  screen: z.string().max(40).optional(),
  memory: z.number().finite().optional(),
  threads: z.number().finite().optional(),
  timezone: z.string().max(64).optional(),
  language: z.string().max(32).optional(),
});

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Bad payload" }, { status: 400 });
    }

    const ip = clientIp(req);
    let deviceId = user.deviceId ?? null;

    // Old cookie, a retired row, or a row shared with another phone: re-bind.
    if (
      !(await deviceKeyMatches(user.userId, deviceId, parsed.data.deviceKey))
    ) {
      const device = await recordDevice(
        user.userId,
        req.headers.get("user-agent"),
        ip,
        parsed.data.deviceKey,
      );
      deviceId = device.id;
      const token = await createSession({ ...user, deviceId });
      setSessionCookie(token);
    }

    await describeHardware(deviceId!, parsed.data, ip);

    return NextResponse.json({ ok: true, deviceId });
  } catch (e) {
    return handleError(e);
  }
}
