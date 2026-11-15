import type { ReactNode } from "react";
import type { Tone } from "./Pill";

const NOTE: Partial<Record<Tone, string>> = { pass: "text-pass", warn: "text-warn", fail: "text-fail", action: "text-action", muted: "text-muted" };

/** A number with a label above and a short note below. */
export function StatTile({ label, value, note, tone = "neutral" }: { label: ReactNode; value: ReactNode; note?: ReactNode; tone?: Tone }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-card border border-line bg-card px-5 py-4">
      <span className="text-meta text-body">{label}</span>
      <span className="text-3xl font-bold leading-9 tracking-[-0.03em] tabular-nums">{value}</span>
      {note && <span className={`text-meta font-bold ${NOTE[tone] ?? "text-ink"}`}>{note}</span>}
    </div>
  );
}
