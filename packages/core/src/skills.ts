import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { sub } from "./paths.js";
import type { Profile, Provider } from "./profiles.js";

/** A shared instruction snippet written once and synced into every account's own instruction file. */
export interface Skill {
  id: string;
  name: string;
  description: string;
  /** Markdown instructions. */
  body: string;
  enabled: boolean;
  providers: Provider[];
}

export const SKILL_PROVIDERS: Provider[] = ["claude", "codex", "gemini", "api"];
export const SKILLS_START = "<!-- shiftwell:skills start -->";
export const SKILLS_END = "<!-- shiftwell:skills end -->";

const ID_RE = /^[a-z0-9][a-z0-9-]{0,62}$/;
const dir = () => sub("skills");
const fileOf = (id: string) => join(dir(), `${id}.md`);
const SEEDED = ".seeded";

export const STARTER_SKILLS: Omit<Skill, "id">[] = [
  {
    name: "Commit as you go",
    description: "Small commits so a handoff never loses work",
    enabled: true,
    providers: ["claude", "codex", "gemini", "api"],
    body: "Commit after every meaningful step with a short, plain message.\nNever leave finished work uncommitted. If you are interrupted, the next account picks up from your commits.",
  },
  {
    name: "Write a handoff note before stopping",
    description: "Leave the next account a clear starting point",
    enabled: true,
    providers: ["claude", "codex", "gemini", "api"],
    body: "Before you stop, update HANDOFF.md in the working folder.\nSay what is done, what is left, and anything surprising you learned. Keep it under 20 lines.",
  },
  {
    name: "Respect blocked paths",
    description: "Stay out of folders the team has fenced off",
    enabled: true,
    providers: ["claude", "codex", "gemini", "api"],
    body: "Do not edit generated files, lockfiles, migrations that already ran, or anything under a folder named vendor or dist.\nIf a task seems to need one of those, stop and say so in HANDOFF.md instead of changing it.",
  },
];

export function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

function serialize(s: Skill): string {
  return [
    "---",
    `id: ${JSON.stringify(s.id)}`,
    `name: ${JSON.stringify(s.name)}`,
    `description: ${JSON.stringify(s.description)}`,
    `enabled: ${s.enabled}`,
    `providers: ${JSON.stringify(s.providers)}`,
    "---",
    s.body,
    "",
  ].join("\n");
}

function parse(id: string, text: string): Skill | null {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  if (!m) return null;
  const fm: Record<string, unknown> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(":");
    if (i < 0) continue;
    const key = line.slice(0, i).trim();
    const raw = line.slice(i + 1).trim();
    try { fm[key] = JSON.parse(raw); } catch { fm[key] = raw; }
  }
  const providers = Array.isArray(fm.providers) ? (fm.providers as unknown[]).filter((p): p is Provider => SKILL_PROVIDERS.includes(p as Provider)) : [];
  return {
    id,
    name: typeof fm.name === "string" && fm.name ? fm.name : id,
    description: typeof fm.description === "string" ? fm.description : "",
    body: m[2].replace(/\r?\n$/, ""),
    enabled: fm.enabled === true || fm.enabled === "true",
    providers,
  };
}

function seedOnce() {
  const marker = join(dir(), SEEDED);
  if (existsSync(marker)) return;
  writeFileSync(marker, new Date().toISOString());
  if (readdirSync(dir()).some((f) => f.endsWith(".md"))) return;
  for (const s of STARTER_SKILLS) {
    const id = slugify(s.name);
    writeFileSync(fileOf(id), serialize({ id, ...s }));
  }
}

function checkInput(input: { name?: unknown; description?: unknown; body?: unknown; providers?: unknown }, partial: boolean) {
  const out: Partial<Skill> = {};
  if (!partial || input.name !== undefined) {
    const name = typeof input.name === "string" ? input.name.trim() : "";
    if (!name) throw new Error("Skill name is required");
    if (name.length > 80) throw new Error("Skill name is too long (80 characters at most)");
    out.name = name;
  }
  if (input.description !== undefined) {
    if (typeof input.description !== "string") throw new Error("Description must be text");
    if (input.description.length > 200) throw new Error("Description is too long (200 characters at most)");
    out.description = input.description.trim();
  }
  if (!partial || input.body !== undefined) {
    if (typeof input.body !== "string") throw new Error("Body must be text");
    if (input.body.length > 20000) throw new Error("Body is too long (20000 characters at most)");
    if (input.body.includes(SKILLS_START) || input.body.includes(SKILLS_END)) throw new Error("Body must not contain the Shiftwell block markers");
    out.body = input.body.replace(/\r\n/g, "\n").replace(/\s+$/, "");
  }
  if (!partial || input.providers !== undefined) {
    if (!Array.isArray(input.providers) || input.providers.some((p) => !SKILL_PROVIDERS.includes(p as Provider))) throw new Error("Providers must be a list of claude, codex, gemini or api");
    out.providers = SKILL_PROVIDERS.filter((p) => (input.providers as unknown[]).includes(p));
    if (out.providers.length === 0) throw new Error("Pick at least one provider");
  }
  return out;
}

