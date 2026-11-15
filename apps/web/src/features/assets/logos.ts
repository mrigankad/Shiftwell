/** Provider logo paths (files in public/logos). Official marks, ink-coloured except nvidia/ollama (simple-icons). */
const PROVIDER_LOGO: Record<string, string> = {
  claude: "/logos/claude.svg",
  codex: "/logos/codex.svg",
  gemini: "/logos/gemini.svg",
};
const PRESET_LOGO: Record<string, string> = {
  kimi: "/logos/kimi.svg",
  grok: "/logos/grok.svg",
  deepseek: "/logos/deepseek.svg",
  nim: "/logos/nvidia.svg",
  "ollama-cloud": "/logos/ollama.svg",
  ollama: "/logos/ollama.svg",
};

/** Returns the logo path, or undefined when the provider/preset has none (e.g. "custom"), so callers can fall back to initials. */
export function logoFor(provider: string, preset?: string): string | undefined {
  if (provider === "api") return preset ? PRESET_LOGO[preset] : undefined;
  return PROVIDER_LOGO[provider] ?? PRESET_LOGO[provider];
}
