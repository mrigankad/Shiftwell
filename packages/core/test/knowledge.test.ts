import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { listSkills, createSkill, updateSkill, removeSkill, syncSkills, SKILLS_START, SKILLS_END } from "../src/skills.js";
import { memoryForRepo, addNote, updateNote, removeNote, pinNote, memoryBlock, captureFromHandoff } from "../src/memory.js";
import type { Profile } from "../src/profiles.js";

const prof = (provider: Profile["provider"]): Profile => ({ id: provider, name: provider, provider, configDir: mkdtempSync(join(tmpdir(), `sw-${provider}-`)), createdAt: "" });

beforeEach(() => { process.env.SHIFTWELL_HOME = mkdtempSync(join(tmpdir(), "sw-know-")); });

describe("skills", () => {
  it("seeds three starters once", () => {
    expect(listSkills().map((s) => s.name).sort()).toEqual(["Commit as you go", "Respect blocked paths", "Write a handoff note before stopping"]);
    removeSkill("commit-as-you-go");
    expect(listSkills()).toHaveLength(2);
  });
  it("creates, updates, validates, removes", () => {
    const s = createSkill({ name: "Use pnpm", body: "Always pnpm.", providers: ["claude"] });
    expect(s.id).toBe("use-pnpm");
    expect(createSkill({ name: "Use pnpm", body: "x", providers: ["claude"] }).id).toBe("use-pnpm-2");
    expect(updateSkill(s.id, { enabled: false, body: "Prefer pnpm." })).toMatchObject({ enabled: false, body: "Prefer pnpm." });
    expect(() => createSkill({ name: "", body: "x" })).toThrow();
    expect(() => createSkill({ name: "a", body: "x", providers: [] })).toThrow();
    expect(() => updateSkill("../x", {})).toThrow();
    expect(removeSkill(s.id)).toBe(true);
    expect(removeSkill(s.id)).toBe(false);
  });
  it("syncs only its own block and keeps the rest", () => {
    const c = prof("claude"), x = prof("codex"), g = prof("gemini"), a = prof("api");
    writeFileSync(join(c.configDir, "CLAUDE.md"), "# Mine\n\nKeep this.\n");
    createSkill({ name: "Only claude", body: "CLAUDE ONLY", providers: ["claude"] });
    const files = syncSkills([c, x, g, a]);
    expect(files).toHaveLength(4);
    const claude = readFileSync(join(c.configDir, "CLAUDE.md"), "utf8");
    expect(claude).toContain("Keep this.");
    expect(claude).toContain("CLAUDE ONLY");
    expect(readFileSync(join(x.configDir, "AGENTS.md"), "utf8")).not.toContain("CLAUDE ONLY");
    expect(existsSync(join(g.configDir, ".gemini", "GEMINI.md"))).toBe(true);
    expect(existsSync(join(a.configDir, "AGENTS.md"))).toBe(true);
    writeFileSync(join(c.configDir, "CLAUDE.md"), claude + "\nAfter block.\n");
    updateSkill("only-claude", { body: "NEW BODY" });
    syncSkills([c]);
    const again = readFileSync(join(c.configDir, "CLAUDE.md"), "utf8");
    expect(again.split(SKILLS_START)).toHaveLength(2);
    expect(again.split(SKILLS_END)).toHaveLength(2);
    expect(again).toContain("NEW BODY");
    expect(again).not.toContain("CLAUDE ONLY");
    expect(again).toContain("Keep this.");
    expect(again).toContain("After block.");
    expect(syncSkills([c])).toEqual([]);
  });
  it("removes the block when nothing is enabled", () => {
    const c = prof("claude");
    writeFileSync(join(c.configDir, "CLAUDE.md"), "Keep.\n");
    syncSkills([c]);
    for (const s of listSkills()) updateSkill(s.id, { enabled: false });
    expect(syncSkills([c])).toHaveLength(1);
    const t = readFileSync(join(c.configDir, "CLAUDE.md"), "utf8");
    expect(t).not.toContain(SKILLS_START);
    expect(t).toContain("Keep.");
  });
});

describe("memory", () => {
  const repo = join(tmpdir(), "some-repo");
  it("keeps notes per repo with pinned first in the block", () => {
    expect(memoryForRepo(repo).notes).toEqual([]);
    expect(memoryBlock(repo)).toBe("");
    const a = addNote(repo, { text: "Run make migrate" });
    const b = addNote(repo, { text: "Use Result type", pinned: true });
    addNote(join(tmpdir(), "other"), { text: "elsewhere" });
    expect(memoryForRepo(repo).notes).toHaveLength(2);
    const block = memoryBlock(repo);
    expect(block.indexOf("Use Result type")).toBeLessThan(block.indexOf("Run make migrate"));
    expect(pinNote(repo, a.id).pinned).toBe(true);
    expect(updateNote(repo, b.id, { text: "Result type everywhere" }).text).toBe("Result type everywhere");
    expect(() => addNote(repo, { text: "  " })).toThrow();
    expect(removeNote(repo, a.id)).toBe(true);
    expect(removeNote(repo, a.id)).toBe(false);
  });
  it("captures a handoff once", () => {
    const n = captureFromHandoff(repo, "# Handoff: Add a greeting\n\nbody");
    expect(n).toMatchObject({ text: "Handed off: Add a greeting", source: "handoff" });
    expect(captureFromHandoff(repo, "# Handoff: Add a greeting")).toBeNull();
  });
});
