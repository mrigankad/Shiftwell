import { useCallback, useEffect, useId, useRef, useState } from "react";
import { api, type Account } from "../../api";
import { HttpError } from "../../lib/http";
import { Button, IconButton } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { PageHeader } from "../../components/ui/PageHeader";
import { Switch } from "../../components/ui/Switch";
import { useToast } from "../../components/ui/Toast";
import { Modal } from "../../ui";
import { EmptyState, type PageCtx } from "../../pages/shared";
import { Field, MultiTiles, Pixel, Swatches, Tabs, Tiles, type SwatchOption, type TileOption } from "./controls";
import {
  ACCENTS, brandFor, CHOICES, CROP_CHEST, CROP_HEAD, crewProvider, eyeColors, hairColors, hoodieColors, LOGO_LABEL, nice,
  providerDefault, randomise, sameLook, skinTones, themes, trimColors, type Recipe,
} from "./recipes";

const TABS = [
  { id: "body", label: "Body" }, { id: "hair", label: "Hair" }, { id: "face", label: "Face" },
  { id: "hoodie", label: "Hoodie" }, { id: "accessories", label: "Accessories" },
] as const;
type Tab = (typeof TABS)[number]["id"];

interface History { past: Recipe[]; present: Recipe; future: Recipe[] }
const LIMIT = 100;

/**
 * Edits that were not saved yet, kept while the page is away so a stray click on the sidebar cannot lose them.
 * Cleared on save, on discard, and when the user confirms leaving.
 */
let session: { id: string; history: History; leaveTo: string | null } | null = null;

