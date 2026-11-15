import { useEffect, useRef, type ReactNode } from "react";

/** Custom checkbox: a button with role="checkbox". Space and Enter toggle it. */
export function CheckBox({ checked, onChange, disabled, className = "" }: {
  checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; className?: string;
}) {
  return (
    <button type="button" role="checkbox" aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)}
      className={`flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-md border-2 disabled:cursor-not-allowed disabled:opacity-40 ${checked ? "border-action bg-action text-on-action" : "border-line bg-card"} ${className}`}>
      {checked && (
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2.5 6.5l2.5 2.5 4.5-5.5" />
        </svg>
      )}
    </button>
  );
}

/** Custom segmented toggle (radio group). Arrow keys move the selection. */
export function Segmented<T extends string>({ value, onChange, options, label }: {
  value: T; onChange: (v: T) => void; options: { id: T; label: string }[]; label: string;
}) {
  const onKey = (e: React.KeyboardEvent) => {
    const i = options.findIndex((o) => o.id === value);
    const d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    onChange(options[(i + d + options.length) % options.length].id);
  };
  return (
    <div role="radiogroup" aria-label={label} onKeyDown={onKey} className="grid auto-cols-fr grid-flow-col gap-0.5 rounded-card border border-line bg-surface p-1">
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button key={o.id} type="button" role="radio" aria-checked={on} tabIndex={on ? 0 : -1} onClick={() => onChange(o.id)}
            className={`min-h-9 cursor-pointer rounded-lg px-3 py-1.5 text-meta font-bold ${on ? "border border-line bg-card text-ink" : "border border-transparent text-nav hover:text-ink"}`}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Modal shell shared by small dialogs: backdrop, Escape to close, focus moves inside. */
export function Modal({ titleId, onClose, onSubmit, children, width = 480 }: {
  titleId: string; onClose: () => void; onSubmit: (e: React.FormEvent) => void; children: ReactNode; width?: number;
}) {
  const ref = useRef<HTMLFormElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const root = ref.current;
    (root?.querySelector<HTMLElement>("[data-autofocus]") ?? root)?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { closeRef.current(); return; }
      if (e.key !== "Tab" || !root) return;
      // Keep Tab inside the dialog.
      const f = Array.from(root.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'));
      if (f.length === 0) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      opener?.focus?.();
    };
  }, []);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6" onMouseDown={onClose}>
      <form ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId} onMouseDown={(e) => e.stopPropagation()} onSubmit={onSubmit}
        style={{ maxWidth: width }} className="flex max-h-[calc(100dvh-24px)] w-full flex-col gap-5 overflow-y-auto rounded-t-2xl bg-card p-5 shadow-2xl sm:max-h-[calc(100dvh-48px)] sm:rounded-card sm:p-6">
        {children}
      </form>
    </div>
  );
}
