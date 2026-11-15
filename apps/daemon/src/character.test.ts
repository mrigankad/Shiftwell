import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildApp } from "./app.js";

beforeEach(() => {
  process.env.SHIFTWELL_HOME = mkdtempSync(join(tmpdir(), "shiftwell-daemon-char-"));
});

const make = async (app: ReturnType<typeof buildApp>, name = "Claude A") =>
  (await app.inject({ method: "POST", url: "/api/profiles", payload: { name, provider: "claude" } })).json();

describe("PATCH /api/profiles/:id", () => {
  it("puts a derived default character on every board account", async () => {
    const app = buildApp();
    const p = await make(app);
    const b = (await app.inject({ url: "/api/board" })).json();
    expect(b.accounts[0]).toMatchObject({ id: p.id, characterCustom: false, character: { id: p.id, logo: "claude" } });
    expect(b.accounts[0].defaultCharacter).toEqual(b.accounts[0].character);
  });

  it("saves a character, shows it on the board, and clears it with null", async () => {
    const app = buildApp();
    const p = await make(app);
    const rec = { ...(await app.inject({ url: "/api/board" })).json().accounts[0].character, eyes: "happy", hair: { style: "spiky", color: "#336699" } };
    const res = await app.inject({ method: "PATCH", url: `/api/profiles/${p.id}`, payload: { character: rec } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ characterCustom: true, character: { eyes: "happy", hair: { style: "spiky", color: "#336699" } } });
    const b = (await app.inject({ url: "/api/board" })).json();
    expect(b.accounts[0]).toMatchObject({ characterCustom: true, character: { eyes: "happy" } });
    const cleared = await app.inject({ method: "PATCH", url: `/api/profiles/${p.id}`, payload: { character: null } });
    expect(cleared.json()).toMatchObject({ characterCustom: false });
  });

  it("edits name and plan", async () => {
    const app = buildApp();
    const p = await make(app);
    const res = await app.inject({ method: "PATCH", url: `/api/profiles/${p.id}`, payload: { name: "Aria", plan: "Max" } });
    expect(res.json()).toMatchObject({ name: "Aria", plan: "Max" });
  });

  it("answers 400 for bad input and 404 for an unknown account", async () => {
    const app = buildApp();
    const p = await make(app);
    await make(app, "Other");
    const patch = (id: string, payload: unknown) => app.inject({ method: "PATCH", url: `/api/profiles/${id}`, payload: payload as object });
    expect((await patch(p.id, {})).statusCode).toBe(400);
    expect((await patch(p.id, { character: "red" })).statusCode).toBe(400);
    expect((await patch(p.id, { character: { bodyType: "slim" } })).statusCode).toBe(400);
    const bad = await patch(p.id, { character: { ...(await app.inject({ url: "/api/board" })).json().accounts[0].character, mouth: "frown" } });
    expect(bad.statusCode).toBe(400);
    expect(bad.json().error).toMatch(/mouth/);
    expect((await patch(p.id, { name: "other" })).statusCode).toBe(400);
    expect((await patch("missing", { name: "x" })).statusCode).toBe(404);
    const raw = await app.inject({ method: "PATCH", url: `/api/profiles/${p.id}`, headers: { "content-type": "application/json" }, payload: "[1]" });
    expect(raw.statusCode).toBe(400);
  });
});
