import { useEffect, useMemo, useState } from "react";
import { api, subscribe, type Account, type Board, type Provider, type Run, type State } from "./api";
import { CrewAvatar, Mark } from "./crew";
import { AddAccountDialog } from "./AddAccountDialog";
import { StartRunDialog } from "./StartRunDialog";
import { ThemeSwitch, useTheme } from "./theme";

const STATE_PILL: Record<State, { label: string; cls: string }> = {
  unknown: { label: "No data yet", cls: "bg-surface text-muted" },
  room: { label: "Room", cls: "bg-pass-soft text-pass" },
  on: { label: "On shift", cls: "bg-action-soft text-action" },
  low: { label: "Low", cls: "bg-warn-soft text-warn" },
  out: { label: "Out", cls: "bg-fail-soft text-fail" },
};

function resetIn(resetsAt: number | null | undefined): string {
  if (!resetsAt) return "n/a";
  const min = Math.max(0, Math.round((resetsAt * 1000 - Date.now()) / 60000));
  return min >= 60 ? `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, "0")}m` : `${min}m`;
}

function Bar({ pct }: { pct: number | null | undefined }) {
  if (pct === null || pct === undefined) return <span className="text-sm text-muted">n/a</span>;
  const color = pct >= 100 ? "bg-fail" : pct >= 85 ? "bg-warn" : "bg-ink";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 rounded-full bg-track">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <span className="w-10 text-[13px] font-bold tabular-nums">{Math.round(pct)}%</span>
    </div>
  );
}

