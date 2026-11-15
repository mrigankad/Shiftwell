import { useCallback, useEffect, useMemo, useState } from "react";
import { CrewAvatar } from "../../crew";
import { Listbox } from "../../components/Listbox";
import { EmptyState, ErrorState, Skeleton } from "../../components/states";
import { PageHeader } from "../../components/ui/PageHeader";
import { StatTile } from "../../components/ui/StatTile";
import { Button } from "../../components/ui/Button";
import { loadWeek, type WeekData } from "./client";
import { CURRENCIES, loadCosts, money, saveCosts, symbolOf, type CostMap, type Currency } from "./costStore";
import { NumberField } from "./NumberField";
import { buildWeek, DAYS, fmtHours, WEEKS_PER_MONTH, weekLabel, type AccountWeek } from "./metrics";

const barColor = (p: number) => (p >= 100 ? "bg-fail" : p >= 85 ? "bg-warn" : "bg-ink");

const verdict = (a: AccountWeek): { text: string; cls: string } =>
  a.hoursAtLimit > 0 || (a.avgDailyPeak ?? 0) >= 85 ? { text: "Runs hot", cls: "text-warn" }
  : a.avgDailyPeak !== null && a.avgDailyPeak < 30 ? { text: "Underused", cls: "text-action" }
  : a.avgDailyPeak === null ? { text: "No data", cls: "text-muted" } : { text: "Fine", cls: "text-muted" };

function csvFor(accounts: AccountWeek[], costs: CostMap): string {
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const rows = [["Account", "Plan", "Average daily peak %", "Hours at limit", "Agent hours", "Finished runs", "Monthly cost", "Currency"]];
  for (const a of accounts) {
    const c = costs[a.id];
    rows.push([a.name, a.plan ?? "", a.avgDailyPeak === null ? "" : String(Math.round(a.avgDailyPeak)), String(Math.round(a.hoursAtLimit * 10) / 10),
      String(Math.round(a.activeHours * 10) / 10), String(a.finishedRuns), c && c.amount > 0 ? String(c.amount) : "", c?.currency ?? ""]);
  }
  return rows.map((r) => r.map(esc).join(",")).join("\n");
}

/** Seven day bars for one account: the highest usage percent read on each weekday. */
function WeekBars({ a }: { a: AccountWeek }) {
  const today = (new Date().getDay() + 6) % 7;
  return (
    <ul role="list" aria-label={`${a.name} daily peak usage this week`} className="flex h-16 items-end gap-1.5">
      {a.peaks.map((p, i) => (
        <li key={i} className="flex h-full w-6 flex-col items-center justify-end gap-1" aria-label={`${DAYS[i]}: ${p === null ? "no reading" : `${Math.round(p)} percent`}`}>
          <div className="flex w-full flex-1 items-end rounded-md bg-track">
            {p !== null && <div className={`w-full rounded-md ${barColor(p)}`} style={{ height: `${Math.max(4, Math.min(100, p))}%` }} />}
          </div>
          <span className={`text-2xs ${i === today ? "font-bold text-ink" : "text-muted"}`}>{DAYS[i][0]}</span>
        </li>
      ))}
    </ul>
  );
}

