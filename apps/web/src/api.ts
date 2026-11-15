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

async function json<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `Request failed (${res.status})`);
  return body as T;
}

const post = <T>(url: string, body: unknown) =>
  fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(json<T>);

export const api = {
  createProfile: (input: CreateProfileInput) =>
    fetch("/api/profiles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }).then(json<Account>),
  presets: () => fetch("/api/presets").then(json<Preset[]>),
  checkProfile: (id: string) => post<CheckResult>(`/api/profiles/${id}/check`, {}),
  removeProfile: (id: string) => fetch(`/api/profiles/${id}`, { method: "DELETE" }).then(json),
  startRun: (input: { profileId: string; repo: string; task: string }) => post<Run>("/api/runs", input),
  handOff: (runId: string, toProfileId: string, reason?: string) => post<{ run: Run; note: string }>(`/api/runs/${runId}/handoff`, { toProfileId, reason }),
  startRuns: (input: { profileIds: string[]; repo: string; task: string }) => post<{ groupId: string; runs: Run[] }>("/api/runs", input),
  finishRun: (runId: string, opts: { removeWorktree?: boolean } = {}) =>
    post<Run & { worktreeRemoved?: true; warning?: string }>(`/api/runs/${runId}/finish`, opts),
  pruneRuns: () => post<{ pruned: number }>("/api/runs/prune", {}),
  group: (groupId: string) => fetch(`/api/groups/${encodeURIComponent(groupId)}`).then(json<RunGroup>),
  openRun: (runId: string) => post<{ ok: true }>(`/api/runs/${runId}/open`, {}),
  note: (runId: string) => fetch(`/api/runs/${runId}/note`).then(json<{ note: string }>),
  history: (profileId: string) => fetch(`/api/profiles/${profileId}/history`).then(json<NonNullable<Account["usage"]["latest"]>[]>),
  openLogin: (id: string) => fetch(`/api/profiles/${id}/login`, { method: "POST" }).then(json<{ command: string }>),
};

/** Live board via server-sent events, with reconnect handled by EventSource. */
export function subscribe(onBoard: (b: Board) => void, onStatus: (connected: boolean) => void) {
  const es = new EventSource("/api/events");
  es.onmessage = (e) => { onStatus(true); onBoard(JSON.parse(e.data)); };
  es.onerror = () => onStatus(false);
  return () => es.close();
}
