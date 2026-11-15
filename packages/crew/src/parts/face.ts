import type { BrowStyle, EyeStyle, MouthStyle, Part } from "../types.js";
import { mirrorRows, part } from "./paint.js";

// Head: 24 wide (x12..35), 23 tall (y10..32). Left half drawn, mirrored.
const headLeft = [
  "....oooooooo",
  "..oossssssss",
  ".ossssssssss",
  ".ossssssssss",
  ...Array<string>(14).fill("osssssssssss"),
  ".ossssssssss",
  ".ossssssssss",
  "..oossssssss",
  "....oossSSSS",
  "......oooooo",
];
export const head: Part = part("head", "head", 12, 10, mirrorRows(headLeft));

// Ears: left 3 wide at x10, right 3 wide at x35.
const earL = [".oo", "oss", "oss", ".oo"];
export const ears: Part = part("ears", "ears", 10, 22, earL.map((l) => l + ".".repeat(22) + [...l].reverse().join("")));

// Eyes: strip spanning x16..31 (16 wide): left eye, 8 gap, right eye.
const eyePair = (rows: string[]): string[] => rows.map((r) => r + "........" + r);
const eyeDefs: Record<EyeStyle, { y: number; rows: string[] }> = {
  round: { y: 20, rows: ["eeee", "ewee", "eeee", "eeee", "eeee", ".ee."] },
  sparkle: { y: 20, rows: ["eeee", "wwee", "weee", "eeee", "eeew", ".ee."] },
  happy: { y: 22, rows: [".ee.", "e..e", "...."] },
};
export const eyes: Record<EyeStyle, Part> = Object.fromEntries(
  (Object.keys(eyeDefs) as EyeStyle[]).map((k) => [k, part(`eyes.${k}`, "eyes", 16, eyeDefs[k].y, eyePair(eyeDefs[k].rows))]),
) as Record<EyeStyle, Part>;

// Brows: 2 to 3 pixels each, mirrored across the face. Left brow drawn on the x16..19 strip.
const browPair = (rows: string[]): string[] => rows.map((r) => r + "........" + [...r].reverse().join(""));
const browDefs: Record<BrowStyle, { y: number; rows: string[] }> = {
  soft: { y: 18, rows: [".HHH"] },
  flat: { y: 18, rows: [".HH."] },
  arched: { y: 17, rows: [".HH.", "H..."] },
  raised: { y: 16, rows: [".HHH"] },
  angry: { y: 17, rows: ["H...", ".HH."] },
  worried: { y: 17, rows: ["...H", "HH.."] },
  none: { y: 18, rows: [] },
};
export const brows: Record<BrowStyle, Part> = Object.fromEntries(
  (Object.keys(browDefs) as BrowStyle[]).map((k) => [k, part(`brows.${k}`, "brows", 16, browDefs[k].y, browPair(browDefs[k].rows))]),
) as Record<BrowStyle, Part>;

// Mouths centred on x=24
export const mouths: Record<MouthStyle, Part> = {
  smile: part("mouth.smile", "mouth", 22, 28, ["o..o", ".oo."]),
  open: part("mouth.open", "mouth", 22, 28, ["oooo", "obbo", ".oo."]),
  cat: part("mouth.cat", "mouth", 21, 28, ["o.oo.o", ".o..o."]),
};

// Blush: x14..16 and x31..33, y26..27
export const blush: Part = part("blush", "blush", 14, 26, ["bbb" + ".".repeat(14) + "bbb", ".bb" + ".".repeat(14) + "bb."]);
