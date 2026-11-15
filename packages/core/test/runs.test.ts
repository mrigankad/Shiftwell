import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { createProfile, startRun, handOff, finishRun, listRuns, agentCommand, readHandoffNote } from "../src/index.js";

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
    const k = createProfile({ name: "K", provider: "api" });
    expect(() => startRun({ profileId: a.id, repo: tmpdir(), task: "x" })).toThrow();
    expect(() => startRun({ profileId: k.id, repo, task: "x" })).toThrow("API key");
    expect(() => startRun({ profileId: a.id, repo, task: "  " })).toThrow("Describe");
  });
  it("builds CLI commands with the first prompt", () => {
    const g = createProfile({ name: "G", provider: "gemini" });
    expect(agentCommand(g, 'say "hi"')).toBe(`gemini -i "say 'hi'"`);
  });
});
