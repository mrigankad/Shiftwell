import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Fastify from "fastify";
import { registerKnowledgeRoutes } from "./routes-knowledge.js";
import { createProfile } from "@shiftwell/core";

let home: string;
beforeEach(() => { home = mkdtempSync(join(tmpdir(), "shiftwell-know-")); process.env.SHIFTWELL_HOME = home; });

function setup() {
  const app = Fastify();
  registerKnowledgeRoutes(app);
  return app;
}

describe("skills routes", () => {
  it("lists starters, does CRUD and validates", async () => {
    const app = setup();
    const list = (await app.inject({ url: "/api/skills" })).json();
    expect(list).toHaveLength(3);
    const made = await app.inject({ method: "POST", url: "/api/skills", payload: { name: "Use pnpm", body: "Always pnpm.", providers: ["claude"] } });
    expect(made.statusCode).toBe(201);
    const id = made.json().id;
    expect((await app.inject({ method: "PUT", url: `/api/skills/${id}`, payload: { enabled: false } })).json().enabled).toBe(false);
    expect((await app.inject({ method: "PUT", url: `/api/skills/${id}`, payload: { enabled: "no" } })).statusCode).toBe(400);
    expect((await app.inject({ method: "POST", url: "/api/skills", payload: { name: "", body: "x", providers: ["claude"] } })).statusCode).toBe(400);
    expect((await app.inject({ method: "POST", url: "/api/skills", payload: { name: "x", body: "x", providers: ["nope"] } })).statusCode).toBe(400);
    expect((await app.inject({ url: "/api/skills/missing" })).statusCode).toBe(404);
    expect((await app.inject({ method: "DELETE", url: `/api/skills/${id}` })).statusCode).toBe(200);
    expect((await app.inject({ method: "DELETE", url: `/api/skills/${id}` })).statusCode).toBe(404);
  });
  it("syncs to each account's instruction file", async () => {
    const app = setup();
    const p = createProfile({ name: "Claude A", provider: "claude" });
    writeFileSync(join(p.configDir, "CLAUDE.md"), "mine\n");
    const { files } = (await app.inject({ method: "POST", url: "/api/skills/sync" })).json();
    expect(files).toEqual([join(p.configDir, "CLAUDE.md")]);
    const text = readFileSync(files[0], "utf8");
    expect(text).toContain("mine");
    expect(text).toContain("Commit as you go");
  });
});

describe("memory routes", () => {
  it("does note CRUD per repo", async () => {
    const app = setup();
    const repo = join(home, "repo");
    expect((await app.inject({ url: "/api/memory" })).statusCode).toBe(400);
    expect((await app.inject({ url: "/api/memory", query: { repo } })).json().notes).toEqual([]);
    const add = await app.inject({ method: "POST", url: "/api/memory/notes", payload: { repo, text: "Use freeze_time", pinned: true } });
    expect(add.statusCode).toBe(201);
    const id = add.json().id;
    expect((await app.inject({ method: "POST", url: "/api/memory/notes", payload: { repo, text: " " } })).statusCode).toBe(400);
    expect((await app.inject({ method: "PATCH", url: `/api/memory/notes/${id}`, payload: { repo, text: "Use freeze_time always", pinned: false } })).json()).toMatchObject({ text: "Use freeze_time always", pinned: false });
    expect((await app.inject({ method: "PATCH", url: "/api/memory/notes/nope", payload: { repo, pinned: true } })).statusCode).toBe(404);
    expect((await app.inject({ method: "PATCH", url: `/api/memory/notes/${id}`, payload: { repo, pinned: "yes" } })).statusCode).toBe(400);
    expect((await app.inject({ url: "/api/memory", query: { repo } })).json().notes).toHaveLength(1);
    expect((await app.inject({ method: "DELETE", url: `/api/memory/notes/${id}`, query: { repo } })).statusCode).toBe(200);
    expect((await app.inject({ method: "DELETE", url: `/api/memory/notes/${id}`, query: { repo } })).statusCode).toBe(404);
  });
  it("lists repos from runs.json", async () => {
    const app = setup();
    writeFileSync(join(home, "runs.json"), JSON.stringify([{ id: "a", repo: "/x/one" }, { id: "b", repo: "/x/one" }, { id: "c", repo: "/x/two" }]));
    await app.inject({ method: "POST", url: "/api/memory/notes", payload: { repo: "/x/one", text: "n" } });
    expect((await app.inject({ url: "/api/memory/repos" })).json()).toEqual([{ repo: "/x/one", notes: 1 }, { repo: "/x/two", notes: 0 }]);
  });
});
