export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};
export type HbsPayload = Record<string, string | number | null | boolean>;

export type DecodeHbsPayloadOptions = {
  partial?: boolean;
};

export type DecodeHbsPayloadResult = {
  payload: HbsPayload;
  truncated: boolean;
};

export type DecodeHbsResult = {
  prefix: "hbs2";
  valid: boolean;
  truncated: boolean;
  integrity: string;
  checksum: string;
  expectedLength: number;
  actualLength: number;
  payload: HbsPayload;
  input: string;
};
