import { lazy, Suspense, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { RoutingRulesPage } from "./features/rules/RoutingRulesPage";
import { GuardrailsPage } from "./features/guardrails/GuardrailsPage";
import { ResetCalendarPage } from "./features/resets/ResetCalendarPage";
import { Onboarding, shouldShowOnboarding } from "./features/onboarding";
import { CommandPalette, buildCommands } from "./features/palette";
import { OfflineBanner, Skeleton } from "./components/states";
import { ToastProvider, useToast } from "./components/ui/Toast";
import { buttonCls } from "./components/ui/Button";
import { api, subscribe, type Account, type Board, type CreateProfileInput, type Provider, type Run } from "./api";
import { Mark } from "./crew";
import { AddAccountDialog } from "./AddAccountDialog";
import { StartRunDialog, type StartInput } from "./StartRunDialog";
import { ThemeSwitch, useTheme } from "./theme";
import { BoardPage } from "./pages/BoardPage";
import { RunsPage } from "./pages/RunsPage";
import { HandoffsPage } from "./pages/HandoffsPage";
import { FinishRunDialog } from "./FinishRunDialog";
import { AccountsPage } from "./pages/AccountsPage";
import { NowContext, useTicker } from "./lib/time";
import type { PageCtx } from "./pages/shared";

// Heavier or rarely opened pages load on demand.
const WorkerDetailPage = lazy(() => import("./features/worker/WorkerDetailPage").then((m) => ({ default: m.WorkerDetailPage })));
const LiveViewPage = lazy(() => import("./features/live").then((m) => ({ default: m.LiveViewPage })));
const ComparePage = lazy(() => import("./pages/ComparePage").then((m) => ({ default: m.ComparePage })));
const InsightsPage = lazy(() => import("./pages/InsightsPage").then((m) => ({ default: m.InsightsPage })));
const UsageCostPage = lazy(() => import("./features/usage/UsageCostPage").then((m) => ({ default: m.UsageCostPage })));
const WeeklyRecapPage = lazy(() => import("./features/recap/WeeklyRecapPage").then((m) => ({ default: m.WeeklyRecapPage })));
const SkillLibraryPage = lazy(() => import("./features/skills/SkillLibraryPage").then((m) => ({ default: m.SkillLibraryPage })));
const ProjectMemoryPage = lazy(() => import("./features/memory/ProjectMemoryPage").then((m) => ({ default: m.ProjectMemoryPage })));

const PAGES = ["board", "runs", "handoffs", "accounts", "resets", "insights", "usage", "recap", "rules", "safety", "skills", "memory"] as const;
type Page = (typeof PAGES)[number];
const TITLES: Record<Page, string> = {
  board: "Shift board", runs: "Runs", handoffs: "Handoffs", accounts: "Accounts", resets: "Reset calendar",
  insights: "Insights", usage: "Usage and cost", recap: "Weekly recap",
  rules: "Routing rules", safety: "Guardrails", skills: "Skill library", memory: "Project memory",
};

/** 16px line icons for the sidebar, drawn on a 16 grid with a 1.5 stroke. */
const ICONS: Record<Page, ReactNode> = {
  board: <path d="M2.5 7.2 8 2.8l5.5 4.4V13a.5.5 0 0 1-.5.5H10V10H6v3.5H3a.5.5 0 0 1-.5-.5z" />,
  runs: <><circle cx="8" cy="8" r="5.75" /><path d="M6.8 5.6v4.8L10.4 8z" /></>,
  handoffs: <path d="M3 5.5h9l-2.2-2.2M13 10.5H4l2.2 2.2" />,
  accounts: <><circle cx="6" cy="5.5" r="2.25" /><path d="M2 13c.4-2.2 2-3.5 4-3.5s3.6 1.3 4 3.5M10.5 3.5a2.2 2.2 0 0 1 0 4.2M12 9.8c1.1.5 1.8 1.6 2 3.2" /></>,
  resets: <><rect x="2.5" y="3.5" width="11" height="10" rx="1.5" /><path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" /></>,
  insights: <path d="M2.5 13.5h11M4.5 11V8M8 11V4.5M11.5 11V6.5" />,
  usage: <><circle cx="8" cy="8" r="5.75" /><path d="M8 4.5v7M10 6c-.4-.6-1.1-.9-2-.9-1.1 0-1.9.6-1.9 1.4 0 1.9 4 1 4 2.9 0 .8-.9 1.4-2.1 1.4-.9 0-1.7-.4-2.1-1" /></>,
  recap: <><rect x="3" y="2.5" width="10" height="11" rx="1.5" /><path d="M5.5 5.5h5M5.5 8h5M5.5 10.5h3" /></>,
  rules: <path d="M3 4h6M3 8h4M3 12h7M11 3v4M9.5 5.5 11 7l1.5-1.5M13 9v4" />,
  safety: <path d="M8 2.2 13 4v4c0 3-2.2 5-5 5.8C5.2 13 3 11 3 8V4z" />,
  skills: <path d="M8 2.5 9.6 6l3.9.4-2.9 2.6.8 3.8L8 10.9 4.6 12.8l.8-3.8L2.5 6.4 6.4 6z" />,
  memory: <><path d="M4 2.5h6.5L12.5 4.5v9H4z" /><path d="M6.5 7h3.5M6.5 9.5h3.5" /></>,
};

const readHash = (): string => window.location.hash.replace(/^#\/?/, "");

/** The page for the hash, plus the id on #/compare/<groupId> and #/accounts/<id>. */
function usePage(): [Page, { compareId: string | null; workerId: string | null; liveId: string | null }, (p: string) => void] {
  const [hash, setHash] = useState(readHash);
  useEffect(() => {
    const on = () => setHash(readHash());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  const cmp = /^compare\/(.+)$/.exec(hash);
  const wrk = /^accounts\/(.+)$/.exec(hash);
  const liv = /^live\/(.+)$/.exec(hash);
  const page: Page = cmp || liv ? "runs" : wrk ? "accounts" : (PAGES as readonly string[]).includes(hash) ? (hash as Page) : "board";
  const go = useCallback((p: string) => { window.location.hash = `/${p}`; }, []);
  return [page, { compareId: cmp ? decodeURIComponent(cmp[1]) : null, workerId: wrk ? decodeURIComponent(wrk[1]) : null, liveId: liv ? decodeURIComponent(liv[1]) : null }, go];
}

function Sidebar({ page, go, counts, connected, theme, setTheme, onSearch, className = "" }: {
  page: Page; go: (p: Page) => void; counts: Partial<Record<Page, { n: number; urgent?: boolean }>>; connected: boolean;
  theme: ReturnType<typeof useTheme>[0]; setTheme: ReturnType<typeof useTheme>[1]; onSearch: () => void; className?: string;
}) {
  const item = (id: Page) => {
    const on = page === id;
    const c = counts[id];
    return (
      <button key={id} onClick={() => go(id)} aria-current={on ? "page" : undefined}
        className={`flex w-full shrink-0 cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm ${on ? "border border-line bg-card font-bold text-ink" : "border border-transparent text-nav hover:bg-card hover:text-ink"}`}>
        <svg aria-hidden width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 ${on ? "text-ink" : "text-muted"}`}>{ICONS[id]}</svg>
        <span className="min-w-0 flex-1 truncate">{TITLES[id]}</span>
        {c && c.n > 0 && <span className={`text-meta font-bold tabular-nums ${c.urgent ? "text-action" : "text-muted"}`}>{c.n}</span>}
      </button>
    );
  };
  const group = (label: string) => <span className="px-2.5 pb-1 pt-3 text-2xs font-bold tracking-[0.06em] text-muted first:pt-2">{label}</span>;
  return (
    <aside className={`h-full w-[236px] shrink-0 flex-col border-r border-line bg-surface px-3 py-4 ${className}`}>
      <div className="flex shrink-0 items-center gap-2.5 px-2 pb-3">
        <Mark />
        <span className="text-xl font-bold tracking-[-0.04em]">shiftwell</span>
      </div>
      <button onClick={onSearch} className="mb-1 flex shrink-0 cursor-pointer items-center gap-2 rounded-lg border border-line bg-card px-2.5 py-2 text-left text-sm text-muted hover:text-ink">
        <svg aria-hidden width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><circle cx="7" cy="7" r="4.5" /><path d="m10.5 10.5 3 3" /></svg>
        <span className="flex-1">Search or jump to</span>
        <kbd className="rounded border border-line px-1.5 text-2xs font-bold [font-family:inherit]">Ctrl K</kbd>
      </button>
      <nav aria-label="Main" className="-mx-1 flex min-h-0 flex-1 flex-col gap-px overflow-y-auto px-1 pb-2">
        {group("SHIFT")}
        {item("board")}
        {item("runs")}
        {item("handoffs")}
        {group("ACCOUNTS")}
        {item("accounts")}
        {item("resets")}
        {group("INSIGHTS")}
        {item("insights")}
        {item("usage")}
        {item("recap")}
        {group("WORKSPACE")}
        {item("rules")}
        {item("safety")}
        {item("skills")}
        {item("memory")}
      </nav>
      <div className="flex shrink-0 flex-col gap-1.5 border-t border-line px-1 pb-2 pt-3">
        <span className="px-1.5 text-xs font-bold tracking-[0.06em] text-muted">THEME</span>
        <ThemeSwitch value={theme} onChange={setTheme} />
      </div>
      <div className="flex shrink-0 flex-col gap-1 rounded-card border border-line bg-card p-2.5">
        <div className="flex items-center gap-2">
          <span className={`size-2 rounded-full ${connected ? "sw-live bg-pass" : "bg-fail"}`} />
          <span className="text-sm font-bold">{connected ? "Safe mode on" : "Service offline"}</span>
        </div>
        <span className="text-xs leading-4 text-body">
          {connected ? "Official CLIs only. No tokens read. Auto-rotation off." : "Start it with: shiftwell start"}
        </span>
      </div>
    </aside>
  );
}

export function App() {
  return (
    <ToastProvider>
      <Shell />
    </ToastProvider>
  );
}

function Shell() {
  const [board, setBoard] = useState<Board | null>(null);
  const [connected, setConnected] = useState(false);
  const [waited, setWaited] = useState(false);
  const [adding, setAdding] = useState(false);
  const [starting, setStarting] = useState(false);
  const toast = useToast();
  const [page, { compareId, workerId, liveId }, go] = usePage();
  const [finishing, setFinishing] = useState<Run | null>(null);
  const [theme, setTheme] = useTheme();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [welcome, setWelcome] = useState<boolean | null>(null);
  const [navOpen, setNavOpen] = useState(false);
  const now = useTicker(30_000);
  useEffect(() => { setNavOpen(false); }, [page, compareId, workerId, liveId]);
  useEffect(() => {
    if (!navOpen) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setNavOpen(false); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [navOpen]);
  useEffect(() => { if (board && welcome === null) setWelcome(shouldShowOnboarding(board.accounts.length)); }, [board, welcome]);

  // The last good board stays on screen through reconnects; only the banner says we are offline.
  useEffect(() => subscribe(setBoard, setConnected), []);
  useEffect(() => { const t = setTimeout(() => setWaited(true), 2500); return () => clearTimeout(t); }, []);

  /** Apply a change to one run right away; the next board from the service confirms or corrects it. */
  const patchRun = useCallback((id: string, patch: Partial<Run>) => {
    setBoard((b) => (b ? { ...b, runs: b.runs.map((r) => (r.id === id ? { ...r, ...patch } : r)) } : b));
  }, []);

  const accounts = useMemo(() => board?.accounts ?? [], [board]);
  const runs = useMemo(() => board?.runs ?? [], [board]);
  const activeCount = runs.filter((r) => r.status === "active").length;

  const ctx: PageCtx = useMemo(() => {
    const byId = new Map(accounts.map((a) => [a.id, a]));
    const nameOf = (id: string) => byId.get(id)?.name ?? "Removed account";
    const presetOf = (id: string) => byId.get(id)?.api?.preset;
    const providerOf = (id: string): Provider => byId.get(id)?.provider ?? "api";
    const act = async (fn: () => Promise<unknown>, ok: string) => {
      try { await fn(); toast.success(ok); } catch (e) { toast.error((e as Error).message); }
    };
    return {
      accounts, runs, nameOf, providerOf, presetOf, now,
      handOff: (run: Run, toId: string, reason?: string) => {
        const before = run.status;
        patchRun(run.id, { status: "handed-off" });
        void (async () => {
          try {
            await api.handOff(run.id, toId, reason);
            toast.success(`Handed off to ${nameOf(toId)}. Its CLI opened in the same worktree with HANDOFF.md.`);
          } catch (e) { patchRun(run.id, { status: before }); toast.error((e as Error).message); }
        })();
      },
      openRun: (r) => act(() => api.openRun(r.id), `Opened ${nameOf(r.profileId)} in the run's worktree`),
      finishRun: (r) => setFinishing(r),
      prune: async () => {
        try {
          const { pruned } = await api.pruneRuns();
          toast.info(pruned > 0 ? `Closed ${pruned} ${pruned === 1 ? "run" : "runs"} whose folder was gone` : "Nothing to clean up");
        } catch (e) { toast.error((e as Error).message); }
      },
      login: async (a: Account) => {
        try { const r = await api.openLogin(a.id); toast.info(`Opened a terminal running "${r.command}" for ${a.name}`); }
        catch (e) { toast.error((e as Error).message); }
      },
      remove: (a: Account) => act(() => api.removeProfile(a.id), `Removed ${a.name}. Its folder stays on disk.`),
      addAccount: () => setAdding(true),
      startRun: () => setStarting(true),
      go,
    };
  }, [accounts, runs, now, toast, patchRun, go]);

  const commands = useMemo(() => buildCommands({
    accounts, go: (r: string) => go(r),
    addAccount: () => setAdding(true), startRun: () => setStarting(true), prune: ctx.prune, setTheme,
    extraRoutes: (["resets", "usage", "recap", "rules", "safety", "skills", "memory"] as const).map((r) => ({ route: r, label: TITLES[r] })),
    openAccount: (a: Account) => go(`accounts/${a.id}`),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [accounts, theme]);

  const counts = {
    runs: { n: activeCount },
    handoffs: { n: board?.suggestions.length ?? 0, urgent: true },
    accounts: { n: accounts.length },
  };
  const sidebarProps = { page, go, counts, connected, theme, setTheme };
  const loading = <Skeleton rows={4} label="Loading the crew" />;
  const needsBoard = (node: ReactNode) => (board === null ? loading : node);

  return (
    <NowContext.Provider value={now}>
      <div className="flex h-dvh overflow-hidden">
        <Sidebar {...sidebarProps} onSearch={() => setPaletteOpen(true)} className="hidden lg:flex" />
        {navOpen && (
          <div className="fixed inset-0 z-40 flex lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
            <Sidebar {...sidebarProps} onSearch={() => { setNavOpen(false); setPaletteOpen(true); }} className="flex shadow-2xl" />
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
                <button onClick={() => setAdding(true)} className={buttonCls("secondary", "md", "max-sm:hidden")}>Add account</button>
              )}
              <button onClick={() => setStarting(true)} disabled={accounts.length === 0} className={buttonCls("primary", "md")}>Start a run</button>
            </div>
          </header>

          <div className="mx-auto flex w-full min-w-0 max-w-[1440px] flex-col gap-4 px-4 py-5 sm:px-7 sm:py-6">
            {!connected && (board !== null || waited) && <OfflineBanner />}
            <Suspense fallback={loading}>
              {page === "board" && <BoardPage ctx={ctx} board={board} />}
              {page === "runs" && !compareId && !liveId && needsBoard(<RunsPage ctx={ctx} />)}
              {page === "runs" && liveId && needsBoard(<LiveViewPage runId={liveId} ctx={ctx} />)}
              {page === "runs" && compareId && <ComparePage ctx={ctx} groupId={compareId} />}
              {page === "handoffs" && needsBoard(<HandoffsPage ctx={ctx} />)}
              {page === "accounts" && !workerId && needsBoard(<AccountsPage ctx={ctx} />)}
              {page === "accounts" && workerId && needsBoard(<WorkerDetailPage id={workerId} ctx={ctx} />)}
              {page === "resets" && needsBoard(<ResetCalendarPage ctx={ctx} />)}
              {page === "insights" && <InsightsPage ctx={ctx} />}
              {page === "usage" && <UsageCostPage />}
              {page === "recap" && <WeeklyRecapPage />}
              {page === "rules" && needsBoard(<RoutingRulesPage accounts={accounts} />)}
              {page === "safety" && needsBoard(<GuardrailsPage accounts={accounts} />)}
              {page === "skills" && <SkillLibraryPage onToast={toast.success} />}
              {page === "memory" && <ProjectMemoryPage onToast={toast.success} />}
            </Suspense>
          </div>
        </main>

        <CommandPalette commands={commands} open={paletteOpen} onOpenChange={setPaletteOpen} />
        {welcome && <Onboarding accountsCount={accounts.length} onAddAccount={() => setAdding(true)} onClose={() => setWelcome(false)} />}

        {adding && (
          <AddAccountDialog
            onClose={() => setAdding(false)}
            onCreate={async (input: CreateProfileInput) => {
              const p = await api.createProfile(input);
              setAdding(false);
              toast.success(`${p.name} added. Next: sign in from its row.`);
            }}
          />
        )}

        {starting && (
          <StartRunDialog accounts={accounts} onClose={() => setStarting(false)}
            onStart={async (input: StartInput) => {
              if ("profileIds" in input) {
                const r = await api.startRuns(input);
                setStarting(false); toast.success(`Started ${r.runs.length} runs in parallel`);
              } else {
                const r = await api.startRun(input);
                setStarting(false); toast.success(`Run started on ${r.branch}. The CLI opened in its worktree.`);
              }
            }} />
        )}

        {finishing && (
          <FinishRunDialog run={finishing} onClose={() => setFinishing(null)}
            onFinish={async (removeWorktree) => {
              const r = await api.finishRun(finishing.id, { removeWorktree });
              patchRun(finishing.id, { status: "done" });
              setFinishing(null);
              if (r.warning) toast.info(r.warning);
              else toast.success(r.worktreeRemoved ? "Run marked done. The worktree folder was removed, the branch stays." : "Run marked done. The worktree and branch stay for you to merge.");
            }} />
        )}
      </div>
    </NowContext.Provider>
  );
}
