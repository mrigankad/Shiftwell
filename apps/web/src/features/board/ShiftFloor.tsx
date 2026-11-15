import type { Account, Run, Suggestion } from "../../api";
import { buttonCls } from "../../components/ui/Button";

/**
 * The live shift floor from the design: the animated pixel crew at their desks, a live count,
 * and the current handoff suggestion as a card over the scene.
 * People who ask for reduced motion get a still frame instead of the GIF.
 */
export function ShiftFloor({ accounts, runs, suggestion, canHandOff, onHandOff, onStart }: {
  accounts: Account[];
  runs: Run[];
  suggestion?: Suggestion;
  canHandOff: boolean;
  onHandOff: () => void;
  onStart: () => void;
}) {
  const busy = new Set(runs.filter((r) => r.status === "active").map((r) => r.profileId));
  const working = accounts.filter((a) => busy.has(a.id)).length;
  const resting = accounts.length - working;
  const from = suggestion && accounts.find((a) => a.id === suggestion.fromId);
  const fromPct = from?.usage.latest?.fiveHour?.pct;

  return (
    <section aria-label="Live shift floor" className="relative h-[220px] overflow-hidden rounded-card bg-floor sm:h-[300px]">
      {/* A 288x96, 32-colour version of the scene, scaled up with hard edges so every pixel reads as a block. */}
      <picture>
        <source srcSet="/shift-floor-pixel-still.png" media="(prefers-reduced-motion: reduce)" />
        <img src="/shift-floor-pixel.gif" alt="" className="absolute inset-0 size-full object-cover"
          style={{ imageRendering: "pixelated", filter: "saturate(1.15) contrast(1.05)" }} />
      </picture>
      {/* Pixel grid and soft scanlines, like an old monitor. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-50 mix-blend-multiply"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(0,0,0,0.22) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.22) 1px, transparent 1px)",
          backgroundSize: "4.5px 4.5px",
        }} />
      <div aria-hidden className="pointer-events-none absolute inset-0"
        style={{ backgroundImage: "repeating-linear-gradient(to bottom, rgba(0,0,0,0.12) 0px, rgba(0,0,0,0.12) 1px, transparent 1px, transparent 3px)" }} />
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ boxShadow: "inset 0 0 80px rgba(0,0,0,0.55)" }} />
      <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" aria-hidden />

      <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/55 px-3 py-1.5 text-xs font-bold text-white backdrop-blur sm:left-5 sm:top-5 sm:text-meta">
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-floor-live opacity-60 motion-reduce:hidden" />
          <span className="relative inline-flex size-2 rounded-full bg-floor-live" />
        </span>
        Live shift floor · {working} working · {resting} resting
      </div>

      <div className="absolute inset-x-3 bottom-3 flex flex-col gap-3 rounded-xl bg-card/95 p-3.5 shadow-xl backdrop-blur sm:inset-x-auto sm:bottom-5 sm:right-5 sm:max-w-[520px] sm:flex-row sm:items-center sm:gap-5 sm:p-4">
        {suggestion ? (
          <>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-xs font-bold text-action">
                {suggestion.from} is tired{typeof fromPct === "number" ? ` · ${Math.round(fromPct)}% of 5-hour` : ""}
              </span>
              <span className="text-ui font-bold leading-snug">
                {canHandOff ? `Pass the work to ${suggestion.to}?` : `${suggestion.to} has room for new work.`}
              </span>
            </div>
            {canHandOff ? (
              <button onClick={onHandOff} className={buttonCls("accent", "md", "shrink-0")}>
                Hand off to {suggestion.to}
              </button>
            ) : (
              <button onClick={onStart} className={buttonCls("secondary", "md", "shrink-0")}>
                Start a run
              </button>
            )}
          </>
        ) : (
          <>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-xs font-bold text-pass">All good</span>
              <span className="text-ui font-bold leading-snug">
                {accounts.length === 0 ? "Hire your first worker to open the floor." : "No one needs a handoff right now."}
              </span>
            </div>
            <button onClick={onStart} disabled={accounts.length === 0} className={buttonCls("secondary", "md", "shrink-0")}>
              Start a run
            </button>
          </>
        )}
      </div>
    </section>
  );
}
