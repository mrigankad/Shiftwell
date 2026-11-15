import type { BodyType, Part } from "../types.js";
import { Canvas } from "./paint.js";

const FULL: Record<BodyType, number> = { slim: 18, broad: 21 };

export interface Build { body: Part; hoodie: Part; trim: Part }

function make(type: BodyType): Build {
  const full = FULL[type];
  // body: neck + chest skin
  const b = new Canvas();
  const nw = type === "slim" ? 4 : 5;
  b.rect(24 - nw, 29, 23 + nw, 36, "s");
  b.ell(24, 36, nw + 2.5, 5, "s");
  b.rect(24 - nw, 32, 23 + nw, 34, "S");
  b.rect(24 - nw, 35, 23 + nw, 35, "S");
  const body = b.toPart(`body.${type}`, "body");

  // hoodie: hood ring behind neck, then shoulders
  const h = new Canvas();
  h.ell(24, 36, 12.5, 6, "C");
  const sh = new Canvas();
  sh.ell(24, 52, full, 18, "c");
  for (let y = 0; y < 34; y++) for (let x = 0; x < 48; x++) sh.set(x, y, ".");
  for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) if (sh.get(x, y) !== ".") h.set(x, y, "c");
  // shade: right shoulder edge, sleeve seams
  for (let y = 34; y < 48; y++) {
    let xr = 47;
    while (xr > 0 && h.get(xr, y) === ".") xr--;
    for (let k = 0; k < 3; k++) if (h.get(xr - k, y) === "c") h.set(xr - k, y, "C");
    const seam = xr - 8;
    if (y >= 41 && h.get(seam, y) === "c") h.set(seam, y, "C");
  }
  // neck hole
  const hole = new Canvas();
  hole.ell(24, 34.8, 5.6, 3.3, "H");
  const holeCells: [number, number][] = [];
  for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) if (hole.get(x, y) === "H") { h.set(x, y, "."); holeCells.push([x, y]); }
  // trim rim: hoodie pixels touching the hole
  const t = new Canvas();
  for (let y = 0; y < 48; y++)
    for (let x = 0; x < 48; x++) {
      if (h.get(x, y) === ".") continue;
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => hole.get(x + dx!, y + dy!) === "H")) t.set(x, y, "t");
    }
  // drawstrings either side of the logo patch
  for (let y = 38; y <= 46; y++) { t.set(18, y, "t"); t.set(29, y, "t"); }
  t.set(18, 47, "t"); t.set(29, 47, "t");
  // hoodie outline (exterior + neck hole edge)
  h.outline("o");
  return {
    body,
    hoodie: h.toPart(`hoodie.${type}`, "hoodie"),
    trim: t.toPart(`hoodieTrim.${type}`, "hoodieTrim"),
  };
}

export const builds: Record<BodyType, Build> = { slim: make("slim"), broad: make("broad") };
