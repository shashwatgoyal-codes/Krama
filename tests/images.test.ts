import { describe, it, expect } from "vitest";
import { sniffImage, checkAvatar, AVATAR_MAX_BYTES, formatBytes } from "@/lib/images";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
const WEBP = new Uint8Array([
  ...[0x52, 0x49, 0x46, 0x46], 0, 0, 0, 0, ...[0x57, 0x45, 0x42, 0x50],
]);

const buf = (b: Uint8Array) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;

describe("sniffImage", () => {
  it("recognises the three formats every browser renders", () => {
    expect(sniffImage(PNG)).toBe("image/png");
    expect(sniffImage(JPEG)).toBe("image/jpeg");
    expect(sniffImage(WEBP)).toBe("image/webp");
  });

  it("refuses SVG, however much it behaves like an image", () => {
    // An SVG is a document that can carry script. Served from our own
    // origin it would run with our own cookies.
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    expect(sniffImage(svg)).toBeNull();
  });

  it("refuses HTML wearing an image's name", () => {
    const html = new TextEncoder().encode("<!doctype html><script>alert(1)</script>");
    expect(sniffImage(html)).toBeNull();
  });

  it("refuses a file too short to identify", () => {
    expect(sniffImage(new Uint8Array([0x89, 0x50]))).toBeNull();
  });

  it("is not fooled by RIFF that isn't WebP", () => {
    // A .wav also starts with RIFF.
    const wav = new Uint8Array([
      ...[0x52, 0x49, 0x46, 0x46], 0, 0, 0, 0, ...[0x57, 0x41, 0x56, 0x45],
    ]);
    expect(sniffImage(wav)).toBeNull();
  });
});

describe("checkAvatar", () => {
  it("accepts a real image and reports what it actually is", () => {
    const result = checkAvatar(buf(PNG));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.kind).toBe("image/png");
  });

  it("rejects an empty file", () => {
    expect(checkAvatar(new ArrayBuffer(0)).ok).toBe(false);
  });

  it("rejects anything over the cap", () => {
    const big = new Uint8Array(AVATAR_MAX_BYTES + 1);
    big.set(PNG.slice(0, 8));
    const result = checkAvatar(buf(big));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/MB/);
  });

  it("rejects a file whose bytes disagree with its name", () => {
    // The whole point: the browser's Content-Type is a claim, and the
    // only thing checked here is the content itself.
    const disguised = new TextEncoder().encode("<html>not an image</html>");
    expect(checkAvatar(buf(disguised)).ok).toBe(false);
  });
});

describe("the size cap", () => {
  it("is one megabyte, so a phone photo usually fits", () => {
    expect(AVATAR_MAX_BYTES).toBe(1024 * 1024);
  });

  it("accepts an image just under the cap", () => {
    const big = new Uint8Array(AVATAR_MAX_BYTES - 1);
    big.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(checkAvatar(big.buffer as ArrayBuffer).ok).toBe(true);
  });
});

describe("formatBytes", () => {
  it("uses the unit that reads honestly at that size", () => {
    expect(formatBytes(1024 * 1024)).toBe("1MB");
    expect(formatBytes(340 * 1024)).toBe("340KB");
    expect(formatBytes(1536 * 1024)).toBe("1.5MB");
  });
});
