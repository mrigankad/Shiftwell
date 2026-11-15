#!/usr/bin/env node
import { spawn, execFileSync } from "node:child_process";
import { existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "./args.js";
import { Client, CliError } from "./client.js";
import { HELP, formatBoard, useColor } from "./format.js";

const VERSION = "0.1.0";
const home = () => process.env.SHIFTWELL_HOME ?? join(homedir(), ".shiftwell");
const pidFile = () => join(home(), "daemon.pid");
const logFile = () => join(home(), "daemon.log");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function openBrowser(url: string) {
  const [cmd, args] =
    process.platform === "win32" ? ["cmd", ["/c", "start", '""', url]] :
    process.platform === "darwin" ? ["open", [url]] : ["xdg-open", [url]];
  try { spawn(cmd, args, { detached: true, stdio: "ignore" }).on("error", () => {}).unref(); } catch { /* ignore */ }
}

function alive(pid: number): boolean {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

function readPid(): number | null {
  try { const n = Number(readFileSync(pidFile(), "utf8").trim()); return Number.isInteger(n) && n > 0 ? n : null; } catch { return null; }
}

function port(flags: Record<string, string | boolean>): number {
  const raw = flags.port ?? process.env.SHIFTWELL_PORT ?? "4520";
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 65535) throw new CliError(`"${raw}" is not a valid port.`);
  return n;
}

async function start(flags: Record<string, string | boolean>) {
  const p = port(flags);
  const url = `http://127.0.0.1:${p}`;
  const client = new Client(url);
  if (await client.health()) {
    console.log(`Shiftwell is already running at ${url}`);
  } else {
    const here = dirname(fileURLToPath(import.meta.url));
    const server = resolve(here, "../../daemon/dist/server.js");
    if (!existsSync(server)) throw new CliError("The daemon is not built. Run: pnpm -r build");
    mkdirSync(home(), { recursive: true });
    const fd = openSync(logFile(), "a");
    const child = spawn(process.execPath, [server], {
      detached: true, stdio: ["ignore", fd, fd], env: { ...process.env, SHIFTWELL_PORT: String(p) },
    });
    child.on("error", () => {});
    child.unref();
    if (child.pid) writeFileSync(pidFile(), String(child.pid));
    let ok = false;
    for (let i = 0; i < 40 && !ok; i++) { await sleep(250); ok = await client.health(); }
    if (!ok) throw new CliError(`Shiftwell did not start within 10 seconds. See ${logFile()}`);
    console.log(`Shiftwell started at ${url}`);
  }
  if (!flags["no-open"]) openBrowser(url);
}

function stop() {
  const pid = readPid();
  if (pid === null || !alive(pid)) {
    rmSync(pidFile(), { force: true });
    console.log("Shiftwell is not running (no daemon started by this CLI).");
    return;
  }
  try {
    if (process.platform === "win32") execFileSync("taskkill", ["/pid", String(pid), "/t", "/f"], { stdio: "ignore" });
    else process.kill(pid, "SIGTERM");
  } catch { throw new CliError(`Could not stop process ${pid}.`); }
  rmSync(pidFile(), { force: true });
  console.log(`Stopped Shiftwell (pid ${pid}).`);
}

async function run(argv: string[]): Promise<void> {
  const a = parseArgs(argv);
  const color = useColor(process.stdout.isTTY, process.env);
  const client = () => new Client(`http://127.0.0.1:${port(a.flags)}`);
  switch (a.command) {
    case "version": console.log(VERSION); return;
    case "help": console.log(HELP); return;
    case "start": await start(a.flags); return;
    case "stop": stop(); return;
    case "status": {
      const board = await client().board();
      console.log(a.flags.json ? JSON.stringify(board, null, 2) : formatBoard(board, { color }));
      return;
    }
    case "run": {
      const task = a.positionals.join(" ").trim();
      const accounts = a.multi.account ?? [];
      if (!task || !accounts.length) throw new CliError('Usage: shiftwell run "<task>" --account <name-or-id> [--account ...] [--repo .]');
      const repo = resolve(typeof a.flags.repo === "string" ? a.flags.repo : ".");
      const runs = await client().startRun(task, repo, accounts);
      for (const r of runs) console.log(`Started run ${r.id} on branch ${r.branch}`);
      return;
    }
    case "handoff": {
      const id = a.positionals[0];
      const to = a.flags.to;
      if (!id || typeof to !== "string") throw new CliError("Usage: shiftwell handoff <runId> --to <account>");
      const r = await client().handoff(id, to);
      console.log(`Handed run ${r.id} to ${to} on branch ${r.branch}`);
      return;
    }
    case "done": {
      const id = a.positionals[0];
      if (!id) throw new CliError("Usage: shiftwell done <runId> [--remove-folder]");
      const r = await client().finish(id, a.flags["remove-folder"] === true);
      console.log(`Run ${id} marked done.`);
      if (r.warning) console.log(`Note: ${r.warning}`);
      return;
    }
    default:
      throw new CliError(`Unknown command "${a.command}". Run: shiftwell help`);
  }
}

run(process.argv.slice(2)).catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
