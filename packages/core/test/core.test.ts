import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import {
  createProfile, installApiProvider, loginCommand, apiPresets, listProfiles, removeProfile, envFor,
  installClaudeStatusHook, hookPath, usageFor, stateFor, forecastMinutes, suggestHandoffs, sub,
} from "../src/index.js";

beforeEach(() => {
  process.env.SHIFTWELL_HOME = mkdtempSync(join(tmpdir(), "shiftwell-test-"));
});

const future = Math.floor(Date.now() / 1000) + 3600;

describe("profiles", () => {
  it("creates isolated folders and env", () => {
    const p = createProfile({ name: "Claude A", provider: "claude", plan: "Max 20x" });
    expect(existsSync(p.configDir)).toBe(true);
    expect(envFor(p)).toEqual({ CLAUDE_CONFIG_DIR: p.configDir });
    const c = createProfile({ name: "Codex A", provider: "codex" });
    expect(envFor(c)).toEqual({ CODEX_HOME: c.configDir });
    expect(listProfiles()).toHaveLength(2);
  });
  it("rejects duplicate and empty names", () => {
    createProfile({ name: "Claude A", provider: "claude" });
    expect(() => createProfile({ name: "claude a", provider: "claude" })).toThrow();
    expect(() => createProfile({ name: "  ", provider: "claude" })).toThrow();
  });
  it("removes", () => {
    const p = createProfile({ name: "X", provider: "claude" });
    expect(removeProfile(p.id)).toBe(true);
    expect(listProfiles()).toHaveLength(0);
  });
});

describe("status hook", () => {
  it("merges into existing settings without losing keys", () => {
    const p = createProfile({ name: "Claude A", provider: "claude" });
    writeFileSync(join(p.configDir, "settings.json"), JSON.stringify({ model: "opus" }));
    installClaudeStatusHook(p);
    const s = JSON.parse(readFileSync(join(p.configDir, "settings.json"), "utf8"));
    expect(s.model).toBe("opus");
    expect(s.statusLine.type).toBe("command");
    expect(s.statusLine.command).toContain(p.id);
  });

  it("hook script records rate limits from a real-shaped payload", () => {
    const p = createProfile({ name: "Claude A", provider: "claude" });
    const payload = JSON.stringify({
      model: { display_name: "Opus" },
      rate_limits: { five_hour: { used_percentage: 42.5, resets_at: future }, seven_day: { used_percentage: 61, resets_at: future + 86400 } },
    });
    const out = execFileSync("node", [hookPath(), p.id, sub("usage")], { input: payload }).toString();
    expect(out).toContain("5h 43%");
    const u = usageFor(p);
    expect(u.latest?.fiveHour?.pct).toBe(42.5);
    expect(u.state).toBe("room");
    expect(u.stale).toBe(false);
  });

  it("hook survives garbage input", () => {
    const out = execFileSync("node", [hookPath(), "x", sub("usage")], { input: "not json" }).toString();
    expect(out).toBe("shiftwell");
  });
});

describe("usage math", () => {
  it("state thresholds and expired windows", () => {
    const s = (pct: number, resetsAt: number | null = future) => ({ at: new Date().toISOString(), fiveHour: { pct, resetsAt }, sevenDay: null });
    expect(stateFor(s(40))).toBe("room");
    expect(stateFor(s(90))).toBe("low");
    expect(stateFor(s(100))).toBe("out");
    expect(stateFor(s(100, Math.floor(Date.now() / 1000) - 10))).toBe("room");
    expect(stateFor(null)).toBe("unknown");
  });
  it("forecast from burn rate", () => {
    const now = Date.now();
    const samples = [0, 10, 20].map((m, i) => ({ at: new Date(now - (20 - m) * 60000).toISOString(), fiveHour: { pct: 60 + i * 10, resetsAt: future }, sevenDay: null }));
    // 20 points in 20 minutes = 1%/min, at 80% → 20 min left
    expect(forecastMinutes(samples, now)).toBe(20);
  });
});

describe("advisor", () => {
  it("suggests same-provider account with most room", () => {
    const a = createProfile({ name: "Claude B", provider: "claude" });
    const b = createProfile({ name: "Claude C", provider: "claude" });
    const c = createProfile({ name: "Codex A", provider: "codex" });
    const mk = (id: string, pct: number) => [id, { profileId: id, latest: { at: "", fiveHour: { pct, resetsAt: future }, sevenDay: null }, ageMinutes: 0, stale: false, state: "room" as const, runsOutInMinutes: null }] as const;
    const usage = new Map([mk(a.id, 91), mk(b.id, 6), mk(c.id, 2)]);
    const s = suggestHandoffs(listProfiles(), usage);
    expect(s).toHaveLength(1);
    expect(s[0].to.name).toBe("Claude C");
  });
});

describe("api profiles", () => {
  const api = { preset: "deepseek", baseUrl: "https://api.deepseek.com/v1", model: "deepseek-chat", keyEnv: "DEEPSEEK_API_KEY" };
  it("requires valid settings", () => {
    expect(() => createProfile({ name: "A", provider: "api" })).toThrow();
    expect(() => createProfile({ name: "A", provider: "api", api: { ...api, keyEnv: "lower-case" } })).toThrow("key variable");
    expect(() => createProfile({ name: "A", provider: "api", api: { ...api, baseUrl: "http://x.test/v1" } })).toThrow("https");
    expect(listProfiles()).toEqual([]);
  });
  it("writes config.toml without a key, keeping other settings", () => {
    const p = createProfile({ name: "Deep", provider: "api", api });
    expect(envFor(p)).toEqual({ CODEX_HOME: p.configDir });
    expect(loginCommand(p)).toBeNull();
    writeFileSync(join(p.configDir, "config.toml"), 'model = "old"\nmodel_provider = "old"\napproval_policy = "never"\n\n[model_providers.shiftwell]\nname = "stale"\n\n[projects."x"]\ntrust = true\n');
    installApiProvider(p);
    const t = readFileSync(join(p.configDir, "config.toml"), "utf8");
    expect(t).toContain('model = "deepseek-chat"');
    expect(t).toContain('model_provider = "shiftwell"');
    expect(t).toContain('approval_policy = "never"');
    expect(t).toContain('[projects."x"]');
    expect(t).not.toContain("stale");
    expect(t).not.toContain('"old"');
    expect(t).toContain('[model_providers.shiftwell]\nname = "Deep"\nbase_url = "https://api.deepseek.com/v1"\nenv_key = "DEEPSEEK_API_KEY"\nwire_api = "responses"');
    expect(t.match(/\[model_providers\.shiftwell\]/g)).toHaveLength(1);
  });
  it("has presets", () => {
    expect(apiPresets.map((x) => x.id)).toEqual(["deepseek", "kimi", "grok", "nim", "ollama-cloud", "custom"]);
  });
});
