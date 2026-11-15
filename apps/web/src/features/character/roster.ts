import { useSyncExternalStore } from "react";
import type { Account } from "../../api";
import type { Recipe } from "./recipes";

/**
 * The account roster as far as characters go. The live board feed and the editor's save both write here,
 * so every CrewAvatar can find an account's recipe by id or name without each page passing it down.
 */
type Entry = Pick<Account, "id" | "name" | "character">;
export interface Roster { byId: Map<string, Recipe>; byName: Map<string, Recipe>; entries: Entry[] }

let roster: Roster = { byId: new Map(), byName: new Map(), entries: [] };
const subs = new Set<() => void>();

const same = (a: Entry[], b: Entry[]) =>
  a.length === b.length && a.every((x, i) => x.id === b[i]!.id && x.name === b[i]!.name && JSON.stringify(x.character) === JSON.stringify(b[i]!.character));

function publish(entries: Entry[]) {
  if (same(entries, roster.entries)) return;
  const byId = new Map<string, Recipe>(), byName = new Map<string, Recipe>();
  for (const a of entries) if (a.character) { byId.set(a.id, a.character); byName.set(a.name.trim().toLowerCase(), a.character); }
  roster = { byId, byName, entries };
  subs.forEach((f) => f());
}

export const setRoster = (accounts: Entry[]) => publish(accounts.map(({ id, name, character }) => ({ id, name, character })));

/** Apply one saved account right away, before the next board arrives. */
export function patchRoster(a: Entry) {
  const entry = { id: a.id, name: a.name, character: a.character };
  publish(roster.entries.some((x) => x.id === a.id) ? roster.entries.map((x) => (x.id === a.id ? entry : x)) : [...roster.entries, entry]);
}

export const useRoster = (): Roster =>
  useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => roster, () => roster);
