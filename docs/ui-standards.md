# Shiftwell UI standards

A short checklist for the web app (`apps/web`). Each item says what to do and why, with the source it comes from.
Tokens live in `src/index.css`, shared primitives in `src/components/ui`.

## Checklist

### Accessibility (WCAG 2.2 AA)

- [ ] **Target size, 2.5.8 (AA).** Pointer targets are at least 24 by 24 CSS px, or have 24 px of clear space around them. Our floor is 28 px for icon buttons inside dense rows and 32 to 40 px for everything else. Never ship a bare "x" glyph as a button.
- [ ] **Focus visible and focus appearance, 2.4.7 and 2.4.13.** One ring for everything: 2 px solid `--color-action`, 2 px offset (`:focus-visible` in `index.css`). The ring must be at least 3:1 against both the surface and the unfocused control. Never `outline: none` without a replacement.
- [ ] **Non-text contrast, 1.4.11 (AA).** Borders that define a control, icons that carry meaning, focus rings and chart marks reach 3:1 against their background. Decorative hairlines (`--color-line`, `--color-row`) are exempt.
- [ ] **Text contrast, 1.4.3 (AA).** Body text 4.5:1, large text (18.66 px bold or 24 px) 3:1. Check muted text in both day and night.
- [ ] **Content on hover or focus, 1.4.13.** Tooltips are dismissable (Esc), hoverable and persistent until dismissed. They also appear on keyboard focus. The control keeps its own `aria-label`.
- [ ] **Reduced motion.** Transitions are 150 to 200 ms and drop to 0 under `prefers-reduced-motion` (global rule in `index.css`).
- [ ] **One h1 per page**, headings in order, landmarks (`nav`, `main`) labelled.

### Navigation (Apple HIG, Material 3)

- [ ] **The sidebar is persistent and shows every top level destination at once.** Material: rail destinations stay fixed while content scrolls. Apple: a sidebar is for top level navigation, grouped, with short labels and icons that match the item.
- [ ] **All destinations fit at normal heights (720 to 900 px) without scrolling.** The nav only scrolls when the window is genuinely too short.
- [ ] **Group, do not bury.** Four short labelled groups beat one long list. Group labels are small and quiet. Counts sit on the right.
- [ ] **Selected state is obvious without colour alone.** Weight plus a filled surface plus `aria-current="page"`.
- [ ] **Footer utilities (theme, status) share one row** so they never push the destinations out of view.

### Scroll behaviour

- [ ] **Scrollbars are thin and overlay style.** The thumb is invisible at rest and appears on hover, focus or scroll. Standard `scrollbar-width: thin` and `scrollbar-color`; no `::-webkit-scrollbar` rules, so the track width is constant and showing the thumb never shifts layout.
- [ ] **`scrollbar-gutter: stable` on the main content scroller**, so short and long pages align and nothing jumps when a page grows past the viewport. It has no effect for true overlay scrollbars, and costs nothing there.
- [ ] **Never hide scrolling completely** (`scrollbar-width: none`) where the content is the only way to reach controls.
- [ ] **One scroll area per axis.** No nested scrollers inside the main scroller unless it is a bounded list (palette, menus).
- [ ] **A sticky header gets a shadow only once content scrolls under it.**
- [ ] **Brand orange** is kept for the main content scrollbar: faint at rest, strong on hover or scroll. Inner scrollers use a neutral tone.

### Usability heuristics (Nielsen Norman)

- [ ] **Visibility of system status.** Skeletons while loading, an offline banner, and toasts after actions.
- [ ] **Recognition over recall.** Command palette with shortcut hints, a "?" shortcuts dialog, visible labels instead of icon-only controls where space allows.
- [ ] **Consistency and standards.** One pattern for page identity: the page's own h1 is the title. The top bar only shows the page name once the h1 has scrolled away (condensed title), so the name is never on screen twice.
- [ ] **Help users recover.** Every empty list says what to do next. Errors say what happened and offer a retry.
- [ ] **Flexibility and efficiency.** Keyboard shortcuts for frequent actions, none that fire while typing.
- [ ] **Aesthetic and minimalist design.** One row for footer utilities, no duplicated labels, no decorative scroll furniture.

### Hover, press, motion

- [ ] Every pressable has a hover colour change and a pressed state (`scale(0.98)` for buttons, a darker fill for icon buttons), 120 to 160 ms.
- [ ] Skeletons use the shared `sw-shimmer` sweep, not a pulse.
- [ ] Icon-only buttons use `IconButton` (or wrap their control in `Tooltip`).

## Sources

