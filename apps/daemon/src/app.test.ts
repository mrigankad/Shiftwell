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
  it("validates input", async () => {
    const app = buildApp();
    expect((await app.inject({ method: "POST", url: "/api/profiles", payload: { name: "x", provider: "nope" } })).statusCode).toBe(400);
    expect((await app.inject({ method: "DELETE", url: "/api/profiles/missing" })).statusCode).toBe(404);
  });
});
