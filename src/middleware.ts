import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const SESSION_COOKIE = "briefly_session";
const PUBLIC_PAGES = ["/login", "/register"];

async function hasValidSignature(token: string | undefined): Promise<boolean> {
  const secret = process.env.AUTH_SECRET;
  if (!token || !secret) return false;
  try {
    await jwtVerify(token, new TextEncoder().encode(secret), { algorithms: ["HS256"] });
    return true;
  } catch {
    return false;
  }
}

/**
 * Cheap edge gate: signature check only, so unauthenticated visitors never reach page code.
 * The authoritative check (user exists, token version) happens server-side in lib/auth.ts.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const signedIn = await hasValidSignature(req.cookies.get(SESSION_COOKIE)?.value);
  const isPublicPage = PUBLIC_PAGES.includes(pathname);

  if (!signedIn && !isPublicPage) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  // `?stale=1` means the cookie is validly signed but its user/session was revoked — let them re-authenticate.
  if (signedIn && isPublicPage && !req.nextUrl.searchParams.has("stale")) {
    const url = req.nextUrl.clone();
    url.pathname = "/briefing/markets";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // API routes authenticate themselves (and cron/auth endpoints must stay reachable).
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest).*)"],
};
