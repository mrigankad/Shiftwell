import { useEffect, useState } from "react";
import { api, type Account, type CheckResult, type Run } from "../../api";
import { CrewAvatar } from "../../crew";
import { EmptyState, RUN_PILL, STATE_PILL, ago, type PageCtx } from "../../pages/shared";
import { UsageChart, type Reading } from "./UsageChart";
import { countdown, useNow } from "./useNow";

const card = "flex flex-col gap-3.5 rounded-2xl border border-line bg-card p-4 sm:p-5";
const h2 = "text-lg font-bold";
const btn = "min-h-9 cursor-pointer rounded-lg border border-line px-3 py-1.5 text-[13px] font-bold hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40";

function WindowTile({ label, win, now }: { label: string; win: { pct: number; resetsAt: number | null } | null | undefined; now: number }) {
  const pct = win?.pct;
  const tone = pct === undefined ? "bg-track" : pct >= 100 ? "bg-fail" : pct >= 85 ? "bg-warn" : "bg-ink";
  return (
    <div className="flex flex-col gap-1 border-b border-row py-3.5 first:pt-1 last:border-b-0 last:pb-1">
      <span className="text-[13px] text-body">{label}</span>
      {win ? (
        <>
          <span className="text-2xl font-bold tracking-[-0.02em] tabular-nums">{Math.round(win.pct)}%</span>
          <div role="progressbar" aria-label={`${label} used`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(win.pct)} className="h-1.5 rounded-full bg-track">
            <div className={`h-1.5 rounded-full ${tone}`} style={{ width: `${Math.min(100, win.pct)}%` }} />
          </div>
          <span className="text-xs font-bold tabular-nums text-body">
            {win.resetsAt ? `resets in ${countdown(win.resetsAt, now)}` : "reset time unknown"}
          </span>
        </>
      ) : <span className="text-sm text-muted">Not reported by this account</span>}
    </div>
  );
}

function ApiCard({ a }: { a: Account }) {
  const cfg = a.api;
  const [state, setState] = useState<"idle" | "busy" | CheckResult>("idle");
  if (!cfg) return null;
  const test = async () => {
    setState("busy");
    try { setState(await api.checkProfile(a.id)); } catch (e) { setState({ ok: false, error: (e as Error).message }); }
  };
  const row = (k: string, v: string) => (
    <div className="flex gap-2"><dt className="w-[96px] shrink-0 text-muted">{k}</dt><dd className="min-w-0 select-text break-all text-body">{v}</dd></div>
  );
  return (
    <section aria-labelledby="api-h" className={`${card} min-w-0`}>
      <h2 id="api-h" className={h2}>API account</h2>
      <dl className="flex flex-col gap-1 text-[13px]">
        {row("Preset", cfg.preset)}
        {row("Model", cfg.model)}
        {row("Base URL", cfg.baseUrl)}
        {row("Key variable", cfg.keyEnv)}
        <div className="flex gap-2">
          <dt className="w-[96px] shrink-0 text-muted">Key</dt>
          <dd>
            {a.keyPresent === undefined ? <span className="text-body">Unknown</span>
              : a.keyPresent ? <span className="inline-flex items-center gap-2 font-bold text-pass"><span className="size-2 rounded-full bg-pass" />Key set</span>
              : <span className="inline-flex items-center gap-2 font-bold text-warn"><span className="size-2 rounded-full bg-warn" />Key missing: set {cfg.keyEnv}</span>}
          </dd>
        </div>
      </dl>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={test} disabled={state === "busy"} className={`${btn} inline-flex items-center gap-2 disabled:cursor-wait`}>
          {state === "busy" && <span aria-hidden className="size-3.5 animate-spin rounded-full border-2 border-line border-t-action" />}
          {state === "busy" ? "Testing..." : "Test connection"}
        </button>
        <span role="status" className="text-[13px]">
          {state !== "idle" && state !== "busy" && (state.ok
            ? <span className="font-bold text-pass">Connected{typeof state.models === "number" ? `, ${state.models} ${state.models === 1 ? "model" : "models"}` : ""}</span>
            : <span className="font-bold text-fail">{state.error ?? "Could not connect"}</span>)}
        </span>
      </div>
    </section>
  );
}

