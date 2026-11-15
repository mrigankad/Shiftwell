import { describe, it, expect, beforeEach, vi } from "vitest";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { request } from "node:http";
import Fastify from "fastify";

// Until the lead exports transcripts from the core index, merge the module straight from source.
vi.mock("@shiftwell/core", async (orig) => ({
  ...(await orig<object>()),
  ...(await import("../../../packages/core/src/transcripts.js")),
}));

import { registerLiveRoutes } from "./routes-live.js";
import { createProfile } from "@shiftwell/core";

let home: string;
beforeEach(() => { home = mkdtempSync(join(tmpdir(), "shiftwell-live-")); process.env.SHIFTWELL_HOME = home; });

const slug = (p: string) => p.replace(/[^a-zA-Z0-9]/g, "-");

function seedRun(worktree: string, withTranscript: boolean) {
  const profile = createProfile({ name: "Claude A", provider: "claude" });
  if (withTranscript) {
    const dir = join(profile.configDir, "projects", slug(worktree));
    mkdirSync(dir, { recursive: true });
    const rows = [
      { type: "user", timestamp: "2026-01-01T00:00:00Z", message: { content: "start" } },
      { type: "assistant", timestamp: "2026-01-01T00:00:05Z", message: { content: [{ type: "text", text: "working" }] } },
    ];
    writeFileSync(join(dir, "s.jsonl"), rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
  }
  const run = { id: "run1", profileId: profile.id, task: "t", repo: worktree, worktree, branch: "b", baseRef: "x", startedAt: new Date().toISOString(), status: "active" };
  writeFileSync(join(home, "runs.json"), JSON.stringify([run]));
  return run;
}

function make() {
  const app = Fastify();
  registerLiveRoutes(app);
  return app;
}

describe("live routes", () => {
  it("returns 404 for an unknown run", async () => {
    const app = make();
    expect((await app.inject({ url: "/api/runs/nope/live" })).statusCode).toBe(404);
    expect((await app.inject({ url: "/api/runs/nope/live/stream" })).statusCode).toBe(404);
  });

  it("answers an empty result with a hint before the CLI writes anything", async () => {
    seedRun(join(home, "wt"), false);
    const res = (await make().inject({ url: "/api/runs/run1/live" })).json();
    expect(res).toMatchObject({ source: "", events: [], lastActivityAt: null });
    expect(res.hint).toMatch(/No transcript/);
  });

  it("returns events and honours since", async () => {
    seedRun(join(home, "wt"), true);
    const app = make();
    const all = (await app.inject({ url: "/api/runs/run1/live" })).json();
    expect(all.events.map((e: { kind: string }) => e.kind)).toEqual(["user", "assistant"]);
    const part = (await app.inject({ url: `/api/runs/run1/live?since=${Date.parse("2026-01-01T00:00:01Z")}` })).json();
    expect(part.events).toHaveLength(1);
  });

  it("streams the first snapshot over SSE", async () => {
    seedRun(join(home, "wt"), true);
    const app = make();
    await app.listen({ port: 0, host: "127.0.0.1" });
    const port = (app.server.address() as { port: number }).port;
    const body = await new Promise<string>((resolve, reject) => {
      const req = request({ host: "127.0.0.1", port, path: "/api/runs/run1/live/stream" }, (res) => {
        expect(res.headers["content-type"]).toContain("text/event-stream");
        res.setEncoding("utf8");
        res.once("data", (d) => { resolve(String(d)); req.destroy(); });
      });
      req.on("error", (e) => { if ((e as NodeJS.ErrnoException).code !== "ECONNRESET") reject(e); });
      req.end();
    });
    expect(body).toContain("data: ");
    expect(body).toContain("working");
    await app.close();
  });
});
