import { useState } from "react";
import type { Run } from "./api";
import { CheckBox, Modal } from "./ui";

export function FinishRunDialog({ run, onClose, onFinish }: {
  run: Run; onClose: () => void; onFinish: (removeWorktree: boolean) => Promise<void>;
}) {
  const [remove, setRemove] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try { await onFinish(remove); }
    catch (err) { setError((err as Error).message); setBusy(false); }
  };
  return (
    <Modal titleId="finish-title" onClose={onClose} onSubmit={submit} width={460}>
      <div className="flex flex-col gap-1">
        <h2 id="finish-title" className="text-[22px] font-bold tracking-[-0.02em]">Mark run done</h2>
        <p className="truncate text-sm text-body">{run.task}</p>
        <span className="text-xs text-muted">Branch {run.branch}</span>
      </div>
      <div className="flex items-start gap-3">
        <CheckBox checked={remove} onChange={setRemove} className="mt-0.5" />
        <span className="flex flex-col gap-0.5 text-left">
          <span onClick={() => setRemove((v) => !v)} className="cursor-pointer text-sm font-bold">Also delete its worktree folder</span>
          <span className="text-xs leading-[18px] text-body">The branch stays so you can still merge it.</span>
        </span>
      </div>
      {error && <p role="alert" className="rounded-lg bg-fail-soft px-3 py-2 text-sm font-bold text-fail">{error}</p>}
      <div className="flex flex-wrap justify-end gap-2.5">
        <button type="button" onClick={onClose} className="min-h-10 cursor-pointer rounded-lg border border-line px-4 py-2.5 text-sm font-bold hover:bg-surface">Cancel</button>
        <button type="submit" data-autofocus disabled={busy} className="min-h-10 cursor-pointer rounded-lg bg-action px-4 py-2.5 text-sm font-bold text-on-action disabled:cursor-not-allowed disabled:opacity-50">
          {busy ? "Finishing..." : "Mark done"}
        </button>
      </div>
    </Modal>
  );
}
