import { useMemo } from "react";
import type { Account, Board } from "../api";
import { CrewAvatar } from "../crew";
import { ShiftFloor } from "../features/board/ShiftFloor";
import { Bar, STATE_PILL, resetIn, runList, type PageCtx } from "./shared";

function AccountRow({ a, onLogin, onRemove }: { a: Account; onLogin: () => void; onRemove: () => void }) {
  const u = a.usage;
  const pill = STATE_PILL[u.state];
  return (
    <div className="group grid grid-cols-2 items-center gap-x-4 gap-y-3 border-b border-row px-4 py-3.5 last:border-b-0 xl:flex">
      <div className="col-span-2 flex min-w-0 items-center gap-2.5 xl:w-[200px] xl:shrink-0">
        <CrewAvatar provider={a.provider} preset={a.api?.preset} state={u.state} />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[15px] font-bold">{a.name}</span>
          <span className="truncate text-xs text-muted">{a.plan || a.provider}</span>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold xl:hidden ${pill.cls}`}>{pill.label}</span>
        <button onClick={onRemove} aria-label={`Remove ${a.name}`} className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded text-muted hover:text-fail xl:hidden">×</button>
      </div>
      <div className="col-span-2 min-w-0 text-sm text-body xl:flex-1">
        {u.latest ? (
          <span>{u.stale ? `Last seen ${u.ageMinutes} min ago` : `Updated ${u.ageMinutes} min ago`}{u.latest.model ? ` · ${u.latest.model}` : ""}</span>
        ) : a.loginCommand ? (
          <button onClick={onLogin} className="min-h-9 max-w-full cursor-pointer break-words rounded-lg border border-line px-3 py-1.5 text-left text-[13px] font-bold text-ink hover:bg-surface">
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
      <div className="min-w-0 xl:w-[150px] xl:shrink-0">
        <span className="mb-1 block text-[11px] font-bold text-muted xl:hidden">{u.latest?.daily ? "Daily limit" : "5-hour"}</span>
        {u.latest?.daily ? <div className="flex flex-col"><Bar pct={u.latest.daily.pct} /><span className="hidden text-[11px] text-muted xl:block">daily limit</span></div> : <Bar pct={u.latest?.fiveHour?.pct} />}
      </div>
      <div className="min-w-0 xl:w-[150px] xl:shrink-0">
        <span className="mb-1 block text-[11px] font-bold text-muted xl:hidden">Weekly</span>
        <Bar pct={u.latest?.sevenDay?.pct} />
      </div>
      <span className="col-span-2 text-sm tabular-nums text-body xl:w-[70px] xl:shrink-0"><span className="text-xs text-muted xl:hidden">Resets in </span>{resetIn((u.latest?.daily ?? u.latest?.fiveHour)?.resetsAt)}</span>
      <div className="hidden w-[110px] shrink-0 items-center justify-between xl:flex">
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${pill.cls}`}>{pill.label}</span>
        <button onClick={onRemove} aria-label={`Remove ${a.name}`} className="cursor-pointer rounded px-1 text-muted opacity-0 hover:text-fail focus:opacity-100 group-hover:opacity-100">×</button>
      </div>
    </div>
  );
}

export function BoardPage({ ctx, board }: { ctx: PageCtx; board: Board | null }) {
  const { accounts, runs } = ctx;
  const suggestion = board?.suggestions[0];
  const forecast = useMemo(
    () => accounts.filter((a) => a.usage.runsOutInMinutes !== null).sort((x, y) => x.usage.runsOutInMinutes! - y.usage.runsOutInMinutes!)[0],
    [accounts],
  );
  const activeRuns = runs.filter((r) => r.status === "active");
  const suggestedRun = suggestion && activeRuns.find((r) => r.profileId === suggestion.fromId);
  const withRoom = accounts.filter((a) => a.usage.state === "room").length;

  return (
    <div className="flex flex-col gap-5 px-4 py-5 sm:px-7 sm:py-6">
      <div className="flex flex-col gap-1">
        <span className="text-sm text-body">{new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</span>
        <h1 className="text-[26px] font-bold tracking-[-0.03em] sm:text-[32px]">
          {accounts.length === 0 ? "Hire your first worker." : `${accounts.length} on the crew. ${withRoom} with room.`}
        </h1>
      </div>

      {accounts.length > 0 && (
        <ShiftFloor accounts={accounts} runs={runs} suggestion={suggestion} canHandOff={!!suggestedRun}
          onHandOff={() => suggestedRun && suggestion && ctx.handOff(suggestedRun, suggestion.toId, suggestion.reason)}
          onStart={ctx.startRun} />
      )}

      {accounts.length === 0 ? (
        <div className="flex flex-col overflow-hidden rounded-2xl bg-[#14161E] text-white md:flex-row md:items-center md:gap-8">
          <img src="/welcome.png" alt="" className="h-[220px] w-full object-cover md:h-[340px] md:w-[260px] md:shrink-0" style={{ imageRendering: "pixelated" }} />
          <div className="flex flex-col gap-3 p-5 md:py-0 md:pl-0 md:pr-10">
            <span className="text-[13px] font-bold text-[#FF8A5B]">NO ACCOUNTS YET</span>
            <span className="text-[22px] font-bold tracking-[-0.03em] sm:text-[28px]">Your crew is waiting to be hired</span>
            <span className="max-w-[520px] text-[15px] leading-6 text-[#C9CCD6]">
              Add a Claude Code, Codex or Gemini account. Each gets its own folder, and you sign in through the vendor's own login. Shiftwell never reads your tokens.
            </span>
            <button onClick={ctx.addAccount} className="mt-2 min-h-10 w-fit cursor-pointer rounded-[10px] bg-shift px-5 py-3 text-[15px] font-bold hover:brightness-110">Add an account</button>
          </div>
        </div>
      ) : (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 className="text-lg font-bold">Accounts</h2>
            {forecast && <span className="text-sm font-bold text-warn">{forecast.name} runs out in about {forecast.usage.runsOutInMinutes} min</span>}
          </div>
          <div className="overflow-hidden rounded-xl border border-line">
            <div className="hidden gap-4 border-b border-line bg-surface px-4 py-2.5 text-[13px] font-bold text-body xl:flex">
              <span className="w-[200px] shrink-0">Account</span>
              <span className="flex-1">Status</span>
              <span className="w-[150px] shrink-0">5-hour</span>
              <span className="w-[150px] shrink-0">Weekly</span>
              <span className="w-[70px] shrink-0">Resets</span>
              <span className="w-[110px] shrink-0">State</span>
            </div>
            {accounts.map((a) => <AccountRow key={a.id} a={a} onLogin={() => ctx.login(a)} onRemove={() => ctx.remove(a)} />)}
          </div>
          <p className="text-[13px] text-muted">
            Limits come from each Claude Code status line after its first reply. Codex limits come from its own app-server every 3 min. Gemini requests are counted from its own local log against the daily limit.
          </p>
        </section>
      )}

      {runs.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 className="text-lg font-bold">Runs</h2>
            <span className="text-sm text-body">
              {activeRuns.length} active
              {runs.length > activeRuns.length && (
                <>
                  {" · "}
                  <button onClick={() => ctx.go("runs")} className="cursor-pointer py-1 font-bold text-action hover:underline">See all runs</button>
                </>
              )}
            </span>
          </div>
          {activeRuns.length > 0
            ? runList(ctx, activeRuns)
            : <p className="rounded-xl border border-line bg-surface px-4 py-4 text-sm text-body">No active runs right now.</p>}
        </section>
      )}
    </div>
  );
}
