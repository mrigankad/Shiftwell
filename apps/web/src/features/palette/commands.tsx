import type { ReactNode } from "react";
import type { Account } from "../../api";
import { CrewAvatar } from "../../crew";
import type { ThemeChoice } from "../../theme";

export interface Command {
  id: string;
  label: string;
  hint?: string;
  group: string;
  run: () => void;
  /** Optional leading visual, for example an avatar. */
  icon?: ReactNode;
  /** Optional keyboard hint shown on the right, for example "Ctrl P". */
  shortcut?: string;
}

export interface CommandContext {
  accounts: Account[];
  go: (route: string) => void;
  addAccount: () => void;
  startRun: () => void;
  prune: () => void;
  setTheme: (t: ThemeChoice) => void;
  /** Extra routes beyond the built in ones. `route` has no leading #/ . */
  extraRoutes?: { route: string; label: string; hint?: string }[];
  /** Defaults to navigating to the accounts page. */
  openAccount?: (a: Account) => void;
}

const ROUTES = [
  { route: "board", label: "Shift board", hint: "Who is on shift right now" },
  { route: "runs", label: "Runs", hint: "Every task and its worktree" },
  { route: "handoffs", label: "Handoffs", hint: "Move a task to another account" },
  { route: "accounts", label: "Accounts", hint: "Add, sign in or remove" },
  { route: "insights", label: "Insights", hint: "Usage over time" },
];

export function buildCommands(ctx: CommandContext): Command[] {
  const out: Command[] = [];
  for (const r of [...ROUTES, ...(ctx.extraRoutes ?? [])]) {
    out.push({ id: `nav:${r.route}`, label: `Go to ${r.label}`, hint: r.hint, group: "Navigate", run: () => ctx.go(r.route) });
  }
  out.push(
    { id: "act:add-account", label: "Add account", hint: "Connect another AI tool", group: "Actions", run: ctx.addAccount },
    { id: "act:start-run", label: "Start a run", hint: "Give an account a task", group: "Actions", run: ctx.startRun },
    { id: "act:prune", label: "Clean up runs", hint: "Close runs whose folder is gone", group: "Actions", run: ctx.prune },
    { id: "theme:light", label: "Theme: Day", group: "Appearance", run: () => ctx.setTheme("light") },
    { id: "theme:night", label: "Theme: Night", group: "Appearance", run: () => ctx.setTheme("night") },
    { id: "theme:system", label: "Theme: Auto", hint: "Follow the system setting", group: "Appearance", run: () => ctx.setTheme("system") },
  );
  for (const a of ctx.accounts) {
    out.push({
      id: `acct:${a.id}`,
      label: `Open ${a.name}`,
      hint: [a.plan, a.usage.state === "unknown" ? undefined : a.usage.state].filter(Boolean).join(", ") || a.provider,
      group: "Accounts",
      run: () => (ctx.openAccount ? ctx.openAccount(a) : ctx.go("accounts")),
      icon: <CrewAvatar provider={a.provider} preset={a.api?.preset} name={a.name} size={28} state={a.usage.state} />,
    });
  }
  return out;
}

/** Subsequence match. Returns a score (higher is better) or -1 for no match. */
export function fuzzyScore(query: string, text: string): number {
  const q = query.toLowerCase().trim();
  if (!q) return 0;
  const t = text.toLowerCase();
  const at = t.indexOf(q);
  if (at >= 0) return 1000 - at - (t.length - q.length) * 0.1 + (at === 0 || t[at - 1] === " " ? 50 : 0);
  let ti = 0, score = 0, streak = 0;
  for (const c of q) {
    if (c === " ") continue;
    const found = t.indexOf(c, ti);
    if (found < 0) return -1;
    streak = found === ti ? streak + 1 : 0;
    score += 10 + streak * 5 - (found - ti);
    ti = found + 1;
  }
  return Math.max(0, score);
}

export function filterCommands(commands: Command[], query: string): Command[] {
  if (!query.trim()) return commands;
  return commands
    .map((c) => {
      const a = fuzzyScore(query, c.label);
      const b = fuzzyScore(query, `${c.label} ${c.hint ?? ""} ${c.group}`);
      return { c, s: a >= 0 ? a : b >= 0 ? b - 200 : -1 };
    })
    .filter((x) => x.s > -1)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.c);
}
