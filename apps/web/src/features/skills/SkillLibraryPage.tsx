import { useCallback, useEffect, useId, useState } from "react";
import { skillsApi, type Skill, type SkillInput, type SkillProvider } from "./api";

const PROVIDERS: { id: SkillProvider; label: string }[] = [
  { id: "claude", label: "Claude" },
  { id: "codex", label: "Codex" },
  { id: "gemini", label: "Gemini" },
  { id: "api", label: "API accounts" },
];
const ALL: SkillProvider[] = PROVIDERS.map((p) => p.id);
const labelOf = (id: SkillProvider) => PROVIDERS.find((p) => p.id === id)?.label ?? id;

/** Custom on/off switch: a button with role="switch". Space and Enter toggle it. */
function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 cursor-pointer before:absolute before:-inset-2 before:content-['']  rounded-full border transition-colors ${checked ? "border-action bg-action" : "border-line bg-track"}`}>
      <span aria-hidden className={`absolute top-0.5 size-4.5 rounded-full bg-card shadow transition-all ${checked ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

/** Custom toggle chip. Pressed means the skill is sent to that provider. */
function ProviderChip({ label, on, onToggle }: { label: string; on: boolean; onToggle: () => void }) {
  return (
    <button type="button" aria-pressed={on} onClick={onToggle}
      className={`flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13px] font-bold ${on ? "border-action bg-action-soft text-action" : "border-line bg-card text-body hover:text-ink"}`}>
      <span aria-hidden className={`flex size-3.5 items-center justify-center rounded-full border ${on ? "border-action bg-action text-on-action" : "border-line"}`}>
        {on && <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 6.5l2.5 2.5 4.5-5.5" /></svg>}
      </span>
      {label}
    </button>
  );
}

const blank: SkillInput = { name: "", description: "", body: "", enabled: true, providers: [...ALL] };
type Draft = SkillInput & { id: string | null };
const fromSkill = (s: Skill): Draft => ({ id: s.id, name: s.name, description: s.description, body: s.body, enabled: s.enabled, providers: s.providers });

const fieldCls = "w-full rounded-lg border border-line bg-card px-3 py-2 font-sans text-sm text-ink placeholder:text-muted focus:border-action focus:outline-none focus-visible:ring-2 focus-visible:ring-action/30";

export function SkillLibraryPage({ onToast }: { onToast?: (message: string) => void } = {}) {
  const [skills, setSkills] = useState<Skill[] | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [synced, setSynced] = useState<string[] | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const ids = { name: useId(), desc: useId(), body: useId() };

  const say = useCallback((m: string) => { setStatus(m); onToast?.(m); }, [onToast]);
  useEffect(() => { if (!status) return; const t = setTimeout(() => setStatus(null), 4000); return () => clearTimeout(t); }, [status]);

  const load = useCallback(async () => {
    try { setSkills(await skillsApi.list()); } catch (e) { setSkills([]); say((e as Error).message); }
  }, [say]);
  useEffect(() => { void load(); }, [load]);

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try { await fn(); await load(); say(ok); return true; } catch (e) { say((e as Error).message); return false; } finally { setBusy(false); }
  };

  const toggleEnabled = (s: Skill, enabled: boolean) => {
    void act(() => skillsApi.update(s.id, { enabled }), `${s.name} ${enabled ? "turned on" : "turned off"}. Sync to apply it.`);
    setSynced(null);
  };

  const save = async () => {
    if (!draft) return;
    const input: SkillInput = { name: draft.name, description: draft.description, body: draft.body, enabled: draft.enabled, providers: draft.providers };
    setBusy(true);
    try {
      const saved = draft.id ? await skillsApi.update(draft.id, input) : await skillsApi.create(input);
      await load();
      setDraft(fromSkill(saved));
      setSynced(null);
      say(`Saved ${saved.name}. Sync to apply it.`);
    } catch (e) { say((e as Error).message); } finally { setBusy(false); }
  };

  const remove = async () => {
    if (!draft?.id) return;
    const name = draft.name;
    if (await act(() => skillsApi.remove(draft.id!), `Deleted ${name}`)) { setDraft(null); setSynced(null); }
    setConfirmDelete(false);
  };

  const sync = async () => {
    setSyncing(true);
    try {
      const { files } = await skillsApi.sync();
      setSynced(files);
      say(files.length ? `Synced to ${files.length} ${files.length === 1 ? "file" : "files"}` : "Every account is already up to date");
    } catch (e) { say((e as Error).message); } finally { setSyncing(false); }
  };

  const setProviders = (p: SkillProvider) =>
    setDraft((d) => d && { ...d, providers: d.providers.includes(p) ? d.providers.filter((x) => x !== p) : ALL.filter((x) => x === p || d.providers.includes(x)) });

  const enabledCount = skills?.filter((s) => s.enabled).length ?? 0;
  const canSave = !!draft && draft.name.trim().length > 0 && draft.body.trim().length > 0 && draft.providers.length > 0 && !busy;

  return (
    <div className="flex flex-col gap-5 px-4 py-5 sm:px-7 sm:py-[26px]">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="flex flex-col gap-1">
          <p className="text-sm text-body">Skill library · {skills?.length ?? 0} {skills?.length === 1 ? "skill" : "skills"} · one source, every account</p>
          <h1 className="text-[24px] font-bold leading-8 sm:text-[30px] sm:leading-9 tracking-[-0.03em]">Every worker knows the same tricks</h1>
        </div>
        <button type="button" onClick={() => { setDraft({ ...blank, id: null, providers: [...ALL] }); setConfirmDelete(false); }}
          className="min-h-9 cursor-pointer rounded-lg bg-cta px-3.5 py-2 text-sm font-bold text-on-cta hover:opacity-90">Add skill</button>
      </div>

      <div className="flex flex-col items-stretch gap-5 lg:flex-row lg:items-start">
        <section aria-label="Skills" className="min-w-0 flex-1 overflow-hidden rounded-[14px] border border-line">
          <div className="hidden grid-cols-[1fr_190px_64px] gap-3.5 border-b border-line bg-surface sm:grid px-4 py-2.5 text-[13px] font-bold text-body">
            <span>Skill</span><span>Works with</span><span className="text-right">On</span>
          </div>
          {skills === null && <p className="px-4 py-6 text-sm text-body">Loading skills.</p>}
          {skills?.length === 0 && <p className="px-4 py-6 text-sm text-body">No skills yet. Add one and every account will follow it.</p>}
          <ul>
            {skills?.map((s) => {
              const open = draft?.id === s.id;
              return (
                <li key={s.id} className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3.5 gap-y-2 border-b border-row px-4 py-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_190px_64px] ${open ? "bg-pick" : ""}`}>
                  <button type="button" aria-current={open ? "true" : undefined} onClick={() => { setDraft(fromSkill(s)); setConfirmDelete(false); }}
                    className="col-start-1 row-start-1 flex min-h-9 min-w-0 cursor-pointer flex-col justify-center gap-0.5 rounded-md text-left sm:col-auto sm:row-auto focus-visible:outline-2 focus-visible:outline-action">
                    <span className="truncate text-[15px] font-bold text-ink">{s.name}</span>
                    <span className="truncate text-[13px] text-body">{s.description || "No description"}</span>
                  </button>
                  <div className="col-span-2 row-start-2 flex flex-wrap gap-1.5 sm:col-auto sm:row-auto">
                    {s.providers.length === ALL.length
                      ? <span className="rounded-md bg-surface px-2 py-0.5 text-xs font-bold text-ink">All 4</span>
                      : s.providers.map((p) => <span key={p} className="rounded-md bg-surface px-2 py-0.5 text-xs font-bold text-ink">{labelOf(p)}</span>)}
                  </div>
                  <div className="col-start-2 row-start-1 flex justify-end sm:col-auto sm:row-auto"><Switch checked={s.enabled} onChange={(v) => toggleEnabled(s, v)} label={`${s.name} enabled`} /></div>
                </li>
              );
            })}
          </ul>
        </section>

        <div className="flex w-full shrink-0 flex-col gap-3.5 lg:w-[360px]">
          <section aria-label="Sync" className="flex flex-col gap-3 rounded-[14px] border border-line bg-surface p-5">
            <p className="text-[13px] font-bold tracking-[0.06em] text-action">SYNC</p>
            <p className="text-base font-bold leading-5">{enabledCount} {enabledCount === 1 ? "skill is" : "skills are"} ready to share</p>
            <p className="text-sm leading-[21px] text-body">Skills are written between two marker comments in each account's own instruction file. Everything else in those files stays as it is.</p>
            <button type="button" onClick={sync} disabled={syncing}
              className="min-h-10 cursor-pointer rounded-[9px] bg-action px-3 py-2.5 text-sm font-bold text-on-action hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
              {syncing ? "Syncing" : "Sync to all accounts"}
            </button>
            {synced && (
              <div className="rounded-lg border border-line bg-card p-3 text-[13px] leading-[19px] text-body">
                <p className="font-bold text-pass">{synced.length ? `Updated ${synced.length} ${synced.length === 1 ? "file" : "files"}` : "Nothing to change, all accounts match"}</p>
                {synced.length > 0 && <ul className="mt-1.5 flex flex-col gap-1">{synced.map((f) => <li key={f} className="break-all">{f}</li>)}</ul>}
              </div>
            )}
          </section>

          {draft ? (
            <section aria-label={draft.id ? "Edit skill" : "New skill"} className="flex flex-col gap-3.5 rounded-[14px] border border-line p-5">
              <h2 className="text-base font-bold leading-5">{draft.id ? "Edit skill" : "New skill"}</h2>
              <div className="flex flex-col gap-1.5">
                <label htmlFor={ids.name} className="text-[13px] font-bold">Name</label>
                <input id={ids.name} value={draft.name} maxLength={80} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={fieldCls} placeholder="Run the tests first" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor={ids.desc} className="text-[13px] font-bold">Short description</label>
                <input id={ids.desc} value={draft.description} maxLength={200} onChange={(e) => setDraft({ ...draft, description: e.target.value })} className={fieldCls} placeholder="One line shown in the list" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor={ids.body} className="text-[13px] font-bold">Instructions (markdown)</label>
                <textarea id={ids.body} value={draft.body} rows={9} onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                  className={`${fieldCls} resize-y leading-[21px]`} placeholder="Tell the worker what to do, in plain sentences." />
              </div>
              <fieldset className="flex flex-col gap-1.5">
                <legend className="mb-1.5 text-[13px] font-bold">Send to</legend>
                <div className="flex flex-wrap gap-1.5">
                  {PROVIDERS.map((p) => <ProviderChip key={p.id} label={p.label} on={draft.providers.includes(p.id)} onToggle={() => setProviders(p.id)} />)}
                </div>
                {draft.providers.length === 0 && <p role="alert" className="text-[13px] text-fail">Pick at least one provider.</p>}
              </fieldset>
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-bold">Enabled</span>
                <Switch checked={draft.enabled} onChange={(v) => setDraft({ ...draft, enabled: v })} label="Skill enabled" />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                {draft.id ? (
                  confirmDelete ? (
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={remove} disabled={busy} className="cursor-pointer min-h-9 rounded-lg bg-fail px-3 py-2 text-[13px] font-bold text-on-action disabled:opacity-50">Delete for good</button>
                      <button type="button" onClick={() => setConfirmDelete(false)} className="cursor-pointer min-h-9 rounded-lg border border-line px-3 py-2 text-[13px] font-bold hover:bg-surface">Keep</button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setConfirmDelete(true)} className="cursor-pointer min-h-9 rounded-lg border border-line px-3 py-2 text-[13px] font-bold text-fail hover:bg-fail-soft">Delete</button>
                  )
                ) : <span />}
                <div className="flex gap-2">
                  <button type="button" onClick={() => { setDraft(null); setConfirmDelete(false); }} className="cursor-pointer min-h-9 rounded-lg border border-line px-3.5 py-2 text-[13px] font-bold hover:bg-surface">Close</button>
                  <button type="button" onClick={save} disabled={!canSave} className="cursor-pointer min-h-9 rounded-lg bg-cta px-3.5 py-2 text-[13px] font-bold text-on-cta hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">{draft.id ? "Save" : "Create"}</button>
                </div>
              </div>
            </section>
          ) : (
            <section className="flex flex-col gap-2.5 rounded-[14px] border border-line p-[18px]">
              <h2 className="text-base font-bold leading-5">Written once, shared everywhere</h2>
              <p className="text-sm leading-[18px] text-nav"><span className="font-bold">Claude</span> reads CLAUDE.md in its own folder</p>
              <p className="text-sm leading-[18px] text-nav"><span className="font-bold">Codex and API accounts</span> read AGENTS.md</p>
              <p className="text-sm leading-[18px] text-nav"><span className="font-bold">Gemini</span> reads .gemini/GEMINI.md</p>
            </section>
          )}
        </div>
      </div>

      {status && <div role="status" className="fixed bottom-6 left-4 right-4 z-40 rounded-xl sm:left-auto sm:right-6 bg-cta px-4 py-3 text-sm font-bold text-on-cta shadow-xl">{status}</div>}
    </div>
  );
}
