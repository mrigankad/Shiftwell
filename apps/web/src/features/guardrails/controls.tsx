import { useEffect, useId, useRef, useState } from "react";

/** Custom switch: a button with role="switch". Space and Enter toggle it. */
export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action disabled:cursor-not-allowed disabled:opacity-40 ${checked ? "bg-pass" : "bg-track"}`}>
      <span aria-hidden className={`absolute top-0.5 size-5 rounded-full bg-card shadow transition-all ${checked ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

/** Number stepper. Minus and plus buttons, plus Arrow keys, Home and End on the value itself. */
export function Stepper({ value, onChange, min, max, step = 1, label, suffix = "" }: {
  value: number; onChange: (v: number) => void; min: number; max: number; step?: number; label: string; suffix?: string;
}) {
  const set = (v: number) => onChange(Math.min(max, Math.max(min, v)));
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowUp" || e.key === "ArrowRight") { e.preventDefault(); set(value + step); }
    else if (e.key === "ArrowDown" || e.key === "ArrowLeft") { e.preventDefault(); set(value - step); }
    else if (e.key === "Home") { e.preventDefault(); set(min); }
    else if (e.key === "End") { e.preventDefault(); set(max); }
  };
  const btn = "flex size-9 cursor-pointer items-center justify-center rounded-lg border border-line bg-card text-lg font-bold hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-action";
  return (
    <div role="group" aria-label={label} className="flex items-center gap-2">
      <button type="button" aria-label={`Lower ${label}`} disabled={value <= min} onClick={() => set(value - step)} className={btn}>
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M2 6h8" /></svg>
      </button>
      <div role="spinbutton" tabIndex={0} aria-label={label} aria-valuenow={value} aria-valuemin={min} aria-valuemax={max} aria-valuetext={`${value}${suffix}`} onKeyDown={onKey}
        className="flex h-9 min-w-16 items-center justify-center rounded-lg bg-surface px-3 text-[15px] font-bold tabular-nums focus-visible:outline-2 focus-visible:outline-action">
        {value}{suffix}
      </div>
      <button type="button" aria-label={`Raise ${label}`} disabled={value >= max} onClick={() => set(value + step)} className={btn}>
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M2 6h8M6 2v8" /></svg>
      </button>
    </div>
  );
}

const pad = (n: number) => String(n).padStart(2, "0");

/** One time of day as "HH:MM". Opens a small popover with an hour grid and a minute grid. */
export function TimeField({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const id = useId();
  const [h, m] = value.split(":").map(Number);
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const down = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    window.addEventListener("keydown", key);
    window.addEventListener("mousedown", down);
    return () => { window.removeEventListener("keydown", key); window.removeEventListener("mousedown", down); };
  }, [open]);
  const cell = (on: boolean) => `h-8 cursor-pointer rounded-md text-[13px] font-bold tabular-nums ${on ? "bg-cta text-on-cta" : "text-ink hover:bg-surface"}`;
  return (
    <div ref={box} className="relative">
      <button type="button" aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? id : undefined} aria-label={`${label}, ${value}`} onClick={() => setOpen((v) => !v)}
        className="flex h-9 min-w-20 cursor-pointer items-center justify-center rounded-lg border border-line bg-card px-3 text-[15px] font-bold tabular-nums hover:bg-surface focus-visible:outline-2 focus-visible:outline-action">
        {value}
      </button>
      {open && (
        <div id={id} role="dialog" aria-label={label} className="absolute left-0 top-11 z-20 flex w-[264px] flex-col gap-3 rounded-xl border border-line bg-card p-3 shadow-xl">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-bold text-muted">Hour</span>
            <div className="grid grid-cols-6 gap-1">
              {Array.from({ length: 24 }, (_, i) => (
                <button key={i} type="button" aria-pressed={i === h} onClick={() => onChange(`${pad(i)}:${pad(m)}`)} className={cell(i === h)}>{pad(i)}</button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-bold text-muted">Minute</span>
            <div className="grid grid-cols-6 gap-1">
              {Array.from({ length: 12 }, (_, i) => i * 5).map((i) => (
                <button key={i} type="button" aria-pressed={i === m} onClick={() => onChange(`${pad(h)}:${pad(i)}`)} className={cell(i === m)}>{pad(i)}</button>
              ))}
            </div>
          </div>
          <button type="button" onClick={() => setOpen(false)} className="cursor-pointer rounded-lg border border-line py-1.5 text-[13px] font-bold hover:bg-surface">Done</button>
        </div>
      )}
    </div>
  );
}

/** A start and an end time, shown as "from 22:00 to 07:00". */
export function TimeRange({ start, end, onChange, label }: { start: string; end: string; onChange: (v: { start: string; end: string }) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex items-center gap-2 text-sm text-body">
      <span>From</span>
      <TimeField label={`${label} start`} value={start} onChange={(v) => onChange({ start: v, end })} />
      <span>to</span>
      <TimeField label={`${label} end`} value={end} onChange={(v) => onChange({ start, end: v })} />
    </div>
  );
}
