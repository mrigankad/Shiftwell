// End-to-end test of the Shiftwell loop with fake CLIs. No real logins. Run: pnpm e2e
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, realpathSync, readdirSync, openSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import net from "node:net";
import { runUi } from "./ui.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const slash = (p) => p.replace(/\\/g, "/");

// ---- check recorder --------------------------------------------------------------------------
const rows = [];
let currentGroup = "";
const group = (g) => { currentGroup = g; };
async function check(name, fn) {
  const t0 = Date.now();
  try {
    const detail = await fn();
    console.error(`  ok   ${name}`);
    rows.push({ group: currentGroup, name, ok: true, detail: typeof detail === "string" ? detail : "", ms: Date.now() - t0 });
    return true;
  } catch (e) {
    console.error(`  FAIL ${name}: ${String(e?.message ?? e).split(String.fromCharCode(10))[0].slice(0, 120)}`);
    rows.push({ group: currentGroup, name, ok: false, detail: String(e?.message ?? e).split("\n")[0].slice(0, 160), ms: Date.now() - t0 });
    return false;
  }
}
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };
async function until(fn, ms, what) {
  const end = Date.now() + ms;
  let last;
  while (Date.now() < end) {
    try { const v = await fn(); if (v) return v; } catch (e) { last = e; }
    await sleep(150);
  }
  throw new Error(`timed out waiting for ${typeof what === 'function' ? what() : what}${last ? ` (${last.message})` : ""}`);
}

// ---- environment -----------------------------------------------------------------------------
const tmp = realpathSync.native(mkdtempSync(join(tmpdir(), "sw-e2e-")));
const home = join(tmp, "home");
const repo = join(tmp, "repo");
mkdirSync(home); mkdirSync(repo);
const git = (cwd, ...a) => execFileSync("git", a, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
git(repo, "init", "-q"); git(repo, "config", "user.email", "e2e@example.invalid"); git(repo, "config", "user.name", "E2E");
writeFileSync(join(repo, "README.md"), "# Demo repo\n"); git(repo, "add", "."); git(repo, "commit", "-qm", "init");

const freePort = () => new Promise((res, rej) => { const s = net.createServer(); s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => res(p)); }); s.on("error", rej); });
const port = await freePort();
const base = `http://127.0.0.1:${port}`;
const nodeQ = (f) => `node "${slash(join(here, "fakes", f))}"`;

if (!existsSync(join(root, "apps/daemon/dist/server.js"))) { console.error("Build first: pnpm --filter @shiftwell/daemon build"); process.exit(2); }
if (!existsSync(join(root, "apps/web/dist/index.html"))) { console.error("The web UI is not built: pnpm --filter @shiftwell/web build"); process.exit(2); }

const daemonLog = join(tmp, "daemon.log");
const daemonOut = openSync(daemonLog, "a");
const daemon = spawn(process.execPath, [join(root, "apps/daemon/dist/server.js")], {
  cwd: root, stdio: ["ignore", daemonOut, daemonOut],
  env: {
    ...process.env, SHIFTWELL_HOME: home, SHIFTWELL_PORT: String(port), SHIFTWELL_TERMINAL: "headless",
    SHIFTWELL_CLI_CLAUDE: nodeQ("fake-claude.mjs"), SHIFTWELL_CLI_CODEX: nodeQ("fake-codex.mjs"),
    SHIFTWELL_NO_POLL: "1", SHIFTWELL_NO_NOTIFY: "1", SHIFTWELL_ROTATE_MS: "500", FAKE_PCT: "91",
  },
});

function killTree(p) {
  if (!p?.pid) return;
  try { if (process.platform === "win32") execFileSync("taskkill", ["/PID", String(p.pid), "/T", "/F"], { stdio: "ignore" }); else p.kill("SIGKILL"); } catch { /* gone */ }
}
async function cleanup() {
  killTree(daemon);
  await sleep(300);
  for (let i = 0; i < 8; i++) { try { rmSync(tmp, { recursive: true, force: true }); break; } catch { await sleep(400); } }
}

