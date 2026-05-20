import { describe, expect, it } from "vite-plus/test";

import {
  attributesToTraits,
  decodeHbs,
  decodeHbsPayload,
  DEFAULT_DECODE_HBS_OPTIONS,
  DEFAULT_ENCODE_HBS_OPTIONS,
  DEFAULT_HBS_OPTIONS,
  encodeHbs,
  encodeHbsPayload,
  HBS_CHECKSUM_SIZE,
  HBS_HEADER_END_DELIMITER,
  HBS_INTEGRITY_SIZE,
  HBS_PREFIX,
} from "../src/index.ts";

describe("hbs", () => {
  it("exports default constants and options", () => {
    expect(HBS_PREFIX).toBe("hbs2");
    expect(HBS_HEADER_END_DELIMITER).toBe(".");
    expect(HBS_INTEGRITY_SIZE).toBe(16);
    expect(HBS_CHECKSUM_SIZE).toBe(8);
    expect(DEFAULT_HBS_OPTIONS).toEqual({
      prefix: HBS_PREFIX,
      headerEndDelimiter: HBS_HEADER_END_DELIMITER,
      integritySize: HBS_INTEGRITY_SIZE,
      checksumSize: HBS_CHECKSUM_SIZE,
    });
    expect(DEFAULT_ENCODE_HBS_OPTIONS).toBe(DEFAULT_HBS_OPTIONS);
    expect(DEFAULT_DECODE_HBS_OPTIONS).toBe(DEFAULT_HBS_OPTIONS);
  });

  it("encodes payloads with canonical key ordering", () => {
    expect(
      encodeHbsPayload({
        owner: "0x4212D149F77308a87ce9928F1095eDdb894f4D6810",
        id: "4e51fe43-e025-4c55-a788-8fecc1f95753",
        media_type: "image",
      }),
    ).toBe(
      "2:id36:4e51fe43-e025-4c55-a788-8fecc1f9575310:media_type5:image5:owner44:0x4212D149F77308a87ce9928F1095eDdb894f4D6810",
    );
  });

  it("encodes lossy scalar values as strings", () => {
    expect(encodeHbsPayload({ count: 42, enabled: true, missing: null })).toBe(
      "5:count2:427:enabled4:true7:missing4:null",
    );
  });

  it("encodes an empty canonical payload as an empty string", () => {
    expect(encodeHbsPayload({})).toBe("");
    expect(encodeHbsPayload(null as never)).toBe("");
    expect(encodeHbsPayload(undefined as never)).toBe("");
  });

  it("decodes raw payloads", () => {
    expect(decodeHbsPayload("2:id4:871110:media_type5:image")).toEqual({
      id: "8711",
      media_type: "image",
    });
  });

  it("throws on malformed raw payloads without partial mode", () => {
    expect(() => decodeHbsPayload("2id48711")).toThrow(
      "Invalid HBS payload: missing key length separator",
    );
    expect(() => decodeHbsPayload("x:id4:8711")).toThrow("Invalid HBS payload: invalid key length");
    expect(() => decodeHbsPayload("9:id")).toThrow("Invalid HBS payload: incomplete key");
    expect(() => decodeHbsPayload("2:id")).toThrow(
      "Invalid HBS payload: missing value length separator",
    );
    expect(() => decodeHbsPayload("2:idx:value")).toThrow(
      "Invalid HBS payload: invalid value length",
    );
    expect(() => decodeHbsPayload("-1:id4:8711")).toThrow(
      "Invalid HBS payload: invalid key length",
    );
    expect(() => decodeHbsPayload("2:id-1:8711")).toThrow(
      "Invalid HBS payload: invalid value length",
    );
    expect(() => decodeHbsPayload("2:id4:87")).toThrow("Invalid HBS payload: incomplete value");
  });

  it("returns partial decoded payloads instead of throwing", () => {
    expect(decodeHbsPayload("2id48711", { partial: true })).toEqual({
      payload: {},
      truncated: true,
    });
    expect(decodeHbsPayload("x:id4:8711", { partial: true })).toEqual({
      payload: {},
      truncated: true,
    });
    expect(decodeHbsPayload("-1:id4:8711", { partial: true })).toEqual({
      payload: {},
      truncated: true,
    });
    expect(decodeHbsPayload("9:id", { partial: true })).toEqual({
      payload: {},
      truncated: true,
    });
    expect(decodeHbsPayload("2:id", { partial: true })).toEqual({
      payload: {},
      truncated: true,
    });
    expect(decodeHbsPayload("2:idx:value", { partial: true })).toEqual({
      payload: {},
      truncated: true,
    });
    expect(decodeHbsPayload("2:id-1:8711", { partial: true })).toEqual({
      payload: {},
      truncated: true,
    });
    expect(decodeHbsPayload("2:id4:87", { partial: true })).toEqual({
      payload: {},
      truncated: true,
    });
    expect(decodeHbsPayload("2:id4:871110:media_type5:im", { partial: true })).toEqual({
      payload: { id: "8711" },
      truncated: true,
    });
  });

  it("encodes and decodes a valid HBS envelope", () => {
    const encoded = encodeHbs({
      media_type: "image",
      is_unique: true,
      thumbnails: null,
      id: "8711",
    });
    const decoded = decodeHbs(encoded);

    expect(encoded).toMatch(/^hbs2\.[a-f0-9]{16}\.66\./);
    expect(decoded).toMatchObject({
      prefix: "hbs2",
      valid: true,
      truncated: false,
      expectedLength: 66,
      actualLength: 66,
      payload: {
        id: "8711",
        is_unique: "true",
        media_type: "image",
        thumbnails: "null",
      },
      input: encoded,
    });
    expect(decoded?.integrity).toHaveLength(16);
    expect(decoded?.checksum).toHaveLength(8);
  });

  it("decodes HBS envelopes embedded in larger text", () => {
    const encoded = encodeHbs({ id: "8711" });
    const decoded = decodeHbs(`prefix text ${encoded} suffix text`);

    expect(decoded?.valid).toBe(true);
    expect(decoded?.payload).toEqual({ id: "8711" });
    expect(decoded?.input).toBe(`${encoded} suffix text`);
  });

  it("returns null for missing or invalid HBS envelope headers", () => {
    expect(decodeHbs("hello world")).toBeNull();
    expect(decodeHbs("hbs2abcdef.10.payload.checksum", { prefix: "hbs2abcdef" })).toBeNull();
    expect(decodeHbs("hbs2.abcdef")).toBeNull();
    expect(decodeHbs("hbs2..10.payload.checksum")).toBeNull();
    expect(decodeHbs("hbs2.abcdefnot-a-lengthpayloadchecksum")).toBeNull();
    expect(decodeHbs("hbs2.abcdef.not-a-length.payload.checksum")).toBeNull();
    expect(decodeHbs("hbs2.abcdef.-1.payload.checksum")).toBeNull();
  });

  it("marks changed payloads as invalid", () => {
    const encoded = encodeHbs({ id: "8711", media_type: "image" });
    const tampered = encoded.replace("image", "video");
    const decoded = decodeHbs(tampered);

    expect(decoded?.valid).toBe(false);
    expect(decoded?.truncated).toBe(false);
    expect(decoded?.payload).toEqual({ id: "8711", media_type: "video" });
  });

  it("marks changed checksums as invalid", () => {
    const encoded = encodeHbs({ id: "8711" });
    const tampered = `${encoded.slice(0, -1)}0`;
    const decoded = decodeHbs(tampered);

    expect(decoded?.valid).toBe(false);
    expect(decoded?.truncated).toBe(false);
  });

  it("marks truncated envelopes as invalid and truncated", () => {
    const encoded = encodeHbs({ id: "8711", media_type: "image", owner: "0x4212" });
    const truncated = encoded.slice(0, -12);
    const decoded = decodeHbs(truncated);

    expect(decoded?.valid).toBe(false);
    expect(decoded?.truncated).toBe(true);
    expect(decoded?.actualLength).toBeLessThan(decoded?.expectedLength ?? 0);
  });

  it("supports custom prefix and hash slice sizes", () => {
    const options = { prefix: "meta", integritySize: 12, checksumSize: 6 };
    const encoded = encodeHbs({ id: "8711", media_type: "image" }, options);
    const decodedWithDefaults = decodeHbs(encoded);
    const decoded = decodeHbs(encoded, options);

    expect(encoded).toMatch(/^meta\.[a-f0-9]{12}\.30\./);
    expect(decodedWithDefaults).toBeNull();
    expect(decoded).toMatchObject({
      prefix: "meta",
      valid: true,
      truncated: false,
      expectedLength: 30,
      actualLength: 30,
      payload: { id: "8711", media_type: "image" },
    });
    expect(decoded?.integrity).toHaveLength(12);
    expect(decoded?.checksum).toHaveLength(6);
  });

  it("supports integritySize 0 as the full SHA-256 hex digest length", () => {
    const options = { integritySize: 0, checksumSize: 16 };
    const encoded = encodeHbs({ id: "8711" }, options);
    const decoded = decodeHbs(encoded, options);

    expect(encoded).toMatch(/^hbs2\.[a-f0-9]{64}\.10\./);
    expect(decoded?.valid).toBe(true);
    expect(decoded?.integrity).toHaveLength(64);
    expect(decoded?.checksum).toHaveLength(16);
  });

  it("throws on invalid HBS option sizes", () => {
    expect(() => encodeHbs({ id: "8711" }, { integritySize: 5 })).toThrow(
      "Invalid HBS options: integritySize must be 0 or at least 6",
    );
    expect(() => decodeHbs("hbs2.deadbeef.0..", { integritySize: 5 })).toThrow(
      "Invalid HBS options: integritySize must be 0 or at least 6",
    );
    expect(() => encodeHbs({ id: "8711" }, { integritySize: 6, checksumSize: 8 })).toThrow(
      "Invalid HBS options: checksumSize must be less than or equal to integritySize",
    );
    expect(() => decodeHbs("hbs2.deadbeef.0..", { integritySize: 6, checksumSize: 8 })).toThrow(
      "Invalid HBS options: checksumSize must be less than or equal to integritySize",
    );
  });

  it("supports a custom header end delimiter", () => {
    const options = { headerEndDelimiter: "|" };
    const encoded = encodeHbs({ id: "8711" }, options);
    const decoded = decodeHbs(encoded, options);

    expect(encoded).toContain(".10|2:id4:8711.");
    expect(decoded?.valid).toBe(true);
    expect(decoded?.payload).toEqual({ id: "8711" });
  });

  it("uses matching decode options for validation", () => {
    const encoded = encodeHbs({ id: "8711" }, { integritySize: 10, checksumSize: 4 });

    expect(decodeHbs(encoded)?.valid).toBe(false);
    expect(decodeHbs(encoded, { integritySize: 10, checksumSize: 4 })?.valid).toBe(true);
  });

  it("converts multiple attribute shapes to traits", () => {
    expect(
      attributesToTraits([
        { trait_type: "Background", value: "Classic" },
        { trait_type: "Rank", trait_value: 4300 },
        { traitType: "Power", traitValue: "High" },
      ]),
    ).toEqual({
      Background: "Classic",
      Rank: 4300,
      Power: "High",
    });
  });
});
