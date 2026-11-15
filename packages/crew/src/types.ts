export const GRID = 48;

export const SLOTS = [
  "skin", "skinShade", "hair", "hairShade", "eye", "hoodie", "hoodieShade", "trim",
  "logoA", "logoB", "accent", "outline", "bg1", "bg2",
  // two helper slots: eye highlight / warm light, and cheek blush
  "white", "blush",
  // added in 0.2: hair highlight, and one colour slot per worn accessory (1st and 2nd in recipe.accessories)
  "hairLight", "accessory1", "accessory2",
] as const;
export type Slot = (typeof SLOTS)[number];
export type Palette = Record<Slot, string>;

/** One character key in a pixel row maps to one palette slot. "." is transparent. */
export const KEYS: Record<string, Slot> = {
  s: "skin", S: "skinShade", h: "hair", H: "hairShade", e: "eye",
  c: "hoodie", C: "hoodieShade", t: "trim", a: "logoA", A: "logoB",
  x: "accent", o: "outline", "1": "bg1", "2": "bg2", w: "white", b: "blush",
  L: "hairLight", p: "accessory1", q: "accessory2",
};

export const LAYERS = [
  "background", "hairBack", "body", "hoodie", "hoodieTrim", "logoPatch", "head",
  "ears", "eyes", "brows", "mouth", "blush", "hairFront", "accessories",
] as const;
export type LayerName = (typeof LAYERS)[number];

export interface Part {
  id: string;
  layer: LayerName;
  /** top-left of the rows on the 48x48 grid */
  x: number;
  y: number;
  rows: string[];
}

export type Provider =
  | "claude" | "codex" | "gemini" | "kimi" | "grok" | "deepseek" | "nim" | "ollama" | "custom";
export type BodyType = "slim" | "broad";
export type HairStyle =
  | "long" | "bob" | "ponytail" | "buns" | "curly" | "short" | "spiky" | "wavy"
  | "sidePart" | "sidePonytail";
export type EyeStyle = "round" | "sparkle" | "happy";
export type BrowStyle = "soft" | "arched" | "none" | "flat" | "raised" | "angry" | "worried";
export type MouthStyle = "smile" | "open" | "cat";
export type Accessory = "glasses" | "headphones" | "beanie" | "visor" | "starClip" | "moonClip";
export type Scene = "city" | "desk" | "stars" | "plain";
export type Theme = "midnight" | "plum" | "teal" | "ember";

/** Colour fields accept a palette name or a #hex. */
export interface Recipe {
  id: string;
  name: string;
  provider: Provider;
  bodyType: BodyType;
  skinTone: string;
  hair: { style: HairStyle; color: string };
  eyes: EyeStyle;
  eyeColor?: string;
  brows: BrowStyle;
  mouth: MouthStyle;
  blush?: boolean;
  hoodie: { color: string; trim: string };
  logo: Provider;
  accessories: Accessory[];
  accent?: string;
  /** colour of the 1st / 2nd entry in `accessories` (accessory1 / accessory2 slots). Defaults to `accent`. */
  accessoryColors?: { accessory1?: string; accessory2?: string };
  /** chest patch size: 12 (default, 12x12 patch) or 8 (the small 8x8 glyph in a 10x10 patch) */
  logoSize?: 8 | 12;
  background: { scene: Scene; theme: Theme };
  /** per-slot overrides, the editor's escape hatch */
  overrides?: Partial<Palette>;
}
