import type { Provider, State } from "./api";

import { crewArtFor } from "./features/assets/crewArt";
import { logoFor } from "./features/assets/logos";

const TILE = 285;

const PROVIDER_INITIAL: Record<string, string> = { claude: "C", codex: "X", gemini: "G", api: "A" };

/**
 * Pixel crew portrait. The provider or account initial sits underneath, so the slot is never blank
 * while the sprite loads or if it fails.
 */
export function CrewAvatar({ provider, preset, size = 34, state, name }: { provider: Provider; preset?: string; size?: number; state?: State; name?: string }) {
  const art = crewArtFor(provider, preset);
  const dim = state === "out" ? "grayscale(0.7) brightness(0.8)" : state === "low" ? "saturate(0.6)" : undefined;
  const initial = (name?.trim()[0] ?? PROVIDER_INITIAL[provider] ?? "?").toUpperCase();
  const s = size / TILE;
  const sprite = art.kind === "image"
    ? { backgroundImage: `url(${art.src})`, backgroundSize: "cover", backgroundPosition: "center" }
    : { backgroundImage: "url(/crew.png)", backgroundSize: `${1776 * s}px ${592 * s}px`, backgroundPosition: `${-(7 + 296 * art.index) * s}px ${-125 * s}px` };
  return (
    <div aria-hidden className="relative shrink-0 overflow-hidden rounded-lg bg-track" style={{ width: size, height: size }}>
      <span className="absolute inset-0 flex items-center justify-center font-bold text-body" style={{ fontSize: Math.round(size * 0.42) }}>{initial}</span>
      <div className="absolute inset-0 bg-no-repeat" style={{ ...sprite, filter: dim, imageRendering: "pixelated" }} />
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
