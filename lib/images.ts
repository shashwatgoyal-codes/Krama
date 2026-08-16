/**
 * Deciding what an uploaded file actually is.
 *
 * The browser's Content-Type is a claim, not a fact — it is set from the
 * file extension and a user can send whatever they like. Trusting it is
 * how a file called avatar.png gets stored and later served back as
 * text/html, at which point it is a script running on your own origin
 * with your own cookies.
 *
 * So the type comes from the first few bytes, and only three formats are
 * accepted. SVG is deliberately not among them: it is a document that
 * can carry script, however much it behaves like an image.
 */

/**
 * One megabyte.
 *
 * Generous for an avatar rendered at 40px, but a photo straight off a
 * phone is often close to it and asking someone to go and shrink it
 * first is work we can absorb. At one image per account this is nothing
 * Postgres notices; if it ever became one image per anything else, it
 * would need to move to object storage rather than get a bigger number.
 */
export const AVATAR_MAX_BYTES = 1024 * 1024;

/** "1MB", "340KB" — whichever unit reads honestly at that size. */
export function formatBytes(bytes: number): string {
  const kb = bytes / 1024;
  return kb >= 1024 ? `${(kb / 1024).toFixed(kb % 1024 === 0 ? 0 : 1)}MB` : `${Math.round(kb)}KB`;
}

export type ImageKind = "image/png" | "image/jpeg" | "image/webp";

/** The type the bytes themselves say they are, or null. */
export function sniffImage(bytes: Uint8Array): ImageKind | null {
  if (bytes.length < 12) return null;

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }

  // WebP: "RIFF" .... "WEBP"
  const ascii = (from: number, to: number) =>
    String.fromCharCode(...bytes.slice(from, to));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") {
    return "image/webp";
  }

  return null;
}

export type AvatarCheck =
  | { ok: true; kind: ImageKind; bytes: Uint8Array }
  | { ok: false; reason: string };

export function checkAvatar(buffer: ArrayBuffer): AvatarCheck {
  const bytes = new Uint8Array(buffer);

  if (bytes.length === 0) return { ok: false, reason: "That file is empty." };

  if (bytes.length > AVATAR_MAX_BYTES) {
    // No resizing here — there is no image library, and pulling one in
    // to shrink an avatar is a poor trade. A hard cap with an honest
    // message is better than a dependency that decodes untrusted input.
    return {
      ok: false,
      reason: `Keep it under ${formatBytes(AVATAR_MAX_BYTES)} — this one is ${formatBytes(bytes.length)}.`,
    };
  }

  const kind = sniffImage(bytes);
  if (!kind) {
    return { ok: false, reason: "That doesn't look like a PNG, JPEG or WebP." };
  }

  return { ok: true, kind, bytes };
}
