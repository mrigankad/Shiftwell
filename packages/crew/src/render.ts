import { resolvePalette } from "./palette.js";
import { accessories, backgrounds, blush, brows, builds, ears, eyes, hairs, head, logoPatches, logoPatches8, mouths } from "./parts/index.js";
import { GRID, KEYS, LAYERS, type LayerName, type Palette, type Part, type Recipe, type Slot } from "./types.js";

function recolour(p: Part, from: string, to: string): Part {
  return { ...p, rows: p.rows.map((row) => row.replaceAll(from, to)) };
}

/** Which parts a recipe uses, per layer, in back-to-front layer order. */
export function layerParts(r: Recipe): Record<LayerName, Part[]> {
  const b = builds[r.bodyType];
  const h = hairs[r.hair.style];
  return {
    background: [backgrounds[r.background.scene]],
    hairBack: [h.back],
    body: [b.body],
    hoodie: [b.hoodie],
    hoodieTrim: [b.trim],
    logoPatch: [(r.logoSize === 8 ? logoPatches8 : logoPatches)[r.logo]],
    head: [head],
    ears: [ears],
    eyes: [eyes[r.eyes]],
    brows: [brows[r.brows]],
    mouth: [mouths[r.mouth]],
    blush: r.blush === false ? [] : [blush],
    hairFront: [h.front],
    // the 1st worn accessory paints with accessory1, any later one with accessory2
    accessories: r.accessories.map((a, i) => (i === 0 ? accessories[a] : recolour(accessories[a], "p", "q"))),
  };
}

function slotOf(ch: string): Slot {
  const s = KEYS[ch];
  if (!s) throw new Error(`Unknown pixel key "${ch}"`);
  return s;
}

function rectsFor(parts: Part[], pal: Palette): string {
  let out = "";
  for (const p of parts) {
    p.rows.forEach((row, ry) => {
      let i = 0;
      while (i < row.length) {
        const ch = row[i]!;
        if (ch === ".") { i++; continue; }
        let j = i + 1;
        while (j < row.length && row[j] === ch) j++;
        out += `<rect x="${p.x + i}" y="${p.y + ry}" width="${j - i}" height="1" fill="${pal[slotOf(ch)]}"/>`;
        i = j;
      }
    });
  }
  return out;
}

const svgWrap = (inner: string, scale: number) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${GRID} ${GRID}" width="${GRID * scale}" height="${GRID * scale}" shape-rendering="crispEdges">${inner}</svg>`;

export interface RenderedLayer { name: LayerName; parts: string[]; rects: string; svg: string }

/** Each layer on its own, for layer editors and the exploded view. */
export function renderLayers(r: Recipe, scale = 1): RenderedLayer[] {
  const pal = resolvePalette(r);
  const lp = layerParts(r);
  return LAYERS.map((name) => {
    const rects = rectsFor(lp[name], pal);
    return { name, parts: lp[name].map((p) => p.id), rects, svg: svgWrap(rects, scale) };
  });
}

export function renderSvg(r: Recipe, opts: { scale?: number; background?: boolean } = {}): string {
  const scale = opts.scale ?? 1;
  const bg = opts.background ?? true;
  const inner = renderLayers(r)
    .filter((l) => bg || l.name !== "background")
    .map((l) => (l.rects ? `<g id="${l.name}">${l.rects}</g>` : ""))
    .join("");
  return svgWrap(inner, scale);
}

/** Final composited pixels as slot names (null = transparent). Used by tests and the editor. */
export function renderPixels(r: Recipe): (Slot | null)[][] {
  const grid: (Slot | null)[][] = Array.from({ length: GRID }, () => Array<Slot | null>(GRID).fill(null));
  const lp = layerParts(r);
  for (const name of LAYERS)
    for (const p of lp[name])
      p.rows.forEach((row, ry) =>
        [...row].forEach((ch, rx) => {
          if (ch === ".") return;
          const x = p.x + rx, y = p.y + ry;
          if (x >= 0 && y >= 0 && x < GRID && y < GRID) grid[y]![x] = slotOf(ch);
        }),
      );
  return grid;
}
