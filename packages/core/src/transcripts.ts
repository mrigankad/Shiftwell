import { decompress as zstdDecompress } from "fzstd";
import { closeSync, existsSync, openSync, readFileSync, readSync, readdirSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import type { Profile } from "./profiles.js";
import type { Run } from "./runs.js";

/**
 * Read-only view of the transcripts the official CLIs already write to disk.
 * Nothing here opens an auth file: only session logs under the profile's own config folder.
 */
export type LiveKind = "user" | "assistant" | "tool_call" | "tool_result" | "status";
export interface LiveEvent { at: number; kind: LiveKind; text: string; tool?: string; file?: string }
export interface LiveResult {
  /** Base name of the transcript file, empty when none was found. */
  source: string;
  events: LiveEvent[];
  /** Epoch ms of the newest event (or of the file when it holds no events yet), null when unknown. */
  lastActivityAt: number | null;
  filesTouched: string[];
  /** Plain-words explanation when nothing could be read. */
  hint?: string;
}
export interface LiveOptions { since?: number; limit?: number }

const MAX_TEXT = 2000;
const clip = (s: string): string => (s.length > MAX_TEXT ? `${s.slice(0, MAX_TEXT)}…` : s);
const norm = (p: string): string => p.replace(/^\\\\\?\\/, "").replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
const EDIT_TOOLS = /^(edit|write|multiedit|notebookedit|apply_patch|str_replace\w*|replace|write_file|edit_file)$/i;

const ts = (v: unknown): number => {
  if (typeof v === "number") return v < 1e12 ? v * 1000 : v;
  if (typeof v === "string") { const n = Date.parse(v); return Number.isNaN(n) ? 0 : n; }
  return 0;
};
const str = (v: unknown): string => (typeof v === "string" ? v : "");
const rec = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

/** Codex compresses older sessions with zstd; decode them in pure JS (cached by size and mtime). */
const zstCache = new Map<string, { key: string; text: string }>();
function readText(path: string): string {
  if (!path.endsWith(".zst")) return readFileSync(path, "utf8");
  const st = statSync(path);
  const key = `${st.size}:${st.mtimeMs}`;
  const hit = zstCache.get(path);
  if (hit && hit.key === key) return hit.text;
  const text = new TextDecoder().decode(zstdDecompress(new Uint8Array(readFileSync(path))));
  if (zstCache.size > 64) zstCache.clear();
  zstCache.set(path, { key, text });
  return text;
}

function jsonLines(path: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  let text: string;
  try { text = readText(path); } catch { return out; }
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    try { out.push(rec(JSON.parse(t))); } catch { /* a half-written last line */ }
  }
  return out;
}

function firstLine(path: string): string {
  let fd: number | undefined;
  try {
    fd = openSync(path, "r");
    const buf = Buffer.alloc(65536);
    let acc = "";
    for (let n = readSync(fd, buf, 0, buf.length, null); n > 0; n = readSync(fd, buf, 0, buf.length, null)) {
      acc += buf.toString("utf8", 0, n);
      const i = acc.indexOf("\n");
      if (i >= 0) return acc.slice(0, i);
      if (acc.length > 4_000_000) break;
    }
    return acc;
  } catch { return ""; } finally { if (fd !== undefined) closeSync(fd); }
}

const mtime = (p: string): number => { try { return statSync(p).mtimeMs; } catch { return 0; } };
const newestFirst = (files: string[]) => files.map((f) => ({ f, m: mtime(f) })).sort((a, b) => b.m - a.m).map((x) => x.f);

/** Claude Code names the project folder after the working directory with every non letter or digit turned into a dash. */
export const claudeSlug = (cwd: string): string => cwd.replace(/[^a-zA-Z0-9]/g, "-");

/** Text of a tool result or message content, whichever shape it arrives in. */
function textOf(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((c) => (typeof c === "string" ? c : str(rec(c).text))).filter(Boolean).join("\n");
  }
  return str(rec(content).text);
}

function describeInput(input: Record<string, unknown>): { text: string; file?: string } {
  const file = str(input.file_path) || str(input.path) || str(input.notebook_path) || undefined;
  const text = str(input.command) || str(input.description) || str(input.pattern) || str(input.query) || str(input.url) || file || "";
  return { text: clip(text), file };
}

// ---- Claude Code --------------------------------------------------------------------------

function claudeFile(profile: Profile, worktree: string): string | null {
  const root = join(profile.configDir, "projects");
  if (!existsSync(root)) return null;
  const want = claudeSlug(worktree);
  let dir = join(root, want);
  if (!existsSync(dir)) {
    const hit = readdirSync(root).find((d) => d.toLowerCase() === want.toLowerCase());
    if (!hit) return null;
    dir = join(root, hit);
  }
  const files = readdirSync(dir).filter((f) => f.endsWith(".jsonl")).map((f) => join(dir, f));
  return newestFirst(files)[0] ?? null;
}

