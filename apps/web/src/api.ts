import { http } from "./lib/http";
import type { Recipe } from "@shiftwell/crew";
import { patchRoster, setRoster } from "./features/character/roster";
export type Provider = "claude" | "codex" | "gemini" | "api";
export type State = "unknown" | "room" | "on" | "low" | "out";

export interface ApiConfig { preset: string; baseUrl: string; model: string; keyEnv: string }
export interface Preset { id: string; label: string; baseUrl: string; keyEnv: string; defaultModel: string }
export interface CreateProfileInput { name: string; provider: Provider; plan?: string; api?: ApiConfig }
export interface CheckResult { ok: boolean; models?: number; error?: string }

export interface Window { pct: number; resetsAt: number | null }
export interface Account {
  id: string;
  name: string;
  provider: Provider;
  plan?: string;
  configDir: string;
  /** The pixel character to draw. Always set by a current daemon; older ones omit it. */
  character?: Recipe;
  /** True once someone has edited it; false means the derived default. */
  characterCustom?: boolean;
  defaultCharacter?: Recipe;
  api?: ApiConfig;
  keyPresent?: boolean;
  createdAt?: string;
  loginCommand: string | null;
  usage: {
    latest: { at: string; fiveHour: Window | null; sevenDay: Window | null; daily?: Window | null; model?: string | null } | null;
    ageMinutes: number | null;
    stale: boolean;
    state: State;
    runsOutInMinutes: number | null;
  };
}
export interface Suggestion { fromId: string; toId: string; from: string; to: string; reason: string }
export interface Run {
  id: string; profileId: string; task: string; repo: string; worktree: string; branch: string;
  startedAt: string; endedAt?: string; status: "active" | "handed-off" | "done"; fromRunId?: string;
  changes?: { commits: number; files: number } | null;
  groupId?: string; worktreeRemoved?: boolean;
}
export interface GroupRun extends Run { changes: { commits: number; files: number } | null; diffStat: string | null }
export interface RunGroup { groupId: string; task: string; runs: GroupRun[] }
export interface Board { generatedAt: string; accounts: Account[]; runs: Run[]; suggestions: Suggestion[] }

export interface InsightAccount {
  id: string; name: string; provider: Provider; preset?: string;
  readingsLast7d: number; peakLast7d: number | null; avgDailyPeak: number | null; hoursAtLimitLast7d: number;
  /** [Mon..Sun][hour 0..23] max usage percent, null when no reading landed in that slot. */
  heat: (number | null)[][];
}
export interface Insights {
  generatedAt: string; accounts: InsightAccount[];
  crewHeadroomNow: number | null; bestNext: { id: string; name: string; reason: string } | null;
}

const post = <T>(url: string, body: unknown) => http.post<T>(url, body);

export const api = {
  createProfile: (input: CreateProfileInput) =>
    post<Account>("/api/profiles", input),
  presets: () => http.get<Preset[]>("/api/presets"),
  checkProfile: (id: string) => post<CheckResult>(`/api/profiles/${id}/check`, {}),
  /** Save a character (or null for the default again), a new name, or a new plan. */
  updateProfile: async (id: string, patch: { name?: string; plan?: string; character?: Recipe | null }) => {
    const a = await http.patch<Account>(`/api/profiles/${id}`, patch);
    patchRoster(a);
    return a;
  },
  removeProfile: (id: string) => http.del(`/api/profiles/${id}`),
  startRun: (input: { profileId: string; repo: string; task: string }) => post<Run>("/api/runs", input),
  handOff: (runId: string, toProfileId: string, reason?: string) => post<{ run: Run; note: string }>(`/api/runs/${runId}/handoff`, { toProfileId, reason }),
  startRuns: (input: { profileIds: string[]; repo: string; task: string }) => post<{ groupId: string; runs: Run[] }>("/api/runs", input),
  finishRun: (runId: string, opts: { removeWorktree?: boolean } = {}) =>
    post<Run & { worktreeRemoved?: true; warning?: string }>(`/api/runs/${runId}/finish`, opts),
  pruneRuns: () => post<{ pruned: number }>("/api/runs/prune", {}),
  group: (groupId: string) => http.get<RunGroup>(`/api/groups/${encodeURIComponent(groupId)}`),
  openRun: (runId: string) => post<{ ok: true }>(`/api/runs/${runId}/open`, {}),
  note: (runId: string) => http.get<{ note: string }>(`/api/runs/${runId}/note`),
  history: (profileId: string) => http.get<NonNullable<Account["usage"]["latest"]>[]>(`/api/profiles/${profileId}/history`),
  insights: () => http.get<Insights>("/api/insights"),
  openLogin: (id: string) => post<{ command: string }>(`/api/profiles/${id}/login`, {}),
};

/** Live board via server-sent events, with reconnect handled by EventSource. */
export function subscribe(onBoard: (b: Board) => void, onStatus: (connected: boolean) => void) {
  const es = new EventSource("/api/events");
  let last = "";
  es.onmessage = (e) => {
    onStatus(true);
    // Skip boards that only differ by their timestamp, so the tree does not re-render every tick for nothing.
    const key = (e.data as string).replace(/"generatedAt":"[^"]*",?/, "");
    if (key === last) return;
    last = key;
    const board = JSON.parse(e.data) as Board;
    setRoster(board.accounts);
    onBoard(board);
  };
  es.onerror = () => onStatus(false);
  // Free the connection when the page is left, so the browser's per-host connection limit is never exhausted.
  const close = () => es.close();
  window.addEventListener("pagehide", close);
  return () => { window.removeEventListener("pagehide", close); es.close(); };
}