const here = (id: string) => `/accounts/${id}/character`;
const currentHash = () => window.location.hash.replace(/^#\/?/, "/");

// The guard lives at module level, not in the component: React may already have unmounted the editor when the
// hash changes. It sends the address bar back to the editor, and the editor (mounted or remounted) shows the dialog.
const guardSubs = new Set<(to: string) => void>();
if (typeof window !== "undefined") {
  window.addEventListener("hashchange", () => {
    if (!session || currentHash() === here(session.id)) return;
    const to = currentHash();
    session.leaveTo = to;
    guardSubs.forEach((f) => f(to));
    window.location.hash = here(session.id);
  });
}

export function CharacterEditorPage({ id, ctx }: { id: string; ctx: PageCtx }) {
  const a = ctx.accounts.find((x) => x.id === id);
  if (!a) {
    const loading = ctx.accounts.length === 0;
    return (
      <div className="flex flex-col gap-5">
        <EmptyState title={loading ? "Loading the crew" : "That account is gone"} body={loading ? "One moment." : "It may have been removed. Pick another from the list."}
          action={<Button variant="primary" onClick={() => ctx.go("accounts")}>Back to accounts</Button>} />
      </div>
    );
  }
  return <Editor key={a.id} a={a} ctx={ctx} />;
}

function Editor({ a, ctx }: { a: Account; ctx: PageCtx }) {
  const toast = useToast();
  const uid = useId();
  const saved = a.character ?? providerDefault(a.provider, a.api?.preset);
  const fallbackDefault = a.defaultCharacter ?? saved;
  const [base, setBase] = useState<Recipe>(saved);
  const [hist, setHist] = useState<History>(() => (session?.id === a.id ? session.history : { past: [], present: saved, future: [] }));
  const [tab, setTab] = useState<Tab>("hair");
  const [saving, setSaving] = useState(false);
  const [leaveTo, setLeaveTo] = useState<string | null>(session?.id === a.id ? session.leaveTo : null);
  const r = hist.present;
  const dirty = !sameLook(r, base);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  // The board can bring a newer saved recipe (another tab saved). Follow it only while nothing is being edited.
  useEffect(() => {
    if (!dirtyRef.current && a.character && !sameLook(a.character, base)) { setBase(a.character); setHist({ past: [], present: a.character, future: [] }); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a.character]);

  useEffect(() => { session = dirty ? { id: a.id, history: hist, leaveTo: session?.id === a.id ? session.leaveTo : null } : session?.id === a.id ? null : session; }, [dirty, hist, a.id]);

  const commit = useCallback((next: Recipe) => {
    setHist((h) => (sameLook(h.present, next) ? h : { past: [...h.past.slice(-(LIMIT - 1)), h.present], present: next, future: [] }));
  }, []);
  const undo = useCallback(() => setHist((h) => (h.past.length ? { past: h.past.slice(0, -1), present: h.past[h.past.length - 1]!, future: [h.present, ...h.future] } : h)), []);
  const redo = useCallback(() => setHist((h) => (h.future.length ? { past: [...h.past, h.present], present: h.future[0]!, future: h.future.slice(1) } : h)), []);

  const save = useCallback(async (): Promise<boolean> => {
    setSaving(true);
    try {
      const out = await api.updateProfile(a.id, { character: hist.present });
      const next = out.character ?? hist.present;
      setBase(next);
      setHist({ past: [], present: next, future: [] });
      session = null;
      toast.success(`Saved ${a.name}'s character`);
      return true;
    } catch (e) {
      const stale = e instanceof HttpError && e.status === 404;
      toast.error(stale ? "The running service is older than this page and cannot save characters. Restart it, then save again." : (e as Error).message);
      return false;
    } finally { setSaving(false); }
  }, [a.id, a.name, hist.present, toast]);

  // Ctrl+Z, Ctrl+Shift+Z and Ctrl+Y.
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || leaveTo) return;
      const key = e.key.toLowerCase();
      if (key === "z") { e.preventDefault(); (e.shiftKey ? redo : undo)(); }
      else if (key === "y") { e.preventDefault(); redo(); }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [undo, redo, leaveTo]);

  // Leaving with unsaved changes: closing the tab asks the browser; moving inside the app opens our own dialog.
  useEffect(() => {
    const unload = (e: BeforeUnloadEvent) => { if (dirtyRef.current) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", unload);
    guardSubs.add(setLeaveTo);
    return () => { window.removeEventListener("beforeunload", unload); guardSubs.delete(setLeaveTo); };
  }, [a.id]);

  const leave = (to: string) => { session = null; setLeaveTo(null); window.location.hash = to; };

  const set = (patch: Partial<Recipe>) => commit({ ...r, ...patch });
  const variant = (patch: Partial<Recipe>): Recipe => ({ ...r, ...patch });
  const provider = crewProvider(a.provider, a.api?.preset);

  const swatches = (table: Record<string, { hair?: string; skin?: string; hoodie?: string }> | Record<string, string>, ids: string[], pick: (v: any) => string): SwatchOption[] =>
    ids.map((id) => ({ id, label: nice(id), color: pick((table as any)[id]) }));

  const nameOf = (id: string, ids: string[]) => (ids.includes(id) ? nice(id) : id.toUpperCase());

  const panels: Record<Tab, JSX.Element> = {
    body: (
      <>
        <Field label="Build" value={nice(r.bodyType)} id={`${uid}-build`}>
          <Tiles label="Build" value={r.bodyType} onChange={(v) => set({ bodyType: v as Recipe["bodyType"] })}
            options={CHOICES.body.map((b) => ({ id: b, label: nice(b), recipe: variant({ bodyType: b }), background: false }))} />
        </Field>
        <Field label="Skin tone" value={nice(r.skinTone)} id={`${uid}-skin`}>
          <Swatches label="Skin tone" value={r.skinTone} onChange={(v) => set({ skinTone: v })} options={swatches(skinTones, CHOICES.skin, (v) => v.skin)} />
        </Field>
        <Field label="Backdrop" value={`${nice(r.background.scene)}, ${nice(r.background.theme)}`} id={`${uid}-bd`}>
          <Tiles label="Backdrop scene" value={r.background.scene} onChange={(v) => set({ background: { ...r.background, scene: v as Recipe["background"]["scene"] } })}
            options={CHOICES.scenes.map((s) => ({ id: s, label: nice(s), recipe: variant({ background: { ...r.background, scene: s } }), crop: "0 0 48 48" }))} />
          <Swatches label="Backdrop colour" value={r.background.theme} onChange={(v) => set({ background: { ...r.background, theme: v as Recipe["background"]["theme"] } })}
            options={CHOICES.themes.map((t) => ({ id: t, label: nice(t), color: themes[t].bg1, color2: themes[t].bg2 }))} />
        </Field>
      </>
    ),
    hair: (
      <>
        <Field label="Hairstyle" value={nice(r.hair.style)} id={`${uid}-hs`}>
          <Tiles label="Hairstyle" value={r.hair.style} onChange={(v) => set({ hair: { ...r.hair, style: v as Recipe["hair"]["style"] } })}
            options={CHOICES.hair.map((h) => ({ id: h, label: nice(h), recipe: variant({ hair: { ...r.hair, style: h } }), crop: CROP_HEAD, background: false }))} />
        </Field>
        <Field label="Hair colour" value={nameOf(r.hair.color, CHOICES.hairColors)} id={`${uid}-hc`}>
          <Swatches label="Hair colour" value={r.hair.color} onChange={(v) => set({ hair: { ...r.hair, color: v } })} options={swatches(hairColors, CHOICES.hairColors, (v) => v.hair)} />
        </Field>
      </>
    ),
    face: (
      <>
        <Field label="Eyes" value={nice(r.eyes)} id={`${uid}-eyes`}>
          <Tiles label="Eyes" value={r.eyes} onChange={(v) => set({ eyes: v as Recipe["eyes"] })}
            options={CHOICES.eyes.map((e) => ({ id: e, label: nice(e), recipe: variant({ eyes: e }), crop: CROP_HEAD, background: false }))} />
          <Swatches label="Eye colour" value={r.eyeColor ?? "ink"} onChange={(v) => set({ eyeColor: v })} options={swatches(eyeColors, CHOICES.eyeColors, (v) => v)} />
        </Field>
        <Field label="Brows" value={nice(r.brows)} id={`${uid}-brows`}>
          <Tiles label="Brows" value={r.brows} onChange={(v) => set({ brows: v as Recipe["brows"] })}
            options={CHOICES.brows.map((b) => ({ id: b, label: nice(b), recipe: variant({ brows: b }), crop: CROP_HEAD, background: false }))} />
        </Field>
        <Field label="Mouth" value={nice(r.mouth)} id={`${uid}-mouth`}>
          <Tiles label="Mouth" value={r.mouth} onChange={(v) => set({ mouth: v as Recipe["mouth"] })}
            options={CHOICES.mouth.map((m) => ({ id: m, label: nice(m), recipe: variant({ mouth: m }), crop: CROP_HEAD, background: false }))} />
        </Field>
        <div className="flex items-center justify-between gap-4 rounded-card bg-surface px-4 py-3">
          <div className="flex min-w-0 flex-col">
            <span className="text-sm font-bold">Blush</span>
            <span className="text-meta text-body">Pink cheeks, drawn on top of the skin.</span>
          </div>
          <Switch label="Blush" checked={r.blush !== false} onChange={(v) => set({ blush: v })} />
        </div>
      </>
    ),
    hoodie: (
      <>
        <Field label="Hoodie colour" value={nameOf(r.hoodie.color, CHOICES.hoodieColors)} id={`${uid}-hd`}>
          <Swatches label="Hoodie colour" value={r.hoodie.color} onChange={(v) => set({ hoodie: { ...r.hoodie, color: v } })} options={swatches(hoodieColors, CHOICES.hoodieColors, (v) => v.hoodie)} />
        </Field>
        <Field label="Trim" value={nameOf(r.hoodie.trim, CHOICES.trimColors)} id={`${uid}-tr`}>
          <Swatches label="Trim colour" value={r.hoodie.trim} onChange={(v) => set({ hoodie: { ...r.hoodie, trim: v } })} options={swatches(trimColors, CHOICES.trimColors, (v) => v)} />
        </Field>
        <Field label="Logo" value={r.logo === provider ? `${LOGO_LABEL[r.logo] ?? nice(r.logo)}, this account's own` : LOGO_LABEL[r.logo] ?? nice(r.logo)} id={`${uid}-logo`}>
          <Tiles label="Hoodie logo" value={r.logo} onChange={(v) => set({ logo: v as Recipe["logo"] })}
            options={CHOICES.logos.map<TileOption>((l) => ({ id: l, label: LOGO_LABEL[l] ?? nice(l), recipe: variant({ logo: l }), crop: CROP_CHEST, background: false, badge: l === provider ? "Own" : undefined }))} />
        </Field>
        <div>
          <Button size="sm" onClick={() => set(brandFor(provider))} disabled={r.logo === provider && r.hoodie.color === brandFor(provider).hoodie.color && r.hoodie.trim === brandFor(provider).hoodie.trim}>
            Match the provider
          </Button>
        </div>
      </>
    ),
    accessories: (
      <>
        <Field label="Accessories" value={r.accessories.length ? r.accessories.map(nice).join(", ") : "None"} id={`${uid}-acc`}>
          <MultiTiles label="Accessories" values={r.accessories}
            onToggle={(v) => set({ accessories: r.accessories.includes(v as never) ? r.accessories.filter((x) => x !== v) : [...r.accessories, v as Recipe["accessories"][number]] })}
            options={CHOICES.accessories.map((x) => ({ id: x, label: nice(x), recipe: variant({ accessories: [x] }), crop: CROP_HEAD, background: false }))} />
        </Field>
        <Field label="Accent colour" value={ACCENTS.find((x) => x.id === r.accent)?.label ?? "Orange"} id={`${uid}-ac`}>
          <Swatches label="Accent colour, for clips and ties" value={r.accent ?? "#FF7A3D"} onChange={(v) => set({ accent: v })} options={ACCENTS.map((x) => ({ id: x.id, label: x.label, color: x.id }))} />
          <p className="text-meta text-body">Used by clips, visors and ties.</p>
        </Field>
      </>
    ),
  };

  return (
    <div className="flex flex-col gap-5">
      <button type="button" onClick={() => ctx.go(`accounts/${a.id}`)} className="inline-flex w-fit cursor-pointer items-center gap-1.5 text-sm text-body hover:text-ink">
        <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
        {a.name}
      </button>

      <PageHeader eyebrow={dirty ? "Unsaved changes" : "Character"} title={`Edit ${a.name}`}>
        <Button variant="ghost" onClick={() => commit(base)} disabled={!dirty || saving}>Discard changes</Button>
        <Button variant="primary" onClick={() => void save()} disabled={!dirty || saving}>{saving ? "Saving" : "Save character"}</Button>
      </PageHeader>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(320px,440px)_minmax(0,1fr)]">
        <section aria-label="Preview" className="flex min-w-0 flex-col items-center gap-5 rounded-card bg-welcome p-5 sm:p-7 lg:sticky lg:top-[68px] lg:self-start">
          <div className="aspect-square w-full max-w-[min(100%,360px)] overflow-hidden rounded-3xl lg:max-w-[360px]">
            <Pixel recipe={r} className="size-full" />
          </div>
          <div className="flex flex-col items-center gap-0.5 text-center">
            <span className="text-2xl font-bold tracking-[-0.03em] text-welcome-ink">{a.name}</span>
            <span className="text-sm text-welcome-body">{LOGO_LABEL[provider] ?? nice(provider)} account{a.characterCustom || dirty ? "" : ", default look"}</span>
          </div>
          <div className="flex items-end justify-center gap-4" aria-label="Small sizes" role="group">
            {[24, 32, 48].map((s) => (
              <div key={s} className="flex flex-col items-center gap-1.5">
                <span className="overflow-hidden rounded-lg" style={{ width: s, height: s }}><Pixel recipe={r} className="size-full" /></span>
                <span className="text-2xs text-welcome-muted">{s} px</span>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button variant="accent" onClick={() => commit(randomise(r))}>Randomise</Button>
            <Button onClick={() => commit({ ...fallbackDefault, id: a.id, name: a.name })}>Reset to default</Button>
            <div className="flex gap-1 text-welcome-body">
              <IconButton aria-label="Undo (Ctrl+Z)" title="Undo (Ctrl+Z)" onClick={undo} disabled={!hist.past.length} className="!text-welcome-body hover:!bg-welcome-card hover:!text-welcome-ink">
                <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3 3 6l3 3M3 6h6a4 4 0 0 1 0 8H7" /></svg>
              </IconButton>
              <IconButton aria-label="Redo (Ctrl+Shift+Z)" title="Redo (Ctrl+Shift+Z)" onClick={redo} disabled={!hist.future.length} className="!text-welcome-body hover:!bg-welcome-card hover:!text-welcome-ink">
                <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="m10 3 3 3-3 3M13 6H7a4 4 0 0 0 0 8h2" /></svg>
              </IconButton>
            </div>
          </div>
        </section>

        <Card className="flex min-w-0 flex-col gap-6">
          <Tabs label="Character parts" value={tab} tabs={[...TABS]} onChange={setTab} idPrefix={uid} />
          <div role="tabpanel" id={`${uid}-panel-${tab}`} aria-labelledby={`${uid}-tab-${tab}`} tabIndex={-1} className="flex min-w-0 flex-col gap-7">
            {panels[tab]}
          </div>
        </Card>
      </div>

      {leaveTo && (
        <Modal titleId={`${uid}-leave`} width={440} onClose={() => { if (session) session.leaveTo = null; setLeaveTo(null); }} onSubmit={(e) => e.preventDefault()}>
          <div className="flex flex-col gap-1.5">
            <h2 id={`${uid}-leave`} className="text-h3 font-bold tracking-[-0.02em]">Leave without saving?</h2>
            <p className="text-sm leading-6 text-body">{a.name}'s character has changes you have not saved. They will be lost if you leave.</p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button data-autofocus onClick={() => { if (session) session.leaveTo = null; setLeaveTo(null); }}>Keep editing</Button>
            <Button variant="danger" onClick={() => leave(leaveTo)}>Leave</Button>
            <Button variant="primary" disabled={saving} onClick={() => void save().then((ok) => { if (ok) leave(leaveTo); })}>Save and leave</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
