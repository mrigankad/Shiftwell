import type { Board, InsightAccount, Insights, Run } from "../../api";

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const DAY_LONG = ["Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays", "Sundays"];
export const WEEK_MS = 7 * 24 * 3600 * 1000;
/** Average weeks per month, used to turn a monthly plan cost into a weekly one. */
export const WEEKS_PER_MONTH = 52 / 12;
/**
 * Assumption behind "hours saved by handoffs": without a handoff the agent would wait for the limit
 * window to reset. Half of a 5 hour window is 2.5 hours on average. This is an estimate, not a measurement.
 */
export const SAVED_HOURS_PER_HANDOFF = 2.5;

/** Highest usage percent per weekday for one account, null when nothing was read that day. */
export function dailyPeaks(a: InsightAccount): (number | null)[] {
  return Array.from({ length: 7 }, (_, d) => {
    const vals = (a.heat[d] ?? []).filter((v): v is number => v !== null);
    return vals.length ? Math.max(...vals) : null;
  });
}

export interface AccountWeek {
  id: string; name: string; provider: InsightAccount["provider"]; preset?: string; plan?: string;
  peaks: (number | null)[]; avgDailyPeak: number | null; hoursAtLimit: number; readings: number;
  /** Agent hours worked in the last 7 days, from run start and end times. */
  activeHours: number; finishedRuns: number; handoffsIn: number; commits: number; files: number;
}

const t = (iso?: string) => (iso ? Date.parse(iso) : NaN);

/** Hours a run overlapped the window [from, to]. Active runs count up to `to`. */
export function overlapHours(r: Run, from: number, to: number): number {
  const s = t(r.startedAt);
  if (Number.isNaN(s)) return 0;
  const e = r.endedAt ? t(r.endedAt) : to;
  const lo = Math.max(s, from), hi = Math.min(Number.isNaN(e) ? to : e, to);
  return Math.max(0, hi - lo) / 3600000;
}

export function weekRuns(runs: Run[], now = Date.now()): Run[] {
  const from = now - WEEK_MS;
  return runs.filter((r) => overlapHours(r, from, now) > 0 || t(r.startedAt) >= from);
}

export function buildWeek(insights: Insights, board: Board, now = Date.now()) {
  const from = now - WEEK_MS;
  const runs = weekRuns(board.runs, now);
  const planOf = new Map(board.accounts.map((a) => [a.id, a.plan]));
  const accounts: AccountWeek[] = insights.accounts.map((a) => {
    const mine = runs.filter((r) => r.profileId === a.id);
    return {
      id: a.id, name: a.name, provider: a.provider, preset: a.preset, plan: planOf.get(a.id),
      peaks: dailyPeaks(a), avgDailyPeak: a.avgDailyPeak, hoursAtLimit: a.hoursAtLimitLast7d, readings: a.readingsLast7d,
      activeHours: mine.reduce((s, r) => s + overlapHours(r, from, now), 0),
      finishedRuns: mine.filter((r) => r.status !== "active").length,
      handoffsIn: mine.filter((r) => r.fromRunId).length,
      commits: mine.reduce((s, r) => s + (r.changes?.commits ?? 0), 0),
      files: mine.reduce((s, r) => s + (r.changes?.files ?? 0), 0),
    };
  });
  return { accounts, runs, from, to: now };
}

/** Crew load per slot: sum of each account's max usage percent. Returns the busiest weekday and hour. */
export function busiestSlot(insights: Insights): { day: number; hour: number; load: number; hottest: string } | null {
  let best: { day: number; hour: number; load: number; hottest: string } | null = null;
  for (let d = 0; d < 7; d++) for (let h = 0; h < 24; h++) {
    let load = 0, top = -1, name = "";
    for (const a of insights.accounts) {
      const v = a.heat[d]?.[h];
      if (v === null || v === undefined) continue;
      load += v;
      if (v > top) { top = v; name = a.name; }
    }
    if (load > 0 && (!best || load > best.load)) best = { day: d, hour: h, load, hottest: name };
  }
  return best;
}

export function fmtHours(h: number): string {
  if (h < 1) return `${Math.round(h * 60)}m`;
  const whole = Math.floor(h), m = Math.round((h - whole) * 60);
  return m === 0 || h >= 10 ? `${Math.round(h)}h` : `${whole}h ${String(m).padStart(2, "0")}m`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function weekLabel(from: number, to: number): string {
  const a = new Date(from), b = new Date(to);
  return a.getMonth() === b.getMonth()
    ? `${a.getDate()} to ${b.getDate()} ${MONTHS[b.getMonth()]}`
    : `${a.getDate()} ${MONTHS[a.getMonth()]} to ${b.getDate()} ${MONTHS[b.getMonth()]}`;
}
