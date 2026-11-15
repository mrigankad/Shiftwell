import { useState } from "react";
import type { Run } from "../api";
import { EmptyState, PageTitle, runList, type PageCtx } from "./shared";

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
      <PageTitle title="Runs" eyebrow={`${count("active")} active, ${ctx.runs.length} in total`} />
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
      ) : runList(ctx, shown)}
    </div>
  );
}
