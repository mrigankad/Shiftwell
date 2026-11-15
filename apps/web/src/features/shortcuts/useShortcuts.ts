import { useEffect } from "react";

const typing = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.getAttribute("role") === "combobox" || el.getAttribute("role") === "spinbutton");
};

/** Single key and "G then letter" shortcuts. Ignored while typing, with a modifier held, or while a dialog is open. */
export function useShortcuts(h: { go: (route: string) => void; help: () => void; startRun: () => void; addAccount: () => void; enabled: boolean }) {
  useEffect(() => {
    let armed = 0;
    const map: Record<string, string> = { b: "board", r: "runs", h: "handoffs", a: "accounts", i: "insights" };
    const on = (e: KeyboardEvent) => {
      if (!h.enabled || e.ctrlKey || e.metaKey || e.altKey || typing(e.target) || e.repeat) return;
      const k = e.key;
      if (armed && Date.now() - armed < 1200 && map[k.toLowerCase()]) { e.preventDefault(); armed = 0; h.go(map[k.toLowerCase()]); return; }
      armed = 0;
      if (k === "?") { e.preventDefault(); h.help(); }
      else if (k === "g") armed = Date.now();
      else if (k === "n") { e.preventDefault(); h.startRun(); }
      else if (k === "A") { e.preventDefault(); h.addAccount(); }
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [h.go, h.help, h.startRun, h.addAccount, h.enabled]);
}
