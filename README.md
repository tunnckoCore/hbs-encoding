# @tunnckocore/hbs

Compact, deterministic HBS (`hbs2`) encoding for flat JSON-like key/value payloads, with length framing plus SHA-256 based integrity and checksum verification.

HBS is useful when you need a small, readable envelope for metadata-like objects and want decoders to detect truncation or tampering.

## Features

- Encodes flat object key/value pairs into a compact length-prefixed payload
- Deterministic output via [JSON Canonicalization Scheme (JCS, RFC 8785)](https://www.rfc-editor.org/rfc/rfc8785) key ordering
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

### `encodeHbs(payload)`

Encodes a flat payload into an HBS envelope.

```ts
encodeHbs({ id: "8711", is_unique: true });
```

Supported input values are:

```ts
type HbsPayload = Record<string, string | number | null | boolean>;
```

### `decodeHbs(input)`

Finds and decodes the first `hbs2.` envelope in `input`. Returns `null` if no valid-looking envelope header is found.

```ts
const result = decodeHbs(encoded);
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
