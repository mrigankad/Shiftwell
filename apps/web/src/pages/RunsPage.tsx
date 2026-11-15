import { useState } from "react";
import type { Run } from "../api";
import { EmptyState, PageTitle, runRow, type PageCtx } from "./shared";

type Filter = "active" | "handed-off" | "done" | "all";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "active", label: "Active" },
  { id: "handed-off", label: "Handed off" },
  { id: "done", label: "Done" },
  { id: "all", label: "All" },
];

const EMPTY: Record<Filter, { title: string; body: string }> = {
  active: { title: "Nothing running", body: "Start a run to have one account work on a task in its own git worktree. Active runs show up here." },
  "handed-off": { title: "No handed off runs", body: "When an account runs low, hand its run to another account. The earlier run lands here." },
  done: { title: "No finished runs yet", body: "Mark a run done once you are happy with it. Its worktree and branch stay for you to merge." },
  all: { title: "No runs yet", body: "Start a run to have one account work on a task in its own git worktree." },
};

export function RunsPage({ ctx }: { ctx: PageCtx }) {
  const [filter, setFilter] = useState<Filter>("active");
  const count = (f: Filter) => (f === "all" ? ctx.runs.length : ctx.runs.filter((r: Run) => r.status === f).length);
  const shown = filter === "all" ? ctx.runs : ctx.runs.filter((r) => r.status === filter);
  const e = EMPTY[filter];
  return (
    <div className="flex flex-col gap-5 px-7 py-6">
      <PageTitle title="Runs" eyebrow={`${count("active")} active, ${ctx.runs.length} in total`}>
        <button onClick={ctx.prune} className="cursor-pointer rounded-lg border border-line px-3.5 py-2 text-sm font-bold hover:bg-surface">Clean up</button>
      </PageTitle>
      <div role="radiogroup" aria-label="Filter runs" className="flex w-fit gap-0.5 rounded-xl border border-line bg-surface p-1">
        {FILTERS.map((f) => {
          const on = filter === f.id;
          return (
            <button key={f.id} type="button" role="radio" aria-checked={on} onClick={() => setFilter(f.id)}
              className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-bold ${on ? "border border-line bg-card text-ink" : "border border-transparent text-nav hover:text-ink"}`}>
              {f.label}
              <span className="text-xs text-muted">{count(f.id)}</span>
            </button>
          );
        })}
      </div>
      {shown.length === 0 ? (
        <EmptyState title={e.title} body={e.body}
          action={filter === "active" || filter === "all" ? (
            <button onClick={ctx.startRun} disabled={ctx.accounts.length === 0} className="cursor-pointer rounded-lg bg-cta px-3.5 py-2 text-sm font-bold text-on-cta hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">Start a run</button>
          ) : undefined} />
      ) : (
        <div className="rounded-xl border border-line">
          {blocks(shown).map((b) => b.groupId ? (
            <div key={b.groupId} className="border-b border-row last:border-b-0">
              <div className="flex items-center gap-4 bg-surface px-4 py-2.5">
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[15px] font-bold">{b.runs[0].task}</span>
                  <span className="text-xs text-muted">{groupSize(ctx.runs, b.groupId)} accounts in parallel</span>
                </div>
                <button onClick={() => { window.location.hash = `/compare/${b.groupId}`; }} className="cursor-pointer rounded-lg border border-line bg-card px-2.5 py-1.5 text-[13px] font-bold hover:bg-page">Compare</button>
              </div>
              {b.runs.map((r) => runRow(ctx, r))}
            </div>
          ) : runRow(ctx, b.runs[0]))}
        </div>
      )}
    </div>
  );
}

const groupSize = (runs: Run[], id: string) => runs.filter((r) => r.groupId === id).length;

/** Keeps list order, folding runs that share a groupId into one block at the first one's position. */
function blocks(list: Run[]): { groupId?: string; runs: Run[] }[] {
  const out: { groupId?: string; runs: Run[] }[] = [];
  const seen = new Map<string, { groupId?: string; runs: Run[] }>();
  for (const r of list) {
    if (!r.groupId) { out.push({ runs: [r] }); continue; }
    const hit = seen.get(r.groupId);
    if (hit) hit.runs.push(r);
    else { const b = { groupId: r.groupId, runs: [r] }; seen.set(r.groupId, b); out.push(b); }
  }
  return out;
}