// ---- helpers ---------------------------------------------------------------------------------
async function api(method, path, body) {
  const res = await fetch(base + path, { method, headers: body === undefined ? {} : { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, json };
}
const ok = async (method, path, body) => {
  const r = await api(method, path, body);
  if (r.status >= 300) throw new Error(`${method} ${path} -> ${r.status} ${JSON.stringify(r.json)}`);
  return r.json;
};
const logOf = (run) => join(home, "logs", `${basename(run.worktree)}.log`);
const countIn = (file, text) => { try { return readFileSync(file, "utf8").split(text).length - 1; } catch { return 0; } };
/** Waits until the worktree's headless log has seen `n` finished runs of that fake. */
const fakeDone = (run, which, n = 1) => until(() => countIn(logOf(run), `[fake-${which}] done`) >= n, 20000, () => `fake-${which} to finish (log: ${(() => { try { return readFileSync(logOf(run), 'utf8').slice(-300).replace(/\s+/g, ' '); } catch { return 'missing'; } })()})`);

/** Pushes a status line sample for a Claude account the way Claude Code does: through its settings.json command. */
function statusUpdate(profile, pct) {
  const settings = JSON.parse(readFileSync(join(profile.configDir, "settings.json"), "utf8"));
  const resets = Math.floor(Date.now() / 1000) + 3 * 3600;
  const payload = { model: { display_name: "Fake" }, rate_limits: { five_hour: { used_percentage: pct, resets_at: resets }, seven_day: { used_percentage: pct, resets_at: resets + 86400 } } };
  execFileSync(settings.statusLine.command, { input: JSON.stringify(payload), shell: true, stdio: ["pipe", "ignore", "inherit"] });
}
function writeSample(profile, pct) {
  mkdirSync(join(home, "usage"), { recursive: true });
  const s = { at: new Date().toISOString(), fiveHour: { pct, resetsAt: Math.floor(Date.now() / 1000) + 3 * 3600 }, sevenDay: null };
  writeFileSync(join(home, "usage", `${profile.id}.jsonl`), JSON.stringify(s) + "\n");
}
const board = () => ok("GET", "/api/board");

// ---- the run ---------------------------------------------------------------------------------
let ca, cb, xa, run1, run2, run3, fan;
const ctx = { base, home, repo, out: join(here, "out") };
try {
  await until(async () => (await fetch(base + "/api/health")).ok, 15000, "the daemon to answer");

  group("setup");
  await check("create two Claude accounts and one Codex account", async () => {
    ca = await ok("POST", "/api/profiles", { name: "Claude A", provider: "claude", plan: "Max" });
    cb = await ok("POST", "/api/profiles", { name: "Claude B", provider: "claude", plan: "Pro" });
    xa = await ok("POST", "/api/profiles", { name: "Codex A", provider: "codex", plan: "Plus" });
    const settings = JSON.parse(readFileSync(join(ca.configDir, "settings.json"), "utf8"));
    assert(/claude-status\.mjs/.test(settings.statusLine?.command ?? ""), "status line hook not installed in settings.json");
    const b = await board();
    assert(b.accounts.length === 3, `board shows ${b.accounts.length} accounts`);
  });
  if (!ca || !xa) throw new Error("setup failed, nothing else can run");
  statusUpdate(cb, 20);
  writeSample(xa, 10);

  group("run + live view");
  await check("start a run on Claude A (headless fake claude)", async () => {
    run1 = await ok("POST", "/api/runs", { profileId: ca.id, repo, task: "Add a greeting file" });
    assert(run1.status === "active" && existsSync(run1.worktree), "run not active or no worktree");
    await fakeDone(run1, "claude");
  });
  await check("live view has events and filesTouched", async () => {
    const live = await until(async () => { const l = await ok("GET", `/api/runs/${run1.id}/live`); return l.events.length >= 3 ? l : null; }, 10000, "transcript events");
    assert(live.events.some((e) => e.kind === "user" && /greeting/.test(e.text)), "no user prompt event");
    assert(live.events.some((e) => e.kind === "tool_call" && e.tool === "Write"), "no Write tool_call");
    assert(live.filesTouched.length >= 1, "filesTouched is empty");
    return `${live.events.length} events, ${live.filesTouched.length} file(s), ${live.source.slice(0, 8)}`;
  });
  await check("board shows the run with changes.commits >= 1", async () => {
    const r = await until(async () => (await board()).runs.find((x) => x.id === run1.id && x.changes?.commits >= 1), 8000, "commits on the board");
    return `commits=${r.changes.commits} files=${r.changes.files}`;
  });
  await check("status-hook usage sample appears (91%, low)", async () => {
    const b = await board();
    const a = b.accounts.find((x) => x.id === ca.id);
    assert(a.usage.latest?.fiveHour?.pct === 91, `five hour pct = ${a.usage.latest?.fiveHour?.pct}`);
    assert(a.usage.state === "low", `state = ${a.usage.state}`);
    const hist = await ok("GET", `/api/profiles/${ca.id}/history`);
    assert(hist.length >= 1, "no history samples");
  });

  group("handoff");
  await check("handoff suggestion Claude A -> Claude B appears", async () => {
    const s = (await board()).suggestions.find((x) => x.fromId === ca.id && x.toId === cb.id);
    assert(s, "no suggestion from Claude A to Claude B");
    return s.reason;
  });
  await check("perform the handoff; HANDOFF.md written", async () => {
    const r = await ok("POST", `/api/runs/${run1.id}/handoff`, { toProfileId: cb.id, reason: "e2e" });
    run2 = r.run;
    assert(run2.fromRunId === run1.id && run2.profileId === cb.id, "new run not linked");
    assert(existsSync(join(run1.worktree, "HANDOFF.md")), "HANDOFF.md missing");
    assert(/Add a greeting file/.test(readFileSync(join(run1.worktree, "HANDOFF.md"), "utf8")), "HANDOFF.md lacks the task");
    assert((await ok("GET", `/api/runs/${run2.id}/note`)).note.includes("Handoff:"), "note endpoint empty");
    await fakeDone(run1, "claude", 2);
  });
  await check("second fake's live view has events", async () => {
    const live = await until(async () => { const l = await ok("GET", `/api/runs/${run2.id}/live`); return l.events.length >= 3 ? l : null; }, 10000, "events for run 2");
    assert(live.events.some((e) => e.kind === "user" && /HANDOFF\.md/.test(e.text)), "handoff prompt not seen");
    assert(live.events.some((e) => e.kind === "assistant" && /HANDOFF\.md/.test(e.text)), "fake did not see HANDOFF.md");
    const first = await ok("GET", `/api/runs/${run1.id}/live`);
    assert(first.source !== live.source, "same transcript as run 1");
    return `${live.events.length} events`;
  });
  await check("memory note captured from the handoff", async () => {
    const m = await ok("GET", `/api/memory?repo=${encodeURIComponent(repo)}`);
    assert(m.notes.some((n) => n.source === "handoff" && /Add a greeting file/.test(n.text)), `notes: ${JSON.stringify(m.notes.map((n) => n.text))}`);
  });

  group("auto-rotation");
  await check("Claude B over the stop line gets rotated to Codex A", async () => {
    await ok("PUT", "/api/guardrails", { autoRotate: true, stopAtPct: 95, maxParallelRuns: 6, blockedPaths: [] });
    statusUpdate(cb, 97);
    const b = await board();
    assert(b.accounts.find((x) => x.id === cb.id).usage.latest.fiveHour.pct === 97, "status update not recorded");
    run3 = await until(async () => (await ok("GET", "/api/runs")).find((r) => r.fromRunId === run2.id), 15000, "a rotation (rotator tick)");
    assert(run3.profileId === xa.id, `rotated to ${run3.profileId}, wanted Codex A`);
    const runs = await ok("GET", "/api/runs");
    assert(runs.find((r) => r.id === run2.id).status === "handed-off", "old run not handed off");
    await fakeDone(run1, "codex");
    const live = await until(async () => { const l = await ok("GET", `/api/runs/${run3.id}/live`); return l.events.length >= 3 ? l : null; }, 10000, "codex transcript");
    assert(live.filesTouched.length >= 1, "codex filesTouched empty");
    await ok("PUT", "/api/guardrails", { autoRotate: false, stopAtPct: 95, maxParallelRuns: 6, blockedPaths: [] });
    return (await ok("GET", `/api/runs/${run3.id}/note`)).note.match(/Moved automatically[^\n]*/)?.[0] ?? "";
  });

  group("fan-out + finish");
  await check("fan out 3 parallel runs and compare", async () => {
    statusUpdate(cb, 20);
    fan = await ok("POST", "/api/runs", { profileIds: [ca.id, cb.id, xa.id], repo, task: "Add a changelog entry" });
    assert(fan.runs.length === 3, "expected 3 runs");
    await Promise.all(fan.runs.map((r) => fakeDone(r, r.profileId === xa.id ? "codex" : "claude")));
    const g = await until(async () => { const x = await ok("GET", `/api/groups/${fan.groupId}`); return x.runs.every((r) => r.changes?.commits >= 1) ? x : null; }, 8000, "compare commits");
    assert(g.runs.length === 3, "compare lists " + g.runs.length);
    assert(g.runs.every((r) => r.diffStat && r.diffStat.includes("fake-")), "a diffStat is empty");
    assert(new Set(g.runs.map((r) => r.branch)).size === 3, "branches not distinct");
    return g.runs.map((r) => r.changes.commits + "c").join(" ");
  });
  await check("finish a run with removeWorktree", async () => {
    const r = fan.runs[0];
    const done = await ok("POST", `/api/runs/${r.id}/finish`, { removeWorktree: true });
    assert(done.status === "done" && done.worktreeRemoved === true, `status=${done.status} removed=${done.worktreeRemoved} warning=${done.warning}`);
    assert(!existsSync(r.worktree), "worktree folder still exists");
    assert(git(repo, "branch", "--list", r.branch).includes(r.branch), "branch was deleted");
  });

  group("rules + skills");
  await check("rules pick follows a matching rule", async () => {
    await ok("POST", "/api/rules", { name: "Docs to Codex", when: { taskMatches: "docs" }, prefer: [xa.id], fallback: "most-headroom" });
    const hit = await ok("POST", "/api/rules/pick", { task: "write docs for the api", repo });
    assert(hit.profileId === xa.id && hit.ruleId, `picked ${hit.profileName}: ${hit.reason}`);
    const miss = await ok("POST", "/api/rules/pick", { task: "fix a bug", repo });
    assert(miss.ruleId === null && miss.profileId, `no-rule pick: ${miss.reason}`);
    return hit.reason;
  });
  await check("skills sync writes the block into CLAUDE.md and AGENTS.md", async () => {
    await ok("POST", "/api/skills", { name: "E2E house rule", description: "x", body: "Always say please in commit messages.", enabled: true, providers: ["claude", "codex"] });
    const r = await ok("POST", "/api/skills/sync");
    assert(Array.isArray(r.files) && r.files.length >= 1, "sync returned no files");
    const md = readFileSync(join(ca.configDir, "CLAUDE.md"), "utf8");
    assert(md.includes("shiftwell:skills start") && md.includes("Always say please"), "CLAUDE.md lacks the skill block");
    const ag = readdirSync(xa.configDir).includes("AGENTS.md") ? readFileSync(join(xa.configDir, "AGENTS.md"), "utf8") : "";
    assert(ag.includes("Always say please"), "AGENTS.md lacks the skill block");
  });

  group("web UI");
  Object.assign(ctx, { accounts: [ca, cb, xa], liveRun: run1, codexRun: run3, groupId: fan?.groupId, accountId: ca.id });
  await runUi(ctx, check, group);
} catch (e) {
  rows.push({ group: "fatal", name: "aborted", ok: false, detail: String(e.message).slice(0, 160), ms: 0 });
}

// ---- report ----------------------------------------------------------------------------------
const w = Math.max(...rows.map((r) => r.name.length), 10);
const lines = [];
let g = "";
for (const r of rows) {
  if (r.group !== g) { g = r.group; lines.push(`\n  [${g}]`); }
  lines.push(`  ${r.ok ? "PASS" : "FAIL"}  ${r.name.padEnd(w)}  ${String(r.ms).padStart(6)}ms  ${r.detail}`);
}
const failed = rows.filter((r) => !r.ok).length;
console.log(lines.join("\n"));
console.log(`\n  ${failed ? "FAIL" : "PASS"}: ${rows.length - failed}/${rows.length} checks passed\n`);
if (failed) { try { console.log("--- daemon log tail ---\n" + readFileSync(daemonLog, "utf8").split("\n").slice(-15).join("\n")); } catch { /* none */ } }
await cleanup();
process.exit(failed ? 1 : 0);