- WCAG 2.2, what is new: <https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/>
- Understanding 2.5.8 Target Size (Minimum): <https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html>
- Understanding 2.4.13 Focus Appearance: <https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html>
- Understanding 1.4.11 Non-text Contrast: <https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html>
- Understanding 1.4.13 Content on Hover or Focus: <https://www.w3.org/WAI/WCAG22/Understanding/content-on-hover-or-focus.html>
- WCAG 2.2 explainers used to cross check: <https://tetralogical.com/blog/2023/10/05/whats-new-wcag-2.2>, <https://dequeuniversity.com/resources/wcag-2.2>
- Apple Human Interface Guidelines, Sidebars: <https://developer.apple.com/design/human-interface-guidelines/sidebars>
- Material Design, Navigation rail: <https://m2.material.io/components/navigation-rail> and Material 3 Expressive navigation: <https://9to5google.com/2025/05/14/material-3-expressive-navigation/>
- Nielsen Norman Group, 10 usability heuristics: <https://www.nngroup.com/articles/ten-usability-heuristics/>
- MDN `scrollbar-width`: <https://developer.mozilla.org/en-US/docs/Web/CSS/scrollbar-width>
- MDN `scrollbar-gutter`: <https://developer.mozilla.org/en-US/docs/Web/CSS/scrollbar-gutter>
- web.dev, scrollbar-gutter and scrollbar-width are Baseline: <https://web.dev/blog/baseline-scrollbar-props>

Note: search results were secondary sources for some items (the Apple page text on scrolling was thin, so the sidebar items above follow the HIG's general grouping guidance). The W3C pages above hold the normative wording.

## Findings and fixes (polish pass, 15 Nov 2026)

Audited all 12 pages at 1440x900, 1280x720, 1024x768 and 390x844 in day and night, with a DOM check per page for h1 count, targets under 24 px, nested scrollers, horizontal overflow and nav scrolling. Screenshots: `docs/polish-shots/before` and `docs/polish-shots/after`.

| Finding | Fix |
| --- | --- |
| Sidebar scrolled at 720 px, with a loud orange scrollbar (owner complaint) | Tighter rhythm (32 px rows, smaller group gaps, 36 px search) and a one row footer that merges safe mode status and a compact Auto/Day/Night icon switch. All 12 destinations fit at 720 px with no scrollbar. Below about 600 px the nav scrolls, with an invisible overlay style thumb |
| Scrollbars were always visible and orange everywhere | Standard `scrollbar-width: thin` and `scrollbar-color`: thumb transparent at rest, neutral on hover, focus or scroll for inner areas, faint orange at rest and strong orange on hover or scroll for the main content. No `::-webkit-scrollbar` rules, so width is constant and nothing shifts. Main uses `scrollbar-gutter: stable` |
| Page name shown twice (top bar and h1) | The h1 is the page title. The top bar shows the page name only after the h1 scrolls away (condensed title). Every page has exactly one h1 |
| Sticky header had no scroll affordance | Shadow and blur only once content is scrolled under it; solid at the top. A new page resets scroll to the top |
| Board accounts table crushed the status column to one character per line at 1280 px | Table layout switches at 1400 px viewport instead of 1280, because the sidebar and right rail eat width |
| Targets under 24 px: board remove "x" glyph buttons, insights sort headers (19 px), checkboxes (20 px), run title links (23 px), toast dismiss and others | Remove buttons are now `IconButton` (36 px), sort headers 28 px, checkboxes 24 px, run links 24 px |
| Long task titles cut to one line on phones | Two lines on narrow screens, one from `md` up |
| Eyebrow "Safety" did not match the nav label "Guardrails" | Eyebrow now says Guardrails |
| Handoffs: right panel was an empty box until a row was picked | Newest handoff is selected by default |
| Icon-only buttons relied on `title` or nothing | New `Tooltip` primitive (hover after 450 ms, instant on keyboard focus, Esc dismisses, aria-hidden since controls keep their `aria-label`). `IconButton` wraps itself in it; the memory, routing rules, guardrails, number stepper, ordered picker, toast and theme controls use it |
| Pulse placeholder looked cheap | Shared `sw-shimmer` sweep for skeletons (static under reduced motion) |
| Inconsistent hover and press | Global 160 ms colour transitions and a 0.98 press scale on buttons; icon buttons darken on press; all transitions drop to 0 with reduced motion |
| Palette had no shortcut hints, no "?" | Palette rows show shortcut keys; `?` opens a shortcuts dialog; G then B/R/H/A/I navigates, N starts a run, Shift A adds an account. Shortcuts are ignored while typing or when a dialog is open |

### Checked and fine

- No horizontal overflow on any page at any size. The only nested scroller is the insights heatmap on phones, which scrolls sideways on purpose.
- Focus ring (2 px action colour, 2 px offset) is visible on both themes. Muted text tokens meet 4.5:1 on their surfaces in the checked screenshots.

### Left to do

- Contrast was judged from screenshots and token values, not measured with a tool. Run an axe or Lighthouse pass before release.
- The "85% limit" label on the account usage chart overlaps the line end at some widths (`features/worker/UsageChart.tsx`).
- "Loading the note" on Handoffs is plain text, not a skeleton.
- The condensed top bar title relies on the first h1 in `main`; pages with a custom hero h1 (recap, live view) show the title in the bar slightly later.
- Tooltips on disabled buttons appear on the wrapper only when the pointer enters it, which is the intended behaviour but worth a real device check.
- Other agents' character editor files were not touched or audited.
