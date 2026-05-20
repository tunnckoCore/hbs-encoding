import type { Prettify } from "./types.ts";

type HbsAttribute = Prettify<
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

function getAttributeKey(attribute: HbsAttribute) {
  if ("trait_type" in attribute) {
    return attribute.trait_type;
  }

  return attribute.traitType;
}

function getAttributeValue(attribute: HbsAttribute) {
  if ("value" in attribute) {
    return attribute.value;
  }

  if ("trait_value" in attribute) {
    return attribute.trait_value;
  }

  return attribute.traitValue;
}

export function attributesToTraits(attributes: readonly HbsAttribute[]) {
  const payload: Record<string, string | number | null> = {};

  for (const attribute of attributes) {
    payload[getAttributeKey(attribute)] = getAttributeValue(attribute);
  }

  return payload;
}
