import type { BodyType, Part } from "../types.js";
import { Canvas } from "./paint.js";

const FULL: Record<BodyType, number> = { slim: 18, broad: 21 };

export interface Build { body: Part; hoodie: Part; trim: Part }

/** the hood opening: where it sits, and how wide the visible rim is */
export const NECKLINE = { cx: 24, cy: 32.2, rx: 7.5, ry: 3.2, rim: 1.35 } as const;

function make(type: BodyType): Build {
  const full = FULL[type];
  const nw = type === "slim" ? 4 : 5;
  // body: neck and a chest that fills the whole hood opening, so nothing dark shows through
  const b = new Canvas();
  b.rect(24 - nw, 29, 23 + nw, 36, "s");
  b.ell(24, 36, 9, 5, "s");
  b.rect(24 - nw, 33, 23 + nw, 34, "S");

  const body = b.toPart(`body.${type}`, "body");

  // hoodie: hood bunched behind the neck, then the shoulders
  const h = new Canvas();
  h.ell(24, 34, 13, 5.8, "c");
  const sh = new Canvas();
  sh.ell(24, 52, full, 18, "c");
  for (let y = 0; y < 34; y++) for (let x = 0; x < 48; x++) sh.set(x, y, ".");
  for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) if (sh.get(x, y) !== ".") h.set(x, y, "c");
  // shade: right shoulder edge and sleeve seams, a soft fold either side of the opening
  for (let y = 34; y < 48; y++) {
    let xr = 47;
    while (xr > 0 && h.get(xr, y) === ".") xr--;
    for (let k = 0; k < 3; k++) if (h.get(xr - k, y) === "c") h.set(xr - k, y, "C");
    const seam = xr - 8;
    if (y >= 41 && h.get(seam, y) === "c") h.set(seam, y, "C");
    let xl = 0;
    while (xl < 47 && h.get(xl, y) === ".") xl++;
    if (y >= 41 && h.get(xl + 8, y) === "c") h.set(xl + 8, y, "C");
  }
  for (let y = 36; y <= 40; y++) { h.set(14 - (y - 36), y, "C"); h.set(33 + (y - 36), y, "C"); }
  // outline the outside first, so the opening gets a soft edge instead of a dark ring
  h.outline("o");
  const { cx, cy, rx, ry, rim } = NECKLINE;
  const inEll = (x: number, y: number, ex: number, ey: number) => ((x + 0.5 - cx) / ex) ** 2 + ((y + 0.5 - cy) / ey) ** 2 <= 1;
  const t = new Canvas();
  for (let y = 0; y < 48; y++)
    for (let x = 0; x < 48; x++) {
      if (h.get(x, y) === ".") continue;
      if (inEll(x, y, rx, ry)) {
        const neck = x >= 24 - nw && x <= 23 + nw;
        h.set(x, y, neck ? "." : "C"); // hood lining either side of the neck
      } else if (inEll(x, y, rx + rim, ry + rim)) t.set(x, y, "t"); // the visible hood rim
    }
  // drawstrings hang from the rim, centred under the opening, each ending in a tip
  for (const x of [16, 31]) { // mirror pair about the grid centre, one pixel clear of the 12 wide patch (x18..29)
    for (let y = 35; y <= 43; y++) t.set(x, y, "t");
    t.set(x, 44, "x"); t.set(x, 45, "x");
  }
  return {
    body,
    hoodie: h.toPart(`hoodie.${type}`, "hoodie"),
    trim: t.toPart(`hoodieTrim.${type}`, "hoodieTrim"),
  };
}

export const builds: Record<BodyType, Build> = { slim: make("slim"), broad: make("broad") };
