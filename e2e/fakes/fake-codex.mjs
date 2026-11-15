#!/usr/bin/env node
// Behaves like `codex "<task>"` on disk: rollout file under $CODEX_HOME/sessions/YYYY/MM/DD/, a file written
// through apply_patch and committed in the cwd.
import { mkdirSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { sleep, promptFromArgs, writeAndCommit, uuid, readHandoff } from "./common.mjs";

const cwd = process.cwd();
const home = process.env.CODEX_HOME;
if (!home) { console.error("fake-codex: CODEX_HOME is not set"); process.exit(2); }
const prompt = promptFromArgs();
const now = new Date();
const p2 = (n) => String(n).padStart(2, "0");
const dir = join(home, "sessions", String(now.getFullYear()), p2(now.getMonth() + 1), p2(now.getDate()));
mkdirSync(dir, { recursive: true });
const id = uuid();
const file = join(dir, `rollout-${now.toISOString().replace(/:/g, "-").slice(0, 19)}-${id}.jsonl`);
const put = (type, payload) => appendFileSync(file, JSON.stringify({ timestamp: new Date().toISOString(), type, payload }) + "\n");

console.log(`[fake-codex] start in ${cwd}`);
put("session_meta", { id, timestamp: now.toISOString(), cwd, originator: "fake_codex", cli_version: "0.0.0", source: "cli" });
put("event_msg", { type: "task_started" });
put("response_item", { type: "message", role: "user", content: [{ type: "input_text", text: prompt }] });
await sleep(150);
const handoff = readHandoff(cwd);
put("response_item", { type: "message", role: "assistant", content: [{ type: "output_text", text: handoff ? "Reading HANDOFF.md, then continuing." : "I will add a file and commit it." }] });
const made = writeAndCommit(cwd, "codex", prompt);
const callId = "call_" + uuid().slice(0, 12);
put("response_item", { type: "custom_tool_call", call_id: callId, name: "apply_patch", status: "completed", input: `*** Begin Patch\n*** Add File: ${made.name}\n+Task: ${prompt}\n*** End Patch` });
put("response_item", { type: "custom_tool_call_output", call_id: callId, output: JSON.stringify({ output: `Success. Updated the following files:\nA ${made.name}\n`, metadata: { exit_code: 0 } }) });
put("response_item", { type: "message", role: "assistant", content: [{ type: "output_text", text: `Committed ${made.name}.` }] });
put("event_msg", { type: "task_complete" });
console.log("[fake-codex] done");
