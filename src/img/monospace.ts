import sharp from "sharp";
import { blendOver } from "./utils.ts";
import type { Rgb } from "../types.ts";

export async function renderMonospacePage(
  sourceData: Buffer,
  sourcePage: number,
  width: number,
  height: number,
  gridWidth: number,
  gridHeight: number,
  cellSize: number,
  glyphSize: number,
  text: string,
  background: Rgb,
  transparentGlyph: Rgb,
  alphaThreshold: number,
  transparentBackground: boolean,
) {
  const rows: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
  ];

  if (!transparentBackground) {
    rows.push(
      `<rect width="100%" height="100%" fill="${rgbToHex(background)}"/>`,
    );
  }

  rows.push(
    `<g font-family="'Courier New', Courier, monospace" font-size="${glyphSize}" font-weight="400" text-rendering="geometricPrecision">`,
  );

  for (let y = 0; y < gridHeight; y += 1) {
    for (let x = 0; x < gridWidth; x += 1) {
      const sourceIndex = sourcePage + (y * gridWidth + x) * 4;
      const alpha = sourceData[sourceIndex + 3] ?? 255;

      if (alpha < alphaThreshold) {
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

      rows.push(
        `<text x="${x * cellSize}" y="${y * cellSize + glyphSize}" fill="${rgbToHex(color)}">${escapeXml(textCharFor(text, y * gridWidth + x))}</text>`,
      );
    }
  }

  rows.push("</g>", "</svg>");

  return await sharp(Buffer.from(rows.join("")))
    .ensureAlpha()
    .raw()
    .toBuffer();
}

function textCharFor(text: string, index: number) {
  return text[index % text.length] ?? " ";
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function rgbToHex(color: Rgb) {
  return `#${[color.r, color.g, color.b]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")}`;
}
