import { describe, it, expect } from "vitest";
import { detectAlerts, type Seen, type Profile, type Usage, type State, type Suggestion } from "../src/index.js";

const prof = (id: string, name: string): Profile => ({ id, name, provider: "claude", configDir: "", createdAt: "" });
const use = (id: string, state: State, pct = 0): Usage => ({
  profileId: id, state, ageMinutes: 0, stale: false, runsOutInMinutes: null,
  latest: { at: "", fiveHour: { pct, resetsAt: null }, sevenDay: null },
});
const A = prof("a", "Claude A"), B = prof("b", "Claude B");
const map = (...u: Usage[]) => new Map(u.map((x) => [x.profileId, x]));

describe("detectAlerts", () => {
  it("fires nothing on first observation", () => {
    const r = detectAlerts(new Map(), [B], map(use("b", "out", 100)), []);
    expect(r.alerts).toEqual([]);
    expect(r.next.get("b")).toBe("out");
  });
  it("fires for low, out and recovery", () => {
    const prev: Map<string, Seen> = new Map([["b", "room"]]);
    let r = detectAlerts(prev, [B], map(use("b", "low", 91)), []);
    expect(r.alerts).toEqual([{ key: "b:low", title: "Claude B is running low", body: "91% of its 5-hour window used." }]);
    r = detectAlerts(r.next, [B], map(use("b", "low", 92)), []);
    expect(r.alerts).toEqual([]);
    r = detectAlerts(r.next, [B], map(use("b", "out", 100)), []);
    expect(r.alerts[0].title).toBe("Claude B is out");
    r = detectAlerts(r.next, [B], map(use("b", "room", 10)), []);
    expect(r.alerts[0].title).toBe("Claude B has room again");
    const fromLow: Map<string, Seen> = new Map([["b", "low"]]);
    expect(detectAlerts(fromLow, [B], map(use("b", "room", 10)), []).alerts).toHaveLength(1);
  });
  it("ignores unknown and keeps prior state", () => {
    const r = detectAlerts(new Map([["b", "low"]]), [B], map(use("b", "unknown")), []);
    expect(r.alerts).toEqual([]);
    expect(r.next.get("b")).toBe("low");
  });
  it("announces a handoff once", () => {
    const sug: Suggestion[] = [{ from: B, to: A, reason: "Claude B is at 91%; Claude A is at 10%." }];
    const u = map(use("a", "room", 10), use("b", "low", 91));
    const prev: Map<string, Seen> = new Map([["a", "room"], ["b", "low"]]);
    const r1 = detectAlerts(prev, [A, B], u, sug);
    expect(r1.alerts.map((a) => a.key)).toEqual(["b->a"]);
    const r2 = detectAlerts(r1.next, [A, B], u, sug);
    expect(r2.alerts).toEqual([]);
    const r3 = detectAlerts(r2.next, [A, B], u, []);
    const r4 = detectAlerts(r3.next, [A, B], u, sug);
    expect(r4.alerts).toHaveLength(1);
  });
  it("has no dashes in copy", () => {
    const r = detectAlerts(new Map([["b", "room"]]), [B], map(use("b", "low", 91)), []);
    expect(JSON.stringify(r.alerts)).not.toMatch(/[–—]/);
  });
});
