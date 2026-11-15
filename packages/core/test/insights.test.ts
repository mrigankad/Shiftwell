import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createProfile, insights, sub, type Sample } from "../src/index.js";

beforeEach(() => {
  process.env.SHIFTWELL_HOME = mkdtempSync(join(tmpdir(), "shiftwell-insights-"));
});

// Sunday 15 Nov 2026, 12:00 local time.
const NOW = new Date(2026, 10, 15, 12, 0, 0).getTime();
const at = (m: number, d: number, h: number, min = 0) => new Date(2026, m, d, h, min, 0).toISOString();
const w = (pct: number) => ({ pct, resetsAt: null });
const five = (when: string, pct: number, week = 0): Sample => ({ at: when, fiveHour: w(pct), sevenDay: w(week), model: "m" });
const put = (id: string, samples: Sample[]) =>
  writeFileSync(join(sub("usage"), `${id}.jsonl`), samples.map((s) => JSON.stringify(s)).join("\n") + "\n");

describe("insights", () => {
  it("places heat slots by local weekday and hour, over 28 days only", () => {
    const p = createProfile({ name: "A", provider: "claude" });
    put(p.id, [
      five(at(9, 10, 9), 99), // Oct 10, older than 28 days
      five(at(10, 9, 3), 20), // Monday 03h
      five(at(10, 14, 10, 5), 40), // Saturday 10h
      five(at(10, 14, 10, 50), 60),
    ]);
    const a = insights([p], NOW).accounts[0];
    expect(a.heat).toHaveLength(7);
    expect(a.heat.every((r) => r.length === 24)).toBe(true);
    expect(a.heat[0][3]).toBe(20);
    expect(a.heat[5][10]).toBe(60);
    expect(a.heat[5][9]).toBeNull();
    expect(a.heat.flat().filter((v) => v !== null)).toHaveLength(2);
    expect(a.heat.flat()).not.toContain(99);
  });

  it("computes peak, daily average and reading count for the last 7 days", () => {
    const p = createProfile({ name: "A", provider: "claude" });
    put(p.id, [
      five(at(9, 10, 9), 99), // too old
      five(at(10, 9, 3), 20),
      five(at(10, 12, 14, 0), 90),
      five(at(10, 12, 14, 20), 50),
      five(at(10, 14, 10, 5), 60),
      five(at(10, 15, 11, 50), 30),
    ]);
    const a = insights([p], NOW).accounts[0];
    expect(a.readingsLast7d).toBe(5);
    expect(a.peakLast7d).toBe(90);
    expect(a.avgDailyPeak).toBe(50); // days: 20, 90, 60, 30
    expect(a.id).toBe(p.id);
    expect(a.provider).toBe("claude");
  });

  it("uses the daily window for Gemini", () => {
    const p = createProfile({ name: "G", provider: "gemini" });
    put(p.id, [{ at: at(10, 15, 11, 0), fiveHour: null, sevenDay: null, daily: w(70) }]);
    const a = insights([p], NOW).accounts[0];
    expect(a.peakLast7d).toBe(70);
    expect(a.heat[6][11]).toBe(70);
  });

  it("counts hours at low or out and caps each gap at 60 minutes", () => {
    const p = createProfile({ name: "A", provider: "claude" });
    put(p.id, [
      five(at(10, 12, 14, 0), 90), // low, 20 min to next
      five(at(10, 12, 14, 20), 50), // room
      five(at(10, 12, 16, 0), 100), // out, 90 min gap capped to 60
      five(at(10, 12, 17, 30), 10),
    ]);
    expect(insights([p], NOW).accounts[0].hoursAtLimitLast7d).toBeCloseTo(80 / 60, 2);
  });

  it("caps the trailing gap to now too", () => {
    const p = createProfile({ name: "A", provider: "claude" });
    put(p.id, [five(at(10, 15, 8, 0), 95)]);
    expect(insights([p], NOW).accounts[0].hoursAtLimitLast7d).toBe(1);
  });

  it("computes crew headroom from current readings and skips stale ones", () => {
    const a = createProfile({ name: "A", provider: "claude" });
    const b = createProfile({ name: "B", provider: "claude" });
    const c = createProfile({ name: "C", provider: "claude" });
    const d = createProfile({ name: "D", provider: "claude" });
    put(a.id, [five(at(10, 15, 11, 50), 30, 50)]); // worst 50 -> 50 left
    put(b.id, [five(at(10, 15, 11, 55), 10)]); // 90 left
    put(c.id, [five(at(10, 15, 11, 58), 100)]); // 0 left
    put(d.id, [five(at(10, 15, 10, 0), 0)]); // stale
    const r = insights([a, b, c, d], NOW);
    expect(r.crewHeadroomNow).toBe(47);
    expect(r.generatedAt).toBe(new Date(NOW).toISOString());
  });

  it("picks bestNext by most headroom and excludes out accounts", () => {
    const a = createProfile({ name: "Claude A", provider: "claude" });
    const b = createProfile({ name: "Claude C", provider: "claude" });
    const c = createProfile({ name: "Claude X", provider: "claude" });
    put(a.id, [five(at(10, 15, 11, 50), 30)]);
    put(b.id, [five(at(10, 15, 11, 55), 6)]);
    put(c.id, [five(at(10, 15, 11, 58), 100)]);
    const r = insights([a, b, c], NOW);
    expect(r.bestNext).toEqual({ id: b.id, name: "Claude C", reason: "Claude C has 94% left on its tightest limit" });
    expect(insights([c], NOW).bestNext).toBeNull();
  });

  it("handles accounts with no samples", () => {
    const p = createProfile({ name: "A", provider: "api", api: { preset: "deepseek", baseUrl: "https://api.deepseek.com/v1", model: "m", keyEnv: "K_API_KEY" } });
    const r = insights([p], NOW);
    expect(r.accounts[0]).toMatchObject({ readingsLast7d: 0, peakLast7d: null, avgDailyPeak: null, hoursAtLimitLast7d: 0, preset: "deepseek" });
    expect(r.accounts[0].heat.flat().every((v) => v === null)).toBe(true);
    expect(r.crewHeadroomNow).toBeNull();
    expect(r.bestNext).toBeNull();
    expect(insights([], NOW)).toMatchObject({ accounts: [], crewHeadroomNow: null, bestNext: null });
  });
});
