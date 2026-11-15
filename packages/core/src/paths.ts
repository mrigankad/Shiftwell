import { homedir } from "node:os";
import { join } from "node:path";
import { mkdirSync } from "node:fs";

/** Root folder for all Shiftwell state. Override with SHIFTWELL_HOME (used by tests). */
export function shiftwellHome(): string {
  const root = process.env.SHIFTWELL_HOME ?? join(homedir(), ".shiftwell");
  mkdirSync(root, { recursive: true });
  return root;
}

export function sub(...parts: string[]): string {
  const dir = join(shiftwellHome(), ...parts);
  mkdirSync(dir, { recursive: true });
  return dir;
}
