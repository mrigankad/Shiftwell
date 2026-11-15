import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";
import { crew } from "./crew.js";
import { logoGlyphs, logoPatch } from "./logos.js";
import { WHITE, providerBrands } from "./palette.js";
import type { Provider } from "./types.js";
import { svgToPng, writeCatalog } from "./catalog.js";
import { renderSvg } from "./render.js";

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "out");
mkdirSync(out, { recursive: true });
for (const r of crew) {
  writeFileSync(join(out, `${r.id}.svg`), renderSvg(r, { scale: 10, background: true }));
  const png = new Resvg(renderSvg(r, { scale: 1, background: true }), { fitTo: { mode: "width", value: 480 }, shapeRendering: 0 }).render().asPng();
  writeFileSync(join(out, `${r.id}.png`), png);
}
// 4x PNGs (192px) for design tools: small and pixel exact when shown at 192
mkdirSync(join(out, "png4"), { recursive: true });
for (const r of crew) writeFileSync(join(out, "png4", `${r.id}.png`), svgToPng(renderSvg(r, { scale: 4, background: true })));
mkdirSync(join(out, "logos", "glyph8"), { recursive: true });
const rectsOf = (rows: string[], map: (ch: string) => string | null) =>
  rows.flatMap((row, y) => [...row].map((ch, x) => { const f = map(ch); return f ? `<rect x="${x}" y="${y}" width="1" height="1" fill="${f}"/>` : ""; })).join("");
const wrap = (n: number, inner: string, px: number) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" width="${px}" height="${px}" shape-rendering="crispEdges">${inner}</svg>`;
for (const p of Object.keys(logoGlyphs) as Provider[]) {
  const b = providerBrands[p];
  const pal: Record<string, string> = { a: b.logoA, A: b.logoB, w: WHITE, C: "#3A3350" };
  // default: the 12x12 chest patch; glyph8: the original 8x8 glyph on its own
  const patchSvg = (px: number) => wrap(12, rectsOf(logoPatch(p).rows, (ch) => (ch === "." ? null : pal[ch]!)), px);
  writeFileSync(join(out, "logos", `${p}.svg`), patchSvg(144));
  writeFileSync(join(out, "logos", `${p}.png`), svgToPng(patchSvg(144)));
  mkdirSync(join(out, "logos", "icon"), { recursive: true }); // 24px (2x) badge, for tiny labels
  writeFileSync(join(out, "logos", "icon", `${p}.png`), svgToPng(patchSvg(24)));
  writeFileSync(join(out, "logos", "glyph8", `${p}.svg`), wrap(8, rectsOf(logoGlyphs[p], (ch) => (ch === "." ? null : ch === "a" ? b.logoA : b.logoB)), 64));
}
writeCatalog(out);
console.log(`wrote ${crew.length} characters to ${out}`);
