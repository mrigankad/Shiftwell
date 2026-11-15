import type { Palette, Provider, Recipe, Theme } from "./types.js";

export interface SkinTone { skin: string; shade: string; blush: string }

export const skinTones: Record<string, SkinTone> = {
  porcelain: { skin: "#FBDCCB", shade: "#EBB9A3", blush: "#F29B9B" },
  light: { skin: "#F5CBA9", shade: "#DDA687", blush: "#EE9494" },
  tan: { skin: "#E3AB7E", shade: "#C68A62", blush: "#E58585" },
  golden: { skin: "#CF9460", shade: "#AE7248", blush: "#D97878" },
  brown: { skin: "#A96F48", shade: "#885230", blush: "#C96A63" },
  deep: { skin: "#7C4C30", shade: "#5E3722", blush: "#A5504A" },
  ebony: { skin: "#5C3727", shade: "#43281C", blush: "#8A433F" },
};

export interface HairTone { hair: string; shade: string; light: string }
/** Hand-picked: base, shade (outline and under-fringe) and highlight per colour. */
export const hairColors: Record<string, HairTone> = {
  black: { hair: "#2B2430", shade: "#16111E", light: "#4D4360" },
  darkBrown: { hair: "#4B3329", shade: "#2B1A1D", light: "#745346" },
  chestnut: { hair: "#7A4A2E", shade: "#4D2824", light: "#A8704A" },
  auburn: { hair: "#A5442B", shade: "#6A2127", light: "#D06E48" },
  ginger: { hair: "#D9722F", shade: "#9E4325", light: "#F7A25C" },
  blonde: { hair: "#E9C778", shade: "#B08648", light: "#FFE9AE" },
  platinum: { hair: "#F1E7D2", shade: "#B3A184", light: "#FFFAEE" },
  silver: { hair: "#BEC4D3", shade: "#767E98", light: "#E6EAF3" },
  pink: { hair: "#F08BB1", shade: "#B9547F", light: "#FFBDD3" },
  lavender: { hair: "#B79EF2", shade: "#7A62BE", light: "#DDCEFF" },
  blue: { hair: "#5B8DEF", shade: "#3050B0", light: "#92B8FF" },
  teal: { hair: "#3FBFB0", shade: "#1B7F7B", light: "#7BE6D6" },
  burgundy: { hair: "#7B2A41", shade: "#481530", light: "#A84C66" },
};

const darker = (hex: string, f = 0.72): string => {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.round(v * f).toString(16).padStart(2, "0");
  return `#${c((n >> 16) & 255)}${c((n >> 8) & 255)}${c(n & 255)}`;
};

/** Fallback only, for custom #hex colours that have no hand-picked shade. */
const lighter = (hex: string, f = 0.35): string => {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.round(v + (255 - v) * f).toString(16).padStart(2, "0");
  return `#${c((n >> 16) & 255)}${c((n >> 8) & 255)}${c(n & 255)}`;
};

/** Hand-picked: the shade leans toward violet so it sits well on the night backgrounds. */
export const hoodieColors: Record<string, { hoodie: string; shade: string }> = {
  ink: { hoodie: "#1D2230", shade: "#11141F" },
  charcoal: { hoodie: "#323846", shade: "#202533" },
  terracotta: { hoodie: "#D97757", shade: "#AB4F45" },
  cream: { hoodie: "#EFE6D3", shade: "#C6B59C" },
  sage: { hoodie: "#7FA88B", shade: "#56806D" },
  sky: { hoodie: "#5B8DEF", shade: "#3A5FBC" },
  indigo: { hoodie: "#4B54C9", shade: "#2F359F" },
  plum: { hoodie: "#8A4A86", shade: "#5E2F66" },
  rose: { hoodie: "#E4789A", shade: "#B4507A" },
  mustard: { hoodie: "#E0A93B", shade: "#B27829" },
  teal: { hoodie: "#2A8F8A", shade: "#1A6265" },
  forest: { hoodie: "#2F5D46", shade: "#1D3C37" },
  scarlet: { hoodie: "#D44A4A", shade: "#A12F3F" },
  navy: { hoodie: "#1F2A55", shade: "#121A3C" },
};

