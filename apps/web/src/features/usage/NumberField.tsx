import { useEffect, useState } from "react";

/** Custom numeric input: decimal text field with step buttons. No native spinner. */
export function NumberField({ value, onChange, label, prefix, step = 10, className = "" }: {
  value: number | null; onChange: (v: number | null) => void; label: string; prefix?: string; step?: number; className?: string;
}) {
  const [draft, setDraft] = useState(value === null ? "" : String(value));
  useEffect(() => { setDraft(value === null ? "" : String(value)); }, [value]);

  const commit = (s: string) => {
    setDraft(s);
    if (s.trim() === "") { onChange(null); return; }
    if (!/^\d*\.?\d{0,2}$/.test(s.trim())) return;
    const n = Number(s);
    if (Number.isFinite(n) && n >= 0) onChange(n);
  };
  const bump = (d: number) => {
    const n = Math.max(0, Math.round(((value ?? 0) + d) * 100) / 100);
    onChange(n);
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowUp") { e.preventDefault(); bump(step); }
    else if (e.key === "ArrowDown") { e.preventDefault(); bump(-step); }
  };
  const btn = "flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-nav hover:bg-card hover:text-ink";
  return (
    <div className={`flex items-center gap-1 rounded-card border border-line bg-surface px-1.5 focus-within:border-action ${className}`}>
      <button type="button" aria-label={`Decrease ${label}`} onClick={() => bump(-step)} className={btn}>
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M2.5 6h7" /></svg>
      </button>
      <div className="flex min-w-0 flex-1 items-center gap-1">
        {prefix && <span aria-hidden className="text-meta font-bold text-muted">{prefix}</span>}
        <input type="text" inputMode="decimal" aria-label={label} placeholder="0" value={draft} onChange={(e) => commit(e.target.value)} onKeyDown={onKey}
          className="w-full min-w-0 bg-transparent py-2 text-meta font-bold tabular-nums outline-none placeholder:text-muted" />
      </div>
      <button type="button" aria-label={`Increase ${label}`} onClick={() => bump(step)} className={btn}>
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M2.5 6h7M6 2.5v7" /></svg>
      </button>
    </div>
  );
}
