import { describe, it, expect } from "vitest";
import { isPrivateAddress, checkUrl } from "@/lib/links/ssrf";
import { sniffImage, checkAvatar, formatBytes, AVATAR_MAX_BYTES } from "@/lib/images";

/**
 * The two places where the app accepts bytes from somewhere else.
 *
 * Explore fetches whatever URL you paste, and the avatar upload accepts
 * whatever file you choose. Both are asked to trust something a user
 * controls, which means the interesting cases are the ones designed to
 * look innocent: an address that is really the metadata endpoint, a
 * file that claims to be a PNG and is really HTML.
 *
 * These enumerate the evasions rather than the happy path, because the
 * happy path was never the risk.
 */

// "localhost" is deliberately absent: isPrivateAddress reads IP
// literals, and hostnames are refused by checkUrl, which is where the
// name-based blocklist belongs. The checkUrl suite below covers it.
describe("isPrivateAddress — loopback", () => {
  const loopback = [
    "127.0.0.1",
    "127.0.0.2",
    "127.1.1.1",
    "127.255.255.255",
    "::1",
    "0.0.0.0",
  ];

  for (const host of loopback) {
    it(`blocks ${host}`, () => {
      expect(isPrivateAddress(host)).toBe(true);
    });
  }
});

describe("isPrivateAddress — private ranges", () => {
  const privateHosts = [
    // 10.0.0.0/8
    "10.0.0.0",
    "10.0.0.1",
    "10.1.2.3",
    "10.255.255.255",
    // 172.16.0.0/12
    "172.16.0.0",
    "172.16.0.1",
    "172.20.10.5",
    "172.31.255.255",
    // 192.168.0.0/16
    "192.168.0.1",
    "192.168.1.1",
    "192.168.255.255",
  ];

  for (const host of privateHosts) {
    it(`blocks ${host}`, () => {
      expect(isPrivateAddress(host)).toBe(true);
    });
  }
});

describe("isPrivateAddress — the cloud metadata endpoint", () => {
  const linkLocal = [
    "169.254.169.254", // the one that matters
    "169.254.0.1",
    "169.254.255.255",
  ];

  for (const host of linkLocal) {
    it(`blocks ${host}`, () => {
      expect(isPrivateAddress(host)).toBe(true);
    });
  }
});

describe("isPrivateAddress — carrier-grade NAT and reserved space", () => {
  const reserved = [
    "100.64.0.0",
    "100.127.255.255",
    "224.0.0.1", // multicast
    "239.255.255.255",
  ];

  for (const host of reserved) {
    it(`blocks ${host}`, () => {
      expect(isPrivateAddress(host)).toBe(true);
    });
  }
});

describe("isPrivateAddress — addresses just outside the blocked ranges", () => {
  const publicHosts = [
    "11.0.0.1", // just past 10/8
    "172.15.255.255", // just before 172.16/12
    "172.32.0.1", // just past 172.31
    "192.167.255.255", // just before 192.168/16
    "192.169.0.1", // just past it
    "100.63.255.255", // just before the CGNAT block
    "100.128.0.1", // just past it
    "169.253.255.255", // just before link-local
    "169.255.0.1", // just past it
    "8.8.8.8",
    "1.1.1.1",
    "example.com",
    "linkedin.com",
  ];

  for (const host of publicHosts) {
    it(`allows ${host}`, () => {
      expect(isPrivateAddress(host)).toBe(false);
    });
  }
});

describe("isPrivateAddress — IPv4 wearing an IPv6 costume", () => {
  const wrapped = [
    "::ffff:127.0.0.1",
    "::ffff:10.0.0.1",
    "::ffff:192.168.1.1",
    "::ffff:169.254.169.254",
  ];

  for (const host of wrapped) {
    it(`unwraps and blocks ${host}`, () => {
      expect(isPrivateAddress(host)).toBe(true);
    });
  }

  const ipv6Private = ["fc00::1", "fd00::1", "fe80::1"];
  for (const host of ipv6Private) {
    it(`blocks the IPv6 private address ${host}`, () => {
      expect(isPrivateAddress(host)).toBe(true);
    });
  }
});

describe("checkUrl — schemes", () => {
  for (const url of ["https://example.com", "http://example.com"]) {
    it(`allows ${url}`, () => {
      expect(checkUrl(url).ok).toBe(true);
    });
  }

  const badSchemes = [
    "file:///etc/passwd",
    "ftp://example.com",
    "gopher://example.com",
    "data:text/html,<script>alert(1)</script>",
    "javascript:alert(1)",
    "about:blank",
    "chrome://settings",
  ];

  for (const url of badSchemes) {
    it(`refuses ${url}`, () => {
      expect(checkUrl(url).ok).toBe(false);
    });
  }
});

