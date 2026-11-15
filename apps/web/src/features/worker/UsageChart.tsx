import { useEffect, useId, useRef, useState } from "react";
import type { Account } from "../../api";

export type Reading = NonNullable<Account["usage"]["latest"]>;
export const pctOf = (r: Reading) => (r.daily ?? r.fiveHour)?.pct ?? null;

/** Usage history chart, same drawing as the Accounts page card. */
export function UsageChart({ readings, label }: { readings: Reading[]; label: string }) {
  const gid = useId();
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

  const H = 160, L = 32, R = 8, T = 8, B = 20;
  const t0 = pts[0].t, t1 = pts[pts.length - 1].t;
  const x = (t: number) => (t1 === t0 ? L + (W - L - R) / 2 : L + ((t - t0) / (t1 - t0)) * (W - L - R));
  const y = (v: number) => T + (1 - Math.min(100, Math.max(0, v)) / 100) * (H - T - B);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)} ${y(p.v).toFixed(1)}`).join(" ");
  const area = `${line} L${x(t1).toFixed(1)} ${y(0)} L${x(t0).toFixed(1)} ${y(0)} Z`;
  const fmt = (t: number) => new Date(t).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  const last = pts[pts.length - 1];

  return (
    <div ref={box}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label} over time, latest ${Math.round(last.v)}%`} className="h-[160px] w-full text-action">
        <defs>
          <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="currentColor" stopOpacity="0.22" />
            <stop offset="1" stopColor="currentColor" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0, 50, 100].map((g) => (
          <g key={g}>
            <line x1={L} x2={W - R} y1={y(g)} y2={y(g)} stroke="var(--color-row)" strokeWidth="1" />
            <text x={L - 6} y={y(g) + 3} textAnchor="end" fontSize="10" fill="var(--color-muted)">{g}%</text>
          </g>
        ))}
        <line x1={L} x2={W - R} y1={y(85)} y2={y(85)} stroke="var(--color-warn)" strokeWidth="1" strokeDasharray="4 3" />
        <text x={W - R} y={y(85) - 3} textAnchor="end" fontSize="10" fill="var(--color-warn)">85% limit</text>
        <path d={area} fill={`url(#${gid})`} />
        <path d={line} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={x(last.t)} cy={y(last.v)} r="3" fill="currentColor" />
        <text x={L} y={H - 4} fontSize="10" fill="var(--color-muted)">{fmt(t0)}</text>
        {t1 !== t0 && <text x={W - R} y={H - 4} textAnchor="end" fontSize="10" fill="var(--color-muted)">{fmt(t1)}</text>}
      </svg>
    </div>
  );
}
