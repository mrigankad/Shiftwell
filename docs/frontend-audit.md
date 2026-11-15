# Shiftwell web: frontend audit (Phase 1, audit only)

Date: 15 Nov 2026. Scope: `apps/web/src` (4.7k lines), the running daemon on :4520, and Paper file 01M7ER3CDTD9PG7ZVSX9YCC6F3, page "03 · Product UI".
Screenshots: `docs/audit-shots/<route>-<width>-<day|night>.png` (13 routes at 1440 day, 390 day, 1440 night; board, accounts, usage, rules at 768 day, 1280 night, 390 night).
Capture note: `--virtual-time-budget` hangs forever because the SSE stream keeps the network busy. Use `--timeout=3500` with a fresh `--user-data-dir` per shot. Some shots were caught mid-reconnect: they show "Service offline" and 0 accounts (for example `usage-1440-day.png`, `safety-1440-night.png`). That is a finding in itself (P1-9).
Note: `pnpm build` was run once to read bundle sizes, which rewrote `apps/web/dist`.

## Hard-rule check

| Rule | Result |
|---|---|
| No native select, alert, confirm, date or time inputs | Pass. No matches for `<select`, `type="date"`/`"time"`, `alert(` or `confirm(` |
| No monospace | Pass in source. Check `renderCard.ts` canvas fonts when the recap card is redesigned |
| No em or en dashes in UI copy | Pass. No U+2013 or U+2014 in `src` |
| No left accent borders | Pass. No `border-l-*` or `borderLeft` |
| Theme tokens only | Fail. Stray hex in `crew.tsx:37` (`#fff`) and `features/recap/renderCard.ts:6,66` (a full private palette). Intentional welcome card in `pages/BoardPage.tsx:92-97` is allowed, but it repeats `#14161E`/`#FF8A5B`/`#C9CCD6`, which should become named tokens (`--color-welcome-*`) so the two copies cannot drift |

## P0: broken or clearly off-brand

1. **Board, 390: horizontal overflow.** The handoff card text and the account cards' state pill and Weekly bar are cut off at the right edge. Evidence: `board-390-day.png`. Fix: on the account card grid add `min-w-0` to the flex children, make the 5-hour/Weekly pair `grid-cols-1 sm:grid-cols-2`, and let the suggestion copy wrap with `[overflow-wrap:anywhere]`. (Check this against the responsive agents' work before you fix it.)
2. **Stale usage shown as live.** Board rows read "Last seen 309 min ago" and "Resets in 0m" with a green "Room" pill. That tells the user they have room when the data is five hours old. Evidence: `board-1440-night.png`, `pages/BoardPage.tsx:23`. Fix: when `usage.stale` is set, show a muted "Stale" state, dim the bars to 40% and print "Reset time unknown". Format the age with the shared `ago()` (`pages/shared.tsx:25`) so it reads "5h ago", not "309 min ago". `ProjectMemoryPage.tsx:8` has a third copy of the formatter.
3. **Crew avatars missing on board, usage and runs rows.** There is an empty 32 px slot where the pixel art should be (`board-1440-night.png`, `usage-1440-day.png`). The Paper board (68-0) leads every row with an avatar. Fix: check that the `CrewAvatar` image import resolves in `dist` and add a provider-initial fallback so a slot is never blank.
4. **Offline flips the whole app to an empty state.** During an SSE reconnect, Usage and Guardrails show "0 accounts" and "No accounts yet", and "Start a run" turns grey. Evidence: `usage-1440-day.png`, `safety-1440-night.png`, `api.ts:80-84`. Fix: keep the last good board in state and only mark it stale while offline. Show `OfflineBanner` above the content instead of replacing the data. Never pass `accounts=[]` to the feature pages while `board` is null; render a skeleton instead.

## P1: consistency, fidelity, a11y, code health

