import { useEffect, useState } from "react";

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

export function ThemeSwitch({ value, onChange }: { value: ThemeChoice; onChange: (t: ThemeChoice) => void }) {
  const opts: { id: ThemeChoice; label: string }[] = [
    { id: "system", label: "Auto" },
    { id: "light", label: "Day" },
    { id: "night", label: "Night" },
  ];
  return (
    <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-0.5 rounded-lg border border-line bg-card p-0.5">
      {opts.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={value === o.id} onClick={() => onChange(o.id)}
          className={`cursor-pointer rounded-md py-1 text-xs font-bold ${value === o.id ? "bg-cta text-on-cta" : "text-body hover:text-ink"}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
