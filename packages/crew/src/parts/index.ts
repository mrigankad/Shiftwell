import { accessories } from "./accessories.js";
import { backgrounds } from "./backgrounds.js";
import { builds } from "./body.js";
import { blush, brows, ears, eyes, head, mouths } from "./face.js";
import { hairStyles, hairs } from "./hair.js";
import { logoGlyphs, logoPatch } from "../logos.js";
import type { Part, Provider } from "../types.js";

export { accessories, backgrounds, builds, blush, brows, ears, eyes, head, mouths, hairs, hairStyles };

export const logoPatches = Object.fromEntries(
  (Object.keys(logoGlyphs) as Provider[]).map((p) => [p, logoPatch(p)]),
) as Record<Provider, Part>;

/** every part in the library, flat, for tests and catalogues */
export function allParts(): Part[] {
  return [
    ...Object.values(accessories), ...Object.values(backgrounds),
    ...Object.values(builds).flatMap((b) => [b.body, b.hoodie, b.trim]),
    blush, ...Object.values(brows), ears, ...Object.values(eyes), head, ...Object.values(mouths),
    ...Object.values(hairs).flatMap((h) => [h.back, h.front]),
    ...Object.values(logoPatches),
  ];
}
