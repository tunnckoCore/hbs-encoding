export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

export type Rgb = { r: number; g: number; b: number };
export type InputFormat = "png" | "apng" | "jpeg" | "gif" | "svg";

export type HbsPayload = Record<string, string | number | null | boolean>;
export type HbsDigest = (input: Uint8Array) => Uint8Array;

export type HbsAttribute = Prettify<
  | {
      trait_type: string;
      value: string | number;
    }
  | {
      trait_type: string;
      trait_value: string | number;
    }
  | {
      traitType: string;
      traitValue: string | number;
    }
>;

export type HbsImageBitmap = Readonly<Record<string, readonly string[]>>;

export type EncodeHbsImageOptions = EncodeHbsOptions & {
  bitmap: HbsImageBitmap;
  baseImage?: Uint8Array | ArrayBuffer;
  cell?: number;
  scale?: number;
  size?: number;
  gap?: number;
  background?: string;
  transparentGlyph?: string;
  alphaThreshold?: number;
  text?: string;
  textMode?: "bitmap" | "monospace";
  traits?: HbsPayload;
  attributes?: HbsAttribute[];
  outputFormat?: "png" | "gif";
};

export type DecodeHbsImageOptions = DecodeHbsOptions & {
  bitmap: HbsImageBitmap;
  cell?: number;
  size?: number;
  gap?: number;
};

export type HbsImageOptions = EncodeHbsImageOptions;

export type HbsImageResult = {
  image: Buffer;
  mimeType: "image/png" | "image/gif";
  sourceWidth: number;
  sourceHeight: number;
  gridWidth: number;
  gridHeight: number;
  outputWidth: number;
  outputHeight: number;
};

export type WidenDefaultOptions<T> = {
  -readonly [Key in keyof T]: T[Key] extends number
    ? number
    : T[Key] extends string
      ? string
      : T[Key];
};

export type EncodeHbsOptions = {
  digest?: HbsDigest;
  prefix?: string;
  headerEndDelimiter?: string;
  integritySize?: number;
  checksumSize?: number;
};

export type DecodeHbsOptions = EncodeHbsOptions;

export type DecodeHbsPayloadOptions = {
  partial?: boolean;
};

export type DecodeHbsPayloadResult = {
  payload: HbsPayload;
  truncated: boolean;
};

export type DecodeHbsResult = {
  prefix: string;
  valid: boolean;
  truncated: boolean;
  integrity: string;
  checksum: string;
  expectedLength: number;
  actualLength: number;
  payload: HbsPayload;
  input: string;
};
