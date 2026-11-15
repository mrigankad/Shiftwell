import { describe, it, expect, beforeEach, vi } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Fastify from "fastify";

// Until the lead adds the exports to the core index, pull the new modules straight from source.

import { registerRuleRoutes } from "./routes-rules.js";
import { createProfile } from "@shiftwell/core";

beforeEach(() => { process.env.SHIFTWELL_HOME = mkdtempSync(join(tmpdir(), "shiftwell-rr-")); });

function make() {
  const app = Fastify();
  registerRuleRoutes(app);
  return app;
}
const rule = (name: string, extra: object = {}) => ({ name, enabled: true, when: {}, prefer: [], fallback: "most-headroom", ...extra });

describe("rule routes", () => {
  it("creates, lists, updates, reorders and deletes rules", async () => {
    const app = make();
    const a = (await app.inject({ method: "POST", url: "/api/rules", payload: rule("A") })).json();
    const b = (await app.inject({ method: "POST", url: "/api/rules", payload: rule("B") })).json();
    expect((await app.inject({ url: "/api/rules" })).json().map((r: { name: string }) => r.name)).toEqual(["A", "B"]);
    const put = await app.inject({ method: "PUT", url: `/api/rules/${a.id}`, payload: rule("A2", { enabled: false }) });
    expect(put.json()).toMatchObject({ id: a.id, name: "A2", enabled: false });
    const order = await app.inject({ method: "PUT", url: "/api/rules/order", payload: { ids: [b.id, a.id] } });
    expect(order.json().map((r: { id: string }) => r.id)).toEqual([b.id, a.id]);
    expect((await app.inject({ method: "DELETE", url: `/api/rules/${a.id}` })).statusCode).toBe(200);
    expect((await app.inject({ method: "DELETE", url: `/api/rules/${a.id}` })).statusCode).toBe(404);
  });

  it("answers 400 for bad input and 404 for unknown rules", async () => {
    const app = make();
    expect((await app.inject({ method: "POST", url: "/api/rules", payload: { name: "" } })).statusCode).toBe(400);
    expect((await app.inject({ method: "POST", url: "/api/rules", payload: rule("x", { fallback: "nope" }) })).statusCode).toBe(400);
    expect((await app.inject({ method: "PUT", url: "/api/rules/order", payload: { ids: "x" } })).statusCode).toBe(400);
    expect((await app.inject({ method: "PUT", url: "/api/rules/order", payload: { ids: ["zzz"] } })).statusCode).toBe(400);
    expect((await app.inject({ method: "PUT", url: "/api/rules/nope", payload: rule("x") })).statusCode).toBe(404);
    expect((await app.inject({ method: "POST", url: "/api/rules/pick", payload: { task: " " } })).statusCode).toBe(400);
    expect((await app.inject({ method: "POST", url: "/api/rules/pick", payload: { task: "x", repo: 4 } })).statusCode).toBe(400);
  });

  it("picks an account", async () => {
    const app = make();
    const p = createProfile({ name: "Claude A", provider: "claude" });
    await app.inject({ method: "POST", url: "/api/rules", payload: rule("Bugs", { when: { taskMatches: "bug" }, prefer: [p.id] }) });
    const hit = (await app.inject({ method: "POST", url: "/api/rules/pick", payload: { task: "Fix a bug", repo: "/x" } })).json();
    expect(hit).toMatchObject({ profileId: p.id, profileName: "Claude A" });
    expect(hit.ruleId).toBeTruthy();
    const miss = (await app.inject({ method: "POST", url: "/api/rules/pick", payload: { task: "write docs" } })).json();
    expect(miss.ruleId).toBeNull();
  });
});

describe("guardrail routes", () => {
  it("reads defaults, saves, and rejects bad values", async () => {
    const app = make();
    expect((await app.inject({ url: "/api/guardrails" })).json()).toMatchObject({ autoRotate: false, maxParallelRuns: 6, stopAtPct: 95 });
    const ok = await app.inject({ method: "PUT", url: "/api/guardrails", payload: { autoRotate: false, maxParallelRuns: 2, stopAtPct: 90, blockedPaths: ["infra/**"], quietHours: { start: "22:00", end: "07:00" } } });
    expect(ok.statusCode).toBe(200);
    expect((await app.inject({ url: "/api/guardrails" })).json().maxParallelRuns).toBe(2);
    expect((await app.inject({ method: "PUT", url: "/api/guardrails", payload: { maxParallelRuns: 0 } })).statusCode).toBe(400);
    expect((await app.inject({ method: "PUT", url: "/api/guardrails", payload: { quietHours: { start: "9pm", end: "07:00" } } })).statusCode).toBe(400);
  });

  it("checks a start", async () => {
    const app = make();
    const p = createProfile({ name: "Claude A", provider: "claude" });
    expect((await app.inject({ method: "POST", url: "/api/guardrails/check", payload: { profileIds: "x" } })).statusCode).toBe(400);
    expect((await app.inject({ method: "POST", url: "/api/guardrails/check", payload: { profileIds: [p.id] } })).json()).toEqual({ ok: true, problems: [] });
    const none = (await app.inject({ method: "POST", url: "/api/guardrails/check", payload: { profileIds: [] } })).json();
    expect(none.ok).toBe(false);
    await app.inject({ method: "PUT", url: "/api/guardrails", payload: { maxParallelRuns: 1 } });
    const many = (await app.inject({ method: "POST", url: "/api/guardrails/check", payload: { profileIds: [p.id, "other"] } })).json();
    expect(many.problems[0]).toContain("Your limit is 1");
  });
});
