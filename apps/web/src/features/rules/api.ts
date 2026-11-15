export interface Rule {
  id: string;
  name: string;
  enabled: boolean;
  when: { taskMatches?: string; repoMatches?: string };
  prefer: string[];
  fallback: "most-headroom" | "none";
}
export type RuleInput = Omit<Rule, "id">;
export interface PickResult { profileId: string | null; profileName: string | null; ruleId: string | null; reason: string }

async function json<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `Request failed (${res.status})`);
  return body as T;
}

const send = <T>(method: string, url: string, body?: unknown) =>
  fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) }).then(json<T>);

export const rulesApi = {
  list: () => fetch("/api/rules").then(json<Rule[]>),
  create: (r: RuleInput) => send<Rule>("POST", "/api/rules", r),
  update: (id: string, r: RuleInput) => send<Rule>("PUT", `/api/rules/${encodeURIComponent(id)}`, r),
  remove: (id: string) => send<{ ok: true }>("DELETE", `/api/rules/${encodeURIComponent(id)}`),
  reorder: (ids: string[]) => send<Rule[]>("PUT", "/api/rules/order", { ids }),
  pick: (task: string, repo: string) => send<PickResult>("POST", "/api/rules/pick", { task, repo }),
};
