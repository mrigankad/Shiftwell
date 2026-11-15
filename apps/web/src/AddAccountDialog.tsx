import { useEffect, useRef, useState } from "react";
import { api, type ApiConfig, type CreateProfileInput, type Preset, type Provider } from "./api";
import { CrewAvatar } from "./crew";

const OPTIONS: { id: Provider; title: string; hint: string }[] = [
  { id: "claude", title: "Claude Code", hint: "Pro, Max or Team login" },
  { id: "codex", title: "Codex CLI", hint: "ChatGPT Plus or Pro login" },
  { id: "gemini", title: "Gemini CLI", hint: "Google AI Pro login" },
  { id: "api", title: "API key", hint: "Kimi, Grok, DeepSeek, NIM, Ollama" },
];

/** Custom modal (no native dialogs or selects), keyboard friendly. */
export function AddAccountDialog({ onClose, onCreate }: {
  onClose: () => void;
  onCreate: (input: CreateProfileInput) => Promise<void>;
}) {
  const [provider, setProvider] = useState<Provider>("claude");
  const [name, setName] = useState("");
  const [plan, setPlan] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const [presets, setPresets] = useState<Preset[] | null | "error">(null);
  const [presetId, setPresetId] = useState("");
  const [model, setModel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [keyEnv, setKeyEnv] = useState("");
  const isApi = provider === "api";
  const preset = Array.isArray(presets) ? presets.find((p) => p.id === presetId) : undefined;
  const custom = presetId === "custom";

  useEffect(() => {
    if (!isApi || presets !== null) return;
    api.presets().then(setPresets).catch(() => setPresets("error"));
  }, [isApi, presets]);

  const pick = (p: Preset) => {
    setPresetId(p.id); setModel(p.defaultModel); setBaseUrl(p.baseUrl); setKeyEnv(p.keyEnv);
  };

  const keyErr = keyEnv && !KEY_RE.test(keyEnv) ? "Use capital letters, digits and underscores, starting with a letter or underscore." : null;
  const urlErr = custom && baseUrl && !/^https:\/\/[^\s/]+/.test(baseUrl) ? "The base URL must start with https://" : null;
  const apiReady = !!preset && !!model.trim() && !!baseUrl.trim() && KEY_RE.test(keyEnv) && !urlErr;

  useEffect(() => {
    nameRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    const cfg: ApiConfig | undefined = isApi ? { preset: presetId, baseUrl: baseUrl.trim(), model: model.trim(), keyEnv } : undefined;
    try { await onCreate({ name, provider, plan: plan || undefined, ...(cfg ? { api: cfg } : {}) }); }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/40 p-6" onMouseDown={onClose}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-title"
        onMouseDown={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="flex max-h-[calc(100vh-48px)] w-full max-w-[560px] flex-col gap-5 overflow-y-auto rounded-2xl bg-card p-6 shadow-2xl"
      >
        <div className="flex flex-col gap-1">
          <h2 id="add-title" className="text-[22px] font-bold tracking-[-0.02em]">Add an account</h2>
          <p className="text-sm text-body">Shiftwell makes a separate folder for it. You sign in with the vendor's own login next.</p>
        </div>

        <div role="radiogroup" aria-label="Provider" className="grid grid-cols-2 gap-2.5">
          {OPTIONS.map((o) => {
            const on = provider === o.id;
            return (
              <button
                type="button"
                role="radio"
                aria-checked={on}
                key={o.id}
                onClick={() => setProvider(o.id)}
                className={`flex cursor-pointer items-center gap-3 rounded-xl p-3 text-left ${on ? "border-2 border-action bg-pick" : "border border-line hover:bg-surface"}`}
              >
                <CrewAvatar provider={o.id} size={36} />
                <span className="flex flex-col">
                  <span className="text-[15px] font-bold">{o.title}</span>
                  <span className="text-xs text-body">{o.hint}</span>
                </span>
              </button>
            );
          })}
        </div>

        {isApi && (
          <div className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-4">
            <div className="flex flex-col gap-2">
              <span className="text-sm font-bold">Provider</span>
              {presets === null ? <p className="text-sm text-body">Loading providers...</p>
                : presets === "error" ? <p className="text-sm font-bold text-fail">Could not load the provider list. Is the Shiftwell service running?</p>
                : (
                  <div role="radiogroup" aria-label="API provider" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {presets.map((p) => {
                      const on = presetId === p.id;
                      return (
                        <button type="button" role="radio" aria-checked={on} key={p.id} onClick={() => pick(p)}
                          className={`flex cursor-pointer items-center gap-2 rounded-xl p-2.5 text-left ${on ? "border-2 border-action bg-pick" : "border border-line bg-card hover:bg-surface"}`}>
                          <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-full bg-action-soft text-[11px] font-bold text-action">{initials(p.label)}</span>
                          <span className="min-w-0 truncate text-[13px] font-bold">{p.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
            </div>

            {preset && (
              <>
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-bold">Model</span>
                  <input value={model} onChange={(e) => setModel(e.target.value)} spellCheck={false} className="rounded-lg border border-line bg-card px-3 py-2.5 text-[15px] outline-none focus:border-action" />
                </label>

                {custom ? (
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-bold">Base URL</span>
                    <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.example.com/v1" spellCheck={false} aria-invalid={!!urlErr} className="rounded-lg border border-line bg-card px-3 py-2.5 text-[15px] outline-none focus:border-action" />
                    {urlErr && <span className="text-xs font-bold text-fail">{urlErr}</span>}
                  </label>
                ) : (
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-bold">Base URL</span>
                    <span className="select-text break-all text-sm text-body">{baseUrl}</span>
                  </div>
                )}

                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-bold">Key variable name</span>
                  <input value={keyEnv} onChange={(e) => setKeyEnv(e.target.value)} spellCheck={false} aria-invalid={!!keyErr} className="rounded-lg border border-line bg-card px-3 py-2.5 text-[15px] outline-none focus:border-action" />
                  {keyErr && <span className="text-xs font-bold text-fail">{keyErr}</span>}
                </label>

                <div className="flex flex-col gap-2.5">
                  <p className="text-sm leading-6 text-body">Shiftwell never sees or stores your key. Set it as an environment variable, then restart Shiftwell.</p>
                  <Command label="Windows PowerShell" text={`setx ${keyEnv || "NAME"} "your-key"`} />
                  <Command label="macOS or Linux" text={`export ${keyEnv || "NAME"}="your-key"`} />
                  <p className="rounded-lg bg-warn-soft px-3 py-2 text-[13px] leading-5 text-warn">
                    Runs use the Codex CLI, which only talks to providers that support the OpenAI Responses API. Test connection checks the key, not this.
                  </p>
                </div>
              </>
            )}
          </div>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-bold">Name</span>
          <input ref={nameRef} value={name} onChange={(e) => setName(e.target.value)} placeholder="Claude A, personal Max" className="rounded-lg border border-line px-3 py-2.5 text-[15px] outline-none focus:border-action" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-bold">Plan <span className="font-normal text-muted">(optional)</span></span>
          <input value={plan} onChange={(e) => setPlan(e.target.value)} placeholder="Max 20x" className="rounded-lg border border-line px-3 py-2.5 text-[15px] outline-none focus:border-action" />
        </label>

        {error && <p className="rounded-lg bg-fail-soft px-3 py-2 text-sm font-bold text-fail">{error}</p>}

        <div className="flex justify-end gap-2.5">
          <button type="button" onClick={onClose} className="cursor-pointer rounded-lg border border-line px-4 py-2.5 text-sm font-bold hover:bg-surface">Cancel</button>
          <button type="submit" disabled={busy || !name.trim() || (isApi && !apiReady)} className="cursor-pointer rounded-lg bg-action px-4 py-2.5 text-sm font-bold text-on-action disabled:cursor-not-allowed disabled:opacity-50">
            {busy ? "Adding…" : "Add account"}
          </button>
        </div>
      </form>
    </div>
  );
}

const KEY_RE = /^[A-Z_][A-Z0-9_]*$/;

function initials(label: string): string {
  const w = label.split(/[\s-]+/).filter(Boolean);
  return (w.length > 1 ? w[0][0] + w[1][0] : label.slice(0, 2)).toUpperCase();
}

/** A command snippet in a surface box with its own copy button. Sans font on purpose. */
function Command({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    catch { /* clipboard blocked: the text stays selectable */ }
  };
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted">{label}</span>
      <div className="flex items-center gap-2 rounded-lg border border-line bg-card px-3 py-2">
        <span className="min-w-0 flex-1 select-text break-all text-[13px] text-ink">{text}</span>
        <button type="button" onClick={copy} className="shrink-0 cursor-pointer rounded-md border border-line px-2.5 py-1 text-xs font-bold hover:bg-surface">{copied ? "Copied" : "Copy"}</button>
      </div>
    </div>
  );
}
