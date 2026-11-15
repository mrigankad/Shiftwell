import type { Board } from "./client.js";

export interface Style { color: boolean }

export function useColor(isTTY: boolean | undefined, env: Record<string, string | undefined>): boolean {
  return !!isTTY && !env.NO_COLOR;
}

const CODES = { red: 31, green: 32, yellow: 33, dim: 2, bold: 1, cyan: 36 } as const;
type Tone = keyof typeof CODES;

export function paint(s: string, tone: Tone, st: Style): string {
  return st.color ? `\u001b[${CODES[tone]}m${s}\u001b[0m` : s;
}

const STATE_TONE: Record<string, Tone> = { room: "green", low: "yellow", out: "red", unknown: "dim" };

const visible = (s: string) => s.replace(/\u001b\[[0-9;]*m/g, "");
const padEnd = (s: string, n: number) => s + " ".repeat(Math.max(0, n - visible(s).length));

/** Left aligned table; cells may carry ANSI codes, widths use the visible length. */
export function table(head: string[], rows: string[][], st: Style): string {
  const widths = head.map((h, i) => Math.max(h.length, ...rows.map((r) => visible(r[i] ?? "").length)));
  const line = (cells: string[]) => cells.map((c, i) => padEnd(c, widths[i])).join("  ").trimEnd();
  return [paint(line(head), "dim", st), ...rows.map(line)].join("\n");
}

function pct(n: number | undefined | null): string {
  return typeof n === "number" ? `${Math.round(n)}%` : "-";
}

/** Epoch seconds in, short text out, such as "in 2h 10m" or "in 3d 4h". */
export function resetText(epochSec: number | undefined | null, now: number): string {
  if (typeof epochSec !== "number") return "-";
  const mins = Math.round((epochSec * 1000 - now) / 60000);
  if (mins <= 0) return "now";
  const d = Math.floor(mins / 1440), h = Math.floor((mins % 1440) / 60), m = mins % 60;
  if (d > 0) return `in ${d}d ${h}h`;
  if (h > 0) return `in ${h}h ${m}m`;
  return `in ${m}m`;
}

export function formatBoard(board: Board, st: Style, now = Date.now()): string {
  const out: string[] = [];
  const accounts = board.accounts ?? [];
  if (!accounts.length) {
    out.push("No accounts yet. Add one in the web UI.");
  } else {
    const showDaily = accounts.some((a) => a.usage?.latest?.daily);
    const head = ["ACCOUNT", "PROVIDER", "STATE", "5H", "WEEK", ...(showDaily ? ["DAY"] : []), "RESETS"];
    const rows = accounts.map((a) => {
      const l = a.usage?.latest;
      const state = a.usage?.state ?? "unknown";
      const reset = l?.fiveHour?.resetsAt ?? l?.daily?.resetsAt ?? l?.sevenDay?.resetsAt;
      return [
        a.name, a.provider, paint(state, STATE_TONE[state] ?? "dim", st),
        pct(l?.fiveHour?.pct), pct(l?.sevenDay?.pct),
        ...(showDaily ? [pct(l?.daily?.pct)] : []),
        resetText(reset, now),
      ];
    });
    out.push(table(head, rows, st));
  }

  const nameOf = (id: string) => accounts.find((a) => a.id === id)?.name ?? id;
  const active = (board.runs ?? []).filter((r) => r.status === "active");
  out.push("", paint("Active runs", "bold", st));
  if (!active.length) out.push("  none");
  else {
    out.push(table(["RUN", "ACCOUNT", "BRANCH", "CHANGES", "TASK"], active.map((r) => [
      r.id, nameOf(r.profileId), r.branch,
      r.changes ? `${r.changes.commits}c ${r.changes.files}f` : "-",
      r.task.length > 50 ? r.task.slice(0, 49) + "..." : r.task,
    ]), st).split("\n").map((l) => "  " + l).join("\n"));
  }

  const sug = board.suggestions ?? [];
  if (sug.length) {
    out.push("", paint("Handoff suggestion", "bold", st));
    for (const s of sug) out.push(`  ${paint(s.from, "yellow", st)} -> ${paint(s.to, "green", st)}: ${s.reason}`);
  }
  return out.join("\n");
}

export const HELP = `Shiftwell command line

Usage:
  shiftwell start [--port 4520] [--no-open]   Start the daemon and open the board
  shiftwell stop                              Stop the daemon started by "start"
  shiftwell status [--json]                   Accounts, active runs, handoff suggestion
  shiftwell run "<task>" --account <name|id> [--account ...] [--repo .]
                                              Start a run, or fan out over several accounts
  shiftwell handoff <runId> --to <account>    Hand a run to another account
  shiftwell done <runId> [--remove-folder]    Mark a run finished
  shiftwell help | --version

Environment:
  SHIFTWELL_PORT   daemon port (default 4520)
  SHIFTWELL_HOME   data folder (default ~/.shiftwell)
  NO_COLOR         turn off colours`;
