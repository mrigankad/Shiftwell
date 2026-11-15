/** Crew art lookup. Sprite tiles live in /crew.png (1776x592, six 296px-pitch tiles); extra portraits are separate 512x512 PNGs in /crew/. */
export type CrewArt = { kind: "tile"; index: number } | { kind: "image"; src: string };

const TILE_BY_PROVIDER: Record<string, number> = { claude: 0, codex: 1, gemini: 2 };
const TILE_BY_PRESET: Record<string, number> = { kimi: 3, grok: 4, deepseek: 5 };
const IMAGE_BY_PRESET: Record<string, string> = {
  nim: "/crew/nim.png",
  "ollama-cloud": "/crew/ollama.png",
  ollama: "/crew/ollama.png",
  custom: "/crew/custom.png",
};

export function crewArtFor(provider: string, preset?: string): CrewArt {
  if (provider !== "api") return { kind: "tile", index: TILE_BY_PROVIDER[provider] ?? 5 };
  if (preset && IMAGE_BY_PRESET[preset]) return { kind: "image", src: IMAGE_BY_PRESET[preset] };
  return { kind: "tile", index: (preset ? TILE_BY_PRESET[preset] : undefined) ?? 5 };
}
