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
    // validation failure creates nothing and opens nothing
    const bad = await app.inject({ method: "POST", url: "/api/runs", payload: { profileIds: [a.id, "nope"], repo, task: "t" } });
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
  describe("api accounts", () => {
    const api = { preset: "deepseek", baseUrl: "https://api.deepseek.com/v1", model: "deepseek-chat", keyEnv: "SW_TEST_KEY" };
    const SECRET = "sk-super-secret-123";
    const make = async (app: ReturnType<typeof buildApp>, over: object = {}) =>
      app.inject({ method: "POST", url: "/api/profiles", payload: { name: "Deep", provider: "api", api, ...over } });
    const resp = (status: number, body: unknown = {}) => async () => new Response(JSON.stringify(body), { status });

    it("lists presets", async () => {
      const r = (await buildApp().inject({ url: "/api/presets" })).json();
      expect(r.map((p: any) => p.id)).toEqual(["deepseek", "kimi", "grok", "nim", "ollama-cloud", "custom"]);
      expect(r[0]).toEqual({ id: "deepseek", label: "DeepSeek", baseUrl: "https://api.deepseek.com/v1", keyEnv: "DEEPSEEK_API_KEY", defaultModel: "deepseek-chat" });
    });
    it("creates an api profile, writes config.toml, and rejects bad input", async () => {
      const app = buildApp();
      const bad1 = await make(app, { api: { ...api, keyEnv: "bad-name" } });
      const bad2 = await make(app, { api: { ...api, baseUrl: "http://x.test/v1" } });
      const bad3 = await make(app, { api: undefined });
      expect([bad1.statusCode, bad2.statusCode, bad3.statusCode]).toEqual([409, 409, 409]);
      const ok = await make(app);
      expect(ok.statusCode).toBe(201);
      const { readFileSync } = await import("node:fs");
      const toml = readFileSync(join(ok.json().configDir, "config.toml"), "utf8");
      expect(toml).toContain('env_key = "SW_TEST_KEY"');
      expect(toml).toContain('model_provider = "shiftwell"');
    });
    it("reports keyPresent from the environment, never the key", async () => {
      const app = buildApp();
      await make(app);
      await app.inject({ method: "POST", url: "/api/profiles", payload: { name: "C", provider: "claude" } });
      delete process.env.SW_TEST_KEY;
      let b = (await app.inject({ url: "/api/board" })).json();
      expect(b.accounts[0].keyPresent).toBe(false);
      expect(b.accounts[1].keyPresent).toBeUndefined();
      process.env.SW_TEST_KEY = SECRET;
      try {
        b = (await app.inject({ url: "/api/board" })).json();
        expect(b.accounts[0].keyPresent).toBe(true);
        expect(JSON.stringify(b)).not.toContain(SECRET);
      } finally { delete process.env.SW_TEST_KEY; }
    });
    it("checks the provider with a fake fetch and never echoes the key", async () => {
      const seen: { url: string; auth: string | null }[] = [];
      let impl: (url: string, init: RequestInit) => Promise<Response> = resp(200, { data: [{}, {}, {}] });
      const app = buildApp({ fetch: (async (url: string, init: RequestInit) => { seen.push({ url, auth: new Headers(init.headers).get("authorization") }); return impl(url, init); }) as any });
      const id = (await make(app)).json().id;
      const check = async () => { const r = await app.inject({ method: "POST", url: `/api/profiles/${id}/check` }); return { r, text: r.body }; };
      delete process.env.SW_TEST_KEY;
      expect((await check()).r.json().ok).toBe(false);
      expect(seen).toHaveLength(0);
      process.env.SW_TEST_KEY = SECRET;
      try {
        const ok = await check();
        expect(ok.r.json()).toEqual({ ok: true, models: 3 });
        expect(seen[0]).toEqual({ url: "https://api.deepseek.com/v1/models", auth: `Bearer ${SECRET}` });
        impl = resp(401, { error: `bad key ${SECRET}` });
        const unauth = await check();
        expect(unauth.r.json().ok).toBe(false);
        expect(unauth.r.json().error).toContain("401");
        impl = async () => { throw Object.assign(new Error(`timed out ${SECRET}`), { name: "TimeoutError" }); };
        const slow = await check();
        expect(slow.r.json().ok).toBe(false);
        expect(slow.r.json().error).toContain("8 seconds");
        for (const t of [ok.text, unauth.text, slow.text]) expect(t).not.toContain(SECRET);
      } finally { delete process.env.SW_TEST_KEY; }
      expect((await app.inject({ method: "POST", url: "/api/profiles/nope/check" })).statusCode).toBe(404);
    });
    it("runs an api account through codex with CODEX_HOME", async () => {
      const { execFileSync } = await import("node:child_process");
      const { writeFileSync } = await import("node:fs");
      const repo = mkdtempSync(join(tmpdir(), "sw-repo-"));
      const git = (...a: string[]) => execFileSync("git", a, { cwd: repo });
      git("init", "-q"); git("config", "user.email", "t@t"); git("config", "user.name", "t");
      writeFileSync(join(repo, "a.txt"), "x"); git("add", "."); git("commit", "-qm", "init");
      const calls: { cmd: string; env: Record<string, string> }[] = [];
      const app = buildApp({ openTerminal: (cmd, env) => { calls.push({ cmd, env }); } });
      const p = (await make(app)).json();
      const run = await app.inject({ method: "POST", url: "/api/runs", payload: { profileId: p.id, repo, task: "Do it" } });
      expect(run.statusCode).toBe(201);
      expect(calls[0]).toEqual({ cmd: 'codex "Do it"', env: { CODEX_HOME: p.configDir } });
    });
  });
});
