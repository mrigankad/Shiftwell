import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createProfile, readCodexLimits, mapCodexSnapshot, recordSample, usageFor } from "../src/index.js";

const fake = join(fileURLToPath(new URL(".", import.meta.url)), "fake-codex.mjs");
beforeEach(() => { process.env.SHIFTWELL_HOME = mkdtempSync(join(tmpdir(), "sw-codex-")); });

describe("codex reader", () => {
  it("maps windows by duration, not by position", () => {
    const m = mapCodexSnapshot({ primary: { usedPercent: 9, windowDurationMins: 10080, resetsAt: 1 }, secondary: { usedPercent: 44, windowDurationMins: 300, resetsAt: 2 }, planType: "plus" });
    expect(m.fiveHour?.pct).toBe(44);
    expect(m.sevenDay?.pct).toBe(9);
  });
  it("talks JSON-RPC to the app-server and records a sample", async () => {
    const p = createProfile({ name: "Codex A", provider: "codex" });
    const limits = await readCodexLimits(p, { command: process.execPath, args: [fake] });
    expect(limits).toMatchObject({ fiveHour: { pct: 44 }, sevenDay: { pct: 9 }, plan: "plus" });
    recordSample(p.id, limits);
    expect(usageFor(p).latest?.fiveHour?.pct).toBe(44);
  });
  it("surfaces not-signed-in as an error", async () => {
    const p = createProfile({ name: "signedout", provider: "codex" });
    await expect(readCodexLimits({ ...p, configDir: p.configDir + "-signedout" }, { command: process.execPath, args: [fake] })).rejects.toThrow("Not signed in");
  });
});
