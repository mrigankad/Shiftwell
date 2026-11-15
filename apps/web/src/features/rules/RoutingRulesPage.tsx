import { useCallback, useEffect, useState } from "react";
import type { Account } from "../../api";
import { CrewAvatar } from "../../crew";
import { EmptyState, PageTitle } from "../../pages/shared";
import { Switch } from "../guardrails/controls";
import { rulesApi, type PickResult, type Rule } from "./api";
import { buttonCls } from "../../components/ui/Button";
import { Skeleton } from "../../components/states";
import { ErrorState } from "../../components/states";
import { RuleDialog } from "./RuleDialog";

const chip = "max-w-full rounded-lg [overflow-wrap:anywhere] bg-surface px-2.5 py-1 text-sm font-bold";
const arrow = "flex size-9 cursor-pointer items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-ink disabled:cursor-not-allowed disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-action";

function Sentence({ rule, accounts }: { rule: Rule; accounts: Account[] }) {
  const who = rule.prefer.map((id) => accounts.find((a) => a.id === id)).filter((a): a is Account => !!a);
  const t = rule.when.taskMatches, r = rule.when.repoMatches;
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5 text-sm">
      {t || r ? (
        <>
          {t && <><span className="font-bold">If task has</span><span className={chip}>{t}</span></>}
          {r && <><span className="font-bold">{t ? "in" : "If repository has"}</span><span className={chip}>{r}</span></>}
        </>
      ) : <span className="font-bold">Any task</span>}
      <span className="text-body">send to</span>
      {who.length === 0 ? <span className={chip}>the account with most room</span> : who.map((a, i) => (
        <span key={a.id} className="flex min-w-0 items-center gap-2">
          {i > 0 && <span className="text-body">then</span>}
          <span className={`${chip} flex min-w-0 items-center gap-1.5 !pl-1.5 [overflow-wrap:anywhere]`}><CrewAvatar provider={a.provider} preset={a.api?.preset} name={a.name} size={20} />{a.name}</span>
        </span>
      ))}
      {who.length > 0 && rule.fallback === "most-headroom" && <span className="text-body">else most room</span>}
    </div>
  );
}

function TryIt({ accounts }: { accounts: Account[] }) {
  const [task, setTask] = useState("");
  const [repo, setRepo] = useState("");
  const [result, setResult] = useState<PickResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const go = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null); setResult(null);
    try { setResult(await rulesApi.pick(task, repo.trim())); } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  };
  const chosen = accounts.find((a) => a.id === result?.profileId);
  const field = "rounded-lg border border-line bg-card px-3 py-2.5 text-ui outline-none focus:border-action";
  return (
    <form onSubmit={go} aria-labelledby="try-title" className="flex flex-col gap-3 rounded-card border border-line bg-card p-5">
      <h2 id="try-title" className="text-lg font-bold">Try it</h2>
      <p className="text-sm leading-6 text-body">Type a task and see which account the rules would pick right now. Nothing is started.</p>
      <label className="flex flex-col gap-1.5 text-sm font-bold">
        Task
        <textarea value={task} onChange={(e) => setTask(e.target.value)} rows={3} placeholder="Fix the flaky login test" className={`${field} resize-none font-normal`} />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-bold">
        Repository path (optional)
        <input value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="C:\code\web" className={`${field} font-normal`} />
      </label>
      <button type="submit" disabled={busy || !task.trim()} className={buttonCls("primary", "md", "self-start")}>
        {busy ? "Picking" : "Pick an account"}
      </button>
      <div aria-live="polite">
        {error && <p role="alert" className="rounded-lg bg-fail-soft px-3 py-2 text-sm font-bold text-fail">{error}</p>}
        {result && (
          <div className="flex flex-col gap-2 rounded-xl bg-surface p-3.5">
            {result.profileId ? (
              <div className="flex items-center gap-2.5">
                {chosen && <CrewAvatar provider={chosen.provider} preset={chosen.api?.preset} size={32} state={chosen.usage.state} />}
                <span className="text-title font-bold">{result.profileName}</span>
              </div>
            ) : <span className="text-title font-bold">No account right now</span>}
            <p className="text-sm leading-6 text-body">{result.reason}</p>
          </div>
        )}
      </div>
    </form>
  );
}

