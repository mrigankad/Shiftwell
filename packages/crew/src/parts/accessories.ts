import type { Accessory, Part } from "../types.js";
import { Canvas } from "./paint.js";

function glasses(): Part {
  const c = new Canvas();
  for (const x0 of [14, 26]) {
    c.rect(x0 + 1, 19, x0 + 6, 19, "o"); c.rect(x0 + 1, 26, x0 + 6, 26, "o");
    c.rect(x0, 20, x0, 25, "o"); c.rect(x0 + 7, 20, x0 + 7, 25, "o");
    c.set(x0 + 1, 21, "w");
  }
  c.rect(22, 22, 25, 22, "o");
  c.rect(12, 22, 13, 22, "o"); c.rect(34, 22, 35, 22, "o");
  return c.toPart("acc.glasses", "accessories");
}
function headphones(): Part {
  const c = new Canvas();
  c.ell(24, 15, 15.5, 11.5, "x"); c.ell(24, 15, 13.5, 9.5, ".");
  for (let y = 16; y < 48; y++) for (let x = 0; x < 48; x++) if (y >= 17) c.set(x, y, ".");
  c.rect(8, 19, 12, 28, "x"); c.rect(35, 19, 39, 28, "x");
  c.rect(9, 21, 10, 26, "o"); c.rect(37, 21, 38, 26, "o");
  c.outline("o");
  return c.toPart("acc.headphones", "accessories");
}
function beanie(): Part {
  const c = new Canvas();
  c.ell(24, 13, 15.5, 11, "x");
  for (let y = 14; y < 48; y++) for (let x = 0; x < 48; x++) c.set(x, y, ".");
  c.rect(9, 11, 38, 14, "x");
  for (let x = 10; x < 38; x += 3) c.rect(x, 12, x, 14, "o");
  c.ell(24, 2.5, 3, 3, "w");
  c.outline("o");
  return c.toPart("acc.beanie", "accessories");
}
function visor(): Part {
  const c = new Canvas();
  c.rect(10, 8, 37, 10, "x");
  c.rect(13, 11, 34, 14, "x");
  c.rect(13, 15, 34, 15, "o");
  c.outline("o");
  return c.toPart("acc.visor", "accessories");
}
function starClip(): Part {
  const c = new Canvas();
  ["..x..", "xxxxx", ".xxx.", "xx.xx"].forEach((r, i) => [...r].forEach((ch, j) => ch === "x" && c.set(13 + j, 12 + i, "x")));
  c.outline("o");
  return c.toPart("acc.starClip", "accessories");
}
function moonClip(): Part {
  const c = new Canvas();
  c.ell(34, 14.5, 3.2, 3.2, "x");
  c.ell(35.4, 13.4, 2.7, 2.7, ".");
  c.outline("o");
  return c.toPart("acc.moonClip", "accessories");
}

export const accessories: Record<Accessory, Part> = {
  glasses: glasses(), headphones: headphones(), beanie: beanie(), visor: visor(), starClip: starClip(), moonClip: moonClip(),
};
