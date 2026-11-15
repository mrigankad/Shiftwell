import { request } from "../../lib/http";

export interface MemoryNote {
  id: string;
  text: string;
  pinned: boolean;
  createdAt: string;
  source: "user" | "handoff";
}
export interface RepoMemory { repo: string; notes: MemoryNote[] }
export interface RepoEntry { repo: string; notes: number }

const send = <T>(method: string, url: string, body?: unknown) => request<T>(method, url, body);

const q = (repo: string) => `repo=${encodeURIComponent(repo)}`;

export const memoryApi = {
  repos: () => send<RepoEntry[]>("GET", "/api/memory/repos"),
  get: (repo: string) => send<RepoMemory>("GET", `/api/memory?${q(repo)}`),
  add: (repo: string, text: string, pinned = false) => send<MemoryNote>("POST", "/api/memory/notes", { repo, text, pinned }),
  update: (repo: string, id: string, patch: { text?: string; pinned?: boolean }) =>
    send<MemoryNote>("PATCH", `/api/memory/notes/${encodeURIComponent(id)}`, { repo, ...patch }),
  remove: (repo: string, id: string) => send<{ ok: true }>("DELETE", `/api/memory/notes/${encodeURIComponent(id)}?${q(repo)}`),
};
