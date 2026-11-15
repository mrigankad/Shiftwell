import { describe, expect, it } from "vitest";
import { crew, renderLayers, renderPixels, renderSvg, resolvePalette, parts, logoGlyphs, SLOTS, KEYS, LAYERS } from "../src/index.js";

describe("parts", () => {
  it("have consistent row widths and only known slot keys", () => {
    for (const p of parts.allParts()) {
      expect(LAYERS).toContain(p.layer);
      const w = p.rows[0]?.length ?? 0;
      for (const r of p.rows) {
        expect(r.length, p.id).toBe(w);
        for (const ch of r) expect(ch === "." || KEYS[ch] !== undefined, `${p.id} key ${ch}`).toBe(true);
      }
      if (p.rows.length) {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x + w).toBeLessThanOrEqual(48);
        expect(p.y + p.rows.length).toBeLessThanOrEqual(48);
      }
    }
  });
  it("logo glyphs are 8x8", () => {
    for (const g of Object.values(logoGlyphs)) {
      expect(g).toHaveLength(8);
      g.forEach((r) => expect(r).toHaveLength(8));
    }
  });
  it("has at least 8 hairstyles, each with back and front", () => {
    expect(parts.hairStyles.length).toBeGreaterThanOrEqual(8);
    for (const h of parts.hairStyles) {
      expect(parts.hairs[h].back.rows.length).toBeGreaterThan(0);
      expect(parts.hairs[h].front.rows.length).toBeGreaterThan(0);
    }
  });
});

describe("crew", () => {
  it("has 12+ recipes covering every provider", () => {
    expect(crew.length).toBeGreaterThanOrEqual(12);
    for (const p of ["claude", "codex", "gemini", "kimi", "grok", "deepseek", "nim", "ollama", "custom"])
      expect(crew.some((c) => c.provider === p), p).toBe(true);
    expect(crew.filter((c) => c.provider === "custom").length).toBeGreaterThanOrEqual(2);
  });
  it("every recipe renders valid svg", () => {
    for (const r of crew) {
      const svg = renderSvg(r, { scale: 4, background: true });
      expect(svg.startsWith("<svg")).toBe(true);
      expect(svg).toContain('shape-rendering="crispEdges"');
      expect(svg).toContain('width="192"');
      expect(svg).not.toContain("undefined");
      expect(renderLayers(r)).toHaveLength(LAYERS.length);
    }
  });
  it("background:false omits the background layer", () => {
    const a = renderSvg(crew[0]!, { background: true });
    const b = renderSvg(crew[0]!, { background: false });
    expect(a).toContain('id="background"');
    expect(b).not.toContain('id="background"');
  });
  it("rendering is deterministic", () => {
    for (const r of crew) expect(renderSvg(r, { scale: 3 })).toBe(renderSvg(structuredClone(r), { scale: 3 }));
  });
});

describe("recolouring", () => {
  it("changing one slot changes only those pixels", () => {
    const base = crew[0]!;
    const edited = { ...base, hoodie: { ...base.hoodie, color: "sky" } };
    const a = renderPixels(base), b = renderPixels(edited);
    const pa = resolvePalette(base), pb = resolvePalette(edited);
    let changed = 0;
    for (let y = 0; y < 48; y++)
      for (let x = 0; x < 48; x++) {
        const sa = a[y]![x], sb = b[y]![x];
        expect(sa).toBe(sb); // same slot layout
        if (sa) {
          const diff = pa[sa] !== pb[sa];
          if (diff) changed++;
          if (sa !== "hoodie" && sa !== "hoodieShade") expect(pa[sa]).toBe(pb[sa]);
        }
      }
    expect(changed).toBeGreaterThan(0);
    for (const s of SLOTS) if (s !== "hoodie" && s !== "hoodieShade") expect(pa[s]).toBe(pb[s]);
  });
  it("a slot override swaps only that colour in the svg", () => {
    const base = crew[1]!;
    const old = resolvePalette(base).hair;
    const a = renderSvg(base), b = renderSvg({ ...base, overrides: { hair: "#00FF00" } });
    expect(a).not.toBe(b);
    expect(a.replaceAll(`fill="${old}"`, 'fill="#00FF00"')).toBe(b);
  });
});