function Sidebar({ count, connected }: { count: number; connected: boolean }) {
  const [theme, setTheme] = useTheme();
  const item = (label: string, active = false, badge?: string | number) => (
    <div className={`flex items-center justify-between rounded-lg px-2.5 py-2 text-[15px] ${active ? "border border-line bg-card font-bold" : "text-nav"}`}>
      <span>{label}</span>
      {badge !== undefined && <span className="text-[13px] font-bold text-muted">{badge}</span>}
    </div>
  );
  return (
    <aside className="flex w-[236px] shrink-0 flex-col gap-0.5 border-r border-line bg-surface px-3 py-[18px]">
      <div className="flex items-center gap-2.5 px-2 pb-4">
        <Mark />
        <span className="text-[21px] font-bold tracking-[-0.04em]">shiftwell</span>
      </div>
      <span className="px-2.5 pb-1 pt-3 text-xs font-bold tracking-[0.06em] text-muted">SHIFT</span>
      {item("Shift board", true)}
      {item("Tasks")}
      {item("Handoffs")}
      <span className="px-2.5 pb-1 pt-4 text-xs font-bold tracking-[0.06em] text-muted">ACCOUNTS</span>
      {item("Accounts", false, count)}
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

function AccountRow({ a, onLogin, onRemove }: { a: Account; onLogin: () => void; onRemove: () => void }) {
  const u = a.usage;
  const pill = STATE_PILL[u.state];
  return (
    <div className="group flex items-center gap-4 border-b border-row px-4 py-3 last:border-b-0">
      <div className="flex w-[200px] shrink-0 items-center gap-2.5">
        <CrewAvatar provider={a.provider} state={u.state} />
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-[15px] font-bold">{a.name}</span>
          <span className="text-xs text-muted">{a.plan || a.provider}</span>
        </div>
      </div>
      <div className="flex-1 text-sm text-body">
        {u.latest ? (
          <span>{u.stale ? `Last seen ${u.ageMinutes} min ago` : `Updated ${u.ageMinutes} min ago`}{u.latest.model ? ` · ${u.latest.model}` : ""}</span>
        ) : a.loginCommand ? (
          <button onClick={onLogin} className="cursor-pointer rounded-lg border border-line px-3 py-1.5 text-[13px] font-bold text-ink hover:bg-surface">
            Sign in · {a.loginCommand}
          </button>
        ) : (
          <span>API key account</span>
        )}
      </div>
      <div className="w-[150px] shrink-0">{u.latest?.daily ? <div className="flex flex-col"><Bar pct={u.latest.daily.pct} /><span className="text-[11px] text-muted">daily limit</span></div> : <Bar pct={u.latest?.fiveHour?.pct} />}</div>
      <div className="w-[150px] shrink-0"><Bar pct={u.latest?.sevenDay?.pct} /></div>
      <span className="w-[70px] shrink-0 text-sm tabular-nums text-body">{resetIn((u.latest?.daily ?? u.latest?.fiveHour)?.resetsAt)}</span>
      <div className="flex w-[110px] shrink-0 items-center justify-between">
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${pill.cls}`}>{pill.label}</span>
        <button onClick={onRemove} aria-label={`Remove ${a.name}`} className="cursor-pointer rounded px-1 text-muted opacity-0 hover:text-fail group-hover:opacity-100">×</button>
      </div>
    </div>
  );
}

export function App() {
  const [board, setBoard] = useState<Board | null>(null);
  const [connected, setConnected] = useState(false);
  const [adding, setAdding] = useState(false);
  const [starting, setStarting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => subscribe(setBoard, setConnected), []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t); }, [toast]);

  const accounts = board?.accounts ?? [];
  const suggestion = board?.suggestions[0];
  const forecast = useMemo(
    () => accounts.filter((a) => a.usage.runsOutInMinutes !== null).sort((x, y) => x.usage.runsOutInMinutes! - y.usage.runsOutInMinutes!)[0],
    [accounts],
  );
  const runs = board?.runs ?? [];
  const activeRuns = runs.filter((r) => r.status === "active");
  const suggestedRun = suggestion && activeRuns.find((r) => r.profileId === suggestion.fromId);
  const nameOf = (id: string) => accounts.find((a) => a.id === id)?.name ?? "Removed account";
  const providerOf = (id: string): Provider => accounts.find((a) => a.id === id)?.provider ?? "api";

  const handOff = async (run: Run, toId: string, reason?: string) => {
    try { await api.handOff(run.id, toId, reason); setToast(`Handed off to ${nameOf(toId)}. Its CLI opened in the same worktree with HANDOFF.md.`); }
    catch (e) { setToast((e as Error).message); }
  };
  const act = async (fn: () => Promise<unknown>, ok: string) => { try { await fn(); setToast(ok); } catch (e) { setToast((e as Error).message); } };

  const withRoom = accounts.filter((a) => a.usage.state === "room").length;

  const login = async (a: Account) => {
    try { const r = await api.openLogin(a.id); setToast(`Opened a terminal running "${r.command}" for ${a.name}`); }
    catch (e) { setToast((e as Error).message); }
  };
  const remove = async (a: Account) => {
    try { await api.removeProfile(a.id); setToast(`Removed ${a.name}. Its folder stays on disk.`); }
    catch (e) { setToast((e as Error).message); }
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar count={accounts.length} connected={connected} />
      <main className="flex flex-1 flex-col">
        <header className="flex h-[52px] items-center justify-between border-b border-line px-7">
          <span className="text-sm text-body">Shift board</span>
          <div className="flex gap-2">
            <button onClick={() => setAdding(true)} className="cursor-pointer rounded-lg border border-line px-3.5 py-2 text-sm font-bold hover:bg-surface">Add account</button>
            <button onClick={() => setStarting(true)} disabled={accounts.length === 0} className="cursor-pointer rounded-lg bg-cta px-3.5 py-2 text-sm font-bold text-on-cta hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">Start a run</button>
          </div>
        </header>

        <div className="flex flex-col gap-5 px-7 py-6">
          <div className="flex flex-col gap-1">
            <span className="text-sm text-body">{new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</span>
            <h1 className="text-[32px] font-bold tracking-[-0.03em]">
              {accounts.length === 0 ? "Hire your first worker." : `${accounts.length} on the crew. ${withRoom} with room.`}
            </h1>
          </div>

          {suggestion && (
            <div className="flex items-center gap-6 rounded-[14px] border border-action-line bg-action-soft px-6 py-5">
              <div className="flex flex-1 flex-col gap-1">
                <span className="text-[13px] font-bold text-action">Handoff suggested</span>
                <span className="text-[20px] font-bold tracking-[-0.02em]">Move work from {suggestion.from} to {suggestion.to}?</span>
                <span className="text-sm text-body">{suggestion.reason}</span>
              </div>
              {suggestedRun ? (
                <button onClick={() => handOff(suggestedRun, suggestion.toId, suggestion.reason)} className="shrink-0 cursor-pointer rounded-[10px] bg-action px-4 py-2.5 text-sm font-bold text-white hover:brightness-110">
                  Hand off to {suggestion.to}
                </button>
              ) : (
                <span className="max-w-[220px] text-[13px] text-body">{suggestion.from} has no active run. Start new work on {suggestion.to}.</span>
              )}
            </div>
          )}

          {accounts.length === 0 ? (
            <div className="flex items-center gap-8 overflow-hidden rounded-2xl bg-[#14161E] text-white">
              <img src="/welcome.png" alt="" className="h-[340px] w-[260px] object-cover" style={{ imageRendering: "pixelated" }} />
              <div className="flex flex-col gap-3 pr-10">
                <span className="text-[13px] font-bold text-[#FF8A5B]">NO ACCOUNTS YET</span>
                <span className="text-[28px] font-bold tracking-[-0.03em]">Your crew is waiting to be hired</span>
                <span className="max-w-[520px] text-[15px] leading-6 text-[#C9CCD6]">
                  Add a Claude Code, Codex or Gemini account. Each gets its own folder, and you sign in through the vendor's own login. Shiftwell never reads your tokens.
                </span>
                <button onClick={() => setAdding(true)} className="mt-2 w-fit cursor-pointer rounded-[10px] bg-shift px-5 py-3 text-[15px] font-bold hover:brightness-110">Add an account</button>
              </div>
            </div>
          ) : (
            <section className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between">
                <h2 className="text-lg font-bold">Accounts</h2>
                {forecast && <span className="text-sm font-bold text-warn">{forecast.name} runs out in about {forecast.usage.runsOutInMinutes} min</span>}
              </div>
              <div className="overflow-hidden rounded-xl border border-line">
                <div className="flex gap-4 border-b border-line bg-surface px-4 py-2.5 text-[13px] font-bold text-body">
                  <span className="w-[200px] shrink-0">Account</span>
                  <span className="flex-1">Status</span>
                  <span className="w-[150px] shrink-0">5-hour</span>
                  <span className="w-[150px] shrink-0">Weekly</span>
                  <span className="w-[70px] shrink-0">Resets</span>
                  <span className="w-[110px] shrink-0">State</span>
                </div>
                {accounts.map((a) => <AccountRow key={a.id} a={a} onLogin={() => login(a)} onRemove={() => remove(a)} />)}
              </div>
              <p className="text-[13px] text-muted">
                Limits come from each Claude Code status line after its first reply. Codex limits come from its own app-server every 3 min. Gemini requests are counted from its own local log against the daily limit.
              </p>
            </section>
          )}
          {runs.length > 0 && (
            <section className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between">
                <h2 className="text-lg font-bold">Runs</h2>
                <span className="text-sm text-body">{activeRuns.length} active</span>
              </div>
              <div className="rounded-xl border border-line">
                {runs.map((r) => (
                  <RunRow key={r.id} run={r} name={nameOf(r.profileId)} provider={providerOf(r.profileId)} accounts={accounts}
                    fromName={r.fromRunId ? nameOf(runs.find((x) => x.id === r.fromRunId)?.profileId ?? "") : undefined}
                    onOpen={() => act(() => api.openRun(r.id), `Opened ${nameOf(r.profileId)} in the run's worktree`)}
                    onFinish={() => act(() => api.finishRun(r.id), "Run marked done. The worktree and branch stay for you to merge.")}
                    onHandOff={(toId) => handOff(r, toId)} />
                ))}
              </div>
            </section>
          )}
        </div>
      </main>

      {adding && (
        <AddAccountDialog
          onClose={() => setAdding(false)}
          onCreate={async (input: { name: string; provider: Provider; plan?: string }) => {
            const p = await api.createProfile(input);
            setAdding(false);
            setToast(`${p.name} added. Next: sign in from its row.`);
          }}
        />
      )}

      {starting && (
        <StartRunDialog accounts={accounts} onClose={() => setStarting(false)}
          onStart={async (input) => { const r = await api.startRun(input); setStarting(false); setToast(`Run started on ${r.branch}. The CLI opened in its worktree.`); }} />
      )}

      {toast && (
        <div role="status" className="fixed bottom-6 right-6 rounded-xl bg-cta px-4 py-3 text-sm font-bold text-on-cta shadow-xl">{toast}</div>
      )}
    </div>
  );
}

