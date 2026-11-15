import { providerBrands } from "./palette.js";
import type { Accessory, BodyType, EyeStyle, HairStyle, BrowStyle, MouthStyle, Provider, Recipe, Scene, Theme } from "./types.js";

interface Seed {
  id: string; name: string; provider: Provider; body: BodyType; skin: string;
  hair: [HairStyle, string]; eyes: EyeStyle; brows?: BrowStyle; mouth?: MouthStyle;
  acc?: Accessory[]; accent?: string; bg: [Scene, Theme]; hoodie?: string; trim?: string; eyeColor?: string; blush?: boolean;
  accessoryColors?: Recipe["accessoryColors"];
}

const make = (s: Seed): Recipe => {
  const brand = providerBrands[s.provider];
  return {
    id: s.id, name: s.name, provider: s.provider, bodyType: s.body, skinTone: s.skin,
    hair: { style: s.hair[0], color: s.hair[1] },
    eyes: s.eyes, eyeColor: s.eyeColor, brows: s.brows ?? "soft", mouth: s.mouth ?? "smile", blush: s.blush ?? true,
    hoodie: { color: s.hoodie ?? brand.hoodie, trim: s.trim ?? brand.trim },
    logo: s.provider, accessories: s.acc ?? [], accent: s.accent, accessoryColors: s.accessoryColors,
    background: { scene: s.bg[0], theme: s.bg[1] },
  };
};

export const crew: Recipe[] = [
  make({ id: "aria", name: "Aria", provider: "claude", body: "slim", skin: "tan", hair: ["long", "auburn"], eyes: "sparkle", acc: ["starClip"], accessoryColors: { accessory1: "#FFCB4A" }, bg: ["city", "midnight"], eyeColor: "brown" }),
  make({ id: "kenji", name: "Kenji", provider: "codex", body: "broad", skin: "light", hair: ["spiky", "black"], eyes: "round", brows: "flat", acc: ["headphones", "glasses"], accessoryColors: { accessory1: "#6B7285", accessory2: "#FF7A3D" }, accent: "#FF7A3D", bg: ["desk", "midnight"] }),
  make({ id: "zara", name: "Zara", provider: "gemini", body: "slim", skin: "deep", hair: ["curly", "black"], eyes: "sparkle", brows: "raised", mouth: "open", acc: ["starClip"], accessoryColors: { accessory1: "#C9B6FF" }, bg: ["stars", "plum"], eyeColor: "brown" }),
  make({ id: "luna", name: "Luna", provider: "kimi", body: "slim", skin: "porcelain", hair: ["buns", "lavender"], eyes: "sparkle", mouth: "cat", acc: ["moonClip", "starClip"], accessoryColors: { accessory1: "#FFE08A", accessory2: "#8FC1FF" }, accent: "#FFE08A", bg: ["stars", "midnight"], eyeColor: "violet" }),
  make({ id: "rex", name: "Rex", provider: "grok", body: "broad", skin: "brown", hair: ["short", "black"], eyes: "round", brows: "angry", acc: ["visor"], accessoryColors: { accessory1: "#4A5066" }, accent: "#FF7A3D", bg: ["city", "ember"] }),
  make({ id: "finn", name: "Finn", provider: "deepseek", body: "broad", skin: "golden", hair: ["wavy", "darkBrown"], eyes: "round", acc: ["headphones"], accessoryColors: { accessory1: "#FF7A3D" }, accent: "#FF7A3D", bg: ["desk", "teal"], eyeColor: "navy" }),
  make({ id: "ravi", name: "Ravi", provider: "nim", body: "broad", skin: "golden", hair: ["wavy", "black"], eyes: "round", brows: "arched", acc: ["visor"], accessoryColors: { accessory1: "#76B900" }, accent: "#1B1B1F", bg: ["city", "midnight"] }),
  make({ id: "olive", name: "Olive", provider: "ollama", body: "slim", skin: "light", hair: ["bob", "blonde"], eyes: "round", brows: "worried", mouth: "cat", acc: ["glasses"], accessoryColors: { accessory1: "#FF9CC2" }, bg: ["desk", "ember"], eyeColor: "hazel" }),
  make({ id: "theo", name: "Theo", provider: "claude", body: "broad", skin: "ebony", hair: ["short", "black"], eyes: "happy", mouth: "open", acc: [], bg: ["plain", "plum"] }),
  make({ id: "sage", name: "Sage", provider: "custom", body: "broad", skin: "brown", hair: ["curly", "darkBrown"], eyes: "round", acc: ["headphones"], accessoryColors: { accessory1: "#FF7A3D" }, hoodie: "sage", trim: "cream", accent: "#FF7A3D", bg: ["stars", "teal"] }),
  make({ id: "pip", name: "Pip", provider: "custom", body: "slim", skin: "tan", hair: ["ponytail", "pink"], eyes: "sparkle", brows: "raised", mouth: "open", acc: [], hoodie: "mustard", trim: "white", accent: "#7A4BFF", bg: ["city", "plum"], eyeColor: "navy" }),
  make({ id: "juno", name: "Juno", provider: "custom", body: "slim", skin: "porcelain", hair: ["wavy", "ginger"], eyes: "happy", acc: ["beanie"], hoodie: "teal", trim: "gold", accessoryColors: { accessory1: "#FFCB4A" }, accent: "#FFCB4A", bg: ["desk", "teal"] }),
  make({ id: "mika", name: "Mika", provider: "gemini", body: "slim", skin: "golden", hair: ["ponytail", "black"], eyes: "sparkle", acc: [], accent: "#C9B6FF", bg: ["plain", "midnight"], eyeColor: "brown" }),
  make({ id: "dax", name: "Dax", provider: "kimi", body: "broad", skin: "light", hair: ["spiky", "blue"], eyes: "round", brows: "angry", mouth: "cat", acc: [], bg: ["stars", "midnight"] }),
  make({ id: "nova", name: "Nova", provider: "grok", body: "slim", skin: "golden", hair: ["sidePart", "burgundy"], eyes: "round", brows: "arched", acc: [], accent: "#FF7A3D", bg: ["desk", "plum"], eyeColor: "brown" }),
  make({ id: "wren", name: "Wren", provider: "deepseek", body: "slim", skin: "light", hair: ["sidePonytail", "teal"], eyes: "sparkle", mouth: "open", acc: ["starClip"], accessoryColors: { accessory1: "#FFCB4A" }, accent: "#FFCB4A", bg: ["city", "ember"], eyeColor: "navy" }),
];
