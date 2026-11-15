import type { HTMLAttributes, ReactNode } from "react";

/** The one card surface: 16px radius, hairline border, card fill. */
export function Card({ pad = "md", className = "", ...rest }: HTMLAttributes<HTMLDivElement> & { pad?: "none" | "sm" | "md" }) {
  const p = pad === "none" ? "" : pad === "sm" ? "p-4" : "p-5 sm:p-6";
  return <div className={`rounded-card border border-line bg-card ${p} ${className}`} {...rest} />;
}

export function CardHeader({ title, aside, sub }: { title: ReactNode; aside?: ReactNode; sub?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <div className="flex min-w-0 flex-col gap-0.5">
        <h2 className="text-title font-bold tracking-[-0.02em]">{title}</h2>
        {sub && <p className="text-meta leading-5 text-body">{sub}</p>}
      </div>
      {aside}
    </div>
  );
}

/** Section heading that sits on the page, outside a card. */
export function SectionHeader({ title, aside }: { title: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h2 className="text-lg font-bold tracking-[-0.02em]">{title}</h2>
      {aside}
    </div>
  );
}
