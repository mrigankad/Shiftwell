import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { buttonCls } from "./Button";

export interface MenuItem { key: string; label: ReactNode; onSelect: () => void }

/**
 * Button that opens a menu. Focus moves to the first item, arrow keys, Home and End move between items,
 * Escape and outside clicks close it and focus returns to the trigger.
 */
export function Menu({ label, heading, items, disabled, align = "right", triggerClassName }: {
  label: ReactNode; heading?: string; items: MenuItem[]; disabled?: boolean; align?: "left" | "right"; triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  const itemsEls = () => Array.from(box.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []);
  const close = (refocus = true) => { setOpen(false); if (refocus) trigger.current?.focus(); };

  useEffect(() => {
    if (!open) return;
    itemsEls()[0]?.focus();
    const down = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    window.addEventListener("mousedown", down);
    return () => window.removeEventListener("mousedown", down);
  }, [open]);

  const onKey = (e: React.KeyboardEvent) => {
    const els = itemsEls();
    const i = els.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); els[(i + 1) % els.length]?.focus(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); els[(i - 1 + els.length) % els.length]?.focus(); }
    else if (e.key === "Home") { e.preventDefault(); els[0]?.focus(); }
    else if (e.key === "End") { e.preventDefault(); els[els.length - 1]?.focus(); }
    else if (e.key === "Tab") setOpen(false);
  };

  return (
    <div ref={box} className="relative" onKeyDown={open ? onKey : undefined}>
      <button ref={trigger} type="button" disabled={disabled} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined}
        onClick={() => setOpen((v) => !v)} className={triggerClassName ?? buttonCls("secondary", "sm")}>
        {label}
      </button>
      {open && (
        <div id={id} role="menu" aria-label={heading}
          className={`absolute top-11 z-20 flex w-[min(240px,calc(100vw-48px))] flex-col gap-0.5 rounded-card border border-line bg-card p-1.5 shadow-xl ${align === "right" ? "right-0" : "left-0"}`}>
          {heading && <span aria-hidden className="px-2 py-1 text-xs font-bold text-muted">{heading}</span>}
          {items.map((it) => (
            <button key={it.key} type="button" role="menuitem" tabIndex={-1} onClick={() => { close(); it.onSelect(); }}
              className="flex min-h-9 cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-surface focus:bg-surface focus-visible:outline-none">
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
