import { useEffect, useId, useRef, useState } from "react";
import { api, type Account } from "../api";
import { CrewAvatar } from "../crew";
import { EmptyState, PageTitle, STATE_PILL, type PageCtx } from "./shared";

type Reading = NonNullable<Account["usage"]["latest"]>;
const pctOf = (r: Reading) => (r.daily ?? r.fiveHour)?.pct ?? null;

function UsageChart({ readings, label }: { readings: Reading[]; label: string }) {
  const gid = useId();
  // Draw at the real pixel width so the chart fills the card without stretching its labels.
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(560);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(200, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const pts = readings
    .map((r) => ({ t: Date.parse(r.at), v: pctOf(r) }))
    .filter((p): p is { t: number; v: number } => p.v !== null && !Number.isNaN(p.t))
    .sort((a, b) => a.t - b.t);
  if (pts.length === 0) return <div ref={box}><p className="rounded-lg bg-surface px-3 py-6 text-center text-sm text-muted">No readings yet</p></div>;

  const H = 120, L = 30, R = 8, T = 8, B = 18;
  const t0 = pts[0].t, t1 = pts[pts.length - 1].t;
  const x = (t: number) => (t1 === t0 ? L + (W - L - R) / 2 : L + ((t - t0) / (t1 - t0)) * (W - L - R));
  const y = (v: number) => T + (1 - Math.min(100, Math.max(0, v)) / 100) * (H - T - B);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)} ${y(p.v).toFixed(1)}`).join(" ");
  const area = `${line} L${x(t1).toFixed(1)} ${y(0)} L${x(t0).toFixed(1)} ${y(0)} Z`;
  const fmt = (t: number) => new Date(t).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  const last = pts[pts.length - 1];

  return (
    <div ref={box}>
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label} over time, latest ${Math.round(last.v)}%`} className="h-[120px] w-full text-action">
      <defs>
        <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity="0.22" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[0, 50, 100].map((g) => (
        <g key={g}>
          <line x1={L} x2={W - R} y1={y(g)} y2={y(g)} stroke="var(--color-row)" strokeWidth="1" />
          <text x={L - 6} y={y(g) + 3} textAnchor="end" fontSize="9" fill="var(--color-muted)">{g}%</text>
        </g>
      ))}
      <line x1={L} x2={W - R} y1={y(85)} y2={y(85)} stroke="var(--color-warn)" strokeWidth="1" strokeDasharray="4 3" />
      <text x={W - R} y={y(85) - 3} textAnchor="end" fontSize="9" fill="var(--color-warn)">85% limit</text>
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(last.t)} cy={y(last.v)} r="3" fill="currentColor" />
      <text x={L} y={H - 4} fontSize="9" fill="var(--color-muted)">{fmt(t0)}</text>
      {t1 !== t0 && <text x={W - R} y={H - 4} textAnchor="end" fontSize="9" fill="var(--color-muted)">{fmt(t1)}</text>}
    </svg>
    </div>
  );
}

function AccountCard({ a, ctx }: { a: Account; ctx: PageCtx }) {
  const [hist, setHist] = useState<Reading[] | null | "error">(null);
  const stamp = a.usage.latest?.at;
  useEffect(() => {
    let live = true;
    api.history(a.id).then((h) => { if (live) setHist(h); }).catch(() => { if (live) setHist("error"); });
    return () => { live = false; };
  }, [a.id, stamp]);
  const pill = STATE_PILL[a.usage.state];
  const label = a.provider === "gemini" ? "Daily usage" : "5-hour usage";
  const created = a.createdAt;
  const empty = "rounded-lg bg-surface px-3 py-6 text-center text-sm text-muted";

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-line bg-card p-5">
      <div className="flex items-center gap-3">
        <CrewAvatar provider={a.provider} size={40} state={a.usage.state} />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[17px] font-bold">{a.name}</span>
          <span className="text-xs text-muted">{a.plan || "No plan set"} · {a.provider}</span>
        </div>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${pill.cls}`}>{pill.label}</span>
      </div>

      <div className="flex flex-col gap-1 text-[13px]">
        <div className="flex gap-2"><span className="w-[88px] shrink-0 text-muted">Config folder</span><span className="min-w-0 select-text break-all text-body">{a.configDir}</span></div>
        {created && !Number.isNaN(Date.parse(created)) && (
          <div className="flex gap-2"><span className="w-[88px] shrink-0 text-muted">Created</span><span className="text-body">{new Date(created).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}</span></div>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-bold">{label}</span>
        {hist === null ? <p className={empty}>Loading history...</p>
          : hist === "error" ? <p className={empty}>No readings yet</p>
          : <UsageChart readings={hist} label={label} />}
      </div>

      <div className="flex justify-end gap-2">
        {a.loginCommand && (
          <button onClick={() => ctx.login(a)} className="cursor-pointer rounded-lg border border-line px-3 py-1.5 text-[13px] font-bold hover:bg-surface">Sign in</button>
        )}
        <button onClick={() => ctx.remove(a)} className="cursor-pointer rounded-lg border border-line px-3 py-1.5 text-[13px] font-bold text-fail hover:bg-fail-soft">Remove</button>
      </div>
    </div>
  );
}

export function AccountsPage({ ctx }: { ctx: PageCtx }) {
  const add = <button onClick={ctx.addAccount} className="cursor-pointer rounded-lg bg-cta px-3.5 py-2 text-sm font-bold text-on-cta hover:opacity-90">Add account</button>;
  return (
    <div className="flex flex-col gap-5 px-7 py-6">
      <PageTitle title="Accounts" eyebrow={`${ctx.accounts.length} on the crew`}>{add}</PageTitle>
      {ctx.accounts.length === 0 ? (
        <EmptyState title="No accounts yet" body="Add a Claude Code, Codex or Gemini account. Each gets its own folder, and you sign in through the vendor's own login. Shiftwell never reads your tokens." action={add} />
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {ctx.accounts.map((a) => <AccountCard key={a.id} a={a} ctx={ctx} />)}
        </div>
      )}
    </div>
  );
}
