import { useEffect, useRef } from "react";

export interface ShortcutGroup { title: string; items: { keys: string[]; label: string }[] }

/** The shortcuts the app really binds. Keep this in step with useShortcuts in App.tsx. */
export const SHORTCUTS: ShortcutGroup[] = [
  { title: "Anywhere", items: [
    { keys: ["Ctrl", "K"], label: "Open the command palette" },
    { keys: ["?"], label: "Show this list" },
    { keys: ["Esc"], label: "Close a dialog, menu or tooltip" },
  ] },
  { title: "Go to", items: [
    { keys: ["G", "B"], label: "Shift board" },
    { keys: ["G", "R"], label: "Runs" },
    { keys: ["G", "H"], label: "Handoffs" },
    { keys: ["G", "A"], label: "Accounts" },
    { keys: ["G", "I"], label: "Insights" },
  ] },
  { title: "Actions", items: [
    { keys: ["N"], label: "Start a run" },
    { keys: ["Shift", "A"], label: "Add an account" },
  ] },
];

const kbd = "rounded-md border border-line bg-surface px-2 py-0.5 text-xs font-bold text-ink [font-family:inherit]";

export function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const back = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); onClose(); } else if (e.key === "Tab") { e.preventDefault(); ref.current?.focus(); } };
    window.addEventListener("keydown", k);
    return () => { window.removeEventListener("keydown", k); back?.focus?.(); };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-6" onMouseDown={onClose}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="shortcuts-title" onMouseDown={(e) => e.stopPropagation()}
        className="sw-pop flex max-h-[calc(100dvh-24px)] w-full max-w-[520px] flex-col gap-5 overflow-y-auto rounded-t-2xl bg-card p-5 shadow-2xl outline-none sm:rounded-card sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 id="shortcuts-title" className="text-title font-bold tracking-[-0.02em]">Keyboard shortcuts</h2>
          <button type="button" onClick={onClose} className="min-h-9 cursor-pointer rounded-control px-3 text-meta font-bold text-body hover:bg-surface hover:text-ink">Close</button>
        </div>
        {SHORTCUTS.map((g) => (
          <section key={g.title} aria-label={g.title} className="flex flex-col gap-1">
            <h3 className="pb-1 text-xs font-bold tracking-[0.06em] text-muted">{g.title.toUpperCase()}</h3>
            {g.items.map((it) => (
              <div key={it.label} className="flex min-h-9 items-center justify-between gap-4 border-b border-row py-1.5 last:border-b-0">
                <span className="text-sm">{it.label}</span>
                <span className="flex shrink-0 items-center gap-1">
                  {it.keys.map((k, i) => <span key={i} className="flex items-center gap-1">{i > 0 && it.keys[0] === "G" && <span className="text-xs text-muted">then</span>}<kbd className={kbd}>{k}</kbd></span>)}
                </span>
              </div>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
