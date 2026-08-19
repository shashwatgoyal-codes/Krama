/**
 * Deciding whether a pasted URL is safe for the server to fetch.
 *
 * This is the one feature where the app makes a network request to an
 * address a user chose, which makes it the one place server-side request
 * forgery is possible. The server sits inside a network the browser
 * can't reach — a link to http://169.254.169.254/ or http://localhost:5432
 * asks Krama to go and read something on the user's behalf that they
 * could never read themselves.
 *
 * So: only http and https, never an address that resolves inside a
 * private range, and every redirect hop re-checked rather than trusted
 * because the first one passed.
 */

/** Parsed IPv4 as four octets, or null if it isn't one. */
function parseIpv4(host: string): number[] | null {
  const parts = host.split(".");
  if (parts.length !== 4) return null;

  const octets = parts.map((p) => {
    // Reject "01" and "0x7f" style octets rather than normalising them —
    // they're a classic way to smuggle 127.0.0.1 past a naive check.
    if (!/^\d{1,3}$/.test(p)) return NaN;
    return Number(p);
  });

  if (octets.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return null;
  return octets;
}

/** Ranges that must never be reachable from a pasted link. */
function isPrivateIpv4(octets: number[]): boolean {
  const [a, b] = octets;

  if (a === 0) return true; // 0.0.0.0/8 "this network"
  if (a === 10) return true; // private
  if (a === 127) return true; // loopback
  if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
  if (a === 169 && b === 254) return true; // link-local, incl. cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 0) return true; // IETF protocol assignments
  if (a === 192 && b === 168) return true; // private
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a === 198 && b === 51) return true; // documentation
  if (a === 203 && b === 0) return true; // documentation
  if (a >= 224) return true; // multicast, reserved, broadcast

  return false;
}

function isPrivateIpv6(host: string): boolean {
  const ip = host.toLowerCase().replace(/^\[|\]$/g, "");

  if (ip === "::" || ip === "::1") return true; // unspecified, loopback

  // IPv4-mapped and IPv4-compatible forms smuggle a v4 address inside a
  // v6 one — ::ffff:127.0.0.1 is still loopback.
  const embedded = ip.match(/(?:^::ffff:|^::)(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (embedded) {
    const octets = parseIpv4(embedded[1]);
    return octets ? isPrivateIpv4(octets) : true;
  }

  if (/^f[cd][0-9a-f]{2}:/.test(ip)) return true; // fc00::/7 unique local
  if (/^fe[89ab][0-9a-f]:/.test(ip)) return true; // fe80::/10 link-local
  if (/^ff[0-9a-f]{2}:/.test(ip)) return true; // ff00::/8 multicast

  return false;
}

/** True when an already-resolved address must not be contacted. */
export function isPrivateAddress(host: string): boolean {
  const v4 = parseIpv4(host);
  if (v4) return isPrivateIpv4(v4);
  if (host.includes(":")) return isPrivateIpv6(host);
  return false;
}

export type UrlCheck =
  | { ok: true; url: URL }
  | { ok: false; reason: string };

/**
 * Everything that can be judged from the URL text alone. The DNS-level
 * check happens separately, at fetch time, because it needs the network.
 */
export function checkUrl(input: string): UrlCheck {
  let url: URL;
  try {
    // A bare "example.com" is what people actually paste.
    url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(input) ? input : `https://${input}`);
  } catch {
    return { ok: false, reason: "That doesn't look like a link." };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    // file:, gopher:, data:, and friends have no business here.
    return { ok: false, reason: "Only http and https links can be saved." };
  }

  if (url.username || url.password) {
    // Credentials in a URL would be stored and then replayed by us.
    return { ok: false, reason: "Remove the username and password from the link." };
  }

  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (!host) return { ok: false, reason: "That link has no host." };

  // Names that never leave the machine, before DNS is even consulted.
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".home.arpa")
  ) {
    return { ok: false, reason: "That link points somewhere private." };
  }

  if (isPrivateAddress(host)) {
    return { ok: false, reason: "That link points somewhere private." };
  }

  return { ok: true, url };
}
