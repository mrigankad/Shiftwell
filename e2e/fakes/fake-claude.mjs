#!/usr/bin/env node
// Behaves like `claude "<task>"` on disk: transcript under $CLAUDE_CONFIG_DIR/projects/<slug>/<uuid>.jsonl,
// a file written and committed in the cwd, and a call to the configured statusLine command with rate limits.
import { mkdirSync, appendFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { sleep, promptFromArgs, writeAndCommit, uuid, readHandoff } from "./common.mjs";

const cwd = process.cwd();
const cfg = process.env.CLAUDE_CONFIG_DIR;
if (!cfg) { console.error("fake-claude: CLAUDE_CONFIG_DIR is not set"); process.exit(2); }
const prompt = promptFromArgs();
const sessionId = uuid();
const slug = cwd.replace(/[^a-zA-Z0-9]/g, "-"); // same rule as Claude Code
const dir = join(cfg, "projects", slug);
mkdirSync(dir, { recursive: true });
const file = join(dir, `${sessionId}.jsonl`);
let parent = null;
const line = (type, message, extra = {}) => {
  const id = uuid();
  appendFileSync(file, JSON.stringify({ parentUuid: parent, isSidechain: false, userType: "external", cwd, sessionId, version: "2.1.0", type, message, uuid: id, timestamp: new Date().toISOString(), ...extra }) + "\n");
  parent = id;
};

console.log(`[fake-claude] start in ${cwd}`);
line("user", { role: "user", content: prompt });
await sleep(150);
const handoff = readHandoff(cwd);
line("assistant", { role: "assistant", model: "fake-claude", content: [{ type: "text", text: handoff ? "I read HANDOFF.md and will carry on." : "On it. I will write a file and commit it." }] });
const made = writeAndCommit(cwd, "claude", prompt);
const toolId = "toolu_" + uuid().slice(0, 12);
line("assistant", { role: "assistant", model: "fake-claude", content: [{ type: "tool_use", id: toolId, name: "Write", input: { file_path: join(cwd, made.name), content: `Task: ${prompt}
` } }] });
await sleep(150);
line("user", { role: "user", content: [{ type: "tool_result", tool_use_id: toolId, content: `File created: ${made.name}` }] });
line("assistant", { role: "assistant", model: "fake-claude", content: [{ type: "text", text: `Done. Committed ${made.name}.` }] });

// The statusLine call Claude Code makes after each reply.
try {
  const settings = JSON.parse(readFileSync(join(cfg, "settings.json"), "utf8"));
  const command = settings.statusLine?.command;
  if (command) {
    const pct = Number(process.env.FAKE_PCT ?? 10);
    const resetsAt = Math.floor(Date.now() / 1000) + 3 * 3600;
    const payload = { session_id: sessionId, cwd, model: { id: "fake-claude", display_name: "Fake Claude" }, workspace: { current_dir: cwd },
      rate_limits: { five_hour: { used_percentage: pct, resets_at: resetsAt }, seven_day: { used_percentage: pct, resets_at: resetsAt + 4 * 86400 } } };
    const out = execSync(command, { input: JSON.stringify(payload), encoding: "utf8", shell: true });
    console.log(`[fake-claude] status line: ${out}`);
  }
} catch (e) { console.error(`[fake-claude] status line failed: ${e.message}`); }
console.log("[fake-claude] done");
