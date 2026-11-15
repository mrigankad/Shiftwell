import { useEffect, useState } from "react";
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
import type { PageCtx } from "./pages/shared";

const PAGES = ["board", "runs", "handoffs", "accounts"] as const;
type Page = (typeof PAGES)[number];
const TITLES: Record<Page, string> = { board: "Shift board", runs: "Runs", handoffs: "Handoffs", accounts: "Accounts" };

const readHash = (): string => window.location.hash.replace(/^#\/?/, "");

/** The page for the hash, plus the group id on #/compare/<groupId>. */
function usePage(): [Page, string | null, (p: Page) => void] {
  const [hash, setHash] = useState(readHash);
  useEffect(() => {
    const on = () => setHash(readHash());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  const m = /^compare\/(.+)$/.exec(hash);
  const page: Page = m ? "runs" : (PAGES as readonly string[]).includes(hash) ? (hash as Page) : "board";
  return [page, m ? decodeURIComponent(m[1]) : null, (p) => { window.location.hash = `/${p}`; }];
}

function Sidebar({ page, go, accountCount, activeRuns, connected }: {
  page: Page; go: (p: Page) => void; accountCount: number; activeRuns: number; connected: boolean;
}) {
  const [theme, setTheme] = useTheme();
  const item = (id: Page, badge?: number) => {
    const on = page === id;
    return (
      <button key={id} onClick={() => go(id)} aria-current={on ? "page" : undefined}
        className={`flex w-full cursor-pointer items-center justify-between rounded-lg px-2.5 py-2 text-left text-[15px] ${on ? "border border-line bg-card font-bold" : "border border-transparent text-nav hover:bg-card"}`}>
        <span>{TITLES[id]}</span>
        {badge !== undefined && <span className="text-[13px] font-bold text-muted">{badge}</span>}
      </button>
    );
  };
  return (
    <aside className="flex w-[236px] shrink-0 flex-col gap-0.5 border-r border-line bg-surface px-3 py-[18px]">
      <div className="flex items-center gap-2.5 px-2 pb-4">
        <Mark />
        <span className="text-[21px] font-bold tracking-[-0.04em]">shiftwell</span>
      </div>
      <nav aria-label="Main" className="flex flex-col gap-0.5">
        <span className="px-2.5 pb-1 pt-3 text-xs font-bold tracking-[0.06em] text-muted">SHIFT</span>
        {item("board")}
        {item("runs", activeRuns)}
        {item("handoffs")}
        <span className="px-2.5 pb-1 pt-4 text-xs font-bold tracking-[0.06em] text-muted">ACCOUNTS</span>
        {item("accounts", accountCount)}
      </nav>
      <div className="flex-1" />
      <div className="flex flex-col gap-1.5 px-1 pb-3">
        <span className="px-1.5 text-xs font-bold tracking-[0.06em] text-muted">THEME</span>
        <ThemeSwitch value={theme} onChange={setTheme} />
      </div>
      <div className="flex flex-col gap-1.5 rounded-[10px] border border-line bg-card p-3">
        <div className="flex items-center gap-2">
          <span className={`size-2 rounded-full ${connected ? "bg-pass" : "bg-fail"}`} />
          <span className="text-sm font-bold">{connected ? "Safe mode on" : "Service offline"}</span>
        </div>
        <span className="text-[13px] leading-[18px] text-body">
          {connected ? "Official CLIs only. No tokens read. Auto-rotation off." : "Start it with pnpm --filter @shiftwell/daemon dev"}
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
  const [page, compareId, go] = usePage();
  const [finishing, setFinishing] = useState<Run | null>(null);

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
    go: (p) => go(p as Page),
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar page={page} go={go} accountCount={accounts.length} activeRuns={activeCount} connected={connected} />
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[52px] items-center justify-between border-b border-line px-7">
          <span className="text-sm text-body">{TITLES[page]}</span>
          <div className="flex gap-2">
            {page !== "accounts" && (
              <button onClick={() => setAdding(true)} className="cursor-pointer rounded-lg border border-line px-3.5 py-2 text-sm font-bold hover:bg-surface">Add account</button>
            )}
            <button onClick={() => setStarting(true)} disabled={accounts.length === 0} className="cursor-pointer rounded-lg bg-cta px-3.5 py-2 text-sm font-bold text-on-cta hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">Start a run</button>
          </div>
        </header>

        {page === "board" && <BoardPage ctx={ctx} board={board} />}
        {page === "runs" && !compareId && <RunsPage ctx={ctx} />}
        {page === "runs" && compareId && <ComparePage ctx={ctx} groupId={compareId} />}
        {page === "handoffs" && <HandoffsPage ctx={ctx} />}
        {page === "accounts" && <AccountsPage ctx={ctx} />}
      </main>

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
