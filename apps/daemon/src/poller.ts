import { listProfiles, readCodexLimits, recordSample } from "@shiftwell/core";

const lastError = new Map<string, string>();
export const codexErrors = () => Object.fromEntries(lastError);

/** Reads Codex limits for every Codex profile, one at a time, through the official app-server. */
export async function pollCodex(): Promise<void> {
  for (const p of listProfiles().filter((x) => x.provider === "codex")) {
    try {
      const limits = await readCodexLimits(p);
      recordSample(p.id, limits, limits.plan ? `codex ${limits.plan}` : null);
      lastError.delete(p.id);
    } catch (e) {
      lastError.set(p.id, (e as Error).message);
    }
  }
}

export function startCodexPoller(everyMs = 3 * 60_000): () => void {
  let running = false;
  const tick = async () => { if (running) return; running = true; try { await pollCodex(); } finally { running = false; } };
  void tick();
  const t = setInterval(tick, everyMs);
  return () => clearInterval(t);
}
