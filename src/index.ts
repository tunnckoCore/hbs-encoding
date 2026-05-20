import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import canonicalJsonStringify from "canonical-json";

import type {
  DecodeHbsPayloadOptions,
  DecodeHbsPayloadResult,
  DecodeHbsResult,
  HbsPayload,
} from "./types";
// import { camelCaseObjectKeys, sortObjectKeys } from "@/lib/utils";

export const HBS_PREFIX = "hbs2";
export const HBS_METADATA_TRAITS_KEY = "traits";
export const HBS_HEADER_END_DELIMITER = ".";
export const HBS_INTEGRITY_SIZE = 16;
export const HBS_CHECKSUM_SIZE = 8; // or HBS_INTEGRITY_SIZE / 2

// TODO: support nested objects?
export function encodeHbsPayload(payload: HbsPayload) {
  const canonicalData = JSON.parse(canonicalJsonStringify(payload) ?? "null");
  if (!canonicalData) {
    return "";
  }

  let output = "";

  for (const [key, value] of Object.entries(canonicalData)) {
    output += `${key.length}:${key}${String(value).length}:${value}`;
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

export function encodeHbs(payload: HbsPayload) {
  const hbsPayload = encodeHbsPayload(payload);
  const encodedPayload = hbsPayload;
  const sha = bytesToHex(sha256(new TextEncoder().encode(hbsPayload)));

  const HBS_ENVELOPE = `
    ${HBS_PREFIX}.
    ${sha.slice(0, HBS_INTEGRITY_SIZE)}.
    ${encodedPayload.length}${HBS_HEADER_END_DELIMITER}

    ${encodedPayload}.
    ${sha.slice(HBS_INTEGRITY_SIZE - HBS_CHECKSUM_SIZE, HBS_INTEGRITY_SIZE)}
  `
    .split("\n")
    .map((x) => x.trim())
    .join("");

  return HBS_ENVELOPE;
}

export function decodeHbs(input: string): DecodeHbsResult | null {
  const start = input.indexOf(`${HBS_PREFIX}.`);

  if (start === -1) {
    return null;
  }

  const frame = input.slice(start);
  const parts = frame.split(".");
  const prefix = parts[0];
  const integrity = parts[1];
  const lengthText = parts[2];

  if (prefix !== HBS_PREFIX || !integrity || !lengthText) {
    return null;
  }

  const expectedLength = Number.parseInt(lengthText, 10);
  if (!Number.isFinite(expectedLength) || expectedLength < 0) {
    return null;
  }

  const payloadStart = `${HBS_PREFIX}.${integrity}.${lengthText}${HBS_HEADER_END_DELIMITER}`.length;
  const encodedPayload = frame.slice(payloadStart, payloadStart + expectedLength);
  const payload = encodedPayload;
  const checksumStart = payloadStart + expectedLength + 1;
  const checksum = frame.slice(checksumStart, checksumStart + HBS_CHECKSUM_SIZE);
  const decodedPayload = decodeHbsPayload(payload, { partial: true });
  const sha = bytesToHex(sha256(new TextEncoder().encode(payload)));
  const valid =
    encodedPayload.length === expectedLength &&
    !decodedPayload.truncated &&
    sha.slice(0, HBS_INTEGRITY_SIZE) === integrity &&
    sha.slice(HBS_INTEGRITY_SIZE - HBS_CHECKSUM_SIZE, HBS_INTEGRITY_SIZE) === checksum;

  return {
    prefix: HBS_PREFIX,
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
