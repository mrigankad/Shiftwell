import type { ReactNode } from "react";

export type Tone = "neutral" | "muted" | "action" | "pass" | "warn" | "fail";
const TONE: Record<Tone, string> = {
  neutral: "bg-surface text-body",
  muted: "bg-surface text-muted",
  action: "bg-action-soft text-action",
  pass: "bg-pass-soft text-pass",
  warn: "bg-warn-soft text-warn",
  fail: "bg-fail-soft text-fail",
};
export const toneCls = (t: Tone) => TONE[t];

export function Pill({ tone = "neutral", children, className = "" }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${TONE[tone]} ${className}`}>{children}</span>;
}
