import { mkdirSync, writeFileSync as writeRaw } from "node:fs";
import { Resvg } from "@resvg/resvg-js";
import { join } from "node:path";
import { crew } from "./crew.js";
import { logoGlyphs } from "./logos.js";
import { hairStyles } from "./parts/index.js";
import { renderLayers, renderSvg } from "./render.js";
import type { Accessory, EyeStyle, BrowStyle, MouthStyle, Provider, Recipe } from "./types.js";

/** Every .svg written here gets a pixel-exact .png next to it (same pixel size), small enough to embed in design tools. */
export const svgToPng = (svg: string): Uint8Array => {
  const w = Number(/ width="(\d+)"/.exec(svg)?.[1] ?? 48);
  return new Resvg(svg, { fitTo: { mode: "width", value: w }, shapeRendering: 0 }).render().asPng();
};
const writeFileSync = (path: string, svg: string): void => {
  writeRaw(path, svg);
  if (path.endsWith(".svg")) writeRaw(path.replace(/\.svg$/, ".png"), svgToPng(svg));
};

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
  for (const h of hairStyles) writeFileSync(join(p, `hair-${h}.svg`), crop(renderSvg({ ...mannequin, hair: { style: h, color: "chestnut" } }, { background: false }), 4, 0, 40, 44, 160));
  for (const e of ["round", "sparkle", "happy"] as EyeStyle[]) writeFileSync(join(p, `eyes-${e}.svg`), crop(renderSvg({ ...mannequin, eyes: e }, { background: false }), 10, 16, 28, 17, 168));
  for (const b of ["soft", "flat", "arched", "raised", "angry", "worried", "none"] as BrowStyle[]) writeFileSync(join(p, `brows-${b}.svg`), crop(renderSvg({ ...mannequin, brows: b }, { background: false }), 10, 12, 28, 17, 168));
  for (const m of ["smile", "open", "cat"] as MouthStyle[]) writeFileSync(join(p, `mouth-${m}.svg`), crop(renderSvg({ ...mannequin, mouth: m }, { background: false }), 10, 16, 28, 17, 168));
  for (const ac of ["glasses", "headphones", "beanie", "visor", "starClip", "moonClip"] as Accessory[])
    writeFileSync(join(p, `acc-${ac}.svg`), renderSvg({ ...mannequin, accessories: [ac], accent: "#FF7A3D" }, { scale: 4, background: false }));
  const slots: [string, string][] = [["#FF7A3D", "#FF7A3D"], ["#5B8DEF", "#FF9CC2"], ["#7FD8B5", "#FFCB4A"]];
  slots.forEach(([a1, a2], i) => writeFileSync(join(p, `acc-slots-${i + 1}.svg`), renderSvg({ ...mannequin, accessories: ["headphones", "starClip"], accessoryColors: { accessory1: a1, accessory2: a2 } }, { scale: 4, background: false })));
  for (const b of ["slim", "broad"] as const) writeFileSync(join(p, `build-${b}.svg`), renderSvg({ ...mannequin, bodyType: b }, { scale: 4, background: false }));
  for (const pr of Object.keys(logoGlyphs) as Provider[])
    writeFileSync(join(p, `logo-${pr}.svg`), crop(renderSvg({ ...mannequin, logo: pr, hoodie: { color: "charcoal", trim: "orange" } }, { background: false }), 15, 34, 18, 14, 144));
  for (const pr of Object.keys(logoGlyphs) as Provider[])
    writeFileSync(join(p, `logo8-${pr}.svg`), crop(renderSvg({ ...mannequin, logo: pr, logoSize: 8, hoodie: { color: "charcoal", trim: "orange" } }, { background: false }), 15, 34, 18, 14, 144));

  // thumbnails for editor mock-ups: Aria with one choice changed per tile, pixel exact (2x or 4x of the grid)
  const e = dir("editor");
  const px = (r: Recipe) => renderSvg(r, { background: false });
  for (const h of hairStyles) writeFileSync(join(e, `hair-${h}.svg`), crop(px({ ...aria, accessories: [], hair: { style: h, color: "auburn" } }), 3, 1, 42, 42, 84));
  for (const x of ["round", "sparkle", "happy"] as EyeStyle[]) writeFileSync(join(e, `eyes-${x}.svg`), crop(px({ ...aria, eyes: x, accessories: [] }), 12, 14, 24, 17, 96));
  for (const x of ["soft", "flat", "arched", "raised", "angry", "worried", "none"] as BrowStyle[]) writeFileSync(join(e, `brows-${x}.svg`), crop(px({ ...aria, brows: x, accessories: [] }), 12, 14, 24, 17, 96));
  for (const x of ["smile", "open", "cat"] as MouthStyle[]) writeFileSync(join(e, `mouth-${x}.svg`), crop(px({ ...aria, mouth: x, accessories: [] }), 12, 14, 24, 17, 96));
  for (const b of ["slim", "broad"] as const) writeFileSync(join(e, `build-${b}.svg`), crop(px({ ...aria, bodyType: b, accessories: [] }), 2, 2, 44, 44, 88));
  for (const sc of ["city", "desk", "stars", "plain"] as const) writeFileSync(join(e, `scene-${sc}.svg`), crop(renderSvg({ ...aria, accessories: [], background: { scene: sc, theme: "midnight" } }), 0, 0, 48, 48, 96));
  for (const pr of Object.keys(logoGlyphs) as Provider[]) writeFileSync(join(e, `logo-${pr}.svg`), crop(px({ ...aria, logo: pr, accessories: [] }), 14, 33, 20, 15, 80));
  for (const ac of ["glasses", "headphones", "beanie", "visor", "starClip", "moonClip"] as Accessory[])
    writeFileSync(join(e, `acc-${ac}.svg`), crop(px({ ...aria, accessories: [ac], accessoryColors: { accessory1: "#FF7A3D" } }), 3, 1, 42, 42, 84));
  writeFileSync(join(e, "aria-accessories.svg"), renderSvg({ ...aria, accessories: ["headphones", "starClip"], accessoryColors: { accessory1: "#5B8DEF", accessory2: "#FF9CC2" } }, { scale: 10 }));

  // edit variants of Aria
  const v = dir("variants");
  const variants: Record<string, Recipe> = {
    "1-original": aria,
    "2-hoodie": { ...aria, hoodie: { color: "sky", trim: "white" } },
    "3-hair": { ...aria, hair: { style: "bob", color: "blonde" } },
    "4-accessory": { ...aria, accessories: ["headphones"], accessoryColors: { accessory1: "#FF7A3D" } },
    "5-skin": { ...aria, skinTone: "deep", eyeColor: "ink" },
    "7-two-accessories": { ...aria, accessories: ["headphones", "starClip"], accessoryColors: { accessory1: "#5B8DEF", accessory2: "#FF9CC2" } },
    "8-small-patch": { ...aria, logoSize: 8 },
    "6-everything": { ...aria, hair: { style: "buns", color: "pink" }, hoodie: { color: "sage", trim: "cream" }, skinTone: "porcelain", accessories: ["glasses", "moonClip"], eyes: "happy", mouth: "cat", background: { scene: "stars", theme: "plum" } },
  };
  for (const [k, r] of Object.entries(variants)) writeFileSync(join(v, `${k}.svg`), renderSvg(r, { scale: 4 }));
}
