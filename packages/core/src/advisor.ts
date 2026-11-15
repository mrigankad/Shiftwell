import type { Profile } from "./profiles.js";
import type { Usage } from "./usage.js";

export interface Suggestion {
  from: Profile;
  to: Profile;
  reason: string;
}

const LOW = 85;

function fivePct(u: Usage | undefined): number | null {
  return u?.latest?.fiveHour?.pct ?? null;
}

/**
 * Suggests (never performs) a handoff: when an account is above 85% of its
 * 5-hour window, point to the same-provider account with the most room.
 */
export function suggestHandoffs(profiles: Profile[], usage: Map<string, Usage>): Suggestion[] {
  const out: Suggestion[] = [];
  for (const p of profiles) {
    const pct = fivePct(usage.get(p.id));
    if (pct === null || pct < LOW) continue;
    const candidates = profiles
      .filter((q) => q.id !== p.id && q.provider === p.provider)
      .map((q) => ({ q, pct: fivePct(usage.get(q.id)) }))
      .filter((c) => c.pct !== null && c.pct < 60 && usage.get(c.q.id)?.state !== "out")
      .sort((a, b) => a.pct! - b.pct!);
    const best = candidates[0];
    if (best) {
      out.push({ from: p, to: best.q, reason: `${p.name} is at ${Math.round(pct)}% of its 5-hour window; ${best.q.name} is at ${Math.round(best.pct!)}%.` });
    }
  }
  return out;
}