export function parseClaude(lines: Record<string, unknown>[]): LiveEvent[] {
  const ev: LiveEvent[] = [];
  for (const o of lines) {
    const at = ts(o.timestamp);
    const msg = rec(o.message);
    if (o.type === "user" && !o.isMeta) {
      const c = msg.content;
      if (typeof c === "string") { if (c.trim()) ev.push({ at, kind: "user", text: clip(c) }); continue; }
      for (const part of Array.isArray(c) ? c : []) {
        const p = rec(part);
        if (p.type === "text" && str(p.text).trim()) ev.push({ at, kind: "user", text: clip(str(p.text)) });
        else if (p.type === "tool_result") ev.push({ at, kind: "tool_result", text: clip(textOf(p.content)) });
      }
    } else if (o.type === "assistant") {
      for (const part of Array.isArray(msg.content) ? msg.content : []) {
        const p = rec(part);
        if (p.type === "text" && str(p.text).trim()) ev.push({ at, kind: "assistant", text: clip(str(p.text)) });
        else if (p.type === "tool_use") {
          const d = describeInput(rec(p.input));
          ev.push({ at, kind: "tool_call", text: d.text, tool: str(p.name), file: d.file });
        }
        // thinking blocks are skipped on purpose
      }
    }
  }
  return ev;
}

// ---- Codex --------------------------------------------------------------------------------

function walk(dir: string, match: (f: string) => boolean, out: string[] = [], depth = 0): string[] {
  if (depth > 5 || !existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, match, out, depth + 1);
    else if (match(e.name)) out.push(p);
  }
  return out;
}

function codexFile(profile: Profile, worktree: string): { file: string | null; compressed: number } {
  const root = join(profile.configDir, "sessions");
  const all = walk(root, (n) => n.startsWith("rollout-"));
  const plain = newestFirst(all.filter((f) => f.endsWith(".jsonl") || f.endsWith(".jsonl.zst")));
  const want = norm(worktree);
  for (const f of plain.slice(0, 80)) {
    let meta: Record<string, unknown> = {};
    try {
      const head = f.endsWith(".zst") ? readText(f).split("\n", 1)[0] : firstLine(f);
      meta = rec(JSON.parse(head || "{}"));
    } catch { continue; }
    const cwd = str(rec(meta.payload).cwd);
    if (meta.type === "session_meta" && cwd && norm(cwd) === want) return { file: f, compressed: 0 };
  }
  return { file: null, compressed: all.length - plain.length };
}

const PATCH_FILE = /^\*\*\* (?:Update|Add|Delete) File: (.+)$/gm;

export function parseCodex(lines: Record<string, unknown>[]): LiveEvent[] {
  const ev: LiveEvent[] = [];
  const names = new Map<string, string>();
  for (const o of lines) {
    const at = ts(o.timestamp);
    const p = rec(o.payload);
    if (o.type === "event_msg") {
      if (p.type === "task_started") ev.push({ at, kind: "status", text: "Turn started" });
      else if (p.type === "task_complete") ev.push({ at, kind: "status", text: "Turn complete" });
      continue;
    }
    if (o.type !== "response_item") continue;
    if (p.type === "message" && (p.role === "user" || p.role === "assistant")) {
      const text = textOf(p.content).trim();
      if (!text || /^<(environment_context|user_instructions|permissions)/.test(text) || text.startsWith("# AGENTS.md")) continue;
      ev.push({ at, kind: p.role === "user" ? "user" : "assistant", text: clip(text) });
    } else if (p.type === "function_call" || p.type === "custom_tool_call") {
      const tool = str(p.name);
      names.set(str(p.call_id), tool);
      let args: Record<string, unknown> = {};
      let raw = str(p.input);
      if (p.type === "function_call") { try { args = rec(JSON.parse(str(p.arguments))); } catch { /* keep empty */ } }
      const cmd = args.command ?? args.cmd;
      if (Array.isArray(cmd)) raw = cmd.map(String).join(" ");
      else if (typeof cmd === "string") raw = cmd;
      else if (!raw) raw = str(args.path) || str(args.input);
      const file = str(args.path) || str(args.file_path) || undefined;
      if (/apply_patch/i.test(tool) || raw.startsWith("*** Begin Patch")) {
        const files = [...raw.matchAll(PATCH_FILE)].map((m) => m[1]!.trim());
        if (files.length === 0) ev.push({ at, kind: "tool_call", tool: "apply_patch", text: "patch" });
        for (const f of files) ev.push({ at, kind: "tool_call", tool: "apply_patch", text: f, file: f });
      } else ev.push({ at, kind: "tool_call", tool, text: clip(raw), file });
    } else if (p.type === "function_call_output" || p.type === "custom_tool_call_output") {
      let out = p.output;
      if (typeof out === "string") { try { const j = rec(JSON.parse(out)); if (typeof j.output === "string") out = j.output; } catch { /* plain text */ } }
      ev.push({ at, kind: "tool_result", text: clip(textOf(out)), tool: names.get(str(p.call_id)) });
    }
    // reasoning items are skipped on purpose
  }
  return ev;
}

