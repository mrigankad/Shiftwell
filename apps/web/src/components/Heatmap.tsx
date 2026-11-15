import { useState } from "react";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;

/** Sequential ramp from theme tokens: track, then warn up to 85%, then fail up to 100%. */
export function heatColor(pct: number | null): string {
  if (pct === null) return "var(--color-surface)";
  const p = Math.min(100, Math.max(0, pct));
  if (p <= 85) return `color-mix(in srgb, var(--color-warn) ${Math.round((p / 85) * 100)}%, var(--color-track))`;
  const f = Math.round(((p - 85) / 15) * 100);
  return `color-mix(in srgb, var(--color-fail) ${f}%, var(--color-warn))`;
}

export function Legend() {
  const steps = [0, 25, 50, 75, 85, 100];
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
      <span className="inline-flex items-center gap-1.5"><span className="size-3.5 rounded-[4px] border border-line bg-surface" />No reading</span>
      <span className="pl-2">Peak usage</span>
      <span>0%</span>
      <div className="flex gap-0.5">{steps.map((s) => <span key={s} className="size-3.5 rounded-[4px]" style={{ background: heatColor(s) }} />)}</div>
      <span>100%</span>
    </div>
  );
}

export function Heatmap({ heat, label }: { heat: (number | null)[][]; label: string }) {
  const [tip, setTip] = useState<{ d: number; h: number; left: number; top: number } | null>(null);
  const [focus, setFocus] = useState({ d: 0, h: 0 });
  const at = (d: number, h: number) => heat[d]?.[h] ?? null;

  const show = (d: number, h: number, el: HTMLElement) => setTip({ d, h, left: el.offsetLeft + el.offsetWidth / 2, top: el.offsetTop });
  const onKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const dd = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
    const dh = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!dd && !dh) return;
    e.preventDefault();
    const d = Math.min(6, Math.max(0, focus.d + dd)), h = Math.min(23, Math.max(0, focus.h + dh));
    setFocus({ d, h });
    e.currentTarget.querySelector<HTMLElement>(`[data-cell="${d}-${h}"]`)?.focus();
  };
  const text = (d: number, h: number) => {
    const v = at(d, h);
    return v === null ? `${DAYS[d]} ${hh(h)}, no reading` : `${DAYS[d]} ${hh(h)}, peak ${Math.round(v)}%`;
  };

  return (
    <div role="grid" aria-label={label} onKeyDown={onKey} onMouseLeave={() => setTip(null)}
      className="relative grid gap-[3px]" style={{ gridTemplateColumns: "34px repeat(24, minmax(0, 1fr))" }}>
      {DAYS.map((day, d) => (
        <div key={day} role="row" className="contents">
          <span role="rowheader" className="flex items-center text-xs font-bold text-muted">{day}</span>
          {Array.from({ length: 24 }, (_, h) => (
            <div key={h} role="gridcell" data-cell={`${d}-${h}`} aria-label={text(d, h)} tabIndex={focus.d === d && focus.h === h ? 0 : -1}
              onMouseEnter={(e) => show(d, h, e.currentTarget)}
              onFocus={(e) => { setFocus({ d, h }); show(d, h, e.currentTarget); }}
              onBlur={() => setTip(null)}
              className="h-7 rounded-[5px] border border-line outline-none focus-visible:ring-2 focus-visible:ring-action"
              style={{ background: heatColor(at(d, h)) }} />
          ))}
        </div>
      ))}
      <span aria-hidden />
      {Array.from({ length: 24 }, (_, h) => (
        <span key={h} aria-hidden className="relative h-4 text-[11px] text-muted">
          {h % 3 === 0 && <span className="absolute left-0 whitespace-nowrap">{String(h).padStart(2, "0")}</span>}
        </span>
      ))}
      {tip && (
        <div role="tooltip" className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-cta px-2.5 py-1.5 text-xs font-bold text-on-cta shadow-xl"
          style={{ left: tip.left, top: tip.top - 6 }}>
          {text(tip.d, tip.h)}
        </div>
      )}
    </div>
  );
}
