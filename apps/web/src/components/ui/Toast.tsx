import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Tooltip } from "./Tooltip";

export type ToastKind = "success" | "error" | "info";
interface Item { id: number; kind: ToastKind; text: string }
export interface ToastApi { show: (text: string, kind?: ToastKind) => void; success: (t: string) => void; error: (t: string) => void; info: (t: string) => void }

const Ctx = createContext<ToastApi | null>(null);

/** App-wide toasts: stacked, 4.5 s, paused on hover, errors announced assertively. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);
  const seq = useRef(0);
  const show = useCallback((text: string, kind: ToastKind = "info") => {
    const id = ++seq.current;
    setItems((xs) => [...xs.slice(-2), { id, kind, text }]);
  }, []);
  const api = useMemo<ToastApi>(() => ({ show, success: (t) => show(t, "success"), error: (t) => show(t, "error"), info: (t) => show(t, "info") }), [show]);
  const close = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);
  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-4 bottom-4 z-[60] flex flex-col items-end gap-2 sm:inset-x-auto sm:bottom-6 sm:right-6">
        {items.map((t) => <ToastView key={t.id} item={t} onClose={close} />)}
      </div>
    </Ctx.Provider>
  );
}

function ToastView({ item, onClose }: { item: Item; onClose: (id: number) => void }) {
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const t = setTimeout(() => onClose(item.id), 4500);
    return () => clearTimeout(t);
  }, [paused, onClose, item.id]);
  const dot = item.kind === "error" ? "bg-fail" : item.kind === "success" ? "bg-pass" : "bg-action";
  return (
    <div role={item.kind === "error" ? "alert" : "status"} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
      className="sw-toast-in pointer-events-auto flex w-full max-w-[420px] items-start gap-3 rounded-xl bg-cta py-3 pl-4 pr-2 text-sm font-bold text-on-cta shadow-xl sm:w-auto">
      <span aria-hidden className={`mt-1.5 size-2 shrink-0 rounded-full ${dot}`} />
      <span className="min-w-0 flex-1 leading-5 [overflow-wrap:anywhere]">{item.text}</span>
      <Tooltip label={"Dismiss"}><button type="button" aria-label="Dismiss" onClick={() => onClose(item.id)} className="-my-1 flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md opacity-70 hover:opacity-100">
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M2 2l6 6M8 2l-6 6" /></svg>
      </button></Tooltip>
    </div>
  );
}

export function useToast(): ToastApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("useToast needs a ToastProvider");
  return v;
}
