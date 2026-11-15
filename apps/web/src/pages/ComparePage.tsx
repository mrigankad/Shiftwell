import { useEffect, useState } from "react";
import { api, type RunGroup } from "../api";
import { CrewAvatar } from "../crew";
import { RUN_PILL, ago, type PageCtx } from "./shared";

export function ComparePage({ ctx, groupId }: { ctx: PageCtx; groupId: string }) {
  const [group, setGroup] = useState<RunGroup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  // Reload when the board changes (a run finished, for instance).
  const sig = ctx.runs.filter((r) => r.groupId === groupId).map((r) => `${r.id}${r.status}${r.worktreeRemoved ? 1 : 0}`).join(",");
  useEffect(() => {
    let live = true;
    api.group(groupId).then((g) => { if (live) { setGroup(g); setError(null); } }).catch((e: Error) => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [groupId, sig, tick]);

  return (
    <div className="flex flex-col gap-5 px-4 py-5 sm:px-7 sm:py-6">
      <div className="flex flex-col gap-2">
        <button onClick={() => { window.location.hash = "/runs"; }} className="min-h-9 w-fit cursor-pointer text-sm font-bold text-body hover:text-ink">Back to runs</button>
        <h1 className="text-[26px] font-bold tracking-[-0.03em] [overflow-wrap:anywhere] sm:text-[32px]">{group ? group.task : "Compare runs"}</h1>
        {group && <span className="text-sm text-body">{group.runs.length} accounts in parallel, each in its own worktree and branch</span>}
      </div>

      {error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-fail-soft px-4 py-3">
          <span className="text-sm font-bold text-fail">{error}</span>
          <button onClick={() => setTick((t) => t + 1)} className="min-h-9 cursor-pointer rounded-lg border border-line bg-card px-3 py-1.5 text-[13px] font-bold text-ink hover:bg-surface">Try again</button>
        </div>
      )}
      {!group && !error && <p role="status" className="text-sm text-body">Loading the runs...</p>}

      {group && (
        <div className={`grid grid-cols-1 gap-4 ${group.runs.length >= 3 ? "lg:grid-cols-3 md:grid-cols-2" : group.runs.length === 2 ? "md:grid-cols-2" : ""}`}>
          {group.runs.map((r) => {
            const live = ctx.runs.find((x) => x.id === r.id) ?? r;
            const pill = RUN_PILL[live.status];
            const ch = r.changes;
            return (
              <section key={r.id} className="flex min-w-0 flex-col gap-4 rounded-xl border border-line bg-card p-4">
                <div className="flex items-center gap-3">
                  <CrewAvatar provider={ctx.providerOf(r.profileId)} preset={ctx.presetOf(r.profileId)} size={36} />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[15px] font-bold">{ctx.nameOf(r.profileId)}</span>
                    <span className="truncate text-xs text-muted">{r.branch} · {ago(r.startedAt)}</span>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${pill.cls}`}>{pill.label}</span>
                </div>
                <div className="flex gap-6">
                  <Stat value={ch ? String(ch.commits) : "n/a"} label={ch?.commits === 1 ? "commit" : "commits"} />
                  <Stat value={ch ? String(ch.files) : "n/a"} label={ch?.files === 1 ? "file" : "files"} />
                </div>
                <div className="min-h-[96px] flex-1 overflow-x-auto rounded-lg bg-surface p-3">
                  {r.diffStat ? (
                    <pre className="whitespace-pre font-sans text-xs leading-5 text-body">{r.diffStat}</pre>
                  ) : (
                    <span className="text-xs text-muted">{live.worktreeRemoved ? "Folder removed, no diff to show." : "No changes yet."}</span>
                  )}
                </div>
                {live.worktreeRemoved && <span className="text-xs text-muted">folder removed</span>}
                {live.status === "active" && (
                  <div className="flex flex-wrap gap-1.5">
                    <button onClick={() => ctx.openRun(live)} className="min-h-9 cursor-pointer rounded-lg border border-line px-3 py-1.5 text-[13px] font-bold hover:bg-surface">Open</button>
                    <button onClick={() => ctx.finishRun(live)} className="min-h-9 cursor-pointer rounded-lg border border-line px-3 py-1.5 text-[13px] font-bold hover:bg-surface">Done</button>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[22px] font-bold tracking-[-0.02em] tabular-nums">{value}</span>
      <span className="text-xs text-muted">{label}</span>
    </div>
  );
}