### Visual drift (several authors)
5. **Page header has 5 variants.** `PageTitle` (shared.tsx:74) is used by 7 pages. The other 7 hand-roll their `<h1>` with sizes of 24/30, 26/30, 28/32, 26/32 and 32/44 px and different leading: `ProjectMemoryPage.tsx:195`, `SkillLibraryPage.tsx:110`, `ResetCalendarPage.tsx:82`, `WorkerDetailPage.tsx:161`, `BoardPage.tsx:69`, `ComparePage.tsx:23`, `WeeklyRecapPage.tsx:80`. The gap from eyebrow to title also varies (`skills-1440-day.png` vs `usage-1440-day.png`). Fix: a single `PageHeader {eyebrow, title, actions}` at 26 px mobile / 32 px desktop, tracking -0.03em, leading 1.1, with the eyebrow in 14 px text-body. The Recap hero can use a `size="display"` prop.
6. **Page padding is applied twice and inconsistently.** `App.tsx:210-213` wraps usage, recap, rules and safety in `px-7 py-6`, while the other pages pad themselves. Fix: the shell owns the padding (`px-4 sm:px-7 py-6`, max-w 1440) and pages never pad their root.
7. **Type scale sprawl.** There are 19 arbitrary sizes (`text-[11px]` through `[44px]`). 13 px is used 100 times and 15 px 33 times, with one-offs at 12, 14, 16, 19, 20, 21, 24 and 34. Fix: add `--text-caption:12px; --text-meta:13px; --text-body:15px; --text-title:17px; --text-h3:22px; --text-h1:32px; --text-display:44px` to `@theme` and replace the arbitrary values.
8. **Radius sprawl.** There are 10 radii (`rounded-md/lg/xl/2xl`, `[4px]`, `[5px]`, `[9px]`, `[10px]`, `[14px]`, `[28px]`). Fix: tokens `--radius-control:8px` (buttons, inputs), `--radius-card:16px` (the Paper cards measure about 16) and `--radius-pill:999px`, then remove the arbitrary values. Today the cards mix `rounded-xl` (12) and `rounded-2xl` (16).
9. **Two switch colours.** The guardrails Switch is `bg-pass` green when on (`features/guardrails/controls.tsx:7`). The skills Switch is orange (`SkillLibraryPage.tsx:14`, `skills-1440-day.png`). Fix: one `Switch` in `components/ui`, on = `bg-action`, used by both pages and by the rules pages.
10. **Buttons are copy-pasted class strings.** Secondary buttons are repeated inline (`shared.tsx:119-122`, `iconBtn` in `ProjectMemoryPage.tsx:87`, `icon` in `OrderedPicker.tsx:4`, `arrow` in `RoutingRulesPage.tsx:10`, `btn` in `controls.tsx:24`). Heights vary between 36 and 40 px and focus styles differ. Fix: `Button` with variants `primary` (cta), `accent` (action), `secondary` (line), `ghost` and `icon`, sizes `sm` (36) and `md` (40), and a single focus ring.
11. **Empty and loading states are inconsistent.** There are two `EmptyState` components (`pages/shared.tsx:85` with no art and `components/states/index.tsx:4` with icon and eyebrow, used nowhere except `OfflineBanner`). A `Skeleton` exists (`states/index.tsx:54`) but nothing uses it. Each page has its own loading text, with punctuation varying between "Loading history...", "Loading notes." and "Loading the week". Fix: keep `components/states`, delete the shared.tsx copy, and add the pixel-art spot from Paper 3NM-0 (crew waiting, crew asleep, CLI missing) as an `art` prop. Use `Skeleton` everywhere.
12. **Sidebar has no icons or counts, unlike Paper 68-0.** The design has line icons on every item and counts in action orange ("Needs you 2", "Handoffs 1"). The build has text only and grey counts. Its Search placeholder reads "Search or jump to" against "Search" in the design. Fix: add a 16 px icon slot (fixed width) and an action-coloured count when non-zero.

