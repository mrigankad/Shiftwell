import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Run } from "../../api";
import { CrewAvatar } from "../../crew";
import { EmptyState, RUN_PILL, STATE_PILL, type PageCtx } from "../../pages/shared";
import { agoMs, useLive, type LiveEvent } from "./api";

const card = "flex flex-col gap-3 rounded-2xl border border-line bg-card p-4 sm:p-5";
const btn = "min-h-9 cursor-pointer rounded-lg border border-line px-3 py-1.5 text-[13px] font-bold hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40";

const clock = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/** Tail of a path so a deep file stays readable on one line. */
const shortPath = (p: string) => p.replace(/\\/g, "/").split("/").slice(-3).join("/");

function ToolRow({ e, result }: { e: LiveEvent; result?: LiveEvent }) {
  const target = e.file ? shortPath(e.file) : e.text;
  return (
    <div className="flex flex-col gap-0.5 py-1">
      <div className="flex min-w-0 items-center gap-2 text-[13px]">
        <span className="shrink-0 rounded-md bg-surface px-2 py-0.5 text-xs font-bold text-nav">{e.tool ?? "Tool"}</span>
        <span className="min-w-0 flex-1 truncate text-body" title={e.file ?? e.text}>{target}</span>
        <time className="shrink-0 text-xs tabular-nums text-muted">{clock(e.at)}</time>
      </div>
      {result && result.text.trim() && <p className="line-clamp-2 pl-1 text-xs leading-5 text-muted [overflow-wrap:anywhere]">{result.text}</p>}
    </div>
  );
}

function Message({ e }: { e: LiveEvent }) {
  const mine = e.kind === "user";
  return (
    <div className={`flex flex-col gap-1 ${mine ? "items-end" : "items-start"}`}>
      <span className="text-xs font-bold text-muted">{mine ? "You" : "Agent"} · {clock(e.at)}</span>
      <p className={`max-w-full whitespace-pre-wrap rounded-xl px-3.5 py-2.5 text-[14px] leading-6 [overflow-wrap:anywhere] sm:max-w-[88%] ${mine ? "bg-cta text-on-cta" : "bg-surface text-ink"}`}>{e.text}</p>
    </div>
  );
}

type Row = { key: string; ev: LiveEvent; result?: LiveEvent };

/** Pairs each tool result with the call before it, so the feed shows one compact row per call. */
function rows(events: LiveEvent[]): Row[] {
  const out: Row[] = [];
  events.forEach((ev, i) => {
    if (ev.kind === "tool_result") {
      const prev = out[out.length - 1];
      if (prev && prev.ev.kind === "tool_call" && !prev.result) { prev.result = ev; return; }
    }
    out.push({ key: `${i}-${ev.at}`, ev });
  });
  return out;
}