describe("checkUrl — malformed input", () => {
  const malformed = ["", " ", "not a url", "http://", "://example.com", "//"];

  for (const url of malformed) {
    it(`refuses ${JSON.stringify(url)} without throwing`, () => {
      expect(() => checkUrl(url)).not.toThrow();
      expect(checkUrl(url).ok).toBe(false);
    });
  }
});

describe("checkUrl — private hosts by name", () => {
  const blocked = [
    "http://localhost",
    "http://localhost:3000",
    "http://127.0.0.1",
    "http://127.0.0.1:8080/admin",
    "http://10.0.0.1",
    "http://192.168.1.1",
    "http://169.254.169.254/latest/meta-data/",
    "https://[::1]",
  ];

  for (const url of blocked) {
    it(`refuses ${url}`, () => {
      expect(checkUrl(url).ok).toBe(false);
    });
  }
});

describe("checkUrl — real links it must not refuse", () => {
  const allowed = [
    "https://example.com",
    "https://example.com/path",
    "https://example.com/path?query=1",
    "https://sub.example.com",
    "https://www.linkedin.com/posts/something",
    "https://news.ycombinator.com/item?id=1",
    "http://example.com:8080/page",
  ];

  for (const url of allowed) {
    it(`allows ${url}`, () => {
      expect(checkUrl(url).ok).toBe(true);
    });
  }
});

describe("sniffImage — reads the bytes, never the claim", () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const webp = new Uint8Array([
    0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50,
  ]);

  it("recognises a PNG", () => {
    expect(sniffImage(png)).toBe("image/png");
  });

  it("recognises a JPEG", () => {
    expect(sniffImage(jpeg)).toBe("image/jpeg");
  });

  it("recognises a WebP", () => {
    expect(sniffImage(webp)).toBe("image/webp");
  });

  const notImages: [string, number[]][] = [
    ["HTML", [0x3c, 0x21, 0x44, 0x4f, 0x43, 0x54, 0x59, 0x50, 0x45]],
    ["an SVG", [0x3c, 0x73, 0x76, 0x67, 0x20, 0x78, 0x6d, 0x6c]],
    ["a script", [0x3c, 0x73, 0x63, 0x72, 0x69, 0x70, 0x74, 0x3e]],
    ["a PDF", [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]],
    ["a ZIP", [0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0, 0, 0, 0, 0]],
    ["an ELF binary", [0x7f, 0x45, 0x4c, 0x46, 0, 0, 0, 0, 0, 0, 0, 0]],
    ["a GIF", [0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0, 0, 0, 0, 0]],
    ["plain text", [0x68, 0x65, 0x6c, 0x6c, 0x6f, 0, 0, 0, 0, 0, 0, 0]],
    ["nothing at all", []],
    ["a single byte", [0x89]],
    ["a truncated PNG header, too short to judge", [0x89, 0x50, 0x4e, 0x47]],
  ];

  for (const [what, bytes] of notImages) {
    it(`refuses ${what}`, () => {
      expect(sniffImage(new Uint8Array(bytes))).toBe(null);
    });
  }

  it("refuses SVG specifically, since it can carry script", () => {
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg">');
    expect(sniffImage(svg)).toBe(null);
  });

  it("refuses a PNG header that is one byte wrong", () => {
    const almost = new Uint8Array([
      0x89, 0x50, 0x4e, 0x46, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0,
    ]);
    expect(sniffImage(almost)).toBe(null);
  });
});

describe("checkAvatar", () => {
  function png(sizeBytes: number): ArrayBuffer {
    const bytes = new Uint8Array(sizeBytes);
    bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    return bytes.buffer;
  }

  it("accepts a small PNG", () => {
    expect(checkAvatar(png(1000)).ok).toBe(true);
  });

  it("accepts a PNG at exactly the limit", () => {
    expect(checkAvatar(png(AVATAR_MAX_BYTES)).ok).toBe(true);
  });

  it("refuses a PNG one byte past the limit", () => {
    expect(checkAvatar(png(AVATAR_MAX_BYTES + 1)).ok).toBe(false);
  });

  it("refuses an empty file", () => {
    expect(checkAvatar(new ArrayBuffer(0)).ok).toBe(false);
  });

  it("refuses HTML however it is named", () => {
    const html = new TextEncoder().encode("<!DOCTYPE html><html></html>");
    expect(checkAvatar(html.buffer as ArrayBuffer).ok).toBe(false);
  });
});

describe("formatBytes", () => {
  const cases: [number, RegExp][] = [
    [0, /0/],
    [1, /B/],
    [1023, /B/],
    [1024, /KB/i],
    [1_048_576, /MB/i],
    [5_242_880, /MB/i],
  ];

  for (const [bytes, shape] of cases) {
    it(`describes ${bytes} bytes`, () => {
      expect(formatBytes(bytes)).toMatch(shape);
    });
  }

  it("never returns an empty string across a wide range", () => {
    for (let bytes = 0; bytes < 10_000_000; bytes += 97_211) {
      expect(formatBytes(bytes).length).toBeGreaterThan(0);
    }
  });
});
