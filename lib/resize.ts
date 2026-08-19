/**
 * Shrinking an image in the browser before it is uploaded.
 *
 * Done here rather than on the server for one reason: decoding untrusted
 * images server-side means pulling in a native image library and running
 * it over whatever anyone sends, which is a large attack surface for an
 * avatar. The browser already has a decoder, it is already sandboxed,
 * and it is the machine that has the file.
 *
 * The server still checks everything it checked before. This only means
 * an honest 4MB photo from a phone arrives as a 60KB square instead of
 * being refused for being a 4MB photo from a phone.
 */

/** Rendered at 40px, so 256 covers retina with room to spare. */
export const AVATAR_EDGE = 256;

export type ResizeResult =
  | { ok: true; file: File; wasResized: boolean }
  | { ok: false; reason: string };

export async function resizeAvatar(file: File): Promise<ResizeResult> {
  // A format the canvas can't decode should fail here rather than after
  // a pointless round trip; the server rejects it either way.
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
    return { ok: false, reason: "That doesn't look like a PNG, JPEG or WebP." };
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return { ok: false, reason: "That image couldn't be read." };
  }

  const { width, height } = bitmap;
  const edge = Math.min(width, height);

  // Already small and square enough to leave alone.
  if (edge <= AVATAR_EDGE && file.size <= 200 * 1024) {
    bitmap.close();
    return { ok: true, file, wasResized: false };
  }

  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_EDGE;
  canvas.height = AVATAR_EDGE;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    return { ok: false, reason: "Couldn't process that image." };
  }

  // Centre-crop to a square, then scale. Cropping rather than squashing
  // because an avatar is displayed in a circle, and a squashed face is
  // worse than a cropped one.
  const sx = (width - edge) / 2;
  const sy = (height - edge) / 2;
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, sx, sy, edge, edge, 0, 0, AVATAR_EDGE, AVATAR_EDGE);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    // PNG rather than WebP: every browser can encode it, and at 256px
    // the size difference is not worth a compatibility question.
    canvas.toBlob(resolve, "image/png"),
  );
  if (!blob) return { ok: false, reason: "Couldn't process that image." };

  return {
    ok: true,
    file: new File([blob], "avatar.png", { type: "image/png" }),
    wasResized: true,
  };
}
