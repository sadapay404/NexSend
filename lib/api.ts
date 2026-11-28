import { getCurrentUser, type SessionPayload } from "./auth";
import { isDeviceRevoked } from "./devices";
import { NextResponse } from "next/server";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export async function requireUser(): Promise<SessionPayload> {
  const user = await getCurrentUser();
  if (!user) throw new ApiError("Not authenticated", 401);
  // The session may have been signed out from another device in Settings.
  if (await isDeviceRevoked(user.deviceId, user.iat)) {
    throw new ApiError("Signed out on this device", 401);
  }
  return user;
}

export async function requireAdmin(): Promise<SessionPayload> {
  const user = await requireUser();
  if (user.role !== "admin") throw new ApiError("Admin only", 403);
  return user;
}

export function handleError(e: unknown) {
  if (e instanceof ApiError) {
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
  console.error(e);
  return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
}
