import sharp from "sharp";
import {
  attributesToTraits,
  decodeHbs,
  encodeHbs,
  HBS_METADATA_TRAITS_KEY,
  type DecodeHbsImageOptions,
  type DecodeHbsResult,
  type EncodeHbsImageOptions,
  type HbsImageBitmap,
  type HbsImageResult,
  type HbsPayload,
  type InputFormat,
  type Rgb,
} from "../index.ts";
import {
  blendOver,
  detectInputFormat,
  imageCrc32,
  parseHexColor,
  PNG_SIGNATURE,
} from "./utils.ts";
import { renderMonospacePage } from "./monospace.ts";

export const DEFAULT_OPTIONS = {
  cell: 8,
  scale: 1,
  size: 1,
  gap: 1,
  background: "#000",
  transparentGlyph: "#fff",
  alphaThreshold: 12,
  textMode: "bitmap",
} as const;

function glyphFor(glyphs: HbsImageBitmap, text: string, index: number) {
  const char = text[index % text.length] ?? " ";

  return glyphs[char] ?? glyphs[char.toLowerCase()] ?? glyphs[" "];
}

function mimeTypeForFormat(format: InputFormat) {
  if (format === "jpeg") {
    return "image/jpeg";
  }
  if (format === "svg") {
    return "image/svg+xml";
  }
  if (format === "gif") {
    return "image/gif";
  }

  return "image/png";
}

function textFromInputBytes(bytes: Uint8Array, format: InputFormat) {
  return encodeHbs({
    data_uri: `data:${mimeTypeForFormat(format)};base64,${Buffer.from(bytes).toString("base64")}`,
  });
}

function stampGlyph(
  output: Buffer,
  width: number,
  glyph: readonly string[],
  left: number,
  top: number,
  color: Rgb,
  glyphSize: number,
) {
  const sourceHeight = glyph.length;
  const sourceWidth = Math.max(...glyph.map((row) => row.length));

  for (let y = 0; y < glyphSize; y += 1) {
    const sourceY = Math.min(
      sourceHeight - 1,
      Math.floor((y * sourceHeight) / glyphSize),
    );

    const row = glyph[sourceY] ?? "";

    for (let x = 0; x < glyphSize; x += 1) {
      const sourceX = Math.min(
        sourceWidth - 1,
        Math.floor((x * sourceWidth) / glyphSize),
      );

      if (row[sourceX] !== "1") {
        continue;
      }

      const dest = ((top + y) * width + left + x) * 4;
      output[dest] = color.r;
      output[dest + 1] = color.g;
      output[dest + 2] = color.b;
      output[dest + 3] = 255;
    }
  }
}

function stampCharMarker(
  output: Buffer,
  width: number,
  height: number,
  left: number,
  top: number,
  char: string,
  glyphSize: number,
  gap: number,
) {
  if (gap <= 0 || left + glyphSize >= width) {
    return;
  }

  const code = char.codePointAt(0) ?? 32;

  for (let bit = 0; bit < 8 && top + bit < height; bit += 1) {
    const value = (code >> bit) & 1;
    const dest = ((top + bit) * width + left + glyphSize) * 4;

    output[dest] = value ? 255 : 0;
    output[dest + 1] = value ? 255 : 0;
    output[dest + 2] = value ? 255 : 0;
    output[dest + 3] = 255;
  }
}

function makePngChunk(type: string, data: Buffer) {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(imageCrc32(Buffer.concat([typeBuffer, data])), 0);

  return Buffer.concat([length, typeBuffer, data, crc]);
}

function addPngTextChunk(png: Buffer, keyword: string, text: string) {
  if (!png.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return png;
  }

  const chunk = makePngChunk(
    "iTXt",
    Buffer.concat([
      Buffer.from(keyword, "latin1"),
      Buffer.from([0]),
      Buffer.from([0]),
      Buffer.from([0]),
      Buffer.from([0]),
      Buffer.from([0]),
      Buffer.from(text, "utf8"),
    ]),
  );
  let offset = 8;

  while (offset + 12 <= png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.subarray(offset + 4, offset + 8).toString("ascii");

    if (type === "IEND") {
      return Buffer.concat([
        png.subarray(0, offset),
        chunk,
        png.subarray(offset),
      ]);
    }

    offset += 12 + length;
  }

  return png;
}

