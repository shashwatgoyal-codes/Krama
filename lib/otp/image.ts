import { deflateSync } from "node:zlib";

/**
 * Renders a one-time code as a PNG.
 *
 * The code is never written as text anywhere in the email — not in the
 * body, not in the subject, not in the plain-text part. Anything that
 * reads an inbox programmatically (a forwarding rule, a leaked mail
 * archive, an over-eager assistant) gets a picture and nothing else.
 *
 * Written by hand rather than with an image library because the only
 * thing needed is digits on a background, and a native dependency would
 * mean CI has to build binaries to run the tests.
 *
 * A note on the tradeoff, since it is a real one: a code that exists
 * only as an image cannot be read by a screen reader, and cannot be
 * copied. That is the point, and it is also a genuine accessibility
 * cost. See sendCode() for how the email handles people who cannot see
 * the picture.
 */

/** 5x7 bitmaps, one row per string, '1' = ink. */
const GLYPHS: Record<string, string[]> = {
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  "3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
};

const GLYPH_W = 5;
const GLYPH_H = 7;

/**
 * Deliberately light on both light and dark backgrounds: the image is a
 * card with its own opaque background, so it reads the same whatever the
 * mail client puts behind it.
 */
const PAPER: RGB = [253, 250, 244];
const INK: RGB = [28, 25, 23];
const EDGE: RGB = [223, 214, 197];
const SPECKLE: RGB = [150, 138, 118];

type RGB = [number, number, number];

/** Small deterministic PRNG, so a given code always renders identically. */
function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

class Canvas {
  readonly data: Uint8Array;

  constructor(
    readonly width: number,
    readonly height: number,
    fill: RGB,
  ) {
    this.data = new Uint8Array(width * height * 4);
    for (let i = 0; i < width * height; i++) {
      this.data[i * 4] = fill[0];
      this.data[i * 4 + 1] = fill[1];
      this.data[i * 4 + 2] = fill[2];
      this.data[i * 4 + 3] = 255;
    }
  }

  /** Alpha-blends a pixel. Out-of-bounds writes are dropped, not wrapped. */
  set(x: number, y: number, [r, g, b]: RGB, alpha = 1): void {
    const px = Math.round(x);
    const py = Math.round(y);
    if (px < 0 || py < 0 || px >= this.width || py >= this.height) return;

    const i = (py * this.width + px) * 4;
    const a = Math.max(0, Math.min(1, alpha));
    this.data[i] = this.data[i] * (1 - a) + r * a;
    this.data[i + 1] = this.data[i + 1] * (1 - a) + g * a;
    this.data[i + 2] = this.data[i + 2] * (1 - a) + b * a;
  }

  rect(x: number, y: number, w: number, h: number, colour: RGB, alpha = 1) {
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) this.set(x + dx, y + dy, colour, alpha);
    }
  }
}

// ---------------------------------------------------------------- PNG

function crcTable(): Uint32Array {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
}

const CRC = crcTable();

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Buffer {
  const out = Buffer.alloc(data.length + 12);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  Buffer.from(data).copy(out, 8);
  const forCrc = out.subarray(4, 8 + data.length);
  out.writeUInt32BE(crc32(forCrc), 8 + data.length);
  return out;
}

function encodePng(canvas: Canvas): Buffer {
  const { width, height, data } = canvas;

  // Each scanline is prefixed with its filter type; 0 means "none",
  // which compresses well enough for flat artwork like this.
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    const at = y * (width * 4 + 1);
    raw[at] = 0;
    Buffer.from(data.subarray(y * width * 4, (y + 1) * width * 4)).copy(
      raw,
      at + 1,
    );
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // adaptive filtering
  ihdr[12] = 0; // no interlace

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", new Uint8Array(0)),
  ]);
}

// ------------------------------------------------------------- drawing

export type CodeImageOptions = {
  /** Pixels per glyph cell. */
  scale?: number;
  /** Speckle and baseline wobble, to frustrate casual OCR. */
  noise?: boolean;
};

export function renderCodeImage(
  code: string,
  { scale = 9, noise = true }: CodeImageOptions = {},
): Buffer {
  const digits = [...code];
  const pad = 26;
  const gap = 13;
  const cellW = GLYPH_W * scale;
  const cellH = GLYPH_H * scale;

  const width = pad * 2 + digits.length * cellW + (digits.length - 1) * gap;
  const height = pad * 2 + cellH;

  const canvas = new Canvas(width, height, PAPER);
  // Seeded from the code so the same code always produces the same
  // image — otherwise a test could only assert "it's a PNG".
  const rand = rng([...code].reduce((a, c) => a * 31 + c.charCodeAt(0), 7));

  // border
  canvas.rect(0, 0, width, 2, EDGE);
  canvas.rect(0, height - 2, width, 2, EDGE);
  canvas.rect(0, 0, 2, height, EDGE);
  canvas.rect(width - 2, 0, 2, height, EDGE);

  if (noise) {
    const speckles = Math.round(width * height * 0.012);
    for (let i = 0; i < speckles; i++) {
      canvas.set(rand() * width, rand() * height, SPECKLE, 0.16 + rand() * 0.2);
    }
  }

  digits.forEach((digit, index) => {
    const glyph = GLYPHS[digit];
    if (!glyph) return;

    const x0 = pad + index * (cellW + gap);
    // A little vertical drift per digit, so the baseline isn't a
    // straight line for a segmenter to lock onto.
    const drift = noise ? Math.round((rand() - 0.5) * scale * 1.1) : 0;

    for (let gy = 0; gy < GLYPH_H; gy++) {
      for (let gx = 0; gx < GLYPH_W; gx++) {
        if (glyph[gy][gx] !== "1") continue;
        canvas.rect(x0 + gx * scale, pad + drift + gy * scale, scale, scale, INK);
      }
    }
  });

  if (noise) {
    // Two shallow waves through the digits. Thin enough to read past,
    // enough to break a clean threshold-and-segment pass.
    for (let pass = 0; pass < 2; pass++) {
      const amp = height * 0.13;
      const phase = rand() * Math.PI * 2;
      const mid = height * (0.4 + pass * 0.24);
      for (let x = 2; x < width - 2; x++) {
        const y = mid + Math.sin(x / (width / 6) + phase) * amp;
        canvas.set(x, y, INK, 0.32);
        canvas.set(x, y + 1, INK, 0.16);
      }
    }
  }

  return encodePng(canvas);
}
