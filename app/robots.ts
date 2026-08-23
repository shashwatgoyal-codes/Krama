import type { MetadataRoute } from "next";

/**
 * Nothing here is public, so nothing here is crawlable.
 *
 * There was briefly a landing page at / worth indexing. It is now a
 * redirect — into /app for a signed-in visitor and /login for everyone
 * else — and both of those are private. Advertising "Allow: /" would
 * point a crawler at a door that closes in its face, and would leave the
 * site's own name resolving to a sign-in form in search results.
 *
 * If a marketing page ever exists, this is the file that has to change
 * with it, and it should name that page explicitly rather than opening
 * the whole tree again.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", disallow: "/" },
  };
}
