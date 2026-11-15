import { http, request } from "../../lib/http";

export interface Guardrails {
  autoRotate: boolean;
  maxParallelRuns: number;
  stopAtPct: number;
  blockedPaths: string[];
  quietHours?: { start: string; end: string };
}
export interface StartCheck { ok: boolean; problems: string[] }

const send = <T>(method: string, url: string, body?: unknown) => request<T>(method, url, body);

export const guardrailsApi = {
  get: () => http.get<Guardrails>("/api/guardrails"),
  save: (g: Guardrails) => send<Guardrails>("PUT", "/api/guardrails", g),
  check: (profileIds: string[]) => send<StartCheck>("POST", "/api/guardrails/check", { profileIds }),
};