function trimRightBottom(
  output: Buffer,
  width: number,
  height: number,
  pages: number,
  trim: number,
) {
  if (trim <= 0) {
    return { data: output, width, height };
  }

  const nextWidth = width - trim;
  const nextHeight = height - trim;
  const data = Buffer.alloc(nextWidth * nextHeight * pages * 4);

  for (let page = 0; page < pages; page += 1) {
    const sourcePage = page * width * height * 4;
    const targetPage = page * nextWidth * nextHeight * 4;

    for (let y = 0; y < nextHeight; y += 1) {
      output.copy(
        data,
        targetPage + y * nextWidth * 4,
        sourcePage + y * width * 4,
        sourcePage + (y * width + nextWidth) * 4,
      );
    }
  }
  return { data, width: nextWidth, height: nextHeight };
}

function bitmapDecoderFor(bitmap: HbsImageBitmap) {
  const decoder = new Map<string, string>();

  for (const [char, rows] of Object.entries(bitmap)) {
    const key = rows.join("");

    if (!decoder.has(key)) {
      decoder.set(key, char);
    }
  }

  return decoder;
}

function isInk(r: number, g: number, b: number, a: number) {
  return a >= 16 && r + g + b > 20;
}

function decodeTextFromPixels(
  data: Buffer,
  width: number,
  height: number,
  options: Required<
    Pick<DecodeHbsImageOptions, "bitmap" | "cell" | "size" | "gap">
  >,
) {
  const decoder = bitmapDecoderFor(options.bitmap);
  const glyphSize = Math.max(1, Math.ceil((options.cell - 1) * options.size));
  const cellSize = glyphSize + options.gap;
  const gridWidth = Math.floor((width + options.gap) / cellSize);
  const gridHeight = Math.floor((height + options.gap) / cellSize);
  let text = "";

  for (let y = 0; y < gridHeight; y += 1) {
    for (let x = 0; x < gridWidth; x += 1) {
      let key = "";

      for (let glyphY = 0; glyphY < 7; glyphY += 1) {
        const startY = Math.floor((glyphY * glyphSize) / 7);
        const endY = Math.max(
          startY + 1,
          Math.floor(((glyphY + 1) * glyphSize) / 7),
        );

        for (let glyphX = 0; glyphX < 7; glyphX += 1) {
          const startX = Math.floor((glyphX * glyphSize) / 7);
          const endX = Math.max(
            startX + 1,
            Math.floor(((glyphX + 1) * glyphSize) / 7),
          );
          let ink = false;

          for (let sampleY = startY; sampleY < endY; sampleY += 1) {
            for (let sampleX = startX; sampleX < endX; sampleX += 1) {
              const index =
                ((y * cellSize + sampleY) * width + x * cellSize + sampleX) * 4;

              if (
                isInk(
                  data[index],
                  data[index + 1],
                  data[index + 2],
                  data[index + 3],
                )
              ) {
                ink = true;
              }
            }
          }

          key += ink ? "1" : "0";
        }
      }

      const markerX = x * cellSize + glyphSize;
      let markerCode = 0;
      let hasMarker = false;

      if (options.gap > 0 && markerX < width) {
        for (let bit = 0; bit < 8 && y * cellSize + bit < height; bit += 1) {
          const index = ((y * cellSize + bit) * width + markerX) * 4;
          const white =
            data[index] > 240 &&
            data[index + 1] > 240 &&
            data[index + 2] > 240 &&
            data[index + 3] >= 240;

          if (white) {
            markerCode |= 1 << bit;
            hasMarker = true;
          }
        }
      }

      text += hasMarker
        ? String.fromCharCode(markerCode)
        : (decoder.get(key) ?? " ");
    }
  }

  return text;
}

