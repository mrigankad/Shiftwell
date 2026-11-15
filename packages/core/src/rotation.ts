import type { Profile } from "./profiles.js";
import type { Usage } from "./usage.js";
import type { Run } from "./runs.js";
import { usageWorstPct, type Guardrails } from "./guardrails.js";

export interface Rotation { runId: string; toProfileId: string; reason: string }

/** A run is moved at most this often. */
export const ROTATION_COOLDOWN_MS = 30 * 60_000;

/**
 * Decides which active runs to move to another account right now. Pure: it performs nothing.
 * Does nothing unless guardrails.autoRotate is on.
 */
export function planRotations(
  profiles: Profile[],
  usage: Map<string, Usage>,
  runs: Run[],
  guardrails: Guardrails,
  lastRotated: Map<string, number> = new Map(),
  now = Date.now(),
): Rotation[] {
  if (!guardrails.autoRotate) return [];
  const byId = new Map(profiles.map((p) => [p.id, p]));
  const active = runs.filter((r) => r.status === "active");
  const out: Rotation[] = [];
  const taken = new Set<string>();

  /** Percent of room left, or null when the account is not a usable target. */
  const headroom = (p: Profile): number | null => {
    const u = usage.get(p.id);
    if (!u || u.state === "low" || u.state === "out" || u.state === "unknown") return null;
    const pct = usageWorstPct(u, now);
    if (pct === null || pct >= guardrails.stopAtPct) return null;
    return 100 - pct;
  };

  for (const run of active) {
    const from = byId.get(run.profileId);
    if (!from) continue;
    const u = usage.get(from.id);
    const pct = usageWorstPct(u, now);
    const over = u?.state === "out" || (pct !== null && pct >= guardrails.stopAtPct);
    if (!over) continue;
    const last = lastRotated.get(run.id);
    if (last !== undefined && now - last < ROTATION_COOLDOWN_MS) continue;

    const pool = profiles
      .filter((q) => q.id !== from.id && q.id !== run.profileId && !taken.has(q.id))
      .map((q) => ({ q, room: headroom(q) }))
      .filter((c): c is { q: Profile; room: number } => c.room !== null);
    const best = (list: typeof pool) => list.sort((a, b) => b.room - a.room)[0];
    const pick = best(pool.filter((c) => c.q.provider === from.provider)) ?? best(pool.filter((c) => c.q.provider !== "api"));
    if (!pick) continue;

    taken.add(pick.q.id);
    const why = u?.state === "out" ? `${from.name} is out of room` : `${from.name} is at ${Math.round(pct ?? 0)}% and the stop line is ${guardrails.stopAtPct}%`;
    out.push({ runId: run.id, toProfileId: pick.q.id, reason: `${why}. Moved automatically to ${pick.q.name}, which has ${Math.round(pick.room)}% left.` });
  }

  // A handoff replaces a run, so the active count never grows. Refuse a plan that would break that.
  if (out.length > active.length) return [];
  return out;
}
