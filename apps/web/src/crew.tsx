import type { Provider, State } from "./api";

/** Index of each provider's character in /crew.png (1776 x 592, six tiles). */
const CREW_INDEX: Record<Provider, number> = { claude: 0, codex: 1, gemini: 2, api: 5 };
const TILE = 285;

export function CrewAvatar({ provider, size = 34, state }: { provider: Provider; size?: number; state?: State }) {
  const s = size / TILE;
  const i = CREW_INDEX[provider];
  const dim = state === "out" ? "grayscale(0.7) brightness(0.8)" : state === "low" ? "saturate(0.6)" : undefined;
  return (
    <div
      aria-hidden
      className="shrink-0 rounded-[9px] bg-no-repeat"
      style={{
        width: size,
        height: size,
        backgroundImage: "url(/crew.png)",
        backgroundSize: `${1776 * s}px ${592 * s}px`,
        backgroundPosition: `${-(7 + 296 * i) * s}px ${-125 * s}px`,
        filter: dim,
        imageRendering: "pixelated",
      }}
    />
  );
}

export function Mark({ size = 26, light = false }: { size?: number; light?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <polygon points="14,7 46,7 40,21 8,21" fill={light ? "#fff" : "#16181D"} />
      <polygon points="8,27 40,27 34,41 2,41" fill="#FF5A1F" />
    </svg>
  );
}
