import { useMemo } from "react";
import type { Account, Board } from "../api";
import { CrewAvatar } from "../crew";
import { Bar, STATE_PILL, resetIn, runList, type PageCtx } from "./shared";

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
            <button onClick={() => ctx.handOff(suggestedRun, suggestion.toId, suggestion.reason)} className="shrink-0 cursor-pointer rounded-[10px] bg-action px-4 py-2.5 text-sm font-bold text-on-action hover:brightness-110">
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
            <button onClick={ctx.addAccount} className="mt-2 w-fit cursor-pointer rounded-[10px] bg-shift px-5 py-3 text-[15px] font-bold hover:brightness-110">Add an account</button>
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
            {accounts.map((a) => <AccountRow key={a.id} a={a} onLogin={() => ctx.login(a)} onRemove={() => ctx.remove(a)} />)}
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
            <span className="text-sm text-body">
              {activeRuns.length} active
              {runs.length > activeRuns.length && (
                <>
                  {" · "}
                  <button onClick={() => ctx.go("runs")} className="cursor-pointer font-bold text-action hover:underline">See all runs</button>
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
