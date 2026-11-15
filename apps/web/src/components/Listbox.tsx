import { useEffect, useId, useRef, useState, type ReactNode } from "react";

export interface ListboxOption { id: string; label: string; icon?: ReactNode }

/** Custom accessible single-select listbox (button + popup). No native select. */
export function Listbox({ value, onChange, options, label }: {
  value: string; onChange: (id: string) => void; options: ListboxOption[]; label: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const uid = useId();
  const sel = Math.max(0, options.findIndex((o) => o.id === value));

  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    window.addEventListener("mousedown", down);
    return () => window.removeEventListener("mousedown", down);
  }, [open]);

  const show = () => { setActive(sel); setOpen(true); };
  const pick = (i: number) => { onChange(options[i].id); setOpen(false); btn.current?.focus(); };
  const onKey = (e: React.KeyboardEvent) => {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) { e.preventDefault(); show(); }
      return;
    }
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setOpen(false); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => (a + 1) % options.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (a - 1 + options.length) % options.length); }
    else if (e.key === "Home") { e.preventDefault(); setActive(0); }
    else if (e.key === "End") { e.preventDefault(); setActive(options.length - 1); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(active); }
    else if (e.key === "Tab") setOpen(false);
  };
  const cur = options[sel];
  return (
    <div ref={root} className="relative" onKeyDown={onKey}>
      <button ref={btn} type="button" role="combobox" aria-label={label} aria-haspopup="listbox" aria-expanded={open}
        aria-controls={`${uid}-list`} aria-activedescendant={open ? `${uid}-${active}` : undefined}
        onClick={() => (open ? setOpen(false) : show())}
        className="flex min-w-[200px] cursor-pointer items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-left text-[13px] font-bold hover:bg-card">
        {cur?.icon}
        <span className="flex-1 truncate">{cur?.label}</span>
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-muted"><path d="M3 4.5l3 3 3-3" /></svg>
      </button>
      {open && (
        <div id={`${uid}-list`} role="listbox" aria-label={label} className="absolute left-0 top-full z-10 mt-1 flex max-h-[280px] min-w-full flex-col gap-0.5 overflow-auto rounded-xl border border-line bg-card p-1.5 shadow-xl">
          {options.map((o, i) => (
            <div key={o.id} id={`${uid}-${i}`} role="option" aria-selected={o.id === value} onMouseEnter={() => setActive(i)} onClick={() => pick(i)}
              className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] ${i === active ? "bg-surface" : ""} ${o.id === value ? "font-bold" : ""}`}>
              {o.icon}
              <span className="flex-1 truncate">{o.label}</span>
              {o.id === value && <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-action"><path d="M2.5 6.5l2.5 2.5 4.5-5.5" /></svg>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
