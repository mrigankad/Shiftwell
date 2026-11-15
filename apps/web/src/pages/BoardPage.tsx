import { memo, useMemo, type ReactNode } from "react";
import type { Account, Board } from "../api";
import { CrewAvatar } from "../crew";
import { ShiftFloor } from "../features/board/ShiftFloor";
import { PageHeader } from "../components/ui/PageHeader";
import { SectionHeader } from "../components/ui/Card";
import { agoMinutes, resetIn } from "../lib/time";
import { Bar, statePill, runList, type PageCtx } from "./shared";

const AccountRow = memo(function AccountRow({ a, now, onLogin, onRemove }: { a: Account; now: number; onLogin: () => void; onRemove: () => void }) {
  const u = a.usage;
  // Old readings are shown, but never as live: no green "Room", dimmed bars, no countdown.
  const stale = u.stale && !!u.latest;
  const pill = statePill(a);
  const reset = (u.latest?.daily ?? u.latest?.fiveHour)?.resetsAt;
  const resetText = stale ? "Unknown" : resetIn(reset, now);
  const age = u.ageMinutes === null ? "" : agoMinutes(u.ageMinutes);
  return (
    <div className="group grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-x-4 gap-y-3 border-b border-row px-4 py-3.5 last:border-b-0 xl:flex">
      <div className="col-span-2 flex min-w-0 items-center gap-2.5 xl:w-[170px] xl:shrink-0">
        <CrewAvatar provider={a.provider} preset={a.api?.preset} name={a.name} state={u.state} />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-ui font-bold">{a.name}</span>
          <span className="truncate text-xs text-muted">{a.plan || a.provider}</span>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold xl:hidden ${pill.cls}`}>{pill.label}</span>
        <button onClick={onRemove} aria-label={`Remove ${a.name}`} className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted hover:text-fail xl:hidden">×</button>
      </div>
      <div className="col-span-2 min-w-0 text-sm text-body [overflow-wrap:anywhere] xl:flex-1">
        {u.latest ? (
          <span>{stale ? `Last seen ${age}` : `Updated ${age}`}{u.latest.model ? ` · ${u.latest.model}` : ""}</span>
        ) : a.loginCommand ? (
          <button onClick={onLogin} className="min-h-9 max-w-full cursor-pointer rounded-control border border-line bg-card px-3 py-1.5 text-left text-meta font-bold text-ink [overflow-wrap:anywhere] hover:bg-surface">
            Sign in · {a.loginCommand}
          </button>
        ) : a.provider === "api" && a.keyPresent !== undefined ? (
          a.keyPresent ? (
            <span className="inline-flex items-center gap-2 font-bold text-pass"><span className="size-2 rounded-full bg-pass" />Key set</span>
          ) : (
            <span className="inline-flex items-center gap-2 font-bold text-warn"><span className="size-2 shrink-0 rounded-full bg-warn" />Key missing: set {a.api?.keyEnv}</span>
          )
        ) : (
          <span>API key account</span>
        )}
      </div>
      <div className={`min-w-0 xl:w-[130px] xl:shrink-0 ${stale ? "opacity-45" : ""}`}>
        <span className="mb-1 block text-2xs font-bold text-muted xl:hidden">{u.latest?.daily ? "Daily limit" : "5-hour"}</span>
        {u.latest?.daily ? <div className="flex flex-col"><Bar pct={u.latest.daily.pct} /><span className="hidden text-2xs text-muted xl:block">daily limit</span></div> : <Bar pct={u.latest?.fiveHour?.pct} />}
      </div>
      <div className={`min-w-0 xl:w-[130px] xl:shrink-0 ${stale ? "opacity-45" : ""}`}>
        <span className="mb-1 block text-2xs font-bold text-muted xl:hidden">Weekly</span>
        <Bar pct={u.latest?.sevenDay?.pct} />
      </div>
      <span className="col-span-2 text-sm tabular-nums text-body xl:w-[72px] xl:shrink-0"><span className="text-xs text-muted xl:hidden">Resets in </span>{resetText}</span>
      <div className="hidden w-[100px] shrink-0 items-center justify-between xl:flex">
        <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold ${pill.cls}`}>{pill.label}</span>
        <button onClick={onRemove} aria-label={`Remove ${a.name}`} className="cursor-pointer rounded px-1 text-muted opacity-0 hover:text-fail focus:opacity-100 group-hover:opacity-100">×</button>
      </div>
    </div>
  );
});

