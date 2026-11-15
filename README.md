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
| Desktop shell | Tauri 2, `apps/desktop` (window + tray, see below) |

## Run

```bash
pnpm install
pnpm -r build
node apps/daemon/dist/server.js   # serves the UI at http://127.0.0.1:4520
```

Development: `pnpm --filter @shiftwell/daemon dev` and `pnpm --filter @shiftwell/web dev` (UI on :4521).
Set `SHIFTWELL_HOME` to keep test data out of `~/.shiftwell`.

## Command line

`apps/cli` builds the `shiftwell` command (no extra dependencies). After `pnpm -r build`, run it with `pnpm shiftwell <command>` or `node apps/cli/dist/main.js <command>`.

```bash
shiftwell start [--port 4520] [--no-open]   # start the daemon if needed, open the board
shiftwell stop                              # stop the daemon that "start" launched
shiftwell status [--json]                   # accounts, active runs, handoff suggestion
shiftwell run "fix the login bug" --account "Claude A" --account "Codex A" --repo .
shiftwell handoff <runId> --to "Codex A"
shiftwell done <runId> [--remove-folder]
```

`start` logs to `$SHIFTWELL_HOME/daemon.log` (default `~/.shiftwell`) and keeps a pid file there. Colours are used only on a terminal and are off when `NO_COLOR` is set.

## How usage is read

Creating a Claude Code profile writes a `statusLine` command into that profile's own
`settings.json`. Claude Code pipes JSON to it, including `rate_limits.five_hour` and
`seven_day`; the hook appends those numbers to `~/.shiftwell/usage/<id>.jsonl`.
Numbers appear after the profile's first reply.

For Codex profiles the daemon runs `codex app-server` with that profile's `CODEX_HOME` every 3 minutes and asks `account/rateLimits/read` over JSON-RPC. Codex reads its own login; Shiftwell never opens auth.json. Set `SHIFTWELL_NO_POLL=1` to turn this off.

For Gemini profiles Shiftwell turns on the CLI's own local telemetry in that profile's `.gemini/settings.json` (prompts are not logged) and counts `gemini_cli.api_request` events since midnight Pacific, against 1000 a day or the number in the plan field. Gemini does not report remaining quota, so this is a count, not a vendor figure.

## Chat-only providers (the Responses shim)

The Codex CLI only speaks the OpenAI Responses API, but DeepSeek, Kimi and NVIDIA NIM only offer Chat Completions. Accounts whose preset has `wire: "chat"` therefore get a `config.toml` whose `base_url` is the daemon's own translator, `http://127.0.0.1:<port>/shim/<profileId>/v1`, and an `env_key` of a dummy variable (`SHIFTWELL_SHIM_KEY`) that Shiftwell sets in the terminal it opens. The translator turns each Responses request (instructions, messages, function calls and their outputs, function tools) into a `/chat/completions` call to the real provider, adds the bearer key from the environment variable named in the account (read in the daemon process; whatever Codex sends is ignored), and turns the reply, streamed or not, back into Responses events. It answers loopback callers only and never echoes the key or the provider's error text. Grok and Ollama Cloud (`wire: "responses"`) are called directly. It has not yet been tested against a live provider.

## Status (v0.1)

- [x] Profiles with isolated config folders, sign in through the vendor's own login
- [x] Claude Code status hook, usage history, state, burn-rate forecast
- [x] Handoff suggestions (suggest only, never automatic)
- [x] Shift board UI, add-account dialog, empty state
- [x] Codex usage reader (`codex app-server`)
- [x] Gemini daily request counter (CLI local telemetry)
- [x] Runs: each task gets its own git worktree and `shiftwell/<id>` branch, the account's CLI opens there with the task
- [x] Handoffs: writes `HANDOFF.md` (task, commits, uncommitted files, diff size) and opens the next account's CLI in the same worktree
- [ ] Tauri shell, menu-bar widget, notifications

## Desktop app

`apps/desktop` is a Tauri 2 shell with no frontend of its own: its window loads `http://127.0.0.1:<port>` (`SHIFTWELL_PORT`, default 4520) from the daemon. It needs Rust (stable, MSVC on Windows) and a built daemon (`pnpm -r build`).

```bash
pnpm desktop                                  # tauri dev
pnpm --filter @shiftwell/desktop build        # installer in apps/desktop/src-tauri/target/release/bundle
```

On launch it checks `/api/health`; if no daemon answers it runs `node <repo>/apps/daemon/dist/server.js` (no console window), waits up to 10 s, then shows the window. It stops the daemon on quit only if it started it. The repo is taken from `SHIFTWELL_REPO`; if unset, the nearest parent folder of the executable that contains `apps/daemon/dist/server.js` is used (works for dev and release builds inside the checkout). Installed elsewhere, set `SHIFTWELL_REPO`. A missing Node or daemon shows an error page.

The tray menu has Open Shiftwell, Open dashboard in browser, a status line, a handoff suggestion (opens `#/board`; disabled and reading "No handoff suggested" when there is none), a "Start with Windows" check item ("Open at login" on macOS; off by default, state kept by the autostart plugin) and Quit. The status line and handoff item are refreshed every 30 s by updating their text in place, so the menu does not flicker. The tray icon follows crew state: the plain mark normally, a warn dot when any account is low or a handoff is suggested, a fail dot when any account is out; the tooltip shows the status line. Only one instance runs: launching it again focuses the existing window. Closing the window hides it to the tray; left-click on the tray icon toggles it. Regenerate icons (app and tray variants) with `pnpm --filter @shiftwell/desktop icons`.
