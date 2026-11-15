import { http } from "../../lib/http";
import type { Board, Insights } from "../../api";

const get = <T>(url: string) => http.get<T>(url);

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