export const trimColors: Record<string, string> = {
  white: "#FFFFFF", cream: "#F6EBD3", lime: "#9BE22B", orange: "#FF7A3D", sky: "#8FC1FF",
  pink: "#FF9CC2", gold: "#FFCB4A", lavender: "#C9B6FF", slate: "#8A93A8",
};

export const eyeColors: Record<string, string> = {
  ink: "#241923", brown: "#4A2E22", hazel: "#6B4A22", navy: "#2B3A6B", forest: "#2F5D46", violet: "#4C3478",
};

export interface Brand { logoA: string; logoB: string; hoodie: string; trim: string }
/** Marks sit on a cream patch, so every brand colour is chosen to read on cream. */
export const providerBrands: Record<Provider, Brand> = {
  claude: { logoA: "#D97757", logoB: "#B2543F", hoodie: "terracotta", trim: "cream" },
  codex: { logoA: "#1B1B1F", logoB: "#10A37F", hoodie: "charcoal", trim: "white" },
  gemini: { logoA: "#4C7DF0", logoB: "#A66BF2", hoodie: "indigo", trim: "lavender" },
  kimi: { logoA: "#1783FF", logoB: "#1B1B1F", hoodie: "navy", trim: "sky" },
  grok: { logoA: "#1B1B1F", logoB: "#7A8094", hoodie: "ink", trim: "white" },
  deepseek: { logoA: "#4D6BFE", logoB: "#FFFFFF", hoodie: "sky", trim: "white" },
  nim: { logoA: "#76B900", logoB: "#1B1B1F", hoodie: "ink", trim: "lime" },
  ollama: { logoA: "#1B1B1F", logoB: "#FFFFFF", hoodie: "cream", trim: "orange" },
  custom: { logoA: "#FF7A3D", logoB: "#FFC15E", hoodie: "charcoal", trim: "orange" },
};

export const themes: Record<Theme, { bg1: string; bg2: string }> = {
  midnight: { bg1: "#141A36", bg2: "#262D5A" },
  plum: { bg1: "#21152E", bg2: "#3D2551" },
  teal: { bg1: "#0F2230", bg2: "#1D4054" },
  ember: { bg1: "#241818", bg2: "#432A27" },
};

export const OUTLINE = "#2A1E2B";
export const WHITE = "#FFEFD2";

const pick = <T,>(table: Record<string, T>, key: string, what: string): T => {
  const v = table[key];
  if (!v) throw new Error(`Unknown ${what} "${key}"`);
  return v;
};
const isHex = (s: string) => s.startsWith("#");

export function resolvePalette(r: Recipe): Palette {
  const skin = pick(skinTones, r.skinTone, "skin tone");
  const hair: HairTone = isHex(r.hair.color)
    ? { hair: r.hair.color, shade: darker(r.hair.color, 0.68), light: lighter(r.hair.color) }
    : pick(hairColors, r.hair.color, "hair colour");
  const hood = isHex(r.hoodie.color)
    ? { hoodie: r.hoodie.color, shade: darker(r.hoodie.color) }
    : pick(hoodieColors, r.hoodie.color, "hoodie colour");
  const brand = providerBrands[r.logo];
  const bg = themes[r.background.theme];
  const p: Palette = {
    skin: skin.skin, skinShade: skin.shade, blush: skin.blush,
    hair: hair.hair, hairShade: hair.shade, hairLight: hair.light,
    eye: isHex(r.eyeColor ?? "") ? r.eyeColor! : eyeColors[r.eyeColor ?? "ink"] ?? eyeColors.ink!,
    hoodie: hood.hoodie, hoodieShade: hood.shade,
    trim: isHex(r.hoodie.trim) ? r.hoodie.trim : pick(trimColors, r.hoodie.trim, "trim colour"),
    logoA: brand.logoA, logoB: brand.logoB,
    accent: r.accent ?? "#FF7A3D",
    accessory1: r.accessoryColors?.accessory1 ?? r.accent ?? "#FF7A3D",
    accessory2: r.accessoryColors?.accessory2 ?? r.accessoryColors?.accessory1 ?? r.accent ?? "#FF7A3D",
    outline: OUTLINE, white: WHITE, bg1: bg.bg1, bg2: bg.bg2,
  };
  return { ...p, ...(r.overrides ?? {}) };
}
