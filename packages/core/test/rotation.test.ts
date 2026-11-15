import { describe, it, expect } from "vitest";
import { planRotations, DEFAULT_GUARDRAILS, ROTATION_COOLDOWN_MS, type Profile, type Usage, type Run, type Guardrails } from "../src/index.js";

const NOW = 1_700_000_000_000;
const prof = (id: string, provider: Profile["provider"]): Profile => ({ id, name: id.toUpperCase(), provider, configDir: "/x", createdAt: "" });
const use = (id: string, pct: number, state: Usage["state"] = pct >= 100 ? "out" : pct >= 85 ? "low" : "room"): Usage => ({
  profileId: id, latest: { at: "", fiveHour: { pct, resetsAt: null }, sevenDay: null }, ageMinutes: 1, stale: false, state, runsOutInMinutes: null,
});
const run = (id: string, profileId: string): Run => ({ id, profileId, task: "t", repo: "/r", worktree: "/w", branch: "b", baseRef: "x", startedAt: "", status: "active" });
const g = (o: Partial<Guardrails> = {}): Guardrails => ({ ...DEFAULT_GUARDRAILS, autoRotate: true, ...o });
const map = (...u: Usage[]) => new Map(u.map((x) => [x.profileId, x]));

describe("planRotations", () => {
  const ps = [prof("a", "claude"), prof("b", "claude"), prof("c", "claude"), prof("x", "codex")];
  it("does nothing when autoRotate is off", () => {
    expect(planRotations(ps, map(use("a", 99), use("b", 10)), [run("r1", "a")], g({ autoRotate: false }), new Map(), NOW)).toEqual([]);
  });
  it("moves an over-limit run to the same-provider account with most room", () => {
    const r = planRotations(ps, map(use("a", 96), use("b", 50), use("c", 20), use("x", 0)), [run("r1", "a")], g(), new Map(), NOW);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ runId: "r1", toProfileId: "c" });
    expect(r[0].reason).not.toMatch(/[–—]/);
  });
  it("moves a run whose account is out", () => {
    const r = planRotations(ps, map(use("a", 100), use("b", 40)), [run("r1", "a")], g(), new Map(), NOW);
    expect(r[0].toProfileId).toBe("b");
  });
  it("leaves runs alone below the stop line", () => {
    expect(planRotations(ps, map(use("a", 90), use("b", 10)), [run("r1", "a")], g(), new Map(), NOW)).toEqual([]);
  });
  it("falls back to another provider, never an api account", () => {
    const list = [prof("a", "claude"), prof("k", "api"), prof("x", "codex")];
    const r = planRotations(list, map(use("a", 97), use("k", 0), use("x", 30)), [run("r1", "a")], g(), new Map(), NOW);
    expect(r[0].toProfileId).toBe("x");
  });
  it("respects the 30 minute cooldown", () => {
    const us = map(use("a", 99), use("b", 10));
    const last = new Map([["r1", NOW - ROTATION_COOLDOWN_MS + 1000]]);
    expect(planRotations(ps, us, [run("r1", "a")], g(), last, NOW)).toEqual([]);
    last.set("r1", NOW - ROTATION_COOLDOWN_MS);
    expect(planRotations(ps, us, [run("r1", "a")], g(), last, NOW)).toHaveLength(1);
  });
  it("does nothing when no target has room", () => {
    expect(planRotations(ps, map(use("a", 99), use("b", 90), use("c", 100), use("x", 96)), [run("r1", "a")], g(), new Map(), NOW)).toEqual([]);
  });
  it("never picks the run's own account or two runs onto one target", () => {
    const list = [prof("a", "claude"), prof("a2", "claude"), prof("b", "claude"), prof("c", "claude")];
    const us = map(use("a", 99), use("a2", 99), use("b", 10), use("c", 40));
    const r = planRotations(list, us, [run("r1", "a"), run("r2", "a2")], g(), new Map(), NOW);
    expect(r.map((x) => x.toProfileId)).toEqual(["b", "c"]);
  });
  it("ignores handed-off runs", () => {
    expect(planRotations(ps, map(use("a", 99), use("b", 10)), [{ ...run("r1", "a"), status: "handed-off" }], g(), new Map(), NOW)).toEqual([]);
  });
});