// ---- Gemini CLI (shape taken from the CLI's documented session files, not verified on this machine) ----

function geminiFile(profile: Profile, worktree: string): string | null {
  const root = join(profile.configDir, ".gemini", "tmp");
  if (!existsSync(root)) return null;
  const want = norm(worktree);
  const files: string[] = [];
  for (const d of readdirSync(root)) {
    const dir = join(root, d);
    const marker = join(dir, ".project_root");
    let owned = false;
    try { owned = existsSync(marker) && norm(readFileSync(marker, "utf8").trim()) === want; } catch { /* unreadable marker */ }
    if (!owned) continue;
    const chats = join(dir, "chats");
    if (existsSync(chats)) files.push(...readdirSync(chats).filter((f) => f.endsWith(".json") || f.endsWith(".jsonl")).map((f) => join(chats, f)));
    if (existsSync(join(dir, "logs.json"))) files.push(join(dir, "logs.json"));
  }
  return newestFirst(files)[0] ?? null;
}

export function parseGemini(path: string): LiveEvent[] {
  const ev: LiveEvent[] = [];
  let raw: unknown;
  try { raw = path.endsWith(".jsonl") ? jsonLines(path) : JSON.parse(readFileSync(path, "utf8")); } catch { return ev; }
  const list: unknown[] = Array.isArray(raw) ? raw : Array.isArray(rec(raw).messages) ? (rec(raw).messages as unknown[]) : [];
  for (const item of list) {
    const m = rec(item);
    const at = ts(m.timestamp);
    const type = str(m.type);
    const text = textOf(m.content ?? m.message).trim();
    if (type === "user" && text) ev.push({ at, kind: "user", text: clip(text) });
    else if ((type === "gemini" || type === "model" || type === "assistant") && text) ev.push({ at, kind: "assistant", text: clip(text) });
    for (const tc of Array.isArray(m.toolCalls) ? m.toolCalls : []) {
      const t = rec(tc);
      const tool = str(t.name);
      const d = describeInput(rec(t.args));
      ev.push({ at, kind: "tool_call", tool, text: d.text, file: d.file });
      if (t.resultDisplay !== undefined || t.result !== undefined) ev.push({ at, kind: "tool_result", tool, text: clip(textOf(t.resultDisplay ?? "")) });
    }
  }
  return ev;
}

// ---- Public -------------------------------------------------------------------------------

const cache = new Map<string, { key: string; events: LiveEvent[] }>();

export function transcriptForRun(run: Pick<Run, "worktree">, profile: Profile, opts: LiveOptions = {}): LiveResult {
  const limit = opts.limit ?? 200;
  const none = (hint: string): LiveResult => ({ source: "", events: [], lastActivityAt: null, filesTouched: [], hint });
  let file: string | null = null;
  let hint = "";
  try {
    if (profile.provider === "claude") file = claudeFile(profile, run.worktree);
    else if (profile.provider === "codex" || profile.provider === "api") {
      const r = codexFile(profile, run.worktree);
      file = r.file;
      if (!file && r.compressed > 0) hint = "Older Codex sessions are compressed (.zst) and are not read. ";
    } else if (profile.provider === "gemini") file = geminiFile(profile, run.worktree);
  } catch { file = null; }
  if (!file) return none(`${hint}No transcript yet. The CLI writes one after its first message.`);

  let st;
  try { st = statSync(file); } catch { return none("The transcript could not be read."); }
  const key = `${st.mtimeMs}:${st.size}`;
  let all = cache.get(file)?.key === key ? cache.get(file)!.events : null;
  if (!all) {
    all = profile.provider === "claude" ? parseClaude(jsonLines(file)) : profile.provider === "gemini" ? parseGemini(file) : parseCodex(jsonLines(file));
    cache.set(file, { key, events: all });
    if (cache.size > 20) cache.delete(cache.keys().next().value!);
  }
  const touched = new Set<string>();
  for (const e of all) if (e.kind === "tool_call" && e.file && e.tool && EDIT_TOOLS.test(e.tool)) touched.add(e.file);
  let events = opts.since ? all.filter((e) => e.at > opts.since!) : all;
  if (events.length > limit) events = events.slice(-limit);
  const last = all.reduce((m, e) => Math.max(m, e.at), 0);
  return { source: basename(file), events, lastActivityAt: last || Math.round(st.mtimeMs), filesTouched: [...touched] };
}
