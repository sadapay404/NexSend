import { NextResponse } from "next/server";
import { clearSessionCookie, getCurrentUser } from "@/lib/auth";
import { signOutDevice } from "@/lib/devices";

export async function POST(req: Request) {
  // Stamp the device as signed out so the list stops claiming "Active now".
  const user = await getCurrentUser().catch(() => null);
  if (user?.deviceId) {
    await signOutDevice(user.userId, user.deviceId).catch(() => undefined);
  }
  clearSessionCookie();
  return NextResponse.redirect(new URL("/login", req.url), 303);
}
