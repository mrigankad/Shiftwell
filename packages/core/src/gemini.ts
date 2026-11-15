import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { sub } from "./paths.js";
import type { Profile } from "./profiles.js";
import type { Window } from "./usage.js";

/** Free Gemini CLI sign-in allows about 1000 model requests a day. A number in the plan field overrides it. */
export const GEMINI_DEFAULT_DAILY = 1000;

export const geminiLogPath = (profileId: string) => join(sub("usage"), `${profileId}.gemini-telemetry.log`);

/**
 * Turns on Gemini CLI's own local telemetry for this profile, written to a file Shiftwell can count.
 * Prompts are never logged. Other settings in the file are kept.
 */
export function installGeminiTelemetry(profile: Profile): string {
  const dir = join(profile.configDir, ".gemini");
  mkdirSync(dir, { recursive: true });
  const file = join(dir, "settings.json");
  let settings: Record<string, any> = {};
  if (existsSync(file)) { try { settings = JSON.parse(readFileSync(file, "utf8")); } catch { /* replace bad file */ } }
  settings.telemetry = { ...(settings.telemetry ?? {}), enabled: true, target: "local", outfile: geminiLogPath(profile.id).replace(/\\/g, "/"), logPrompts: false };
  writeFileSync(file, JSON.stringify(settings, null, 2));
  return file;
}

/** Next midnight in US Pacific time, when the Gemini daily quota resets. */
export function nextPacificMidnight(now = Date.now()): number {
  const pt = new Date(new Date(now).toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
  const offset = new Date(now).getTime() - pt.getTime();
  const mid = new Date(pt); mid.setHours(24, 0, 0, 0);
  return Math.round((mid.getTime() + offset) / 1000);
}

/** Counts api_request events since the last Pacific midnight. The log is concatenated JSON, so this scans text. */
export function countGeminiRequests(text: string, now = Date.now()): number {
  const since = (nextPacificMidnight(now) - 86400) * 1000;
  const re = /"event\.name"\s*:\s*"gemini_cli\.api_request"[^{}]*?"event\.timestamp"\s*:\s*"([^"]+)"|"event\.timestamp"\s*:\s*"([^"]+)"[^{}]*?"event\.name"\s*:\s*"gemini_cli\.api_request"/g;
  let n = 0;
  for (const m of text.matchAll(re)) {
    const t = Date.parse(m[1] ?? m[2]);
    if (!Number.isNaN(t) && t >= since && t <= now) n++;
  }
  return n;
}

export function readGeminiDaily(profile: Profile, now = Date.now()): { daily: Window; requests: number; limit: number } {
  const file = geminiLogPath(profile.id);
  const requests = existsSync(file) ? countGeminiRequests(readFileSync(file, "utf8"), now) : 0;
  const limit = Number(/\d+/.exec(profile.plan ?? "")?.[0]) || GEMINI_DEFAULT_DAILY;
  return { daily: { pct: Math.min(100, (requests / limit) * 100), resetsAt: nextPacificMidnight(now) }, requests, limit };
}
