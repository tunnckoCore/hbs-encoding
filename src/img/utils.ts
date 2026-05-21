import type { InputFormat, Rgb } from "../types.ts";

export const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

export function imageCrc32(buffer: Buffer) {
  let crc = 0xffffffff;

  for (const byte of buffer) {
    crc ^= byte;

    for (let index = 0; index < 8; index += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

export function detectInputFormat(
  input: Uint8Array | ArrayBuffer,
): InputFormat | null {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);

  if (looksLike.svg(bytes)) {
    return "svg";
  }
  if (looksLike.png(bytes)) {
    return pngHasChunk(bytes, "acTL") ? "apng" : "png";
  }
  if (looksLike.gif(bytes)) {
    return "gif";
  }
  if (looksLike.jpeg(bytes)) {
    return "jpeg";
  }

  return null;
}

export function parseHexColor(value: string): Rgb {
  const clean = value.replace(/^#/, "");
  const parsed = Number.parseInt(clean, 16);

  return {
    r: (parsed >> 16) & 255,
    g: (parsed >> 8) & 255,
    b: parsed & 255,
  };
}

export function blendOver(
  background: Rgb,
  foreground: Rgb,
  alpha: number,
): Rgb {
  if (alpha >= 255) {
    return foreground;
  }
  if (alpha <= 0) {
    return background;
  }

  const clampByte = (value: number) =>
    Math.max(0, Math.min(255, Math.round(value)));

  return {
    r: clampByte((foreground.r * alpha + background.r * (255 - alpha)) / 255),
    g: clampByte((foreground.g * alpha + background.g * (255 - alpha)) / 255),
    b: clampByte((foreground.b * alpha + background.b * (255 - alpha)) / 255),
  };
}

function pngHasChunk(bytes: Uint8Array, chunkName: string) {
  const needle = new TextEncoder().encode(chunkName);

  for (let index = 8; index <= bytes.length - 8; index += 1) {
    if (
      bytes[index] === needle[0] &&
      bytes[index + 1] === needle[1] &&
      bytes[index + 2] === needle[2] &&
      bytes[index + 3] === needle[3]
    ) {
      return true;
    }
  }

  return false;
}

export const looksLike = {
  jpeg: (bytes: Uint8Array) => bytes[0] === 0xff && bytes[1] === 0xd8,
  gif: (bytes: Uint8Array) =>
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38 &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) &&
    bytes[5] === 0x61,
  png: (bytes: Uint8Array) =>
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a,
  svg: (bytes: Uint8Array) => {
    const text = new TextDecoder("utf-8", { fatal: false })
      .decode(bytes.subarray(0, Math.min(bytes.length, 1024)))
      .trimStart()
      .toLowerCase();

    return (
      text.startsWith("<svg") ||
      (text.startsWith("<?xml") && text.includes("<svg"))
    );
  },
};
