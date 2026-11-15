import type { Part, Provider } from "./types.js";

/**
 * 8x8 simplified brand marks. a = logoA, A = logoB, "." transparent.
 * They are pixel interpretations, not official artwork.
 */
export const logoGlyphs: Record<Provider, string[]> = {
  claude: [
    "a..aa..a",
    ".a.aa.a.",
    "..aaaa..",
    "aaaaaaaa",
    "aaaaaaaa",
    "..aaaa..",
    ".a.aa.a.",
    "a..aa..a",
  ],
  codex: [
    "..aaaa..",
    ".aa..aa.",
    "aa.aa.aa",
    "a.a..a.a",
    "a.a..a.a",
    "aa.aa.aa",
    ".aa..aa.",
    "..aaaa..",
  ],
  gemini: [
    "...aa...",
    "...aa...",
    "..aaaa..",
    "aaaaAAAA",
    "aaaaAAAA",
    "..AAAA..",
    "...AA...",
    "...AA...",
  ],
  kimi: [
    "..aaaa.A",
    ".aaa....",
    "aaa.....",
    "aaa.....",
    "aaa.....",
    "aaa.....",
    ".aaa....",
    "..aaaa..",
  ],
  grok: [
    "aa....aa",
    ".aa..aa.",
    "..aaaa..",
    "...AA...",
    "..AAAA..",
    ".AA..AA.",
    "AA....AA",
    "A......A",
  ],
  deepseek: [
    "......a.",
    ".aa..aaa",
    "aaaaaaa.",
    "aAaaaaaa",
    "aaaaaaaa",
    ".aaaaaa.",
    "..aaaa..",
    "...a.a..",
  ],
  nim: [
    "........",
    "..aaaa..",
    ".aaaaaa.",
    "aaAAAAaa",
    "aaAaaAaa",
    ".aaAAaa.",
    "..aaaa..",
    "........",
  ],
  ollama: [
    "aa....aa",
    "aa....aa",
    ".aaaaaa.",
    ".aAaaAa.",
    ".aaaaaa.",
    ".aaAAaa.",
    ".aaaaaa.",
    "..aaaa..",
  ],
  custom: [
    "...aa...",
    "..aaaa..",
    ".aaAAaa.",
    "aaAAAAaa",
    "aaAAAAaa",
    ".aaAAaa.",
    "..aaaa..",
    "...aa...",
  ],
};

/** Chest patch: 10x10 rounded dark backing with the 8x8 glyph inside. At x19,y38. */
export function logoPatch(provider: Provider): Part {
  const g = logoGlyphs[provider];
  const rows: string[] = [];
  for (let y = 0; y < 10; y++) {
    let r = "";
    for (let x = 0; x < 10; x++) {
      const corner = (x === 0 || x === 9) && (y === 0 || y === 9);
      if (corner) { r += "."; continue; }
      if (x === 0 || x === 9 || y === 0 || y === 9) { r += "o"; continue; }
      const ch = g[y - 1]![x - 1]!;
      r += ch === "." ? "o" : ch;
    }
    rows.push(r);
  }
  return { id: `logo.${provider}`, layer: "logoPatch", x: 19, y: 38, rows };
}