function Feed({ events, offline }: { events: LiveEvent[]; offline: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  const [atEnd, setAtEnd] = useState(true);

  const toEnd = useCallback(() => {
    const el = box.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    pinned.current = true;
    setAtEnd(true);
  }, []);

  const onScroll = () => {
    const el = box.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
    pinned.current = near;
    setAtEnd(near);
  };

  useLayoutEffect(() => {
    const el = box.current;
    if (el && pinned.current) el.scrollTop = el.scrollHeight;
  }, [events]);

  const list = rows(events);
  return (
    <div className="relative">
      <div ref={box} onScroll={onScroll} role="log" aria-live="polite" aria-label="Agent activity"
        className="flex h-[58vh] flex-col gap-3 overflow-y-auto px-4 py-4 sm:px-5 lg:h-[calc(100vh-250px)] lg:min-h-[420px]">
        {list.map(({ key, ev, result }) => {
          if (ev.kind === "user" || ev.kind === "assistant") return <Message key={key} e={ev} />;
          if (ev.kind === "tool_call") return <ToolRow key={key} e={ev} result={result} />;
          if (ev.kind === "tool_result") return <ToolRow key={key} e={{ ...ev, tool: ev.tool ?? "Result" }} />;
          return <p key={key} className="py-1 text-center text-xs font-bold text-muted">{ev.text} · {clock(ev.at)}</p>;
        })}
      </div>
      {offline && <p role="status" className="absolute inset-x-4 top-2 rounded-lg bg-warn-soft px-3 py-1.5 text-center text-xs font-bold text-warn">Connection lost, trying again</p>}
      {!atEnd && (
        <button type="button" onClick={toEnd}
          className="absolute bottom-4 left-1/2 flex min-h-9 -translate-x-1/2 cursor-pointer items-center gap-1.5 rounded-full bg-cta px-4 py-2 text-[13px] font-bold text-on-cta shadow-xl hover:opacity-90">
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 4.5L6 8l3.5-3.5" /></svg>
          Jump to latest
        </button>
      )}
    </div>
  );
}

function HandOffMenu({ run, ctx }: { run: Run; ctx: PageCtx }) {
  const [open, setOpen] = useState(false);
  const targets = ctx.accounts.filter((a) => a.id !== run.profileId);
  useEffect(() => {
    if (!open) return;
    const close = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} disabled={targets.length === 0} aria-expanded={open} aria-haspopup="menu" className={btn}>Hand off</button>
      {open && (
        <div role="menu" className="absolute bottom-11 left-0 z-10 flex w-[min(240px,calc(100vw-48px))] flex-col gap-0.5 rounded-xl border border-line bg-card p-1.5 shadow-xl lg:bottom-auto lg:top-11">
          <span className="px-2 py-1 text-xs font-bold text-muted">Hand off to</span>
          {targets.map((a) => (
            <button role="menuitem" type="button" key={a.id} onClick={() => { setOpen(false); ctx.handOff(run, a.id); }}
              className="flex min-h-9 cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-surface">
              <CrewAvatar provider={a.provider} preset={a.api?.preset} size={24} state={a.usage.state} />
              <span className="flex-1 font-bold">{a.name}</span>
              <span className="text-xs text-muted">{STATE_PILL[a.usage.state].label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Live view and review of one run, read from the transcript its CLI writes. */
export function LiveViewPage({ runId, ctx }: { runId: string; ctx: PageCtx }) {
  const run = ctx.runs.find((r) => r.id === runId);
  const live = useLive(runId);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(t);
  }, []);

  if (!run) {
    return (
      <div className="flex flex-col gap-5 px-4 py-6 sm:px-7">
        <EmptyState title="Run not found" body="This run was cleaned up or the link is out of date. Pick one from the Runs page."
          action={<button type="button" onClick={() => ctx.go("runs")} className="cursor-pointer rounded-lg bg-cta px-3.5 py-2 text-sm font-bold text-on-cta hover:opacity-90">Back to runs</button>} />
      </div>
    );
  }

  const pill = RUN_PILL[run.status];
  const ch = run.changes;
  const active = run.status === "active";
  const waiting = live.loaded && live.events.length === 0;

  return (
    <div className="flex flex-col gap-5 px-4 py-5 sm:px-7 sm:py-6">
      <div className="flex flex-col gap-2">
        <button type="button" onClick={() => ctx.go("runs")} className="w-fit cursor-pointer text-sm text-body hover:text-ink">Runs · {run.branch}</button>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <div className="flex min-w-0 items-center gap-3">
            <CrewAvatar provider={ctx.providerOf(run.profileId)} preset={ctx.presetOf(run.profileId)} size={36} />
            <div className="flex min-w-0 flex-col">
              <h1 className="line-clamp-2 text-[22px] font-bold tracking-[-0.03em] sm:text-[28px]">{run.task}</h1>
              <span className="text-xs text-muted [overflow-wrap:anywhere]">{ctx.nameOf(run.profileId)} · {run.branch} · last activity {agoMs(live.lastActivityAt, now)}</span>
            </div>
          </div>
          <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${pill.cls}`}>{pill.label}</span>
        </div>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section aria-label="Live activity" className="min-w-0 overflow-hidden rounded-2xl border border-line bg-card">
          {!live.loaded ? (
            <p role="status" className="px-6 py-12 text-center text-sm text-muted">Loading</p>
          ) : waiting ? (
            <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
              <span aria-hidden className="size-2 animate-pulse rounded-full bg-action" />
              <span className="text-[17px] font-bold">Waiting for the CLI to write its first message</span>
              <p className="max-w-[420px] text-sm leading-6 text-body">{live.hint ?? "The feed fills in as the agent works."}</p>
            </div>
          ) : (
            <Feed events={live.events} offline={live.offline} />
          )}
        </section>

        <aside className="flex min-w-0 flex-col gap-5">
          <div className={card}>
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-lg font-bold">Files touched</h2>
              <span className="text-[13px] text-muted">{live.filesTouched.length} {live.filesTouched.length === 1 ? "file" : "files"}</span>
            </div>
            {live.filesTouched.length === 0
              ? <p className="text-sm text-body">Nothing edited yet.</p>
              : <ul className="flex flex-col">{live.filesTouched.map((f) => (
                  <li key={f} title={f} className="truncate border-b border-row py-2 text-sm last:border-b-0">{shortPath(f)}</li>
                ))}</ul>}
          </div>

          <div className={card}>
            <h2 className="text-lg font-bold">Changes</h2>
            {ch
              ? <p className="text-sm text-body"><span className="font-bold text-ink">{ch.commits}</span> {ch.commits === 1 ? "commit" : "commits"}, <span className="font-bold text-ink">{ch.files}</span> {ch.files === 1 ? "file" : "files"} on {run.branch}</p>
              : <p className="text-sm text-body">No commits or file changes on {run.branch} yet.</p>}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {active && (
                <>
                  <HandOffMenu run={run} ctx={ctx} />
                  <button type="button" onClick={() => ctx.finishRun(run)} className={btn}>Done</button>
                  <button type="button" onClick={() => ctx.openRun(run)} className={btn}>Open terminal</button>
                </>
              )}
              {!active && <p className="text-sm text-body">This run is {pill.label.toLowerCase()}.</p>}
            </div>
          </div>
          {live.source && <p className="px-1 text-xs text-muted [overflow-wrap:anywhere]">Reading {live.source}</p>}
        </aside>
      </div>
    </div>
  );
}
