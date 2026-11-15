import { useEffect, useMemo, useState } from "react";
import { WorkerDetailPage } from "./features/worker/WorkerDetailPage";
import { ResetCalendarPage } from "./features/resets/ResetCalendarPage";
import { UsageCostPage } from "./features/usage/UsageCostPage";
import { WeeklyRecapPage } from "./features/recap/WeeklyRecapPage";
import { RoutingRulesPage } from "./features/rules/RoutingRulesPage";
import { GuardrailsPage } from "./features/guardrails/GuardrailsPage";
import { SkillLibraryPage } from "./features/skills/SkillLibraryPage";
import { ProjectMemoryPage } from "./features/memory/ProjectMemoryPage";
import { Onboarding, shouldShowOnboarding } from "./features/onboarding";
import { CommandPalette, buildCommands } from "./features/palette";
import { OfflineBanner } from "./components/states";
import { api, subscribe, type Account, type Board, type CreateProfileInput, type Provider, type Run } from "./api";
import { Mark } from "./crew";
import { AddAccountDialog } from "./AddAccountDialog";
import { StartRunDialog, type StartInput } from "./StartRunDialog";
import { ThemeSwitch, useTheme } from "./theme";
import { BoardPage } from "./pages/BoardPage";
import { RunsPage } from "./pages/RunsPage";
import { HandoffsPage } from "./pages/HandoffsPage";
import { FinishRunDialog } from "./FinishRunDialog";
import { ComparePage } from "./pages/ComparePage";
import { AccountsPage } from "./pages/AccountsPage";
import { InsightsPage } from "./pages/InsightsPage";
import type { PageCtx } from "./pages/shared";

const PAGES = ["board", "runs", "handoffs", "accounts", "resets", "insights", "usage", "recap", "rules", "safety", "skills", "memory"] as const;
type Page = (typeof PAGES)[number];
const TITLES: Record<Page, string> = {
  board: "Shift board", runs: "Runs", handoffs: "Handoffs", accounts: "Accounts", resets: "Reset calendar",
  insights: "Insights", usage: "Usage and cost", recap: "Weekly recap",
  rules: "Routing rules", safety: "Guardrails", skills: "Skill library", memory: "Project memory",
};

