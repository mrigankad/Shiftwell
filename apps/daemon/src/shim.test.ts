import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildApp } from "./app.js";

const SECRET = "sk-shim-secret-999";
const api = { preset: "deepseek", baseUrl: "https://api.deepseek.com/v1", model: "deepseek-chat", keyEnv: "SW_SHIM_KEY" };

beforeEach(() => {
  process.env.SHIFTWELL_HOME = mkdtempSync(join(tmpdir(), "shiftwell-shim-"));
  process.env.SW_SHIM_KEY = SECRET;
});
afterEach(() => { delete process.env.SW_SHIM_KEY; });

type Seen = { url: string; auth: string | null; body: any };
function setup(reply: (seen: Seen) => Response) {
  const seen: Seen[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    const s = { url, auth: new Headers(init.headers).get("authorization"), body: JSON.parse(String(init.body)) };
    seen.push(s);
    return reply(s);
  }) as any;
  const app = buildApp({ fetch: fetchImpl });
  return { app, seen };
}
async function profile(app: ReturnType<typeof buildApp>) {
  return (await app.inject({ method: "POST", url: "/api/profiles", payload: { name: "Deep", provider: "api", api } })).json().id as string;
}
const call = (app: ReturnType<typeof buildApp>, id: string, payload: object, extra: object = {}) =>
  app.inject({ method: "POST", url: `/shim/${id}/v1/responses`, headers: { authorization: "Bearer codex-sent-key" }, payload, ...extra });

const sse = (chunks: unknown[]) =>
  new Response(chunks.map((c) => `data: ${typeof c === "string" ? c : JSON.stringify(c)}\n\n`).join(""), { status: 200, headers: { "Content-Type": "text/event-stream" } });
const parseSse = (text: string) => text.split("\n\n").filter(Boolean).map((b) => JSON.parse(b.split("\n").find((l) => l.startsWith("data:"))!.slice(5)));