function RunLine({ run, ctx }: { run: Run; ctx: PageCtx }) {
  const pill = RUN_PILL[run.status];
  const ch = run.changes;
  return (
    <li className="flex items-center gap-3 border-t border-row py-2.5 first:border-t-0">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[15px] font-bold">{run.task}</span>
        <span className="truncate text-xs text-muted">
          {run.branch} · {ago(run.startedAt)}{ch ? ` · ${ch.commits} ${ch.commits === 1 ? "commit" : "commits"}, ${ch.files} ${ch.files === 1 ? "file" : "files"}` : ""}
        </span>
      </div>
      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${pill.cls}`}>{pill.label}</span>
      {run.status === "active" && (
        <button type="button" onClick={() => ctx.openRun(run)} className={`${btn} shrink-0`}>Open</button>
      )}
    </li>
  );
}

export function WorkerDetailPage({ id, ctx }: { id: string; ctx: PageCtx }) {
  const now = useNow();
  const a = ctx.accounts.find((x) => x.id === id);
  const found = !!a;
  const stamp = a?.usage.latest?.at;
  const [hist, setHist] = useState<Reading[] | null | "error">(null);
  useEffect(() => {
    if (!found) return;
    let live = true;
    api.history(id).then((h) => { if (live) setHist(h); }).catch(() => { if (live) setHist("error"); });
    return () => { live = false; };
  }, [id, stamp, found]);

  const back = (
    <button type="button" onClick={() => ctx.go("accounts")} className="inline-flex w-fit cursor-pointer items-center gap-1.5 text-sm text-body hover:text-ink">
      <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
      Accounts
    </button>
  );

  if (!a) {
    // No accounts at all means the board has not arrived yet; otherwise the id is stale.
    const loading = ctx.accounts.length === 0;
    return (
      <div className="flex flex-col gap-5 px-4 py-6 sm:px-7">
        {back}
        {loading
          ? <p role="status" className="rounded-xl border border-line bg-surface px-6 py-12 text-center text-sm text-muted">Loading account...</p>
          : <EmptyState title="Account not found" body="This account was removed or the link is out of date. Pick one from the Accounts page." action={<button type="button" onClick={() => ctx.go("accounts")} className="cursor-pointer rounded-lg bg-cta px-3.5 py-2 text-sm font-bold text-on-cta hover:opacity-90">Back to accounts</button>} />}
      </div>
    );
  }

  const pill = STATE_PILL[a.usage.state];
  const latest = a.usage.latest;
  const mine = ctx.runs.filter((r) => r.profileId === a.id);
  const active = mine.filter((r) => r.status === "active");
  const recent = mine.filter((r) => r.status !== "active").sort((x, y) => Date.parse(y.startedAt) - Date.parse(x.startedAt)).slice(0, 8);
  const handedIn = mine.filter((r) => r.fromRunId).map((r) => ({ run: r, other: ctx.runs.find((x) => x.id === r.fromRunId) }));
  const handedOut = mine.filter((r) => r.status === "handed-off").map((r) => ({ run: r, other: ctx.runs.find((x) => x.fromRunId === r.id) }));
  const chartLabel = a.provider === "gemini" ? "Daily usage" : "5-hour usage";
  const created = a.createdAt && !Number.isNaN(Date.parse(a.createdAt)) ? new Date(a.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" }) : null;
  const empty = "rounded-lg bg-surface px-3 py-6 text-center text-sm text-muted";

  const handoffRow = (dir: "in" | "out", run: Run, other: Run | undefined) => {
    const otherName = other ? ctx.nameOf(other.profileId) : "another account";
    return (
      <li key={`${dir}-${run.id}`} className="flex items-center gap-3 border-t border-row py-2.5 first:border-t-0">
        {other && <CrewAvatar provider={ctx.providerOf(other.profileId)} preset={ctx.presetOf(other.profileId)} size={28} />}
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-bold">{run.task}</span>
          <span className="truncate text-xs text-muted">{dir === "in" ? `Picked up from ${otherName}` : `Handed to ${otherName}`} · {ago(run.startedAt)}</span>
        </div>
        <span className="shrink-0 rounded-full bg-surface px-2.5 py-0.5 text-xs font-bold text-body">{dir === "in" ? "In" : "Out"}</span>
      </li>
    );
  };

  return (
    <div className="flex flex-col gap-5 px-4 py-6 sm:px-7">
      {back}

      <section aria-label="Account summary" className="flex flex-wrap items-center gap-4 rounded-2xl bg-cta p-4 sm:gap-5 sm:p-5 text-on-cta">
        <CrewAvatar provider={a.provider} preset={a.api?.preset} size={96} state={a.usage.state} />
        <div className="flex min-w-[min(240px,100%)] flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-[26px] font-bold leading-9 tracking-[-0.03em] break-words sm:text-[30px]">{a.name}</h1>
            <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${pill.cls}`}>{pill.label}</span>
          </div>
          <p className="text-sm opacity-75">{a.plan || "No plan set"} · {a.provider}{created ? ` · added ${created}` : ""}</p>
          <p className="text-sm opacity-75">Config folder <span className="select-text break-all">{a.configDir}</span></p>
        </div>
        <div className="flex w-full flex-wrap gap-2.5 sm:w-auto">
          {a.loginCommand && (
            <button type="button" onClick={() => ctx.login(a)} className="cursor-pointer min-h-10 rounded-[9px] border border-on-cta/40 px-3.5 py-2.5 text-sm font-bold hover:bg-on-cta/10">Sign in</button>
          )}
          <button type="button" onClick={() => ctx.startRun()} className="cursor-pointer min-h-10 rounded-[9px] bg-action px-3.5 py-2.5 text-sm font-bold text-on-action hover:opacity-90">Start a run</button>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section aria-labelledby="hist-h" className={`${card} min-w-0`}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="hist-h" className={h2}>Usage history</h2>
            <span className="text-[13px] text-body">{chartLabel} over time</span>
          </div>
          {hist === null ? <p role="status" className={empty}>Loading history...</p>
            : hist === "error" ? <p className={empty}>History is not available right now</p>
            : <UsageChart readings={hist} label={chartLabel} />}
        </section>

        <section aria-labelledby="win-h" className="flex min-w-0 flex-col rounded-2xl border border-line bg-card p-4 sm:p-5">
          <h2 id="win-h" className="sr-only">Live windows</h2>
          <WindowTile label="5-hour window" win={latest?.fiveHour} now={now} />
          <WindowTile label="Weekly" win={latest?.sevenDay} now={now} />
          <WindowTile label="Daily" win={latest?.daily} now={now} />
        </section>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section aria-labelledby="runs-h" className={`${card} min-w-0`}>
          <h2 id="runs-h" className={h2}>Runs</h2>
          {mine.length === 0 ? <p className={empty}>No runs on this account yet</p> : (
            <>
              {active.length > 0 && (
                <div className="flex flex-col gap-1">
                  <h3 className="text-xs font-bold tracking-[0.06em] text-muted">ACTIVE</h3>
                  <ul>{active.map((r) => <RunLine key={r.id} run={r} ctx={ctx} />)}</ul>
                </div>
              )}
              {recent.length > 0 && (
                <div className="flex flex-col gap-1">
                  <h3 className="text-xs font-bold tracking-[0.06em] text-muted">RECENT</h3>
                  <ul>{recent.map((r) => <RunLine key={r.id} run={r} ctx={ctx} />)}</ul>
                </div>
              )}
            </>
          )}
        </section>

        <section aria-labelledby="ho-h" className={`${card} min-w-0`}>
          <h2 id="ho-h" className={h2}>Handoffs</h2>
          {handedIn.length + handedOut.length === 0 ? <p className={empty}>No handoffs in or out of this account</p> : (
            <ul>
              {handedIn.map(({ run, other }) => handoffRow("in", run, other))}
              {handedOut.map(({ run, other }) => handoffRow("out", run, other))}
            </ul>
          )}
        </section>
      </div>

      <ApiCard a={a} />

      <div className="flex justify-end">
        <button type="button" onClick={() => ctx.remove(a)} className={`${btn} text-fail hover:bg-fail-soft`}>Remove account</button>
      </div>
    </div>
  );
}
