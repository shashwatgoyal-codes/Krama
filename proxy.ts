import { NextResponse, type NextRequest } from "next/server";
// Import from ./constants, never ./token — token pulls in node:crypto,
// which doesn't exist on the Edge runtime this file runs on.
import {
  SESSION_COOKIE,
  SESSION_TTL_DAYS,
  sessionCookieOptions,
} from "@/lib/auth/constants";

/**
 * A cheap first gate: bounce anyone with no session cookie away from
 * /app before a page renders.
 *
 * It deliberately does NOT verify the session — this runs on every
 * request and a database round trip here would tax every navigation.
 * Presence of a cookie proves nothing, so every page and action still
 * calls requireUser().
 *
 * It also deliberately does NOT redirect signed-in-looking visitors away
 * from /login. That seems helpful and causes an infinite loop: a cookie
 * whose session has expired or been deleted sends /login to /app, whose
 * requireUser() sends it back to /login, forever. Only one side of this
 * can judge a session, so the pages themselves do it with the real check.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;

  if (pathname.startsWith("/app") && !token) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  const response = NextResponse.next();

  // Slide the cookie's browser-side expiry on every visit. This belongs
  // here rather than in getSessionUser() because a page render may not
  // modify cookies, but a proxy always may.
  //
  // Re-stamping without checking validity is safe: the cookie value is
  // unchanged, so a dead token stays dead and requireUser() still
  // rejects it. All this extends is how long the browser keeps sending it.
  if (token) {
    response.cookies.set(SESSION_COOKIE, token, {
      ...sessionCookieOptions,
      maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
    });
  }

  return response;
}

export const config = {
  matcher: ["/app/:path*"],
};
