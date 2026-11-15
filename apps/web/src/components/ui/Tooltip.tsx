import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Visual label for icon-only controls. The control keeps its own aria-label, so this layer is aria-hidden.
 * WCAG 1.4.13: it appears on hover and on keyboard focus, stays while the pointer is over it, and Escape dismisses it.
 */
export function Tooltip({ label, shortcut, side = "top", children, className = "" }: {
  label: string; shortcut?: string; side?: "top" | "bottom" | "right"; children: ReactNode; className?: string;
}) {
  const host = useRef<HTMLSpanElement>(null);
  const timer = useRef<number>();
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  const show = useCallback((delay: number) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const r = host.current?.getBoundingClientRect();
      if (!r) return;
      setPos(side === "right" ? { x: r.right + 8, y: r.top + r.height / 2 } : side === "bottom" ? { x: r.left + r.width / 2, y: r.bottom + 8 } : { x: r.left + r.width / 2, y: r.top - 8 });
    }, delay);
  }, [side]);
  const hide = useCallback(() => { window.clearTimeout(timer.current); setPos(null); }, []);

  useEffect(() => {
    if (!pos) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") hide(); };
    window.addEventListener("keydown", k);
    window.addEventListener("scroll", hide, true);
    return () => { window.removeEventListener("keydown", k); window.removeEventListener("scroll", hide, true); };
  }, [pos, hide]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const tf = side === "right" ? "translate(0, -50%)" : side === "bottom" ? "translate(-50%, 0)" : "translate(-50%, -100%)";
  return (
    <span ref={host} className={`inline-flex ${className}`}
      onPointerEnter={() => show(450)} onPointerLeave={hide} onFocus={() => show(0)} onBlur={hide} onPointerDown={hide}>
      {children}
      {pos && createPortal(
        <span aria-hidden style={{ left: pos.x, top: pos.y, transform: tf }}
          className="sw-pop pointer-events-none fixed z-[70] flex items-center gap-2 whitespace-nowrap rounded-md bg-cta px-2 py-1 text-xs font-bold text-on-cta shadow-lg">
          {label}
          {shortcut && <span className="rounded border border-on-cta/30 px-1 text-2xs opacity-80">{shortcut}</span>}
        </span>, document.body)}
    </span>
  );
}