### Fidelity gaps against Paper
13. **Board (68-0):** the design's "Resets coming up" side rail and the three insight tiles at the foot ("runs out in 38 min", "back in 34 min", "limits updated") are missing. The table's "Working on" column became "Status" and shows login and staleness text instead of the task. Fix: restore the rail and the tiles, which are cheap because the data is already in the board.
14. **Usage (1B6-0):** the design has a stacked bar chart of agent hours by provider and a "Value per plan" list with a suggestion callout. The build has a per-account mini heatmap plus cost steppers, which pushes the chart below the fold. Fix: put the provider chart and Value per plan above the fold and move cost entry into a "Plan costs" dialog or a collapsed section. The header actions "This week" and "Export CSV" are also missing.
15. **Header bar:** the design has a bell and a single "New task" CTA. The build has "Add account" plus "Start a run". Decide which copy is canonical and align either the Paper file or the build.

### Accessibility
16. **Focus rings are opt-in.** Only about 12 elements set `focus-visible` styles. `RunRow` buttons, the `Segmented` and `ThemeSwitch` radios, `CheckBox`, the nav links and the Modal close have none. Fix: add a global `:focus-visible { outline:2px solid var(--color-action); outline-offset:2px }` in `index.css`, then remove the per-component variants.
17. **The ThemeSwitch radiogroup has no arrow-key handling or roving tabindex** (`theme.tsx:33-42`). `Segmented` in `ui.tsx` already does this, so reuse it.
18. **The Hand off menu (`shared.tsx:125`) has `role="menu"` without menu semantics.** There is no focus move into the menu, no arrow keys, no click-outside close, and focus is not returned to the trigger. Fix: a shared `Menu`/`Popover` primitive, or drop the role and treat it as a disclosure.
19. **Modal (`ui.tsx:49`) has no focus trap and does not restore focus on close.** The page behind is still scrollable. Fix: trap Tab, return focus to the opener, and set `overflow:hidden` on the body.
20. **Contrast:** `text-muted` is #7A7F8C on white, about 4.0:1, and fails AA for the 11 to 13 px meta text it is used for. Night `--color-muted` #7C8292 on card #191C25 is about 4.3:1. Fix: day muted to #6B7080, night muted to #8A90A0. The night `on-action` #12141B on #FF7A3D passes. The disabled "Start a run" (grey on grey) is unreadable in night mode (`safety-1440-night.png`).
21. **Reduced motion:** only smooth scroll is guarded (`index.css`). Transitions on the switches and the toast are not. Fix: add a global `@media (prefers-reduced-motion: reduce){*{transition-duration:0ms!important;animation-duration:0ms!important}}`.
22. **Toast** (`App.tsx:255`): it uses `role="status"`, but errors should use `role="alert"`. It is a single string with no variant, sits under the mobile bottom area and has no dismiss button. See item 24.

### Interaction quality
23. **No optimistic updates.** Hand off, Done, skill toggles and rule toggles wait for the server, then for the next SSE tick (up to 5 s) before the UI changes. Fix: update local state at once and roll back with an error toast on failure.
24. **Toasts:** there are three separate toast implementations (`App.tsx`, `ProjectMemoryPage`, `SkillLibraryPage`). Fix: one `ToastProvider` with `success`, `error` and `info` variants, stacking, a 4 s timeout and pause on hover.
25. **Relative times freeze.** `ago()` is computed at render and only refreshes when SSE pushes. Insights has its own 60 s tick (`InsightsPage.tsx:24`) and the worker page has `useNow`. Fix: one `useNow(30_000)` in the shell, passed through context.
26. **Usage polls every 60 s** (`UsageCostPage.tsx:101`) on top of SSE. Fine, but pause it when `document.hidden`.

### Code quality and consolidation
27. **Duplicates:**
    - `UsageChart`: `features/worker/UsageChart.tsx` and `pages/AccountsPage.tsx:9`.
    - `EmptyState`: two copies (item 11).
    - `Switch`: `guardrails/controls.tsx:4` and `SkillLibraryPage.tsx:14`.
    - `Stepper`: `controls.tsx:14` and `usage/NumberField.tsx`.
    - Listbox-like pickers: `components/Listbox.tsx` and `rules/OrderedPicker.tsx`.
    - Checkbox and radio controls are split across `ui.tsx` and `theme.tsx`.
    - Time formatters: three copies.
