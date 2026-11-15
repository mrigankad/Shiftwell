import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { shiftwellHome, sub } from "./paths.js";

export type Provider = "claude" | "codex" | "gemini" | "api";

export interface Profile {
  id: string;
  name: string;
  provider: Provider;
  plan?: string;
  /** Folder the vendor CLI uses as its home. Shiftwell never reads credential files inside it. */
  configDir: string;
  createdAt: string;
}

const FILE = () => join(shiftwellHome(), "profiles.json");

export function listProfiles(): Profile[] {
  if (!existsSync(FILE())) return [];
  return JSON.parse(readFileSync(FILE(), "utf8")) as Profile[];
}

function save(all: Profile[]) {
  writeFileSync(FILE(), JSON.stringify(all, null, 2));
}

export function getProfile(id: string): Profile | undefined {
  return listProfiles().find((p) => p.id === id);
}

export function createProfile(input: { name: string; provider: Provider; plan?: string }): Profile {
  const name = input.name.trim();
  if (!name) throw new Error("Profile name is required");
  const all = listProfiles();
  if (all.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
    throw new Error(`A profile called "${name}" already exists`);
  }
  const id = randomUUID().slice(0, 8);
  const configDir = join(sub("profiles"), `${input.provider}-${id}`);
  mkdirSync(configDir, { recursive: true });
  const profile: Profile = { id, name, provider: input.provider, plan: input.plan, configDir, createdAt: new Date().toISOString() };
  save([...all, profile]);
  return profile;
}

export function removeProfile(id: string): boolean {
  const all = listProfiles();
  const next = all.filter((p) => p.id !== id);
  save(next);
  return next.length !== all.length;
}

/** Environment variables that point each official CLI at the profile's own folder. */
export function envFor(profile: Profile): Record<string, string> {
  switch (profile.provider) {
    case "claude":
      return { CLAUDE_CONFIG_DIR: profile.configDir };
    case "codex":
      return { CODEX_HOME: profile.configDir };
    case "gemini":
      // Gemini CLI keeps state under ~/.gemini, so give it its own HOME.
      return { HOME: profile.configDir, USERPROFILE: profile.configDir };
    default:
      return {};
  }
}

/** The command a user runs to sign in through the vendor's own login. */
export function loginCommand(profile: Profile): string | null {
  switch (profile.provider) {
    case "claude": return "claude /login";
    case "codex": return "codex login";
    case "gemini": return "gemini";
    default: return null;
  }
}
