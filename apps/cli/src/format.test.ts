import { describe, expect, it } from "vitest";
import { formatBoard, resetText, useColor } from "./format.js";
import type { Board } from "./client.js";

const NOW = Date.parse("2026-01-01T00:00:00Z");
const board: Board = {
  accounts: [
    { id: "a1", name: "Claude A", provider: "claude", usage: { state: "low", latest: { fiveHour: { pct: 91, resetsAt: NOW / 1000 + 7800 }, sevenDay: { pct: 74 } } } },
    { id: "g1", name: "Gemini A", provider: "gemini", usage: { state: "room", latest: { daily: { pct: 87, resetsAt: NOW / 1000 + 600 } } } },
    { id: "c1", name: "Codex A", provider: "codex", usage: { state: "unknown", latest: null } },
  ],
  runs: [{ id: "r1", profileId: "a1", task: "Do it", branch: "shiftwell/x", status: "active", changes: { commits: 2, files: 3 } }],
  suggestions: [{ fromId: "a1", toId: "c1", from: "Claude A", to: "Codex A", reason: "Claude A is low." }],
};

describe("format", () => {
  it("renders plain text with no ANSI when colour is off", () => {
    const out = formatBoard(board, { color: false }, NOW);
    expect(out).not.toMatch(/\u001b/);
    expect(out).toContain("Claude A");
    expect(out).toContain("91%");
    expect(out).toContain("in 2h 10m");
    expect(out).toContain("DAY");
    expect(out).toContain("87%");
    expect(out).toContain("shiftwell/x");
    expect(out).toContain("Claude A -> Codex A: Claude A is low.");
  });
  it("adds ANSI when colour is on", () => {
    expect(formatBoard(board, { color: true }, NOW)).toMatch(/\u001b\[/);
  });
  it("hides the DAY column without daily data", () => {
    const out = formatBoard({ ...board, accounts: [board.accounts[0]] }, { color: false }, NOW);
    expect(out).not.toContain("DAY");
  });
  it("handles empty boards", () => {
    const out = formatBoard({ accounts: [], runs: [], suggestions: [] }, { color: false }, NOW);
    expect(out).toContain("No accounts yet");
    expect(out).toContain("none");
  });
  it("formats reset times", () => {
    expect(resetText(undefined, NOW)).toBe("-");
    expect(resetText(NOW / 1000 - 5, NOW)).toBe("now");
    expect(resetText(NOW / 1000 + 86400 * 3 + 3600 * 4, NOW)).toBe("in 3d 4h");
  });
  it("respects TTY and NO_COLOR", () => {
    expect(useColor(true, {})).toBe(true);
    expect(useColor(false, {})).toBe(false);
    expect(useColor(true, { NO_COLOR: "1" })).toBe(false);
  });
});
