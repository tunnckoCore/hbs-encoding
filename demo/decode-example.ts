import stringify from "canonical-json";
import { HIGHSCRIPT } from "../src/bitmaps/highscript.ts";
import { LOWSCRIPT } from "../src/bitmaps/lowscript.ts";
import { decodeHbsImage, encodeHbsImage } from "../src/img/index.ts";
import { encodeHbsPayload } from "@/index.ts";

// const fixture = {
//   id: 8711,
//   external_app_url: null,
//   // image_url:
//   //   "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwMCIgaGVpZ2h0PSIxMjAwIiB2aWV3Qm94PSIwIDAgMTIwMCAxMjAwIiB2ZXJzaW9uPSIxLjIiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgc3R5bGU9ImJhY2tncm91bmQtaW1hZ2U6dXJsKGRhdGE6aW1hZ2UvcG5nO2Jhc2U2NCxpVkJPUncwS0dnb0FBQUFOU1VoRVVnQUFBQ0FBQUFBZ0NBTUFBQUJFcElyR0FBQUFPVkJNVkVWamhaVVhGeGM1T1RtY282em02ZHc0UldoL2o2VnpGY1gvTk9YLy8vL0V4cnNmSHg4eE1URktDM3VMQU1hbWR3RC8zMEwvNTNILytOWjZTN2NXQUFBQXFFbEVRVlE0eTczUjdRNkRJQXdGVUQ2blc2R0E3Lyt3c3dJTEpRUVNUWGJERDIyUHJVWWgvaFo1UmpWNU1rSEk2UVJKWU56U1dodGpwS0l6QVRsM2diWDJWVE1HMjdibnZNVUM3SGZCNmgzMHAyWTh3TXcvY3dvQUZBZFU0S0lEQWx3M3dhMG44SC9SQWVnQnNCWGVJeWpFRmlBNDVNRDFRRDBHelFwUENURWRGd0JGSnhjNENLa0E1eklJNmJjQWtlNWpBZkVvSUNKeWdKUnJBbDEwZ0I2cEl2Y2oxYy8rRnkrb0RpM2pZZyszQUFBQUFFbEZUa1N1UW1DQyk7YmFja2dyb3VuZC1yZXBlYXQ6bm8tcmVwZWF0O2JhY2tncm91bmQtc2l6ZTpjb250YWluO2JhY2tncm91bmQtcG9zaXRpb246Y2VudGVyO2ltYWdlLXJlbmRlcmluZzotd2Via2l0LW9wdGltaXplLWNvbnRyYXN0O2ltYWdlLXJlbmRlcmluZzotbW96LWNyaXNwLWVkZ2VzO2ltYWdlLXJlbmRlcmluZzpwaXhlbGF0ZWQ7Ij48L3N2Zz4=",

//   media_type: "image",
//   is_unique: true,
//   // metadata: {
//   //   attributes: [
//   //     { trait_type: "Background", value: "Classic Punks BG" },
//   //     { trait_type: "Type", value: "Human Melanin Level Goth" },
//   //     { trait_type: "Cloths", value: "Vampire Attack Attire" },
//   //     { trait_type: "Head", value: "Blockthink Receiver" },
//   //     { trait_type: "Eyes", value: "Visoor Pink" },
//   //     { trait_type: "Classification", value: "Comrade" },
//   //     { trait_type: "Affiliation", value: "Corrupted" },
//   //     { trait_type: "Rank", value: "4300" },
//   //   ],
//   //   ethscription_id:
//   //     "0xa51759f47d949e755de3c30964e0fb14d7b638a12354fd40fc62eba0313e2653",
//   //   ethscription_number: 6169177,
//   //   image:
//   //     "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwMCIgaGVpZ2h0PSIxMjAwIiB2aWV3Qm94PSIwIDAgMTIwMCAxMjAwIiB2ZXJzaW9uPSIxLjIiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgc3R5bGU9ImJhY2tncm91bmQtaW1hZ2U6dXJsKGRhdGE6aW1hZ2UvcG5nO2Jhc2U2NCxpVkJPUncwS0dnb0FBQUFOU1VoRVVnQUFBQ0FBQUFBZ0NBTUFBQUJFcElyR0FBQUFPVkJNVkVWamhaVVhGeGM1T1RtY282em02ZHc0UldoL2o2VnpGY1gvTk9YLy8vL0V4cnNmSHg4eE1URktDM3VMQU1hbWR3RC8zMEwvNTNILytOWjZTN2NXQUFBQXFFbEVRVlE0eTczUjdRNkRJQXdGVUQ2blc2R0E3Lyt3c3dJTEpRUVNUWGJERDIyUHJVWWgvaFo1UmpWNU1rSEk2UVJKWU56U1dodGpwS0l6QVRsM2diWDJWVE1HMjdibnZNVUM3SGZCNmgzMHAyWTh3TXcvY3dvQUZBZFU0S0lEQWx3M3dhMG44SC9SQWVnQnNCWGVJeWpFRmlBNDVNRDFRRDBHelFwUENURWRGd0JGSnhjNENLa0E1eklJNmJjQWtlNWpBZkVvSUNKeWdKUnJBbDEwZ0I2cEl2Y2oxYy8rRnkrb0RpM2pZZyszQUFBQUFFbEZUa1N1UW1DQyk7YmFja2dyb3VuZC1yZXBlYXQ6bm8tcmVwZWF0O2JhY2tncm91bmQtc2l6ZTpjb250YWluO2JhY2tncm91bmQtcG9zaXRpb246Y2VudGVyO2ltYWdlLXJlbmRlcmluZzotd2Via2l0LW9wdGltaXplLWNvbnRyYXN0O2ltYWdlLXJlbmRlcmluZzotbW96LWNyaXNwLWVkZ2VzO2ltYWdlLXJlbmRlcmluZzpwaXhlbGF0ZWQ7Ij48L3N2Zz4=",
//   //   name: "Comrade #8712",
//   // },
//   owner: "0x4212D149F77308a87ce9928F1095eDdb894f4D68",
//   animation_url: "https://example.com/foo.gif",
//   thumbnails: null,
//   token: "0xBB41E24dA83DcAb001bd085879c66cFCB4eED522",
// };

// const baseImage = await Bun.file("./moonbird-393-original.png").arrayBuffer();

// const encoded = await encodeHbsImage(attestPayload, {
//   bitmap: HIGHSCRIPT,
//   baseImage,
//   gap: 10,
//   size: 4,
// });

// await Bun.write("./moonbird-393-attest-g2-gap3.png", encoded.image);
// const decoded = await decodeHbsImage(encoded.image, {
//   bitmap: HIGHSCRIPT,
// });

// console.log(decoded);

// ==================
// ==================
// ==================
// ==================

// const downloadedOne = await Bun.file(
//   "./moonbird-393-downloaded-from-pbs-media-HIzH9WjWkAEM4Y7.png",
// ).arrayBuffer();

const image = await Bun.file(
  "./moonbird-393-attest-scrn-g4-gap10.png",
).arrayBuffer();
const decoded = await decodeHbsImage(image, {
  bitmap: HIGHSCRIPT,
  gap: 10,
  size: 4,
});

console.log(decoded);

// console.log(encodeHbsPayload(attestPayload).length);
