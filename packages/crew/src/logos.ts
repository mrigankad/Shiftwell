import type { Part, Provider } from "./types.js";

/**
 * Brand marks, drawn twice: 10x10 for the default 12x12 chest patch, and 8x8 for the small patch.
 * a = logoA, A = logoB, "." transparent. They are pixel interpretations, not official artwork.
 */
export const logoMarks: Record<Provider, string[]> = {
  // Anthropic: radiating starburst, rays of uneven length
  claude: [
    "....aa....",
    ".a..aa..a.",
    "..a.aa.a..",
    "a..aaaa..a",
    ".aaaaaaaa.",
    ".aaaaaaaa.",
    "a..aaaa..a",
    "..a.aa.a..",
    ".a..aa..a.",
    "....aa....",
  ],
  // OpenAI: hexagonal knot, a rosette of interlocking loops
  codex: [
    "...aaaa...",
    "..aaaaaa..",
    ".aaa..aaa.",
    "aaa.AA.aaa",
    "aa.aaaa.aa",
    "aa.aaaa.aa",
    "aaa.AA.aaa",
    ".aaa..aaa.",
    "..aaaaaa..",
    "...aaaa...",
  ],
  // Gemini: four point sparkle, blue to violet
  gemini: [
    "....aa....",
    "....aa....",
    "...aaaa...",
    "..aaaaaa..",
    "aaaaaaaaaa",
    "aaaaaaAAAA",
    "..aaAAAA..",
    "...AAAA...",
    "....AA....",
    "....AA....",
  ],
  // Kimi: crescent moon and a spark
  kimi: [
    "...aaaa...",
    ".aaaaa..A.",
    ".aaaa..AAA",
    "aaaa....A.",
    "aaaa......",
    "aaaa......",
    "aaaa......",
    ".aaaa.....",
    ".aaaaaa...",
    "...aaaa...",
  ],
  // xAI: a bold X, one arm in grey
  grok: [
    "aa......AA",
    ".aa....AA.",
    "..aa..AA..",
    "...aaAA...",
    "....AA....",
    "....aa....",
    "...aaaa...",
    "..aa..aa..",
    ".aa....aa.",
    "aa......aa",
  ],
  // DeepSeek: a whale with a water spout, tail up
  deepseek: [
    "...a.a....",
    "....a...a.",
    "......aaaa",
    "....aaaaa.",
    ".aaaaaaa..",
    "aaaaaaaa..",
    "aAaaaaaa..",
    "aaaaaaaaa.",
    ".aaaaaaa..",
    "..........",
  ],
  // NVIDIA: an eye, green lid and a swirling pupil
  nim: [
    "..........",
    "...AAAA...",
    ".AAaaaaAA.",
    "AaaaAAaaaA",
    "AaaAaaAaaA",
    "AaaAaAAaaA",
    "AaaaAaaaaA",
    ".AAaaaaAA.",
    "...AAAA...",
    "..........",
  ],
  // Ollama: llama head, tall ears, long snout
  ollama: [
    ".aa....aa.",
    ".aa....aa.",
    ".aa....aa.",
    ".aaaaaaaa.",
    ".aAaaaaAa.",
    ".aaaaaaaa.",
    "..aAAAAa..",
    "..aAaaAa..",
    "..aaAAaa..",
    "...aaaa...",
  ],
  // generic custom mark: a faceted gem with a bright core
  custom: [
    "....aa....",
    "...aaaa...",
    "..aaAAaa..",
    ".aaAAAAaa.",
    "aaaAAAAaaa",
    "aaaAAAAaaa",
    ".aaAAAAaa.",
    "..aaAAaa..",
    "...aaaa...",
    "....aa....",
  ],
};

/** The original small 8x8 glyphs, kept for tiny uses and the `logoSize: 8` patch. */
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
    "aa....AA",
    ".aa..AA.",
    "..aaAA..",
    "...aA...",
    "..aaAA..",
    ".aa..AA.",
    "aa....AA",
    "a......A",
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

/**
 * Chest patch. Default 12x12 at x18,y36: a cream badge with a hoodie-shade rim and the 10x10 mark.
 * Pass size 8 for the small patch (10x10, 8x8 glyph, x19,y38) with the original ids' look.
 */
export function logoPatch(provider: Provider, size: 8 | 12 = 12): Part {
  const mark = size === 12 ? logoMarks[provider] : logoGlyphs[provider];
  const n = mark.length + 2;
  const pad = 1;
  const rows: string[] = [];
  const edge = n - 1;
  for (let y = 0; y < n; y++) {
    let r = "";
    for (let x = 0; x < n; x++) {
      if ((x === 0 || x === edge) && (y === 0 || y === edge)) { r += "."; continue; }
      if (x === 0 || x === edge || y === 0 || y === edge) { r += "C"; continue; }
      const ch = mark[y - pad]![x - pad]!;
      r += ch === "." ? "w" : ch;
    }
    rows.push(r);
  }
  return size === 12
    ? { id: `logo.${provider}`, layer: "logoPatch", x: 18, y: 36, rows }
    : { id: `logo8.${provider}`, layer: "logoPatch", x: 19, y: 38, rows };
}
