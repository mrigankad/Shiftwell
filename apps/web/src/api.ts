export type Provider = "claude" | "codex" | "gemini" | "api";
export type State = "unknown" | "room" | "on" | "low" | "out";

export interface Window { pct: number; resetsAt: number | null }
export interface Account {
  id: string;
  name: string;
  provider: Provider;
  plan?: string;
  configDir: string;
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
}
export interface Board { generatedAt: string; accounts: Account[]; runs: Run[]; suggestions: Suggestion[] }

async function json<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `Request failed (${res.status})`);
  return body as T;
}

const post = <T>(url: string, body: unknown) =>
  fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(json<T>);

export const api = {
  createProfile: (input: { name: string; provider: Provider; plan?: string }) =>
    fetch("/api/profiles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }).then(json<Account>),
  removeProfile: (id: string) => fetch(`/api/profiles/${id}`, { method: "DELETE" }).then(json),
  startRun: (input: { profileId: string; repo: string; task: string }) => post<Run>("/api/runs", input),
  handOff: (runId: string, toProfileId: string, reason?: string) => post<{ run: Run; note: string }>(`/api/runs/${runId}/handoff`, { toProfileId, reason }),
  finishRun: (runId: string) => post<Run>(`/api/runs/${runId}/finish`, {}),
  openRun: (runId: string) => post<{ ok: true }>(`/api/runs/${runId}/open`, {}),
  openLogin: (id: string) => fetch(`/api/profiles/${id}/login`, { method: "POST" }).then(json<{ command: string }>),
};

/** Live board via server-sent events, with reconnect handled by EventSource. */
export function subscribe(onBoard: (b: Board) => void, onStatus: (connected: boolean) => void) {
  const es = new EventSource("/api/events");
  es.onmessage = (e) => { onStatus(true); onBoard(JSON.parse(e.data)); };
  es.onerror = () => onStatus(false);
  return () => es.close();
}
