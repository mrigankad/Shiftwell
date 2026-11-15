import { useEffect, useMemo, useRef, useState } from "react";
import { filterCommands, type Command } from "./commands";

/** Ctrl/Cmd+K palette. Uncontrolled by default; pass open and onOpenChange to control it. */
export function CommandPalette({ commands, open: openProp, onOpenChange }: {
  commands: Command[]; open?: boolean; onOpenChange?: (open: boolean) => void;
}) {
  const [inner, setInner] = useState(false);
  const open = openProp ?? inner;
  const setOpen = (v: boolean) => { setInner(v); onOpenChange?.(v); };

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const next = !open;
        setInner(next);
        onOpenChange?.(next);
      }
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [open, onOpenChange]);

  if (!open) return null;
  return <PaletteDialog commands={commands} onClose={() => setOpen(false)} />;
}

const kbd = "shrink-0 rounded-md border border-line px-2 py-0.5 text-xs font-bold text-muted [font-family:inherit]";

function PaletteDialog({ commands, onClose }: { commands: Command[]; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const returnTo = useRef<HTMLElement | null>(document.activeElement as HTMLElement | null);

  const results = useMemo(() => filterCommands(commands, query), [commands, query]);
  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    inputRef.current?.focus();
    const back = returnTo.current;
    return () => back?.focus?.();
  }, []);
  useEffect(() => { listRef.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: "nearest" }); }, [active]);

  const run = (c: Command | undefined) => { if (!c) return; onClose(); c.run(); };
  const onKey = (e: React.KeyboardEvent) => {
    const n = results.length;
    if (e.key === "ArrowDown") { e.preventDefault(); if (n) setActive((i) => (i + 1) % n); }
    else if (e.key === "ArrowUp") { e.preventDefault(); if (n) setActive((i) => (i - 1 + n) % n); }
    else if (e.key === "Home") { e.preventDefault(); setActive(0); }
    else if (e.key === "End") { e.preventDefault(); setActive(Math.max(0, n - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); run(results[active]); }
    else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onClose(); }
    else if (e.key === "Tab") { e.preventDefault(); inputRef.current?.focus(); } // one tab stop: the focus trap
  };

  // Group headings appear when the group changes between consecutive results.
  const rows = results.map((cmd, idx) => ({ cmd, idx, heading: idx === 0 || results[idx - 1].group !== cmd.group ? cmd.group : undefined }));

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 px-3 pt-[8vh] sm:px-6 sm:pt-[14vh]" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Command palette" onKeyDown={onKey} onMouseDown={(e) => e.stopPropagation()}
        className="flex max-h-[80dvh] sm:max-h-[70vh] w-full max-w-[640px] flex-col overflow-hidden rounded-card border border-line bg-card shadow-2xl">
        <div className="flex items-center gap-3 border-b border-line px-4 py-3.5 sm:px-5 sm:py-4">
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="shrink-0 text-muted">
            <circle cx="8" cy="8" r="5.5" /><path d="M12.5 12.5L16 16" />
          </svg>
          <input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Type a command or an account name"
            role="combobox" aria-expanded="true" aria-controls="palette-list" aria-autocomplete="list" aria-label="Search commands"
            aria-activedescendant={results[active] ? `palette-opt-${active}` : undefined}
            className="min-w-0 flex-1 bg-transparent text-title font-bold text-ink outline-none placeholder:font-normal placeholder:text-muted" />
          <kbd className={kbd}>Esc</kbd>
        </div>

        <ul ref={listRef} id="palette-list" role="listbox" aria-label="Commands" className="flex-1 overflow-y-auto p-2">
          {rows.length === 0 && <li role="presentation" className="px-3 py-8 text-center text-sm text-body">Nothing matches that search.</li>}
          {rows.map(({ cmd, idx, heading }) => (
            <li key={cmd.id} role="presentation">
              {heading && <div role="presentation" className="px-3 pb-1 pt-3 text-xs font-bold tracking-[0.06em] text-muted">{heading.toUpperCase()}</div>}
              <div id={`palette-opt-${idx}`} data-idx={idx} role="option" aria-selected={idx === active}
                onMouseMove={() => setActive(idx)} onClick={() => run(cmd)}
                className={`flex cursor-pointer items-center gap-3 min-h-11 rounded-xl px-3 py-2.5 ${idx === active ? "bg-surface" : ""}`}>
                <span className="flex size-7 shrink-0 items-center justify-center">
                  {cmd.icon ?? <span aria-hidden className={`size-2 rounded-full ${idx === active ? "bg-shift" : "bg-track"}`} />}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-ui font-bold">{cmd.label}</span>
                  {cmd.hint && <span className="truncate text-meta text-body">{cmd.hint}</span>}
                </span>
                {cmd.shortcut && <span className="flex shrink-0 gap-1">{cmd.shortcut.split(" ").map((k) => <kbd key={k} className={kbd}>{k}</kbd>)}</span>}
                {idx === active && <kbd className={kbd}>Enter</kbd>}
              </div>
            </li>
          ))}
        </ul>

        <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-2.5 text-xs text-muted sm:px-5">
          <span className="truncate">Search pages, actions and accounts</span>
          <span className="hidden shrink-0 sm:inline">Up and down to move, Enter to run</span>
        </div>
      </div>
    </div>
  );
}
