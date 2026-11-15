// UI smoke through headless Edge over CDP. Called by run.mjs against the e2e daemon (never a standalone server).
import { spawn, execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import net from "node:net";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const EDGE = [
  process.env.EDGE_PATH,
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/microsoft-edge", "/usr/bin/google-chrome", "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
].find((p) => p && existsSync(p));

const freePort = () => new Promise((res, rej) => { const s = net.createServer(); s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => res(p)); }); s.on("error", rej); });

async function launch() {
  const port = await freePort();
  const dir = mkdtempSync(join(tmpdir(), "sw-edge-"));
  const proc = spawn(EDGE, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--no-default-browser-check", "--disable-sync", "--disable-features=BackForwardCache", `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, "about:blank"], { stdio: "ignore" });
  let ver;
  for (let i = 0; i < 60 && !ver; i++) { try { ver = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); } catch { await sleep(200); } }
  if (!ver) { proc.kill(); throw new Error("Edge did not start"); }
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const ws = new WebSocket(targets.find((t) => t.type === "page" && !t.url.startsWith("edge:") && !t.url.startsWith("chrome:")).webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r));
  let id = 0;
  const pending = new Map();
  const listeners = [];
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } else if (m.method) listeners.forEach((l) => l(m));
  });
  const send = (method, params = {}) => new Promise((r, rej) => { const i = ++id; const t = setTimeout(() => { pending.delete(i); rej(new Error(`CDP ${method} timed out`)); }, 20000); pending.set(i, (m) => { clearTimeout(t); r(m); }); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (expr) => (await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value;
  const close = () => {
    try { ws.close(); } catch { /* closed */ }
    try { if (process.platform === "win32") execFileSync("taskkill", ["/PID", String(proc.pid), "/T", "/F"], { stdio: "ignore" }); else proc.kill("SIGKILL"); } catch { /* gone */ }
    setTimeout(() => { try { rmSync(dir, { recursive: true, force: true }); } catch { /* locked, temp */ } }, 1500).unref();
  };
  return { send, ev, on: (l) => listeners.push(l), close };
}

export async function runUi(ctx, check, group) {
  group("web UI");
  if (!EDGE) { await check("headless Edge available", async () => { throw new Error("no Edge or Chrome found (set EDGE_PATH)"); }); return; }
  mkdirSync(ctx.out, { recursive: true });
  const cdp = await launch();
  try {
    let errors = [];
    cdp.on((m) => {
      if (m.method === "Runtime.exceptionThrown") errors.push("exception: " + (m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text).slice(0, 140));
      else if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push("console.error: " + m.params.args.map((a) => a.value ?? a.description ?? "").join(" ").slice(0, 140));
      else if (m.method === "Page.javascriptDialogOpening") {
        errors.push(`dialog (${m.params.type}): ${String(m.params.message).slice(0, 80)}`);
        cdp.send("Page.handleJavaScriptDialog", { accept: true }).catch(() => {});
      } else if (m.method === "Log.entryAdded" && m.params.entry.level === "error" && !/favicon/.test(m.params.entry.url ?? "")) errors.push(`log: ${m.params.entry.text} ${m.params.entry.url ?? ""}`.slice(0, 160));
    });
    await cdp.send("Page.enable"); await cdp.send("Runtime.enable"); await cdp.send("Log.enable");

    const only = process.env.E2E_ROUTES?.split(",");
    const routes = [
      "board", "runs", "handoffs", "accounts", "resets", "insights", "usage", "recap", "rules", "safety", "skills", "memory",
      `accounts/${ctx.accountId}`, `live/${ctx.liveRun.id}`, `live/${ctx.codexRun.id}`, ...(ctx.groupId ? [`compare/${ctx.groupId}`] : []),
    ].filter((r) => !only || only.some((o) => r.startsWith(o)));
    const widths = [390, 1440];
    const texts = {};

    for (const w of widths) {
      await cdp.send("Emulation.setDeviceMetricsOverride", { width: w, height: 900, deviceScaleFactor: 1, mobile: w < 600 });
      for (const route of routes) {
        const label = route.replace(ctx.accountId, "account").replace(ctx.liveRun.id, "claude-run").replace(ctx.codexRun.id, "codex-run").replace(ctx.groupId ?? "-", "group");
        await check(`route #/${label} @ ${w}`, async () => {
          errors = [];
          // Leave the previous page first so its live streams (SSE) close and never fill the browser's per-host connection limit.
          await cdp.send("Page.navigate", { url: "about:blank" });
          await cdp.send("Page.navigate", { url: `${ctx.base}/?t=${Date.now()}#/${route}` });
          // Wait for the app to render something real and for loading skeletons to go away.
          for (let i = 0; i < 60; i++) {
            const ready = await cdp.ev(`!!document.querySelector("main") && !document.querySelector('[role=status][aria-label^="Loading"]') && document.body.innerText.length > 200`);
            if (ready) break;
            await sleep(200);
          }
          await sleep(900);
          const m = await cdp.ev(`(() => { const d = document.documentElement; const main = document.querySelector("main");
            const wide = [...document.querySelectorAll("body *")].filter(e => e.getBoundingClientRect().right > innerWidth + 1 && getComputedStyle(e).position !== "fixed").slice(0, 3).map(e => e.tagName + "." + String(e.className).slice(0, 50));
            return { scrollW: Math.max(d.scrollWidth, main ? main.scrollWidth : 0, document.body.scrollWidth), w: innerWidth, wide, text: document.body.innerText }; })()`);
          const shot = await cdp.send("Page.captureScreenshot", { format: "png" });
          writeFileSync(join(ctx.out, `${label.replace(/\//g, "-")}-${w}.png`), Buffer.from(shot.result.data, "base64"));
          texts[`${route}@${w}`] = m.text;
          const problems = [];
          if (m.scrollW > m.w) problems.push(`horizontal overflow ${m.scrollW - m.w}px ${JSON.stringify(m.wide)}`);
          if (errors.length) problems.push(...errors.slice(0, 2));
          if (problems.length) throw new Error(problems.join(" | "));
        });
      }
    }

    for (const w of widths) {
      await check(`board shows all accounts @ ${w}`, async () => {
        const t = texts[`board@${w}`] ?? "";
        const miss = ["Claude A", "Claude B", "Codex A"].filter((n) => !t.includes(n));
        if (miss.length) throw new Error(`board text lacks ${miss.join(", ")}`);
      });
      await check(`live view shows events @ ${w}`, async () => {
        const t = texts[`live/${ctx.liveRun.id}@${w}`] ?? "";
        if (!/greeting/i.test(t)) throw new Error("live view does not show the task prompt");
        if (!/Committed|Done|Write/.test(t)) throw new Error("live view does not show assistant or tool events");
        const t2 = texts[`live/${ctx.codexRun.id}@${w}`] ?? "";
        if (!/HANDOFF|Committed/.test(t2)) throw new Error("codex live view shows no events");
      });
    }
  } finally { cdp.close(); }
}
