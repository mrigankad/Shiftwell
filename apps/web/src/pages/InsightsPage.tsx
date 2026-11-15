import { useEffect, useMemo, useState } from "react";
import { api, type InsightAccount, type Insights } from "../api";
import { CrewAvatar } from "../crew";
import { Segmented } from "../ui";
import { Listbox } from "../components/Listbox";
import { Heatmap, Legend } from "../components/Heatmap";
import { Skeleton } from "../components/states";
import { EmptyState, PageTitle, type PageCtx } from "./shared";

const CREW = "__crew__";
const fmtPct = (v: number | null) => (v === null ? "n/a" : `${Math.round(v)}%`);
const fmtHours = (h: number) => `${Number.isInteger(h) ? h : h.toFixed(1)} h`;

function useInsights() {
  const [data, setData] = useState<Insights | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    api.insights()
      .then((d) => { if (live) { setData(d); setError(null); } })
      .catch((e: Error) => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [tick]);
  useEffect(() => { const t = setInterval(() => { if (!document.hidden) setTick((n) => n + 1); }, 60_000); return () => clearInterval(t); }, []);
  return { data, error, retry: () => setTick((n) => n + 1) };
}

function Tile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-[112px] flex-col gap-2 rounded-card border border-line bg-card p-4 sm:p-5">
      <span className="text-meta font-bold text-muted">{label}</span>
      {children}
    </div>
  );
}

type SortKey = "name" | "readings" | "peak" | "avg" | "hours";
const SORT_VAL: Record<SortKey, (a: InsightAccount) => string | number | null> = {
  name: (a) => a.name.toLowerCase(), readings: (a) => a.readingsLast7d, peak: (a) => a.peakLast7d,
  avg: (a) => a.avgDailyPeak, hours: (a) => a.hoursAtLimitLast7d,
};

function AccountTable({ accounts }: { accounts: InsightAccount[] }) {
  const [key, setKey] = useState<SortKey>("hours");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const rows = useMemo(() => {
    const f = SORT_VAL[key], m = dir === "asc" ? 1 : -1;
    return [...accounts].sort((a, b) => {
      const x = f(a), y = f(b);
      if (x === null && y === null) return 0;
      if (x === null) return 1;
      if (y === null) return -1;
      return (x < y ? -1 : x > y ? 1 : 0) * m;
    });
  }, [accounts, key, dir]);
  const head = (k: SortKey, text: string, right = true) => (
    <th scope="col" aria-sort={key === k ? (dir === "asc" ? "ascending" : "descending") : "none"} className={`px-4 py-2.5 ${right ? "text-right" : "text-left"}`}>
      <button type="button" onClick={() => { if (k === key) setDir(dir === "asc" ? "desc" : "asc"); else { setKey(k); setDir(k === "name" ? "asc" : "desc"); } }}
        className={`inline-flex min-h-7 cursor-pointer items-center gap-1 rounded-md text-meta font-bold hover:text-ink ${key === k ? "text-ink" : "text-muted"}`}>
        {text}
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: key === k ? 1 : 0.35, transform: key === k && dir === "asc" ? "rotate(180deg)" : undefined }}>
          <path d="M2 3.5l3 3 3-3" />
        </svg>
      </button>
    </th>
  );
  return (
    <>
    <ul role="list" aria-label="Per account usage" className="flex flex-col gap-3 md:hidden">
      {rows.map((a) => (
        <li key={a.id} className="flex flex-col gap-3 rounded-card border border-line bg-card p-4">
          <div className="flex items-center gap-2.5">
            <CrewAvatar provider={a.provider} preset={a.preset} accountId={a.id} size={28} />
            <span className="min-w-0 truncate font-bold">{a.name}</span>
          </div>
          <dl className="grid grid-cols-2 gap-3 text-meta">
            <div><dt className="text-muted">Readings</dt><dd className="font-bold tabular-nums">{a.readingsLast7d}</dd></div>
            <div><dt className="text-muted">Peak</dt><dd className="font-bold tabular-nums">{fmtPct(a.peakLast7d)}</dd></div>
            <div><dt className="text-muted">Avg daily peak</dt><dd className="font-bold tabular-nums">{fmtPct(a.avgDailyPeak)}</dd></div>
            <div><dt className="text-muted">Hours at limit</dt><dd className={`font-bold tabular-nums ${a.hoursAtLimitLast7d > 0 ? "text-fail" : ""}`}>{fmtHours(a.hoursAtLimitLast7d)}</dd></div>
          </dl>
        </li>
      ))}
    </ul>
    <div className="hidden overflow-x-auto rounded-card border border-line bg-card md:block">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-row bg-surface">
            {head("name", "Account", false)}{head("readings", "Readings")}{head("peak", "Peak")}{head("avg", "Avg daily peak")}{head("hours", "Hours at limit")}
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.id} className="border-b border-row last:border-b-0">
              <td className="px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <CrewAvatar provider={a.provider} preset={a.preset} accountId={a.id} size={28} />
                  <span className="font-bold">{a.name}</span>
                </div>
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-body">{a.readingsLast7d}</td>
              <td className="px-4 py-3 text-right tabular-nums text-body">{fmtPct(a.peakLast7d)}</td>
              <td className="px-4 py-3 text-right tabular-nums text-body">{fmtPct(a.avgDailyPeak)}</td>
              <td className={`px-4 py-3 text-right font-bold tabular-nums ${a.hoursAtLimitLast7d > 0 ? "text-fail" : "text-body"}`}>{fmtHours(a.hoursAtLimitLast7d)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </>
  );
}

