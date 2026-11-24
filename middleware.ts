import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { getSecretKey } from "@/lib/secret";

const PUBLIC_PATHS = [
  "/login",
  "/api/auth/login",
  "/api/health",
  "/api/health/storage",
  "/favicon.ico",
  "/logo.jpg",
  "/manifest.webmanifest",
  "/icon-",
  "/apple-touch-icon.png",
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = req.cookies.get("nexsend_session")?.value;
  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Verify JWT (Edge-compatible with jose)
  try {
    await jwtVerify(token, getSecretKey());
    return NextResponse.next();
  } catch {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|logo.jpg|manifest.webmanifest|icon-|apple-touch-icon).*)",
  ],
};
