import { request } from "../../lib/http";

export type SkillProvider = "claude" | "codex" | "gemini" | "api";

export interface Skill {
  id: string;
  name: string;
  description: string;
  body: string;
  enabled: boolean;
  providers: SkillProvider[];
}
export type SkillInput = Omit<Skill, "id">;

const send = <T>(method: string, url: string, body?: unknown) => request<T>(method, url, body);

export const skillsApi = {
  list: () => send<Skill[]>("GET", "/api/skills"),
  create: (input: SkillInput) => send<Skill>("POST", "/api/skills", input),
  update: (id: string, patch: Partial<SkillInput>) => send<Skill>("PUT", `/api/skills/${encodeURIComponent(id)}`, patch),
  remove: (id: string) => send<{ ok: true }>("DELETE", `/api/skills/${encodeURIComponent(id)}`),
  sync: () => send<{ files: string[] }>("POST", "/api/skills/sync", {}),
};
