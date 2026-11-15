import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { existsSync, readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  listProfiles, createProfile, removeProfile, getProfile, envFor, loginCommand,
  installClaudeStatusHook, installGeminiTelemetry, usageFor, suggestHandoffs, type Provider, type Usage,
  listRuns, startRun, startRuns, runDiffStat, handOff, finishRun, agentCommand, HANDOFF_PROMPT, readHandoffNote, readSamples,
  runChanges, cachedRunChanges, pruneRuns,
} from "@shiftwell/core";

const PROVIDERS: Provider[] = ["claude", "codex", "gemini", "api"];

export function board() {
  const profiles = listProfiles();
  const usage = new Map<string, Usage>(profiles.map((p) => [p.id, usageFor(p)]));
  return {
    generatedAt: new Date().toISOString(),
    accounts: profiles.map((p) => ({ ...p, usage: usage.get(p.id)!, loginCommand: loginCommand(p) })),
    runs: listRuns().slice(-30).reverse().map((r) => ({ ...r, changes: r.status === "active" ? runChanges(r) : cachedRunChanges(r) })),
    suggestions: suggestHandoffs(profiles, usage).map((s) => ({ fromId: s.from.id, toId: s.to.id, from: s.from.name, to: s.to.name, reason: s.reason })),
  };
}

/** Opens a new terminal window with the profile's env set, running the vendor's own login. */
function openLoginTerminal(cmd: string, env: Record<string, string>, cwd?: string, title = "Shiftwell") {
  const fullEnv = { ...process.env, ...env };
  if (process.platform === "win32") {
    spawn("cmd.exe", ["/c", "start", title, "cmd.exe", "/k", cmd], { env: fullEnv, cwd, detached: true, stdio: "ignore" }).unref();
  } else if (process.platform === "darwin") {
    const exports = Object.entries(env).map(([k, v]) => `export ${k}='${v}';`).join(" ");
    spawn("osascript", ["-e", `tell app "Terminal" to do script "${cwd ? `cd '${cwd}'; ` : ""}${exports} ${cmd}"`], { detached: true, stdio: "ignore" }).unref();
  } else {
    spawn("x-terminal-emulator", ["-e", `bash -lc '${cmd}; exec bash'`], { env: fullEnv, cwd, detached: true, stdio: "ignore" }).unref();
  }
}

