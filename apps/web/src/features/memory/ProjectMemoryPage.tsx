import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { PageHeader } from "../../components/ui/PageHeader";
import { useToast } from "../../components/ui/Toast";
import { buttonCls } from "../../components/ui/Button";
import { Skeleton } from "../../components/states";
import { memoryApi, type MemoryNote, type RepoEntry } from "./api";

const baseName = (repo: string) => repo.replace(/[\\/]+$/, "").split(/[\\/]/).pop() || repo;

function ago(iso: string): string {
  const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.floor(m / 60)}h ago` : `${Math.floor(m / 1440)}d ago`;
}

/** Custom combobox for the repo. Type to filter, or type a full path to use a new one. */
function RepoPicker({ value, repos, onPick }: { value: string; repos: RepoEntry[]; onPick: (repo: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const listId = useId();
  const inputId = useId();

  const q = query.trim();
  const options = useMemo(() => {
    const found = repos.filter((r) => r.repo.toLowerCase().includes(q.toLowerCase()));
    const custom = q && !repos.some((r) => r.repo === q) ? [{ repo: q, notes: -1 }] : [];
    return [...found, ...custom];
  }, [repos, q]);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open]);

  const choose = (repo: string) => { onPick(repo); setOpen(false); setQuery(""); };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((a) => Math.min(options.length - 1, a + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === "Enter" && open && options[active]) { e.preventDefault(); choose(options[active].repo); }
    else if (e.key === "Escape") { setOpen(false); setQuery(""); }
  };

  return (
    <div ref={root} className="relative w-full max-w-[520px]">
      <label htmlFor={inputId} className="mb-1.5 block text-meta font-bold">Repository</label>
      <div className="flex items-center gap-2 rounded-lg border border-line bg-card px-3 focus-within:border-action focus-within:ring-2 focus-within:ring-action/30">
        <svg aria-hidden width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-muted"><path d="M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2z M8 7h6" /></svg>
        <input id={inputId} role="combobox" aria-expanded={open} aria-controls={listId} aria-autocomplete="list"
          aria-activedescendant={open && options[active] ? `${listId}-${active}` : undefined}
          value={open ? query : value} placeholder={value || "Pick a repository or paste a path"} autoComplete="off" spellCheck={false}
          onFocus={() => { setOpen(true); setQuery(""); setActive(0); }}
          onChange={(e) => { setQuery(e.target.value); setActive(0); setOpen(true); }}
          onKeyDown={onKey}
          className="min-w-0 flex-1 bg-transparent py-2.5 font-sans text-sm text-ink placeholder:text-muted focus:outline-none" />
        <button type="button" tabIndex={-1} aria-label={open ? "Close repository list" : "Open repository list"} onClick={() => setOpen((o) => !o)}
          className="flex size-9 cursor-pointer items-center justify-center text-muted hover:text-ink">
          <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
        </button>
      </div>
      {open && (
        <ul id={listId} role="listbox" aria-label="Repositories" className="absolute left-0 right-0 top-full z-20 mt-1.5 max-h-64 overflow-auto rounded-card border border-line bg-card p-1 shadow-xl">
          {options.length === 0 && <li role="presentation" className="px-3 py-2 text-sm text-body">No repositories yet. Paste a full path to add one.</li>}
          {options.map((o, i) => (
            <li key={o.repo} id={`${listId}-${i}`} role="option" aria-selected={o.repo === value}
              onMouseEnter={() => setActive(i)} onMouseDown={(e) => { e.preventDefault(); choose(o.repo); }}
              className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 ${i === active ? "bg-surface" : ""}`}>
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold">{o.notes < 0 ? `Use this path` : baseName(o.repo)}</span>
                <span className="block truncate text-xs text-body">{o.repo}</span>
              </span>
              {o.notes >= 0 && <span className="shrink-0 text-xs font-bold text-muted">{o.notes} {o.notes === 1 ? "note" : "notes"}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PinIcon({ filled }: { filled: boolean }) {
  return (
    <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3h6l-1 6 3 3v2H7v-2l3-3z M12 14v7" />
    </svg>
  );
}

const iconBtn = "flex size-9 cursor-pointer items-center justify-center rounded-lg border border-transparent text-body hover:border-line hover:bg-surface hover:text-ink focus-visible:outline-2 focus-visible:outline-action";
const fieldCls = "w-full resize-y rounded-lg border border-line bg-card px-3 py-2 font-sans text-sm leading-5 text-ink placeholder:text-muted focus:border-action focus:outline-none focus-visible:ring-2 focus-visible:ring-action/30";

function NoteCard({ note, busy, onPin, onSave, onDelete }: {
  note: MemoryNote; busy: boolean; onPin: () => void; onSave: (text: string) => Promise<boolean>; onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(note.text);
  const [confirm, setConfirm] = useState(false);
  const fieldId = useId();
  return (
    <li className={`flex flex-wrap gap-x-3.5 gap-y-2 rounded-xl border px-3.5 py-4 sm:flex-nowrap sm:px-[18px] ${note.pinned ? "border-action-line bg-pick" : "border-line"}`}>
      <div className={`flex size-[34px] shrink-0 items-center justify-center rounded-lg ${note.source === "handoff" ? "bg-surface text-body" : "bg-cta text-on-cta"}`}>
        {note.source === "handoff"
          ? <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h14l-3-3 M20 17H6l3 3" /></svg>
          : <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9 M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>}
      </div>
      <div className="flex min-w-0 basis-[calc(100%-3rem)] flex-1 flex-col gap-1.5 sm:basis-0">
        {editing ? (
          <>
            <label htmlFor={fieldId} className="sr-only">Edit note</label>
            <textarea id={fieldId} value={text} rows={3} maxLength={1000} onChange={(e) => setText(e.target.value)} className={fieldCls} />
            <div className="flex gap-2">
              <button type="button" disabled={busy || !text.trim()} onClick={async () => { if (await onSave(text)) setEditing(false); }}
                className="min-h-9 cursor-pointer rounded-lg bg-cta px-3 py-1.5 text-meta font-bold text-on-cta hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">Save</button>
              <button type="button" onClick={() => { setText(note.text); setEditing(false); }} className={buttonCls("secondary", "sm")}>Cancel</button>
            </div>
          </>
        ) : (
          <p className="text-ui font-bold leading-[22px] [overflow-wrap:anywhere]">{note.text}</p>
        )}
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          {note.pinned && <span className="rounded-md bg-action-soft px-2 py-0.5 text-xs font-bold text-action">pinned</span>}
          {note.source === "handoff" && <span className="rounded-md bg-surface px-2 py-0.5 text-xs font-bold text-ink">added by handoff</span>}
          <span className="text-xs text-body">{note.source === "handoff" ? "Saved" : "Written by you"}, {ago(note.createdAt)}</span>
        </div>
      </div>
      <div className="ml-[48px] flex shrink-0 items-start gap-0.5 sm:ml-0">
        {confirm ? (
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={onDelete} disabled={busy} className="cursor-pointer min-h-9 rounded-lg bg-fail px-2.5 py-1.5 text-meta font-bold text-on-action disabled:opacity-50">Delete</button>
            <button type="button" onClick={() => setConfirm(false)} className="cursor-pointer min-h-9 rounded-lg border border-line px-2.5 py-1.5 text-meta font-bold hover:bg-surface">Keep</button>
          </div>
        ) : (
          <>
            <button type="button" aria-pressed={note.pinned} aria-label={note.pinned ? "Unpin note" : "Pin note"} title={note.pinned ? "Unpin" : "Pin so every account sees it first"} onClick={onPin} disabled={busy}
              className={`${iconBtn} ${note.pinned ? "text-action" : ""}`}><PinIcon filled={note.pinned} /></button>
            <button type="button" aria-label="Edit note" title="Edit" onClick={() => { setText(note.text); setEditing(true); }} className={iconBtn}>
              <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9 M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
            </button>
            <button type="button" aria-label="Delete note" title="Delete" onClick={() => setConfirm(true)} className={iconBtn}>
              <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13" /></svg>
            </button>
          </>
        )}
      </div>
    </li>
  );
}

export function ProjectMemoryPage({ onToast, initialRepo }: { onToast?: (message: string) => void; initialRepo?: string } = {}) {
  const [repos, setRepos] = useState<RepoEntry[]>([]);
  const [repo, setRepo] = useState<string>(initialRepo ?? "");
  const [notes, setNotes] = useState<MemoryNote[] | null>(null);
  const [draft, setDraft] = useState("");
  const [draftPinned, setDraftPinned] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const addId = useId();

  const say = useCallback((m: string) => (onToast ?? toast.info)(m), [onToast, toast]);

  const loadRepos = useCallback(async () => {
    try {
      const r = await memoryApi.repos();
      setRepos(r);
      setRepo((cur) => cur || r[0]?.repo || "");
    } catch (e) { say((e as Error).message); }
  }, [say]);
  useEffect(() => { void loadRepos(); }, [loadRepos]);

  const loadNotes = useCallback(async (r: string) => {
    if (!r) { setNotes(null); return; }
    try { setNotes((await memoryApi.get(r)).notes); } catch (e) { setNotes([]); say((e as Error).message); }
  }, [say]);
  useEffect(() => { setNotes(null); void loadNotes(repo); }, [repo, loadNotes]);

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true);
    try { await fn(); await loadNotes(repo); void loadRepos(); if (ok) say(ok); return true; }
    catch (e) { say((e as Error).message); return false; }
    finally { setBusy(false); }
  };

  const sorted = useMemo(() => [...(notes ?? [])].sort((a, b) => Number(b.pinned) - Number(a.pinned) || Date.parse(b.createdAt) - Date.parse(a.createdAt)), [notes]);
  const repoList = useMemo(() => (repo && !repos.some((r) => r.repo === repo) ? [{ repo, notes: notes?.length ?? 0 }, ...repos] : repos), [repos, repo, notes]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || !repo) return;
    if (await run(() => memoryApi.add(repo, draft, draftPinned), "Note saved. Every account will see it.")) { setDraft(""); setDraftPinned(false); }
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader eyebrow={`Project memory${repo ? ` · ${baseName(repo)} · ${notes?.length ?? 0} ${notes?.length === 1 ? "note" : "notes"}` : ""} · read by every account before it starts`}
        title="What the crew has learned about this repo" />

      <RepoPicker value={repo} repos={repoList} onPick={setRepo} />

      <div className="flex flex-col items-stretch gap-5 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-2.5">
          {repo && (
            <form onSubmit={add} className="flex flex-col gap-2.5 rounded-card border border-line p-[18px]">
              <label htmlFor={addId} className="text-meta font-bold">Add a note</label>
              <textarea id={addId} value={draft} rows={2} maxLength={1000} onChange={(e) => setDraft(e.target.value)} className={fieldCls}
                placeholder="Something a worker would otherwise learn the hard way" />
              <div className="flex items-center justify-between gap-3">
                <button type="button" aria-pressed={draftPinned} onClick={() => setDraftPinned((p) => !p)}
                  className={`flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-meta font-bold ${draftPinned ? "border-action bg-action-soft text-action" : "border-line text-body hover:text-ink"}`}>
                  <PinIcon filled={draftPinned} /> Pin it
                </button>
                <button type="submit" disabled={busy || !draft.trim()} className={buttonCls("primary", "md")}>Add note</button>
              </div>
            </form>
          )}
          {!repo && <p className="rounded-xl border border-dashed border-line px-[18px] py-6 text-sm text-body">Start a run on a repository, or paste a path above, and its notes appear here.</p>}
          {repo && notes === null && <Skeleton rows={3} label="Loading notes" />}
          {repo && notes?.length === 0 && <p className="rounded-xl border border-dashed border-line px-[18px] py-6 text-sm text-body">No notes for this repo yet. Notes you add, and a line from each handoff, are shown to every account at the start of a run.</p>}
          <ul className="flex flex-col gap-2.5" aria-label="Notes">
            {sorted.map((n) => (
              <NoteCard key={n.id} note={n} busy={busy}
                onPin={() => void run(() => memoryApi.update(repo, n.id, { pinned: !n.pinned }), n.pinned ? "Unpinned" : "Pinned. Every account sees it first.")}
                onSave={(text) => run(() => memoryApi.update(repo, n.id, { text }), "Note updated")}
                onDelete={() => void run(() => memoryApi.remove(repo, n.id), "Note deleted")} />
            ))}
          </ul>
        </div>

        <aside className="flex w-full shrink-0 lg:w-[320px] flex-col gap-3.5 rounded-card border border-line bg-surface p-5">
          <p className="text-meta font-bold tracking-[0.06em] text-action">HOW IT REACHES THE WORKERS</p>
          <p className="text-sm leading-5 text-body">Pinned notes come first, then the rest. The list is added to the end of HANDOFF.md, so Claude, Codex and Gemini all read it the same way.</p>
          <ul className="flex flex-col gap-1.5 rounded-control border border-line bg-card p-3 text-meta leading-[19px] text-nav">
            <li>Handoffs add one short line on their own</li>
            <li>Edit or delete any line at any time</li>
            <li>Notes stay on this machine, one file per repo</li>
          </ul>
        </aside>
      </div>
    </div>
  );
}
