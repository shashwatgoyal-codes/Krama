import type { MetadataRoute } from "next";

/**
 * What crawlers may look at.
 *
 * Only the landing page is public; everything behind /app is someone's
 * notes, tasks and calendar. Those already redirect without a session, so
 * a crawler would get nothing either way — this stops them knocking, and
 * stops the URLs themselves showing up as bare titles in a search index.
 *
 * The auth pages are excluded too. They aren't secret, but a sign-in form
 * is not a useful search result, and indexing /forgot invites traffic that
 * costs an email send each.
 *
 * Non-production deployments disallow everything. A stage build reachable
 * on a public hostname is exactly the kind of thing that gets indexed and
 * then outranks the real site for its own name.
 *
 * No sitemap is advertised: there is exactly one public page, and naming
 * a sitemap that does not exist is worse than naming none.
 */
export default function robots(): MetadataRoute.Robots {
  const isProd = process.env.APP_ENV === "prod";

  if (!isProd) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/app", "/app/", "/login", "/signup", "/forgot", "/api/"],
    },
  };
}