export function buildApp(opts: { openTerminal?: typeof openLoginTerminal } = {}) {
  const app = Fastify({ logger: false });
  const openTerminal = opts.openTerminal ?? openLoginTerminal;

  app.get("/api/health", async () => ({ ok: true }));
  app.get("/api/board", async () => board());

  app.post<{ Body: { name?: string; provider?: Provider; plan?: string } }>("/api/profiles", async (req, reply) => {
    const { name, provider, plan } = req.body ?? {};
    if (!name || !provider || !PROVIDERS.includes(provider)) return reply.code(400).send({ error: "name and a valid provider are required" });
    try {
      const p = createProfile({ name, provider, plan });
      if (p.provider === "claude") installClaudeStatusHook(p);
      if (p.provider === "gemini") installGeminiTelemetry(p);
      return reply.code(201).send(p);
    } catch (e) {
      return reply.code(409).send({ error: (e as Error).message });
    }
  });

  app.delete<{ Params: { id: string } }>("/api/profiles/:id", async (req, reply) => {
    return removeProfile(req.params.id) ? { ok: true } : reply.code(404).send({ error: "not found" });
  });

  app.post<{ Params: { id: string } }>("/api/profiles/:id/login", async (req, reply) => {
    const p = getProfile(req.params.id);
    if (!p) return reply.code(404).send({ error: "not found" });
    const cmd = loginCommand(p);
    if (!cmd) return reply.code(400).send({ error: "This provider has no CLI login" });
    openTerminal(cmd, envFor(p), undefined, `Shiftwell login: ${p.name}`);
    return { ok: true, command: cmd };
  });

  const fail = (reply: any, e: unknown) => reply.code(400).send({ error: (e as Error).message });

  app.get("/api/runs", async () => listRuns());

  app.get<{ Params: { id: string } }>("/api/runs/:id/note", async (req, reply) => {
    const run = listRuns().find((r) => r.id === req.params.id);
    if (!run?.fromRunId) return reply.code(404).send({ error: "This run did not start from a handoff" });
    // Runs from before notes were archived only have the worktree copy.
    let note = readHandoffNote(run.id);
    if (note === null) { try { note = readFileSync(join(run.worktree, "HANDOFF.md"), "utf8"); } catch { /* gone */ } }
    return note === null ? reply.code(404).send({ error: "The note for this handoff is no longer on disk" }) : { note };
  });

  app.get<{ Params: { id: string } }>("/api/profiles/:id/history", async (req, reply) => {
    if (!getProfile(req.params.id)) return reply.code(404).send({ error: "not found" });
    return readSamples(req.params.id, 300);
  });

  // Body { profileId, repo, task } starts one run and returns it. Body { profileIds, repo, task } fans out
  // and returns { groupId, runs }. Both open one terminal per run.
  app.post<{ Body: { profileId?: string; profileIds?: string[]; repo?: string; task?: string } }>("/api/runs", async (req, reply) => {
    try {
      const body = req.body ?? {};
      if (body.profileIds !== undefined) {
        const group = startRuns({ profileIds: body.profileIds, repo: body.repo ?? "", task: body.task ?? "" });
        for (const run of group.runs) {
          const p = getProfile(run.profileId)!;
          openTerminal(agentCommand(p, run.task)!, envFor(p), run.worktree, `Shiftwell: ${p.name}`);
        }
        return reply.code(201).send(group);
      }
      const run = startRun({ profileId: body.profileId ?? "", repo: body.repo ?? "", task: body.task ?? "" });
      const p = getProfile(run.profileId)!;
      openTerminal(agentCommand(p, run.task)!, envFor(p), run.worktree, `Shiftwell: ${p.name}`);
      return reply.code(201).send(run);
    } catch (e) { return fail(reply, e); }
  });

  // Side-by-side view of a fan-out group: each run with fresh change counts and its `git diff --stat`.
  app.get<{ Params: { groupId: string } }>("/api/groups/:groupId", async (req, reply) => {
    const runs = listRuns().filter((r) => r.groupId === req.params.groupId);
    if (!runs.length) return reply.code(404).send({ error: "No such group" });
    return {
      groupId: req.params.groupId,
      task: runs[0].task,
      runs: runs.map((r) => ({ ...r, changes: runChanges(r, { fresh: true }), diffStat: runDiffStat(r) })),
    };
  });

  app.post<{ Params: { id: string }; Body: { toProfileId?: string; reason?: string } }>("/api/runs/:id/handoff", async (req, reply) => {
    try {
      const { run, note } = handOff(req.params.id, req.body?.toProfileId ?? "", req.body?.reason);
      const p = getProfile(run.profileId)!;
      openTerminal(agentCommand(p, HANDOFF_PROMPT)!, envFor(p), run.worktree, `Shiftwell: ${p.name}`);
      return { run, note };
    } catch (e) { return fail(reply, e); }
  });

  // Body { removeWorktree?: boolean }. A failed worktree removal does not fail the request: the run is still
  // marked done and the response carries a `warning` string explaining why the folder was kept.
  app.post<{ Params: { id: string }; Body: { removeWorktree?: boolean } | undefined }>("/api/runs/:id/finish", async (req, reply) => {
    try { return finishRun(req.params.id, { removeWorktree: req.body?.removeWorktree === true }); } catch (e) { return fail(reply, e); }
  });

  // Marks active runs whose worktree folder no longer exists as done. Returns { pruned: n }.
  app.post("/api/runs/prune", async () => ({ pruned: pruneRuns() }));

  app.post<{ Params: { id: string } }>("/api/runs/:id/open", async (req, reply) => {
    const run = listRuns().find((r) => r.id === req.params.id);
    const p = run && getProfile(run.profileId);
    if (!run || !p || run.status !== "active") return reply.code(404).send({ error: "No active run" });
    openTerminal(agentCommand(p)!, envFor(p), run.worktree, `Shiftwell: ${p.name}`);
    return { ok: true };
  });

  // Server-sent events: push the board every 5 s so the UI stays live.
  app.get("/api/events", (req, reply) => {
    reply.raw.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
    const send = () => reply.raw.write(`data: ${JSON.stringify(board())}\n\n`);
    send();
    const t = setInterval(send, 5000);
    req.raw.on("close", () => clearInterval(t));
  });

  const webDist = join(dirname(fileURLToPath(import.meta.url)), "../../web/dist");
  if (existsSync(webDist)) app.register(fastifyStatic, { root: webDist });

  return app;
}
