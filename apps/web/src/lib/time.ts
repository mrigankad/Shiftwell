import { createContext, useContext, useEffect, useState } from "react";

/** "just now", "12 min ago", "5h ago", "3d ago". */
export function ago(iso: string | number, now = Date.now()): string {
  const t = typeof iso === "number" ? iso : Date.parse(iso);
  return agoMinutes(Math.round((now - t) / 60000));
}

/** Same wording as `ago`, from a count of minutes. */
export function agoMinutes(min: number): string {
  const m = Math.max(0, min);
  if (m < 1) return "just now";
  return m < 60 ? `${m} min ago` : m < 1440 ? `${Math.floor(m / 60)}h ago` : `${Math.floor(m / 1440)}d ago`;
}

/** "3h 10m" until an epoch-seconds reset. Past resets read "due" rather than a misleading 0m. */
export function resetIn(resetsAt: number | null | undefined, now = Date.now()): string {
  if (!resetsAt) return "n/a";
  const min = Math.round((resetsAt * 1000 - now) / 60000);
  if (min <= 0) return "due";
  return min >= 60 ? `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, "0")}m` : `${min}m`;
}

/** Current time, re-rendering every `everyMs`. */
export function useTicker(everyMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => { if (!document.hidden) setNow(Date.now()); }, everyMs);
    return () => clearInterval(t);
  }, [everyMs]);
  return now;
}

/** The shell's shared clock, so relative times across the app tick together. */
export const NowContext = createContext<number>(Date.now());
export const useNowCtx = () => useContext(NowContext);
