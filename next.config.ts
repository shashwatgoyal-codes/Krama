import type { NextConfig } from "next";

/**
 * Response headers.
 *
 * There were none. Nothing in the app was broken by that, which is
 * exactly why it went unnoticed — headers only matter once something
 * else has gone wrong, and then they matter a great deal.
 *
 * The content policy is written against what this app genuinely does,
 * not copied from a template:
 *
 *   script-src  'unsafe-inline' is required and cannot be removed
 *               without a nonce: the theme is applied by a blocking
 *               inline script in <head>, which exists so the page does
 *               not flash the wrong colour before hydration.
 *   style-src   the accent and note tints are written as an inline
 *               <style>, because a dark value has to live behind a
 *               media query that an inline style attribute cannot
 *               express.
 *   img-src     https: because Explore renders preview images from
 *               whatever site you saved, and data: for the avatar
 *               resize which happens on a canvas before upload.
 *   connect-src 'self' only. Nothing here talks to another origin from
 *               the browser; the link fetch and the mail send both
 *               happen on the server.
 *   frame-ancestors  nothing may frame this. It is a planner behind a
 *               login, and there is no reason to embed it anywhere.
 */
/**
 * Development needs two things production must never have.
 *
 * React's development build uses eval() to reconstruct stack traces
 * across environments, and hot reload talks to the dev server over a
 * WebSocket. Both are absent from a production build, so the loosening
 * is scoped to the one place it is required rather than left in for
 * convenience — a CSP that permits eval everywhere is barely a CSP.
 */
const dev = process.env.NODE_ENV === "development";

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  `connect-src 'self'${dev ? " ws: wss:" : ""}`,
  "form-action 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  // Meaningless over http, and it would force the dev server to https.
  ...(dev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const nextConfig: NextConfig = {
  // Nothing gains from announcing the framework and version.
  poweredByHeader: false,

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          // Belt and braces alongside frame-ancestors, for anything that
          // still reads the older header.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Send the origin to other sites, the full path only to our
          // own. A task title should not travel in a Referer header.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
          // Two years, subdomains included. Harmless over http in
          // development: browsers ignore it on a non-secure origin.
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
