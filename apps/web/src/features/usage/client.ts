import type { Board, Insights } from "../../api";

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `Request failed (${res.status})`);
  return body as T;
}

/** Small fetch client for the usage and recap features. No api.ts changes needed. */
export const usageApi = {
  insights: () => get<Insights>("/api/insights"),
  board: () => get<Board>("/api/board"),
};

export interface WeekData { insights: Insights; board: Board }

export async function loadWeek(): Promise<WeekData> {
  const [insights, board] = await Promise.all([usageApi.insights(), usageApi.board()]);
  return { insights, board };
}
