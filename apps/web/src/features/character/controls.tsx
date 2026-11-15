import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { svgFor, type Recipe, type SvgOpts } from "./recipes";

/** The recipe as crisp inline SVG that fills its box. */
export function Pixel({ recipe, className = "", ...opts }: { recipe: Recipe; className?: string } & SvgOpts) {
  const svg = svgFor(recipe, opts);
  if (!svg) return <span aria-hidden className={`block bg-track ${className}`} />;
  return <span aria-hidden className={`block [&>svg]:block ${className}`} dangerouslySetInnerHTML={{ __html: svg }} />;
}

/** Arrow keys move through the radios or options inside `root`, Home and End jump. Returns the index to move to, or null. */
function step(e: KeyboardEvent, selector: string, current: number, count: number): number | null {
  const k = e.key;
  const d = k === "ArrowRight" || k === "ArrowDown" ? 1 : k === "ArrowLeft" || k === "ArrowUp" ? -1 : 0;
  let next: number | null = null;
  if (d) next = (current + d + count) % count;
  else if (k === "Home") next = 0;
  else if (k === "End") next = count - 1;
  if (next === null) return null;
  e.preventDefault();
  const items = (e.currentTarget as HTMLElement).querySelectorAll<HTMLElement>(selector);
  items[next]?.focus();
  return next;
}

export function Field({ label, value, children, id }: { label: string; value?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h3 id={id} className="text-sm font-bold text-ink">{label}</h3>
        {value && <span className="text-meta text-body">{value}</span>}
      </div>
      {children}
    </section>
  );
}

export interface SwatchOption { id: string; label: string; color: string; /** second colour for a split swatch */ color2?: string }

/** A radiogroup of colour circles. One tab stop, arrow keys change the choice. */
export function Swatches({ label, value, options, onChange }: { label: string; value: string; options: SwatchOption[]; onChange: (id: string) => void }) {
  const sel = options.findIndex((o) => o.id === value);
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-x-2 gap-y-2.5"
      onKeyDown={(e) => { const n = step(e, '[role="radio"]', Math.max(sel, 0), options.length); if (n !== null) onChange(options[n]!.id); }}>
      {options.map((o, i) => {
        const on = i === sel;
        return (
          <button key={o.id} type="button" role="radio" aria-checked={on} aria-label={o.label} title={o.label} tabIndex={on || (sel < 0 && i === 0) ? 0 : -1}
            onClick={() => onChange(o.id)}
            className={`size-9 shrink-0 cursor-pointer rounded-full border border-line p-0 ${on ? "ring-2 ring-action ring-offset-2 ring-offset-card" : "hover:ring-2 hover:ring-line hover:ring-offset-2 hover:ring-offset-card"}`}
            style={{ background: o.color2 ? `linear-gradient(135deg, ${o.color} 50%, ${o.color2} 50%)` : o.color }} />
        );
      })}
    </div>
  );
}

export interface TileOption { id: string; label: string; recipe: Recipe; crop?: string; background?: boolean; badge?: string }

/** A radiogroup of small previews, for hair, face parts, logos and backdrops. */
export function Tiles({ label, value, options, onChange, cols = "grid-cols-[repeat(auto-fill,minmax(84px,108px))]" }: {
  label: string; value: string; options: TileOption[]; onChange: (id: string) => void; cols?: string;
}) {
  const sel = options.findIndex((o) => o.id === value);
  return (
    <div role="radiogroup" aria-label={label} className={`grid gap-2.5 ${cols}`}
      onKeyDown={(e) => { const n = step(e, '[role="radio"]', Math.max(sel, 0), options.length); if (n !== null) onChange(options[n]!.id); }}>
      {options.map((o, i) => {
        const on = i === sel;
        return (
          <button key={o.id} type="button" role="radio" aria-checked={on} tabIndex={on || (sel < 0 && i === 0) ? 0 : -1} onClick={() => onChange(o.id)}
            className="group flex min-w-0 cursor-pointer flex-col items-center gap-1.5 rounded-card p-0.5">
            <span className={`relative block aspect-square w-full overflow-hidden rounded-xl bg-welcome ${on ? "ring-2 ring-action ring-offset-2 ring-offset-card" : "ring-1 ring-line group-hover:ring-2 group-hover:ring-body"}`}>
              <Pixel recipe={o.recipe} crop={o.crop} background={o.background} className="size-full" />
              {o.badge && <span className="absolute bottom-1 left-1 rounded-md bg-welcome px-1.5 py-0.5 text-2xs font-bold text-welcome-ink">{o.badge}</span>}
            </span>
            <span className={`max-w-full truncate text-meta ${on ? "font-bold text-ink" : "text-body"}`}>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** A multi-select listbox of previews: arrow keys move, Space or Enter toggles. */
export function MultiTiles({ label, values, options, onToggle }: { label: string; values: string[]; options: TileOption[]; onToggle: (id: string) => void }) {
  const uid = useId();
  const active = useRef(0);
  const first = Math.max(0, options.findIndex((o) => values.includes(o.id)));
  return (
    <div role="listbox" aria-label={label} aria-multiselectable="true" className="grid grid-cols-[repeat(auto-fill,minmax(84px,108px))] gap-2.5"
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") { e.preventDefault(); onToggle(options[active.current]!.id); return; }
        const n = step(e, '[role="option"]', active.current, options.length);
        if (n !== null) { active.current = n; }
      }}>
      {options.map((o, i) => {
        const on = values.includes(o.id);
        return (
          <div key={o.id} id={`${uid}-${o.id}`} role="option" aria-selected={on} tabIndex={i === first ? 0 : -1}
            onFocus={() => { active.current = i; }} onClick={() => onToggle(o.id)}
            className="group flex min-w-0 cursor-pointer flex-col items-center gap-1.5 rounded-card p-0.5">
            <span className={`relative block aspect-square w-full overflow-hidden rounded-xl bg-welcome ${on ? "ring-2 ring-action ring-offset-2 ring-offset-card" : "ring-1 ring-line group-hover:ring-2 group-hover:ring-body"}`}>
              <Pixel recipe={o.recipe} crop={o.crop} background={o.background} className="size-full" />
              {on && (
                <span className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-action text-on-action">
                  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 6.5l2.5 2.5 4.5-5.5" /></svg>
                </span>
              )}
            </span>
            <span className={`max-w-full truncate text-meta ${on ? "font-bold text-ink" : "text-body"}`}>{o.label}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Tabs with arrow-key navigation. Scrolls sideways on narrow screens. */
export function Tabs<T extends string>({ label, value, tabs, onChange, idPrefix }: { label: string; value: T; tabs: { id: T; label: string }[]; onChange: (t: T) => void; idPrefix: string }) {
  const sel = tabs.findIndex((t) => t.id === value);
  return (
    <div role="tablist" aria-label={label} className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
      onKeyDown={(e) => { const n = step(e, '[role="tab"]', sel, tabs.length); if (n !== null) onChange(tabs[n]!.id); }}>
      {tabs.map((t) => {
        const on = t.id === value;
        return (
          <button key={t.id} type="button" role="tab" id={`${idPrefix}-tab-${t.id}`} aria-selected={on} aria-controls={`${idPrefix}-panel-${t.id}`} tabIndex={on ? 0 : -1}
            onClick={() => onChange(t.id)}
            className={`min-h-10 shrink-0 cursor-pointer rounded-full px-4 text-sm font-bold ${on ? "bg-action text-on-action" : "bg-surface text-nav hover:text-ink"}`}>
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
