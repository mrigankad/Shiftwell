import { useEffect, useMemo, useState } from "react";
import { api, type InsightAccount, type Insights } from "../api";
import { CrewAvatar } from "../crew";
import { Segmented } from "../ui";
import { Listbox } from "../components/Listbox";
import { Heatmap, Legend } from "../components/Heatmap";
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
  useEffect(() => { const t = setInterval(() => setTick((n) => n + 1), 60_000); return () => clearInterval(t); }, []);
  return { data, error, retry: () => setTick((n) => n + 1) };
}

function Tile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-[112px] flex-col gap-2 rounded-xl border border-line bg-card p-5">
      <span className="text-[13px] font-bold text-muted">{label}</span>
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
        className={`inline-flex cursor-pointer items-center gap-1 rounded-md text-[13px] font-bold hover:text-ink ${key === k ? "text-ink" : "text-muted"}`}>
        {text}
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: key === k ? 1 : 0.35, transform: key === k && dir === "asc" ? "rotate(180deg)" : undefined }}>
          <path d="M2 3.5l3 3 3-3" />
        </svg>
      </button>
    </th>
  );
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-card">
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
                  <CrewAvatar provider={a.provider} preset={a.preset} size={28} />
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
      <div className="flex flex-col gap-5 px-7 py-6">
        {title}
        {error ? (
          <EmptyState title="Could not load insights" body={error}
            action={<button onClick={retry} className="cursor-pointer rounded-lg border border-line px-3.5 py-2 text-sm font-bold hover:bg-surface">Try again</button>} />
        ) : (
          <div role="status" className="rounded-xl border border-line bg-surface px-6 py-12 text-center text-sm text-muted">Loading insights...</div>
        )}
      </div>
    );
  }
  if (accounts.length === 0 || accounts.every((a) => a.readingsLast7d === 0)) {
    return (
      <div className="flex flex-col gap-5 px-7 py-6">
        {title}
        <EmptyState title="No readings yet" body="Insights appear once the crew has a few usage readings. Keep the service running and check back after some work." />
      </div>
    );
  }

  const totalHours = accounts.reduce((s, a) => s + a.hoursAtLimitLast7d, 0);
  const best = data.bestNext ? accounts.find((a) => a.id === data.bestNext!.id) : undefined;
  const opts = [{ id: CREW, label: "Whole crew" }, ...accounts.map((a) => ({ id: a.id, label: a.name, icon: <CrewAvatar provider={a.provider} preset={a.preset} size={20} /> }))];
  const head = data.crewHeadroomNow;

  return (
    <div className="flex flex-col gap-5 px-7 py-6">
      {title}
      {error && <p role="alert" className="rounded-lg bg-fail-soft px-3 py-2 text-[13px] font-bold text-fail">Could not refresh: {error}. Showing the last data.</p>}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Tile label="Crew headroom now">
          <span className="text-[32px] font-bold leading-none tracking-[-0.03em]">{head === null ? "n/a" : `${Math.round(head)}%`}</span>
          <span className="text-[13px] text-body">{head === null ? "No live readings yet" : "of the crew's capacity is free"}</span>
        </Tile>
        <Tile label="Best next account">
          {data.bestNext ? (
            <div className="flex items-start gap-3">
              <CrewAvatar provider={best?.provider ?? "api"} preset={best?.preset} size={40} />
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-[17px] font-bold">{data.bestNext.name}</span>
                <span className="text-[13px] leading-[18px] text-body">{data.bestNext.reason}</span>
              </div>
            </div>
          ) : <span className="text-[13px] text-body">No clear pick right now</span>}
        </Tile>
        <Tile label="Hours at limit this week">
          <span className={`text-[32px] font-bold leading-none tracking-[-0.03em] ${totalHours > 0 ? "text-fail" : ""}`}>{fmtHours(totalHours)}</span>
          <span className="text-[13px] text-body">added up across {accounts.length} {accounts.length === 1 ? "account" : "accounts"}</span>
        </Tile>
      </div>

      <section aria-labelledby="heat-h" className="flex flex-col gap-4 rounded-xl border border-line bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <h2 id="heat-h" className="text-[17px] font-bold">When you hit limits</h2>
            <span className="text-[13px] text-body">Highest usage seen in each hour of the week{selected ? ` for ${selected.name}` : ", across the crew"}.</span>
          </div>
          {accounts.length <= 3
            ? <Segmented label="Account" value={who} onChange={setWho} options={opts} />
            : <Listbox label="Account" value={who} onChange={setWho} options={opts} />}
        </div>
        <Heatmap heat={heat} label={`Peak usage by weekday and hour, ${selected ? selected.name : "whole crew"}`} />
        <Legend />
      </section>

      <AccountTable accounts={accounts} />
    </div>
  );
}
