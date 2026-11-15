import { useEffect, useRef, useState } from "react";

export type LiveKind = "user" | "assistant" | "tool_call" | "tool_result" | "status";
export interface LiveEvent { at: number; kind: LiveKind; text: string; tool?: string; file?: string }
export interface LiveResult {
  source: string;
  events: LiveEvent[];
  lastActivityAt: number | null;
  filesTouched: string[];
  hint?: string;
}

/** Keeps the feed from growing without bound in a long session. */
const KEEP = 600;

export interface LiveState {
  events: LiveEvent[];
  filesTouched: string[];
  lastActivityAt: number | null;
  source: string;
  hint: string | null;
  /** False until the first answer arrives. */
  loaded: boolean;
  /** True while the stream is down and the browser is retrying. */
  offline: boolean;
}

const EMPTY: LiveState = { events: [], filesTouched: [], lastActivityAt: null, source: "", hint: null, loaded: false, offline: false };

/** Opens the run's live stream and merges new events as they arrive. */
export function useLive(runId: string): LiveState {
  const [state, setState] = useState<LiveState>(EMPTY);
  const seen = useRef(new Set<string>());

  useEffect(() => {
    setState(EMPTY);
    seen.current = new Set();
    const es = new EventSource(`/api/runs/${encodeURIComponent(runId)}/live/stream`);
    es.onmessage = (m) => {
      let res: LiveResult;
      try { res = JSON.parse(m.data) as LiveResult; } catch { return; }
      // After a reconnect the server resends its recent events, so drop the ones already shown.
      const fresh = res.events.filter((e) => { const k = `${e.at}|${e.kind}|${e.tool ?? ""}|${e.text.slice(0, 120)}`; if (seen.current.has(k)) return false; seen.current.add(k); return true; });
      setState((s) => ({
        events: [...s.events, ...fresh].slice(-KEEP),
        filesTouched: res.filesTouched,
        lastActivityAt: res.lastActivityAt ?? s.lastActivityAt,
        source: res.source || s.source,
        hint: res.hint ?? null,
        loaded: true,
        offline: false,
      }));
    };
    es.addEventListener("gone", () => { setState((s) => ({ ...s, loaded: true, hint: "This run no longer exists." })); es.close(); });
    es.onerror = () => setState((s) => ({ ...s, offline: true }));
    return () => es.close();
  }, [runId]);

  return state;
}

/** Short relative time from epoch milliseconds. */
export function agoMs(ms: number | null, now: number): string {
  if (!ms) return "no activity yet";
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 10) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  return m < 60 ? `${m} min ago` : m < 1440 ? `${Math.floor(m / 60)}h ago` : `${Math.floor(m / 1440)}d ago`;
}
