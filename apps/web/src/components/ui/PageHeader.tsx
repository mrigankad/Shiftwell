import type { ReactNode } from "react";

/** Every page opens with this: a small eyebrow, one strong title, optional actions on the right. */
export function PageHeader({ eyebrow, title, children, size = "page", titleId }: {
  eyebrow?: ReactNode; title: ReactNode; children?: ReactNode; size?: "page" | "display"; titleId?: string;
}) {
  const t = size === "display"
    ? "text-h1 leading-[1.08] tracking-[-0.035em] sm:text-display"
    : "text-[26px] leading-[1.12] tracking-[-0.03em] sm:text-h1";
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
      <div className="flex min-w-0 flex-col gap-1">
        {eyebrow && <span className="text-sm text-body">{eyebrow}</span>}
        <h1 id={titleId} className={`font-bold [overflow-wrap:anywhere] ${t}`}>{title}</h1>
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}
