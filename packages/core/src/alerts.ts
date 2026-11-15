import type { Profile } from "./profiles.js";
import type { State, Usage } from "./usage.js";
import type { Suggestion } from "./advisor.js";

export interface Alert { key: string; title: string; body: string }

/** What the detector remembers between ticks: each account's state, plus handoff suggestions already announced. */
export type Seen = State | "suggested";

function usedText(u: Usage | undefined): string {
  const s = u?.latest;
  if (!s) return "Its limit is nearly used";
  const cands: Array<[string, number | undefined]> = [
    ["5-hour window", s.fiveHour?.pct],
    ["7-day window", s.sevenDay?.pct],
    ["daily limit", s.daily?.pct],
  ];
  let best: [string, number] | null = null;
  for (const [label, pct] of cands) {
    if (typeof pct === "number" && (!best || pct > best[1])) best = [label, pct];
  }
  if (!best) return "Its limit is nearly used";
  return `${Math.round(best[1])}% of its ${best[0]} used`;
}

/**
 * Compares the current account states with the previous ones and returns what is worth
 * telling the user about. The first time an account is seen it never alerts.
 */
export function detectAlerts(
  prev: Map<string, Seen>,
  profiles: Profile[],
  usageMap: Map<string, Usage>,
  suggestions: Suggestion[],
): { alerts: Alert[]; next: Map<string, Seen> } {
  const alerts: Alert[] = [];
  const next = new Map<string, Seen>();

  for (const p of profiles) {
    const u = usageMap.get(p.id);
    const now: State = u?.state ?? "unknown";
    const before = prev.get(p.id);
    if (now === "unknown") {
      // No reading yet: keep what we knew so a later reading compares against it.
      if (before) next.set(p.id, before);
      continue;
    }
    next.set(p.id, now);
    if (before === undefined || before === now) continue;
    if (now === "low") {
      alerts.push({ key: `${p.id}:low`, title: `${p.name} is running low`, body: `${usedText(u)}.` });
    } else if (now === "out") {
      alerts.push({ key: `${p.id}:out`, title: `${p.name} is out`, body: "It has hit its limit. Switch to another account." });
    } else if ((before === "out" || before === "low") && (now === "room" || now === "on")) {
      alerts.push({ key: `${p.id}:room`, title: `${p.name} has room again`, body: "Its usage has dropped back below the limit." });
    }
  }

  for (const s of suggestions) {
    const key = `${s.from.id}->${s.to.id}`;
    const mapKey = `handoff:${key}`;
    next.set(mapKey, "suggested");
    // Skip if already announced, or if this is the first observation of the source account.
    if (prev.has(mapKey) || !prev.has(s.from.id)) continue;
    alerts.push({ key, title: `Move work from ${s.from.name} to ${s.to.name}`, body: s.reason });
  }

  return { alerts, next };
}
