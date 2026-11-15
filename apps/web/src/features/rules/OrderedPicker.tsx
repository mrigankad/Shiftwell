import type { Account } from "../../api";
import { CrewAvatar } from "../../crew";

const icon = "flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-line bg-card text-body hover:bg-surface hover:text-ink disabled:cursor-not-allowed disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-action";

/**
 * Multi-select where order matters. The top list is the chosen accounts in order of preference
 * (move up, move down, remove). The bottom list holds the accounts not chosen yet.
 */
export function OrderedPicker({ accounts, value, onChange, label }: { accounts: Account[]; value: string[]; onChange: (v: string[]) => void; label: string }) {
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const chosen = value.map((id) => byId.get(id)).filter((a): a is Account => !!a);
  const rest = accounts.filter((a) => !value.includes(a.id));
  const move = (i: number, d: number) => {
    const next = [...value];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-2">
      {chosen.length === 0 ? (
        <p className="rounded-lg bg-surface px-3 py-3 text-sm text-muted">No accounts chosen. Add one below, or leave empty to use the account with the most room.</p>
      ) : (
        <ol className="flex flex-col gap-1.5">
          {chosen.map((a, i) => (
            <li key={a.id} className="flex items-center gap-2.5 rounded-xl border border-line bg-card py-1.5 pl-3 pr-1.5">
              <span aria-hidden className="w-4 text-[13px] font-bold text-muted">{i + 1}</span>
              <CrewAvatar provider={a.provider} preset={a.api?.preset} size={26} state={a.usage.state} />
              <span className="min-w-0 flex-1 truncate text-sm font-bold">{a.name}</span>
              <button type="button" aria-label={`Move ${a.name} up`} disabled={i === 0} onClick={() => move(i, -1)} className={icon}>
                <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 7.5L6 4l3.5 3.5" /></svg>
              </button>
              <button type="button" aria-label={`Move ${a.name} down`} disabled={i === chosen.length - 1} onClick={() => move(i, 1)} className={icon}>
                <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 4.5L6 8l3.5-3.5" /></svg>
              </button>
              <button type="button" aria-label={`Remove ${a.name}`} onClick={() => onChange(value.filter((x) => x !== a.id))} className={icon}>
                <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M2 2l6 6M8 2l-6 6" /></svg>
              </button>
            </li>
          ))}
        </ol>
      )}
      {rest.length > 0 && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Accounts you can add">
          {rest.map((a) => (
            <button key={a.id} type="button" onClick={() => onChange([...value, a.id])}
              className="flex cursor-pointer items-center gap-2 min-h-9 rounded-full border border-dashed border-line py-1 pl-1.5 pr-3 text-[13px] font-bold text-body hover:bg-surface hover:text-ink focus-visible:outline-2 focus-visible:outline-action">
              <CrewAvatar provider={a.provider} preset={a.api?.preset} size={20} state={a.usage.state} />
              Add {a.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
