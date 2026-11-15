import { useEffect, useState } from "react";

/** Current time in ms, re-rendering every `everyMs` (default one second). */
export function useNow(everyMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(t);
  }, [everyMs]);
  return now;
}

/** "3h 10m 05s", "12m 04s", "9s". `resetsAt` is epoch seconds. */
export function countdown(resetsAt: number | null | undefined, now: number): string {
  if (!resetsAt) return "n/a";
  const s = Math.max(0, Math.round(resetsAt - now / 1000));
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  if (d > 0) return `${d}d ${h}h ${p(m)}m`;
  if (h > 0) return `${h}h ${p(m)}m ${p(sec)}s`;
  if (m > 0) return `${m}m ${p(sec)}s`;
  return `${sec}s`;
}
