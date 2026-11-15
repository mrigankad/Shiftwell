import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createProfile, installGeminiTelemetry, countGeminiRequests, readGeminiDaily, geminiLogPath, stateFor } from "../src/index.js";

beforeEach(() => { process.env.SHIFTWELL_HOME = mkdtempSync(join(tmpdir(), "sw-gem-")); });
const ev = (name: string, ts: string) => JSON.stringify({ attributes: { "event.name": name, "event.timestamp": ts, model: "gemini-2.5-pro" } }, null, 2);

describe("gemini counter", () => {
  it("turns on local telemetry and keeps other settings", () => {
    const p = createProfile({ name: "G", provider: "gemini" });
    const f = join(p.configDir, ".gemini", "settings.json");
    installGeminiTelemetry(p);
    const s1 = JSON.parse(readFileSync(f, "utf8"));
    writeFileSync(f, JSON.stringify({ ...s1, theme: "dark" }));
    installGeminiTelemetry(p);
    const s = JSON.parse(readFileSync(f, "utf8"));
    expect(s.theme).toBe("dark");
    expect(s.telemetry).toMatchObject({ enabled: true, target: "local", logPrompts: false });
  });
  it("counts only today's api requests", () => {
    const now = Date.parse("2026-11-15T20:00:00Z"); // 12:00 Pacific
    const log = [ev("gemini_cli.api_request", "2026-11-15T19:00:00Z"), ev("gemini_cli.api_response", "2026-11-15T19:00:01Z"),
      ev("gemini_cli.api_request", "2026-11-15T19:30:00Z"), ev("gemini_cli.api_request", "2026-11-14T19:00:00Z")].join("\n");
    expect(countGeminiRequests(log, now)).toBe(2);
  });
  it("reports percent of the daily limit and drives state", () => {
    const p = createProfile({ name: "G", provider: "gemini", plan: "Free 10/day" });
    const now = Date.now();
    writeFileSync(geminiLogPath(p.id), Array.from({ length: 9 }, () => ev("gemini_cli.api_request", new Date(now - 1000).toISOString())).join("\n"));
    const r = readGeminiDaily(p, now);
    expect(r).toMatchObject({ requests: 9, limit: 10 });
    expect(stateFor({ at: "", fiveHour: null, sevenDay: null, daily: r.daily }, now)).toBe("low");
  });
});
