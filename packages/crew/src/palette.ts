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

export const hairColors: Record<string, { hair: string; shade: string }> = {
  black: { hair: "#2B2430", shade: "#16121B" },
  darkBrown: { hair: "#4B3329", shade: "#2E1F19" },
  chestnut: { hair: "#7A4A2E", shade: "#53301D" },
  auburn: { hair: "#A5442B", shade: "#732C1C" },
  ginger: { hair: "#D9722F", shade: "#A8501D" },
  blonde: { hair: "#E9C778", shade: "#C29B4B" },
  platinum: { hair: "#F1E7D2", shade: "#CDBFA3" },
  silver: { hair: "#BEC4D3", shade: "#8F96AA" },
  pink: { hair: "#F08BB1", shade: "#C85E88" },
  lavender: { hair: "#B79EF2", shade: "#8B72C9" },
  blue: { hair: "#5B8DEF", shade: "#3B63BD" },
  teal: { hair: "#3FBFB0", shade: "#26897D" },
  burgundy: { hair: "#7B2A41", shade: "#531A2B" },
};

const darker = (hex: string, f = 0.72): string => {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.round(v * f).toString(16).padStart(2, "0");
  return `#${c((n >> 16) & 255)}${c((n >> 8) & 255)}${c(n & 255)}`;
};

const hoodieBase: Record<string, string> = {
  ink: "#1D2230", charcoal: "#323846", terracotta: "#D97757", cream: "#EFE6D3",
  sage: "#7FA88B", sky: "#5B8DEF", indigo: "#4B54C9", plum: "#8A4A86",
  rose: "#E4789A", mustard: "#E0A93B", teal: "#2A8F8A", forest: "#2F5D46",
  scarlet: "#D44A4A", navy: "#1F2A55",
};
export const hoodieColors: Record<string, { hoodie: string; shade: string }> = Object.fromEntries(
  Object.entries(hoodieBase).map(([k, v]) => [k, { hoodie: v, shade: darker(v) }]),
);

export const trimColors: Record<string, string> = {
  white: "#FFFFFF", cream: "#F6EBD3", lime: "#9BE22B", orange: "#FF7A3D", sky: "#8FC1FF",
  pink: "#FF9CC2", gold: "#FFCB4A", lavender: "#C9B6FF", slate: "#8A93A8",
};

export const eyeColors: Record<string, string> = {
  ink: "#241923", brown: "#4A2E22", hazel: "#6B4A22", navy: "#2B3A6B", forest: "#2F5D46", violet: "#4C3478",
};

export interface Brand { logoA: string; logoB: string; hoodie: string; trim: string }
export const providerBrands: Record<Provider, Brand> = {
  claude: { logoA: "#D97757", logoB: "#FFD9C7", hoodie: "terracotta", trim: "cream" },
  codex: { logoA: "#FFFFFF", logoB: "#10A37F", hoodie: "charcoal", trim: "white" },
  gemini: { logoA: "#7FA6FF", logoB: "#C58AF9", hoodie: "indigo", trim: "lavender" },
  kimi: { logoA: "#1783FF", logoB: "#FFFFFF", hoodie: "navy", trim: "sky" },
  grok: { logoA: "#F4F4F4", logoB: "#9AA0AE", hoodie: "ink", trim: "white" },
  deepseek: { logoA: "#FFFFFF", logoB: "#10163A", hoodie: "sky", trim: "white" },
  nim: { logoA: "#76B900", logoB: "#101010", hoodie: "ink", trim: "lime" },
  ollama: { logoA: "#FFFFFF", logoB: "#1B1B1F", hoodie: "cream", trim: "orange" },
  custom: { logoA: "#FF7A3D", logoB: "#FFE2B8", hoodie: "charcoal", trim: "orange" },
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
  const hair = isHex(r.hair.color)
    ? { hair: r.hair.color, shade: darker(r.hair.color, 0.68) }
    : pick(hairColors, r.hair.color, "hair colour");
  const hood = isHex(r.hoodie.color)
    ? { hoodie: r.hoodie.color, shade: darker(r.hoodie.color) }
    : pick(hoodieColors, r.hoodie.color, "hoodie colour");
  const brand = providerBrands[r.logo];
  const bg = themes[r.background.theme];
  const p: Palette = {
    skin: skin.skin, skinShade: skin.shade, blush: skin.blush,
    hair: hair.hair, hairShade: hair.shade,
    eye: isHex(r.eyeColor ?? "") ? r.eyeColor! : eyeColors[r.eyeColor ?? "ink"] ?? eyeColors.ink!,
    hoodie: hood.hoodie, hoodieShade: hood.shade,
    trim: isHex(r.hoodie.trim) ? r.hoodie.trim : pick(trimColors, r.hoodie.trim, "trim colour"),
    logoA: brand.logoA, logoB: brand.logoB,
    accent: r.accent ?? "#FF7A3D",
    outline: OUTLINE, white: WHITE, bg1: bg.bg1, bg2: bg.bg2,
  };
  return { ...p, ...(r.overrides ?? {}) };
}
