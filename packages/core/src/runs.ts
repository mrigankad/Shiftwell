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
  /** True once finishRun removed the worktree folder (the branch is kept). */
  worktreeRemoved?: boolean;
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
  // The worktree copy is replaced by the next handoff, so keep every note here too.
  writeFileSync(join(sub("handoffs"), `${next.id}.md`), note);
  return { run: next, note };
}

/**
 * Ends a run. With `removeWorktree`, also deletes its worktree folder (the branch stays, so the work can
 * still be merged), unless another active run shares the folder.
 * Removal problems never fail the call: the run is still marked done and the reason comes back in the
 * transient `warning` field (not stored in runs.json).
 */
export function finishRun(runId: string, opts: { removeWorktree?: boolean } = {}): Run & { warning?: string } {
  const run = getRun(runId);
  if (!run) throw new Error("Unknown run");
  update(run.id, { status: "done", endedAt: new Date().toISOString() });
  let warning: string | undefined;
  if (opts.removeWorktree) {
    if (listRuns().some((r) => r.id !== run.id && r.status === "active" && r.worktree === run.worktree)) {
      warning = "Worktree kept: another active run is using it";
    } else if (existsSync(run.worktree)) {
      try {
        git(run.repo, "worktree", "remove", "--force", run.worktree);
        update(run.id, { worktreeRemoved: true });
      } catch (e) {
        warning = `Could not remove the worktree: ${((e as Error).message || "git failed").trim()}`;
      }
    } else {
      update(run.id, { worktreeRemoved: true });
    }
  }
  const done = getRun(run.id)!;
  return warning ? { ...done, warning } : done;
}

/** Marks active runs whose worktree folder is gone as done. Returns how many changed. */
export function pruneRuns(): number {
  const now = new Date().toISOString();
  let n = 0;
  const runs = listRuns().map((r) => {
    if (r.status === "active" && !existsSync(r.worktree)) { n++; return { ...r, status: "done" as const, endedAt: now }; }
    return r;
  });
  if (n) save(runs);
  return n;
}

export interface RunChanges { commits: number; files: number }
const CHANGES_TTL_MS = 15_000;
const changesCache = new Map<string, { at: number; value: RunChanges | null }>();

/** Last computed value for a run (even if stale), without running git. */
export const cachedRunChanges = (run: Run): RunChanges | null => changesCache.get(run.id)?.value ?? null;

/**
 * How much a run has changed since it started: commits past baseRef, and distinct files changed
 * (committed, uncommitted and untracked; HANDOFF.md excluded). Null if the worktree is missing or git fails.
 * Cached per run id for 15 s; pass `fresh` to skip the cache.
 */
export function runChanges(run: Run, opts: { fresh?: boolean } = {}): RunChanges | null {
  const hit = changesCache.get(run.id);
  if (!opts.fresh && hit && Date.now() - hit.at < CHANGES_TTL_MS) return hit.value;
  let value: RunChanges | null = null;
  if (existsSync(run.worktree)) {
    try {
      const commits = parseInt(git(run.worktree, "rev-list", "--count", `${run.baseRef}..HEAD`), 10);
      const paths = new Set<string>();
      const lines = (out: string) => out.split("\0").filter(Boolean);
      for (const p of lines(git(run.worktree, "diff", "--name-only", "-z", run.baseRef))) paths.add(p);
      for (const p of lines(git(run.worktree, "ls-files", "--others", "--exclude-standard", "-z"))) paths.add(p);
      paths.delete("HANDOFF.md");
      value = Number.isFinite(commits) ? { commits, files: paths.size } : null;
    } catch { value = null; }
  }
  changesCache.set(run.id, { at: Date.now(), value });
  return value;
}

/** The handoff note that started this run, if it was picked up from another account. */
export function readHandoffNote(runId: string): string | null {
  const f = join(sub("handoffs"), `${runId}.md`);
  return existsSync(f) ? readFileSync(f, "utf8") : null;
}
