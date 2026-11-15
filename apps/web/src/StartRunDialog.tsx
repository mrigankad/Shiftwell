import { useEffect, useRef, useState } from "react";
import type { Account } from "./api";
import { CrewAvatar } from "./crew";
import { buttonCls } from "./components/ui/Button";
import { CheckBox, Segmented } from "./ui";

export type StartInput = { profileId: string; repo: string; task: string } | { profileIds: string[]; repo: string; task: string };
const MAX_PARALLEL = 6;

const REPO_KEY = "shiftwell.lastRepo";
const readRepo = () => { try { return localStorage.getItem(REPO_KEY) ?? ""; } catch { return ""; } };
const saveRepo = (v: string) => { try { localStorage.setItem(REPO_KEY, v); } catch { /* private mode */ } };

/** Pick an account, a repository and a task. Accounts with the most room come first. */
export function StartRunDialog({ accounts, onClose, onStart }: {
  accounts: Account[];
  onClose: () => void;
  onStart: (input: StartInput) => Promise<void>;
}) {
  const usable = [...accounts]
    .sort((x, y) => rank(x) - rank(y));
  const [profileId, setProfileId] = useState(usable.find((a) => a.usage.state !== "out")?.id ?? usable[0]?.id ?? "");
  const [mode, setMode] = useState<"one" | "many">("one");
  const [picked, setPicked] = useState<string[]>([]);
  const [repo, setRepo] = useState(readRepo);
  const [task, setTask] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const taskRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    taskRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      saveRepo(repo.trim());
      await onStart(mode === "many" ? { profileIds: picked, repo: repo.trim(), task } : { profileId, repo: repo.trim(), task });
    }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  };

  const toggle = (id: string) => setPicked((p) => p.includes(id) ? p.filter((x) => x !== id) : p.length < MAX_PARALLEL ? [...p, id] : p);
  const many = mode === "many";
  const selected = many ? usable.filter((a) => picked.includes(a.id)) : usable.filter((a) => a.id === profileId);
  const missing = selected.filter((a) => a.provider === "api" && a.keyPresent === false);
  const ready = missing.length === 0 && (many ? picked.length >= 2 : !!profileId);
  const input = "rounded-lg border border-line px-3 py-2.5 text-ui outline-none focus:border-action";
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6" onMouseDown={onClose}>
      <form role="dialog" aria-modal="true" aria-labelledby="run-title" onMouseDown={(e) => e.stopPropagation()} onSubmit={submit}
        className="flex max-h-[calc(100dvh-24px)] w-full max-w-[600px] flex-col gap-5 overflow-y-auto rounded-t-2xl bg-card p-5 shadow-2xl sm:max-h-[calc(100dvh-48px)] sm:rounded-card sm:p-6">
        <div className="flex flex-col gap-1">
          <h2 id="run-title" className="text-h3 font-bold tracking-[-0.02em]">Start a run</h2>
          <p className="text-sm text-body">Shiftwell makes a fresh git worktree on its own branch and opens the account's CLI there with your task.</p>
        </div>

        {usable.length === 0 ? (
          <p className="rounded-lg bg-surface px-3 py-3 text-sm text-body">Add an account first.</p>
        ) : (
          <>
            <Segmented label="Run mode" value={mode} onChange={setMode} options={[{ id: "one", label: "One account" }, { id: "many", label: "Several in parallel" }]} />
            {many && (
              <div className="flex items-center justify-between gap-3 text-xs text-body">
                <span>Each account gets its own worktree and branch, so you can compare the results.</span>
                <span className="shrink-0 font-bold text-ink">{picked.length} of {MAX_PARALLEL} selected</span>
              </div>
            )}
            <div role={many ? "group" : "radiogroup"} aria-label="Account" className="flex max-h-[220px] flex-col gap-2 overflow-y-auto">
              {usable.map((a) => {
                const on = many ? picked.includes(a.id) : profileId === a.id;
                const out = a.usage.state === "out";
                const full = many && !on && picked.length >= MAX_PARALLEL;
                const body = (
                  <>
                    {many && <CheckBox checked={on} onChange={() => toggle(a.id)} disabled={full} />}
                    <CrewAvatar provider={a.provider} preset={a.api?.preset} name={a.name} size={32} state={a.usage.state} />
                    <span className="flex flex-1 flex-col">
                      <span className="text-ui font-bold">{a.name}</span>
                      <span className="text-xs text-body">{roomText(a)}</span>
                    </span>
                    {a.provider === "api" && a.keyPresent === false && <span className="rounded-full bg-warn-soft px-2.5 py-0.5 text-xs font-bold text-warn">Key missing</span>}
                    {out && <span className="rounded-full bg-fail-soft px-2.5 py-0.5 text-xs font-bold text-fail">Out</span>}
                  </>
                );
                const cls = `flex items-center gap-3 rounded-xl px-3 py-2.5 text-left ${on ? "border-2 border-action bg-pick" : "border border-line"}`;
                return many ? (
                  <div key={a.id} onClick={() => { if (!full) toggle(a.id); }} className={`${cls} ${full ? "opacity-50" : "cursor-pointer hover:bg-surface"}`}>{body}</div>
                ) : (
                  <button type="button" role="radio" aria-checked={on} key={a.id} onClick={() => setProfileId(a.id)} className={`${cls} cursor-pointer hover:bg-surface`}>{body}</button>
                );
              })}
            </div>
          </>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-bold">Repository folder</span>
          <input value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="C:\Users\you\code\my-app" className={input} spellCheck={false} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-bold">Task</span>
          <textarea ref={taskRef} value={task} onChange={(e) => setTask(e.target.value)} rows={3} placeholder="Add rate limiting to the login route and cover it with tests" className={`${input} resize-none`} />
        </label>

        {missing.length > 0 && (
          <p className="rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">
            {missing.map((a) => `${a.name} needs ${a.api?.keyEnv ?? "its key variable"}`).join(", ")}. Set it in the environment, then restart Shiftwell.
          </p>
        )}

        {error && <p className="rounded-lg bg-fail-soft px-3 py-2 text-sm font-bold text-fail">{error}</p>}

        <div className="flex flex-wrap justify-end gap-2.5">
          <button type="button" onClick={onClose} className={buttonCls("secondary", "md")}>Cancel</button>
          <button type="submit" disabled={busy || !ready || !repo.trim() || !task.trim()} className={buttonCls("accent", "md")}>
            {busy ? "Starting..." : many ? (picked.length < 2 ? "Pick 2 or more" : `Start ${picked.length} runs`) : "Start run"}
          </button>
        </div>
      </form>
    </div>
  );
}

function worst(a: Account): number | null {
  const l = a.usage.latest;
  if (!l) return null;
  const v = [l.fiveHour?.pct, l.sevenDay?.pct, l.daily?.pct].filter((x): x is number => typeof x === "number");
  return v.length ? Math.max(...v) : null;
}
const rank = (a: Account) => worst(a) ?? 50;
function roomText(a: Account): string {
  const w = worst(a);
  return w === null ? "No usage reading yet" : `${Math.round(100 - w)}% left on its tightest limit`;
}