const RUN_PILL: Record<Run["status"], { label: string; cls: string }> = {
  active: { label: "Active", cls: "bg-action-soft text-action" },
  "handed-off": { label: "Handed off", cls: "bg-surface text-body" },
  done: { label: "Done", cls: "bg-pass-soft text-pass" },
};

function ago(iso: string): string {
  const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  return m < 60 ? `${m} min ago` : m < 1440 ? `${Math.floor(m / 60)}h ago` : `${Math.floor(m / 1440)}d ago`;
}

function RunRow({ run, name, provider, fromName, accounts, onOpen, onFinish, onHandOff }: {
  run: Run; name: string; provider: Provider; fromName?: string; accounts: Account[];
  onOpen: () => void; onFinish: () => void; onHandOff: (toId: string) => void;
}) {
  const [picking, setPicking] = useState(false);
  const pill = RUN_PILL[run.status];
  const targets = accounts.filter((a) => a.id !== run.profileId && a.provider !== "api");
  useEffect(() => {
    if (!picking) return;
    const close = (e: KeyboardEvent) => { if (e.key === "Escape") setPicking(false); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [picking]);
  return (
    <div className="flex items-center gap-4 border-b border-row px-4 py-3 last:border-b-0">
      <CrewAvatar provider={provider} size={32} />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[15px] font-bold">{run.task}</span>
        <span className="truncate text-xs text-muted">
          {name}{fromName ? ` · picked up from ${fromName}` : ""} · {run.branch} · {ago(run.startedAt)}
        </span>
      </div>
      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${pill.cls}`}>{pill.label}</span>
      <div className="relative flex w-[230px] shrink-0 justify-end gap-1.5">
        {run.status === "active" && (
          <>
            <button onClick={onOpen} className="cursor-pointer rounded-lg border border-line px-2.5 py-1.5 text-[13px] font-bold hover:bg-surface">Open</button>
            <button onClick={() => setPicking((v) => !v)} disabled={targets.length === 0} aria-expanded={picking}
              className="cursor-pointer rounded-lg border border-line px-2.5 py-1.5 text-[13px] font-bold hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40">Hand off</button>
            <button onClick={onFinish} className="cursor-pointer rounded-lg border border-line px-2.5 py-1.5 text-[13px] font-bold hover:bg-surface">Done</button>
          </>
        )}
        {picking && (
          <div role="menu" className="absolute right-0 top-10 z-10 flex w-[240px] flex-col gap-0.5 rounded-xl border border-line bg-card p-1.5 shadow-xl">
            <span className="px-2 py-1 text-xs font-bold text-muted">Hand off to</span>
            {targets.map((a) => (
              <button role="menuitem" key={a.id} onClick={() => { setPicking(false); onHandOff(a.id); }}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-surface">
                <CrewAvatar provider={a.provider} size={24} state={a.usage.state} />
                <span className="flex-1 font-bold">{a.name}</span>
                <span className="text-xs text-muted">{STATE_PILL[a.usage.state].label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
