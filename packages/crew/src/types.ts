export const GRID = 48;

export const SLOTS = [
  "skin", "skinShade", "hair", "hairShade", "eye", "hoodie", "hoodieShade", "trim",
  "logoA", "logoB", "accent", "outline", "bg1", "bg2",
  // two helper slots: eye highlight / warm light, and cheek blush
  "white", "blush",
] as const;
export type Slot = (typeof SLOTS)[number];
export type Palette = Record<Slot, string>;

/** One character key in a pixel row maps to one palette slot. "." is transparent. */
export const KEYS: Record<string, Slot> = {
  s: "skin", S: "skinShade", h: "hair", H: "hairShade", e: "eye",
  c: "hoodie", C: "hoodieShade", t: "trim", a: "logoA", A: "logoB",
  x: "accent", o: "outline", "1": "bg1", "2": "bg2", w: "white", b: "blush",
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
export type HairStyle = "long" | "bob" | "ponytail" | "buns" | "curly" | "short" | "spiky" | "wavy";
export type EyeStyle = "round" | "sparkle" | "happy";
export type BrowStyle = "soft" | "arched" | "none";
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
  background: { scene: Scene; theme: Theme };
  /** per-slot overrides, the editor's escape hatch */
  overrides?: Partial<Palette>;
}
