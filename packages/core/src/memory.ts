import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { sub } from "./paths.js";

export type NoteSource = "user" | "handoff";
export interface MemoryNote { id: string; text: string; pinned: boolean; createdAt: string; source: NoteSource }
export interface RepoMemory { repo: string; notes: MemoryNote[] }

const MAX_TEXT = 1000;

const normal = (repo: string) => {
  const r = resolve(repo);
  return process.platform === "win32" ? r.toLowerCase() : r;
};
export const repoHash = (repo: string) => createHash("sha1").update(normal(repo)).digest("hex").slice(0, 16);
const fileOf = (repo: string) => join(sub("memory"), `${repoHash(repo)}.json`);

export function memoryForRepo(repo: string): RepoMemory {
  const f = fileOf(repo);
  if (existsSync(f)) {
    try {
      const m = JSON.parse(readFileSync(f, "utf8")) as RepoMemory;
      if (Array.isArray(m.notes)) return { repo: m.repo ?? repo, notes: m.notes };
    } catch { /* fall through to empty */ }
  }
  return { repo, notes: [] };
}

const save = (m: RepoMemory) => writeFileSync(fileOf(m.repo), JSON.stringify(m, null, 2));

function cleanText(text: unknown): string {
  const t = typeof text === "string" ? text.replace(/\s+/g, " ").trim() : "";
  if (!t) throw new Error("Note text is required");
  if (t.length > MAX_TEXT) throw new Error(`Note is too long (${MAX_TEXT} characters at most)`);
  return t;
}

export function addNote(repo: string, input: { text: string; pinned?: boolean; source?: NoteSource }): MemoryNote {
  const m = memoryForRepo(repo);
  const note: MemoryNote = { id: randomUUID().slice(0, 8), text: cleanText(input.text), pinned: !!input.pinned, createdAt: new Date().toISOString(), source: input.source === "handoff" ? "handoff" : "user" };
  save({ repo: m.repo, notes: [...m.notes, note] });
  return note;
}

export function updateNote(repo: string, id: string, patch: { text?: string; pinned?: boolean }): MemoryNote {
  const m = memoryForRepo(repo);
  const cur = m.notes.find((n) => n.id === id);
  if (!cur) throw new Error("No such note");
  const next: MemoryNote = { ...cur, ...(patch.text !== undefined ? { text: cleanText(patch.text) } : {}), ...(patch.pinned !== undefined ? { pinned: !!patch.pinned } : {}) };
  save({ repo: m.repo, notes: m.notes.map((n) => (n.id === id ? next : n)) });
  return next;
}

export function removeNote(repo: string, id: string): boolean {
  const m = memoryForRepo(repo);
  const notes = m.notes.filter((n) => n.id !== id);
  if (notes.length === m.notes.length) return false;
  save({ repo: m.repo, notes });
  return true;
}

export const pinNote = (repo: string, id: string, pinned = true) => updateNote(repo, id, { pinned });

/** Markdown for the end of HANDOFF.md, pinned notes first. Empty string when there are no notes. */
export function memoryBlock(repo: string): string {
  const { notes } = memoryForRepo(repo);
  if (!notes.length) return "";
  const ordered = [...notes.filter((n) => n.pinned), ...notes.filter((n) => !n.pinned)];
  return ["", "## Project memory", "", "What earlier runs on this repo learned. Pinned notes come first.", "", ...ordered.map((n) => `- ${n.pinned ? "[pinned] " : ""}${n.text}`), ""].join("\n");
}

/** Stores a short summary line when a handoff happens. Returns null when the same line is already stored. */
export function captureFromHandoff(repo: string, note: string): MemoryNote | null {
  const title = /^#\s*Handoff:\s*(.+)$/m.exec(note)?.[1] ?? note.split(/\r?\n/).find((l) => l.trim()) ?? "";
  const clean = title.replace(/^#+\s*/, "").replace(/\s+/g, " ").trim();
  if (!clean) return null;
  const text = `Handed off: ${clean}`.slice(0, 200);
  if (memoryForRepo(repo).notes.some((n) => n.text === text)) return null;
  return addNote(repo, { text, source: "handoff" });
}