function Tile({ icon, tone, title, body }: { icon: ReactNode; tone: string; title: string; body: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-card bg-surface px-4 py-3.5">
      <span aria-hidden className={`flex size-9 shrink-0 items-center justify-center rounded-full ${tone}`}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{icon}</svg>
      </span>
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-bold">{title}</span>
        <span className="truncate text-meta text-body">{body}</span>
      </div>
    </div>
  );
}

const fmtClock = (sec: number, now: number) => {
  const d = new Date(sec * 1000);
  const t = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
  return d.toDateString() === new Date(now).toDateString() ? t : `${d.toLocaleDateString(undefined, { weekday: "short" })} ${t}`;
};

export function BoardPage({ ctx, board }: { ctx: PageCtx; board: Board | null }) {
  const { accounts, runs, now } = ctx;
  const suggestion = board?.suggestions[0];
  const forecast = useMemo(
    () => accounts.filter((a) => a.usage.runsOutInMinutes !== null && !a.usage.stale).sort((x, y) => x.usage.runsOutInMinutes! - y.usage.runsOutInMinutes!)[0],
    [accounts],
  );
  // Upcoming resets across the crew, soonest first: the design's right rail.
  const resets = useMemo(() => {
    const out: { key: string; at: number; name: string; what: string; soon: boolean }[] = [];
    for (const a of accounts) {
      const l = a.usage.latest;
      if (!l || a.usage.stale) continue;
      const five = l.daily ?? l.fiveHour;
      if (five?.resetsAt && five.resetsAt * 1000 > now) out.push({ key: `${a.id}-5`, at: five.resetsAt, name: a.name, what: l.daily ? "Daily limit resets" : "5-hour window resets", soon: true });
      if (l.sevenDay?.resetsAt && l.sevenDay.resetsAt * 1000 > now) out.push({ key: `${a.id}-7`, at: l.sevenDay.resetsAt, name: a.name, what: "Weekly limit resets", soon: false });
    }
    return out.sort((x, y) => x.at - y.at).slice(0, 4);
  }, [accounts, now]);
  const activeRuns = runs.filter((r) => r.status === "active");
  const suggestedRun = suggestion && activeRuns.find((r) => r.profileId === suggestion.fromId);
  const withRoom = accounts.filter((a) => a.usage.state === "room" && !a.usage.stale).length;
  const freshest = accounts.reduce<number | null>((m, a) => (a.usage.ageMinutes === null ? m : m === null ? a.usage.ageMinutes : Math.min(m, a.usage.ageMinutes)), null);
  const nextBack = accounts.filter((a) => a.usage.state === "out").map((a) => ({ a, at: (a.usage.latest?.daily ?? a.usage.latest?.fiveHour)?.resetsAt ?? 0 })).filter((x) => x.at * 1000 > now).sort((x, y) => x.at - y.at)[0];

  if (board === null) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader eyebrow={new Date(now).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })} title="Checking on the crew" />
        <div className="h-[220px] animate-pulse rounded-card bg-track sm:h-[300px]" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow={new Date(now).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
        title={accounts.length === 0 ? "Hire your first worker." : `${accounts.length} on the crew. ${withRoom} with room.`} />

      {accounts.length > 0 && (
        <ShiftFloor accounts={accounts} runs={runs} suggestion={suggestion} canHandOff={!!suggestedRun}
          onHandOff={() => suggestedRun && suggestion && ctx.handOff(suggestedRun, suggestion.toId, suggestion.reason)}
          onStart={ctx.startRun} />
      )}

      {accounts.length === 0 ? (
        <div className="flex flex-col overflow-hidden rounded-card bg-welcome text-welcome-ink md:flex-row md:items-center md:gap-8">
          <img src="/welcome.png" alt="" className="h-[220px] w-full object-cover md:h-[340px] md:w-[260px] md:shrink-0" style={{ imageRendering: "pixelated" }} />
          <div className="flex flex-col gap-3 p-5 md:py-0 md:pl-0 md:pr-10">
            <span className="text-meta font-bold tracking-[0.04em] text-welcome-accent">NO ACCOUNTS YET</span>
            <span className="text-h3 font-bold tracking-[-0.03em] sm:text-h2">Your crew is waiting to be hired</span>
            <span className="max-w-[520px] text-ui leading-6 text-welcome-body">
              Add a Claude Code, Codex or Gemini account. Each gets its own folder, and you sign in through the vendor's own login. Shiftwell never reads your tokens.
            </span>
            <button onClick={ctx.addAccount} className="mt-2 min-h-10 w-fit cursor-pointer rounded-control bg-shift px-5 py-3 text-ui font-bold text-welcome-ink hover:brightness-110">Add an account</button>
          </div>
        </div>
      ) : (
        <div className="grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_260px]">
          <section className="flex min-w-0 flex-col gap-3">
            <SectionHeader title="Accounts" aside={<button onClick={() => ctx.go("accounts")} className="cursor-pointer py-1 text-sm font-bold text-action hover:underline">All {accounts.length} accounts</button>} />
            <div className="overflow-hidden rounded-card border border-line bg-card">
              <div className="hidden gap-4 border-b border-line bg-surface px-4 py-2.5 text-meta font-bold text-body xl:flex">
                <span className="w-[170px] shrink-0">Account</span>
                <span className="min-w-0 flex-1">Status</span>
                <span className="w-[130px] shrink-0">5-hour</span>
                <span className="w-[130px] shrink-0">Weekly</span>
                <span className="w-[72px] shrink-0">Resets</span>
                <span className="w-[100px] shrink-0">State</span>
              </div>
              {accounts.map((a) => <AccountRow key={a.id} a={a} now={now} onLogin={() => ctx.login(a)} onRemove={() => ctx.remove(a)} />)}
            </div>
            <p className="text-meta leading-5 text-muted">
              Limits come from each Claude Code status line after its first reply. Codex limits come from its own app-server every 3 min. Gemini requests are counted from its own local log against the daily limit.
            </p>
          </section>
          <section aria-labelledby="resets-title" className="flex min-w-0 flex-col gap-3">
            <SectionHeader title={<span id="resets-title">Resets coming up</span>} aside={<button onClick={() => ctx.go("resets")} className="cursor-pointer py-1 text-sm font-bold text-action hover:underline">Calendar</button>} />
            <div className="flex flex-col gap-4 rounded-card border border-line bg-card p-4">
              {resets.length === 0 ? (
                <p className="text-sm leading-6 text-body">No resets known yet. They appear once each account has reported its limits.</p>
              ) : resets.map((r) => (
                <div key={r.key} className="flex gap-3">
                  <span aria-hidden className={`mt-1.5 size-2 shrink-0 rounded-full ${r.soon ? "bg-pass" : "bg-muted"}`} />
                  <div className="flex min-w-0 flex-col">
                    <span className="text-ui font-bold tabular-nums">{fmtClock(r.at, now)} · {r.name}</span>
                    <span className="text-meta text-body">{r.what}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {accounts.length > 0 && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Tile tone="bg-warn-soft text-warn" icon={<path d="M2.5 11.5 6 8l2.5 2.5 5-5M10 5.5h3.5V9" />}
            title={forecast ? `${forecast.name} runs out in about ${forecast.usage.runsOutInMinutes} min` : "Nobody is about to run out"}
            body={forecast ? "Estimate from its recent readings" : "Forecasts appear while an account is busy"} />
          <Tile tone="bg-pass-soft text-pass" icon={<><circle cx="8" cy="8" r="5.5" /><path d="M8 5v3l2 1.5" /></>}
            title={nextBack ? `${nextBack.a.name} is back in ${resetIn(nextBack.at, now)}` : "Nobody is out right now"}
            body={nextBack ? "Its window resets on its own" : "Every account has some room or is resting"} />
          <Tile tone="bg-track text-body" icon={<path d="M13 8a5 5 0 1 1-1.5-3.5M13 3v2.5h-2.5" />}
            title={freshest === null ? "Waiting for the first reading" : `Limits updated ${agoMinutes(freshest)}`}
            body="Read from each CLI's own status line" />
        </div>
      )}

      {runs.length > 0 && (
        <section className="flex flex-col gap-3">
          <SectionHeader title="Runs" aside={
            <span className="text-sm text-body">
              {activeRuns.length} active
              {runs.length > activeRuns.length && (
                <>
                  {" · "}
                  <button onClick={() => ctx.go("runs")} className="cursor-pointer py-1 font-bold text-action hover:underline">See all runs</button>
                </>
              )}
            </span>
          } />
          {activeRuns.length > 0
            ? runList(ctx, activeRuns)
            : <p className="rounded-card border border-line bg-surface px-4 py-4 text-sm text-body">No active runs right now.</p>}
        </section>
      )}
    </div>
  );
}
