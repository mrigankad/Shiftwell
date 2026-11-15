import { useEffect, useMemo, useState } from "react";
import { api, subscribe, type Account, type Board, type Provider, type State } from "./api";
import { CrewAvatar, Mark } from "./crew";
import { AddAccountDialog } from "./AddAccountDialog";

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
      <div className="h-1.5 w-24 rounded-full bg-[#EFEFF2]">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <span className="w-10 text-[13px] font-bold tabular-nums">{Math.round(pct)}%</span>
    </div>
  );
}

function Sidebar({ count, connected }: { count: number; connected: boolean }) {
  const item = (label: string, active = false, badge?: string | number) => (
    <div className={`flex items-center justify-between rounded-lg px-2.5 py-2 text-[15px] ${active ? "border border-line bg-white font-bold" : "text-[#3B3F48]"}`}>
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
      <div className="flex flex-col gap-1.5 rounded-[10px] border border-line bg-white p-3">
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
    <div className="group flex items-center gap-4 border-b border-[#F0F0F3] px-4 py-3 last:border-b-0">
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
      <div className="w-[150px] shrink-0"><Bar pct={u.latest?.fiveHour?.pct} /></div>
      <div className="w-[150px] shrink-0"><Bar pct={u.latest?.sevenDay?.pct} /></div>
      <span className="w-[70px] shrink-0 text-sm tabular-nums text-body">{resetIn(u.latest?.fiveHour?.resetsAt)}</span>
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
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => subscribe(setBoard, setConnected), []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t); }, [toast]);

  const accounts = board?.accounts ?? [];
  const suggestion = board?.suggestions[0];
  const forecast = useMemo(
    () => accounts.filter((a) => a.usage.runsOutInMinutes !== null).sort((x, y) => x.usage.runsOutInMinutes! - y.usage.runsOutInMinutes!)[0],
    [accounts],
  );
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
          <button onClick={() => setAdding(true)} className="cursor-pointer rounded-lg bg-ink px-3.5 py-2 text-sm font-bold text-white hover:bg-black">Add account</button>
        </header>

        <div className="flex flex-col gap-5 px-7 py-6">
          <div className="flex flex-col gap-1">
            <span className="text-sm text-body">{new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</span>
            <h1 className="text-[32px] font-bold tracking-[-0.03em]">
              {accounts.length === 0 ? "Hire your first worker." : `${accounts.length} on the crew. ${withRoom} with room.`}
            </h1>
          </div>

          {suggestion && (
            <div className="flex items-center gap-6 rounded-[14px] border border-[#F7D9C4] bg-action-soft px-6 py-5">
              <div className="flex flex-1 flex-col gap-1">
                <span className="text-[13px] font-bold text-action">Handoff suggested</span>
                <span className="text-[20px] font-bold tracking-[-0.02em]">Move work from {suggestion.from} to {suggestion.to}?</span>
                <span className="text-sm text-body">{suggestion.reason}</span>
              </div>
              <span className="rounded-lg border border-[#F7D9C4] bg-white px-3 py-2 text-[13px] font-bold text-body">Handoff notes arrive in v0.2</span>
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
                Limits come from each Claude Code status line after its first reply. Codex and Gemini readers arrive next.
              </p>
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

      {toast && (
        <div role="status" className="fixed bottom-6 right-6 rounded-xl bg-ink px-4 py-3 text-sm font-bold text-white shadow-xl">{toast}</div>
      )}
    </div>
  );
}
