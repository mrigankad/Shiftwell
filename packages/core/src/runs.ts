import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { shiftwellHome, sub } from "./paths.js";
import { getProfile, type Profile } from "./profiles.js";

export type RunStatus = "active" | "handed-off" | "done";
export interface Run {
  id: string;
  profileId: string;
  task: string;
  repo: string;
  worktree: string;
  branch: string;
  /** Commit the run started from, used to summarise its work. */
  baseRef: string;
  startedAt: string;
  status: RunStatus;
  /** Set on a run that continues another run's work. */
  fromRunId?: string;
  endedAt?: string;
}

const file = () => join(shiftwellHome(), "runs.json");
export function listRuns(): Run[] {
  if (!existsSync(file())) return [];
  try { return JSON.parse(readFileSync(file(), "utf8")); } catch { return []; }
}
const save = (runs: Run[]) => writeFileSync(file(), JSON.stringify(runs, null, 2));
export const getRun = (id: string) => listRuns().find((r) => r.id === id);
const update = (id: string, patch: Partial<Run>) => save(listRuns().map((r) => (r.id === id ? { ...r, ...patch } : r)));

const git = (cwd: string, ...args: string[]) =>
  execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

/** The interactive CLI for a profile, with an optional first prompt. Null for API-key profiles. */
export function agentCommand(profile: Profile, prompt?: string): string | null {
  const q = prompt ? ` "${prompt.replace(/"/g, "'")}"` : "";
  switch (profile.provider) {
    case "claude": return `claude${q}`;
    case "codex": return `codex${q}`;
    case "gemini": return prompt ? `gemini -i${q}` : "gemini";
    default: return null;
  }
}

/** Starts a run in a fresh git worktree on its own branch, so accounts never fight over one checkout. */
export function startRun(input: { profileId: string; repo: string; task: string }): Run {
  const profile = getProfile(input.profileId);
  if (!profile) throw new Error("Unknown account");
  if (!agentCommand(profile)) throw new Error("API key accounts cannot run a CLI agent yet");
  const task = (input.task ?? "").trim();
  if (!task) throw new Error("Describe the task");
  const repo = resolve(input.repo ?? "");
  let top: string;
  try { top = git(repo, "rev-parse", "--show-toplevel"); } catch { throw new Error(`${repo} is not a git repository`); }
  let baseRef: string;
  try { baseRef = git(top, "rev-parse", "HEAD"); } catch { throw new Error("The repository has no commits yet"); }
  const id = randomUUID().slice(0, 8);
  const branch = `shiftwell/${id}`;
  const worktree = join(sub("worktrees"), id);
  git(top, "worktree", "add", "-b", branch, worktree, baseRef);
  const run: Run = { id, profileId: profile.id, task, repo: top, worktree, branch, baseRef, startedAt: new Date().toISOString(), status: "active" };
  save([...listRuns(), run]);
  return run;
}

/** Plain-language note of where the work stands, built from git. */
export function handoffNote(run: Run, from: Profile, to: Profile, reason?: string): string {
  const safe = (...a: string[]) => { try { return git(run.worktree, ...a); } catch { return ""; } };
  const commits = safe("log", "--oneline", `${run.baseRef}..HEAD`);
  const changed = safe("status", "--short");
  const stat = safe("diff", "--stat", run.baseRef);
  const fence = (s: string) => "```\n" + s + "\n```";
  return [
    `# Handoff: ${run.task}`,
    "",
    `From **${from.name}** to **${to.name}** on ${new Date().toLocaleString()}.${reason ? ` ${reason}` : ""}`,
    "",
    "## Task",
    run.task,
    "",
    "## Commits so far",
    commits || "None yet.",
    "",
    "## Uncommitted changes",
    changed ? fence(changed) : "None.",
    "",
    "## Size of the change since the start",
    stat ? fence(stat) : "No tracked changes yet.",
    "",
    "## What to do",
    "Read this note, check the changes above, then carry on with the task. Commit as you go.",
    "",
  ].join("\n");
}

export const HANDOFF_PROMPT = "Read HANDOFF.md in this folder and continue the task it describes.";

/** Ends a run and starts a new one for another account in the same worktree, with a handoff note. */
export function handOff(runId: string, toProfileId: string, reason?: string): { run: Run; note: string } {
  const run = getRun(runId);
  if (!run || run.status !== "active") throw new Error("That run is not active");
  const from = getProfile(run.profileId);
  const to = getProfile(toProfileId);
  if (!from || !to) throw new Error("Unknown account");
  if (to.id === from.id) throw new Error("Pick a different account");
  if (!agentCommand(to)) throw new Error("API key accounts cannot run a CLI agent yet");
  const note = handoffNote(run, from, to, reason);
  writeFileSync(join(run.worktree, "HANDOFF.md"), note);
  const now = new Date().toISOString();
  update(run.id, { status: "handed-off", endedAt: now });
  const next: Run = { ...run, id: randomUUID().slice(0, 8), profileId: to.id, startedAt: now, status: "active", fromRunId: run.id, endedAt: undefined };
  save([...listRuns(), next]);
  return { run: next, note };
}

export function finishRun(runId: string): Run {
  const run = getRun(runId);
  if (!run) throw new Error("Unknown run");
  update(run.id, { status: "done", endedAt: new Date().toISOString() });
  return getRun(run.id)!;
}
