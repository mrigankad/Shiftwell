import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { sub } from "./paths.js";
import type { Profile } from "./profiles.js";

/**
 * Claude Code calls its statusLine command with a JSON payload on stdin
 * (https://code.claude.com/docs/en/statusline). The payload includes
 * rate_limits.five_hour / seven_day with used_percentage and resets_at.
 * Our hook appends those numbers to a local file. It never touches credentials.
 */
const HOOK_SOURCE = `#!/usr/bin/env node
// Shiftwell status line hook. Records rate limits only. Never reads credentials.
import { appendFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
const [,, profileId, usageDir] = process.argv;
let raw = "";
process.stdin.on("data", (c) => (raw += c));
process.stdin.on("end", () => {
  let line = "shiftwell";
  try {
    const data = JSON.parse(raw);
    const rl = data.rate_limits ?? {};
    const pick = (w) => (w && typeof w.used_percentage === "number" ? { pct: w.used_percentage, resetsAt: w.resets_at ?? null } : null);
    const sample = { at: new Date().toISOString(), fiveHour: pick(rl.five_hour), sevenDay: pick(rl.seven_day), model: data.model?.display_name ?? null };
    mkdirSync(usageDir, { recursive: true });
    writeFileSync(join(usageDir, profileId + ".json"), JSON.stringify(sample));
    appendFileSync(join(usageDir, profileId + ".jsonl"), JSON.stringify(sample) + "\\n");
    const parts = [];
    if (sample.fiveHour) parts.push("5h " + Math.round(sample.fiveHour.pct) + "%");
    if (sample.sevenDay) parts.push("week " + Math.round(sample.sevenDay.pct) + "%");
    if (parts.length) line = "shiftwell · " + parts.join(" · ");
  } catch {}
  process.stdout.write(line);
});
`;

export function hookPath(): string {
  const p = join(sub("hooks"), "claude-status.mjs");
  if (!existsSync(p) || readFileSync(p, "utf8") !== HOOK_SOURCE) writeFileSync(p, HOOK_SOURCE);
  return p;
}

/** Adds our status line to the profile's own settings.json, keeping everything else. */
export function installClaudeStatusHook(profile: Profile): { settingsPath: string; replaced: boolean } {
  if (profile.provider !== "claude") throw new Error("Status hook is only for Claude Code profiles");
  const settingsPath = join(profile.configDir, "settings.json");
  let settings: Record<string, unknown> = {};
  if (existsSync(settingsPath)) {
    try { settings = JSON.parse(readFileSync(settingsPath, "utf8")); } catch { throw new Error(`Could not parse ${settingsPath}`); }
  }
  const replaced = settings.statusLine !== undefined;
  const usageDir = sub("usage").replace(/\\/g, "/");
  const hook = hookPath().replace(/\\/g, "/");
  settings.statusLine = { type: "command", command: `node "${hook}" ${profile.id} "${usageDir}"` };
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  return { settingsPath, replaced };
}
