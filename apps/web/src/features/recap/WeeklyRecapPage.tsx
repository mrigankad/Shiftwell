import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EmptyState } from "../../pages/shared";
import { loadWeek } from "../usage/client";
import { canvasToBlob, renderRecapCard } from "./renderCard";
import { buildRecap, plainSummary, talkingPoints, type Recap } from "./summary";

function ActionButton({ children, onClick, primary, disabled }: { children: React.ReactNode; onClick: () => void; primary?: boolean; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`cursor-pointer rounded-[10px] px-[18px] py-3 text-[15px] font-bold disabled:cursor-not-allowed disabled:opacity-50 ${primary ? "bg-shift text-on-action hover:opacity-90" : "border border-line bg-card text-ink hover:bg-surface"}`}>
      {children}
    </button>
  );
}

export function WeeklyRecapPage() {
  const [recap, setRecap] = useState<Recap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const canvas = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let live = true;
    loadWeek().then((d) => { if (live) setRecap(buildRecap(d.insights, d.board)); }).catch((e: Error) => { if (live) setError(e.message); });
    return () => { live = false; };
  }, []);

  useEffect(() => {
    if (!recap) return;
    let live = true;
    renderRecapCard(recap).then((cv) => { if (live) { canvas.current = cv; setPreview(cv.toDataURL("image/png")); } })
      .catch((e: Error) => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [recap]);

  const say = (m: string) => { setStatus(m); window.setTimeout(() => setStatus(""), 4000); };

  const download = useCallback(async () => {
    if (!canvas.current || !recap) return;
    try {
      const blob = await canvasToBlob(canvas.current);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `shiftwell-recap-${recap.weekLabel.replace(/\s+/g, "-")}.png`;
      document.body.appendChild(a); a.click(); a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      say("PNG saved to your downloads.");
    } catch (e) { say((e as Error).message); }
  }, [recap]);

  const copy = useCallback(async () => {
    if (!recap) return;
    const text = plainSummary(recap);
    try { await navigator.clipboard.writeText(text); say("Summary copied."); }
    catch { say("Copy was blocked by the browser. Allow clipboard access and try again."); }
  }, [recap]);

  const points = useMemo(() => (recap ? talkingPoints(recap) : []), [recap]);

  return (
    <div className="flex flex-col gap-6">
      {error && <p role="alert" className="rounded-xl border border-fail bg-fail-soft px-4 py-3 text-sm text-fail">Could not build the recap: {error}</p>}
      {!recap && !error && <p role="status" className="text-sm text-body">Building the recap</p>}

      {recap && recap.empty && (
        <EmptyState title="Nothing to recap yet" body="Once the crew finishes a few runs this week, the card fills in with hours, handoffs and the hardest working account." />
      )}

      {recap && (
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[560px_minmax(0,1fr)]">
          <div className="w-full max-w-[560px] overflow-hidden rounded-3xl bg-surface">
            {preview
              ? <img src={preview} width={560} height={640} className="block h-auto w-full" alt={`Weekly recap card for ${recap.weekLabel}: ${recap.runsFinished} runs finished, ${recap.handoffs} handoffs, ${recap.commits} commits across ${recap.files} files.`} />
              : <div className="aspect-[560/640] w-full" aria-hidden />}
          </div>

          <div className="flex flex-col gap-7">
            <span className="text-[14px] font-bold text-action">EVERY SUNDAY NIGHT</span>
            <h1 className="text-[44px] font-bold leading-[48px] tracking-[-0.035em]">A recap worth sharing.</h1>
            <p className="max-w-[560px] text-[17px] leading-7 text-body">
              The week in one card: agent time, finished runs, handoffs and the hardest working account. Share it, or just enjoy it.
            </p>
            <ol role="list" className="flex max-w-[560px] flex-col">
              {points.map((p, i) => (
                <li key={i} className="flex items-start gap-3.5 border-t border-line py-3.5">
                  <span aria-hidden className="w-7 shrink-0 text-[15px] font-bold text-action">{String(i + 1).padStart(2, "0")}</span>
                  <span className="text-[16px] leading-6">{p}</span>
                </li>
              ))}
            </ol>
            <div className="flex flex-wrap items-center gap-2.5">
              <ActionButton primary onClick={download} disabled={!preview}>Download as PNG</ActionButton>
              <ActionButton onClick={copy} disabled={!recap}>Copy summary</ActionButton>
              <span role="status" aria-live="polite" className="text-[13px] text-body">{status}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
