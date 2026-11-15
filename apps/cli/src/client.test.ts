import { describe, expect, it } from "vitest";
import { Client, NOT_RUNNING, type Board } from "./client.js";

const board: Board = {
  accounts: [
    { id: "a1", name: "Claude A", provider: "claude" },
    { id: "b2", name: "Codex A", provider: "codex" },
  ],
  runs: [], suggestions: [],
};

type Call = { url: string; init?: RequestInit };

function fake(calls: Call[], handler?: (url: string) => Response) {
  return (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    if (handler) return handler(url);
    if (url.endsWith("/api/board")) return Response.json(board);
    return Response.json({ id: "r1", branch: "shiftwell/r1", runs: [{ id: "r1", branch: "b1" }, { id: "r2", branch: "b2" }], run: { id: "r1", branch: "b" } }, { status: 201 });
  }) as unknown as typeof fetch;
}

describe("Client", () => {
  it("reports not running when fetch fails", async () => {
    const c = new Client("http://x", (async () => { throw new TypeError("fetch failed"); }) as unknown as typeof fetch);
    await expect(c.board()).rejects.toThrow(NOT_RUNNING);
    expect(await c.health()).toBe(false);
  });
  it("posts profileId for one account, case-insensitively", async () => {
    const calls: Call[] = [];
    const runs = await new Client("http://x", fake(calls)).startRun("task", "/repo", ["claude a"]);
    expect(runs[0].branch).toBe("shiftwell/r1");
    const post = calls.find((c) => c.init?.method === "POST")!;
    expect(post.url).toBe("http://x/api/runs");
    expect(JSON.parse(post.init!.body as string)).toEqual({ profileId: "a1", repo: "/repo", task: "task" });
  });
  it("posts profileIds for several accounts and resolves by id", async () => {
    const calls: Call[] = [];
    const runs = await new Client("http://x", fake(calls)).startRun("t", "/r", ["A1", "codex a"]);
    expect(runs).toHaveLength(2);
    const post = calls.find((c) => c.init?.method === "POST")!;
    expect(JSON.parse(post.init!.body as string).profileIds).toEqual(["a1", "b2"]);
  });
  it("gives a friendly error for unknown accounts", async () => {
    await expect(new Client("http://x", fake([])).startRun("t", "/r", ["nope"])).rejects.toThrow(/No account matches "nope"/);
  });
  it("sends handoff and finish bodies", async () => {
    const calls: Call[] = [];
    const c = new Client("http://x", fake(calls));
    await c.handoff("r1", "Codex A");
    await c.finish("r1", true);
    const posts = calls.filter((x) => x.init?.method === "POST");
    expect(posts[0].url).toBe("http://x/api/runs/r1/handoff");
    expect(JSON.parse(posts[0].init!.body as string)).toEqual({ toProfileId: "b2" });
    expect(posts[1].url).toBe("http://x/api/runs/r1/finish");
    expect(JSON.parse(posts[1].init!.body as string)).toEqual({ removeWorktree: true });
  });
  it("surfaces daemon error messages", async () => {
    const c = new Client("http://x", fake([], () => Response.json({ error: "No such run" }, { status: 404 })));
    await expect(c.finish("zz", false)).rejects.toThrow("No such run");
  });
});
