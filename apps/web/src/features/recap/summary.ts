import type { Board, Insights } from "../../api";
import { buildWeek, busiestSlot, DAY_LONG, fmtHours, SAVED_HOURS_PER_HANDOFF, weekLabel } from "../usage/metrics";

export interface Recap {
  weekLabel: string;
  agentHours: number;
  runsFinished: number;
  handoffs: number;
  commits: number;
  files: number;
  /** Estimate: handoffs times an assumed avoided wait. Not a measurement. */
  hoursSaved: number;
  hoursAtLimit: number;
  busiest: { text: string; hottest: string } | null;
  top: { name: string; provider: string; preset?: string; runs: number; commits: number; files: number } | null;
  underused: { name: string; pct: number } | null;
  empty: boolean;
}

export function buildRecap(insights: Insights, board: Board, now = Date.now()): Recap {
  const w = buildWeek(insights, board, now);
  const handoffs = w.runs.filter((r) => r.fromRunId).length;
  const runsFinished = w.runs.filter((r) => r.status !== "active").length;
  const commits = w.runs.reduce((s, r) => s + (r.changes?.commits ?? 0), 0);
  const files = w.runs.reduce((s, r) => s + (r.changes?.files ?? 0), 0);
  const agentHours = w.accounts.reduce((s, a) => s + a.activeHours, 0);
  const slot = busiestSlot(insights);
  const ranked = [...w.accounts].filter((a) => a.finishedRuns > 0 || a.activeHours > 0)
    .sort((a, b) => b.finishedRuns - a.finishedRuns || b.activeHours - a.activeHours);
  const lows = w.accounts.filter((a) => a.avgDailyPeak !== null && a.readings > 0).sort((a, b) => (a.avgDailyPeak ?? 0) - (b.avgDailyPeak ?? 0));
  const low = lows[0];
  return {
    weekLabel: weekLabel(w.from, w.to),
    agentHours, runsFinished, handoffs, commits, files,
    hoursSaved: handoffs * SAVED_HOURS_PER_HANDOFF,
    hoursAtLimit: w.accounts.reduce((s, a) => s + a.hoursAtLimit, 0),
    busiest: slot ? { text: `${DAY_LONG[slot.day]} ${String(slot.hour).padStart(2, "0")}:00`, hottest: slot.hottest } : null,
    top: ranked[0] ? { name: ranked[0].name, provider: ranked[0].provider, preset: ranked[0].preset, runs: ranked[0].finishedRuns, commits: ranked[0].commits, files: ranked[0].files } : null,
    underused: low && (low.avgDailyPeak ?? 100) < 30 && w.accounts.length > 1 ? { name: low.name, pct: Math.round(low.avgDailyPeak ?? 0) } : null,
    empty: w.runs.length === 0 && agentHours === 0,
  };
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function headline(r: Recap): { before: string; accent: string; after: string } {
  if (r.empty) return { before: "A quiet week for ", accent: "the crew", after: "." };
  if (r.runsFinished > 0) return { before: "Your crew finished ", accent: plural(r.runsFinished, "run"), after: ` in ${fmtHours(r.agentHours)} of agent time.` };
  return { before: "Your crew worked ", accent: fmtHours(r.agentHours), after: " this week." };
}

/** The three talking points shown beside the card. */
export function talkingPoints(r: Recap): string[] {
  const pts: string[] = [];
  if (r.underused) pts.push(`Plan advice: ${r.underused.name} used ${r.underused.pct}% on average. Send it more work, or consider a smaller plan.`);
  pts.push(r.busiest ? `Busiest hour: ${r.busiest.text}, when ${r.busiest.hottest} ran hottest.` : "Busiest hour: not enough readings yet.");
  pts.push(r.hoursAtLimit > 0 ? `Time at limit: ${Math.round(r.hoursAtLimit * 10) / 10}h across the crew. Handoffs are there for these moments.` : "No account sat at its limit this week.");
  return pts;
}

export function plainSummary(r: Recap): string {
  const lines = [
    `Shiftwell weekly recap, ${r.weekLabel}`,
    `Agent time: ${fmtHours(r.agentHours)}`,
    `Runs finished: ${r.runsFinished}`,
    `Handoffs: ${r.handoffs}`,
    `Commits: ${r.commits} across ${plural(r.files, "file")}`,
    `Hours saved by handoffs (estimate, ${SAVED_HOURS_PER_HANDOFF}h per handoff): ${fmtHours(r.hoursSaved)}`,
    r.busiest ? `Busiest hour: ${r.busiest.text}` : "Busiest hour: not enough readings",
    r.top ? `Carried the most: ${r.top.name}, ${plural(r.top.runs, "run")}` : "Carried the most: no runs yet",
  ];
  return lines.join("\n");
}