export function RoutingRulesPage({ accounts }: { accounts: Account[] }) {
  const [rules, setRules] = useState<Rule[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Rule | "new" | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const load = useCallback(() => rulesApi.list().then(setRules).catch((e) => setError((e as Error).message)), []);
  useEffect(() => { void load(); }, [load]);

  const fail = (e: unknown) => setError((e as Error).message);
  const reorder = async (ids: string[]) => {
    if (!rules) return;
    const before = rules;
    setRules(ids.map((id) => before.find((r) => r.id === id)!));
    setError(null);
    try { setRules(await rulesApi.reorder(ids)); } catch (e) { setRules(before); fail(e); }
  };
  const move = (i: number, d: number) => {
    if (!rules) return;
    const ids = rules.map((r) => r.id);
    const j = i + d;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    void reorder(ids);
  };
  const drop = (targetId: string) => {
    if (!rules || !dragId || dragId === targetId) return;
    const ids = rules.map((r) => r.id).filter((id) => id !== dragId);
    ids.splice(ids.indexOf(targetId), 0, dragId);
    void reorder(ids);
  };
  const toggle = async (r: Rule, enabled: boolean) => {
    setError(null);
    try { const { id, ...rest } = r; await rulesApi.update(id, { ...rest, enabled }); await load(); } catch (e) { fail(e); }
  };

  if (!rules) {
    return (
      <div className="flex flex-col gap-6">
        <PageTitle title="Routing rules" />
        {error ? <ErrorState title="Could not load rules" body={error} /> : <Skeleton rows={3} label="Loading rules" />}
      </div>
    );
  }
  const active = rules.filter((r) => r.enabled).length;

  return (
    <div className="flex flex-col gap-6">
      <PageTitle eyebrow={`Routing rules · ${active} on · applied in order`} title="Tell the crew who takes what">
        <button type="button" onClick={() => setEditing("new")} className="cursor-pointer min-h-9 shrink-0 rounded-lg bg-cta px-4 py-2 text-sm font-bold text-on-cta">New rule</button>
      </PageTitle>
      <div aria-live="polite">{error && <p role="alert" className="rounded-lg bg-fail-soft px-3 py-2 text-sm font-bold text-fail">{error}</p>}</div>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-3">
          {rules.length === 0 && <EmptyState title="No rules yet" body="Without rules, every task goes to the account with the most room. Add a rule to send certain tasks to certain accounts." />}
          <ol className="flex flex-col gap-3" aria-label="Routing rules in order">
            {rules.map((r, i) => (
              <li key={r.id} draggable onDragStart={(e) => { setDragId(r.id); e.dataTransfer.effectAllowed = "move"; }}
                onDragOver={(e) => { e.preventDefault(); setOverId(r.id); }} onDragLeave={() => setOverId((o) => (o === r.id ? null : o))}
                onDrop={(e) => { e.preventDefault(); drop(r.id); setDragId(null); setOverId(null); }} onDragEnd={() => { setDragId(null); setOverId(null); }}
                className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border bg-card px-3 py-3 sm:flex-nowrap ${overId === r.id && dragId !== r.id ? "border-action" : "border-line"} ${dragId === r.id ? "opacity-50" : ""} ${r.enabled ? "" : "opacity-70"}`}>
                <div className="flex shrink-0 flex-col items-center">
                  <button type="button" aria-label={`Move ${r.name} up`} disabled={i === 0} onClick={() => move(i, -1)} className={arrow}>
                    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 7.5L6 4l3.5 3.5" /></svg>
                  </button>
                  <span aria-hidden className="text-meta font-bold text-muted">{i + 1}</span>
                  <button type="button" aria-label={`Move ${r.name} down`} disabled={i === rules.length - 1} onClick={() => move(i, 1)} className={arrow}>
                    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 4.5L6 8l3.5-3.5" /></svg>
                  </button>
                </div>
                <div className="flex min-w-0 basis-[calc(100%-3rem)] flex-col gap-1.5 sm:flex-1 sm:basis-0">
                  <span className="text-meta font-bold text-muted">{r.name}</span>
                  <Sentence rule={r} accounts={accounts} />
                </div>
                <button type="button" onClick={() => setEditing(r)} aria-label={`Edit ${r.name}`}
                  className="ml-auto min-h-9 shrink-0 cursor-pointer rounded-lg border border-line px-3 py-1.5 text-meta font-bold hover:bg-surface sm:ml-0">Edit</button>
                <Switch label={`${r.name} is on`} checked={r.enabled} onChange={(v) => void toggle(r, v)} />
              </li>
            ))}
          </ol>
          <button type="button" onClick={() => setEditing("new")}
            className="cursor-pointer rounded-xl border border-dashed border-line min-h-11 py-3.5 text-sm font-bold text-body hover:bg-surface hover:text-ink">+ Add a rule</button>
        </div>
        <TryIt accounts={accounts} />
      </div>
      {editing && (
        <RuleDialog rule={editing === "new" ? null : editing} accounts={accounts} onClose={() => setEditing(null)}
          onSave={async (input) => {
            if (editing === "new") await rulesApi.create(input); else await rulesApi.update(editing.id, input);
            setEditing(null); await load();
          }}
          onDelete={editing === "new" ? undefined : async () => { await rulesApi.remove(editing.id); setEditing(null); await load(); }} />
      )}
    </div>
  );
}
