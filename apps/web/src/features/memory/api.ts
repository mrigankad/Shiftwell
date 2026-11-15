export interface MemoryNote {
  id: string;
  text: string;
  pinned: boolean;
  createdAt: string;
  source: "user" | "handoff";
}
export interface RepoMemory { repo: string; notes: MemoryNote[] }
export interface RepoEntry { repo: string; notes: number }

async function json<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `Request failed (${res.status})`);
  return body as T;
}

const send = <T>(method: string, url: string, body?: unknown) =>
  fetch(url, { method, headers: body === undefined ? undefined : { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) }).then(json<T>);

const q = (repo: string) => `repo=${encodeURIComponent(repo)}`;

export const memoryApi = {
  repos: () => send<RepoEntry[]>("GET", "/api/memory/repos"),
  get: (repo: string) => send<RepoMemory>("GET", `/api/memory?${q(repo)}`),
  add: (repo: string, text: string, pinned = false) => send<MemoryNote>("POST", "/api/memory/notes", { repo, text, pinned }),
  update: (repo: string, id: string, patch: { text?: string; pinned?: boolean }) =>
    send<MemoryNote>("PATCH", `/api/memory/notes/${encodeURIComponent(id)}`, { repo, ...patch }),
  remove: (repo: string, id: string) => send<{ ok: true }>("DELETE", `/api/memory/notes/${encodeURIComponent(id)}?${q(repo)}`),
};
