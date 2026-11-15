import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";
import { crew } from "./crew.js";
import { logoGlyphs } from "./logos.js";
import { providerBrands } from "./palette.js";
import type { Provider } from "./types.js";
import { writeCatalog } from "./catalog.js";
import { renderSvg } from "./render.js";

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "out");
mkdirSync(out, { recursive: true });
for (const r of crew) {
  writeFileSync(join(out, `${r.id}.svg`), renderSvg(r, { scale: 10, background: true }));
  const png = new Resvg(renderSvg(r, { scale: 1, background: true }), { fitTo: { mode: "width", value: 480 }, shapeRendering: 0 }).render().asPng();
  writeFileSync(join(out, `${r.id}.png`), png);
}
mkdirSync(join(out, "logos"), { recursive: true });
for (const p of Object.keys(logoGlyphs) as Provider[]) {
  const b = providerBrands[p];
  const rects = logoGlyphs[p].flatMap((row, y) => [...row].map((ch, x) => (ch === "." ? "" : `<rect x="${x}" y="${y}" width="1" height="1" fill="${ch === "a" ? b.logoA : b.logoB}"/>`))).join("");
  writeFileSync(join(out, "logos", `${p}.svg`), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8" width="64" height="64" shape-rendering="crispEdges">${rects}</svg>`);
}
writeCatalog(out);
console.log(`wrote ${crew.length} characters to ${out}`);
