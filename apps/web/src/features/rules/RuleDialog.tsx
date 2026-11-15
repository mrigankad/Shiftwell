import { useState } from "react";
import type { Account } from "../../api";
import { Modal, Segmented } from "../../ui";
import { Switch } from "../guardrails/controls";
import { OrderedPicker } from "./OrderedPicker";
import type { Rule, RuleInput } from "./api";

const field = "rounded-lg border border-line bg-card px-3 py-2.5 text-[15px] outline-none focus:border-action";

export function RuleDialog({ rule, accounts, onClose, onSave, onDelete }: {
  rule: Rule | null;
  accounts: Account[];
  onClose: () => void;
  onSave: (input: RuleInput) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const [name, setName] = useState(rule?.name ?? "");
  const [enabled, setEnabled] = useState(rule?.enabled ?? true);
  const [task, setTask] = useState(rule?.when.taskMatches ?? "");
  const [repo, setRepo] = useState(rule?.when.repoMatches ?? "");
  const [prefer, setPrefer] = useState<string[]>(rule?.prefer ?? []);
  const [fallback, setFallback] = useState<Rule["fallback"]>(rule?.fallback ?? "most-headroom");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setError(null);
    try { await fn(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    void run(() => onSave({ name: name.trim(), enabled, when: { ...(task.trim() ? { taskMatches: task.trim() } : {}), ...(repo.trim() ? { repoMatches: repo.trim() } : {}) }, prefer, fallback }));
  };

  return (
    <Modal titleId="rule-title" onClose={onClose} onSubmit={submit} width={560}>
      <div className="-m-1 flex max-h-[calc(100dvh-5rem)] flex-col gap-5 overflow-y-auto p-1">
      <div className="flex flex-col gap-1">
        <h2 id="rule-title" className="text-[22px] font-bold tracking-[-0.02em]">{rule ? "Edit rule" : "New rule"}</h2>
        <p className="text-sm text-body">The first enabled rule that matches a task decides which account gets it.</p>
      </div>
      <label className="flex flex-col gap-1.5 text-sm font-bold">
        Name
        <input data-autofocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Refactors go to Claude" className={`${field} font-normal`} />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm font-bold">
          Task contains
          <input value={task} onChange={(e) => setTask(e.target.value)} placeholder="refactor, bug fix" className={`${field} font-normal`} />
          <span className="text-xs font-normal text-muted">Keywords separated by commas. Leave empty to match any task.</span>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-bold">
          Repository path contains
          <input value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="web, billing" className={`${field} font-normal`} />
          <span className="text-xs font-normal text-muted">Leave empty to match any repository.</span>
        </label>
      </div>
      <div className="flex flex-col gap-1.5">
        <span id="rule-prefer" className="text-sm font-bold">Send to, in this order</span>
        <OrderedPicker label="Preferred accounts" accounts={accounts} value={prefer} onChange={setPrefer} />
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-bold">If none of them have room</span>
        <Segmented label="Fallback" value={fallback} onChange={setFallback}
          options={[{ id: "most-headroom", label: "Use the most room" }, { id: "none", label: "Try the next rule" }]} />
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-bold">Rule is on</span>
        <Switch label="Rule is on" checked={enabled} onChange={setEnabled} />
      </div>
      {error && <p role="alert" className="rounded-lg bg-fail-soft px-3 py-2 text-sm font-bold text-fail">{error}</p>}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {onDelete ? (
          <button type="button" disabled={busy} onClick={() => void run(onDelete)}
            className="min-h-9 cursor-pointer rounded-lg px-3 py-2 text-sm font-bold text-fail hover:bg-fail-soft disabled:opacity-40">Delete rule</button>
        ) : <span />}
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="min-h-9 cursor-pointer rounded-lg border border-line px-4 py-2 text-sm font-bold hover:bg-surface">Cancel</button>
          <button type="submit" disabled={busy || !name.trim()} className="min-h-9 cursor-pointer rounded-lg bg-cta px-4 py-2 text-sm font-bold text-on-cta disabled:cursor-not-allowed disabled:opacity-40">{busy ? "Saving" : "Save rule"}</button>
        </div>
      </div>
      </div>
    </Modal>
  );
}
