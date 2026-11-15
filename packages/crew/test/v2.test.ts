import { describe, expect, it } from "vitest";
import { crew, hairColors, hoodieColors, logoMarks, logoPatch, parts, renderLayers, renderPixels, renderSvg, resolvePalette, type Recipe } from "../src/index.js";

const base = (over: Partial<Recipe> = {}): Recipe => ({ ...structuredClone(crew[0]!), accessories: [], ...over });
const count = (r: Recipe, slot: string) => renderPixels(r).flat().filter((s) => s === slot).length;

describe("hair", () => {
  const styles = parts.hairStyles;
  it("includes the two asymmetric styles, which are not their own mirror image", () => {
    expect(styles).toContain("sidePart");
    expect(styles).toContain("sidePonytail");
    for (const k of ["sidePart", "sidePonytail"] as const) {
      const f = parts.hairs[k].front;
      const placed = f.rows.map((r) => ".".repeat(f.x) + r + ".".repeat(48 - f.x - r.length));
      const mirrored = placed.map((r) => [...r].reverse().join(""));
      expect(placed.join("|")).not.toBe(mirrored.join("|"));
    }
  });
  it("every style leaves the forehead, brows and eyes open", () => {
    for (const h of styles) {
      const f = parts.hairs[h].front;
      f.rows.forEach((row, ry) =>
        [...row].forEach((ch, rx) => {
          const x = f.x + rx, y = f.y + ry;
          if (ch !== "." && x >= 16 && x <= 31 && y >= 17 && y <= 28) throw new Error(`${h} hair covers the face at ${x},${y}`);
        }),
      );
    }
  });
  it("front hair has a shade row and highlight pixels", () => {
    for (const h of styles) {
      const rows = parts.hairs[h].front.rows.join("");
      expect(rows, h).toContain("H");
      expect(rows, h).toContain("L");
    }
  });
  it("long falls much further than wavy", () => {
    expect(parts.hairs.long.front.rows.length).toBeGreaterThan(parts.hairs.wavy.front.rows.length + 4);
  });
  it("ponytail styles carry an accent hair tie", () => {
    expect(parts.hairs.ponytail.front.rows.join("")).toContain("x");
    expect(parts.hairs.sidePonytail.front.rows.join("")).toContain("x");
  });
  it("hair colours are hand picked with a shade and a light", () => {
    for (const [k, v] of Object.entries(hairColors)) {
      expect(v.shade, k).toMatch(/^#[0-9A-F]{6}$/i);
      expect(v.light, k).toMatch(/^#[0-9A-F]{6}$/i);
      expect(new Set([v.hair, v.shade, v.light]).size).toBe(3);
    }
    const p = resolvePalette(base({ hair: { style: "short", color: "ginger" } }));
    expect(p.hairShade).toBe(hairColors.ginger!.shade);
    expect(p.hairLight).toBe(hairColors.ginger!.light);
  });
});

describe("hoodie shades", () => {
  it("come from the table, not from darkening in code", () => {
    const p = resolvePalette(base({ hoodie: { color: "mustard", trim: "white" } }));
    expect(p.hoodieShade).toBe(hoodieColors.mustard!.shade);
    expect(p.hoodieShade).toBe("#B27829");
  });
});

describe("logos", () => {
  const providers = Object.keys(logoMarks) as (keyof typeof logoMarks)[];
  it("default patch is 12x12 with a 10x10 mark inside", () => {
    expect(providers).toHaveLength(9);
    for (const p of providers) {
      expect(logoMarks[p]).toHaveLength(10);
      logoMarks[p].forEach((r) => expect(r).toHaveLength(10));
      const patch = parts.logoPatches[p];
      expect(patch.id).toBe(`logo.${p}`);
      expect(patch.rows).toHaveLength(12);
      patch.rows.forEach((r) => expect(r).toHaveLength(12));
      expect(patch.x + 12).toBeLessThanOrEqual(48);
      expect(patch.y + 12).toBeLessThanOrEqual(48);
    }
  });
  it("the 8x8 glyph patch stays available", () => {
    for (const p of providers) {
      const patch = logoPatch(p, 8);
      expect(patch.id).toBe(`logo8.${p}`);
      expect(patch.rows).toHaveLength(10);
      expect(parts.logoPatches8[p].rows).toEqual(patch.rows);
    }
  });
  it("recipe.logoSize switches between them", () => {
    const r = base();
    const find = (x: Recipe) => renderLayers(x).find((l) => l.name === "logoPatch")!.parts;
    expect(find(r)).toEqual(["logo.claude"]);
    expect(find({ ...r, logoSize: 8 })).toEqual(["logo8.claude"]);
  });
  it("marks are distinct and not blank", () => {
    for (const p of providers) expect(logoMarks[p].join("").replaceAll(".", "").length, p).toBeGreaterThan(20);
    expect(new Set(providers.map((p) => logoMarks[p].join("/"))).size).toBe(providers.length);
  });
});

describe("neckline", () => {
  const pix = renderPixels(base());
  it("has no outline-dark pixels around the patch", () => {
    for (let y = 33; y < 48; y++) for (let x = 14; x < 34; x++) expect(pix[y]![x], `${x},${y}`).not.toBe("outline");
  });
  it("has a visible hood rim", () => {
    let rim = 0;
    for (let y = 33; y <= 37; y++) for (let x = 14; x < 34; x++) if (pix[y]![x] === "trim") rim++;
    expect(rim).toBeGreaterThan(15);
  });
  it("drawstrings are mirrored about the centre, under the opening", () => {
    for (const type of ["slim", "broad"] as const) {
      const g = renderPixels(base({ bodyType: type }));
      const cols: number[] = [];
      for (let x = 0; x < 48; x++) if (g[41]![x] === "trim") cols.push(x);
      expect(cols).toHaveLength(2);
      expect(cols[0]! + cols[1]!).toBe(47);
      expect(cols[0]!).toBeGreaterThan(12);
      expect(cols[1]!).toBeLessThan(35);
    }
  });
});

describe("brows", () => {
  const ids = ["soft", "flat", "arched", "raised", "angry", "worried"] as const;
  it("are 2 to 3 pixels each side, mirrored, and all different", () => {
    const seen = new Set<string>();
    for (const b of ids) {
      const p = parts.brows[b];
      let left = 0, right = 0;
      p.rows.forEach((row) => [...row].forEach((ch, i) => { if (ch === "H") (p.x + i < 24 ? left++ : right++); }));
      expect(left, b).toBeGreaterThanOrEqual(2);
      expect(left, b).toBeLessThanOrEqual(3);
      expect(right, b).toBe(left);
      seen.add(`${p.y}|${p.rows.join("/")}`);
    }
    expect(seen.size).toBe(ids.length);
    expect(parts.brows.none.rows).toHaveLength(0);
  });
  it("angry slopes down toward the nose and worried the other way", () => {
    const at = (b: "angry" | "worried", x: number) => {
      const p = parts.brows[b];
      for (let r = 0; r < p.rows.length; r++) if (p.rows[r]![x - p.x] === "H") return p.y + r;
      return -1;
    };
    expect(at("angry", 16)).toBeLessThan(at("angry", 18));
    expect(at("worried", 19)).toBeLessThan(at("worried", 16));
  });
});

describe("accessory colour slots", () => {
  const two = (): Recipe => base({ accessories: ["headphones", "starClip"], accessoryColors: { accessory1: "#112233", accessory2: "#AABBCC" } });
  it("first accessory paints accessory1, second paints accessory2", () => {
    expect(count(two(), "accessory1")).toBeGreaterThan(0);
    expect(count(two(), "accessory2")).toBeGreaterThan(0);
    expect(count(base({ accessories: ["headphones"] }), "accessory2")).toBe(0);
  });
  it("changing one slot recolours only that accessory", () => {
    const a = renderSvg(two()), b = renderSvg({ ...two(), accessoryColors: { accessory1: "#112233", accessory2: "#FF0000" } });
    expect(a).not.toBe(b);
    expect(a.replaceAll('fill="#AABBCC"', 'fill="#FF0000"')).toBe(b);
  });
  it("accessory2 defaults to accessory1, and both default to accent", () => {
    const p = resolvePalette(base({ accent: "#123456", accessoryColors: undefined }));
    expect(p.accessory1).toBe("#123456");
    expect(p.accessory2).toBe("#123456");
    expect(resolvePalette(base({ accessoryColors: { accessory1: "#ABCDEF" } })).accessory2).toBe("#ABCDEF");
  });
  it("can be overridden like any slot", () => {
    expect(resolvePalette(base({ overrides: { accessory2: "#00FF00" } })).accessory2).toBe("#00FF00");
  });
});

describe("visor", () => {
  it("has a brim wider than its band, with an underside", () => {
    const v = parts.accessories.visor;
    expect(v.rows.length).toBeGreaterThanOrEqual(7);
    const widths = v.rows.map((r) => r.replaceAll(".", "").length);
    expect(Math.max(...widths)).toBeGreaterThan(widths[0]! + 8);
    expect(v.rows.join("")).toContain("o");
    expect(v.rows.join("")).toContain("p");
  });
});

describe("crew", () => {
  it("now has 16 characters including both asymmetric hair styles", () => {
    expect(crew.length).toBeGreaterThanOrEqual(16);
    expect(crew.some((c) => c.hair.style === "sidePart")).toBe(true);
    expect(crew.some((c) => c.hair.style === "sidePonytail")).toBe(true);
    expect(crew.some((c) => c.accessories.length === 2)).toBe(true);
  });
});
