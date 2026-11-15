import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { shiftwellHome } from "./paths.js";
import { listProfiles, type Profile } from "./profiles.js";
import { usageWorstPct } from "./guardrails.js";
import type { Usage } from "./usage.js";

export type RuleFallback = "most-headroom" | "none";
export interface RuleWhen {
  /** Comma separated keywords. The rule matches when the task contains any of them, ignoring case. */
  taskMatches?: string;
  /** Comma separated keywords matched against the repository path, ignoring case. */
  repoMatches?: string;
}
export interface Rule { id: string; name: string; enabled: boolean; when: RuleWhen; prefer: string[]; fallback: RuleFallback }

const file = () => join(shiftwellHome(), "rules.json");

function clean(input: unknown, forId: string): Rule {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("A rule must be an object");
  const i = input as Record<string, unknown>;
  const name = typeof i.name === "string" ? i.name.trim() : "";
  if (!name) throw new Error("Give the rule a name");
  if (name.length > 80) throw new Error("The rule name is too long (limit 80)");
  const enabled = i.enabled ?? true;
  if (typeof enabled !== "boolean") throw new Error("Enabled must be on or off");
  const w = (i.when ?? {}) as Record<string, unknown>;
  if (typeof w !== "object" || Array.isArray(w)) throw new Error("The match conditions are not valid");
  const when: RuleWhen = {};
  for (const k of ["taskMatches", "repoMatches"] as const) {
    const v = w[k];
    if (v === undefined || v === null || v === "") continue;
    if (typeof v !== "string" || v.length > 300) throw new Error("Keywords must be text of at most 300 characters");
    if (v.trim()) when[k] = v.trim();
  }
  const prefer = i.prefer ?? [];
  if (!Array.isArray(prefer) || prefer.some((p) => typeof p !== "string" || !p)) throw new Error("Preferred accounts must be a list of account ids");
  const fallback = i.fallback ?? "most-headroom";
  if (fallback !== "most-headroom" && fallback !== "none") throw new Error("Fallback must be most-headroom or none");
  return { id: forId, name, enabled, when, prefer: [...new Set(prefer as string[])], fallback };
}

export function listRules(): Rule[] {
  if (!existsSync(file())) return [];
  try {
    const raw = JSON.parse(readFileSync(file(), "utf8"));
    return Array.isArray(raw) ? raw.map((r) => clean(r, String(r?.id ?? randomUUID().slice(0, 8)))) : [];
  } catch { return []; }
}
const save = (rules: Rule[]) => writeFileSync(file(), JSON.stringify(rules, null, 2));
export const getRule = (id: string) => listRules().find((r) => r.id === id);

export function createRule(input: unknown): Rule {
  const rule = clean(input, randomUUID().slice(0, 8));
  save([...listRules(), rule]);
  return rule;
}

export function updateRule(id: string, input: unknown): Rule {
  const all = listRules();
  if (!all.some((r) => r.id === id)) throw new Error("Unknown rule");
  const rule = clean(input, id);
  save(all.map((r) => (r.id === id ? rule : r)));
  return rule;
}

export function deleteRule(id: string): boolean {
  const all = listRules();
  const next = all.filter((r) => r.id !== id);
  if (next.length === all.length) return false;
  save(next);
  return true;
}

/** `ids` must list every existing rule exactly once. */
export function reorderRules(ids: string[]): Rule[] {
  const all = listRules();
  if (!Array.isArray(ids) || ids.length !== all.length || new Set(ids).size !== ids.length || ids.some((id) => !all.some((r) => r.id === id))) {
    throw new Error("The new order must list every rule once");
  }
  const next = ids.map((id) => all.find((r) => r.id === id)!);
  save(next);
  return next;
}

export interface Pick { profileId: string | null; ruleId: string | null; reason: string }

const words = (s: string | undefined) => (s ?? "").split(/[,\n]/).map((x) => x.trim().toLowerCase()).filter(Boolean);

export function ruleMatches(rule: Rule, task: string, repo: string): boolean {
  const t = task.toLowerCase(), r = repo.toLowerCase();
  const tw = words(rule.when.taskMatches), rw = words(rule.when.repoMatches);
  if (tw.length && !tw.some((k) => t.includes(k))) return false;
  if (rw.length && !rw.some((k) => r.includes(k))) return false;
  return true;
}

const usable = (u: Usage | undefined) => u?.state !== "out" && u?.state !== "low";
/** Unknown usage counts as half full so accounts with real room rank first. */
const headroom = (u: Usage | undefined) => 100 - (usageWorstPct(u) ?? 50);

function mostHeadroom(profiles: Profile[], usage: Map<string, Usage>): Profile | null {
  const c = profiles.filter((p) => usable(usage.get(p.id))).sort((a, b) => headroom(usage.get(b.id)) - headroom(usage.get(a.id)));
  return c[0] ?? null;
}

/** Picks the account for a new task. The first enabled rule that matches decides; its preferred accounts are tried in order. */
export function pickAccount(task: string, repo: string, profiles: Profile[] = listProfiles(), usage: Map<string, Usage> = new Map(), rules: Rule[] = listRules()): Pick {
  if (profiles.length === 0) return { profileId: null, ruleId: null, reason: "There are no accounts yet." };
  const by = new Map(profiles.map((p) => [p.id, p]));
  for (const rule of rules) {
    if (!rule.enabled || !ruleMatches(rule, task, repo)) continue;
    const hit = rule.prefer.map((id) => by.get(id)).filter((p): p is Profile => !!p).find((p) => usable(usage.get(p.id)));
    if (hit) {
      const first = rule.prefer[0] === hit.id;
      return { profileId: hit.id, ruleId: rule.id, reason: first ? `Rule "${rule.name}" matched and ${hit.name} has room.` : `Rule "${rule.name}" matched. Accounts before ${hit.name} were out or low, so it took the next one.` };
    }
    if (rule.fallback === "most-headroom") {
      const best = mostHeadroom(profiles, usage);
      if (best) return { profileId: best.id, ruleId: rule.id, reason: `Rule "${rule.name}" matched but its accounts are out or low. ${best.name} has the most room.` };
    }
    // Matched with nothing usable and no fallback: keep looking at later rules.
  }
  const best = mostHeadroom(profiles, usage);
  if (best) return { profileId: best.id, ruleId: null, reason: `No rule applied. ${best.name} has the most room.` };
  return { profileId: null, ruleId: null, reason: "Every account is out or low right now." };
}
