import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { createProfile, startRun, startRuns, handOff, finishRun, listRuns, agentCommand, readHandoffNote, runChanges, pruneRuns, getRun } from "../src/index.js";

let repo: string;
const git = (...a: string[]) => execFileSync("git", a, { cwd: repo, encoding: "utf8" });
beforeEach(() => {
  process.env.SHIFTWELL_HOME = mkdtempSync(join(tmpdir(), "sw-runs-"));
  repo = mkdtempSync(join(tmpdir(), "sw-repo-"));
  git("init", "-q"); git("config", "user.email", "t@t"); git("config", "user.name", "t");
  writeFileSync(join(repo, "a.txt"), "hello\n"); git("add", "."); git("commit", "-qm", "init");
});

describe("runs", () => {
  it("starts in its own worktree and hands off with a note", () => {
    const a = createProfile({ name: "Claude A", provider: "claude" });
    const b = createProfile({ name: "Codex B", provider: "codex" });
    const run = startRun({ profileId: a.id, repo, task: "Add a greeting" });
    expect(existsSync(join(run.worktree, "a.txt"))).toBe(true);
    expect(run.branch).toBe(`shiftwell/${run.id}`);
    writeFileSync(join(run.worktree, "b.txt"), "new\n");
    const { run: next, note } = handOff(run.id, b.id, "Claude A is at 91%.");
    expect(note).toContain("From **Claude A** to **Codex B**");
    expect(note).toContain("?? b.txt");
    expect(readFileSync(join(run.worktree, "HANDOFF.md"), "utf8")).toBe(note);
    expect(next).toMatchObject({ profileId: b.id, worktree: run.worktree, fromRunId: run.id, status: "active" });
    expect(listRuns().find((r) => r.id === run.id)?.status).toBe("handed-off");
    expect(() => handOff(run.id, b.id)).toThrow("not active");
    expect(readHandoffNote(next.id)).toBe(note);
    expect(readHandoffNote(run.id)).toBeNull();
    expect(finishRun(next.id).status).toBe("done");
  });
  it("rejects bad input", () => {
    const a = createProfile({ name: "A", provider: "claude" });
    expect(() => startRun({ profileId: a.id, repo: tmpdir(), task: "x" })).toThrow();
    expect(() => startRun({ profileId: "nope", repo, task: "x" })).toThrow("Unknown account");
    expect(() => startRun({ profileId: a.id, repo, task: "  " })).toThrow("Describe");
  });
  it("fans out one task to several accounts, each in its own worktree", () => {
    const ps = ["A", "B", "C"].map((n, i) => createProfile({ name: n, provider: (["claude", "codex", "gemini"] as const)[i] }));
    const { groupId, runs } = startRuns({ profileIds: ps.map((p) => p.id), repo, task: "Do it" });
    expect(runs).toHaveLength(3);
    expect(new Set(runs.map((r) => r.worktree)).size).toBe(3);
    runs.forEach((r, i) => {
      expect(r.groupId).toBe(groupId);
      expect(r.branch).toBe(`shiftwell/${groupId}-${i + 1}`);
      expect(existsSync(join(r.worktree, "a.txt"))).toBe(true);
    });
    expect(listRuns().filter((r) => r.groupId === groupId)).toHaveLength(3);
    expect(startRun({ profileId: ps[0].id, repo, task: "solo" }).groupId).toBeUndefined();
  });
  it("creates nothing when fan-out validation fails", () => {
    const a = createProfile({ name: "A", provider: "claude" });
    const b = createProfile({ name: "B", provider: "codex" });
    const many = Array.from({ length: 7 }, () => a.id);
    const bad: [string[], string, string][] = [
      [[], repo, "x"], [many, repo, "x"], [[a.id, a.id], repo, "x"], [[a.id, "nope"], repo, "x"],
      [[a.id, b.id], tmpdir(), "x"], [[a.id, b.id], repo, "  "],
    ];
    for (const [profileIds, r, task] of bad) expect(() => startRuns({ profileIds, repo: r, task })).toThrow();
    expect(listRuns()).toEqual([]);
    expect(git("worktree", "list").trim().split("\n")).toHaveLength(1);
    expect(git("branch", "--list", "shiftwell/*").trim()).toBe("");
  });
  it("runs an api account through codex", () => {
    const k = createProfile({ name: "K", provider: "api", api: { preset: "deepseek", baseUrl: "https://api.deepseek.com/v1", model: "deepseek-chat", keyEnv: "DEEPSEEK_API_KEY" } });
    expect(agentCommand(k, "hi")).toBe('codex "hi"');
    expect(startRun({ profileId: k.id, repo, task: "x" }).profileId).toBe(k.id);
    expect(startRuns({ profileIds: [k.id], repo, task: "y" }).runs).toHaveLength(1);
  });
  it("builds CLI commands with the first prompt", () => {
    const g = createProfile({ name: "G", provider: "gemini" });
    expect(agentCommand(g, 'say "hi"')).toBe(`gemini -i "say 'hi'"`);
  });
  it("lets SHIFTWELL_CLI_* swap the program (testing aid)", () => {
    const c = createProfile({ name: "C", provider: "claude" });
    const x = createProfile({ name: "X", provider: "codex" });
    const g = createProfile({ name: "G", provider: "gemini" });
    process.env.SHIFTWELL_CLI_CLAUDE = 'node "/tmp/fake claude.mjs"';
    process.env.SHIFTWELL_CLI_CODEX = "fake-codex";
    process.env.SHIFTWELL_CLI_GEMINI = "fake-gemini";
    try {
      expect(agentCommand(c, "hi")).toBe('node "/tmp/fake claude.mjs" "hi"');
      expect(agentCommand(x)).toBe("fake-codex");
      expect(agentCommand(g, "hi")).toBe('fake-gemini -i "hi"');
    } finally {
      delete process.env.SHIFTWELL_CLI_CLAUDE; delete process.env.SHIFTWELL_CLI_CODEX; delete process.env.SHIFTWELL_CLI_GEMINI;
    }
    expect(agentCommand(c)).toBe("claude");
  });
  it("counts commits and distinct changed files, ignoring HANDOFF.md, and caches", () => {
    const a = createProfile({ name: "A", provider: "claude" });
    const run = startRun({ profileId: a.id, repo, task: "t" });
    expect(runChanges(run)).toEqual({ commits: 0, files: 0 });
    const wgit = (...x: string[]) => execFileSync("git", x, { cwd: run.worktree });
    writeFileSync(join(run.worktree, "c.txt"), "c\n"); wgit("add", "."); wgit("commit", "-qm", "c");
    writeFileSync(join(run.worktree, "a.txt"), "changed\n"); // uncommitted tracked
    writeFileSync(join(run.worktree, "u.txt"), "u\n"); // untracked
    writeFileSync(join(run.worktree, "HANDOFF.md"), "note");
    expect(runChanges(run)).toEqual({ commits: 0, files: 0 }); // cached for 15 s
    expect(runChanges(run, { fresh: true })).toEqual({ commits: 1, files: 3 });
    wgit("add", "a.txt"); wgit("commit", "-qm", "a"); // same file again must not double count
    expect(runChanges(run, { fresh: true })).toEqual({ commits: 2, files: 3 });
    rmSync(run.worktree, { recursive: true, force: true });
    expect(runChanges(run, { fresh: true })).toBeNull();
  });
  it("finishes with worktree removal, keeping the branch", () => {
    const a = createProfile({ name: "A", provider: "claude" });
    const run = startRun({ profileId: a.id, repo, task: "t" });
    const done = finishRun(run.id, { removeWorktree: true });
    expect(done).toMatchObject({ status: "done", worktreeRemoved: true });
    expect(done.warning).toBeUndefined();
    expect(existsSync(run.worktree)).toBe(false);
    expect(git("branch", "--list", run.branch)).toContain(run.branch);
  });
  it("keeps a shared worktree while another run is active, and warns on removal failure", () => {
    const a = createProfile({ name: "A", provider: "claude" });
    const b = createProfile({ name: "B", provider: "codex" });
    const run = startRun({ profileId: a.id, repo, task: "t" });
    const { run: next } = handOff(run.id, b.id);
    const kept = finishRun(run.id, { removeWorktree: true });
    expect(kept.warning).toMatch(/another active run/);
    expect(existsSync(run.worktree)).toBe(true);
    expect(getRun(run.id)?.worktreeRemoved).toBeUndefined();
    // Make git fail: point the run at a repo that is not a git repository.
    const bad = mkdtempSync(join(tmpdir(), "sw-notrepo-"));
    const all = JSON.parse(readFileSync(join(process.env.SHIFTWELL_HOME!, "runs.json"), "utf8"));
    writeFileSync(join(process.env.SHIFTWELL_HOME!, "runs.json"), JSON.stringify(all.map((r: any) => (r.id === next.id ? { ...r, repo: bad } : r))));
    const failed = finishRun(next.id, { removeWorktree: true });
    expect(failed.status).toBe("done");
    expect(failed.warning).toMatch(/Could not remove/);
    expect(existsSync(run.worktree)).toBe(true);
  });
  it("prunes active runs whose worktree is gone", () => {
    const a = createProfile({ name: "A", provider: "claude" });
    const gone = startRun({ profileId: a.id, repo, task: "gone" });
    const kept = startRun({ profileId: a.id, repo, task: "kept" });
    rmSync(gone.worktree, { recursive: true, force: true });
    expect(pruneRuns()).toBe(1);
    expect(getRun(gone.id)).toMatchObject({ status: "done" });
    expect(getRun(gone.id)?.endedAt).toBeTruthy();
    expect(getRun(kept.id)?.status).toBe("active");
    expect(pruneRuns()).toBe(0);
  });
});
