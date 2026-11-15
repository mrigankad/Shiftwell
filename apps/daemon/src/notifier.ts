import { spawn } from "node:child_process";
import { detectAlerts, listProfiles, suggestHandoffs, usageFor, type Seen, type Usage } from "@shiftwell/core";

const PS_AUMID = "{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\\WindowsPowerShell\\v1.0\\powershell.exe";

export function xmlEscape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

/** Text goes in as base64 JSON, so nothing user supplied is ever part of the script source. */
export function encodePayload(title: string, body: string): string {
  return Buffer.from(JSON.stringify({ title: xmlEscape(title), body: xmlEscape(body) }), "utf8").toString("base64");
}

export function windowsScript(title: string, body: string): string {
  const b64 = encodePayload(title, body);
  return [
    "$ErrorActionPreference = 'Stop'",
    `$p = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${b64}')) | ConvertFrom-Json`,
    "[void][Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime]",
    "[void][Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime]",
    "$xml = New-Object Windows.Data.Xml.Dom.XmlDocument",
    "$xml.LoadXml('<toast><visual><binding template=\"ToastGeneric\"><text>' + $p.title + '</text><text>' + $p.body + '</text></binding></visual></toast>')",
    "$toast = [Windows.UI.Notifications.ToastNotification]::new($xml)",
    `[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('${PS_AUMID}').Show($toast)`,
  ].join("\n");
}

export function windowsArgs(title: string, body: string): string[] {
  const enc = Buffer.from(windowsScript(title, body), "utf16le").toString("base64");
  return ["-NoProfile", "-NonInteractive", "-EncodedCommand", enc];
}

export function appleScriptEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/[\r\n]+/g, " ");
}

export function commandFor(title: string, body: string, platform: string = process.platform): { cmd: string; args: string[] } {
  if (platform === "win32") return { cmd: "powershell.exe", args: windowsArgs(title, body) };
  if (platform === "darwin") {
    return { cmd: "osascript", args: ["-e", `display notification "${appleScriptEscape(body)}" with title "${appleScriptEscape(title)}"`] };
  }
  return { cmd: "notify-send", args: ["--", title, body] };
}

/** Sends a native notification. Fire and forget: never throws. Resolves with the exit code (null on failure). */
export function notify(title: string, body: string): Promise<number | null> {
  return new Promise((resolve) => {
    try {
      const { cmd, args } = commandFor(title, body);
      const c = spawn(cmd, args, { stdio: "ignore", windowsHide: true });
      c.on("error", () => resolve(null));
      c.on("exit", (code) => resolve(code));
    } catch {
      resolve(null);
    }
  });
}

type Profiles = ReturnType<typeof listProfiles>;

export interface AlertLoopOptions {
  notify: (title: string, body: string) => unknown;
  everyMs?: number;
  /** Test hook: supply data instead of reading from disk. */
  read?: () => { profiles: Profiles; usage: Map<string, Usage> };
}

function readFresh() {
  const profiles = listProfiles();
  const usage = new Map(profiles.map((p) => [p.id, usageFor(p)] as const));
  return { profiles, usage };
}

export function startAlertLoop(opts: AlertLoopOptions): () => void {
  const read = opts.read ?? readFresh;
  let prev = new Map<string, Seen>();
  const tick = () => {
    try {
      const { profiles, usage } = read();
      const r = detectAlerts(prev, profiles, usage, suggestHandoffs(profiles, usage));
      prev = r.next;
      for (const a of r.alerts) {
        try { void Promise.resolve(opts.notify(a.title, a.body)).catch(() => {}); } catch { /* ignore */ }
      }
    } catch { /* never crash the daemon over a notification */ }
  };
  tick();
  const t = setInterval(tick, opts.everyMs ?? 30_000);
  t.unref?.();
  return () => clearInterval(t);
}
