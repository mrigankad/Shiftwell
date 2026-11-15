import { describe, it, expect, beforeEach } from "vitest";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { transcriptForRun, claudeSlug } from "./transcripts.js";
import type { Profile } from "./profiles.js";

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "sw-tr-")); });
const prof = (provider: Profile["provider"]): Profile => ({ id: "p1", name: "P", provider, configDir: dir, createdAt: "" });
const jl = (rows: object[]) => rows.map((r) => JSON.stringify(r)).join("\n") + "\n";

describe("claudeSlug", () => {
  it("turns every non alphanumeric into a dash", () => {
    expect(claudeSlug("C:\\Users\\a_b\\wt\\x")).toBe("C--Users-a-b-wt-x");
  });
});

describe("transcriptForRun", () => {
  it("parses a Claude session, skips thinking and reports edited files", () => {
    const wt = "C:\\work\\wt-auth";
    const pd = join(dir, "projects", claudeSlug(wt));
    mkdirSync(pd, { recursive: true });
    writeFileSync(join(pd, "s1.jsonl"), jl([
      { type: "mode", mode: "x" },
      { type: "user", timestamp: "2026-01-01T00:00:00Z", message: { role: "user", content: "fix it" } },
      { type: "assistant", timestamp: "2026-01-01T00:00:01Z", message: { content: [{ type: "thinking", thinking: "hidden" }, { type: "text", text: "On it" }] } },
      { type: "assistant", timestamp: "2026-01-01T00:00:02Z", message: { content: [{ type: "tool_use", name: "Edit", input: { file_path: "src/a.ts" } }, { type: "tool_use", name: "Read", input: { file_path: "src/b.ts" } }] } },
      { type: "user", timestamp: "2026-01-01T00:00:03Z", message: { content: [{ type: "tool_result", tool_use_id: "t", content: [{ type: "text", text: "ok" }] }] } },
      { type: "assistant", timestamp: "2026-01-01T00:00:04Z", message: { content: [{ type: "text", text: "x".repeat(3000) }] } },
    ]) + "{half written");
    const r = transcriptForRun({ worktree: wt }, prof("claude"));
    expect(r.source).toBe("s1.jsonl");
    expect(r.events.map((e) => e.kind)).toEqual(["user", "assistant", "tool_call", "tool_call", "tool_result", "assistant"]);
    expect(JSON.stringify(r.events)).not.toContain("hidden");
    expect(r.events[2]).toMatchObject({ tool: "Edit", file: "src/a.ts" });
    expect(r.events[5]!.text.length).toBeLessThanOrEqual(2001);
    expect(r.filesTouched).toEqual(["src/a.ts"]);
    expect(r.lastActivityAt).toBe(Date.parse("2026-01-01T00:00:04Z"));
    expect(transcriptForRun({ worktree: wt }, prof("claude"), { since: Date.parse("2026-01-01T00:00:03Z") }).events).toHaveLength(1);
    expect(transcriptForRun({ worktree: wt }, prof("claude"), { limit: 2 }).events).toHaveLength(2);
  });

  it("matches Codex by session_meta.cwd and reads messages, calls and patches", () => {
    const sd = join(dir, "sessions", "2026", "01", "01");
    mkdirSync(sd, { recursive: true });
    const rows = (cwd: string) => [
      { timestamp: "2026-01-01T00:00:00Z", type: "session_meta", payload: { cwd } },
      { timestamp: "2026-01-01T00:00:01Z", type: "response_item", payload: { type: "message", role: "developer", content: [{ type: "input_text", text: "rules" }] } },
      { timestamp: "2026-01-01T00:00:02Z", type: "response_item", payload: { type: "message", role: "user", content: [{ type: "input_text", text: "do it" }] } },
      { timestamp: "2026-01-01T00:00:03Z", type: "response_item", payload: { type: "reasoning", summary: [] } },
      { timestamp: "2026-01-01T00:00:04Z", type: "response_item", payload: { type: "function_call", name: "shell", call_id: "c1", arguments: JSON.stringify({ command: ["npm", "test"] }) } },
      { timestamp: "2026-01-01T00:00:05Z", type: "response_item", payload: { type: "function_call_output", call_id: "c1", output: "passed" } },
      { timestamp: "2026-01-01T00:00:06Z", type: "response_item", payload: { type: "custom_tool_call", name: "apply_patch", call_id: "c2", input: "*** Begin Patch\n*** Update File: src/x.ts\n@@\n*** End Patch" } },
      { timestamp: "2026-01-01T00:00:07Z", type: "response_item", payload: { type: "message", role: "assistant", content: [{ type: "output_text", text: "done" }] } },
    ];
    writeFileSync(join(sd, "rollout-a.jsonl"), jl(rows("C:\\other")));
    writeFileSync(join(sd, "rollout-b.jsonl"), jl(rows("C:\\work\\wt")));
    writeFileSync(join(sd, "rollout-c.jsonl.zst"), "x");
    const r = transcriptForRun({ worktree: "c:/work/wt/" }, prof("codex"));
    expect(r.source).toBe("rollout-b.jsonl");
    expect(r.events.map((e) => e.kind)).toEqual(["user", "tool_call", "tool_result", "tool_call", "assistant"]);
    expect(r.events[1]).toMatchObject({ tool: "shell", text: "npm test" });
    expect(r.filesTouched).toEqual(["src/x.ts"]);
  });

  it("reads a Gemini chat file found through .project_root", () => {
    const d = join(dir, ".gemini", "tmp", "h1");
    mkdirSync(join(d, "chats"), { recursive: true });
    writeFileSync(join(d, ".project_root"), "C:\\Work\\Wt");
    writeFileSync(join(d, "chats", "session-1.json"), JSON.stringify({ messages: [
      { type: "user", content: "hi", timestamp: "2026-01-01T00:00:00Z" },
      { type: "gemini", content: "hello", timestamp: "2026-01-01T00:00:01Z", toolCalls: [{ name: "write_file", args: { file_path: "a.md" } }] },
    ] }));
    const r = transcriptForRun({ worktree: "c:\\work\\wt" }, prof("gemini"));
    expect(r.events.map((e) => e.kind)).toEqual(["user", "assistant", "tool_call"]);
    expect(r.filesTouched).toEqual(["a.md"]);
  });

  it("returns an empty result with a hint when nothing exists", () => {
    const r = transcriptForRun({ worktree: "C:\\nowhere" }, prof("claude"));
    expect(r).toMatchObject({ source: "", events: [], lastActivityAt: null, filesTouched: [] });
    expect(r.hint).toMatch(/No transcript yet/);
  });
});
