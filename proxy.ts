import { NextResponse, type NextRequest } from "next/server";
// Import from ./constants, never ./token — token pulls in node:crypto,
// which doesn't exist on the Edge runtime this file runs on.
import { SESSION_COOKIE } from "@/lib/auth/constants";

/**
 * A cheap first gate: bounce anyone without a session cookie away from
 * /app before a page ever renders.
 *
 * This deliberately does NOT verify the session — the proxy runs on
 * every request and a database round trip here would tax every
 * navigation. Presence of a cookie proves nothing, so every page and
 * action still calls requireUser(). This only saves a wasted render.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasCookie = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  if (pathname.startsWith("/app") && !hasCookie) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // So we can send them back where they were headed.
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Already signed in? Skip the sign-in screen.
  if ((pathname === "/login" || pathname === "/signup") && hasCookie) {
    const url = request.nextUrl.clone();
    url.pathname = "/app";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*", "/login", "/signup"],
};
