import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  listProfiles, createProfile, removeProfile, getProfile, envFor, loginCommand,
  installClaudeStatusHook, usageFor, suggestHandoffs, type Provider, type Usage,
} from "@shiftwell/core";

const PROVIDERS: Provider[] = ["claude", "codex", "gemini", "api"];

export function board() {
  const profiles = listProfiles();
  const usage = new Map<string, Usage>(profiles.map((p) => [p.id, usageFor(p)]));
  return {
    generatedAt: new Date().toISOString(),
    accounts: profiles.map((p) => ({ ...p, usage: usage.get(p.id)!, loginCommand: loginCommand(p) })),
    suggestions: suggestHandoffs(profiles, usage).map((s) => ({ fromId: s.from.id, toId: s.to.id, from: s.from.name, to: s.to.name, reason: s.reason })),
  };
}

/** Opens a new terminal window with the profile's env set, running the vendor's own login. */
function openLoginTerminal(cmd: string, env: Record<string, string>) {
  const fullEnv = { ...process.env, ...env };
  if (process.platform === "win32") {
    spawn("cmd.exe", ["/c", "start", "Shiftwell login", "cmd.exe", "/k", cmd], { env: fullEnv, detached: true, stdio: "ignore" }).unref();
  } else if (process.platform === "darwin") {
    const exports = Object.entries(env).map(([k, v]) => `export ${k}='${v}';`).join(" ");
    spawn("osascript", ["-e", `tell app "Terminal" to do script "${exports} ${cmd}"`], { detached: true, stdio: "ignore" }).unref();
  } else {
    spawn("x-terminal-emulator", ["-e", `bash -lc '${cmd}; exec bash'`], { env: fullEnv, detached: true, stdio: "ignore" }).unref();
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
    openTerminal(cmd, envFor(p));
    return { ok: true, command: cmd };
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
