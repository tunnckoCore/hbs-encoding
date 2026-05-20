import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import canonicalJsonStringify from "canonical-json";

import type {
  DecodeHbsOptions,
  DecodeHbsPayloadOptions,
  DecodeHbsPayloadResult,
  DecodeHbsResult,
  EncodeHbsOptions,
  HbsPayload,
} from "./types.ts";
// import { camelCaseObjectKeys, sortObjectKeys } from "@/lib/utils";

export const HBS_PREFIX = "hbs2";
export const HBS_METADATA_TRAITS_KEY = "traits";
export const HBS_HEADER_END_DELIMITER = ".";
export const HBS_INTEGRITY_SIZE = 16;
export const HBS_CHECKSUM_SIZE = 8; // or HBS_INTEGRITY_SIZE / 2

export const DEFAULT_HBS_OPTIONS = {
  prefix: HBS_PREFIX,
  headerEndDelimiter: HBS_HEADER_END_DELIMITER,
  integritySize: HBS_INTEGRITY_SIZE,
  checksumSize: HBS_CHECKSUM_SIZE,
} as const;

export const DEFAULT_ENCODE_HBS_OPTIONS = DEFAULT_HBS_OPTIONS;
export const DEFAULT_DECODE_HBS_OPTIONS = DEFAULT_HBS_OPTIONS;

function normalizeHbsOptions(options: Required<EncodeHbsOptions>) {
  const integritySize = options.integritySize === 0 ? 64 : options.integritySize;

  if (integritySize < 6) {
    throw new Error("Invalid HBS options: integritySize must be 0 or at least 6");
  }

  if (options.checksumSize > integritySize) {
    throw new Error(
      "Invalid HBS options: checksumSize must be less than or equal to integritySize",
    );
  }

  return { ...options, integritySize };
}

// TODO: support nested objects?
export function encodeHbsPayload(payload: HbsPayload) {
  const canonicalData = JSON.parse(canonicalJsonStringify(payload) ?? "null");
  if (!canonicalData) {
    return "";
  }

  let output = "";

  for (const [key, value] of Object.entries(canonicalData)) {
    const stringValue = String(value);
    output += `${key.length}:${key}${stringValue.length}:${stringValue}`;
  }

  return output;
}

export function decodeHbsPayload(
  input: string,
  options: DecodeHbsPayloadOptions & { partial: true },
): DecodeHbsPayloadResult;
export function decodeHbsPayload(input: string, options?: DecodeHbsPayloadOptions): HbsPayload;
export function decodeHbsPayload(input: string, options: DecodeHbsPayloadOptions = {}) {
  const payload: HbsPayload = {};
  let offset = 0;
  let truncated = false;

  function finish() {
    if (options.partial) {
      return { payload, truncated };
    }

    return payload;
  }

  while (offset < input.length) {
    const keyLengthEnd = input.indexOf(":", offset);
    if (keyLengthEnd === -1) {
      if (options.partial) {
        truncated = true;
        return finish();
      }
      throw new Error("Invalid HBS payload: missing key length separator");
    }

    const keyLength = Number.parseInt(input.slice(offset, keyLengthEnd), 10);
    if (!Number.isFinite(keyLength) || keyLength < 0) {
      if (options.partial) {
        truncated = true;
        return finish();
      }
      throw new Error("Invalid HBS payload: invalid key length");
    }

    const keyStart = keyLengthEnd + 1;
    const keyEnd = keyStart + keyLength;
    if (keyEnd > input.length) {
      if (options.partial) {
        truncated = true;
        return finish();
      }
      throw new Error("Invalid HBS payload: incomplete key");
    }

    const key = input.slice(keyStart, keyEnd);
    const valueLengthEnd = input.indexOf(":", keyEnd);
    if (valueLengthEnd === -1) {
      if (options.partial) {
        truncated = true;
        return finish();
      }
      throw new Error("Invalid HBS payload: missing value length separator");
    }

    const valueLength = Number.parseInt(input.slice(keyEnd, valueLengthEnd), 10);
    if (!Number.isFinite(valueLength) || valueLength < 0) {
      if (options.partial) {
        truncated = true;
        return finish();
      }
      throw new Error("Invalid HBS payload: invalid value length");
    }

    const valueStart = valueLengthEnd + 1;
    const valueEnd = valueStart + valueLength;
    if (valueEnd > input.length) {
      if (options.partial) {
        truncated = true;
        return finish();
      }
      throw new Error("Invalid HBS payload: incomplete value");
    }

    payload[key] = input.slice(valueStart, valueEnd);
    offset = valueEnd;
  }

  return finish();
}

export function encodeHbs(payload: HbsPayload, opts: EncodeHbsOptions = {}) {
  const options = normalizeHbsOptions({ ...DEFAULT_ENCODE_HBS_OPTIONS, ...opts });

  const hbsPayload = encodeHbsPayload(payload);
  const encodedPayload = hbsPayload;
  const sha = bytesToHex(sha256(new TextEncoder().encode(hbsPayload)));

  const HBS_ENVELOPE = `
    ${options.prefix}.
    ${sha.slice(0, options.integritySize)}.
    ${encodedPayload.length}${options.headerEndDelimiter}

    ${encodedPayload}.
    ${sha.slice(options.integritySize - options.checksumSize, options.integritySize)}
  `
    .split("\n")
    .map((x) => x.trim())
    .join("");

  return HBS_ENVELOPE;
}

export function decodeHbs(input: string, opts: DecodeHbsOptions = {}): DecodeHbsResult | null {
  const options = normalizeHbsOptions({ ...DEFAULT_DECODE_HBS_OPTIONS, ...opts });
  const start = input.indexOf(`${options.prefix}.`);

  if (start === -1) {
    return null;
  }

  const frame = input.slice(start);
  const prefixEnd = options.prefix.length;
  const integrityStart = prefixEnd + 1;
  const integrityEnd = frame.indexOf(".", integrityStart);

  if (integrityEnd === -1) {
    return null;
  }

  const integrity = frame.slice(integrityStart, integrityEnd);
  const lengthStart = integrityEnd + 1;
  const lengthEnd = frame.indexOf(options.headerEndDelimiter, lengthStart);

  if (!integrity || lengthEnd === -1) {
    return null;
  }

  const lengthText = frame.slice(lengthStart, lengthEnd);
  const expectedLength = Number.parseInt(lengthText, 10);
  if (!Number.isFinite(expectedLength) || expectedLength < 0) {
    return null;
  }

  const payloadStart = lengthEnd + options.headerEndDelimiter.length;
  const encodedPayload = frame.slice(payloadStart, payloadStart + expectedLength);
  const payload = encodedPayload;
  const checksumStart = payloadStart + expectedLength + HBS_HEADER_END_DELIMITER.length;
  const checksum = frame.slice(checksumStart, checksumStart + options.checksumSize);
  const decodedPayload = decodeHbsPayload(payload, { partial: true });
  const sha = bytesToHex(sha256(new TextEncoder().encode(payload)));
  const valid =
    encodedPayload.length === expectedLength &&
    !decodedPayload.truncated &&
    sha.slice(0, options.integritySize) === integrity &&
    sha.slice(options.integritySize - options.checksumSize, options.integritySize) === checksum;

  return {
    prefix: options.prefix,
    valid,
    truncated: decodedPayload.truncated || encodedPayload.length < expectedLength,
    integrity: integrity,
    checksum,
    expectedLength,
    actualLength: encodedPayload.length,
    payload: decodedPayload.payload,
    input: frame,
  };
}

export { attributesToTraits } from "./attrs.ts";
export type * from "./types.ts";
