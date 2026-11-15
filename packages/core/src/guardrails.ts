import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { shiftwellHome } from "./paths.js";
import { getProfile } from "./profiles.js";
import type { Usage } from "./usage.js";

export interface QuietHours { start: string; end: string }
export interface Guardrails {
  /** Hand off without asking when an account passes the stop line. Off by default. */
  autoRotate: boolean;
  maxParallelRuns: number;
  /** Never start a run on an account at or above this percentage. */
  stopAtPct: number;
  /** Glob-ish patterns the agent should never touch. Written into HANDOFF.md as a reminder. */
  blockedPaths: string[];
  /** No notifications between start and end (local time, may wrap past midnight). */
  quietHours?: QuietHours;
}

export const DEFAULT_GUARDRAILS: Guardrails = { autoRotate: false, maxParallelRuns: 6, stopAtPct: 95, blockedPaths: [] };

const file = () => join(shiftwellHome(), "guardrails.json");
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Throws an Error with a plain message when the input is not usable. Unknown keys are dropped. */
export function validateGuardrails(input: unknown): Guardrails {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Guardrails must be an object");
  const i = input as Record<string, unknown>;
  const autoRotate = i.autoRotate ?? DEFAULT_GUARDRAILS.autoRotate;
  if (typeof autoRotate !== "boolean") throw new Error("Automatic rotation must be on or off");
  const maxParallelRuns = i.maxParallelRuns ?? DEFAULT_GUARDRAILS.maxParallelRuns;
  if (typeof maxParallelRuns !== "number" || !Number.isInteger(maxParallelRuns) || maxParallelRuns < 1 || maxParallelRuns > 50) {
    throw new Error("Parallel runs must be a whole number from 1 to 50");
  }
  const stopAtPct = i.stopAtPct ?? DEFAULT_GUARDRAILS.stopAtPct;
  if (typeof stopAtPct !== "number" || !Number.isFinite(stopAtPct) || stopAtPct < 50 || stopAtPct > 100) {
    throw new Error("The stop line must be a number from 50 to 100");
  }
  const bp = i.blockedPaths ?? [];
  if (!Array.isArray(bp) || bp.some((p) => typeof p !== "string")) throw new Error("Blocked paths must be a list of text patterns");
  const blockedPaths = [...new Set((bp as string[]).map((p) => p.trim()).filter(Boolean))];
  if (blockedPaths.length > 100) throw new Error("Too many blocked paths (limit 100)");
  if (blockedPaths.some((p) => p.length > 200 || /[\r\n]/.test(p))) throw new Error("A blocked path is too long or has a line break");
  let quietHours: QuietHours | undefined;
  if (i.quietHours !== undefined && i.quietHours !== null) {
    const q = i.quietHours as Record<string, unknown>;
    if (typeof q !== "object" || typeof q.start !== "string" || typeof q.end !== "string" || !TIME.test(q.start) || !TIME.test(q.end)) {
      throw new Error("Quiet hours need a start and an end like 22:00 and 07:00");
    }
    quietHours = { start: q.start, end: q.end };
  }
  return { autoRotate, maxParallelRuns, stopAtPct, blockedPaths, ...(quietHours ? { quietHours } : {}) };
}

const defaults = (): Guardrails => ({ ...DEFAULT_GUARDRAILS, blockedPaths: [] });

export function getGuardrails(): Guardrails {
  if (!existsSync(file())) return defaults();
  try { return validateGuardrails(JSON.parse(readFileSync(file(), "utf8"))); } catch { return defaults(); }
}

export function saveGuardrails(input: unknown): Guardrails {
  const g = validateGuardrails(input);
  writeFileSync(file(), JSON.stringify(g, null, 2));
  return g;
}

/** Highest percentage across the windows that still count (a window past its reset time is ignored). Null when there is no reading. */
export function usageWorstPct(u: Usage | undefined, now = Date.now()): number | null {
  const s = u?.latest;
  if (!s) return null;
  const live = (w: { pct: number; resetsAt: number | null } | null | undefined) => (w && !(w.resetsAt && w.resetsAt * 1000 < now) ? w.pct : null);
  const vals = [live(s.fiveHour), live(s.sevenDay), live(s.daily ?? null)].filter((v): v is number => v !== null);
  return vals.length ? Math.max(...vals) : 0;
}

export interface StartCheck { ok: boolean; problems: string[] }

export function checkStart(profileIds: string[], usage: Map<string, Usage>, activeRunCount: number, g: Guardrails = getGuardrails(), now = Date.now()): StartCheck {
  const problems: string[] = [];
  if (profileIds.length === 0) problems.push("Pick at least one account.");
  const total = activeRunCount + profileIds.length;
  if (total > g.maxParallelRuns) {
    problems.push(`That would make ${total} runs at once. Your limit is ${g.maxParallelRuns}, and ${activeRunCount} ${activeRunCount === 1 ? "is" : "are"} already running.`);
  }
  for (const id of profileIds) {
    const name = getProfile(id)?.name ?? id;
    const u = usage.get(id);
    if (u?.state === "out") { problems.push(`${name} is out of room right now.`); continue; }
    const pct = usageWorstPct(u, now);
    if (pct !== null && pct >= g.stopAtPct) problems.push(`${name} is at ${Math.round(pct)}% and your stop line is ${g.stopAtPct}%.`);
  }
  return { ok: problems.length === 0, problems };
}

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));

/** True when notifications should stay quiet at this moment. Handles ranges that wrap past midnight. */
export function inQuietHours(g: Guardrails, now: Date = new Date()): boolean {
  if (!g.quietHours) return false;
  const s = toMin(g.quietHours.start), e = toMin(g.quietHours.end);
  if (s === e) return false;
  const m = now.getHours() * 60 + now.getMinutes();
  return s < e ? m >= s && m < e : m >= s || m < e;
}

/** Lines for HANDOFF.md reminding the next agent which paths to leave alone. Empty when none are set. */
export function blockedPathsNote(g: Guardrails = getGuardrails()): string {
  if (g.blockedPaths.length === 0) return "";
  return ["## Do not touch", "", "The owner asked that these paths stay unchanged:", "", ...g.blockedPaths.map((p) => `- ${p}`), ""].join("\n");
}
