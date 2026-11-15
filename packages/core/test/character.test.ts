import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { renderSvg, providerBrands } from "@shiftwell/crew";
import { createProfile, getProfile, updateProfile, defaultCharacter, characterFor, validateCharacter, crewProviderOf } from "../src/profiles.js";

beforeEach(() => { process.env.SHIFTWELL_HOME = mkdtempSync(join(tmpdir(), "shiftwell-char-")); });

describe("default characters", () => {
  it("are deterministic per account and use the provider hoodie and logo", () => {
    const a = createProfile({ name: "Claude A", provider: "claude" });
    expect(defaultCharacter(a)).toEqual(defaultCharacter(a));
    const r = defaultCharacter(a);
    expect(r.logo).toBe("claude");
    expect(r.hoodie).toEqual({ color: providerBrands.claude.hoodie, trim: providerBrands.claude.trim });
    expect(() => renderSvg(r)).not.toThrow();
    expect(validateCharacter(r, a)).toEqual(r);
  });
  it("vary between accounts so new accounts look unique", () => {
    const looks = new Set<string>();
    for (let i = 0; i < 24; i++) {
      const p = { id: `acct${i}`, name: `A${i}`, provider: "codex" as const };
      const { id, name, ...look } = defaultCharacter(p);
      looks.add(JSON.stringify(look));
    }
    expect(looks.size).toBeGreaterThan(18);
  });
  it("maps api presets to the crew provider art", () => {
    expect(crewProviderOf({ provider: "api", api: { preset: "kimi", baseUrl: "", model: "", keyEnv: "" } })).toBe("kimi");
    expect(crewProviderOf({ provider: "api", api: { preset: "ollama-cloud", baseUrl: "", model: "", keyEnv: "" } })).toBe("ollama");
    expect(crewProviderOf({ provider: "api", api: { preset: "mystery", baseUrl: "", model: "", keyEnv: "" } })).toBe("custom");
    expect(crewProviderOf({ provider: "gemini" })).toBe("gemini");
  });
});

describe("updateProfile", () => {
  it("saves a character, keeps it, and clears it with null", () => {
    const a = createProfile({ name: "Claude A", provider: "claude" });
    const rec = { ...defaultCharacter(a), hair: { style: "bob", color: "#112233" }, accessories: ["glasses", "glasses", "beanie"] };
    const u = updateProfile(a.id, { character: rec })!;
    expect(u.character?.hair).toEqual({ style: "bob", color: "#112233" });
    expect(u.character?.accessories).toEqual(["glasses", "beanie"]);
    expect(getProfile(a.id)?.character).toEqual(u.character);
    expect(characterFor(getProfile(a.id)!)).toEqual(u.character);
    updateProfile(a.id, { character: null });
    expect(getProfile(a.id)?.character).toBeUndefined();
    expect(characterFor(getProfile(a.id)!)).toEqual(defaultCharacter(a));
  });
  it("renames, edits the plan, and keeps names unique", () => {
    const a = createProfile({ name: "Claude A", provider: "claude" });
    createProfile({ name: "Codex B", provider: "codex" });
    expect(updateProfile(a.id, { name: "  Aria ", plan: "Max" })).toMatchObject({ name: "Aria", plan: "Max" });
    expect(updateProfile(a.id, { plan: "" })!.plan).toBeUndefined();
    expect(() => updateProfile(a.id, { name: "codex b" })).toThrow(/already exists/);
    expect(() => updateProfile(a.id, { name: "   " })).toThrow(/required/);
  });
  it("keeps the recipe name in step with a rename and returns undefined for unknown ids", () => {
    const a = createProfile({ name: "Claude A", provider: "claude" });
    updateProfile(a.id, { character: defaultCharacter(a) });
    expect(updateProfile(a.id, { name: "Aria" })!.character?.name).toBe("Aria");
    expect(updateProfile("nope", { name: "x" })).toBeUndefined();
  });
  it("rejects bad characters and leaves the old one untouched", () => {
    const a = createProfile({ name: "Claude A", provider: "claude" });
    const good = defaultCharacter(a);
    updateProfile(a.id, { character: good });
    const bad: unknown[] = [
      "nope", [], { ...good, hair: { style: "mohawk", color: "black" } }, { ...good, skinTone: "purple" },
      { ...good, hoodie: { color: "nope", trim: "white" } }, { ...good, accessories: ["crown"] }, { ...good, accessories: "glasses" },
      { ...good, logo: "windows" }, { ...good, blush: "yes" }, { ...good, accent: "red" }, { ...good, hair: { style: "bob", color: "#12" } },
    ];
    for (const b of bad) expect(() => updateProfile(a.id, { character: b }), JSON.stringify(b)).toThrow(/Invalid character/);
    expect(getProfile(a.id)?.character).toEqual(good);
  });
  it("takes the id and name from the profile, not from the payload", () => {
    const a = createProfile({ name: "Claude A", provider: "claude" });
    const u = updateProfile(a.id, { character: { ...defaultCharacter(a), id: "evil", name: "Mallory", overrides: { skin: "#000000" } } })!;
    expect(u.character).toMatchObject({ id: a.id, name: "Claude A" });
    expect(u.character).not.toHaveProperty("overrides");
  });
});
