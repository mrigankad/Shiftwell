import { useEffect, useRef, useState } from "react";
import type { Provider } from "./api";
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
  onCreate: (input: { name: string; provider: Provider; plan?: string }) => Promise<void>;
}) {
  const [provider, setProvider] = useState<Provider>("claude");
  const [name, setName] = useState("");
  const [plan, setPlan] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try { await onCreate({ name, provider, plan: plan || undefined }); }
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
        className="flex w-full max-w-[560px] flex-col gap-5 rounded-2xl bg-card p-6 shadow-2xl"
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
          <button type="submit" disabled={busy || !name.trim()} className="cursor-pointer rounded-lg bg-action px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
            {busy ? "Adding…" : "Add account"}
          </button>
        </div>
      </form>
    </div>
  );
}
