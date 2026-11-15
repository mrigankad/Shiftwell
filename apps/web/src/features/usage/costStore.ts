export type Currency = "USD" | "INR" | "EUR";
export interface PlanCost { amount: number; currency: Currency }

export const CURRENCIES: { id: Currency; label: string; symbol: string }[] = [
  { id: "USD", label: "USD, US dollar", symbol: "$" },
  { id: "INR", label: "INR, Indian rupee", symbol: "₹" },
  { id: "EUR", label: "EUR, euro", symbol: "€" },
];

const KEY = "shiftwell.planCost.v1";
export type CostMap = Record<string, PlanCost>;

/** Read the user's own plan costs. Storage can throw (private mode, blocked), so never trust it. */
export function loadCosts(): CostMap {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, Partial<PlanCost>>;
    const out: CostMap = {};
    for (const [id, v] of Object.entries(parsed)) {
      if (v && typeof v.amount === "number" && v.amount >= 0 && CURRENCIES.some((c) => c.id === v.currency)) {
        out[id] = { amount: v.amount, currency: v.currency as Currency };
      }
    }
    return out;
  } catch { return {}; }
}

export function saveCosts(map: CostMap): void {
  try { localStorage.setItem(KEY, JSON.stringify(map)); } catch { /* storage unavailable: keep in memory only */ }
}

export const symbolOf = (c: Currency) => CURRENCIES.find((x) => x.id === c)?.symbol ?? "";

export function money(n: number, c: Currency): string {
  const digits = n >= 100 ? 0 : 2;
  return `${symbolOf(c)}${n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}
