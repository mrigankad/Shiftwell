import type { Accessory, Part } from "../types.js";
import { Canvas } from "./paint.js";

// Colour keys: p = the accessory's main colour (accessory1 for the first worn accessory, accessory2 for the second),
// x = accent detail, o = outline, w = light glint.
function glasses(): Part {
  const c = new Canvas();
  for (const x0 of [14, 26]) {
    c.rect(x0 + 1, 19, x0 + 6, 19, "p"); c.rect(x0 + 1, 26, x0 + 6, 26, "p");
    c.rect(x0, 20, x0, 25, "p"); c.rect(x0 + 7, 20, x0 + 7, 25, "p");
    c.set(x0 + 1, 21, "w"); c.set(x0 + 2, 20, "w");
  }
  c.rect(22, 22, 25, 22, "p");
  c.rect(12, 22, 13, 22, "p"); c.rect(34, 22, 35, 22, "p");
  return c.toPart("acc.glasses", "accessories");
}
function headphones(): Part {
  const c = new Canvas();
  c.ell(24, 15, 15.5, 11.5, "p"); c.ell(24, 15, 13.5, 9.5, ".");
  for (let y = 16; y < 48; y++) for (let x = 0; x < 48; x++) if (y >= 17) c.set(x, y, ".");
  c.rect(8, 19, 12, 28, "p"); c.rect(35, 19, 39, 28, "p");
  c.rect(9, 21, 10, 26, "o"); c.rect(37, 21, 38, 26, "o");
  c.set(9, 20, "w"); c.set(10, 20, "w"); c.set(36, 20, "w"); c.set(37, 20, "w");
  c.outline("o");
  return c.toPart("acc.headphones", "accessories");
}
function beanie(): Part {
  const c = new Canvas();
  c.ell(24, 13, 15.5, 11, "p");
  for (let y = 14; y < 48; y++) for (let x = 0; x < 48; x++) c.set(x, y, ".");
  c.rect(9, 11, 38, 14, "p");
  for (let x = 10; x < 38; x += 3) c.rect(x, 12, x, 14, "o");
  c.rect(12, 6, 15, 6, "w"); c.rect(10, 8, 11, 8, "w");
  c.ell(24, 2.5, 3, 3, "w");
  c.outline("o");
  return c.toPart("acc.beanie", "accessories");
}
function visor(): Part {
  // an open-crown visor: a slim curved band, and a brim that sticks out past it, deepest in the middle,
  // with a lit top face, an accent stripe and a shadowed underside
  const c = new Canvas();
  for (let x = 10; x <= 37; x++) {
    const u = (x - 23.5) / 14;
    if (Math.abs(u) < 0.86) {
      const top = 8 + Math.round(3 * u * u);
      c.set(x, top, "p"); c.set(x, top + 1, "p");
    }
    const bTop = 10 + Math.round(1.6 * u * u);
    const edge = 12 + Math.round(2.4 * (1 - u * u));
    for (let y = bTop; y <= edge; y++) c.set(x, y, "p");
    c.set(x, bTop, "w");
    c.set(x, edge, "x");
    if (x >= 13 && x <= 34) c.set(x, edge + 1, "o");
  }
  for (const [x, y] of [[16, 8], [17, 8], [15, 9]] as const) if (c.get(x, y) === "p") c.set(x, y, "w");
  c.outline("o");
  return c.toPart("acc.visor", "accessories");
}
function starClip(): Part {
  const c = new Canvas();
  ["..p..", "ppppp", ".ppp.", "pp.pp"].forEach((r, i) => [...r].forEach((ch, j) => ch === "p" && c.set(13 + j, 12 + i, "p")));
  c.set(15, 13, "w");
  c.outline("o");
  return c.toPart("acc.starClip", "accessories");
}
function moonClip(): Part {
  const c = new Canvas();
  c.ell(34, 14.5, 3.2, 3.2, "p");
  c.ell(35.4, 13.4, 2.7, 2.7, ".");
  c.set(33, 12, "w");
  c.outline("o");
  return c.toPart("acc.moonClip", "accessories");
}

export const accessories: Record<Accessory, Part> = {
  glasses: glasses(), headphones: headphones(), beanie: beanie(), visor: visor(), starClip: starClip(), moonClip: moonClip(),
};
