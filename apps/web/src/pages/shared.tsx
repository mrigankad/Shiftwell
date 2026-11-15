import { useEffect, useState, type ReactNode } from "react";
import type { Account, Provider, Run, State } from "../api";
import { CrewAvatar } from "../crew";

export const STATE_PILL: Record<State, { label: string; cls: string }> = {
  unknown: { label: "No data yet", cls: "bg-surface text-muted" },
  room: { label: "Room", cls: "bg-pass-soft text-pass" },
  on: { label: "On shift", cls: "bg-action-soft text-action" },
  low: { label: "Low", cls: "bg-warn-soft text-warn" },
  out: { label: "Out", cls: "bg-fail-soft text-fail" },
};

export const RUN_PILL: Record<Run["status"], { label: string; cls: string }> = {
  active: { label: "Active", cls: "bg-action-soft text-action" },
  "handed-off": { label: "Handed off", cls: "bg-surface text-body" },
  done: { label: "Done", cls: "bg-pass-soft text-pass" },
};

export function resetIn(resetsAt: number | null | undefined): string {
  if (!resetsAt) return "n/a";
  const min = Math.max(0, Math.round((resetsAt * 1000 - Date.now()) / 60000));
  return min >= 60 ? `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, "0")}m` : `${min}m`;
}

export function ago(iso: string): string {
  const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  return m < 60 ? `${m} min ago` : m < 1440 ? `${Math.floor(m / 60)}h ago` : `${Math.floor(m / 1440)}d ago`;
}

export function Bar({ pct }: { pct: number | null | undefined }) {
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

/** Everything a page needs from the app shell. */
export interface PageCtx {
  accounts: Account[];
  runs: Run[];
  nameOf: (id: string) => string;
  providerOf: (id: string) => Provider;
  handOff: (run: Run, toId: string, reason?: string) => void;
  openRun: (run: Run) => void;
  finishRun: (run: Run) => void;
  prune: () => void;
  login: (a: Account) => void;
  remove: (a: Account) => void;
  addAccount: () => void;
  startRun: () => void;
  go: (page: string) => void;
}

export function runRow(ctx: PageCtx, r: Run): ReactNode {
  return (
    <RunRow key={r.id} run={r} name={ctx.nameOf(r.profileId)} provider={ctx.providerOf(r.profileId)} accounts={ctx.accounts}
      fromName={r.fromRunId ? ctx.nameOf(ctx.runs.find((x) => x.id === r.fromRunId)?.profileId ?? "") : undefined}
      onOpen={() => ctx.openRun(r)} onFinish={() => ctx.finishRun(r)} onHandOff={(toId) => ctx.handOff(r, toId)} />
  );
}

export function runList(ctx: PageCtx, list: Run[]): ReactNode {
  return <div className="rounded-xl border border-line">{list.map((r) => runRow(ctx, r))}</div>;
}

export function PageTitle({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div className="flex flex-col gap-1">
        {eyebrow && <span className="text-sm text-body">{eyebrow}</span>}
        <h1 className="text-[32px] font-bold tracking-[-0.03em]">{title}</h1>
      </div>
      {children}
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-line bg-surface px-6 py-12 text-center">
      <span className="text-[17px] font-bold">{title}</span>
      <p className="max-w-[460px] text-sm leading-6 text-body">{body}</p>
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}

export function RunRow({ run, name, provider, fromName, accounts, onOpen, onFinish, onHandOff }: {
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
  const ch = run.changes;
  const changeText = ch ? ` · ${ch.commits} ${ch.commits === 1 ? "commit" : "commits"}, ${ch.files} ${ch.files === 1 ? "file" : "files"}` : "";
  return (
    <div className="flex items-center gap-4 border-b border-row px-4 py-3 last:border-b-0">
      <CrewAvatar provider={provider} size={32} />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[15px] font-bold">{run.task}</span>
        <span className="truncate text-xs text-muted">
          {name}{fromName ? ` · picked up from ${fromName}` : ""} · {run.branch} · {ago(run.startedAt)}{changeText}{run.worktreeRemoved ? " · folder removed" : ""}
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
