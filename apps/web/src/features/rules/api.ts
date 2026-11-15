import { http, request } from "../../lib/http";

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

const send = <T>(method: string, url: string, body?: unknown) => request<T>(method, url, body);

export const rulesApi = {
  list: () => http.get<Rule[]>("/api/rules"),
  create: (r: RuleInput) => send<Rule>("POST", "/api/rules", r),
  update: (id: string, r: RuleInput) => send<Rule>("PUT", `/api/rules/${encodeURIComponent(id)}`, r),
  remove: (id: string) => send<{ ok: true }>("DELETE", `/api/rules/${encodeURIComponent(id)}`),
  reorder: (ids: string[]) => send<Rule[]>("PUT", "/api/rules/order", { ids }),
  pick: (task: string, repo: string) => send<PickResult>("POST", "/api/rules/pick", { task, repo }),
};
