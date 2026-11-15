import { listProfiles, installApiProvider } from "@shiftwell/core";
import { buildApp } from "./app.js";
import { pollGemini, startCodexPoller } from "./poller.js";
import { notify, startAlertLoop } from "./notifier.js";

const PORT = Number(process.env.SHIFTWELL_PORT ?? 4520);
const app = buildApp();
// Keep each API account's config.toml pointing at the right place (the local translator for chat-wire providers, with this port).
for (const p of listProfiles()) if (p.api) { try { installApiProvider(p, { port: PORT }); } catch { /* leave the file as it is */ } }
// Bind to loopback only: Shiftwell is never reachable from the network.
app.listen({ host: "127.0.0.1", port: PORT }).then(() => {
  console.log(`Shiftwell daemon on http://127.0.0.1:${PORT}`);
  if (process.env.SHIFTWELL_NO_POLL !== "1") { startCodexPoller(); pollGemini(); setInterval(pollGemini, 60_000); }
  if (process.env.SHIFTWELL_NO_NOTIFY !== "1") startAlertLoop({ notify });
});
