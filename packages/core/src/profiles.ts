import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { shiftwellHome, sub } from "./paths.js";
import {
  parts as crewParts, skinTones, hairColors, hoodieColors, trimColors, eyeColors, themes, providerBrands, renderSvg,
  type Recipe, type Provider as CrewProvider, type Accessory, type BodyType, type BrowStyle, type EyeStyle, type HairStyle,
  type MouthStyle, type Scene, type Theme,
} from "@shiftwell/crew";

export type { Recipe as CharacterRecipe };

export type Provider = "claude" | "codex" | "gemini" | "api";

/**
 * Presets for accounts that run through the Codex CLI with a custom model provider.
 * The model names are editable defaults: providers rename models often, so the user can change them.
 * Only the NAME of the environment variable is ever stored, never a key.
 */
/** "responses": the provider speaks the OpenAI Responses API, Codex connects directly. "chat": only Chat Completions, Codex goes through the local shim. */
export type Wire = "responses" | "chat";
export interface ApiPreset { id: string; label: string; baseUrl: string; keyEnv: string; defaultModel: string; wire: Wire }
export const apiPresets: ApiPreset[] = [
  { id: "deepseek", label: "DeepSeek", baseUrl: "https://api.deepseek.com/v1", keyEnv: "DEEPSEEK_API_KEY", defaultModel: "deepseek-chat", wire: "chat" },
  { id: "kimi", label: "Kimi (Moonshot)", baseUrl: "https://api.moonshot.ai/v1", keyEnv: "MOONSHOT_API_KEY", defaultModel: "kimi-k2-0905-preview", wire: "chat" },
  { id: "grok", label: "Grok (xAI)", baseUrl: "https://api.x.ai/v1", keyEnv: "XAI_API_KEY", defaultModel: "grok-code-fast-1", wire: "responses" },
  { id: "nim", label: "NVIDIA NIM", baseUrl: "https://integrate.api.nvidia.com/v1", keyEnv: "NVIDIA_API_KEY", defaultModel: "qwen/qwen3-coder-480b-a35b-instruct", wire: "chat" },
  { id: "ollama-cloud", label: "Ollama Cloud", baseUrl: "https://ollama.com/v1", keyEnv: "OLLAMA_API_KEY", defaultModel: "qwen3-coder:480b-cloud", wire: "responses" },
  { id: "custom", label: "Custom", baseUrl: "", keyEnv: "", defaultModel: "", wire: "responses" },
];

/** `wire` is optional so profiles saved before it existed keep working: it then comes from the preset. */
export interface ApiConfig { preset: string; baseUrl: string; model: string; keyEnv: string; wire?: Wire }

/** Name of the dummy variable Codex is told to read for chat-wire accounts. The shim ignores its value. */
export const SHIM_KEY_ENV = "SHIFTWELL_SHIM_KEY";
export const SHIM_KEY_PLACEHOLDER = "shiftwell-local-shim";

export function apiWire(profile: Profile): Wire {
  const a = profile.api;
  if (!a) return "responses";
  return a.wire ?? apiPresets.find((p) => p.id === a.preset)?.wire ?? "responses";
}

/** Base URL Codex uses for a chat-wire profile: the daemon's own translator on loopback. */
export function shimBaseUrl(profileId: string, port: number = Number(process.env.SHIFTWELL_PORT ?? 4520)): string {
  return `http://127.0.0.1:${port}/shim/${profileId}/v1`;
}