export function listSkills(): Skill[] {
  seedOnce();
  const out: Skill[] = [];
  for (const f of readdirSync(dir()).sort()) {
    if (!f.endsWith(".md")) continue;
    const id = f.slice(0, -3);
    if (!ID_RE.test(id)) continue;
    const s = parse(id, readFileSync(join(dir(), f), "utf8"));
    if (s) out.push(s);
  }
  return out;
}

export function getSkill(id: string): Skill | undefined {
  if (!ID_RE.test(id)) return undefined;
  seedOnce();
  if (!existsSync(fileOf(id))) return undefined;
  return parse(id, readFileSync(fileOf(id), "utf8")) ?? undefined;
}

export function createSkill(input: { name: string; description?: string; body: string; enabled?: boolean; providers?: Provider[] }): Skill {
  seedOnce();
  const v = checkInput({ ...input, providers: input.providers ?? SKILL_PROVIDERS }, false);
  const base = slugify(v.name!) || "skill";
  let id = base;
  for (let n = 2; existsSync(fileOf(id)); n++) id = `${base}-${n}`;
  const skill: Skill = { id, name: v.name!, description: v.description ?? "", body: v.body!, enabled: input.enabled !== false, providers: v.providers! };
  writeFileSync(fileOf(id), serialize(skill));
  return skill;
}

export function updateSkill(id: string, patch: { name?: string; description?: string; body?: string; enabled?: boolean; providers?: Provider[] }): Skill {
  const cur = getSkill(id);
  if (!cur) throw new Error("No such skill");
  const v = checkInput(patch, true);
  if (patch.enabled !== undefined && typeof patch.enabled !== "boolean") throw new Error("Enabled must be true or false");
  const next: Skill = { ...cur, ...v, enabled: patch.enabled ?? cur.enabled };
  writeFileSync(fileOf(id), serialize(next));
  return next;
}

export function removeSkill(id: string): boolean {
  if (!getSkill(id)) return false;
  rmSync(fileOf(id));
  return true;
}

/** The instruction file each provider reads from its own folder. */
export function instructionFile(profile: Profile): string {
  switch (profile.provider) {
    case "claude": return join(profile.configDir, "CLAUDE.md");
    case "gemini": return join(profile.configDir, ".gemini", "GEMINI.md");
    default: return join(profile.configDir, "AGENTS.md");
  }
}

export function skillsBlock(skills: Skill[]): string {
  const parts = skills.map((s) => `### ${s.name}\n\n${s.body}`);
  return [SKILLS_START, "## Shiftwell skills", "", "Shared by every account. Edit them in Shiftwell, not here.", "", ...parts.flatMap((p) => [p, ""]), SKILLS_END].join("\n");
}

/** Replaces the delimited block in `text` (or appends one) and keeps everything else. A null block removes it. */
export function replaceBlock(text: string, block: string | null): string {
  const a = text.indexOf(SKILLS_START);
  const b = a >= 0 ? text.indexOf(SKILLS_END, a) : -1;
  if (a >= 0 && b >= 0) {
    const before = text.slice(0, a);
    const after = text.slice(b + SKILLS_END.length);
    if (block === null) return (before.replace(/\s+$/, "") + (before.trim() && after.trim() ? "\n\n" : "") + after.replace(/^\s+/, "")).replace(/^\s+/, "");
    return before + block + after;
  }
  if (block === null) return text;
  return text.trim() ? `${text.replace(/\s+$/, "")}\n\n${block}\n` : `${block}\n`;
}

/** Writes the enabled skills into each profile's own instruction file. Returns the files it changed. */
export function syncSkills(profiles: Profile[]): string[] {
  const skills = listSkills().filter((s) => s.enabled);
  const touched: string[] = [];
  for (const p of profiles) {
    const file = instructionFile(p);
    const mine = skills.filter((s) => s.providers.includes(p.provider));
    const old = existsSync(file) ? readFileSync(file, "utf8") : "";
    const next = replaceBlock(old, mine.length ? skillsBlock(mine) : null);
    if (next === old) continue;
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, next);
    touched.push(file);
  }
  return touched;
}
