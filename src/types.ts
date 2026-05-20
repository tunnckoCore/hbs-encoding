export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};
export type HbsPayload = Record<string, string | number | null | boolean>;
export type HbsDigest = (input: Uint8Array) => Uint8Array;

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