export interface Profile {
  id: string;
  name: string;
  provider: Provider;
  plan?: string;
  /** The account's pixel character (crew Recipe JSON). Absent until edited: see characterFor for the derived default. */
  character?: Recipe;
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

// ---- Characters ----------------------------------------------------------------------------------

/** The crew art provider an account wears: its own CLI, or the preset it talks to. */
export function crewProviderOf(profile: Pick<Profile, "provider" | "api">): CrewProvider {
  if (profile.provider !== "api") return profile.provider;
  switch (profile.api?.preset) {
    case "kimi": case "grok": case "deepseek": case "nim": return profile.api.preset;
    case "ollama-cloud": case "ollama": return "ollama";
    default: return "custom";
  }
}

/** FNV-1a, then mulberry32: a small deterministic stream of numbers from any string. */
function seeded(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const keys = <T extends object>(o: T) => Object.keys(o) as (keyof T & string)[];
const BODIES = keys(crewParts.builds) as BodyType[];
const HAIR_STYLES = keys(crewParts.hairs) as HairStyle[];
const EYES = keys(crewParts.eyes) as EyeStyle[];
const BROWS = keys(crewParts.brows) as BrowStyle[];
const MOUTHS = keys(crewParts.mouths) as MouthStyle[];
const ACCESSORIES = keys(crewParts.accessories) as Accessory[];
const SCENES = keys(crewParts.backgrounds) as Scene[];
const THEMES = keys(themes) as Theme[];

/**
 * A deterministic character from the account id and provider: the provider's hoodie, trim and logo,
 * with hair, skin, face, accessories and backdrop varied by the id. The same account always gets the same one.
 */
export function defaultCharacter(profile: Pick<Profile, "id" | "name" | "provider" | "api">): Recipe {
  const provider = crewProviderOf(profile);
  const brand = providerBrands[provider];
  const rnd = seeded(`${profile.id}:${provider}`);
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)]!;
  const acc: Accessory[] = [];
  if (rnd() < 0.55) acc.push(pick(ACCESSORIES));
  return {
    id: profile.id, name: profile.name, provider,
    bodyType: pick(BODIES), skinTone: pick(keys(skinTones)),
    hair: { style: pick(HAIR_STYLES), color: pick(keys(hairColors)) },
    eyes: pick(EYES), eyeColor: pick(keys(eyeColors)), brows: pick(BROWS), mouth: pick(MOUTHS), blush: rnd() < 0.7,
    hoodie: { color: brand.hoodie, trim: brand.trim },
    logo: provider, accessories: acc,
    background: { scene: pick(SCENES), theme: pick(THEMES) },
  };
}

/** The recipe to show for a profile: the saved one, else the derived default. */
export function characterFor(profile: Profile): Recipe {
  return profile.character ?? defaultCharacter(profile);
}

const HEX = /^#[0-9a-fA-F]{6}$/;
const fail = (m: string): never => { throw new Error(`Invalid character: ${m}`); };

/** Checks an untrusted recipe against the crew tables and returns a clean copy. id and name come from the profile. */
export function validateCharacter(input: unknown, profile: Pick<Profile, "id" | "name">): Recipe {
  if (!input || typeof input !== "object" || Array.isArray(input)) return fail("expected an object");
  const r = input as Record<string, any>;
  const oneOf = <T extends string>(v: unknown, list: readonly T[], what: string): T =>
    typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T) : fail(`${what} must be one of ${list.join(", ")}`);
  const colour = (v: unknown, table: object, what: string): string => {
    if (typeof v === "string" && (HEX.test(v) || Object.prototype.hasOwnProperty.call(table, v))) return v;
    return fail(`${what} must be a palette name or a #RRGGBB colour`);
  };
  const hair = r.hair && typeof r.hair === "object" ? r.hair : fail("hair is required");
  const hoodie = r.hoodie && typeof r.hoodie === "object" ? r.hoodie : fail("hoodie is required");
  const bg = r.background && typeof r.background === "object" ? r.background : fail("background is required");
  if (!Array.isArray(r.accessories)) fail("accessories must be a list");
  const accessories = [...new Set((r.accessories as unknown[]).map((a) => oneOf(a, ACCESSORIES, "accessory")))];
  const providers = keys(providerBrands);
  const out: Recipe = {
    id: profile.id, name: profile.name,
    provider: oneOf(r.provider, providers, "provider"),
    bodyType: oneOf(r.bodyType, BODIES, "bodyType"),
    skinTone: oneOf(r.skinTone, keys(skinTones), "skinTone"),
    hair: { style: oneOf(hair.style, HAIR_STYLES, "hair.style"), color: colour(hair.color, hairColors, "hair.color") },
    eyes: oneOf(r.eyes, EYES, "eyes"),
    brows: oneOf(r.brows, BROWS, "brows"),
    mouth: oneOf(r.mouth, MOUTHS, "mouth"),
    hoodie: { color: colour(hoodie.color, hoodieColors, "hoodie.color"), trim: colour(hoodie.trim, trimColors, "hoodie.trim") },
    logo: oneOf(r.logo, providers, "logo"),
    accessories,
    background: { scene: oneOf(bg.scene, SCENES, "background.scene"), theme: oneOf(bg.theme, THEMES, "background.theme") },
  };
  if (r.eyeColor !== undefined) out.eyeColor = colour(r.eyeColor, eyeColors, "eyeColor");
  if (r.blush !== undefined) { if (typeof r.blush !== "boolean") fail("blush must be true or false"); out.blush = r.blush; }
  if (r.accent !== undefined) { if (typeof r.accent !== "string" || !HEX.test(r.accent)) fail("accent must be a #RRGGBB colour"); out.accent = r.accent; }
  try { renderSvg(out); } catch (e) { fail((e as Error).message); }
  return out;
}

