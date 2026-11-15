import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { shiftwellHome, sub } from "./paths.js";

export type Provider = "claude" | "codex" | "gemini" | "api";

/**
 * Presets for accounts that run through the Codex CLI with a custom model provider.
 * The model names are editable defaults: providers rename models often, so the user can change them.
 * Only the NAME of the environment variable is ever stored, never a key.
 */
export interface ApiPreset { id: string; label: string; baseUrl: string; keyEnv: string; defaultModel: string }
export const apiPresets: ApiPreset[] = [
  { id: "deepseek", label: "DeepSeek", baseUrl: "https://api.deepseek.com/v1", keyEnv: "DEEPSEEK_API_KEY", defaultModel: "deepseek-chat" },
  { id: "kimi", label: "Kimi (Moonshot)", baseUrl: "https://api.moonshot.ai/v1", keyEnv: "MOONSHOT_API_KEY", defaultModel: "kimi-k2-0905-preview" },
  { id: "grok", label: "Grok (xAI)", baseUrl: "https://api.x.ai/v1", keyEnv: "XAI_API_KEY", defaultModel: "grok-code-fast-1" },
  { id: "nim", label: "NVIDIA NIM", baseUrl: "https://integrate.api.nvidia.com/v1", keyEnv: "NVIDIA_API_KEY", defaultModel: "qwen/qwen3-coder-480b-a35b-instruct" },
  { id: "ollama-cloud", label: "Ollama Cloud", baseUrl: "https://ollama.com/v1", keyEnv: "OLLAMA_API_KEY", defaultModel: "qwen3-coder:480b-cloud" },
  { id: "custom", label: "Custom", baseUrl: "", keyEnv: "", defaultModel: "" },
];

export interface ApiConfig { preset: string; baseUrl: string; model: string; keyEnv: string }

export interface Profile {
  id: string;
  name: string;
  provider: Provider;
  plan?: string;
  /** Only for provider "api": where Codex connects and which env var holds the key (the name, never the key). */
  api?: ApiConfig;
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

export function createProfile(input: { name: string; provider: Provider; plan?: string; api?: ApiConfig }): Profile {
  const name = input.name.trim();
  if (!name) throw new Error("Profile name is required");
  const api = input.provider === "api" ? validateApi(input.api) : undefined;
  const all = listProfiles();
  if (all.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
    throw new Error(`A profile called "${name}" already exists`);
  }
  const id = randomUUID().slice(0, 8);
  const configDir = join(sub("profiles"), `${input.provider}-${id}`);
  mkdirSync(configDir, { recursive: true });
  const profile: Profile = { id, name, provider: input.provider, plan: input.plan, ...(api ? { api } : {}), configDir, createdAt: new Date().toISOString() };
  save([...all, profile]);
  return profile;
}

function validateApi(a: ApiConfig | undefined): ApiConfig {
  if (!a || typeof a !== "object") throw new Error("API accounts need provider settings");
  const baseUrl = String(a.baseUrl ?? "").trim().replace(/\/+$/, "");
  const model = String(a.model ?? "").trim();
  const keyEnv = String(a.keyEnv ?? "").trim();
  let url: URL;
  try { url = new URL(baseUrl); } catch { throw new Error("The base URL is not a valid URL"); }
  if (url.protocol !== "https:") throw new Error("The base URL must start with https://");
  if (!model) throw new Error("Model is required");
  if (/[\r\n"\\]/.test(model)) throw new Error("Model contains characters that are not allowed");
  if (!/^[A-Z_][A-Z0-9_]*$/.test(keyEnv)) throw new Error("The key variable name must look like MY_API_KEY (capitals, digits, underscores)");
  return { preset: String(a.preset ?? "custom"), baseUrl, model, keyEnv };
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
    case "api":
      return { CODEX_HOME: profile.configDir };
    default:
      return {};
  }
}

const tomlStr = (v: string) => JSON.stringify(v);

/**
 * Points Codex at the profile's provider by writing `<configDir>/config.toml`. Codex reads the key itself
 * from the environment variable named in `env_key`; no key is written. Other keys already in the file are kept.
 * Codex 0.166 only speaks the Responses API (`wire_api = "chat"` is rejected).
 */
export function installApiProvider(profile: Profile): string {
  if (!profile.api) throw new Error("This account has no API settings");
  const file = join(profile.configDir, "config.toml");
  mkdirSync(profile.configDir, { recursive: true });
  const old = existsSync(file) ? readFileSync(file, "utf8").split(/\r?\n/) : [];
  const kept: string[] = [];
  let inTable = false;
  let skipping = false;
  for (const line of old) {
    const header = line.match(/^\s*\[+\s*([^\]]+?)\s*\]+\s*$/);
    if (header) {
      inTable = true;
      skipping = header[1] === "model_providers.shiftwell";
      if (skipping) continue;
    } else if (skipping) continue;
    if (!inTable && /^\s*(model|model_provider)\s*=/.test(line)) continue;
    kept.push(line);
  }
  const body = kept.join("\n").replace(/^\n+/, "").replace(/\s+$/, "");
  const out = [
    `model = ${tomlStr(profile.api.model)}`,
    `model_provider = "shiftwell"`,
    "",
    body,
    ...(body ? [""] : []),
    "[model_providers.shiftwell]",
    `name = ${tomlStr(profile.name)}`,
    `base_url = ${tomlStr(profile.api.baseUrl)}`,
    `env_key = ${tomlStr(profile.api.keyEnv)}`,
    `wire_api = "responses"`,
    "",
  ].join("\n");
  writeFileSync(file, out);
  return file;
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
