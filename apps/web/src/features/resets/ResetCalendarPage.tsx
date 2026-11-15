import { CrewAvatar } from "../../crew";
import { EmptyState, type PageCtx } from "../../pages/shared";
import { countdown, useNow } from "../worker/useNow";

type Kind = "five" | "week" | "day";
interface Entry { key: string; accountId: string; name: string; kind: Kind; pct: number; at: number }

const KIND_LABEL: Record<Kind, string> = { five: "5-hour window", week: "Weekly window", day: "Daily window" };
const KIND_CLS: Record<Kind, string> = { five: "bg-action-soft text-action", week: "bg-pass-soft text-pass", day: "bg-warn-soft text-warn" };
const KIND_SHORT: Record<Kind, string> = { five: "5-hour", week: "Weekly", day: "Daily" };
const DAY = 86400000;

const startOfDay = (t: number) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
const timeOf = (t: number) => new Date(t).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
const dayTitle = (t: number, today: number) => {
  const diff = Math.round((t - today) / DAY);
  const base = new Date(t).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" });
  return diff === 0 ? `Today, ${base}` : diff === 1 ? `Tomorrow, ${base}` : base;
};

export function ResetCalendarPage({ ctx }: { ctx: PageCtx }) {
  const now = useNow();
  const today = startOfDay(now);

  const entries: Entry[] = [];
  for (const a of ctx.accounts) {
    const l = a.usage.latest;
    if (!l) continue;
    const add = (kind: Kind, w: { pct: number; resetsAt: number | null } | null | undefined, horizon: number) => {
      if (!w || !w.resetsAt) return;
      const at = w.resetsAt * 1000;
      if (at < now || at > now + horizon) return;
      entries.push({ key: `${a.id}-${kind}`, accountId: a.id, name: a.name, kind, pct: Math.round(w.pct), at });
    };
    add("five", l.fiveHour, DAY);
    add("week", l.sevenDay, 7 * DAY);
    add("day", l.daily, 7 * DAY);
  }
  entries.sort((x, y) => x.at - y.at);

  const groups = new Map<number, Entry[]>();
  for (const e of entries) {
    const k = startOfDay(e.at);
    groups.set(k, [...(groups.get(k) ?? []), e]);
  }
  const days = [...groups.entries()].sort((x, y) => x[0] - y[0]);
  // Soonest reset that actually frees something up.
  const best = entries.find((e) => e.pct > 0);

  const avatar = (id: string, size: number) => {
    const a = ctx.accounts.find((x) => x.id === id);
    return a ? <CrewAvatar provider={a.provider} preset={a.api?.preset} size={size} state={a.usage.state} /> : null;
  };

  // Every entry is in the future, so the marker sits above the first entry.
  const nowMarker = (
    <div role="separator" aria-label={`Now, ${timeOf(now)}`} className="flex items-center gap-3">
      <span className="rounded-full bg-action px-2.5 py-0.5 text-xs font-bold text-on-action">Now {timeOf(now)}</span>
      <span aria-hidden className="h-px flex-1 bg-action" />
    </div>
  );

  const row = (e: Entry) => (
    <li key={e.key} className="flex items-center gap-3.5 border-b border-row px-4 py-3 last:border-b-0">
      <button type="button" onClick={() => ctx.go(`accounts/${e.accountId}`)} aria-label={`Open ${e.name}`} className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left">
        {avatar(e.accountId, 36)}
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-[15px] font-bold">{e.name}</span>
          <span className="truncate text-xs text-muted">{KIND_LABEL[e.kind]} resets at {timeOf(e.at)}</span>
        </span>
      </button>
      <span className={`hidden w-[64px] shrink-0 rounded-full px-2.5 py-0.5 text-center text-xs font-bold sm:inline-block ${KIND_CLS[e.kind]}`}>{KIND_SHORT[e.kind]}</span>
      <span className="w-[110px] shrink-0 text-[13px] text-body">frees up <span className="font-bold text-ink">{e.pct}%</span></span>
      <span className="w-[100px] shrink-0 text-right text-[13px] font-bold tabular-nums">in {countdown(e.at / 1000, now)}</span>
    </li>
  );

  return (
    <div className="flex flex-col gap-5 px-7 py-6">
      <div className="flex flex-col gap-1">
        <span className="text-sm text-body">Accounts · next 7 days</span>
        <h1 className="text-[32px] font-bold tracking-[-0.03em]">Reset calendar</h1>
      </div>

      {entries.length === 0 ? (
        <EmptyState title="No resets coming up" body="Once an account reports a usage window with a reset time, it shows up here. Sign in to your accounts and let a reading come in." />
      ) : (
        <>
          {best && (
            <section aria-label="Plan around it" className="flex flex-wrap items-center gap-3.5 rounded-xl bg-pass-soft p-4">
              {avatar(best.accountId, 40)}
              <p className="min-w-[240px] flex-1 text-sm leading-[21px]">
                <span className="font-bold">Plan around it: </span>
                {best.name} frees up {best.pct}% of its {KIND_SHORT[best.kind].toLowerCase()} window in <span className="font-bold tabular-nums">{countdown(best.at / 1000, now)}</span>, at {timeOf(best.at)}. Save a big task for then.
              </p>
              <button type="button" onClick={() => ctx.go(`accounts/${best.accountId}`)} className="cursor-pointer rounded-lg border border-line bg-card px-3 py-1.5 text-[13px] font-bold hover:bg-surface">View account</button>
            </section>
          )}

          {nowMarker}

          <div className="flex flex-col gap-5">
            {days.map(([d, list]) => (
              <section key={d} aria-label={dayTitle(d, today)} className="flex flex-col gap-2">
                <h2 className={`text-sm font-bold ${d === today ? "text-action" : "text-ink"}`}>{dayTitle(d, today)}</h2>
                <ul className="flex flex-col rounded-xl border border-line bg-card">{list.map(row)}</ul>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
