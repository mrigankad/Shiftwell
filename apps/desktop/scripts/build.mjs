// Builds the installer with the repo root baked in as the fallback daemon location.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const env = { ...process.env, SHIFTWELL_REPO_DEFAULT: root };
const r = spawnSync("pnpm", ["exec", "tauri", "build", ...process.argv.slice(2)], { stdio: "inherit", env, shell: true });
process.exit(r.status ?? 1);
