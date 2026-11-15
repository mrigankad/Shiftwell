import type { FastifyInstance } from "fastify";
import {
  listProfiles, listRuns, listSkills, getSkill, createSkill, updateSkill, removeSkill, syncSkills,
  memoryForRepo, addNote, updateNote, removeNote,
} from "@shiftwell/core";

type Body = Record<string, unknown>;
const obj = (b: unknown): Body => (b && typeof b === "object" && !Array.isArray(b) ? (b as Body) : {});
const bad = (e: unknown) => ({ error: (e as Error).message });

/** A repo path from the query or body: non-empty text, a sane length, no control characters. */
function repoOf(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const r = v.trim();
  // eslint-disable-next-line no-control-regex
  return r && r.length <= 1000 && !/[\u0000-\u001f]/.test(r) ? r : null;
}

/** Skill library and project memory routes. */
export function registerKnowledgeRoutes(app: FastifyInstance) {
  app.get("/api/skills", async () => listSkills());

  app.post("/api/skills", async (req, reply) => {
    const b = obj(req.body);
    try {
      return reply.code(201).send(createSkill({
        name: b.name as string, description: b.description as string | undefined, body: b.body as string,
        enabled: b.enabled === undefined ? undefined : b.enabled === true, providers: b.providers as never,
      }));
    } catch (e) { return reply.code(400).send(bad(e)); }
  });

  // Registered before /api/skills/:id so the literal path wins.
  app.post("/api/skills/sync", async () => ({ files: syncSkills(listProfiles()) }));

  app.get<{ Params: { id: string } }>("/api/skills/:id", async (req, reply) =>
    getSkill(req.params.id) ?? reply.code(404).send({ error: "not found" }));

  app.put<{ Params: { id: string } }>("/api/skills/:id", async (req, reply) => {
    if (!getSkill(req.params.id)) return reply.code(404).send({ error: "not found" });
    const b = obj(req.body);
    if (b.enabled !== undefined && typeof b.enabled !== "boolean") return reply.code(400).send({ error: "enabled must be true or false" });
    try {
      return updateSkill(req.params.id, {
        name: b.name as string | undefined, description: b.description as string | undefined, body: b.body as string | undefined,
        enabled: b.enabled as boolean | undefined, providers: b.providers as never,
      });
    } catch (e) { return reply.code(400).send(bad(e)); }
  });

  app.delete<{ Params: { id: string } }>("/api/skills/:id", async (req, reply) =>
    removeSkill(req.params.id) ? { ok: true } : reply.code(404).send({ error: "not found" }));

  app.get("/api/memory/repos", async () => {
    const repos = [...new Set(listRuns().map((r) => r.repo))];
    return repos.map((repo) => ({ repo, notes: memoryForRepo(repo).notes.length }));
  });

  app.get<{ Querystring: { repo?: string } }>("/api/memory", async (req, reply) => {
    const repo = repoOf(req.query.repo);
    if (!repo) return reply.code(400).send({ error: "repo is required" });
    return memoryForRepo(repo);
  });

  app.post("/api/memory/notes", async (req, reply) => {
    const b = obj(req.body);
    const repo = repoOf(b.repo);
    if (!repo) return reply.code(400).send({ error: "repo is required" });
    if (b.pinned !== undefined && typeof b.pinned !== "boolean") return reply.code(400).send({ error: "pinned must be true or false" });
    try { return reply.code(201).send(addNote(repo, { text: b.text as string, pinned: b.pinned as boolean | undefined })); }
    catch (e) { return reply.code(400).send(bad(e)); }
  });

  app.patch<{ Params: { id: string } }>("/api/memory/notes/:id", async (req, reply) => {
    const b = obj(req.body);
    const repo = repoOf(b.repo);
    if (!repo) return reply.code(400).send({ error: "repo is required" });
    if (b.pinned !== undefined && typeof b.pinned !== "boolean") return reply.code(400).send({ error: "pinned must be true or false" });
    if (b.text !== undefined && typeof b.text !== "string") return reply.code(400).send({ error: "text must be text" });
    if (!memoryForRepo(repo).notes.some((n) => n.id === req.params.id)) return reply.code(404).send({ error: "not found" });
    try { return updateNote(repo, req.params.id, { text: b.text as string | undefined, pinned: b.pinned as boolean | undefined }); }
    catch (e) { return reply.code(400).send(bad(e)); }
  });

  app.delete<{ Params: { id: string }; Querystring: { repo?: string } }>("/api/memory/notes/:id", async (req, reply) => {
    const repo = repoOf(req.query.repo);
    if (!repo) return reply.code(400).send({ error: "repo is required" });
    return removeNote(repo, req.params.id) ? { ok: true } : reply.code(404).send({ error: "not found" });
  });
}
