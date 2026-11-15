import { useEffect, useState } from "react";
import { createRoot, type Root } from "react-dom/client";

/**
 * A toast with one action button, drawn exactly like the shared toasts. The shared Toast has no action slot,
 * so this one mounts itself in its own root and removes itself again. Used for "Make their character".
 */
let host: HTMLDivElement | null = null;
let root: Root | null = null;

function Toast({ text, label, onAction, onClose }: { text: string; label: string; onAction: () => void; onClose: () => void }) {
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const t = setTimeout(onClose, 9000);
    return () => clearTimeout(t);
  }, [paused, onClose]);
  return (
    <div role="status" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
      className="sw-toast-in pointer-events-auto flex w-full max-w-[460px] items-start gap-3 rounded-xl bg-cta py-3 pl-4 pr-2 text-sm font-bold text-on-cta shadow-xl sm:w-auto">
      <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-pass" />
      <span className="min-w-0 flex-1 leading-5 [overflow-wrap:anywhere]">{text}</span>
      <button type="button" onClick={() => { onAction(); onClose(); }}
        className="-my-1 min-h-8 shrink-0 cursor-pointer rounded-md bg-action px-2.5 text-sm font-bold text-on-action hover:brightness-110">{label}</button>
      <button type="button" aria-label="Dismiss" onClick={onClose} className="-my-1 flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md opacity-70 hover:opacity-100">
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M2 2l6 6M8 2l-6 6" /></svg>
      </button>
    </div>
  );
}

export function showActionToast(text: string, label: string, onAction: () => void) {
  if (!host) {
    host = document.createElement("div");
    host.className = "pointer-events-none fixed inset-x-4 bottom-4 z-[60] flex flex-col items-end gap-2 sm:inset-x-auto sm:bottom-6 sm:right-6";
    document.body.appendChild(host);
    root = createRoot(host);
  }
  const close = () => root?.render(null);
  root!.render(<Toast key={Date.now()} text={text} label={label} onAction={onAction} onClose={close} />);
}
