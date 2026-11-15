import { useMemo } from "react";
import type { Provider, State } from "./api";
import { logoFor } from "./features/assets/logos";
import { providerDefault, svgFor, type Recipe } from "./features/character/recipes";
import { useRoster } from "./features/character/roster";

const PROVIDER_INITIAL: Record<string, string> = { claude: "C", codex: "X", gemini: "G", api: "A" };

/**
 * An account's pixel character, drawn as inline SVG with crisp edges at any size. The recipe comes from, in order:
 * the `recipe` prop, the account by `accountId`, the account by `name` (names are unique), and last the provider's
 * default character, which is what provider tiles in dialogs show. The initial sits underneath in case a recipe cannot be drawn.
 */
export function CrewAvatar({ provider, preset, size = 34, state, name, accountId, recipe }: {
  provider: Provider; preset?: string; size?: number; state?: State; name?: string; accountId?: string; recipe?: Recipe;
}) {
  const roster = useRoster();
  const r = recipe ?? (accountId ? roster.byId.get(accountId) : undefined) ?? (name ? roster.byName.get(name.trim().toLowerCase()) : undefined) ?? providerDefault(provider, preset);
  const svg = useMemo(() => svgFor(r), [r]);
  const dim = state === "out" ? "grayscale(0.7) brightness(0.8)" : state === "low" ? "saturate(0.6)" : undefined;
  const initial = (name?.trim()[0] ?? PROVIDER_INITIAL[provider] ?? "?").toUpperCase();
  return (
    <div aria-hidden className="relative shrink-0 overflow-hidden rounded-lg bg-track" style={{ width: size, height: size }}>
      <span className="absolute inset-0 flex items-center justify-center font-bold text-body" style={{ fontSize: Math.round(size * 0.42) }}>{initial}</span>
      {svg && <div className="absolute inset-0 [&>svg]:block" style={{ filter: dim }} dangerouslySetInnerHTML={{ __html: svg }} />}
    </div>
  );
}

/** Small provider mark on a light chip, so the dark logos stay visible in the night theme. */
export function ProviderLogo({ provider, preset, size = 16 }: { provider: string; preset?: string; size?: number }) {
  const src = logoFor(provider, preset);
  if (!src) return null;
  return (
    <span aria-hidden className="inline-flex shrink-0 items-center justify-center rounded-md bg-white" style={{ width: size + 6, height: size + 6 }}>
      <img src={src} alt="" width={size} height={size} className="object-contain" />
    </span>
  );
}

export function Mark({ size = 26, light = false }: { size?: number; light?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden className="text-ink">
      <polygon points="14,7 46,7 40,21 8,21" fill={light ? "var(--color-welcome-ink)" : "currentColor"} />
      <polygon points="8,27 40,27 34,41 2,41" fill="var(--color-shift)" />
    </svg>
  );
}
