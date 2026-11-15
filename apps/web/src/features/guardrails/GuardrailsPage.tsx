import { useEffect, useId, useState, type ReactNode } from "react";
import type { Account } from "../../api";
import { CrewAvatar } from "../../crew";
import { CheckBox } from "../../ui";
import { EmptyState, PageTitle } from "../../pages/shared";
import { guardrailsApi, type Guardrails, type StartCheck } from "./api";
import { buttonCls } from "../../components/ui/Button";
import { Skeleton } from "../../components/states";
import { ErrorState } from "../../components/states";
import { Stepper, Switch, TimeRange } from "./controls";

const DEFAULT_QUIET = { start: "22:00", end: "07:00" };

function Row({ title, hint, risk, control }: { title: string; hint: string; risk?: string; control: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-b border-row py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-base font-bold">{title}</span>
        <span className="text-sm leading-6 text-body">{hint}</span>
        {risk && <span className="text-meta font-bold text-warn">{risk}</span>}
      </div>
      <div className="shrink-0 self-start sm:self-auto">{control}</div>
    </div>
  );
}

function BlockedPaths({ paths, onChange }: { paths: string[]; onChange: (p: string[]) => void }) {
  const [text, setText] = useState("");
  const id = useId();
  const add = () => {
    const v = text.trim();
    if (!v) return;
    if (!paths.includes(v)) onChange([...paths, v]);
    setText("");
  };
  return (
    <div className="flex flex-col gap-3 py-4">
      <div className="flex flex-col gap-0.5">
        <label htmlFor={id} className="text-base font-bold">Paths to leave alone</label>
        <span className="text-sm leading-6 text-body">Patterns like .env* or infra/**. They are added to every HANDOFF.md as a reminder for the next agent.</span>
      </div>
      <div className="flex gap-2">
        <input id={id} value={text} onChange={(e) => setText(e.target.value)} placeholder="secrets/**"
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          className="min-w-0 flex-1 rounded-lg border border-line bg-card px-3 py-2.5 text-ui outline-none focus:border-action" />
        <button type="button" onClick={add} disabled={!text.trim()}
          className="shrink-0 cursor-pointer rounded-lg bg-cta px-4 py-2.5 text-sm font-bold text-on-cta disabled:cursor-not-allowed disabled:opacity-40">Add</button>
      </div>
      {paths.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Blocked paths">
          {paths.map((p) => (
            <li key={p} className="flex max-w-full items-center gap-1.5 break-all rounded-lg bg-surface py-1 pl-3 pr-1 text-sm font-bold">
              {p}
              <button type="button" aria-label={`Remove ${p}`} onClick={() => onChange(paths.filter((x) => x !== p))}
                className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted hover:bg-line hover:text-ink">
                <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M2 2l6 6M8 2l-6 6" /></svg>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StartTester({ accounts }: { accounts: Account[] }) {
  const [picked, setPicked] = useState<string[]>([]);
  const [result, setResult] = useState<StartCheck | null>(null);
  const [error, setError] = useState<string | null>(null);
  const toggle = (id: string) => { setResult(null); setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id])); };
  const run = async () => {
    setError(null);
    try { setResult(await guardrailsApi.check(picked)); } catch (e) { setError((e as Error).message); }
  };
  return (
    <section aria-labelledby="gt-title" className="flex flex-col gap-3 rounded-card border border-line bg-card p-5">
      <h2 id="gt-title" className="text-lg font-bold">Check a start</h2>
      <p className="text-sm leading-6 text-body">Pick accounts and see whether a run would be allowed right now. Saved guardrails apply.</p>
      <div className="flex flex-col gap-1">
        {accounts.map((a) => (
          <label key={a.id} className="flex min-h-9 cursor-pointer items-center gap-2.5 rounded-lg px-1 py-1.5">
            <CheckBox checked={picked.includes(a.id)} onChange={() => toggle(a.id)} />
            <CrewAvatar provider={a.provider} preset={a.api?.preset} name={a.name} size={24} state={a.usage.state} />
            <span className="min-w-0 break-words text-sm font-bold">{a.name}</span>
          </label>
        ))}
        {accounts.length === 0 && <p className="text-sm text-muted">No accounts yet.</p>}
      </div>
      <button type="button" onClick={run} className="cursor-pointer min-h-9 self-start rounded-lg border border-line px-3.5 py-2 text-sm font-bold hover:bg-surface">Check</button>
      <div aria-live="polite">
        {error && <p role="alert" className="text-sm font-bold text-fail">{error}</p>}
        {result?.ok && <p className="rounded-lg bg-pass-soft px-3 py-2 text-sm font-bold text-pass">A run can start.</p>}
        {result && !result.ok && (
          <ul className="flex flex-col gap-1.5 rounded-lg bg-warn-soft px-3 py-2.5 text-sm text-warn">
            {result.problems.map((p) => <li key={p}>{p}</li>)}
          </ul>
        )}
      </div>
    </section>
  );
}

const same = (a: Guardrails, b: Guardrails) => JSON.stringify(a) === JSON.stringify(b);

export function GuardrailsPage({ accounts }: { accounts: Account[] }) {
  const [saved, setSaved] = useState<Guardrails | null>(null);
  const [draft, setDraft] = useState<Guardrails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    guardrailsApi.get().then((g) => { setSaved(g); setDraft(g); }).catch((e) => setError((e as Error).message));
  }, []);

  if (!draft || !saved) {
    return (
      <div className="flex flex-col gap-6">
        <PageTitle title="Guardrails" eyebrow="Safety" />
        {error ? <ErrorState title="Could not load guardrails" body={error} /> : <Skeleton rows={4} label="Loading guardrails" />}
      </div>
    );
  }

  const set = (patch: Partial<Guardrails>) => setDraft({ ...draft, ...patch });
  const dirty = !same(draft, saved);
  const save = async () => {
    setBusy(true); setError(null);
    try { const g = await guardrailsApi.save(draft); setSaved(g); setDraft(g); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  const quiet = draft.quietHours;

  return (
    <div className="flex flex-col gap-6">
      <PageTitle eyebrow="Safety" title="Set the limits the crew works within">
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button type="button" disabled={!dirty || busy} onClick={() => { setDraft(saved); setError(null); }}
            className="min-h-9 cursor-pointer rounded-lg border border-line px-3.5 py-2 text-sm font-bold hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40">Discard</button>
          <button type="button" disabled={!dirty || busy} onClick={save}
            className={buttonCls("primary", "md")}>{busy ? "Saving" : "Save changes"}</button>
        </div>
      </PageTitle>
      <div aria-live="polite">{error && <p role="alert" className="rounded-lg bg-fail-soft px-3 py-2 text-sm font-bold text-fail">{error}</p>}</div>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section aria-labelledby="g-title" className="flex flex-col rounded-card border border-line bg-card px-4 py-2 sm:px-6">
          <h2 id="g-title" className="sr-only">Guardrails</h2>
          <Row title="Automatic rotation" hint={`Hand off without asking when an account passes ${draft.stopAtPct}%.`}
            risk={draft.autoRotate ? "Risk: vendors may read this as limit evasion." : undefined}
            control={<Switch label="Automatic rotation" checked={draft.autoRotate} onChange={(v) => set({ autoRotate: v })} />} />
          <Row title="Runs at the same time" hint="The most runs that can be active across all accounts."
            control={<Stepper label="Runs at the same time" value={draft.maxParallelRuns} min={1} max={20} onChange={(v) => set({ maxParallelRuns: v })} />} />
          <Row title="Stop line" hint="Never start a run on an account at or above this share of its limit."
            control={<Stepper label="Stop line" value={draft.stopAtPct} min={50} max={100} step={5} suffix="%" onChange={(v) => set({ stopAtPct: v })} />} />
          <Row title="Quiet hours" hint="No notifications during this time, local time."
            control={<Switch label="Quiet hours" checked={!!quiet} onChange={(v) => set({ quietHours: v ? DEFAULT_QUIET : undefined })} />} />
          {quiet && (
            <div className="border-b border-row pb-4">
              <TimeRange label="Quiet hours" start={quiet.start} end={quiet.end} onChange={(q) => set({ quietHours: q })} />
            </div>
          )}
          <BlockedPaths paths={draft.blockedPaths} onChange={(p) => set({ blockedPaths: p })} />
        </section>
        <StartTester accounts={accounts} />
      </div>
    </div>
  );
}
