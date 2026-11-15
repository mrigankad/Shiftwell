import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRule, listRules, updateRule, deleteRule, reorderRules, pickAccount, type Rule } from "../src/rules.js";
import { getGuardrails, saveGuardrails, checkStart, inQuietHours, blockedPathsNote, validateGuardrails } from "../src/guardrails.js";
import type { Profile } from "../src/profiles.js";
import type { Usage, State } from "../src/usage.js";

beforeEach(() => { process.env.SHIFTWELL_HOME = mkdtempSync(join(tmpdir(), "shiftwell-rules-")); });

const prof = (id: string, name: string): Profile => ({ id, name, provider: "claude", configDir: "", createdAt: "" });
const use = (id: string, state: State, pct: number): Usage => ({
  profileId: id, state, ageMinutes: 0, stale: false, runsOutInMinutes: null, latest: { at: "", fiveHour: { pct, resetsAt: null }, sevenDay: null },
});
const A = prof("a", "Claude A"), B = prof("b", "Claude B"), C = prof("c", "Codex");
const map = (...u: Usage[]) => new Map(u.map((x) => [x.profileId, x]));
const base = { enabled: true, when: {}, prefer: [] as string[], fallback: "most-headroom" as const };

describe("rules store", () => {
  it("creates, updates, deletes and reorders", () => {
    const r1 = createRule({ ...base, name: "One" });
    const r2 = createRule({ ...base, name: "Two" });
    expect(listRules().map((r) => r.name)).toEqual(["One", "Two"]);
    expect(updateRule(r1.id, { ...base, name: "Uno", enabled: false }).name).toBe("Uno");
    expect(reorderRules([r2.id, r1.id]).map((r) => r.id)).toEqual([r2.id, r1.id]);
    expect(() => reorderRules([r1.id])).toThrow();
    expect(() => updateRule("nope", { ...base, name: "x" })).toThrow("Unknown rule");
    expect(deleteRule(r1.id)).toBe(true);
    expect(deleteRule(r1.id)).toBe(false);
  });
  it("rejects bad input", () => {
    expect(() => createRule({ ...base, name: "  " })).toThrow();
    expect(() => createRule({ ...base, name: "x", prefer: [1] })).toThrow();
    expect(() => createRule({ ...base, name: "x", fallback: "weird" })).toThrow();
    expect(() => createRule(null)).toThrow();
  });
});

describe("pickAccount", () => {
  const profiles = [A, B, C];
  it("uses the first matching enabled rule and its preferred order", () => {
    const rules: Rule[] = [
      { id: "r1", name: "Off", enabled: false, when: { taskMatches: "bug" }, prefer: ["c"], fallback: "none" },
      { id: "r2", name: "Bugs", enabled: true, when: { taskMatches: "refactor, BUG" }, prefer: ["b", "a"], fallback: "none" },
    ];
    const p = pickAccount("Fix the login bug", "/x", profiles, map(use("a", "room", 10), use("b", "room", 50)), rules);
    expect(p).toMatchObject({ profileId: "b", ruleId: "r2" });
  });
  it("skips out or low accounts and takes the next preferred", () => {
    const rules: Rule[] = [{ id: "r", name: "R", enabled: true, when: {}, prefer: ["b", "a"], fallback: "none" }];
    const p = pickAccount("x", "/x", profiles, map(use("a", "room", 10), use("b", "low", 90)), rules);
    expect(p).toMatchObject({ profileId: "a", ruleId: "r" });
  });
  it("falls back to most headroom, or moves on when fallback is none", () => {
    const u = map(use("a", "out", 100), use("b", "room", 40), use("c", "room", 5));
    const withFb: Rule[] = [{ id: "r", name: "R", enabled: true, when: { repoMatches: "web" }, prefer: ["a"], fallback: "most-headroom" }];
    expect(pickAccount("t", "/code/Web", profiles, u, withFb)).toMatchObject({ profileId: "c", ruleId: "r" });
    const noFb: Rule[] = [{ ...withFb[0], fallback: "none" }];
    expect(pickAccount("t", "/code/web", profiles, u, noFb)).toMatchObject({ profileId: "c", ruleId: null });
    expect(pickAccount("t", "/code/api", profiles, u, withFb).ruleId).toBeNull();
  });
  it("returns no account when all are out or low", () => {
    const p = pickAccount("t", "/x", profiles, map(use("a", "out", 100), use("b", "low", 90), use("c", "out", 100)), []);
    expect(p.profileId).toBeNull();
    expect(JSON.stringify(p)).not.toMatch(/[–—]/);
  });
});

describe("guardrails", () => {
  it("has defaults and persists", () => {
    expect(getGuardrails()).toEqual({ autoRotate: false, maxParallelRuns: 6, stopAtPct: 95, blockedPaths: [] });
    saveGuardrails({ autoRotate: true, maxParallelRuns: 3, stopAtPct: 90, blockedPaths: [" .env* ", ".env*", "infra/**"], quietHours: { start: "22:00", end: "07:00" } });
    const g = getGuardrails();
    expect(g.blockedPaths).toEqual([".env*", "infra/**"]);
    expect(g.maxParallelRuns).toBe(3);
  });
  it("validates", () => {
    expect(() => validateGuardrails({ maxParallelRuns: 0 })).toThrow();
    expect(() => validateGuardrails({ stopAtPct: 20 })).toThrow();
    expect(() => validateGuardrails({ quietHours: { start: "25:00", end: "07:00" } })).toThrow();
    expect(() => validateGuardrails({ blockedPaths: "x" })).toThrow();
  });
  it("checkStart explains problems", () => {
    const g = validateGuardrails({ maxParallelRuns: 2, stopAtPct: 90 });
    expect(checkStart(["a"], map(use("a", "room", 20)), 1, g)).toEqual({ ok: true, problems: [] });
    const bad = checkStart(["a", "b"], map(use("a", "room", 92), use("b", "out", 100)), 1, g);
    expect(bad.ok).toBe(false);
    expect(bad.problems).toHaveLength(3);
    expect(bad.problems.join(" ")).not.toMatch(/[–—]/);
    expect(checkStart([], new Map(), 0, g).ok).toBe(false);
  });
  it("quiet hours wrap midnight", () => {
    const g = validateGuardrails({ quietHours: { start: "22:00", end: "07:00" } });
    const at = (h: number, m = 0) => new Date(2026, 0, 1, h, m);
    expect(inQuietHours(g, at(23))).toBe(true);
    expect(inQuietHours(g, at(6, 59))).toBe(true);
    expect(inQuietHours(g, at(7))).toBe(false);
    expect(inQuietHours(g, at(12))).toBe(false);
    expect(inQuietHours(validateGuardrails({}), at(23))).toBe(false);
  });
  it("writes a blocked paths note", () => {
    expect(blockedPathsNote(validateGuardrails({}))).toBe("");
    expect(blockedPathsNote(validateGuardrails({ blockedPaths: ["infra/**"] }))).toContain("- infra/**");
  });
});
