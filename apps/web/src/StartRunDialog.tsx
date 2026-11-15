import { useEffect, useRef, useState } from "react";
import type { Account } from "./api";
import { CrewAvatar } from "./crew";

const REPO_KEY = "shiftwell.lastRepo";
const readRepo = () => { try { return localStorage.getItem(REPO_KEY) ?? ""; } catch { return ""; } };
const saveRepo = (v: string) => { try { localStorage.setItem(REPO_KEY, v); } catch { /* private mode */ } };

/** Pick an account, a repository and a task. Accounts with the most room come first. */
export function StartRunDialog({ accounts, onClose, onStart }: {
  accounts: Account[];
  onClose: () => void;
  onStart: (input: { profileId: string; repo: string; task: string }) => Promise<void>;
}) {
  const usable = accounts
    .filter((a) => a.provider !== "api")
    .sort((x, y) => rank(x) - rank(y));
  const [profileId, setProfileId] = useState(usable.find((a) => a.usage.state !== "out")?.id ?? usable[0]?.id ?? "");
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
    try { saveRepo(repo.trim()); await onStart({ profileId, repo: repo.trim(), task }); }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  };

  const input = "rounded-lg border border-line px-3 py-2.5 text-[15px] outline-none focus:border-action";
  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/40 p-6" onMouseDown={onClose}>
      <form role="dialog" aria-modal="true" aria-labelledby="run-title" onMouseDown={(e) => e.stopPropagation()} onSubmit={submit}
        className="flex w-full max-w-[600px] flex-col gap-5 rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex flex-col gap-1">
          <h2 id="run-title" className="text-[22px] font-bold tracking-[-0.02em]">Start a run</h2>
          <p className="text-sm text-body">Shiftwell makes a fresh git worktree on its own branch and opens the account's CLI there with your task.</p>
        </div>

        {usable.length === 0 ? (
          <p className="rounded-lg bg-surface px-3 py-3 text-sm text-body">Add a Claude Code, Codex or Gemini account first. API key accounts cannot run a CLI agent yet.</p>
        ) : (
          <div role="radiogroup" aria-label="Account" className="flex max-h-[220px] flex-col gap-2 overflow-y-auto">
            {usable.map((a) => {
              const on = profileId === a.id;
              const out = a.usage.state === "out";
              return (
                <button type="button" role="radio" aria-checked={on} key={a.id} onClick={() => setProfileId(a.id)}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left ${on ? "border-2 border-action bg-[#FFFAF6]" : "border border-line hover:bg-surface"}`}>
                  <CrewAvatar provider={a.provider} size={32} state={a.usage.state} />
                  <span className="flex flex-1 flex-col">
                    <span className="text-[15px] font-bold">{a.name}</span>
                    <span className="text-xs text-body">{roomText(a)}</span>
                  </span>
                  {out && <span className="rounded-full bg-fail-soft px-2.5 py-0.5 text-xs font-bold text-fail">Out</span>}
                </button>
              );
            })}
          </div>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-bold">Repository folder</span>
          <input value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="C:\Users\you\code\my-app" className={input} spellCheck={false} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-bold">Task</span>
          <textarea ref={taskRef} value={task} onChange={(e) => setTask(e.target.value)} rows={3} placeholder="Add rate limiting to the login route and cover it with tests" className={`${input} resize-none`} />
        </label>

        {error && <p className="rounded-lg bg-fail-soft px-3 py-2 text-sm font-bold text-fail">{error}</p>}

        <div className="flex justify-end gap-2.5">
          <button type="button" onClick={onClose} className="cursor-pointer rounded-lg border border-line px-4 py-2.5 text-sm font-bold hover:bg-surface">Cancel</button>
          <button type="submit" disabled={busy || !profileId || !repo.trim() || !task.trim()} className="cursor-pointer rounded-lg bg-action px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
            {busy ? "Starting…" : "Start run"}
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
