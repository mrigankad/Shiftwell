import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { createProfile, startRun, listRuns, saveGuardrails, sub, HANDOFF_PROMPT } from "@shiftwell/core";
import { startRotator } from "./rotator.js";

let repo: string;
const git = (...a: string[]) => execFileSync("git", a, { cwd: repo, encoding: "utf8" });
const sample = (id: string, pct: number) =>
  writeFileSync(join(sub("usage"), `${id}.jsonl`), JSON.stringify({ at: new Date().toISOString(), fiveHour: { pct, resetsAt: null }, sevenDay: null }) + "\n");

beforeEach(() => {
  vi.useFakeTimers();
  process.env.SHIFTWELL_HOME = mkdtempSync(join(tmpdir(), "sw-rot-"));
  repo = mkdtempSync(join(tmpdir(), "sw-rotrepo-"));
  git("init", "-q"); git("config", "user.email", "t@t"); git("config", "user.name", "t");
  writeFileSync(join(repo, "a.txt"), "hi\n"); git("add", "."); git("commit", "-qm", "init");
});
afterEach(() => vi.useRealTimers());

describe("startRotator", () => {
  it("hands off, opens the terminal and notifies", () => {
    const a = createProfile({ name: "Claude A", provider: "claude" });
    const b = createProfile({ name: "Claude B", provider: "claude" });
    const run = startRun({ profileId: a.id, repo, task: "Fix it" });
    sample(a.id, 97); sample(b.id, 10);
    saveGuardrails({ autoRotate: true });
    const open = vi.fn(); const notify = vi.fn();
    const stop = startRotator({ openTerminal: open, notify, everyMs: 1000, log: () => {} });
    vi.advanceTimersByTime(1000);
    const runs = listRuns();
    expect(runs.find((r) => r.id === run.id)?.status).toBe("handed-off");
    const next = runs.find((r) => r.fromRunId === run.id)!;
    expect(next.profileId).toBe(b.id);
    expect(open).toHaveBeenCalledTimes(1);
    expect(open.mock.calls[0][0]).toContain(HANDOFF_PROMPT);
    expect(open.mock.calls[0][1]).toMatchObject({ CLAUDE_CONFIG_DIR: b.configDir });
    expect(open.mock.calls[0][2]).toBe(run.worktree);
    expect(notify).toHaveBeenCalledWith("Shiftwell", "Shiftwell moved Fix it to Claude B");
    // Cooldown: the new run is not moved again on the next tick.
    vi.advanceTimersByTime(5000);
    expect(open).toHaveBeenCalledTimes(1);
    stop();
  });
  it("does nothing when autoRotate is off, and swallows errors", () => {
    const a = createProfile({ name: "A", provider: "claude" });
    createProfile({ name: "B", provider: "claude" });
    startRun({ profileId: a.id, repo, task: "x" });
    sample(a.id, 99);
    const open = vi.fn(); const log = vi.fn();
    const stop = startRotator({ openTerminal: open, notify: vi.fn(), everyMs: 1000, log });
    vi.advanceTimersByTime(1000);
    expect(open).not.toHaveBeenCalled();
    stop();
    const stop2 = startRotator({ openTerminal: open, notify: vi.fn(), everyMs: 1000, log, read: () => { throw new Error("boom"); } });
    expect(() => vi.advanceTimersByTime(1000)).not.toThrow();
    expect(log).toHaveBeenCalled();
    stop2();
  });
});
