import { spawn } from "node:child_process";
import { appendFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { sub } from "./paths.js";
import { envFor, type Profile } from "./profiles.js";
import type { Sample, Window } from "./usage.js";

/** Shape from `codex app-server generate-ts` (v2/RateLimitWindow.ts). */
interface CodexWindow { usedPercent: number; windowDurationMins: number | null; resetsAt: number | null }

export interface CodexLimits { fiveHour: Window | null; sevenDay: Window | null; plan: string | null }

const toWindow = (w: CodexWindow | null | undefined): Window | null =>
  w && typeof w.usedPercent === "number" ? { pct: w.usedPercent, resetsAt: w.resetsAt ?? null } : null;

/** Picks the 5-hour and weekly windows by duration, since primary/secondary order is not guaranteed. */
export function mapCodexSnapshot(snap: { primary?: CodexWindow | null; secondary?: CodexWindow | null; planType?: string | null } | undefined): CodexLimits {
  const wins = [snap?.primary, snap?.secondary].filter(Boolean) as CodexWindow[];
  const short = wins.find((w) => (w.windowDurationMins ?? 0) <= 600) ?? null;
  const long = wins.find((w) => (w.windowDurationMins ?? 0) > 600) ?? null;
  return { fiveHour: toWindow(short), sevenDay: toWindow(long), plan: snap?.planType ?? null };
}

/**
 * Asks the official Codex app-server for this profile's rate limits over stdio JSON-RPC.
 * Codex reads its own auth.json under CODEX_HOME; Shiftwell never opens it.
 */
export function readCodexLimits(profile: Profile, opts: { command?: string; args?: string[]; timeoutMs?: number } = {}): Promise<CodexLimits> {
  const command = opts.command ?? "codex";
  const args = opts.args ?? ["app-server"];
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: { ...process.env, ...envFor(profile) },
      shell: process.platform === "win32" && command === "codex",
      stdio: ["pipe", "pipe", "pipe"],
    });
    let buf = "";
    let done = false;
    const finish = (err: Error | null, value?: CodexLimits) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      child.kill();
      err ? reject(err) : resolve(value!);
    };
    const timer = setTimeout(() => finish(new Error("Codex app-server did not answer in time")), opts.timeoutMs ?? 20000);
    const send = (msg: unknown) => child.stdin.write(JSON.stringify(msg) + "\n");

    child.on("error", (e) => finish(new Error(`Could not start Codex: ${e.message}`)));
    child.stdout.on("data", (chunk) => {
      buf += chunk;
      let i: number;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (!line) continue;
        let msg: { id?: number; result?: any; error?: { message?: string } };
        try { msg = JSON.parse(line); } catch { continue; }
        if (msg.id === 1) {
          if (msg.error) return finish(new Error(msg.error.message ?? "initialize failed"));
          send({ method: "initialized" });
          send({ method: "account/rateLimits/read", id: 2, params: { excludeResetCreditDetails: true } });
        } else if (msg.id === 2) {
          if (msg.error) return finish(new Error(msg.error.message ?? "Not signed in"));
          finish(null, mapCodexSnapshot(msg.result?.rateLimits));
        }
      }
    });
    send({ method: "initialize", id: 1, params: { clientInfo: { name: "shiftwell", version: "0.1.0" }, capabilities: null } });
  });
}

/** Stores a reading in the same history format as the Claude hook. */
export function recordSample(profileId: string, limits: { fiveHour: Window | null; sevenDay: Window | null; daily?: Window | null }, model: string | null = null): Sample {
  const sample: Sample = { at: new Date().toISOString(), fiveHour: limits.fiveHour, sevenDay: limits.sevenDay, daily: limits.daily ?? null, model };
  const dir = sub("usage");
  writeFileSync(join(dir, `${profileId}.json`), JSON.stringify(sample));
  appendFileSync(join(dir, `${profileId}.jsonl`), JSON.stringify(sample) + "\n");
  return sample;
}
