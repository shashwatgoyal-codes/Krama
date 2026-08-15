import { describe, it, expect, beforeAll } from "vitest";

// Set before importing: the module reads it when hashing.
beforeAll(() => {
  process.env.SESSION_SECRET ||= "test-secret-long-enough-to-pass-the-check";
});

const {
  generateCode,
  hashCode,
  codesMatch,
  normaliseCode,
  isWellFormed,
  codeExpiry,
  CODE_LENGTH,
  CODE_TTL_MINUTES,
} = await import("@/lib/otp/code");

const { renderCodeImage } = await import("@/lib/otp/image");
const { codeEmail } = await import("@/lib/email/templates");

describe("generateCode", () => {
  it("is always six digits, including when it starts with zeros", () => {
    for (let i = 0; i < 300; i++) {
      const code = generateCode();
      expect(code).toMatch(/^\d{6}$/);
      expect(code.length).toBe(CODE_LENGTH);
    }
  });

  it("covers the low end of the range rather than skipping it", () => {
    // A naive implementation that formats a number without padding
    // would never produce a code below 100000.
    const codes = Array.from({ length: 4000 }, generateCode);
    expect(codes.some((c) => c.startsWith("0"))).toBe(true);
  });

  it("does not repeat itself constantly", () => {
    const codes = new Set(Array.from({ length: 500 }, generateCode));
    expect(codes.size).toBeGreaterThan(450);
  });
});

describe("hashCode", () => {
  const CODE = "123456";

  it("never stores anything resembling the code", () => {
    const hash = hashCode(CODE, "user-1", "password_reset");
    expect(hash).not.toContain(CODE);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("is stable for the same inputs", () => {
    expect(hashCode(CODE, "user-1", "password_reset")).toBe(
      hashCode(CODE, "user-1", "password_reset"),
    );
  });

  it("binds the code to one account", () => {
    // Otherwise a code mailed to one person could be typed in by another.
    expect(hashCode(CODE, "user-1", "password_reset")).not.toBe(
      hashCode(CODE, "user-2", "password_reset"),
    );
  });

  it("binds the code to one purpose", () => {
    // A verification code must not double as a password reset.
    expect(hashCode(CODE, "user-1", "email_verify")).not.toBe(
      hashCode(CODE, "user-1", "password_reset"),
    );
  });

  it("refuses to run without a server-side key", async () => {
    // A silent fallback to an empty key would leave six-digit codes
    // effectively unhashed while everything still appeared to work.
    const original = process.env.SESSION_SECRET;
    process.env.SESSION_SECRET = "";
    expect(() => hashCode(CODE, "u", "email_verify")).toThrow(/SESSION_SECRET/);
    process.env.SESSION_SECRET = original;
  });
});

describe("codesMatch", () => {
  it("accepts identical hashes and rejects different ones", () => {
    const a = hashCode("111111", "u", "email_verify");
    const b = hashCode("222222", "u", "email_verify");
    expect(codesMatch(a, a)).toBe(true);
    expect(codesMatch(a, b)).toBe(false);
  });

  it("returns false on a length mismatch instead of throwing", () => {
    // timingSafeEqual throws on unequal lengths; a truncated row in the
    // database must not become a 500.
    expect(codesMatch("abc", "abcdef")).toBe(false);
  });
});

describe("normaliseCode", () => {
  it("forgives the ways people actually type a code", () => {
    expect(normaliseCode("123 456")).toBe("123456");
    expect(normaliseCode("123-456")).toBe("123456");
    expect(normaliseCode(" 123456 ")).toBe("123456");
  });

  it("does not stretch a short code into a valid one", () => {
    expect(isWellFormed(normaliseCode("1234"))).toBe(false);
  });
});

describe("codeExpiry", () => {
  it("is ten minutes out", () => {
    const from = new Date("2026-08-15T10:00:00.000Z");
    expect(codeExpiry(from).toISOString()).toBe("2026-08-15T10:10:00.000Z");
    expect(CODE_TTL_MINUTES).toBe(10);
  });
});

describe("renderCodeImage", () => {
  it("produces a real PNG", () => {
    const png = renderCodeImage("013579");
    expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(png.subarray(12, 16).toString("ascii")).toBe("IHDR");
    expect(png.subarray(png.length - 8, png.length - 4).toString("ascii")).toBe(
      "IEND",
    );
  });

  it("declares dimensions that match the requested scale", () => {
    const png = renderCodeImage("123456", { scale: 9 });
    const width = png.readUInt32BE(16);
    const height = png.readUInt32BE(20);
    // 6 glyphs of 5*9 wide, 13px gaps, 26px padding each side.
    expect(width).toBe(26 * 2 + 6 * 45 + 5 * 13);
    expect(height).toBe(26 * 2 + 7 * 9);
  });

  it("renders the same code identically every time", () => {
    expect(renderCodeImage("246800").equals(renderCodeImage("246800"))).toBe(
      true,
    );
  });

  it("renders different codes differently", () => {
    expect(renderCodeImage("111111").equals(renderCodeImage("111112"))).toBe(
      false,
    );
  });

  it("handles every digit, including a code of all zeros", () => {
    expect(() => renderCodeImage("000000")).not.toThrow();
    expect(() => renderCodeImage("987654")).not.toThrow();
  });

  it("never carries the code as readable bytes", () => {
    // The whole point: the digits exist as pixels, not as text that
    // something could scrape out of the attachment.
    const png = renderCodeImage("428913");
    expect(png.toString("latin1")).not.toContain("428913");
  });
});

describe("the email itself", () => {
  const CODE = "428913";

  for (const purpose of ["password_reset", "email_verify"] as const) {
    it(`never writes the code anywhere in the ${purpose} email`, () => {
      const mail = codeEmail({
        purpose,
        name: "Shashwat Goyal",
        imageFilename: "krama-code.png",
      });

      // Not in the subject, not in the HTML, not in the plain-text part.
      // If any of these ever fail, the image has stopped being the only
      // copy and the whole design has quietly stopped working.
      expect(mail.subject).not.toContain(CODE);
      expect(mail.html).not.toContain(CODE);
      expect(mail.text).not.toContain(CODE);
    });

    it(`carries no six-digit sequence at all in the ${purpose} email`, () => {
      const mail = codeEmail({
        purpose,
        name: "Test",
        imageFilename: "krama-code.png",
      });
      expect(mail.text).not.toMatch(/\d{6}/);
      // The HTML has a width attribute, so digits do appear — just never
      // six of them in a row.
      expect(mail.html.replace(/width="\d+"/g, "")).not.toMatch(/\d{6}/);
    });
  }

  it("references the image by content id so the client inlines it", () => {
    const mail = codeEmail({
      purpose: "password_reset",
      name: "Test",
      imageFilename: "krama-code.png",
    });
    expect(mail.html).toContain('src="cid:krama-code"');
  });

  it("escapes the name rather than interpolating it raw", () => {
    const mail = codeEmail({
      purpose: "email_verify",
      name: "<script>alert(1)</script>",
      imageFilename: "krama-code.png",
    });
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).toContain("&lt;script&gt;");
  });

  it("greets someone with a one-word name without falling over", () => {
    const mail = codeEmail({
      purpose: "email_verify",
      name: "Shashwat",
      imageFilename: "krama-code.png",
    });
    expect(mail.html).toContain("Shashwat");
  });
});
