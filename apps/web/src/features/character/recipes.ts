import {
  crew, parts, renderSvg, skinTones, hairColors, hoodieColors, trimColors, eyeColors, themes, providerBrands,
  type Accessory, type BodyType, type BrowStyle, type EyeStyle, type HairStyle, type MouthStyle, type Provider as CrewProvider,
  type Recipe, type Scene, type Theme,
} from "@shiftwell/crew";
import type { Provider } from "../../api";

export type { Recipe };

const keys = <T extends object>(o: T) => Object.keys(o) as (keyof T & string)[];

/** Every choice the editor offers, read from the crew library so new parts show up without changes here. */
export const CHOICES = {
  body: keys(parts.builds) as BodyType[],
  hair: keys(parts.hairs) as HairStyle[],
  eyes: keys(parts.eyes) as EyeStyle[],
  brows: keys(parts.brows) as BrowStyle[],
  mouth: keys(parts.mouths) as MouthStyle[],
  accessories: keys(parts.accessories) as Accessory[],
  scenes: keys(parts.backgrounds) as Scene[],
  themes: keys(themes) as Theme[],
  logos: keys(providerBrands) as CrewProvider[],
  skin: keys(skinTones),
  hairColors: keys(hairColors),
  hoodieColors: keys(hoodieColors),
  trimColors: keys(trimColors),
  eyeColors: keys(eyeColors),
};

export const ACCENTS: { id: string; label: string }[] = [
  { id: "#FF7A3D", label: "Orange" }, { id: "#FFCB4A", label: "Gold" }, { id: "#FFE08A", label: "Butter" },
  { id: "#76B900", label: "Lime" }, { id: "#8FC1FF", label: "Sky" }, { id: "#C9B6FF", label: "Lavender" },
  { id: "#FF9CC2", label: "Pink" }, { id: "#2B2F3A", label: "Graphite" },
];

/** "darkBrown" becomes "Dark brown". */
export const nice = (id: string): string => {
  const s = id.replace(/([A-Z])/g, " $1").toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export const LOGO_LABEL: Record<string, string> = { claude: "Claude", codex: "Codex", gemini: "Gemini", kimi: "Kimi", grok: "Grok", deepseek: "DeepSeek", nim: "NVIDIA NIM", ollama: "Ollama", custom: "Custom" };

/** The crew art provider an account wears: its own CLI, or the preset it talks to. Mirrors core's crewProviderOf. */
export function crewProvider(provider: Provider, preset?: string): CrewProvider {
  if (provider !== "api") return provider;
  switch (preset) {
    case "kimi": case "grok": case "deepseek": case "nim": return preset;
    case "ollama-cloud": case "ollama": return "ollama";
    default: return "custom";
  }
}

const defaults = new Map<string, Recipe>();
/** The recipe for a provider tile that belongs to no account: the polished crew mascot for that provider. */
export function providerDefault(provider: Provider, preset?: string): Recipe {
  const p = crewProvider(provider, preset);
  let r = defaults.get(p);
  if (!r) { r = crew.find((c) => c.provider === p) ?? crew[0]!; defaults.set(p, r); }
  return r;
}

/** Brand hoodie, trim and logo for a provider: what "Match the provider" restores. */
export function brandFor(p: CrewProvider): Pick<Recipe, "hoodie" | "logo"> {
  const b = providerBrands[p];
  return { hoodie: { color: b.hoodie, trim: b.trim }, logo: p };
}

/** Only the look: id and name never change a pixel. */
const lookKey = (r: Recipe) => JSON.stringify({ ...r, id: undefined, name: undefined });
export const sameLook = (a: Recipe, b: Recipe) => lookKey(a) === lookKey(b);

const cache = new Map<string, string | null>();
export interface SvgOpts { background?: boolean; /** "x y w h" in the 48 grid, to zoom in on part of the character */ crop?: string }

/**
 * The recipe as an inline SVG string that scales to its box. Memoised per recipe JSON, so a list of
 * avatars for the same account renders once. Null when the recipe cannot be drawn.
 */
export function svgFor(r: Recipe, opts: SvgOpts = {}): string | null {
  const key = `${opts.background === false ? 0 : 1}|${opts.crop ?? ""}|${lookKey(r)}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  let out: string | null;
  try {
    out = renderSvg(r, { background: opts.background })
      .replace(/ width="\d+" height="\d+"/, ' width="100%" height="100%"')
      .replace('viewBox="0 0 48 48"', `viewBox="${opts.crop ?? "0 0 48 48"}"`);
  } catch { out = null; }
  if (cache.size > 400) cache.delete(cache.keys().next().value!);
  cache.set(key, out);
  return out;
}

export const CROP_HEAD = "6 2 36 36";
export const CROP_CHEST = "10 22 28 26";

/** A fresh random look. Provider, logo and hoodie stay, so the character still reads as that account. */
export function randomise(r: Recipe, rnd: () => number = Math.random): Recipe {
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)]!;
  const acc = new Set<Accessory>();
  const n = rnd() < 0.4 ? 0 : rnd() < 0.8 ? 1 : 2;
  for (let i = 0; i < n; i++) acc.add(pick(CHOICES.accessories));
  return {
    ...r,
    bodyType: pick(CHOICES.body), skinTone: pick(CHOICES.skin),
    hair: { style: pick(CHOICES.hair), color: pick(CHOICES.hairColors) },
    eyes: pick(CHOICES.eyes), eyeColor: pick(CHOICES.eyeColors), brows: pick(CHOICES.brows), mouth: pick(CHOICES.mouth),
    blush: rnd() < 0.7, accessories: [...acc], accent: pick(ACCENTS).id,
    background: { scene: pick(CHOICES.scenes), theme: pick(CHOICES.themes) },
  };
}

export { skinTones, hairColors, hoodieColors, trimColors, eyeColors, themes };
