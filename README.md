# @tunnckocore/hbs

[![npm version badge](https://badgen.net/npm/v/@tunnckocore/hbs)](https://npmjs.com/package/@tunnckocore/hbs "npm version") ![package license](https://badgen.net/npm/license/@tunnckocore/hbs) ![libera manifesto](https://badgen.net/badge/libera/manifesto/grey)

Compact, deterministic HBS (`hbs2`) encoding for flat JSON-like key/value payloads, with length framing plus SHA-256 based integrity and checksum verification.

HBS is useful when you need a small, readable envelope for metadata-like objects and want decoders to detect truncation or tampering.

## Features

- Encodes flat object key/value pairs into a compact length-prefixed payload
- Deterministic output via [JSON Canonicalization Scheme (JCS, RFC 8785)](https://www.rfc-editor.org/rfc/rfc8785) key ordering
- Preserves the original input data size closely, no expansion like Base64 (33%) or Bech32
- Think of it as simpler a bit more small JSON stringify.
- Integrity prefix and trailing checksum derived from SHA-256
- Decoder reports validity, truncation, expected length, and actual length
- Can decode HBS strings embedded inside larger text
- Fault-tolerant — decoder can recover partial payloads, flag truncation
- TypeScript-first, ESM-only package

## Install

```sh
bun add @tunnckocore/hbs
# or
npm install @tunnckocore/hbs
```

## Quick start

```ts
import { decodeHbs, encodeHbs } from "@tunnckocore/hbs";

// NOTE: mixed order keys in
const encoded = encodeHbs({
  media_type: "image",
  is_unique: true,
  owner: "0x4212D149F77308a87ce9928F1095eDdb894f4D68",
  thumbnails: null,
  id: "8711",
});

// NOTE: sorted/order keys out
console.log(encoded);
// hbs2.<integrity>.<payload-length>.<payload>.<checksum>

const decoded = decodeHbs(encoded);

if (decoded?.valid) {
  console.log(decoded.payload);
}
```

### Lossy types

Decoded values are returned as strings because HBS stores values using `String(value)`:

```ts
{
  id: "8711",
  is_unique: "true",
  media_type: "image",
  owner: "0x4212D149F77308a87ce9928F1095eDdb894f4D68",
  thumbnails: "null"
}
```

## Format

An HBS envelope has this shape:

```txt
hbs2.<integrity>.<payload-length>.<payload>.<checksum>
```

The payload itself is a sequence of length-prefixed key/value pairs:

```txt
<key-length>:<key><value-length>:<value>
```

Example payload fragment:

```txt
2:id4:871110:media_type5:image
```

## API

### `encodeHbs(payload, options?)`

Encodes a flat payload into an HBS envelope.

```ts
encodeHbs({ id: "8711", is_unique: true });
```

Supported input values are:

```ts
type HbsPayload = Record<string, string | number | null | boolean>;
```

Custom options may be used to change the prefix, digest, integrity size, checksum size, or header delimiter:

```ts
import { keccak_512 } from "@noble/hashes/sha3.js";

const encoded = encodeHbs(
  { id: "8711", media_type: "image" },
  {
    prefix: "meta",
    digest: keccak_512,
    integritySize: 0,
    checksumSize: 16,
  },
);
```

See [Options](#options) for validation rules and defaults.

### `decodeHbs(input, options?)`

Finds and decodes the first HBS envelope in `input`. Returns `null` if no valid-looking envelope header is found.

Use the same options used for encoding when customizing `prefix`, `digest`, `integritySize`, `checksumSize`, or `headerEndDelimiter`:

```ts
const result = decodeHbs(encoded, {
  prefix: "meta",
  digest: keccak_512,
  integritySize: 0,
  checksumSize: 16,
});
```

Result shape:

```ts
type DecodeHbsResult = {
  prefix: "hbs2";
  valid: boolean;
  truncated: boolean;
  integrity: string;
  checksum: string;
  expectedLength: number;
  actualLength: number;
  payload: Record<string, string | number | null | boolean>;
  input: string;
};
```

Check `result.valid` before trusting the decoded payload.

### `encodeHbsPayload(payload)`

Encodes only the raw length-prefixed payload, without the HBS envelope or integrity fields. Keys are canonicalized before length-prefix encoding, so non-ordered input produces ordered output.

```ts
encodeHbsPayload({
  owner: "0x4212D149F77308a87ce9928F1095eDdb894f4D6810",
  id: "4e51fe43-e025-4c55-a788-8fecc1f95753",
  media_type: "image",
});

// => 2:id36:4e51fe43-e025-4c55-a788-8fecc1f9575310:media_type5:image5:owner44:0x4212D149F77308a87ce9928F1095eDdb894f4D6810
```

### `decodeHbsPayload(input, options?)`

Decodes a raw length-prefixed payload. Notice that it returns the canonical ordered keys.

```ts
decodeHbsPayload(
  "2:id36:4e51fe43-e025-4c55-a788-8fecc1f9575310:media_type5:image5:owner44:0x4212D149F77308a87ce9928F1095eDdb894f4D6810",
);

// canonical ordered keys
// => {
//   id: "4e51fe43-e025-4c55-a788-8fecc1f95753",
//   media_type: "image",
//   owner: "0x4212D149F77308a87ce9928F1095eDdb894f4D6810",
// }
```

Use partial mode to avoid throwing on truncated input:

```ts
decodeHbsPayload(
  // not full/correct owner address
  "2:id36:4e51fe43-e025-4c55-a788-8fecc1f9575310:media_type5:image5:owner44:0x4212",
  { partial: true },
);
// => {
//   payload: {
//     id: "4e51fe43-e025-4c55-a788-8fecc1f95753",
//     media_type: "image",
//   },
//   truncated: true,
// }
```

## Options

`encodeHbs` and `decodeHbs` accept the same options:

```ts
import { sha256 } from "@noble/hashes/sha2.js";

type HbsOptions = {
  digest?: (input: Uint8Array) => Uint8Array;
  prefix?: string;
  headerEndDelimiter?: string;
  integritySize?: number;
  checksumSize?: number;
};

const defaults = {
  digest: sha256,
  prefix: "hbs2",
  headerEndDelimiter: ".",
  integritySize: 16,
  checksumSize: 8,
};
```

### `digest`

The digest function used to hash the raw length-prefixed payload. It must be synchronous and return `Uint8Array`, like functions from `@noble/hashes`.

```ts
import { sha256 } from "@noble/hashes/sha2.js";
import { keccak_512 } from "@noble/hashes/sha3.js";

encodeHbs(payload, { digest: sha256 }); // default
encodeHbs(payload, { digest: keccak_512 });
```

Async digest functions are rejected and throw:

```txt
Invalid HBS options: digest must be synchronous
```

### `integritySize`

Number of hex characters from the beginning of the digest to place in the HBS header.

- Default: `16`
- `0` means the full digest hex length (`64` for SHA-256, `128` for Keccak-512)
- Values from `1` to `5` throw because they are too small

```txt
Invalid HBS options: integritySize must be 0 or at least 6
```

### `checksumSize`

Number of hex characters copied from the end of the selected integrity slice and placed after the payload.

- Default: `8`
- Must be less than or equal to `integritySize` after `integritySize: 0` is normalized
- For example, `integritySize: 6, checksumSize: 8` throws

```txt
Invalid HBS options: checksumSize must be less than or equal to integritySize
```

The checksum is not an independent hash; it is derived from the selected integrity digest slice.

### `prefix`

Envelope prefix. Default: `"hbs2"`.

```ts
const encoded = encodeHbs(payload, { prefix: "meta" });
const decoded = decodeHbs(encoded, { prefix: "meta" });
```

### `headerEndDelimiter`

Delimiter between the length header and the payload. Default: `"."`.

```ts
const encoded = encodeHbs(payload, { headerEndDelimiter: "|" });
const decoded = decodeHbs(encoded, { headerEndDelimiter: "|" });
```

The separator before the trailing checksum is always `.`.

## Development

This project uses **Vite Plus** ([viteplus.dev](https://viteplus.dev)).

Install dependencies:

```sh
vp install
```

Run the example:

```sh
bun example.ts
```

This repository's example encodes an NFT-style metadata payload and decodes it back. The run produced a valid HBS envelope with a 1267-byte payload:

```txt
valid: true
truncated: false
prefix: hbs2
expectedLength: 1267
actualLength: 1267
```

Build:

```sh
vp run build
```

## Notes and limitations

- HBS currently supports flat objects only; nested objects and arrays are not encoded as structured values.
- Types are lossy on decode: booleans, numbers, and `null` are stringified.
- Integrity/checksum verification detects changes and truncation, but it is not authentication and does not replace signatures or MACs.

## License

Apache-2.0
