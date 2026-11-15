import type { FastifyInstance } from "fastify";
import { getProfile } from "@shiftwell/core";

/**
 * Local Responses API -> Chat Completions translator, so the Codex CLI (Responses only) can talk to
 * providers that only offer /chat/completions. Mounted at /shim/:profileId/v1/responses.
 * The provider key is read from the daemon's own environment; whatever key Codex sends is ignored,
 * and no key, upstream body or upstream header is ever copied into a response or error.
 */

type J = Record<string, any>;
const LOOPBACK = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);
const rid = (p: string) => `${p}_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;

// ---------- request translation ----------

export interface Translated { body: J; dropped: string[] }

function textOf(content: unknown, dropped: string[]): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  const out: string[] = [];
  for (const part of content) {
    if (typeof part === "string") out.push(part);
    else if (part?.type === "input_text" || part?.type === "output_text" || part?.type === "text") out.push(String(part.text ?? ""));
    else if (part?.type === "refusal") out.push(String(part.refusal ?? ""));
    else if (part?.type) { const n = `content:${part.type}`; if (!dropped.includes(n)) dropped.push(n); }
  }
  return out.join("");
}

export function toChatRequest(req: J): Translated {
  const dropped: string[] = [];
  const messages: J[] = [];
  if (typeof req.instructions === "string" && req.instructions.trim()) messages.push({ role: "system", content: req.instructions });

  const input: unknown[] = typeof req.input === "string" ? [{ type: "message", role: "user", content: req.input }] : Array.isArray(req.input) ? req.input : [];
  let pending: J | null = null; // assistant message collecting consecutive function_calls
  const flush = () => { pending = null; };
  const assistant = (): J => {
    if (pending) return pending;
    const last = messages[messages.length - 1];
    if (last?.role === "assistant" && !last.tool_calls) { pending = last; return last; }
    pending = { role: "assistant", content: null, tool_calls: [] };
    messages.push(pending);
    return pending;
  };

  for (const item of input as J[]) {
    const type = item?.type ?? (item?.role ? "message" : undefined);
    if (type === "message") {
      flush();
      const role = item.role === "developer" ? "system" : item.role;
      if (!["system", "user", "assistant"].includes(role)) { dropped.push(`message:${item.role}`); continue; }
      messages.push({ role, content: textOf(item.content, dropped) });
    } else if (type === "function_call") {
      const a = assistant();
      a.tool_calls ??= [];
      a.tool_calls.push({ id: item.call_id ?? rid("call"), type: "function", function: { name: item.name, arguments: typeof item.arguments === "string" ? item.arguments : JSON.stringify(item.arguments ?? {}) } });
    } else if (type === "function_call_output") {
      flush();
      const out = item.output;
      messages.push({ role: "tool", tool_call_id: item.call_id, content: typeof out === "string" ? out : Array.isArray(out) ? textOf(out, dropped) : JSON.stringify(out ?? "") });
    } else if (type === "reasoning") {
      // reasoning items are opaque to chat providers: ignored
    } else if (type) {
      if (!dropped.includes(`input:${type}`)) dropped.push(`input:${type}`);
    }
  }
  // Providers reject an assistant message with neither content nor tool calls.
  for (const m of messages) if (m.role === "assistant" && m.tool_calls && !m.tool_calls.length) delete m.tool_calls;

  const tools: J[] = [];
  for (const t of Array.isArray(req.tools) ? req.tools : []) {
    if (t?.type === "function" && t.name) tools.push({ type: "function", function: { name: t.name, description: t.description ?? "", parameters: t.parameters ?? { type: "object", properties: {} } } });
    else dropped.push(`tool:${t?.type ?? "unknown"}${t?.name ? `(${t.name})` : ""}`);
  }

  const body: J = { model: req.model, messages, stream: req.stream === true };
  if (body.stream) body.stream_options = { include_usage: true };
  if (tools.length) { body.tools = tools; body.tool_choice = typeof req.tool_choice === "string" ? req.tool_choice : "auto"; }
  if (typeof req.max_output_tokens === "number") body.max_tokens = req.max_output_tokens;
  if (typeof req.temperature === "number") body.temperature = req.temperature;
  if (typeof req.top_p === "number") body.top_p = req.top_p;
  return { body, dropped };
}

// ---------- response translation ----------

function usageOf(u: J | undefined): J {
  const i = Number(u?.prompt_tokens ?? 0), o = Number(u?.completion_tokens ?? 0);
  return {
    input_tokens: i, input_tokens_details: { cached_tokens: Number(u?.prompt_tokens_details?.cached_tokens ?? 0) },
    output_tokens: o, output_tokens_details: { reasoning_tokens: Number(u?.completion_tokens_details?.reasoning_tokens ?? 0) },
    total_tokens: Number(u?.total_tokens ?? i + o),
  };
}

const messageItem = (id: string, text: string, status = "completed"): J => ({ id, type: "message", role: "assistant", status, content: text === "" && status === "in_progress" ? [] : [{ type: "output_text", text, annotations: [] }] });
const callItem = (id: string, callId: string, name: string, args: string, status = "completed"): J => ({ id, type: "function_call", status, call_id: callId, name, arguments: args });

/** Non-streaming: one chat.completion -> one response object. */
export function toResponse(chat: J, model: string, dropped: string[] = []): J {
  const choice = chat?.choices?.[0] ?? {};
  const msg = choice.message ?? {};
  const output: J[] = [];
  if (typeof msg.content === "string" && msg.content !== "") output.push(messageItem(rid("msg"), msg.content));
  for (const tc of msg.tool_calls ?? []) output.push(callItem(rid("fc"), tc.id ?? rid("call"), tc.function?.name ?? "", tc.function?.arguments ?? "{}"));
  const length = choice.finish_reason === "length";
  return {
    id: rid("resp"), object: "response", created_at: Math.floor(Date.now() / 1000), model: chat?.model ?? model,
    status: length ? "incomplete" : "completed", ...(length ? { incomplete_details: { reason: "max_output_tokens" } } : {}),
    output, usage: usageOf(chat?.usage), ...(dropped.length ? { metadata: { shiftwell_dropped: dropped.join(",") } } : {}),
  };
}

/** Streaming translator: feed chat chunks in, get Responses events out via `emit`. */
export class StreamTranslator {
  private seq = 0;
  private id = rid("resp");
  private started = false;
  private outputs: J[] = [];            // finished items in output order
  private text: { idx: number; id: string; buf: string } | null = null;
  private calls = new Map<number, { idx: number; id: string; callId: string; name: string; args: string }>();
  private usage: J | undefined;
  private finish: string | null = null;
  private nextIdx = 0;
  private model: string;
  constructor(private emit: (type: string, data: J) => void, model: string, private dropped: string[] = []) { this.model = model; }

  private ev(type: string, data: J = {}) { this.emit(type, { type, sequence_number: this.seq++, ...data }); }
  private base(status: string): J {
    return { id: this.id, object: "response", model: this.model, status, output: [], ...(this.dropped.length ? { metadata: { shiftwell_dropped: this.dropped.join(",") } } : {}) };
  }
  start() { if (this.started) return; this.started = true; this.ev("response.created", { response: this.base("in_progress") }); }

  private closeText() {
    const t = this.text; if (!t) return;
    this.text = null;
    this.ev("response.output_text.done", { item_id: t.id, output_index: t.idx, content_index: 0, text: t.buf });
    this.ev("response.content_part.done", { item_id: t.id, output_index: t.idx, content_index: 0, part: { type: "output_text", text: t.buf, annotations: [] } });
    const item = messageItem(t.id, t.buf);
    this.outputs[t.idx] = item;
    this.ev("response.output_item.done", { output_index: t.idx, item });
  }

  chunk(c: J) {
    this.start();
    if (c.model) this.model = c.model;
    if (c.usage) this.usage = c.usage;
    const choice = c.choices?.[0];
    if (!choice) return;
    const d = choice.delta ?? {};
    if (typeof d.content === "string" && d.content !== "") {
      if (!this.text) {
        const idx = this.nextIdx++, id = rid("msg");
        this.text = { idx, id, buf: "" };
        this.ev("response.output_item.added", { output_index: idx, item: messageItem(id, "", "in_progress") });
        this.ev("response.content_part.added", { item_id: id, output_index: idx, content_index: 0, part: { type: "output_text", text: "", annotations: [] } });
      }
      this.text.buf += d.content;
      this.ev("response.output_text.delta", { item_id: this.text.id, output_index: this.text.idx, content_index: 0, delta: d.content });
    }
    for (const tc of d.tool_calls ?? []) {
      this.closeText();
      const key = Number(tc.index ?? 0);
      let call = this.calls.get(key);
      if (!call) {
        call = { idx: this.nextIdx++, id: rid("fc"), callId: tc.id ?? rid("call"), name: tc.function?.name ?? "", args: "" };
        this.calls.set(key, call);
        this.ev("response.output_item.added", { output_index: call.idx, item: callItem(call.id, call.callId, call.name, "", "in_progress") });
      } else {
        if (!call.name && tc.function?.name) call.name = tc.function.name;
      }
      const a = tc.function?.arguments;
      if (typeof a === "string" && a !== "") {
        call.args += a;
        this.ev("response.function_call_arguments.delta", { item_id: call.id, output_index: call.idx, delta: a });
      }
    }
    if (choice.finish_reason) this.finish = choice.finish_reason;
  }

  /** Call once when the upstream stream ends normally. */
  complete() {
    this.start();
    this.closeText();
    for (const call of [...this.calls.values()].sort((a, b) => a.idx - b.idx)) {
      const args = call.args === "" ? "{}" : call.args;
      this.ev("response.function_call_arguments.done", { item_id: call.id, output_index: call.idx, arguments: args });
      const item = callItem(call.id, call.callId, call.name, args);
      this.outputs[call.idx] = item;
      this.ev("response.output_item.done", { output_index: call.idx, item });
    }
    const length = this.finish === "length";
    const response = { ...this.base(length ? "incomplete" : "completed"), created_at: Math.floor(Date.now() / 1000), output: this.outputs.filter(Boolean), usage: usageOf(this.usage), ...(length ? { incomplete_details: { reason: "max_output_tokens" } } : {}) };
    this.ev(length ? "response.incomplete" : "response.completed", { response });
  }

  fail(message: string, code = "upstream_error") {
    this.start();
    this.ev("response.failed", { response: { ...this.base("failed"), error: { code, message } } });
  }
}

// ---------- route ----------

const errBody = (message: string, type: string, code: string) => ({ error: { message, type, code } });

function mapStatus(status: number): { http: number; message: string; code: string } {
  if (status === 401 || status === 403) return { http: 401, message: `The provider rejected the API key (HTTP ${status}). Check the key in the environment the daemon runs in.`, code: "invalid_api_key" };
  if (status === 429) return { http: 429, message: "The provider rate limit was hit (HTTP 429)", code: "rate_limit_exceeded" };
  if (status === 400 || status === 404 || status === 422) return { http: 400, message: `The provider rejected the request (HTTP ${status}). The model name may be wrong for this provider.`, code: "invalid_request" };
  return { http: 502, message: `The provider answered HTTP ${status}`, code: "upstream_error" };
}

export function registerShim(app: FastifyInstance, doFetch: typeof fetch) {
  app.post<{ Params: { profileId: string }; Body: J }>("/shim/:profileId/v1/responses", { bodyLimit: 64 * 1024 * 1024 }, async (req, reply) => {
    if (!LOOPBACK.has(req.socket.remoteAddress ?? "") || !LOOPBACK_HOSTS.has(String(req.headers.host ?? "").replace(/:\d+$/, ""))) {
      return reply.code(403).send(errBody("The translator only answers local requests", "forbidden", "not_loopback"));
    }
    const p = getProfile(req.params.profileId);
    if (!p?.api) return reply.code(404).send(errBody("No API account with that id", "not_found", "unknown_profile"));
    const key = process.env[p.api.keyEnv];
    if (!key) return reply.code(401).send(errBody(`${p.api.keyEnv} is not set in the environment the daemon runs in`, "authentication_error", "missing_api_key"));
    const body = (req.body && typeof req.body === "object" ? req.body : {}) as J;
    if (!body.model) body.model = p.api.model;
    const { body: chatBody, dropped } = toChatRequest(body);
    const stream = chatBody.stream === true;

    const ac = new AbortController();
    const onClose = () => { if (!reply.raw.writableEnded) ac.abort(); };
    req.raw.on("close", onClose);
    let up: Response;
    try {
      up = await doFetch(`${p.api.baseUrl.replace(/\/+$/, "")}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", Accept: stream ? "text/event-stream" : "application/json" },
        body: JSON.stringify(chatBody),
        signal: ac.signal,
      });
    } catch {
      return reply.code(502).send(errBody("Could not reach the provider", "upstream_error", "upstream_unreachable"));
    }
    if (!up.ok) {
      try { await up.body?.cancel(); } catch { /* ignore */ }
      const m = mapStatus(up.status);
      return reply.code(m.http).send(errBody(m.message, m.http === 401 ? "authentication_error" : "upstream_error", m.code));
    }
    if (dropped.length) reply.header("x-shiftwell-dropped", dropped.join(","));

    if (!stream) {
      let chat: J;
      try { chat = (await up.json()) as J; } catch { return reply.code(502).send(errBody("The provider sent a reply that is not JSON", "upstream_error", "bad_upstream_reply")); }
      return toResponse(chat, body.model, dropped);
    }

    reply.hijack();
    const raw = reply.raw;
    raw.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive", ...(dropped.length ? { "x-shiftwell-dropped": dropped.join(",") } : {}) });
    const t = new StreamTranslator((type, data) => { if (!raw.writableEnded) raw.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`); }, body.model, dropped);
    t.start();
    let ended = false;
    try {
      const reader = up.body!.getReader();
      const dec = new TextDecoder();
      let buf = "";
      const handle = (line: string) => {
        if (!line.startsWith("data:")) return;
        const data = line.slice(5).trim();
        if (!data) return;
        if (data === "[DONE]") { ended = true; return; }
        try { t.chunk(JSON.parse(data)); } catch { /* skip malformed chunk */ }
      };
      for (;;) {
        const { done, value } = await reader.read();
        if (value) buf += dec.decode(value, { stream: !done });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) { handle(buf.slice(0, nl).replace(/\r$/, "")); buf = buf.slice(nl + 1); }
        if (done) { handle(buf.replace(/\r$/, "")); break; }
        if (ended) { try { await reader.cancel(); } catch { /* ignore */ } break; }
      }
      t.complete();
    } catch {
      t.fail("The provider stream was interrupted");
    }
    raw.end();
    req.raw.off("close", onClose);
  });
}
