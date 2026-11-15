import { spawn } from "node:child_process";
import { closeSync, mkdirSync, openSync, writeSync } from "node:fs";
import { basename, join } from "node:path";
import {
  shiftwellHome, listProfiles, listRuns, usageFor, getGuardrails, planRotations, handOff, getProfile, envFor, agentCommand, HANDOFF_PROMPT,
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

/** Testing aid: SHIFTWELL_TERMINAL=headless runs commands hidden and logged instead of opening a window. */
export const isHeadless = (): boolean => process.env.SHIFTWELL_TERMINAL === "headless";

/**
 * Runs the command in the background, hidden (detached on POSIX; on Windows a detached child loses its redirected output), in `cwd`, with stdout and stderr appended to `<home>/logs/<name>.log`.
 * The name is the worktree folder (which is the first run id of that worktree) or, without a cwd, the title.
 * Shared by the daemon's login opener and the rotator so both behave the same.
 */
export function openHeadless(cmd: string, env: Record<string, string>, cwd?: string, title = "Shiftwell"): void {
  const dir = join(shiftwellHome(), "logs");
  mkdirSync(dir, { recursive: true });
  const name = (cwd ? basename(cwd) : title).replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "terminal";
  const fd = openSync(join(dir, `${name}.log`), "a");
  try {
    writeSync(fd, `$ ${cmd}
`);
    spawn(cmd, { shell: true, env: { ...process.env, ...env }, cwd, detached: process.platform !== "win32", windowsHide: true, stdio: ["ignore", fd, fd] }).unref();
  } finally { closeSync(fd); }
}

/** Minimal terminal opener: a new window with the account's env, started in the worktree. */
export const defaultOpenTerminal: OpenTerminal = (cmd, env, cwd, title = "Shiftwell") => {
  if (isHeadless()) return openHeadless(cmd, env, cwd, title);
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
          if (process.env.SHIFTWELL_NO_NOTIFY !== "1") try { void Promise.resolve(opts.notify("Shiftwell", `Shiftwell moved ${run.task} to ${p?.name ?? run.profileId}`)).catch(() => {}); } catch { /* ignore */ }
        } catch (e) { log(`could not rotate ${r.runId}: ${(e as Error).message}`); }
      }
    } catch (e) {
      log(`tick failed: ${(e as Error).message}`);
    } finally { busy = false; }
  };
  const t = setInterval(tick, opts.everyMs ?? (Number(process.env.SHIFTWELL_ROTATE_MS) || 60_000));
  t.unref?.();
  return () => clearInterval(t);
}