function AccountRow({ a, cost, onCost }: { a: AccountWeek; cost: CostMap[string] | undefined; onCost: (amount: number | null, currency: Currency) => void }) {
  const currency = cost?.currency ?? "USD";
  const amount = cost && cost.amount > 0 ? cost.amount : null;
  const monthlyHours = a.activeHours * WEEKS_PER_MONTH;
  const monthlyRuns = a.finishedRuns * WEEKS_PER_MONTH;
  const perHour = amount !== null && monthlyHours > 0 ? amount / monthlyHours : null;
  const perRun = amount !== null && monthlyRuns > 0 ? amount / monthlyRuns : null;
  const avg = a.avgDailyPeak;
  return (
    <li className="grid min-w-0 grid-cols-1 gap-4 border-b border-row py-5 last:border-b-0 md:grid-cols-2 md:items-center md:gap-x-8 2xl:grid-cols-[minmax(0,1.1fr)_auto_minmax(0,1fr)_minmax(0,1.2fr)]">
      <div className="flex min-w-0 items-center gap-3">
        <CrewAvatar provider={a.provider} preset={a.preset} accountId={a.id} size={40} />
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-ui font-bold">{a.name}</span>
          <span className="truncate text-meta text-body">{a.plan || (a.provider === "api" ? "API key" : "No plan noted")}</span>
        </div>
      </div>
      <WeekBars a={a} />
      <dl className="grid grid-cols-3 gap-3 text-meta">
        <div>
          <dt className="text-muted">Utilisation</dt>
          <dd className="font-bold tabular-nums">{avg === null ? "No data" : `${Math.round(avg)}%`}</dd>
          {avg !== null && (
            <div className="mt-1 h-1.5 rounded-full bg-track" role="img" aria-label={`Average daily peak ${Math.round(avg)} percent`}>
              <div className={`h-1.5 rounded-full ${barColor(avg)}`} style={{ width: `${Math.min(100, avg)}%` }} />
            </div>
          )}
        </div>
        <div><dt className="text-muted">At limit</dt><dd className={`font-bold tabular-nums ${a.hoursAtLimit > 0 ? "text-warn" : ""}`}>{Math.round(a.hoursAtLimit * 10) / 10}h</dd></div>
        <div><dt className="text-muted">Agent time</dt><dd className="font-bold tabular-nums">{a.activeHours > 0 ? fmtHours(a.activeHours) : "None"}</dd></div>
      </dl>
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <NumberField label={`${a.name} monthly plan cost`} value={amount} prefix={symbolOf(currency)} step={currency === "INR" ? 100 : 5} className="min-w-0 flex-1 sm:w-[150px] sm:flex-none"
            onChange={(v) => onCost(v, currency)} />
          <div className="w-[88px] shrink-0" style={{ "--lb-min": "0px" } as React.CSSProperties}>
            <Listbox label={`${a.name} currency`} value={currency} onChange={(id) => onCost(amount, id as Currency)}
              options={CURRENCIES.map((c) => ({ id: c.id, label: c.id }))} />
          </div>
        </div>
        <p className="text-meta text-body" aria-live="polite">
          {amount === null ? "Enter your monthly cost to see estimates."
            : perHour === null && perRun === null ? "No runs this week to divide by yet."
            : <>
                {perHour !== null && <><span className="font-bold text-ink">{money(perHour, currency)}</span> per active hour</>}
                {perHour !== null && perRun !== null && ", "}
                {perRun !== null && <><span className="font-bold text-ink">{money(perRun, currency)}</span> per finished run</>}
              </>}
        </p>
      </div>
    </li>
  );
}

