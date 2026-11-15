import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildApp } from "./app.js";

beforeEach(() => {
  process.env.SHIFTWELL_HOME = mkdtempSync(join(tmpdir(), "shiftwell-daemon-"));
});

describe("daemon api", () => {
  it("creates a profile, lists it, and opens login without running a real terminal", async () => {
    const calls: string[] = [];
    const app = buildApp({ openTerminal: (cmd) => { calls.push(cmd); } });
    const created = await app.inject({ method: "POST", url: "/api/profiles", payload: { name: "Claude A", provider: "claude", plan: "Max" } });
    expect(created.statusCode).toBe(201);
    const id = created.json().id;
    const b = (await app.inject({ url: "/api/board" })).json();
    expect(b.accounts).toHaveLength(1);
    expect(b.accounts[0].usage.state).toBe("unknown");
    const login = await app.inject({ method: "POST", url: `/api/profiles/${id}/login` });
    expect(login.json().command).toBe("claude /login");
    expect(calls).toEqual(["claude /login"]);
  });
  it("starts a run in a worktree and hands it off, opening the right CLI each time", async () => {
    const { execFileSync } = await import("node:child_process");
    const { writeFileSync, existsSync } = await import("node:fs");
    const repo = mkdtempSync(join(tmpdir(), "sw-repo-"));
    const git = (...a: string[]) => execFileSync("git", a, { cwd: repo });
    git("init", "-q"); git("config", "user.email", "t@t"); git("config", "user.name", "t");
    writeFileSync(join(repo, "a.txt"), "x"); git("add", "."); git("commit", "-qm", "init");
    const calls: { cmd: string; cwd?: string }[] = [];
    const app = buildApp({ openTerminal: (cmd, _env, cwd) => { calls.push({ cmd, cwd }); } });
    const a = (await app.inject({ method: "POST", url: "/api/profiles", payload: { name: "A", provider: "claude" } })).json();
    const b = (await app.inject({ method: "POST", url: "/api/profiles", payload: { name: "B", provider: "codex" } })).json();
    const run = await app.inject({ method: "POST", url: "/api/runs", payload: { profileId: a.id, repo, task: "Fix the bug" } });
    expect(run.statusCode).toBe(201);
    expect(calls[0]).toEqual({ cmd: 'claude "Fix the bug"', cwd: run.json().worktree });
    const h = await app.inject({ method: "POST", url: `/api/runs/${run.json().id}/handoff`, payload: { toProfileId: b.id } });
    expect(h.statusCode).toBe(200);
    expect(calls[1].cmd).toMatch(/^codex "Read HANDOFF\.md/);
    expect(existsSync(join(run.json().worktree, "HANDOFF.md"))).toBe(true);
    const board = (await app.inject({ url: "/api/board" })).json();
    expect(board.runs.map((r: any) => r.status)).toEqual(["active", "handed-off"]);
    expect((await app.inject({ method: "POST", url: "/api/runs", payload: { profileId: a.id, repo: tmpdir(), task: "x" } })).statusCode).toBe(400);
  });
  it("validates input", async () => {
    const app = buildApp();
    expect((await app.inject({ method: "POST", url: "/api/profiles", payload: { name: "x", provider: "nope" } })).statusCode).toBe(400);
    expect((await app.inject({ method: "DELETE", url: "/api/profiles/missing" })).statusCode).toBe(404);
  });
});