describe("responses -> chat shim", () => {
  it("translates a non-stream text reply", async () => {
    const { app, seen } = setup(() => new Response(JSON.stringify({ model: "deepseek-chat", choices: [{ message: { role: "assistant", content: "Hello there" }, finish_reason: "stop" }], usage: { prompt_tokens: 7, completion_tokens: 3, total_tokens: 10 } })));
    const id = await profile(app);
    const r = await call(app, id, {
      model: "deepseek-chat", instructions: "Be brief", max_output_tokens: 50,
      input: [{ type: "reasoning", summary: [] }, { type: "message", role: "developer", content: [{ type: "input_text", text: "dev note" }] }, { type: "message", role: "user", content: [{ type: "input_text", text: "Hi" }] }],
      tools: [{ type: "function", name: "shell", description: "run", parameters: { type: "object", properties: { cmd: { type: "string" } } } }, { type: "web_search" }],
    });
    expect(r.statusCode).toBe(200);
    expect(seen[0].url).toBe("https://api.deepseek.com/v1/chat/completions");
    expect(seen[0].auth).toBe(`Bearer ${SECRET}`);
    expect(seen[0].body.messages).toEqual([{ role: "system", content: "Be brief" }, { role: "system", content: "dev note" }, { role: "user", content: "Hi" }]);
    expect(seen[0].body.max_tokens).toBe(50);
    expect(seen[0].body.stream).toBe(false);
    expect(seen[0].body.tools).toEqual([{ type: "function", function: { name: "shell", description: "run", parameters: { type: "object", properties: { cmd: { type: "string" } } } } }]);
    const j = r.json();
    expect(j.object).toBe("response");
    expect(j.status).toBe("completed");
    expect(j.output).toEqual([expect.objectContaining({ type: "message", role: "assistant", content: [expect.objectContaining({ type: "output_text", text: "Hello there" })] })]);
    expect(j.usage).toMatchObject({ input_tokens: 7, output_tokens: 3, total_tokens: 10 });
    expect(r.headers["x-shiftwell-dropped"]).toBe("tool:web_search");
    expect(r.body).not.toContain(SECRET);
  });

  it("streams a text reply in the right event order", async () => {
    const { app, seen } = setup(() => sse([
      { choices: [{ delta: { role: "assistant", content: "" } }] },
      { choices: [{ delta: { content: "Hel" } }] },
      { choices: [{ delta: { content: "lo" } }] },
      { choices: [{ delta: {}, finish_reason: "stop" }] },
      { choices: [], usage: { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 } },
      "[DONE]",
    ]));
    const id = await profile(app);
    const r = await call(app, id, { model: "deepseek-chat", stream: true, input: "Hi" });
    expect(seen[0].body.stream_options).toEqual({ include_usage: true });
    expect(r.headers["content-type"]).toContain("text/event-stream");
    const ev = parseSse(r.body);
    expect(ev.map((e) => e.type)).toEqual([
      "response.created", "response.output_item.added", "response.content_part.added",
      "response.output_text.delta", "response.output_text.delta", "response.output_text.done",
      "response.content_part.done", "response.output_item.done", "response.completed",
    ]);
    expect(ev.filter((e) => e.type === "response.output_text.delta").map((e) => e.delta).join("")).toBe("Hello");
    expect(ev.find((e) => e.type === "response.output_text.done").text).toBe("Hello");
    expect(ev.map((e) => e.sequence_number)).toEqual(ev.map((_, i) => i));
    const done = ev.at(-1);
    expect(done.response.status).toBe("completed");
    expect(done.response.output[0].content[0].text).toBe("Hello");
    expect(done.response.usage).toMatchObject({ input_tokens: 5, output_tokens: 2, total_tokens: 7 });
    expect(r.body).not.toContain(SECRET);
  });

  it("streams a tool call whose arguments arrive in chunks", async () => {
    const { app } = setup(() => sse([
      { choices: [{ delta: { tool_calls: [{ index: 0, id: "call_abc", type: "function", function: { name: "shell", arguments: "" } }] } }] },
      { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '{"cmd":' } }] } }] },
      { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '"ls"}' } }] } }] },
      { choices: [{ delta: {}, finish_reason: "tool_calls" }] },
      { choices: [], usage: { prompt_tokens: 9, completion_tokens: 4 } },
      "[DONE]",
    ]));
    const id = await profile(app);
    const r = await call(app, id, { model: "deepseek-chat", stream: true, input: "list", tools: [{ type: "function", name: "shell", parameters: {} }] });
    const ev = parseSse(r.body);
    expect(ev.map((e) => e.type)).toEqual([
      "response.created", "response.output_item.added",
      "response.function_call_arguments.delta", "response.function_call_arguments.delta",
      "response.function_call_arguments.done", "response.output_item.done", "response.completed",
    ]);
    expect(ev[1].item).toMatchObject({ type: "function_call", call_id: "call_abc", name: "shell", status: "in_progress" });
    const item = ev.find((e) => e.type === "response.output_item.done").item;
    expect(item).toMatchObject({ type: "function_call", call_id: "call_abc", name: "shell", arguments: '{"cmd":"ls"}' });
    expect(ev.at(-1).response.output).toEqual([item]);
    expect(ev.at(-1).response.usage).toMatchObject({ input_tokens: 9, output_tokens: 4, total_tokens: 13 });
  });

  it("turns a function_call and its output into assistant tool_calls plus a tool message", async () => {
    const { app, seen } = setup(() => new Response(JSON.stringify({ choices: [{ message: { content: "done" }, finish_reason: "stop" }] })));
    const id = await profile(app);
    const r = await call(app, id, {
      model: "deepseek-chat",
      input: [
        { type: "message", role: "user", content: [{ type: "input_text", text: "list files" }] },
        { type: "reasoning", summary: [], encrypted_content: "x" },
        { type: "function_call", call_id: "call_1", name: "shell", arguments: '{"cmd":"ls"}' },
        { type: "function_call", call_id: "call_2", name: "shell", arguments: '{"cmd":"pwd"}' },
        { type: "function_call_output", call_id: "call_1", output: "a.txt" },
        { type: "function_call_output", call_id: "call_2", output: "/repo" },
      ],
    });
    expect(r.statusCode).toBe(200);
    expect(seen[0].body.messages).toEqual([
      { role: "user", content: "list files" },
      { role: "assistant", content: null, tool_calls: [
        { id: "call_1", type: "function", function: { name: "shell", arguments: '{"cmd":"ls"}' } },
        { id: "call_2", type: "function", function: { name: "shell", arguments: '{"cmd":"pwd"}' } },
      ] },
      { role: "tool", tool_call_id: "call_1", content: "a.txt" },
      { role: "tool", tool_call_id: "call_2", content: "/repo" },
    ]);
  });

  it("maps an upstream 401 to a clean error without leaking the key or upstream text", async () => {
    const { app } = setup(() => new Response(JSON.stringify({ error: { message: `Incorrect API key ${SECRET}` } }), { status: 401 }));
    const id = await profile(app);
    for (const stream of [false, true]) {
      const r = await call(app, id, { model: "deepseek-chat", stream, input: "hi" });
      expect(r.statusCode).toBe(401);
      expect(r.json().error).toMatchObject({ type: "authentication_error", code: "invalid_api_key" });
      expect(r.json().error.message).toContain("401");
      expect(r.body).not.toContain(SECRET);
    }
  });

  it("emits response.failed when the stream breaks, and never leaks the key", async () => {
    const body = new ReadableStream({
      start(c) { c.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ choices: [{ delta: { content: "par" } }] })}\n\n`)); c.error(new Error(`boom ${SECRET}`)); },
    });
    const { app } = setup(() => new Response(body, { status: 200 }));
    const id = await profile(app);
    const r = await call(app, id, { model: "deepseek-chat", stream: true, input: "hi" });
    const ev = parseSse(r.body);
    expect(ev.at(-1).type).toBe("response.failed");
    expect(r.body).not.toContain(SECRET);
  });

  it("reports a missing key, an unknown profile and non-loopback callers without leaking", async () => {
    const { app, seen } = setup(() => new Response("{}"));
    const id = await profile(app);
    delete process.env.SW_SHIM_KEY;
    const noKey = await call(app, id, { input: "hi" });
    expect(noKey.statusCode).toBe(401);
    expect(noKey.json().error.message).toContain("SW_SHIM_KEY");
    process.env.SW_SHIM_KEY = SECRET;
    expect((await call(app, "nope", { input: "hi" })).statusCode).toBe(404);
    const remote = await call(app, id, { input: "hi" }, { remoteAddress: "10.0.0.5" });
    expect(remote.statusCode).toBe(403);
    const badHost = await call(app, id, { input: "hi" }, { headers: { host: "evil.example.com" } });
    expect(badHost.statusCode).toBe(403);
    expect(seen).toHaveLength(0);
  });
});