async function blankPngSource(textLength: number) {
  const size = Math.max(1, Math.ceil(Math.sqrt(textLength)));

  return await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .png()
    .toBuffer();
}

export async function encodeHbsImage(
  payload: HbsPayload,
  options: EncodeHbsImageOptions,
): Promise<HbsImageResult> {
  const text = encodeHbs(payload, options);
  const input = options.baseImage ?? (await blankPngSource(text.length));

  return renderHbsImage(input, { ...options, text });
}

function decodeOSeparatedHbs(text: string, options: DecodeHbsImageOptions) {
  const prefix = options.prefix ?? "hbs2";
  let start = text.indexOf(`${prefix}o`);

  while (start !== -1) {
    const frame = text.slice(start);
    const header = frame.match(/^hbs2o([0-9a-f]+)o(\d+)o/i);

    if (header?.[1] && header[2]) {
      const integrity = header[1];
      const expectedLength = Number.parseInt(header[2], 10);
      const payloadStart = header[0].length;
      const payload = frame.slice(payloadStart, payloadStart + expectedLength);
      const checksumStart = payloadStart + expectedLength + 1;
      const checksum = frame.slice(
        checksumStart,
        checksumStart + (options.checksumSize ?? 8),
      );
      const normalized = `${prefix}.${integrity}.${expectedLength}.${payload}.${checksum}`;
      const decoded = decodeHbs(normalized, options);

      if (decoded) {
        return decoded;
      }
    }

    start = text.indexOf(`${prefix}o`, start + 1);
  }

  return null;
}

function decodeHbsFromImageText(text: string, options: DecodeHbsImageOptions) {
  let fallback: DecodeHbsResult | null = null;
  let start = text.indexOf(`${options.prefix ?? "hbs2"}.`);

  while (start !== -1) {
    const decoded = decodeHbs(text.slice(start), options);

    if (decoded?.valid) {
      return decoded;
    }

    fallback ??= decoded;
    start = text.indexOf(`${options.prefix ?? "hbs2"}.`, start + 1);
  }

  return fallback ?? decodeOSeparatedHbs(text, options);
}

function decodeImageWithGeometry(
  data: Buffer,
  width: number,
  height: number,
  options: DecodeHbsImageOptions,
) {
  const text = decodeTextFromPixels(data, width, height, {
    cell: DEFAULT_OPTIONS.cell,
    size: DEFAULT_OPTIONS.size,
    gap: DEFAULT_OPTIONS.gap,
    ...options,
  });

  return decodeHbsFromImageText(text, options);
}

function candidateDecodeOptions(
  width: number,
  height: number,
  options: DecodeHbsImageOptions,
) {
  if (
    options.cell !== undefined ||
    options.size !== undefined ||
    options.gap !== undefined
  ) {
    return [];
  }

  const candidates: DecodeHbsImageOptions[] = [];
  const seen = new Set<string>();
  const cells = [DEFAULT_OPTIONS.cell, 8, 9, 10, 11, 12, 14, 16];
  const sizes = [DEFAULT_OPTIONS.size, 0.5, 1, 1.25, 1.5, 1.75, 2, 3, 4, 8];
  const gaps = [DEFAULT_OPTIONS.gap, 1, 2, 3, 4, 5, 6, 8, 10, 12];

  for (const cell of cells) {
    for (const size of sizes) {
      const glyphSize = Math.max(1, Math.ceil((cell - 1) * size));

      for (const gap of gaps) {
        const cellSize = glyphSize + gap;

        if (
          cellSize <= 0 ||
          (width + gap) % cellSize !== 0 ||
          (height + gap) % cellSize !== 0
        ) {
          continue;
        }

        const key = `${cell}:${size}:${gap}`;

        if (!seen.has(key)) {
          seen.add(key);
          candidates.push({ ...options, cell, size, gap });
        }
      }
    }
  }

  return candidates;
}

