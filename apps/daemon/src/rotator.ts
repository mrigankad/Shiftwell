import { spawn } from "node:child_process";
import {
  listProfiles, listRuns, usageFor, getGuardrails, planRotations, handOff, getProfile, envFor, agentCommand, HANDOFF_PROMPT,
  type Usage, type Profile, type Run, type Guardrails,
} from "@shiftwell/core";

export type OpenTerminal = (cmd: string, env: Record<string, string>, cwd?: string, title?: string) => void;

export interface RotatorOptions {
  openTerminal?: OpenTerminal;
  notify: (title: string, body: string) => unknown;
  everyMs?: number;
  log?: (msg: string) => void;
  now?: () => number;
  /** Test hook: supply data instead of reading from disk. */
  read?: () => { profiles: Profile[]; usage: Map<string, Usage>; runs: Run[]; guardrails: Guardrails };
}

/** Minimal terminal opener: a new window with the account's env, started in the worktree. */
export const defaultOpenTerminal: OpenTerminal = (cmd, env, cwd, title = "Shiftwell") => {
  const fullEnv = { ...process.env, ...env };
  if (process.platform === "win32") {
    spawn("cmd.exe", ["/c", "start", title, "cmd.exe", "/k", cmd], { env: fullEnv, cwd, detached: true, stdio: "ignore" }).unref();
  } else if (process.platform === "darwin") {
    const exports = Object.entries(env).map(([k, v]) => `export ${k}='${v}';`).join(" ");
    spawn("osascript", ["-e", `tell app "Terminal" to do script "${cwd ? `cd '${cwd}'; ` : ""}${exports} ${cmd}"`], { detached: true, stdio: "ignore" }).unref();
  } else {
    spawn("x-terminal-emulator", ["-e", `bash -lc '${cmd}; exec bash'`], { env: fullEnv, cwd, detached: true, stdio: "ignore" }).unref();
  }
};

function readFresh() {
  const profiles = listProfiles();
  return { profiles, usage: new Map(profiles.map((p) => [p.id, usageFor(p)] as const)), runs: listRuns(), guardrails: getGuardrails() };
}

/** Moves runs off accounts that passed the stop line, when the owner turned automatic rotation on. Returns a stop function. */
export function startRotator(opts: RotatorOptions): () => void {
  const open = opts.openTerminal ?? defaultOpenTerminal;
  const read = opts.read ?? readFresh;
  const log = opts.log ?? ((m: string) => console.error(`[rotator] ${m}`));
  const clock = opts.now ?? Date.now;
  const lastRotated = new Map<string, number>();
  let busy = false;

  const tick = () => {
    if (busy) return;
    busy = true;
    try {
      const { profiles, usage, runs, guardrails } = read();
      const now = clock();
      for (const r of planRotations(profiles, usage, runs, guardrails, lastRotated, now)) {
        try {
          const { run } = handOff(r.runId, r.toProfileId, r.reason);
          lastRotated.set(r.runId, now);
          lastRotated.set(run.id, now);
          const p = getProfile(run.profileId);
          const cmd = p && agentCommand(p, HANDOFF_PROMPT);
          if (p && cmd) open(cmd, envFor(p), run.worktree, `Shiftwell: ${p.name}`);
          try { void Promise.resolve(opts.notify("Shiftwell", `Shiftwell moved ${run.task} to ${p?.name ?? run.profileId}`)).catch(() => {}); } catch { /* ignore */ }
        } catch (e) { log(`could not rotate ${r.runId}: ${(e as Error).message}`); }
      }
    } catch (e) {
      log(`tick failed: ${(e as Error).message}`);
    } finally { busy = false; }
  };
  const t = setInterval(tick, opts.everyMs ?? 60_000);
  t.unref?.();
  return () => clearInterval(t);
}
