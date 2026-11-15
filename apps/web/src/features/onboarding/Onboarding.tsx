import { useEffect, useRef, useState, type ReactNode } from "react";
import { Mark } from "../../crew";

const KEY = "shiftwell.onboarded";

export const isOnboarded = (): boolean => {
  try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
};
export const markOnboarded = (): void => {
  try { localStorage.setItem(KEY, "1"); } catch { /* private mode */ }
};
/** True when the welcome flow should appear. */
export const shouldShowOnboarding = (accountsCount: number): boolean => accountsCount === 0 && !isOnboarded();

const STEPS: { eyebrow: string; title: string; body: string; caption: [string, string] }[] = [
  { eyebrow: "WELCOME", title: "Meet your crew.", body: "Shiftwell keeps every AI coding account in one place, shows who has room left, and hands a task to the next one when a limit hits.", caption: ["Safe by design", "Shiftwell never reads or stores your login tokens. It only starts each vendor's own tool."] },
  { eyebrow: "HOW IT WORKS", title: "Three promises.", body: "", caption: ["Nothing you have changes", "Each account gets its own profile folder. Your existing setup stays exactly as it is."] },
  { eyebrow: "ADD YOUR FIRST ACCOUNT", title: "Hire your first agent.", body: "Pick a tool and give the account a name. You sign in through the vendor's own login, in a terminal that Shiftwell opens for you.", caption: ["Takes about a minute", "You can add more accounts any time from the Accounts page."] },
  { eyebrow: "ALL SET", title: "You are on shift.", body: "Your account is ready. Sign in from its row, then start a run to give it a task. Press Ctrl K any time to jump anywhere.", caption: ["Tip", "If an account runs low, Shiftwell suggests a handoff. You stay in charge."] },
];

const PROMISES: { title: string; body: string; icon: ReactNode }[] = [
  { title: "Safe mode is on", body: "Auto-rotation is off. Nothing switches accounts unless you say so.", icon: <path d="M10 2.5l6 2.5v4.5c0 3.7-2.5 6.3-6 7.5-3.5-1.2-6-3.8-6-7.5V5z" /> },
  { title: "Official CLIs only", body: "Claude Code, Codex and Gemini run exactly as the vendor ships them.", icon: <path d="M4 5l4 4-4 4M10 14h6" /> },
  { title: "No tokens, ever", body: "Shiftwell never reads, copies or stores your login or API tokens.", icon: <><circle cx="7.5" cy="10" r="3" /><path d="M10.5 10H17M14.5 10v2.5" /><path d="M3 17L17 3" /></> },
];

export function Onboarding({ accountsCount, onAddAccount, onClose }: {
  accountsCount: number; onAddAccount: () => void; onClose: () => void;
}) {
  const [step, setStep] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const last = STEPS.length - 1;
  const startCount = useRef(accountsCount);
  const added = accountsCount > startCount.current;

  const finish = () => { markOnboarded(); onClose(); };

  // Once an account appears while on the add step, move to the done step.
  useEffect(() => { if (added && step === 2) setStep(3); }, [added, step]);

  // Focus the primary control on each step.
  useEffect(() => { root.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus(); }, [step]);

  // Esc skips; Tab is trapped inside the flow.
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); finish(); return; }
    if (e.key !== "Tab" || !root.current) return;
    const f = [...root.current.querySelectorAll<HTMLElement>("button:not([disabled])")];
    if (!f.length) return;
    const first = f[0], lastEl = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); lastEl.focus(); }
    else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); first.focus(); }
  };

  const s = STEPS[step];
  const primary = "cursor-pointer rounded-xl bg-cta px-5 py-3 text-[15px] font-bold text-on-cta hover:opacity-90";
  const secondary = "cursor-pointer rounded-xl border border-line bg-card px-4 py-3 text-[15px] font-bold hover:bg-surface";

  return (
    <div ref={root} role="dialog" aria-modal="true" aria-labelledby="onb-title" onKeyDown={onKey}
      className="fixed inset-0 z-40 flex flex-col overflow-y-auto bg-page lg:flex-row lg:gap-4 lg:overflow-hidden lg:p-4">
      <section className="flex flex-1 flex-col px-8 py-8 lg:px-16 lg:py-10">
        <div className="flex items-center gap-2.5"><Mark /><span className="text-[21px] font-bold tracking-[-0.04em]">shiftwell</span></div>

        <div className="flex flex-1 flex-col justify-center gap-4 py-10 lg:max-w-[540px]">
          <span className="text-[13px] font-bold tracking-[0.06em] text-action">{`STEP ${step + 1} OF ${STEPS.length} · ${s.eyebrow}`}</span>
          <h1 id="onb-title" className="text-[44px] font-bold leading-[1.05] tracking-[-0.04em]">{s.title}</h1>
          {s.body && <p className="text-[17px] leading-7 text-body">{s.body}</p>}

          {step === 1 && (
            <ul className="flex flex-col gap-3 pt-2">
              {PROMISES.map((p) => (
                <li key={p.title} className="flex items-start gap-3.5 rounded-xl border border-line bg-card p-4">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-action-soft text-action">
                    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{p.icon}</svg>
                  </span>
                  <span className="flex flex-col"><span className="text-[15px] font-bold">{p.title}</span><span className="text-sm leading-6 text-body">{p.body}</span></span>
                </li>
              ))}
            </ul>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-3 pt-2">
              <button type="button" data-autofocus onClick={onAddAccount} className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-action-line bg-pick p-4 text-left">
                <span className="flex flex-col"><span className="text-[15px] font-bold">Add an account</span><span className="text-sm text-body">Claude Code, Codex, Gemini or an API key</span></span>
                <span aria-hidden className="text-sm font-bold text-action">Add</span>
              </button>
              {added && <p role="status" className="text-sm font-bold text-pass">Account added.</p>}
            </div>
          )}

          {step === 3 && (
            <p role="status" className="text-sm font-bold text-pass">{accountsCount} {accountsCount === 1 ? "account" : "accounts"} ready.</p>
          )}
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="flex gap-1.5" aria-hidden>
            {STEPS.map((_, i) => <span key={i} className={`h-1.5 rounded-full ${i === step ? "w-6 bg-action" : "w-1.5 bg-track"}`} />)}
          </div>
          <div className="flex gap-2">
            {step > 0 && step < last && <button type="button" onClick={() => setStep(step - 1)} className={secondary}>Back</button>}
            {step < last && <button type="button" onClick={finish} className={secondary}>Skip</button>}
            {step < 2 && <button type="button" data-autofocus onClick={() => setStep(step + 1)} className={primary}>Continue</button>}
            {step === 2 && <button type="button" onClick={() => setStep(3)} className={primary}>{added ? "Continue" : "I will do it later"}</button>}
            {step === last && <button type="button" data-autofocus onClick={finish} className={primary}>Open the board</button>}
          </div>
        </div>
      </section>

      <aside className="relative min-h-[320px] flex-1 overflow-hidden lg:rounded-[28px]">
        <img src="/welcome.png" alt="" className="absolute inset-0 size-full object-cover" style={{ imageRendering: "pixelated" }} />
        <div className="absolute bottom-6 left-6 right-6 flex max-w-[340px] flex-col gap-1 rounded-2xl border border-line bg-card p-4 shadow-xl">
          <span className="text-[13px] font-bold text-pass">{s.caption[0]}</span>
          <span className="text-sm leading-5 text-ink">{s.caption[1]}</span>
        </div>
      </aside>
    </div>
  );
}
