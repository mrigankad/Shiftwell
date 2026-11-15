export interface Usage {
  state?: string;
  latest?: null | {
    fiveHour?: { pct: number; resetsAt?: number } | null;
    sevenDay?: { pct: number; resetsAt?: number } | null;
    daily?: { pct: number; resetsAt?: number } | null;
  };
}
export interface Account { id: string; name: string; provider: string; plan?: string; usage?: Usage }
export interface Run {
  id: string; profileId: string; task: string; branch: string; status: string;
  worktree?: string; groupId?: string; changes?: { commits: number; files: number } | null;
}
export interface Suggestion { fromId: string; toId: string; from: string; to: string; reason: string }
export interface Board { generatedAt?: string; accounts: Account[]; runs: Run[]; suggestions: Suggestion[] }

export class CliError extends Error {}

export const NOT_RUNNING = "Shiftwell is not running. Start it with: shiftwell start";

export class Client {
  constructor(
    private baseUrl: string,
    private fetchFn: typeof fetch = fetch,
  ) {}

  private async call<T>(method: string, path: string, body?: unknown): Promise<T> {
    let res: Response;
    try {
      res = await this.fetchFn(this.baseUrl + path, {
        method,
        headers: body === undefined ? undefined : { "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new CliError(NOT_RUNNING);
    }
    let data: unknown = null;
    try { data = await res.json(); } catch { /* empty body */ }
    if (!res.ok) {
      const msg = (data as { error?: string } | null)?.error;
      throw new CliError(msg ?? `Shiftwell answered with status ${res.status}`);
    }
    return data as T;
  }

  async health(): Promise<boolean> {
    try { return (await this.fetchFn(this.baseUrl + "/api/health")).ok; } catch { return false; }
  }

  board() { return this.call<Board>("GET", "/api/board"); }

  /** Case-insensitive match on id or name. Ambiguous or missing names raise a friendly error. */
  resolveAccount(accounts: Account[], query: string): Account {
    const q = query.toLowerCase();
    const byId = accounts.find((a) => a.id.toLowerCase() === q);
    if (byId) return byId;
    const named = accounts.filter((a) => a.name.toLowerCase() === q);
    if (named.length === 1) return named[0];
    if (named.length > 1) throw new CliError(`More than one account is called "${query}". Use its id instead.`);
    const list = accounts.map((a) => a.name).join(", ") || "none yet";
    throw new CliError(`No account matches "${query}". Accounts: ${list}`);
  }

  async startRun(task: string, repo: string, accountQueries: string[]): Promise<Run[]> {
    const { accounts } = await this.board();
    const ids = accountQueries.map((q) => this.resolveAccount(accounts, q).id);
    if (ids.length === 1) {
      return [await this.call<Run>("POST", "/api/runs", { profileId: ids[0], repo, task })];
    }
    const group = await this.call<{ groupId: string; runs: Run[] }>("POST", "/api/runs", { profileIds: ids, repo, task });
    return group.runs;
  }

  async handoff(runId: string, accountQuery: string): Promise<Run> {
    const { accounts } = await this.board();
    const to = this.resolveAccount(accounts, accountQuery);
    const res = await this.call<{ run: Run }>("POST", `/api/runs/${encodeURIComponent(runId)}/handoff`, { toProfileId: to.id });
    return res.run;
  }

  finish(runId: string, removeFolder: boolean) {
    return this.call<{ warning?: string } & Partial<Run>>("POST", `/api/runs/${encodeURIComponent(runId)}/finish`, { removeWorktree: removeFolder });
  }
}
