import type { FastifyInstance } from "fastify";
import { getProfile, listRuns, transcriptForRun, type LiveResult } from "@shiftwell/core";

const POLL_MS = 2000;

/**
 * Live view of a run, read from the transcript the CLI already writes (never from its terminal or auth files).
 * GET /api/runs/:id/live?since=<epoch ms> answers the normalized events, 404 for an unknown run.
 * GET /api/runs/:id/live/stream is a server-sent stream that pushes new events every 2 seconds.
 */
export function registerLiveRoutes(app: FastifyInstance) {
  const read = (runId: string, since: number | undefined): LiveResult | null => {
    const run = listRuns().find((r) => r.id === runId);
    if (!run) return null;
    const profile = getProfile(run.profileId);
    if (!profile) return { source: "", events: [], lastActivityAt: null, filesTouched: [], hint: "The account for this run was removed." };
    return transcriptForRun(run, profile, { since });
  };
  const sinceOf = (v: unknown): number | undefined => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  };

  app.get<{ Params: { id: string }; Querystring: { since?: string } }>("/api/runs/:id/live", async (req, reply) => {
    const res = read(req.params.id, sinceOf(req.query.since));
    if (!res) return reply.code(404).send({ error: "Unknown run" });
    return res;
  });

  app.get<{ Params: { id: string }; Querystring: { since?: string } }>("/api/runs/:id/live/stream", (req, reply) => {
    if (!listRuns().some((r) => r.id === req.params.id)) return reply.code(404).send({ error: "Unknown run" });
    reply.hijack();
    reply.raw.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
    let since = sinceOf(req.query.since);
    let first = true;
    let lastHint: string | undefined;
    const tick = () => {
      try {
        const res = read(req.params.id, since);
        if (!res) { reply.raw.write(`event: gone\ndata: {}\n\n`); return; }
        const changed = res.events.length > 0 || res.hint !== lastHint || first;
        if (changed) reply.raw.write(`data: ${JSON.stringify(res)}\n\n`);
        else reply.raw.write(`: keep-alive\n\n`);
        for (const e of res.events) since = Math.max(since ?? 0, e.at);
        lastHint = res.hint;
        first = false;
      } catch { /* the connection is closing */ }
    };
    tick();
    const t = setInterval(tick, POLL_MS);
    req.raw.on("close", () => clearInterval(t));
  });
}