export function UsageCostPage() {
  const [data, setData] = useState<WeekData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [costs, setCosts] = useState<CostMap>(loadCosts);

  const load = useCallback(() => {
    loadWeek().then((d) => { setData(d); setError(null); }).catch((e: Error) => setError(e.message));
  }, []);
  useEffect(() => { load(); const id = window.setInterval(() => { if (!document.hidden) load(); }, 60000); return () => window.clearInterval(id); }, [load]);

  const setCost = (id: string, amount: number | null, currency: Currency) => {
    setCosts((prev) => {
      const next = { ...prev };
      if (amount === null && currency === "USD") delete next[id];
      else next[id] = { amount: amount ?? 0, currency };
      saveCosts(next);
      return next;
    });
  };

  const week = useMemo(() => (data ? buildWeek(data.insights, data.board) : null), [data]);

  const exportCsv = () => {
    if (!week) return;
    const url = URL.createObjectURL(new Blob([csvFor(week.accounts, costs)], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url; link.download = "shiftwell-usage.csv"; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  // The account with the most room this week, for the suggestion under Value per plan.
  const roomiest = useMemo(() => week?.accounts.filter((a) => a.avgDailyPeak !== null && a.hoursAtLimit === 0).sort((x, y) => x.avgDailyPeak! - y.avgDailyPeak!)[0], [week]);

  const totals = useMemo(() => {
    if (!week) return null;
    const avgs = week.accounts.map((a) => a.avgDailyPeak).filter((v): v is number => v !== null);
    return {
      avg: avgs.length ? avgs.reduce((s, v) => s + v, 0) / avgs.length : null,
      hours: week.accounts.reduce((s, a) => s + a.activeHours, 0),
      finished: week.accounts.reduce((s, a) => s + a.finishedRuns, 0),
      atLimit: week.accounts.reduce((s, a) => s + a.hoursAtLimit, 0),
    };
  }, [week]);

  const crewCost = useMemo(() => {
    if (!week || !totals) return [];
    const byCur = new Map<Currency, number>();
    for (const a of week.accounts) {
      const c = costs[a.id];
      if (c && c.amount > 0) byCur.set(c.currency, (byCur.get(c.currency) ?? 0) + c.amount);
    }
    return [...byCur.entries()].map(([cur, sum]) => ({
      cur, sum,
      perHour: totals.hours > 0 ? sum / (totals.hours * WEEKS_PER_MONTH) : null,
      perRun: totals.finished > 0 ? sum / (totals.finished * WEEKS_PER_MONTH) : null,
    }));
  }, [week, totals, costs]);

  // Crew load by weekday: mean of each account's daily peak.
  const crewDays = useMemo(() => DAYS.map((_, d) => {
    const v = (week?.accounts ?? []).map((a) => a.peaks[d]).filter((x): x is number => x !== null);
    return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
  }), [week]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow={week ? `Usage and cost · ${weekLabel(week.from, week.to)}` : "Usage and cost"} title="How hard is the crew working?">
        {week && week.accounts.length > 0 && <Button onClick={exportCsv}>Export CSV</Button>}
      </PageHeader>

      {error && <ErrorState title="Could not load usage" body={error} onRetry={load} />}
      {!data && !error && <Skeleton rows={4} label="Loading the week" />}
      {data && week && week.accounts.length === 0 && (
        <EmptyState title="No accounts yet" body="Add an account and Shiftwell starts reading usage. The week fills in as readings land." />
      )}

      {week && totals && week.accounts.length > 0 && (
        <>
          <section aria-label="Crew totals" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Average daily peak" value={totals.avg === null ? "No data" : `${Math.round(totals.avg)}%`} note="mean across accounts" />
            <StatTile label="Hours at limit" value={`${Math.round(totals.atLimit * 10) / 10}h`} note={totals.atLimit > 0 ? "worth routing around" : "never blocked"} tone={totals.atLimit > 0 ? "warn" : "pass"} />
            <StatTile label="Agent time this week" value={totals.hours > 0 ? fmtHours(totals.hours) : "None"} note={`${totals.finished} finished runs`} />
            <div className="flex flex-col gap-1 rounded-card border border-line bg-card px-5 py-4">
              <span className="text-meta text-body">Your plan cost per month</span>
              {crewCost.length === 0 ? (
                <><span className="text-3xl font-bold leading-9 tracking-[-0.03em]">Not set</span><span className="text-meta text-body">Enter costs under Accounts this week</span></>
              ) : (
                <>
                  {crewCost.map((c) => (
                    <span key={c.cur} className="text-3xl font-bold leading-9 tracking-[-0.03em] tabular-nums">{money(c.sum, c.cur)}</span>
                  ))}
                  <span className="text-meta text-body">your own figures</span>
                </>
              )}
            </div>
          </section>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
              <section aria-labelledby="day-h" className="flex flex-col rounded-card border border-line bg-card px-4 py-5 sm:px-6">
                <h2 id="day-h" className="text-lg font-bold tracking-[-0.02em]">Crew load by day</h2>
                <p className="text-meta text-body">Mean of each account's daily peak.</p>
                <ul role="list" className="mt-4 flex min-h-56 flex-1 items-end gap-2 sm:gap-4">
                  {crewDays.map((v, i) => (
                    <li key={i} aria-label={`${DAYS[i]}: ${v === null ? "no reading" : `${Math.round(v)} percent`}`} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                      <span className="text-2xs font-bold tabular-nums text-body">{v === null ? "" : Math.round(v)}</span>
                      <div className="flex w-full flex-1 items-end rounded-md bg-track">
                        {v !== null && <div className={`w-full rounded-md ${barColor(v)}`} style={{ height: `${Math.max(4, Math.min(100, v))}%` }} />}
                      </div>
                      <span className="text-xs text-muted">{DAYS[i]}</span>
                    </li>
                  ))}
                </ul>
              </section>
              <section aria-labelledby="value-h" className="flex flex-col gap-3 rounded-card border border-line bg-card px-4 py-5 sm:px-6">
                <h2 id="value-h" className="text-lg font-bold tracking-[-0.02em]">Value per plan</h2>
                <ul role="list" className="flex flex-col">
                  {week.accounts.map((a) => {
                    const v = verdict(a);
                    const c = costs[a.id];
                    return (
                      <li key={a.id} className="flex items-start justify-between gap-3 border-b border-row py-2.5 last:border-b-0">
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate text-ui font-bold">{a.name}</span>
                          <span className="truncate text-xs text-muted">{[a.plan, c && c.amount > 0 ? `${money(c.amount, c.currency)} a month` : null].filter(Boolean).join(" · ") || "No plan noted"}</span>
                        </div>
                        <div className="flex shrink-0 flex-col items-end">
                          <span className="text-ui font-bold tabular-nums">{a.avgDailyPeak === null ? "n/a" : `${Math.round(a.avgDailyPeak)}%`}</span>
                          <span className={`text-xs font-bold ${v.cls}`}>{v.text}</span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                {roomiest && week.accounts.length > 1 && (
                  <div className="rounded-xl bg-action-soft px-3.5 py-3">
                    <span className="text-meta font-bold text-action">Suggestion</span>
                    <p className="text-meta leading-5 text-body">Send queued tasks to {roomiest.name} first. It has the most room this week.</p>
                  </div>
                )}
              </section>
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            <section aria-labelledby="acc-h" className="rounded-card border border-line bg-card px-4 py-5 sm:px-6">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 id="acc-h" className="text-lg font-bold tracking-[-0.02em]">Accounts this week</h2>
                <span className="text-meta text-muted">Bars show the highest usage read each day</span>
              </div>
              <ul role="list" className="mt-2 flex flex-col">
                {week.accounts.map((a) => (
                  <AccountRow key={a.id} a={a} cost={costs[a.id]} onCost={(amt, cur) => setCost(a.id, amt, cur)} />
                ))}
              </ul>
            </section>
            <div className="flex flex-col gap-5">
              <section aria-labelledby="cost-h" className="rounded-card border border-line bg-card px-4 py-5 sm:px-6">
                <h2 id="cost-h" className="text-lg font-bold tracking-[-0.02em]">Crew cost estimate</h2>
                {crewCost.length === 0 ? (
                  <p className="mt-2 text-meta leading-5 text-body">Shiftwell does not know what you pay. Enter each plan's monthly cost and the crew total appears here.</p>
                ) : (
                  <ul role="list" className="mt-2 flex flex-col gap-3">
                    {crewCost.map((c) => (
                      <li key={c.cur} className="flex flex-col gap-0.5 text-sm">
                        <span className="font-bold">{money(c.sum, c.cur)} a month in {c.cur}</span>
                        <span className="text-body">{c.perHour === null ? "No agent time this week" : `${money(c.perHour, c.cur)} per active hour`}</span>
                        <span className="text-body">{c.perRun === null ? "No finished runs this week" : `${money(c.perRun, c.cur)} per finished run`}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-3 rounded-xl bg-surface px-3 py-2.5 text-xs leading-[18px] text-body">
                  Estimates from your own inputs. Monthly cost is spread over this week's agent hours and finished runs, scaled to a month. Currencies are never converted, and plans without a cost are left out.
                </p>
              </section>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
