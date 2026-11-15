import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { crew } from "./crew.js";
import { logoGlyphs } from "./logos.js";
import { hairStyles } from "./parts/index.js";
import { renderLayers, renderSvg } from "./render.js";
import type { Accessory, EyeStyle, BrowStyle, MouthStyle, Provider, Recipe } from "./types.js";

/** Assets for design tools: exploded layers, parts on a neutral mannequin, edit variants. */
export function writeCatalog(out: string): void {
  const dir = (n: string) => { const d = join(out, n); mkdirSync(d, { recursive: true }); return d; };
  const mannequin: Recipe = {
    id: "mannequin", name: "Mannequin", provider: "custom", bodyType: "slim", skinTone: "light",
    hair: { style: "short", color: "darkBrown" }, eyes: "round", brows: "soft", mouth: "smile", blush: true,
    hoodie: { color: "charcoal", trim: "orange" }, logo: "custom", accessories: [],
    background: { scene: "plain", theme: "midnight" },
  };
  const crop = (svg: string, x: number, y: number, w: number, h: number, px: number) =>
    svg.replace(/viewBox="[^"]*"/, `viewBox="${x} ${y} ${w} ${h}"`).replace(/width="\d+" height="\d+"/, `width="${px}" height="${Math.round((px * h) / w)}"`);

  // anatomy: Aria, layer by layer
  const a = dir("anatomy");
  const aria = crew.find((c) => c.id === "aria")!;
  renderLayers(aria, 3).forEach((l, i) => writeFileSync(join(a, `${String(i).padStart(2, "0")}-${l.name}.svg`), l.svg));
  writeFileSync(join(a, "final.svg"), renderSvg(aria, { scale: 8 }));

  const p = dir("parts");
  for (const h of hairStyles) writeFileSync(join(p, `hair-${h}.svg`), renderSvg({ ...mannequin, hair: { style: h, color: "chestnut" } }, { scale: 4, background: false }));
  for (const e of ["round", "sparkle", "happy"] as EyeStyle[]) writeFileSync(join(p, `eyes-${e}.svg`), crop(renderSvg({ ...mannequin, eyes: e }, { background: false }), 10, 16, 28, 17, 168));
  for (const b of ["soft", "arched", "none"] as BrowStyle[]) writeFileSync(join(p, `brows-${b}.svg`), crop(renderSvg({ ...mannequin, brows: b }, { background: false }), 10, 14, 28, 17, 168));
  for (const m of ["smile", "open", "cat"] as MouthStyle[]) writeFileSync(join(p, `mouth-${m}.svg`), crop(renderSvg({ ...mannequin, mouth: m }, { background: false }), 10, 16, 28, 17, 168));
  for (const ac of ["glasses", "headphones", "beanie", "visor", "starClip", "moonClip"] as Accessory[])
    writeFileSync(join(p, `acc-${ac}.svg`), renderSvg({ ...mannequin, accessories: [ac], accent: "#FF7A3D" }, { scale: 4, background: false }));
  for (const b of ["slim", "broad"] as const) writeFileSync(join(p, `build-${b}.svg`), renderSvg({ ...mannequin, bodyType: b }, { scale: 4, background: false }));
  for (const pr of Object.keys(logoGlyphs) as Provider[])
    writeFileSync(join(p, `logo-${pr}.svg`), crop(renderSvg({ ...mannequin, logo: pr, hoodie: { color: "charcoal", trim: "orange" } }, { background: false }), 15, 34, 18, 14, 144));

  // edit variants of Aria
  const v = dir("variants");
  const variants: Record<string, Recipe> = {
    "1-original": aria,
    "2-hoodie": { ...aria, hoodie: { color: "sky", trim: "white" } },
    "3-hair": { ...aria, hair: { style: "bob", color: "blonde" } },
    "4-accessory": { ...aria, accessories: ["headphones"], accent: "#FF7A3D" },
    "5-skin": { ...aria, skinTone: "deep", eyeColor: "ink" },
    "6-everything": { ...aria, hair: { style: "buns", color: "pink" }, hoodie: { color: "sage", trim: "cream" }, skinTone: "porcelain", accessories: ["glasses", "moonClip"], eyes: "happy", mouth: "cat", background: { scene: "stars", theme: "plum" } },
  };
  for (const [k, r] of Object.entries(variants)) writeFileSync(join(v, `${k}.svg`), renderSvg(r, { scale: 6 }));
}
