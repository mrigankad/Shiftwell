import { describe, it, expect, vi } from "vitest";
import type { Profile, Usage, State } from "@shiftwell/core";
import { startAlertLoop, xmlEscape, encodePayload, windowsScript, windowsArgs, appleScriptEscape, commandFor } from "./notifier.js";

const P: Profile = { id: "b", name: "Claude B", provider: "claude", configDir: "", createdAt: "" };
const use = (state: State, pct: number): Usage => ({
  profileId: "b", state, ageMinutes: 0, stale: false, runsOutInMinutes: null,
  latest: { at: "", fiveHour: { pct, resetsAt: null }, sevenDay: null },
});

describe("startAlertLoop", () => {
  it("notifies on transitions, using fake time", () => {
    vi.useFakeTimers();
    let u = use("room", 10);
    const notify = vi.fn();
    const stop = startAlertLoop({ notify, everyMs: 1000, read: () => ({ profiles: [P], usage: new Map([["b", u]]) }) });
    expect(notify).not.toHaveBeenCalled(); // first observation
    u = use("low", 91);
    vi.advanceTimersByTime(1000);
    expect(notify).toHaveBeenCalledWith("Claude B is running low", "91% of its 5-hour window used.");
    vi.advanceTimersByTime(3000);
    expect(notify).toHaveBeenCalledTimes(1);
    stop();
    u = use("out", 100);
    vi.advanceTimersByTime(5000);
    expect(notify).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
  it("survives a throwing notify and reader", () => {
    vi.useFakeTimers();
    const stop = startAlertLoop({ notify: () => { throw new Error("x"); }, everyMs: 10, read: () => { throw new Error("y"); } });
    vi.advanceTimersByTime(50);
    stop();
    vi.useRealTimers();
  });
});

describe("escaping", () => {
  const evil = "He said \"hi\" $(calc) `x` <b>&'; Remove-Item *";
  it("escapes xml", () => {
    expect(xmlEscape(evil)).toBe("He said &quot;hi&quot; $(calc) `x` &lt;b&gt;&amp;&apos;; Remove-Item *");
  });
  it("keeps user text out of the script source", () => {
    const script = windowsScript(evil, evil);
    expect(script).not.toContain("calc");
    expect(script).not.toContain("Remove-Item");
    const p = JSON.parse(Buffer.from(encodePayload(evil, "ok"), "base64").toString("utf8"));
    expect(p.title).toBe(xmlEscape(evil));
    expect(p.body).toBe("ok");
    const args = windowsArgs(evil, evil);
    expect(args).toContain("-NoProfile");
    expect(Buffer.from(args[args.length - 1], "base64").toString("utf16le")).toBe(script);
  });
  it("escapes apple script and builds commands", () => {
    expect(appleScriptEscape("a\"b\\c\nd")).toBe("a\\\"b\\\\c d");
    expect(commandFor("t", "b", "linux")).toEqual({ cmd: "notify-send", args: ["--", "t", "b"] });
    expect(commandFor("t\"", "b", "darwin").args[1]).toContain("with title \"t\\\"\"");
  });
});