28. **API clients:** `api.ts` plus 5 feature clients (`guardrails`, `memory`, `rules` and `skills` `api.ts`, `usage/client.ts`) each redefine `json()` and a `req()` helper, with slightly different header handling. Fix: `src/lib/http.ts` exporting `get`, `post`, `put` and `del` with one error shape, then have the feature `api.ts` files import from it. Keep the feature-local endpoint lists.
29. **Dead code:** `Skeleton`, and `EmptyState` in `components/states`, are unused. Grep for other unused exports with `ts-prune` before Phase 2.

## P2: performance and delight

30. **Bundle:** a single JS chunk of 330 kB (94 kB gzip) and 42 kB of CSS. That is fine for a local app, but every page is eager. Fix: `React.lazy` for Recap (canvas renderer), Insights (heatmap), Memory and Skills, which saves about 30 to 40% of first load. Three Jakarta woff2 subsets load (vietnamese, latin-ext, latin). Import only the `latin` subset (saves 30 kB).
31. **SSE re-renders:** every 5 s `setBoard` replaces the whole tree. `ctx` is a new object each time and the `nameOf` and `providerOf` closures change, so every page and row re-renders. Fix: compare the incoming payload's `generatedAt` and a hash and skip identical boards. Memoise `ctx` with `useMemo`, wrap `RunRow` and the account rows in `React.memo` keyed on id plus fields, and build maps for `nameOf` instead of `.find` per call.
32. **Delight, in the night-pixel style:**
    - The live-floor pill dot pulses only while SSE is connected, using an opacity pulse that respects reduced motion.
    - When a handoff completes, the outgoing avatar swaps to its sleeping pixel pose for a moment.
    - The Paper empty-state art (3NM-0) goes into every EmptyState.
    - Usage bars ease in width on update (150 ms).
    - Numbers use `tabular-nums` everywhere (some stat tiles do not).
    - The Ctrl K hint uses the platform glyph.
    - A soft 1 px `action-line` glow on the card of the account that is "on shift" in night mode only.

## Shared primitives to extract (`src/components/ui/`)

`PageHeader`, `Card` (with `CardHeader` and padding sizes), `Button` (5 variants, 2 sizes), `IconButton`, `StatTile` (label, value, delta with a tone), `DataTable` (head row, row, responsive stack at sm), `Pill` (state tones from `STATE_PILL`/`RUN_PILL`), `Switch`, `Stepper`, `Listbox`, `Segmented`, `CheckBox`, `Menu`, `Modal`, `Toast`, `EmptyState` (with an `art` prop), `Skeleton`, `ProgressBar` (the current `Bar`), `UsageChart`, plus `lib/http.ts`, `lib/time.ts` (`ago`, `resetIn`, `useNow`) and type/radius tokens in `index.css`.

## Implementation plan

### Phase A: primitives (no page rewrites yet)
| Item | Size |
|---|---|
| Type, radius and muted-contrast tokens; global focus-visible and reduced-motion rules | S |
| `lib/http.ts` and migrating the 6 clients | M |
| `lib/time.ts` and shell `useNow` | S |
| Button, IconButton, Pill, ProgressBar | S |
| Card, PageHeader, StatTile | S |
| Switch, Stepper, Listbox, Segmented, CheckBox merged into `components/ui` | M |
| Modal with focus trap; Menu primitive | M |
| ToastProvider (variants, alert role) | S |
| EmptyState with pixel art and Skeleton | M |
| DataTable with mobile stack | M |
| Welcome-card hex values to tokens; `renderCard.ts` reads CSS variables | S |

### Phase B: page fixes
| Item | Size |
|---|---|
| Shell owns padding; offline keeps the last board (P0-4) | S |
| Board: overflow at 390, stale state, avatars, Resets rail and insight tiles | L |
| Usage: chart and Value per plan above the fold, plan costs dialog, header actions | L |
| All pages switched to PageHeader, Card and Button (removes the drift in items 5 to 10) | M |
| Sidebar icons and action counts | S |
| Optimistic hand off, done and toggles | M |
| Delete the duplicates and dead code (items 27 and 29) | S |
| SSE de-dupe, memoised ctx and rows | M |
| Route-level lazy loading, latin-only font | S |
| Delight pass (item 32) | M |
