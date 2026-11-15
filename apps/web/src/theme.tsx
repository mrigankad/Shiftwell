import { useEffect, useState } from "react";
import { Tooltip } from "./components/ui/Tooltip";

export type ThemeChoice = "system" | "light" | "night";
const KEY = "shiftwell.theme";

const read = (): ThemeChoice => {
  try { const v = localStorage.getItem(KEY); return v === "light" || v === "night" ? v : "system"; } catch { return "system"; }
};

/** Applies data-theme on <html>. "system" follows the OS and updates live when it changes. */
export function useTheme(): [ThemeChoice, (t: ThemeChoice) => void] {
  const [choice, setChoice] = useState<ThemeChoice>(read);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const night = choice === "night" || (choice === "system" && mq.matches);
      document.documentElement.dataset.theme = night ? "night" : "light";
    };
    apply();
    try { localStorage.setItem(KEY, choice); } catch { /* private mode */ }
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [choice]);
  return [choice, setChoice];
}

const THEME_ICON: Record<ThemeChoice, React.ReactNode> = {
  system: <><circle cx="8" cy="8" r="5.25" /><path d="M8 2.75v10.5" /><path d="M8 2.75a5.25 5.25 0 0 1 0 10.5z" fill="currentColor" /></>,
  light: <><circle cx="8" cy="8" r="2.75" /><path d="M8 1.75v1.5M8 12.75v1.5M1.75 8h1.5M12.75 8h1.5M3.6 3.6l1.05 1.05M11.35 11.35l1.05 1.05M3.6 12.4l1.05-1.05M11.35 4.65l1.05-1.05" /></>,
  night: <path d="M13 9.4A5.4 5.4 0 0 1 6.6 3 5.4 5.4 0 1 0 13 9.4z" />,
};

export function ThemeSwitch({ value, onChange, compact = false }: { value: ThemeChoice; onChange: (t: ThemeChoice) => void; compact?: boolean }) {
  const opts: { id: ThemeChoice; label: string }[] = [
    { id: "system", label: "Auto" },
    { id: "light", label: "Day" },
    { id: "night", label: "Night" },
  ];
  const onKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const i = opts.findIndex((o) => o.id === value);
    const next = opts[(i + d + opts.length) % opts.length].id;
    onChange(next);
    e.currentTarget.querySelector<HTMLButtonElement>(`[data-id="${next}"]`)?.focus();
  };
  if (compact) {
    return (
      <div role="radiogroup" aria-label="Theme" onKeyDown={onKey} className="flex shrink-0 gap-0.5 rounded-lg border border-line bg-card p-0.5">
        {opts.map((o) => (
          <Tooltip key={o.id} label={o.id === "system" ? "Auto: follow the system" : o.label} side="top">
            <button data-id={o.id} type="button" role="radio" aria-checked={value === o.id} aria-label={o.label} tabIndex={value === o.id ? 0 : -1} onClick={() => onChange(o.id)}
              className={`flex size-7 cursor-pointer items-center justify-center rounded-md ${value === o.id ? "bg-cta text-on-cta" : "text-body hover:bg-surface hover:text-ink"}`}>
              <svg aria-hidden width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">{THEME_ICON[o.id]}</svg>
            </button>
          </Tooltip>
        ))}
      </div>
    );
  }
  return (
    <div role="radiogroup" aria-label="Theme" onKeyDown={onKey} className="grid grid-cols-3 gap-0.5 rounded-lg border border-line bg-card p-0.5">
      {opts.map((o) => (
        <button key={o.id} data-id={o.id} type="button" role="radio" aria-checked={value === o.id} tabIndex={value === o.id ? 0 : -1} onClick={() => onChange(o.id)}
          className={`cursor-pointer rounded-md py-1 text-xs font-bold ${value === o.id ? "bg-cta text-on-cta" : "text-body hover:text-ink"}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
