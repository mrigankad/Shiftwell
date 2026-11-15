import type { FastifyInstance } from "fastify";
import {
  listProfiles, usageFor, listRuns, type Usage,
  listRules, createRule, updateRule, deleteRule, reorderRules, pickAccount,
  getGuardrails, saveGuardrails, checkStart,
} from "@shiftwell/core";

/**
 * Routing rules and guardrails.
 * Bad input answers 400 with `{ error }` in plain words, an unknown rule answers 404.
 */
export function registerRuleRoutes(app: FastifyInstance) {
  const usageMap = () => new Map<string, Usage>(listProfiles().map((p) => [p.id, usageFor(p)]));
  const bad = (e: unknown) => ({ error: (e as Error).message });

  app.get("/api/rules", async () => listRules());

  app.post<{ Body: unknown }>("/api/rules", async (req, reply) => {
    try { return reply.code(201).send(createRule(req.body)); } catch (e) { return reply.code(400).send(bad(e)); }
  });

  // Registered before /api/rules/:id so "order" is never read as an id.
  app.put<{ Body: { ids?: unknown } }>("/api/rules/order", async (req, reply) => {
    const ids = req.body?.ids;
    if (!Array.isArray(ids) || ids.some((x) => typeof x !== "string")) return reply.code(400).send({ error: "ids must be a list of rule ids" });
    try { return reorderRules(ids as string[]); } catch (e) { return reply.code(400).send(bad(e)); }
  });

  app.post<{ Body: { task?: unknown; repo?: unknown } }>("/api/rules/pick", async (req, reply) => {
    const { task, repo } = req.body ?? {};
    if (typeof task !== "string" || !task.trim()) return reply.code(400).send({ error: "Describe the task" });
    if (repo !== undefined && typeof repo !== "string") return reply.code(400).send({ error: "The repository must be text" });
    const profiles = listProfiles();
    const pick = pickAccount(task, repo ?? "", profiles, usageMap());
    const profile = profiles.find((p) => p.id === pick.profileId);
    return { ...pick, profileName: profile?.name ?? null };
  });

  app.put<{ Params: { id: string }; Body: unknown }>("/api/rules/:id", async (req, reply) => {
    if (!listRules().some((r) => r.id === req.params.id)) return reply.code(404).send({ error: "Unknown rule" });
    try { return updateRule(req.params.id, req.body); } catch (e) { return reply.code(400).send(bad(e)); }
  });

  app.delete<{ Params: { id: string } }>("/api/rules/:id", async (req, reply) =>
    deleteRule(req.params.id) ? { ok: true } : reply.code(404).send({ error: "Unknown rule" }));

  app.get("/api/guardrails", async () => getGuardrails());

  app.put<{ Body: unknown }>("/api/guardrails", async (req, reply) => {
    try { return saveGuardrails(req.body); } catch (e) { return reply.code(400).send(bad(e)); }
  });

  app.post<{ Body: { profileIds?: unknown } }>("/api/guardrails/check", async (req, reply) => {
    const ids = req.body?.profileIds;
    if (!Array.isArray(ids) || ids.some((x) => typeof x !== "string")) return reply.code(400).send({ error: "profileIds must be a list of account ids" });
    const active = listRuns().filter((r) => r.status === "active").length;
    return checkStart(ids as string[], usageMap(), active);
  });
}
