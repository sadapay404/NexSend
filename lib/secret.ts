/**
 * Shared secret helper — used by both the Node runtime (auth) and the Edge
 * middleware, so keep this file free of Node-only imports.
 */
export const DEV_SECRET = "nexsend-dev-only-secret-change-in-production-32";

export function getSecretKey(): Uint8Array {
  return new TextEncoder().encode(process.env.JWT_SECRET || DEV_SECRET);
}
