import { Fragment, useEffect, useState, type ReactNode } from "react";
import { api, type Run } from "../api";
import { CrewAvatar } from "../crew";
import { EmptyState, PageTitle, ago, type PageCtx } from "./shared";

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
    p.startsWith("**") && p.endsWith("**") && p.length > 4 ? <strong key={i} className="font-bold text-ink">{p.slice(2, -2)}</strong> : <Fragment key={i}>{p}</Fragment>);
}

/** Tiny markdown: headings, bold, fenced blocks, paragraphs. */
function Note({ md }: { md: string }) {
  const out: ReactNode[] = [];
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  let para: string[] = [];
  const flush = () => {
    if (para.length) out.push(<p key={out.length} className="text-sm leading-6 text-body">{inline(para.join(" "))}</p>);
    para = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.trim().startsWith("```")) {
      flush();
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) code.push(lines[i++]);
      out.push(<pre key={out.length} className="overflow-x-auto whitespace-pre-wrap rounded-lg border border-line bg-surface px-3 py-2.5 font-sans text-[13px] leading-5 text-ink">{code.join("\n")}</pre>);
      continue;
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(l);
    if (h) {
      flush();
      out.push(<h3 key={out.length} className={`pt-1 font-bold tracking-[-0.01em] text-ink ${h[1].length <= 1 ? "text-lg" : "text-[15px]"}`}>{inline(h[2])}</h3>);
    } else if (l.trim() === "") flush();
    else para.push(l.trim());
  }
  flush();
  return <div className="flex flex-col gap-3">{out}</div>;
}

type NoteState =
  | { id: string; status: "loading" }
  | { id: string; status: "error"; message: string }
  | { id: string; status: "ready"; note: string };

export function HandoffsPage({ ctx }: { ctx: PageCtx }) {
  const list = ctx.runs.filter((r) => r.fromRunId).sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState<NoteState | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!selected) return;
    let live = true;
    setNote({ id: selected, status: "loading" });
    api.note(selected)
      .then((r) => { if (live) setNote({ id: selected, status: "ready", note: r.note }); })
      .catch((e: Error) => { if (live) setNote({ id: selected, status: "error", message: e.message }); });
    return () => { live = false; };
  }, [selected, attempt]);

  const sel = list.find((r) => r.id === selected);
  const fromRun = (r: Run) => ctx.runs.find((x) => x.id === r.fromRunId);

  return (
    <div className="flex flex-col gap-5 px-7 py-6">
      <PageTitle title="Handoffs" eyebrow={`${list.length} ${list.length === 1 ? "handoff" : "handoffs"}, newest first`} />
      {list.length === 0 ? (
        <EmptyState title="No handoffs yet"
          body="A handoff moves a run from an account that is running low to another one. The next account opens in the same worktree and reads a HANDOFF.md note with the task, the changes so far and what is left. Hand off from any active run and it will appear here." />
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start gap-5">
          <div role="listbox" aria-label="Handoffs" className="overflow-hidden rounded-xl border border-line">
            {list.map((r) => {
              const from = fromRun(r);
              const on = r.id === selected;
              return (
                <button key={r.id} role="option" aria-selected={on} onClick={() => setSelected(r.id)}
                  className={`flex w-full cursor-pointer flex-col gap-2 border-b border-row px-4 py-3 text-left last:border-b-0 ${on ? "bg-pick" : "hover:bg-surface"}`}>
                  <span className="flex items-center gap-2">
                    <CrewAvatar provider={from ? ctx.providerOf(from.profileId) : "api"} size={28} />
                    <span className="truncate text-sm font-bold">{from ? ctx.nameOf(from.profileId) : "Removed account"}</span>
                    <span className="text-sm text-muted">→</span>
                    <CrewAvatar provider={ctx.providerOf(r.profileId)} size={28} />
                    <span className="truncate text-sm font-bold">{ctx.nameOf(r.profileId)}</span>
                    <span className="flex-1" />
                    <span className="shrink-0 text-xs text-muted">{ago(r.startedAt)}</span>
                  </span>
                  <span className="truncate text-[15px]">{r.task}</span>
                </button>
              );
            })}
          </div>

          <div className="min-h-[240px] rounded-xl border border-line bg-card p-5" aria-live="polite">
            {!sel || !note ? (
              <p className="text-sm text-body">Select a handoff to read its note.</p>
            ) : note.status === "loading" ? (
              <p className="text-sm text-body">Loading note...</p>
            ) : note.status === "error" ? (
              <div className="flex flex-col items-start gap-3">
                <p className="rounded-lg bg-fail-soft px-3 py-2 text-sm font-bold text-fail">{note.message}</p>
                <button onClick={() => setAttempt((n) => n + 1)} className="cursor-pointer rounded-lg border border-line px-3 py-1.5 text-[13px] font-bold hover:bg-surface">Try again</button>
              </div>
            ) : note.note.trim() ? (
              <Note md={note.note} />
            ) : (
              <p className="text-sm text-body">This handoff has an empty note.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