function decodedScore(decoded: DecodeHbsResult | null) {
  if (!decoded) {
    return -1;
  }

  return (
    (decoded.valid ? 1_000_000 : 0) +
    (!decoded.truncated ? 10_000 : 0) +
    Object.keys(decoded.payload).length * 100 +
    decoded.actualLength
  );
}

export async function decodeHbsImage(
  image: Uint8Array | ArrayBuffer,
  options: DecodeHbsImageOptions,
): Promise<DecodeHbsResult | null> {
  const input = image instanceof Uint8Array ? image : new Uint8Array(image);
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let fallback = decodeImageWithGeometry(
    data,
    info.width,
    info.height,
    options,
  );

  if (fallback?.valid) {
    return fallback;
  }

  for (const candidate of candidateDecodeOptions(
    info.width,
    info.height,
    options,
  )) {
    const decoded = decodeImageWithGeometry(
      data,
      info.width,
      info.height,
      candidate,
    );

    if (decoded?.valid) {
      return decoded;
    }

    if (decodedScore(decoded) > decodedScore(fallback)) {
      fallback = decoded;
    }
  }

  return fallback;
}

export async function renderHbsImage(
  input: Uint8Array | ArrayBuffer,
  options: EncodeHbsImageOptions,
): Promise<HbsImageResult> {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const format = detectInputFormat(bytes);

  if (!format) {
    throw new Error("Unsupported image format");
  }

  const sharpOptions = format === "gif" ? { pages: -1 } : undefined;
  const metadata = await sharp(bytes, sharpOptions).metadata();
  const isAnimatedGif = format === "gif" && (metadata.pages ?? 1) > 1;
  const pages = isAnimatedGif ? (metadata.pages ?? 1) : 1;
  const sourceWidth = metadata.width ?? 0;
  const sourceHeight = isAnimatedGif
    ? (metadata.pageHeight ?? metadata.height ?? 0)
    : (metadata.height ?? 0);

  if (sourceWidth <= 0 || sourceHeight <= 0) {
    throw new Error("Input image dimensions could not be read");
  }

  const resolvedOptions = { ...DEFAULT_OPTIONS, ...options };
  const glyphSize = Math.max(
    1,
    Math.ceil((resolvedOptions.cell - 1) * resolvedOptions.size),
  );
  const cellSize = glyphSize + resolvedOptions.gap;
  const gridWidth = Math.max(
    1,
    Math.round(sourceWidth * resolvedOptions.scale),
  );
  const gridHeight = Math.max(
    1,
    Math.round(sourceHeight * resolvedOptions.scale),
  );
  const outputWidth = gridWidth * cellSize;
  const outputHeight = gridHeight * cellSize;
  const glyphs = resolvedOptions.bitmap;
  const backgroundValue =
    options.background === undefined && resolvedOptions.textMode === "monospace"
      ? "transparent"
      : resolvedOptions.background;

  const isTransparent = String(backgroundValue).toLowerCase() === "transparent";
  const background = isTransparent
    ? parseHexColor(DEFAULT_OPTIONS.background)
    : parseHexColor(backgroundValue);
  const transparentGlyph = parseHexColor(resolvedOptions.transparentGlyph);
  const text = options.text ?? textFromInputBytes(bytes, format);

  const sourceData = (
    await sharp(bytes, sharpOptions)
      .ensureAlpha()
      .resize({
        width: gridWidth,
        height: gridHeight,
        fit: "fill",
        kernel: sharp.kernel.nearest,
      })
      .raw()
      .toBuffer({ resolveWithObject: true })
  ).data;

  const output = Buffer.alloc(outputWidth * outputHeight * pages * 4);

  for (let index = 0; index < output.length; index += 4) {
    output[index] = background.r;
    output[index + 1] = background.g;
    output[index + 2] = background.b;
    output[index + 3] = isTransparent ? 0 : 255;
  }

  if (resolvedOptions.textMode === "monospace") {
    for (let page = 0; page < pages; page += 1) {
      const sourcePage = page * gridWidth * gridHeight * 4;
      const outputPage = page * outputWidth * outputHeight * 4;
      const pageData = await renderMonospacePage(
        sourceData,
        sourcePage,
        outputWidth,
        outputHeight,
        gridWidth,
        gridHeight,
        cellSize,
        glyphSize,
        text,
        background,
        transparentGlyph,
        resolvedOptions.alphaThreshold,
        isTransparent,
      );

      pageData.copy(output, outputPage);
    }
  } else {
    for (let page = 0; page < pages; page += 1) {
      const sourcePage = page * gridWidth * gridHeight * 4;
      const outputPage = page * outputWidth * outputHeight * 4;

      for (let y = 0; y < gridHeight; y += 1) {
        for (let x = 0; x < gridWidth; x += 1) {
          const sourceIndex = sourcePage + (y * gridWidth + x) * 4;
          const alpha = sourceData[sourceIndex + 3] ?? 255;

          if (alpha < resolvedOptions.alphaThreshold) {
            continue;
          }

          const color =
            alpha < 255
              ? transparentGlyph
              : blendOver(
                  background,
                  {
                    r: sourceData[sourceIndex] ?? 0,
                    g: sourceData[sourceIndex + 1] ?? 0,
                    b: sourceData[sourceIndex + 2] ?? 0,
                  },
                  alpha,
                );

          const textIndex = y * gridWidth + x;
          const pageOutput = output.subarray(outputPage);

          stampGlyph(
            pageOutput,
            outputWidth,
            glyphFor(glyphs, text, textIndex),
            x * cellSize,
            y * cellSize,
            color,
            glyphSize,
          );
          stampCharMarker(
            pageOutput,
            outputWidth,
            outputHeight,
            x * cellSize,
            y * cellSize,
            text[textIndex % text.length] ?? " ",
            glyphSize,
            resolvedOptions.gap,
          );
        }
      }
    }
  }

  const trimmed = trimRightBottom(
    output,
    outputWidth,
    outputHeight,
    pages,
    resolvedOptions.gap,
  );

  const wantsGif =
    options.outputFormat === "gif" || format === "gif" || format === "apng";

  if (wantsGif) {
    const frames: Buffer[] = [];

    for (let page = 0; page < pages; page += 1) {
      const frame = trimmed.data.subarray(
        page * trimmed.width * trimmed.height * 4,
        (page + 1) * trimmed.width * trimmed.height * 4,
      );

      frames.push(
        await sharp(frame, {
          raw: { width: trimmed.width, height: trimmed.height, channels: 4 },
        })
          .png({ palette: true, effort: 10, compressionLevel: 9 })
          .toBuffer(),
      );
    }

    const image = await sharp(frames, { join: { animated: true } })
      .gif({ effort: 10, loop: metadata.loop ?? 0, delay: metadata.delay })
      .toBuffer();

    return {
      image,
      mimeType: "image/gif",
      sourceWidth,
      sourceHeight,
      gridWidth,
      gridHeight,
      outputWidth: trimmed.width,
      outputHeight: trimmed.height,
    };
  }

  let image = await sharp(trimmed.data, {
    raw: { width: trimmed.width, height: trimmed.height, channels: 4 },
  })
    .png({ palette: true, effort: 10, compressionLevel: 9 })
    .toBuffer();

  const traits =
    options.traits ??
    (options.attributes ? attributesToTraits(options.attributes) : null);

  if (traits) {
    image = addPngTextChunk(image, HBS_METADATA_TRAITS_KEY, encodeHbs(traits));
  }

  return {
    image,
    mimeType: "image/png",
    sourceWidth,
    sourceHeight,
    gridWidth,
    gridHeight,
    outputWidth: trimmed.width,
    outputHeight: trimmed.height,
  };
}
