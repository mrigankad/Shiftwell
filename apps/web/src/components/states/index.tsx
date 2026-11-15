import type { ReactNode } from "react";
import { buttonCls } from "../ui/Button";

/** Friendly placeholder for lists with nothing in them yet. */
export function EmptyState({ icon, title, body, action, eyebrow, art }: {
  icon?: ReactNode; title: string; body: ReactNode; action?: ReactNode; eyebrow?: string;
  /** A pixel-art spot from /public, shown above the title. */
  art?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-card border border-line bg-surface px-5 py-10 text-center sm:px-6 sm:py-12">
      {art && <img src={art} alt="" aria-hidden className="mb-3 h-[120px] w-auto max-w-full rounded-xl object-cover" style={{ imageRendering: "pixelated" }} />}
      {icon && <div aria-hidden className="mb-2 flex size-12 items-center justify-center rounded-card border border-line bg-card text-body">{icon}</div>}
      {eyebrow && <span className="text-xs font-bold tracking-[0.06em] text-muted">{eyebrow}</span>}
      <h2 className="text-lg font-bold tracking-[-0.02em]">{title}</h2>
      <p className="max-w-[460px] text-sm leading-6 text-body">{body}</p>
      {action && <div className="flex flex-wrap justify-center gap-2 pt-3">{action}</div>}
    </div>
  );
}

/** Something failed. Offers a retry and keeps the tone calm. */
export function ErrorState({ title = "That did not work", body, onRetry, retryLabel = "Try again", extra }: {
  title?: string; body: string; onRetry?: () => void; retryLabel?: string; extra?: ReactNode;
}) {
  return (
    <div role="alert" className="flex flex-col items-center gap-2 rounded-card border border-line bg-surface px-6 py-12 text-center">
      <span className="text-xs font-bold tracking-[0.06em] text-fail">SOMETHING WENT WRONG</span>
      <h2 className="text-lg font-bold tracking-[-0.02em]">{title}</h2>
      <p className="max-w-[460px] text-sm leading-6 text-body">{body}</p>
      {(onRetry || extra) && (
        <div className="flex flex-wrap justify-center gap-2 pt-3">
          {onRetry && <button type="button" onClick={onRetry} className={buttonCls("primary", "md")}>{retryLabel}</button>}
          {extra}
        </div>
      )}
    </div>
  );
}

/** Shown while the local service cannot be reached. */
export function OfflineBanner({ command = "shiftwell start", onRetry }: { command?: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-card border border-line bg-fail-soft px-4 py-3">
      <span aria-hidden className="size-2 shrink-0 rounded-full bg-fail" />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm font-bold text-fail">The Shiftwell service is offline</span>
        <span className="text-meta leading-5 text-body">
          Your accounts are safe. Start the service from a terminal with <kbd className="rounded-md border border-line bg-card px-1.5 py-0.5 text-xs font-bold text-ink [font-family:inherit]">{command}</kbd> and this page will reconnect on its own.
        </span>
      </div>
      {onRetry && <button type="button" onClick={onRetry} className={buttonCls("secondary", "sm")}>Check again</button>}
    </div>
  );
}

/** Loading placeholder rows. */
export function Skeleton({ rows = 3, label = "Loading" }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-live="polite" aria-label={label} className="overflow-hidden rounded-card border border-line">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-row px-4 py-3.5 last:border-b-0">
          <div className="size-8 shrink-0 animate-pulse rounded-lg bg-track" />
          <div className="flex flex-1 flex-col gap-2">
            <div className="h-3 animate-pulse rounded-full bg-track" style={{ width: `${55 - (i % 3) * 12}%` }} />
            <div className="h-2.5 animate-pulse rounded-full bg-row" style={{ width: `${35 + (i % 2) * 15}%` }} />
          </div>
          <div className="h-5 w-16 shrink-0 animate-pulse rounded-full bg-track" />
        </div>
      ))}
      <span className="sr-only">{label}</span>
    </div>
  );
}
