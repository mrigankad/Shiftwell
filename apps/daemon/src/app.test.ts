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
  it("reports run changes on the board, finishes with worktree removal, and prunes", async () => {
    const { execFileSync } = await import("node:child_process");
    const { writeFileSync, existsSync, rmSync } = await import("node:fs");
    const repo = mkdtempSync(join(tmpdir(), "sw-repo-"));
    const git = (...a: string[]) => execFileSync("git", a, { cwd: repo });
    git("init", "-q"); git("config", "user.email", "t@t"); git("config", "user.name", "t");
    writeFileSync(join(repo, "a.txt"), "x"); git("add", "."); git("commit", "-qm", "init");
    const app = buildApp({ openTerminal: () => {} });
    const a = (await app.inject({ method: "POST", url: "/api/profiles", payload: { name: "A", provider: "claude" } })).json();
    const r1 = (await app.inject({ method: "POST", url: "/api/runs", payload: { profileId: a.id, repo, task: "one" } })).json();
    const r2 = (await app.inject({ method: "POST", url: "/api/runs", payload: { profileId: a.id, repo, task: "two" } })).json();
    writeFileSync(join(r1.worktree, "new.txt"), "n");
    let board = (await app.inject({ url: "/api/board" })).json();
    expect(board.runs.find((r: any) => r.id === r1.id).changes).toEqual({ commits: 0, files: 1 });
    // finish r1 and remove its worktree; branch survives
    const fin = await app.inject({ method: "POST", url: `/api/runs/${r1.id}/finish`, payload: { removeWorktree: true } });
    expect(fin.statusCode).toBe(200);
    expect(fin.json()).toMatchObject({ status: "done", worktreeRemoved: true });
    expect(existsSync(r1.worktree)).toBe(false);
    expect(execFileSync("git", ["branch", "--list", r1.branch], { cwd: repo, encoding: "utf8" })).toContain(r1.branch);
    board = (await app.inject({ url: "/api/board" })).json();
    expect(board.runs.find((r: any) => r.id === r1.id).changes).toEqual({ commits: 0, files: 1 }); // cached for non-active
    // prune r2 after its folder vanished
    rmSync(r2.worktree, { recursive: true, force: true });
    const pruned = await app.inject({ method: "POST", url: "/api/runs/prune" });
    expect(pruned.json()).toEqual({ pruned: 1 });
    board = (await app.inject({ url: "/api/board" })).json();
    expect(board.runs.find((r: any) => r.id === r2.id)).toMatchObject({ status: "done" });
  });
  it("fans out to several accounts, compares the group, and keeps the single-run body working", async () => {
    const { execFileSync } = await import("node:child_process");
    const { writeFileSync, existsSync } = await import("node:fs");
    const repo = mkdtempSync(join(tmpdir(), "sw-repo-"));
    const git = (...a: string[]) => execFileSync("git", a, { cwd: repo });
    git("init", "-q"); git("config", "user.email", "t@t"); git("config", "user.name", "t");
    writeFileSync(join(repo, "a.txt"), "x\n"); git("add", "."); git("commit", "-qm", "init");
    const calls: { cmd: string; cwd?: string }[] = [];
    const app = buildApp({ openTerminal: (cmd, _env, cwd) => { calls.push({ cmd, cwd }); } });
    const mk = async (name: string, provider: string) => (await app.inject({ method: "POST", url: "/api/profiles", payload: { name, provider } })).json();
    const [a, b, c] = [await mk("A", "claude"), await mk("B", "codex"), await mk("C", "gemini")];
    const k = await mk("K", "api");
    // validation failure creates nothing and opens nothing
    const bad = await app.inject({ method: "POST", url: "/api/runs", payload: { profileIds: [a.id, k.id], repo, task: "t" } });
    expect(bad.statusCode).toBe(400);
    expect((await app.inject({ url: "/api/runs" })).json()).toEqual([]);
    expect(calls).toHaveLength(0);
    // fan-out of 3
    const res = await app.inject({ method: "POST", url: "/api/runs", payload: { profileIds: [a.id, b.id, c.id], repo, task: "Fix it" } });
    expect(res.statusCode).toBe(201);
    const { groupId, runs } = res.json();
    expect(runs).toHaveLength(3);
    expect(calls.map((x) => x.cwd)).toEqual(runs.map((r: any) => r.worktree));
    expect(runs.every((r: any) => existsSync(r.worktree) && r.groupId === groupId)).toBe(true);
    // compare endpoint
    writeFileSync(join(runs[0].worktree, "a.txt"), "changed\n");
    const cmp = await app.inject({ url: `/api/groups/${groupId}` });
    expect(cmp.statusCode).toBe(200);
    const body = cmp.json();
    expect(body).toMatchObject({ groupId, task: "Fix it" });
    expect(body.runs).toHaveLength(3);
    expect(body.runs[0].changes).toEqual({ commits: 0, files: 1 });
    expect(body.runs[0].diffStat).toContain("a.txt");
    expect(body.runs[1].diffStat).toBe("");
    expect((await app.inject({ url: "/api/groups/nope" })).statusCode).toBe(404);
    // old body still returns a single Run
    const single = await app.inject({ method: "POST", url: "/api/runs", payload: { profileId: a.id, repo, task: "solo" } });
    expect(single.statusCode).toBe(201);
    expect(single.json().id).toBeTruthy();
    expect(single.json().runs).toBeUndefined();
    expect(single.json().groupId).toBeUndefined();
  });
});
