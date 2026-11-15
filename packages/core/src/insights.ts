import { readSamples, stateFor, type Sample, type Window } from "./usage.js";
import type { Profile } from "./profiles.js";

export interface AccountInsight {
  id: string;
  name: string;
  provider: Profile["provider"];
  preset?: string;
  readingsLast7d: number;
  peakLast7d: number | null;
  avgDailyPeak: number | null;
  hoursAtLimitLast7d: number;
  /** [weekday 0=Mon][local hour] = max pct seen in that slot over the last 28 days. */
  heat: (number | null)[][];
}

export interface Insights {
  generatedAt: string;
  accounts: AccountInsight[];
  crewHeadroomNow: number | null;
  bestNext: { id: string; name: string; reason: string } | null;
}

const DAY = 86_400_000;
const MAX_LINES = 5000;
const GAP_CAP_MIN = 60;
const CURRENT_WITHIN_MIN = 30;

function live(w: Window | null | undefined, now: number): Window | null {
  if (!w) return null;
  if (w.resetsAt && w.resetsAt * 1000 < now) return null;
  return w;
}

/** The pct that counts for peaks and the heat map: the 5-hour window, or the daily one for Gemini. */
function mainPct(p: Profile, s: Sample): number | null {
  const w = p.provider === "gemini" ? s.daily : s.fiveHour;
  return w && Number.isFinite(w.pct) ? w.pct : null;
}

/** Worst live window pct in a sample, or null when no window is live. */
function worstLive(s: Sample, now: number): number | null {
  const vals = [live(s.fiveHour, now), live(s.sevenDay, now), live(s.daily, now)].filter((w): w is Window => !!w).map((w) => w.pct);
  return vals.length ? Math.max(...vals) : null;
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function accountInsight(p: Profile, samples: Sample[], now: number): AccountInsight {
  const heat: (number | null)[][] = Array.from({ length: 7 }, () => Array<number | null>(24).fill(null));
  const pts = samples
    .map((s) => ({ s, t: Date.parse(s.at) }))
    .filter((x) => Number.isFinite(x.t) && x.t <= now)
    .sort((a, b) => a.t - b.t);

  let readings = 0;
  let peak: number | null = null;
  const dayPeaks = new Map<string, number>();
  for (const { s, t } of pts) {
    const pct = mainPct(p, s);
    if (t >= now - 28 * DAY && pct !== null) {
      const d = new Date(t);
      const row = heat[(d.getDay() + 6) % 7];
      const h = d.getHours();
      row[h] = row[h] === null ? pct : Math.max(row[h]!, pct);
    }
    if (t >= now - 7 * DAY) {
      readings++;
      if (pct !== null) {
        peak = peak === null ? pct : Math.max(peak, pct);
        const k = dayKey(new Date(t));
        dayPeaks.set(k, Math.max(dayPeaks.get(k) ?? -Infinity, pct));
      }
    }
  }

  let atLimitMin = 0;
  const recent = pts.filter((x) => x.t >= now - 7 * DAY);
  recent.forEach(({ s, t }, i) => {
    const st = stateFor(s, t);
    if (st !== "low" && st !== "out") return;
    const next = i + 1 < recent.length ? recent[i + 1].t : now;
    atLimitMin += Math.min(Math.max(0, (next - t) / 60000), GAP_CAP_MIN);
  });

  const peaks = [...dayPeaks.values()];
  return {
    id: p.id,
    name: p.name,
    provider: p.provider,
    ...(p.api?.preset ? { preset: p.api.preset } : {}),
    readingsLast7d: readings,
    peakLast7d: peak,
    avgDailyPeak: peaks.length ? Math.round((peaks.reduce((a, b) => a + b, 0) / peaks.length) * 10) / 10 : null,
    hoursAtLimitLast7d: Math.round((atLimitMin / 60) * 100) / 100,
    heat,
  };
}

export function insights(profiles: Profile[], now: number = Date.now()): Insights {
  const accounts: AccountInsight[] = [];
  const current: { p: Profile; worst: number }[] = [];
  for (const p of profiles) {
    const samples = readSamples(p.id, MAX_LINES);
    accounts.push(accountInsight(p, samples, now));
    const latest = samples.at(-1);
    if (!latest) continue;
    const age = (now - Date.parse(latest.at)) / 60000;
    if (!(age <= CURRENT_WITHIN_MIN)) continue; // stale or unreadable
    const worst = worstLive(latest, now);
    if (worst === null) continue;
    current.push({ p, worst });
  }
  const crewHeadroomNow = current.length
    ? Math.round(current.reduce((a, c) => a + (100 - c.worst), 0) / current.length)
    : null;
  const candidates = current.filter((c) => c.worst < 100).sort((a, b) => a.worst - b.worst);
  const best = candidates[0];
  const bestNext = best
    ? { id: best.p.id, name: best.p.name, reason: `${best.p.name} has ${Math.round(100 - best.worst)}% left on its tightest limit` }
    : null;
  return { generatedAt: new Date(now).toISOString(), accounts, crewHeadroomNow, bestNext };
}
