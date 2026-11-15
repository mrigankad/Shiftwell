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

async function json<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `Request failed (${res.status})`);
  return body as T;
}

const send = <T>(method: string, url: string, body?: unknown) =>
  fetch(url, { method, headers: body === undefined ? undefined : { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) }).then(json<T>);

export const skillsApi = {
  list: () => send<Skill[]>("GET", "/api/skills"),
  create: (input: SkillInput) => send<Skill>("POST", "/api/skills", input),
  update: (id: string, patch: Partial<SkillInput>) => send<Skill>("PUT", `/api/skills/${encodeURIComponent(id)}`, patch),
  remove: (id: string) => send<{ ok: true }>("DELETE", `/api/skills/${encodeURIComponent(id)}`),
  sync: () => send<{ files: string[] }>("POST", "/api/skills/sync", {}),
};
