import { buildApp } from "./app.js";
import { startCodexPoller } from "./poller.js";

const PORT = Number(process.env.SHIFTWELL_PORT ?? 4520);
const app = buildApp();
// Bind to loopback only: Shiftwell is never reachable from the network.
app.listen({ host: "127.0.0.1", port: PORT }).then(() => {
  console.log(`Shiftwell daemon on http://127.0.0.1:${PORT}`);
  if (process.env.SHIFTWELL_NO_POLL !== "1") startCodexPoller();
});
