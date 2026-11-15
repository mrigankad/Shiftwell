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
export interface Board { generatedAt: string; accounts: Account[]; suggestions: Suggestion[] }

async function json<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `Request failed (${res.status})`);
  return body as T;
}

export const api = {
  createProfile: (input: { name: string; provider: Provider; plan?: string }) =>
    fetch("/api/profiles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }).then(json<Account>),
  removeProfile: (id: string) => fetch(`/api/profiles/${id}`, { method: "DELETE" }).then(json),
  openLogin: (id: string) => fetch(`/api/profiles/${id}/login`, { method: "POST" }).then(json<{ command: string }>),
};

/** Live board via server-sent events, with reconnect handled by EventSource. */
export function subscribe(onBoard: (b: Board) => void, onStatus: (connected: boolean) => void) {
  const es = new EventSource("/api/events");
  es.onmessage = (e) => { onStatus(true); onBoard(JSON.parse(e.data)); };
  es.onerror = () => onStatus(false);
  return () => es.close();
}
