# Shiftwell

A local control room for people who pay for several AI coding plans. Each account
runs the vendor's **official CLI** in its own profile folder; Shiftwell reads only
the status line those CLIs emit and suggests handoffs when one account runs low.
It never reads or stores login tokens.

## Stack

| Layer | Choice |
| --- | --- |
| Core logic | TypeScript library `packages/core` (profiles, status hook, usage math, handoff advisor) |
| Background service | Node 22 + Fastify, `apps/daemon`, bound to 127.0.0.1:4520, live updates over SSE |
| UI | React 18 + Vite 6 + Tailwind 4, `apps/web`, Plus Jakarta Sans, pixel crew art |
| Desktop shell | Tauri 2 (next step, needs Rust installed) |

## Run

```bash
pnpm install
pnpm -r build
node apps/daemon/dist/server.js   # serves the UI at http://127.0.0.1:4520
```

Development: `pnpm --filter @shiftwell/daemon dev` and `pnpm --filter @shiftwell/web dev` (UI on :4521).
Set `SHIFTWELL_HOME` to keep test data out of `~/.shiftwell`.

## How usage is read

Creating a Claude Code profile writes a `statusLine` command into that profile's own
`settings.json`. Claude Code pipes JSON to it, including `rate_limits.five_hour` and
`seven_day`; the hook appends those numbers to `~/.shiftwell/usage/<id>.jsonl`.
Numbers appear after the profile's first reply.

For Codex profiles the daemon runs `codex app-server` with that profile's `CODEX_HOME` every 3 minutes and asks `account/rateLimits/read` over JSON-RPC. Codex reads its own login; Shiftwell never opens auth.json. Set `SHIFTWELL_NO_POLL=1` to turn this off.

For Gemini profiles Shiftwell turns on the CLI's own local telemetry in that profile's `.gemini/settings.json` (prompts are not logged) and counts `gemini_cli.api_request` events since midnight Pacific, against 1000 a day or the number in the plan field. Gemini does not report remaining quota, so this is a count, not a vendor figure.

## Status (v0.1)

- [x] Profiles with isolated config folders, sign in through the vendor's own login
- [x] Claude Code status hook, usage history, state, burn-rate forecast
- [x] Handoff suggestions (suggest only, never automatic)
- [x] Shift board UI, add-account dialog, empty state
- [x] Codex usage reader (`codex app-server`)
- [x] Gemini daily request counter (CLI local telemetry)
- [ ] Launching agents in git worktrees and handoff notes
- [ ] Tauri shell, menu-bar widget, notifications
