// Shared helpers for the fake CLIs. Synthetic content only.
import { execFileSync } from "node:child_process";
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const git = (cwd, ...args) =>
  execFileSync("git", ["-c", "user.name=Fake Agent", "-c", "user.email=fake@example.invalid", ...args], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

/** The first prompt the way the real CLIs get it: every argument after the program, joined. */
export const promptFromArgs = () => process.argv.slice(2).filter((a) => !a.startsWith("-") || a.length > 2).join(" ").trim() || "(no prompt)";

/** Creates (or edits) a file in cwd and commits just that file. Returns its relative name. */
export function writeAndCommit(cwd, tag, prompt) {
  const name = `fake-${tag}-${Date.now().toString(36)}.txt`;
  const handoff = existsSync(join(cwd, "HANDOFF.md"));
  writeFileSync(join(cwd, name), `Written by fake ${tag}.\nTask: ${prompt}\n${handoff ? "Continued from HANDOFF.md.\n" : ""}`);
  git(cwd, "add", "--", name);
  git(cwd, "commit", "-q", "-m", `fake ${tag}: ${name}`);
  return { name, sawHandoff: handoff };
}

export const readHandoff = (cwd) => { try { return readFileSync(join(cwd, "HANDOFF.md"), "utf8"); } catch { return ""; } };
export const uuid = () => crypto.randomUUID();
