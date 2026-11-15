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

## Live view

Shiftwell does not capture the terminals it opens. It reads the transcripts the official CLIs already write: Claude Code's `projects/<cwd-slug>/*.jsonl` under the profile's `CLAUDE_CONFIG_DIR`, Codex's `sessions/**/rollout-*.jsonl` (and the zstd-compressed `.jsonl.zst` ones, decoded in pure JS) under `CODEX_HOME`, and Gemini's chats under the profile's `.gemini/tmp`. It matches the file whose working directory is the run's worktree, skips thinking and reasoning, and never opens auth files. `GET /api/runs/:id/live` and the SSE stream at `/live/stream` serve it.

## Workspace

- **Routing rules** (`rules.json`): ordered keyword rules that prefer certain accounts for certain tasks or repos; `POST /api/rules/pick` explains the choice.
- **Guardrails** (`guardrails.json`): max parallel runs, a stop line (never start or keep a run on an account at or above it), blocked paths written into every `HANDOFF.md`, quiet hours for notifications, and opt-in auto-rotation.
- **Auto-rotation** (off by default): once a minute, an active run on an account at its stop line or out is handed to the account with the most room (same provider first), at most once per 30 minutes per run. `SHIFTWELL_NO_ROTATE=1` disables it.
- **Skill library** (`skills/*.md`): shared instructions synced into each account's own `CLAUDE.md`, `AGENTS.md` or `GEMINI.md` between `shiftwell:skills` markers, so every CLI follows the same house rules.
- **Project memory** (`memory/<repo hash>.json`): per-repo notes, pinned first, added to `HANDOFF.md`; every handoff leaves a one-line note.

## Status

- [x] Profiles with isolated config folders, sign in through the vendor's own login
- [x] Usage: Claude status hook, Codex app-server, Gemini telemetry counter; state, burn-rate forecast, insights heatmap
- [x] Runs in git worktrees, parallel fan-out with compare view, handoffs with `HANDOFF.md`, finish with worktree cleanup
- [x] API-key accounts (Kimi, Grok, DeepSeek, NIM, Ollama Cloud) through Codex, with the Responses-to-Chat translator
- [x] Routing rules, guardrails, auto-rotation, skill library, project memory
- [x] Live view from CLI transcripts
- [x] Web UI: board with the live pixel shift floor, accounts and worker detail, reset calendar, insights, usage and cost, weekly recap, Ctrl K palette, onboarding, day and night themes, responsive down to phones
- [x] `shiftwell` CLI, desktop notifications, Tauri desktop app with tray status and installer
- [ ] First end-to-end run with real signed-in accounts (needs the owner)
- [ ] Shim and Gemini transcript parsing tested against live providers

## Desktop app

`apps/desktop` is a Tauri 2 shell with no frontend of its own: its window loads `http://127.0.0.1:<port>` (`SHIFTWELL_PORT`, default 4520) from the daemon. It needs Rust (stable, MSVC on Windows) and a built daemon (`pnpm -r build`).

```bash
pnpm desktop                                  # tauri dev
pnpm --filter @shiftwell/desktop build        # installer in apps/desktop/src-tauri/target/release/bundle
```

On launch it checks `/api/health`; if no daemon answers it runs `node <repo>/apps/daemon/dist/server.js` (no console window), waits up to 10 s, then shows the window. It stops the daemon on quit only if it started it. The repo is found in this order: `SHIFTWELL_REPO`; the path remembered in `repo.txt` in the app config dir (`%APPDATA%\\dev.shiftwell.desktop` on Windows); the nearest parent folder of the executable that contains `apps/daemon/dist/server.js`; the repo root baked in at build time (`SHIFTWELL_REPO_DEFAULT`, set by `pnpm --filter @shiftwell/desktop build`). Whatever works is saved to `repo.txt`, so an installed copy (for example in Program Files) keeps working. If nothing is found the error page offers a "Choose folder" button to pick the repository; the choice is validated, saved and the app carries on starting. If `node` is not on PATH the error page says so and links to nodejs.org.

The tray menu has Open Shiftwell, Open dashboard in browser, a status line, a handoff suggestion (opens `#/board`; disabled and reading "No handoff suggested" when there is none), a "Start with Windows" check item ("Open at login" on macOS; off by default, state kept by the autostart plugin) and Quit. The status line and handoff item are refreshed every 30 s by updating their text in place, so the menu does not flicker. The tray icon follows crew state: the plain mark normally, a warn dot when any account is low or a handoff is suggested, a fail dot when any account is out; the tooltip shows the status line. Only one instance runs: launching it again focuses the existing window. Closing the window hides it to the tray; left-click on the tray icon toggles it. Regenerate icons (app and tray variants) with `pnpm --filter @shiftwell/desktop icons`.
