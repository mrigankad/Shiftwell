export interface Guardrails {
  autoRotate: boolean;
  maxParallelRuns: number;
  stopAtPct: number;
  blockedPaths: string[];
  quietHours?: { start: string; end: string };
}
export interface StartCheck { ok: boolean; problems: string[] }

async function json<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `Request failed (${res.status})`);
  return body as T;
}

const send = <T>(method: string, url: string, body: unknown) =>
  fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(json<T>);

export const guardrailsApi = {
  get: () => fetch("/api/guardrails").then(json<Guardrails>),
  save: (g: Guardrails) => send<Guardrails>("PUT", "/api/guardrails", g),
  check: (profileIds: string[]) => send<StartCheck>("POST", "/api/guardrails/check", { profileIds }),
};