export function InsightsPage(_: { ctx: PageCtx }) {
  const { data, error, retry } = useInsights();
  const [who, setWho] = useState(CREW);
  const accounts = data?.accounts ?? [];
  const selected = accounts.find((a) => a.id === who);
  const heat = useMemo(() => {
    if (selected) return selected.heat;
    return Array.from({ length: 7 }, (_, d) => Array.from({ length: 24 }, (_, h) => {
      let m: number | null = null;
      for (const a of accounts) { const v = a.heat[d]?.[h]; if (v !== null && v !== undefined && (m === null || v > m)) m = v; }
      return m;
    }));
  }, [accounts, selected]);

  const title = <PageTitle title="Insights" eyebrow="The last 7 days across the crew" />;
  if (!data) {
    return (
      <div className="flex flex-col gap-5">
        {title}
        {error ? (
          <EmptyState title="Could not load insights" body={error}
            action={<button onClick={retry} className="cursor-pointer rounded-lg border border-line px-3.5 py-2 text-sm font-bold hover:bg-surface">Try again</button>} />
        ) : (
          <Skeleton rows={4} label="Loading insights" />
        )}
      </div>
    );
  }
  if (accounts.length === 0 || accounts.every((a) => a.readingsLast7d === 0)) {
    return (
      <div className="flex flex-col gap-5">
        {title}
        <EmptyState title="No readings yet" body="Insights appear once the crew has a few usage readings. Keep the service running and check back after some work." />
      </div>
    );
  }

  const totalHours = accounts.reduce((s, a) => s + a.hoursAtLimitLast7d, 0);
  const best = data.bestNext ? accounts.find((a) => a.id === data.bestNext!.id) : undefined;
  const opts = [{ id: CREW, label: "Whole crew" }, ...accounts.map((a) => ({ id: a.id, label: a.name, icon: <CrewAvatar provider={a.provider} preset={a.preset} accountId={a.id} size={20} /> }))];
  const head = data.crewHeadroomNow;

  return (
    <div className="flex flex-col gap-5">
      {title}
      {error && <p role="alert" className="rounded-lg bg-fail-soft px-3 py-2 text-meta font-bold text-fail">Could not refresh: {error}. Showing the last data.</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Tile label="Crew headroom now">
          <span className="text-h1 font-bold leading-none tracking-[-0.03em]">{head === null ? "n/a" : `${Math.round(head)}%`}</span>
          <span className="text-meta text-body">{head === null ? "No live readings yet" : "of the crew's capacity is free"}</span>
        </Tile>
        <Tile label="Best next account">
          {data.bestNext ? (
            <div className="flex items-start gap-3">
              <CrewAvatar provider={best?.provider ?? "api"} preset={best?.preset} accountId={best?.id} size={40} />
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-title font-bold">{data.bestNext.name}</span>
                <span className="text-meta leading-[18px] text-body">{data.bestNext.reason}</span>
              </div>
            </div>
          ) : <span className="text-meta text-body">No clear pick right now</span>}
        </Tile>
        <Tile label="Hours at limit this week">
          <span className={`text-h1 font-bold leading-none tracking-[-0.03em] ${totalHours > 0 ? "text-fail" : ""}`}>{fmtHours(totalHours)}</span>
          <span className="text-meta text-body">added up across {accounts.length} {accounts.length === 1 ? "account" : "accounts"}</span>
        </Tile>
      </div>

      <section aria-labelledby="heat-h" className="flex min-w-0 flex-col gap-4 rounded-card border border-line bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <h2 id="heat-h" className="text-title font-bold">When you hit limits</h2>
            <span className="text-meta text-body">Highest usage seen in each hour of the week{selected ? ` for ${selected.name}` : ", across the crew"}.</span>
          </div>
          {accounts.length <= 3
            ? <Segmented label="Account" value={who} onChange={setWho} options={opts} />
            : <Listbox className="w-full sm:w-auto" label="Account" value={who} onChange={setWho} options={opts} />}
        </div>
        <Heatmap heat={heat} label={`Peak usage by weekday and hour, ${selected ? selected.name : "whole crew"}`} />
        <Legend />
      </section>

      <AccountTable accounts={accounts} />
    </div>
  );
}
