import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { sub } from "./paths.js";
import type { Profile } from "./profiles.js";

export interface Window { pct: number; resetsAt: number | null }
export interface Sample { at: string; fiveHour: Window | null; sevenDay: Window | null; model?: string | null }

export type State = "unknown" | "room" | "on" | "low" | "out";

export interface Usage {
  profileId: string;
  latest: Sample | null;
  /** Minutes since the last reading. */
  ageMinutes: number | null;
  stale: boolean;
  state: State;
  /** Estimated minutes until the 5-hour window is used up at the current pace. */
  runsOutInMinutes: number | null;
}

const STALE_AFTER_MIN = 30;

export function readSamples(profileId: string, limit = 50): Sample[] {
  const file = join(sub("usage"), `${profileId}.jsonl`);
  if (!existsSync(file)) return [];
  const lines = readFileSync(file, "utf8").trim().split("\n").filter(Boolean);
  const out: Sample[] = [];
  for (const l of lines.slice(-limit)) {
    try { out.push(JSON.parse(l)); } catch { /* skip bad line */ }
  }
  return out;
}

/** A window whose reset time has passed no longer counts. */
function live(w: Window | null, now: number): Window | null {
  if (!w) return null;
  if (w.resetsAt && w.resetsAt * 1000 < now) return null;
  return w;
}

export function stateFor(sample: Sample | null, now = Date.now()): State {
  if (!sample) return "unknown";
  const five = live(sample.fiveHour, now)?.pct ?? 0;
  const week = live(sample.sevenDay, now)?.pct ?? 0;
  const worst = Math.max(five, week);
  if (worst >= 100) return "out";
  if (worst >= 85) return "low";
  return "room";
}

/** Linear burn rate over recent samples in the current 5-hour window. */
export function forecastMinutes(samples: Sample[], now = Date.now()): number | null {
  const pts = samples
    .filter((s) => s.fiveHour && live(s.fiveHour, now))
    .map((s) => ({ t: Date.parse(s.at), pct: s.fiveHour!.pct }));
  if (pts.length < 2) return null;
  const a = pts[Math.max(0, pts.length - 6)];
  const b = pts[pts.length - 1];
  const minutes = (b.t - a.t) / 60000;
  const rate = (b.pct - a.pct) / minutes; // pct per minute
  // Need at least 2 minutes of history before predicting anything.
  if (!(minutes >= 2) || !(rate > 0)) return null;
  return Math.max(0, Math.round((100 - b.pct) / rate));
}

export function usageFor(profile: Profile, now = Date.now()): Usage {
  const samples = readSamples(profile.id);
  const latest = samples.at(-1) ?? null;
  const ageMinutes = latest ? Math.round((now - Date.parse(latest.at)) / 60000) : null;
  return {
    profileId: profile.id,
    latest,
    ageMinutes,
    stale: ageMinutes === null || ageMinutes > STALE_AFTER_MIN,
    state: stateFor(latest, now),
    runsOutInMinutes: forecastMinutes(samples, now),
  };
}
