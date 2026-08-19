import { lookup } from "node:dns/promises";
import { checkUrl, isPrivateAddress } from "./ssrf";

/**
 * Fetching just enough of a page to describe it.
 *
 * Never trusted with more than it needs: a short timeout, a hard cap on
 * how much is read, a small number of redirects, and every hop checked
 * again — a public URL that 302s to 169.254.169.254 is the whole trick.
 *
 * Failure is never fatal. A link that can't be read is still saved, with
 * whatever the user typed as its title, because losing what someone
 * meant to keep is worse than showing it without a picture.
 */

export type LinkMetadata = {
  url: string;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  source: string;
};

const TIMEOUT_MS = 5_000;
const MAX_BYTES = 1_000_000;
const MAX_REDIRECTS = 3;

/** Every address a host resolves to must be public, not just the first. */
async function hostIsPublic(hostname: string): Promise<boolean> {
  const bare = hostname.replace(/^\[|\]$/g, "");

  // A literal address needs no lookup; checkUrl has already judged it.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(bare) || bare.includes(":")) {
    return !isPrivateAddress(bare);
  }

  try {
    const results = await lookup(bare, { all: true });
    if (results.length === 0) return false;
    return results.every((r) => !isPrivateAddress(r.address));
  } catch {
    // Can't resolve it — don't try to fetch it.
    return false;
  }
}

/** Reads at most MAX_BYTES, so a huge or endless body can't exhaust us. */
async function readCapped(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";

  const decoder = new TextDecoder();
  let text = "";
  let total = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel();
      break;
    }
    text += decoder.decode(value, { stream: true });
    // The metadata is in <head>; there is no reason to keep reading a
    // long article body once it has gone by.
    if (text.includes("</head>")) {
      await reader.cancel();
      break;
    }
  }

  return text;
}

function metaContent(html: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeEntities(match[1].trim()).slice(0, 400) || null;
  }
  return null;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

/** og: first, then twitter:, then the plain document title. */
export function parseMetadata(html: string, url: URL): LinkMetadata {
  const title =
    metaContent(html, [
      /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["']/i,
      /<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:title["']/i,
      /<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']*)["']/i,
      /<title[^>]*>([^<]*)<\/title>/i,
    ]) ?? null;

  const description = metaContent(html, [
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i,
    /<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:description["']/i,
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i,
  ]);

  const rawImage = metaContent(html, [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']*)["']/i,
    /<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']*)["']/i,
  ]);

  let imageUrl: string | null = null;
  if (rawImage) {
    try {
      const resolved = new URL(rawImage, url);
      // The image is rendered by the browser, so it gets the same
      // treatment: no private hosts, no exotic schemes.
      if (checkUrl(resolved.href).ok) imageUrl = resolved.href;
    } catch {
      imageUrl = null;
    }
  }

  return {
    url: url.href,
    title,
    description,
    imageUrl,
    source: url.hostname.replace(/^www\./, ""),
  };
}

export type FetchOutcome =
  | { ok: true; metadata: LinkMetadata }
  | { ok: false; reason: string; url: URL };

export async function fetchLinkMetadata(input: string): Promise<FetchOutcome> {
  const checked = checkUrl(input);
  if (!checked.ok) {
    // No URL to fall back to — this one can't even be stored.
    return { ok: false, reason: checked.reason, url: new URL("https://invalid.invalid") };
  }

  let current = checked.url;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!(await hostIsPublic(current.hostname))) {
      return { ok: false, reason: "That link points somewhere private.", url: checked.url };
    }

    let response: Response;
    try {
      response = await fetch(current, {
        // Handled by hand so every hop is re-checked. Following
        // automatically would let hop two land anywhere at all.
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          // Honest about who is asking, and asks for HTML only.
          "User-Agent": "KramaBot/1.0 (+link preview)",
          Accept: "text/html,application/xhtml+xml",
        },
      });
    } catch {
      return { ok: false, reason: "Couldn't reach that link.", url: checked.url };
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        return { ok: false, reason: "That link redirects nowhere.", url: checked.url };
      }

      let next: URL;
      try {
        next = new URL(location, current);
      } catch {
        return { ok: false, reason: "That link redirects somewhere invalid.", url: checked.url };
      }

      const nextCheck = checkUrl(next.href);
      if (!nextCheck.ok) {
        return { ok: false, reason: nextCheck.reason, url: checked.url };
      }

      current = nextCheck.url;
      continue;
    }

    if (!response.ok) {
      return { ok: false, reason: `That link returned ${response.status}.`, url: checked.url };
    }

    const type = response.headers.get("content-type") ?? "";
    if (!type.includes("html")) {
      // Not a page to describe, but still a link worth keeping.
      return {
        ok: true,
        metadata: {
          url: current.href,
          title: null,
          description: null,
          imageUrl: null,
          source: current.hostname.replace(/^www\./, ""),
        },
      };
    }

    return { ok: true, metadata: parseMetadata(await readCapped(response), current) };
  }

  return { ok: false, reason: "That link redirects too many times.", url: checked.url };
}