/**
 * Updates the fields a user may edit. `character: null` clears the saved one, so the derived default shows again.
 * Returns undefined when there is no such profile; throws on invalid input.
 */
export function updateProfile(id: string, patch: { name?: string; plan?: string; character?: unknown }): Profile | undefined {
  const all = listProfiles();
  const i = all.findIndex((p) => p.id === id);
  if (i < 0) return undefined;
  const next: Profile = { ...all[i]! };
  if (patch.name !== undefined) {
    if (typeof patch.name !== "string" || !patch.name.trim()) throw new Error("Profile name is required");
    const name = patch.name.trim();
    if (name.length > 60) throw new Error("Profile name is too long (60 characters at most)");
    if (all.some((p) => p.id !== id && p.name.toLowerCase() === name.toLowerCase())) throw new Error(`A profile called "${name}" already exists`);
    next.name = name;
  }
  if (patch.plan !== undefined) {
    if (typeof patch.plan !== "string") throw new Error("Plan must be text");
    const plan = patch.plan.trim();
    if (plan.length > 60) throw new Error("Plan is too long (60 characters at most)");
    if (plan) next.plan = plan; else delete next.plan;
  }
  if (patch.character === null) delete next.character;
  else if (patch.character !== undefined) next.character = validateCharacter(patch.character, next);
  // A renamed account keeps its recipe's name in step.
  if (next.character) next.character = { ...next.character, name: next.name };
  all[i] = next;
  save(all);
  return next;
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
  const preset = String(a.preset ?? "custom");
  const wire: Wire = a.wire === "chat" || a.wire === "responses" ? a.wire : (apiPresets.find((p) => p.id === preset)?.wire ?? "responses");
  return { preset, baseUrl, model, keyEnv, wire };
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
      return { CODEX_HOME: profile.configDir, ...(apiWire(profile) === "chat" ? { [SHIM_KEY_ENV]: SHIM_KEY_PLACEHOLDER } : {}) };
    default:
      return {};
  }
}

const tomlStr = (v: string) => JSON.stringify(v);

/**
 * Points Codex at the profile's provider by writing `<configDir>/config.toml`. Codex reads the key itself
 * from the environment variable named in `env_key`; no key is written. Other keys already in the file are kept.
 * Codex 0.166 only speaks the Responses API (`wire_api = "chat"` is rejected). For chat-wire providers
 * (DeepSeek, Kimi, NIM) base_url is the daemon's local translator and env_key a dummy variable.
 */
export function installApiProvider(profile: Profile, opts: { port?: number } = {}): string {
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
  const viaShim = apiWire(profile) === "chat";
  const out = [
    `model = ${tomlStr(profile.api.model)}`,
    `model_provider = "shiftwell"`,
    "",
    body,
    ...(body ? [""] : []),
    "[model_providers.shiftwell]",
    `name = ${tomlStr(profile.name)}`,
    `base_url = ${tomlStr(viaShim ? shimBaseUrl(profile.id, opts.port) : profile.api.baseUrl)}`,
    `env_key = ${tomlStr(viaShim ? SHIM_KEY_ENV : profile.api.keyEnv)}`,
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
