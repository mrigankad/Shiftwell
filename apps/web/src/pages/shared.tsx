import type { ReactNode } from "react";
import { Button, buttonCls } from "../components/ui/Button";
import { Menu } from "../components/ui/Menu";
import { ago } from "../lib/time";
import type { Account, Provider, Run, State } from "../api";
import { CrewAvatar } from "../crew";

export const STATE_PILL: Record<State, { label: string; cls: string }> = {
  unknown: { label: "No data yet", cls: "bg-surface text-muted" },
  room: { label: "Room", cls: "bg-pass-soft text-pass" },
  on: { label: "On shift", cls: "bg-action-soft text-action" },
  low: { label: "Low", cls: "bg-warn-soft text-warn" },
  out: { label: "Out", cls: "bg-fail-soft text-fail" },
};

/** The pill for an account. Old readings never show as live state. */
export function statePill(a: Account): { label: string; cls: string } {
  return a.usage.stale && a.usage.latest ? { label: "Stale", cls: "bg-surface text-muted" } : STATE_PILL[a.usage.state];
}

export const RUN_PILL: Record<Run["status"], { label: string; cls: string }> = {
  active: { label: "Active", cls: "bg-action-soft text-action" },
  "handed-off": { label: "Handed off", cls: "bg-surface text-body" },
  done: { label: "Done", cls: "bg-pass-soft text-pass" },
};

export { ago, resetIn } from "../lib/time";

export function Bar({ pct }: { pct: number | null | undefined }) {
  if (pct === null || pct === undefined) return <span className="text-sm text-muted">n/a</span>;
  const color = pct >= 100 ? "bg-fail" : pct >= 85 ? "bg-warn" : "bg-ink";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 min-w-0 max-w-[180px] flex-1 rounded-full bg-track">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <span className="w-10 text-meta font-bold tabular-nums">{Math.round(pct)}%</span>
    </div>
  );
}

/** Everything a page needs from the app shell. */
export interface PageCtx {
  /** Shared clock from the shell, so relative times re-render together. */
  now: number;
  accounts: Account[];
  runs: Run[];
  nameOf: (id: string) => string;
  providerOf: (id: string) => Provider;
  presetOf: (id: string) => string | undefined;
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
    <RunRow key={r.id} run={r} name={ctx.nameOf(r.profileId)} provider={ctx.providerOf(r.profileId)} preset={ctx.presetOf(r.profileId)} accounts={ctx.accounts}
      fromName={r.fromRunId ? ctx.nameOf(ctx.runs.find((x) => x.id === r.fromRunId)?.profileId ?? "") : undefined}
      onOpen={() => ctx.openRun(r)} onFinish={() => ctx.finishRun(r)} onHandOff={(toId) => ctx.handOff(r, toId)} />
  );
}

export function runList(ctx: PageCtx, list: Run[]): ReactNode {
  return <div className="rounded-card border border-line bg-card">{list.map((r) => runRow(ctx, r))}</div>;
}

/** Kept as an alias so older imports keep working; new code imports PageHeader from components/ui. */
export { PageHeader as PageTitle } from "../components/ui/PageHeader";
export { EmptyState } from "../components/states";

export function RunRow({ run, name, provider, preset, fromName, accounts, onOpen, onFinish, onHandOff }: {
  run: Run; name: string; provider: Provider; preset?: string; fromName?: string; accounts: Account[];
  onOpen: () => void; onFinish: () => void; onHandOff: (toId: string) => void;
}) {
  const pill = RUN_PILL[run.status];
  const targets = accounts.filter((a) => a.id !== run.profileId);
  const ch = run.changes;
  const changeText = ch ? ` · ${ch.commits} ${ch.commits === 1 ? "commit" : "commits"}, ${ch.files} ${ch.files === 1 ? "file" : "files"}` : "";
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5 border-b border-row px-4 py-3 last:border-b-0 md:flex-nowrap">
      <CrewAvatar provider={provider} preset={preset} size={32} name={name} />
      <div className="flex min-w-0 flex-1 basis-[180px] flex-col">
        <a href={`#/live/${run.id}`} title="Open live view" className="block min-h-6 line-clamp-2 leading-6 md:line-clamp-1 text-ui font-bold hover:underline">{run.task}</a>
        <span className="text-xs text-muted [overflow-wrap:anywhere] md:truncate">
          {name}{fromName ? ` · picked up from ${fromName}` : ""} · {run.branch} · {ago(run.startedAt)}{changeText}{run.worktreeRemoved ? " · folder removed" : ""}
        </span>
      </div>
      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${pill.cls}`}>{pill.label}</span>
      <div className="flex w-full flex-wrap gap-1.5 md:w-auto md:shrink-0 md:justify-end lg:w-[290px]">
        {run.status === "active" && (
          <>
            <a href={`#/live/${run.id}`} className={buttonCls("secondary", "sm")}>Live</a>
            <Button size="sm" onClick={onOpen}>Open</Button>
            <Menu label="Hand off" heading="Hand off to" disabled={targets.length === 0}
              items={targets.map((a) => ({
                key: a.id, onSelect: () => onHandOff(a.id),
                label: (
                  <>
                    <CrewAvatar provider={a.provider} preset={a.api?.preset} size={24} state={a.usage.state} name={a.name} />
                    <span className="flex-1 font-bold">{a.name}</span>
                    <span className="text-xs text-muted">{STATE_PILL[a.usage.state].label}</span>
                  </>
                ),
              }))} />
            <Button size="sm" onClick={onFinish}>Done</Button>
          </>
        )}
      </div>
    </div>
  );
}