const readHash = (): string => window.location.hash.replace(/^#\/?/, "");

/** The page for the hash, plus the id on #/compare/<groupId> and #/accounts/<id>. */
function usePage(): [Page, { compareId: string | null; workerId: string | null }, (p: string) => void] {
  const [hash, setHash] = useState(readHash);
  useEffect(() => {
    const on = () => setHash(readHash());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  const cmp = /^compare\/(.+)$/.exec(hash);
  const wrk = /^accounts\/(.+)$/.exec(hash);
  const page: Page = cmp ? "runs" : wrk ? "accounts" : (PAGES as readonly string[]).includes(hash) ? (hash as Page) : "board";
  return [page, { compareId: cmp ? decodeURIComponent(cmp[1]) : null, workerId: wrk ? decodeURIComponent(wrk[1]) : null }, (p) => { window.location.hash = `/${p}`; }];
}

function Sidebar({ page, go, accountCount, activeRuns, connected, theme, setTheme, onSearch, className = "" }: {
  page: Page; go: (p: Page) => void; accountCount: number; activeRuns: number; connected: boolean;
  theme: ReturnType<typeof useTheme>[0]; setTheme: ReturnType<typeof useTheme>[1]; onSearch: () => void; className?: string;
}) {
  const item = (id: Page, badge?: number) => {
    const on = page === id;
    return (
      <button key={id} onClick={() => go(id)} aria-current={on ? "page" : undefined}
        className={`flex w-full shrink-0 cursor-pointer items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[14px] ${on ? "border border-line bg-card font-bold" : "border border-transparent text-nav hover:bg-card"}`}>
        <span>{TITLES[id]}</span>
        {badge !== undefined && <span className="text-[13px] font-bold text-muted">{badge}</span>}
      </button>
    );
  };
  return (
    <aside className={`h-full w-[236px] shrink-0 flex-col border-r border-line bg-surface px-3 py-4 ${className}`}>
      <div className="flex shrink-0 items-center gap-2.5 px-2 pb-3">
        <Mark />
        <span className="text-[21px] font-bold tracking-[-0.04em]">shiftwell</span>
      </div>
      <button onClick={onSearch} className="mb-1 flex shrink-0 cursor-pointer items-center justify-between rounded-lg border border-line bg-card px-2.5 py-2 text-left text-sm text-muted hover:text-ink">
        <span>Search or jump to</span>
        <kbd className="rounded border border-line px-1.5 text-[11px] font-bold" style={{ fontFamily: "inherit" }}>Ctrl K</kbd>
      </button>
      <nav aria-label="Main" className="-mx-1 flex min-h-0 flex-1 flex-col gap-px overflow-y-auto px-1 pb-2">
        <span className="px-2.5 pb-1 pt-2 text-[11px] font-bold tracking-[0.06em] text-muted">SHIFT</span>
        {item("board")}
        {item("runs", activeRuns)}
        {item("handoffs")}
        <span className="px-2.5 pb-1 pt-3 text-[11px] font-bold tracking-[0.06em] text-muted">ACCOUNTS</span>
        {item("accounts", accountCount)}
        {item("resets")}
        <span className="px-2.5 pb-1 pt-3 text-[11px] font-bold tracking-[0.06em] text-muted">INSIGHTS</span>
        {item("insights")}
        {item("usage")}
        {item("recap")}
        <span className="px-2.5 pb-1 pt-3 text-[11px] font-bold tracking-[0.06em] text-muted">WORKSPACE</span>
        {item("rules")}
        {item("safety")}
        {item("skills")}
        {item("memory")}
      </nav>
      <div className="flex shrink-0 flex-col gap-1.5 border-t border-line px-1 pb-2 pt-3">
        <span className="px-1.5 text-xs font-bold tracking-[0.06em] text-muted">THEME</span>
        <ThemeSwitch value={theme} onChange={setTheme} />
      </div>
      <div className="flex shrink-0 flex-col gap-1 rounded-[10px] border border-line bg-card p-2.5">
        <div className="flex items-center gap-2">
          <span className={`size-2 rounded-full ${connected ? "bg-pass" : "bg-fail"}`} />
          <span className="text-sm font-bold">{connected ? "Safe mode on" : "Service offline"}</span>
        </div>
        <span className="text-[12px] leading-[16px] text-body">
          {connected ? "Official CLIs only. No tokens read. Auto-rotation off." : "Start it with: shiftwell start"}
        </span>
      </div>
    </aside>
  );
}

export function App() {
  const [board, setBoard] = useState<Board | null>(null);
  const [connected, setConnected] = useState(false);
  const [adding, setAdding] = useState(false);
  const [starting, setStarting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [page, { compareId, workerId }, go] = usePage();
  const [finishing, setFinishing] = useState<Run | null>(null);
  const [theme, setTheme] = useTheme();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [welcome, setWelcome] = useState<boolean | null>(null);
  const [navOpen, setNavOpen] = useState(false);
  useEffect(() => { setNavOpen(false); }, [page, compareId, workerId]);
  useEffect(() => {
    if (!navOpen) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setNavOpen(false); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [navOpen]);
  useEffect(() => { if (board && welcome === null) setWelcome(shouldShowOnboarding(board.accounts.length)); }, [board, welcome]);

  useEffect(() => subscribe(setBoard, setConnected), []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t); }, [toast]);

  const accounts = board?.accounts ?? [];
  const runs = board?.runs ?? [];
  const activeCount = runs.filter((r) => r.status === "active").length;
  const nameOf = (id: string) => accounts.find((a) => a.id === id)?.name ?? "Removed account";
  const presetOf = (id: string) => accounts.find((a) => a.id === id)?.api?.preset;
  const providerOf = (id: string): Provider => accounts.find((a) => a.id === id)?.provider ?? "api";

  const act = async (fn: () => Promise<unknown>, ok: string) => { try { await fn(); setToast(ok); } catch (e) { setToast((e as Error).message); } };

  const ctx: PageCtx = {
    accounts, runs, nameOf, providerOf, presetOf,
    handOff: (run: Run, toId: string, reason?: string) =>
      act(() => api.handOff(run.id, toId, reason), `Handed off to ${nameOf(toId)}. Its CLI opened in the same worktree with HANDOFF.md.`),
    openRun: (r) => act(() => api.openRun(r.id), `Opened ${nameOf(r.profileId)} in the run's worktree`),
    finishRun: (r) => setFinishing(r),
    prune: async () => {
      try {
        const { pruned } = await api.pruneRuns();
        setToast(pruned > 0 ? `Closed ${pruned} ${pruned === 1 ? "run" : "runs"} whose folder was gone` : "Nothing to clean up");
      } catch (e) { setToast((e as Error).message); }
    },
    login: async (a: Account) => {
      try { const r = await api.openLogin(a.id); setToast(`Opened a terminal running "${r.command}" for ${a.name}`); }
      catch (e) { setToast((e as Error).message); }
    },
    remove: (a: Account) => act(() => api.removeProfile(a.id), `Removed ${a.name}. Its folder stays on disk.`),
    addAccount: () => setAdding(true),
    startRun: () => setStarting(true),
    go: (p) => go(p),
  };

  const commands = useMemo(() => buildCommands({
    accounts, go: (r: string) => go(r),
    addAccount: () => setAdding(true), startRun: () => setStarting(true), prune: ctx.prune, setTheme,
    extraRoutes: (["resets", "usage", "recap", "rules", "safety", "skills", "memory"] as const).map((r) => ({ route: r, label: TITLES[r] })),
    openAccount: (a: Account) => go(`accounts/${a.id}`),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [accounts, theme]);

  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar page={page} go={go} accountCount={accounts.length} activeRuns={activeCount} connected={connected}
        theme={theme} setTheme={setTheme} onSearch={() => setPaletteOpen(true)} className="hidden lg:flex" />
      {navOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <Sidebar page={page} go={go} accountCount={accounts.length} activeRuns={activeCount} connected={connected}
            theme={theme} setTheme={setTheme} onSearch={() => { setNavOpen(false); setPaletteOpen(true); }} className="flex shadow-2xl" />
          <button aria-label="Close navigation" onClick={() => setNavOpen(false)} className="flex-1 cursor-pointer bg-black/40" />
        </div>
      )}
      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <header className="sticky top-0 z-30 flex h-[52px] shrink-0 items-center justify-between gap-3 border-b border-line bg-page/90 px-4 backdrop-blur sm:px-7">
          <div className="flex min-w-0 items-center gap-2">
            <button onClick={() => setNavOpen(true)} aria-label="Open navigation" className="-ml-1.5 flex size-9 cursor-pointer items-center justify-center rounded-lg hover:bg-surface lg:hidden">
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden><path d="M2 4.5h14M2 9h14M2 13.5h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
            </button>
            <span className="lg:hidden"><Mark size={20} /></span>
            <span className="truncate text-sm text-body">{TITLES[page]}</span>
          </div>
          <div className="flex shrink-0 gap-2">
            {page !== "accounts" && (
              <button onClick={() => setAdding(true)} className="hidden cursor-pointer rounded-lg border border-line px-3.5 py-2 text-sm font-bold hover:bg-surface sm:block">Add account</button>
            )}
            <button onClick={() => setStarting(true)} disabled={accounts.length === 0} className="cursor-pointer whitespace-nowrap rounded-lg bg-cta px-3.5 py-2 text-sm font-bold text-on-cta hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">Start a run</button>
          </div>
        </header>
        {!connected && board !== null && <OfflineBanner />}

        {page === "board" && <BoardPage ctx={ctx} board={board} />}
        {page === "runs" && !compareId && <RunsPage ctx={ctx} />}
        {page === "runs" && compareId && <ComparePage ctx={ctx} groupId={compareId} />}
        {page === "handoffs" && <HandoffsPage ctx={ctx} />}
        {page === "accounts" && !workerId && <AccountsPage ctx={ctx} />}
        {page === "accounts" && workerId && <WorkerDetailPage id={workerId} ctx={ctx} />}
        {page === "resets" && <ResetCalendarPage ctx={ctx} />}
        {page === "insights" && <InsightsPage ctx={ctx} />}
        {page === "usage" && <div className="px-7 py-6"><UsageCostPage /></div>}
        {page === "recap" && <div className="px-7 py-6"><WeeklyRecapPage /></div>}
        {page === "rules" && <div className="px-7 py-6"><RoutingRulesPage accounts={accounts} /></div>}
        {page === "safety" && <div className="px-7 py-6"><GuardrailsPage accounts={accounts} /></div>}
        {page === "skills" && <SkillLibraryPage />}
        {page === "memory" && <ProjectMemoryPage />}
      </main>

      <CommandPalette commands={commands} open={paletteOpen} onOpenChange={setPaletteOpen} />
      {welcome && <Onboarding accountsCount={accounts.length} onAddAccount={() => setAdding(true)} onClose={() => setWelcome(false)} />}

      {adding && (
        <AddAccountDialog
          onClose={() => setAdding(false)}
          onCreate={async (input: CreateProfileInput) => {
            const p = await api.createProfile(input);
            setAdding(false);
            setToast(`${p.name} added. Next: sign in from its row.`);
          }}
        />
      )}

      {starting && (
        <StartRunDialog accounts={accounts} onClose={() => setStarting(false)}
          onStart={async (input: StartInput) => {
            if ("profileIds" in input) {
              const r = await api.startRuns(input);
              setStarting(false); setToast(`Started ${r.runs.length} runs in parallel`);
            } else {
              const r = await api.startRun(input);
              setStarting(false); setToast(`Run started on ${r.branch}. The CLI opened in its worktree.`);
            }
          }} />
      )}

      {finishing && (
        <FinishRunDialog run={finishing} onClose={() => setFinishing(null)}
          onFinish={async (removeWorktree) => {
            const r = await api.finishRun(finishing.id, { removeWorktree });
            setFinishing(null);
            setToast(r.warning ?? (r.worktreeRemoved ? "Run marked done. The worktree folder was removed, the branch stays." : "Run marked done. The worktree and branch stay for you to merge."));
          }} />
      )}

      {toast && (
        <div role="status" className="fixed bottom-6 right-6 rounded-xl bg-cta px-4 py-3 text-sm font-bold text-on-cta shadow-xl">{toast}</div>
      )}
    </div>
  );
}
