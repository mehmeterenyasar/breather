# Changelog

Follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
[Semantic Versioning](https://semver.org/).

## [1.1.0] — 2026-10-11

Renamed, and English is now the default language.

### Changed

- **New name: Breather**, from "take a breather". It reads as a short pause and
  as the breathing exercises at the same time. Storage names, the Firefox
  add-on id, the backup file name and every store listing were updated with it.
- **English by default.** Turkish is now one of six languages rather than the
  starting point.

### Added

- **Six languages:** English (default), German, Spanish, French, Brazilian
  Portuguese, Turkish. 344 keys each.
- **Language can be changed in settings.** `browser.i18n` takes the language
  from the browser and cannot be changed while the extension is running, so the
  translation layer was rewritten: the strings are TypeScript catalogs now.

  Type safety survived the move. Every catalog has to carry the shape of the
  English one, a missing key is a compile error, and the `{placeholders}` are
  checked at the type level — if a string has one, `t()` demands a second
  argument and checks the field names in it. Not one of the ~200 call sites had
  to change.

  Languages load lazily: only English goes into the popup bundle, and the chosen
  language arrives as a separate chunk. The manifest name and description, which
  the browser reads before any of our code runs, stay in `public/_locales`, with
  a test to stop the two drifting apart.

- **Side panel** (Chrome Side Panel, Firefox sidebar): the same component as the
  popup, in a column that stays open. Opened from an icon in the popup.
- **Weekly summary**, one sentence on Monday morning: last week's total and how
  it compares with the week before. Nothing is sent for an empty week, and it
  respects quick mute and working hours like every other reminder. Can be turned
  off under Goals.
- **Five more notification tones** (bell, glass, pebble, rise, pulse), ten in
  total.

### Fixed

- The manifest description had drifted from the English catalog. The new locale
  test caught it; the two are aligned.

## [1.0.0] — 2026-10-11

First release.

### The timer

- A pure reducer in `src/core/timer.ts`: start, pause, resume, reset, skip,
  finish, extend by five minutes, assign a tag. The state is nothing but
  timestamps, and the remaining time is worked out on every read — which is what
  makes it survive a suspended service worker.
- `reconcile()` brings the state back in line with the clock when the worker
  wakes, the browser starts or the machine comes back from sleep. A phase that
  ran out while nobody was watching is closed at the time it actually ended, and
  the auto-start chain is suppressed if we noticed more than 90 seconds late.
- Four modes: Pomodoro, stopwatch, countdown, Flowtime. The mode tabs lock while
  the timer runs, since switching would throw the session away, and the title
  explains why.
- Pomodoro: configurable durations (1–180 minutes), how often the long break
  comes, separate auto-start for focus and breaks, and the four cycle dots.
- Stopwatch: no limit, with an optional nudge every so many minutes. The nudge
  counts worked time, not wall-clock time, so pauses don't bring it forward.
- Countdown: presets at 5/10/15/30/45/60 minutes plus a custom length, and
  whatever was last used is remembered for next time.
- Flowtime: starts like the stopwatch and, when finished, suggests a break
  proportional to the time worked (a fifth by default, clamped to 3–30 minutes).
  The suggestion waits in storage, so a session that ended while the popup was
  shut still produces one.
- Sessions crossing midnight are divided between the days in proportion, and the
  23 and 25 hour days at the DST transitions are handled explicitly.

### Health breaks

- Four of them: eyes (every 20 minutes, for 20 seconds), breathing (every 60,
  for a minute), posture (every 45, for 30 seconds) and water (every 90). Each
  can be switched off and re-timed on its own, and all four share a single alarm,
  set for whichever is due first.
- The break screen is the extension's own window, opened with `windows.create`.
  Nothing is injected into any page, which is what lets the extension ship with
  no host permissions. Three presentations: a notification only, a small centred
  window (the default, which lands on the monitor in use), or full screen. Only
  one can be open; an existing one is raised rather than duplicated.
- Breathing guide with five patterns (box 4-4-4-4, 4-7-8, coherent 5.5-5.5, the
  physiological sigh, and a custom one). The circle is computed per frame; with
  `prefers-reduced-motion` it is replaced by the step name, the seconds left and
  a bar.
- Six stretches, never the same one twice in a row, with one parametric SVG
  figure highlighting the relevant part.
- Strict mode disables Skip for the first ten seconds, with a daily limit on
  snoozing. Once the limit is reached, a snooze becomes a full interval.
- Breaks due during a Pomodoro focus don't interrupt it. They are marked
  deferred and offered when the Pomodoro break starts.
- A reminder that is gated — muted, outside working hours, or during a meeting —
  does not consume the break. Its due time stays put and we look again in a few
  minutes, so the break arrives the moment the user is available rather than
  being silently skipped.

### Do not disturb

- Quick mute for 30 minutes, an hour, two hours or the rest of the day. The time
  left shows in the popup and it expires on its own.
- Working hours, switchable per day, including shifts that run past midnight.
- Idle detection: when the user walks away or the screen locks, a counting-up
  timer pauses and the break counters reset, since leaving the desk is a break
  whatever we were about to suggest. On return the popup offers to hand the time
  back.
- Meeting detection silences reminders while a Meet, Zoom or Teams tab is active.
  The `tabs` permission is not in the manifest; it is requested at runtime, and
  only if the feature is switched on.

### History and statistics

- A materialised daily rollup, recomputed for the affected day whenever a session
  is added, edited or deleted. The statistics page reads a few rows per day
  instead of scanning thousands of sessions, and since the table is entirely
  derived it can be rebuilt from the sessions with one call.
- Range picker (today, this week, this month, last 30 days, this year, custom), a
  tag filter, six summary figures, a daily stacked bar chart with the goal line,
  a year heatmap, a day-by-hour heatmap, the per-tag breakdown, break compliance
  and the session list.
- The session list is paged, newest first, and supports deleting a row and adding
  a session by hand for work you forgot to time.
- The charts are hand-written SVG. No charting library: the shapes needed are
  simple, and the colours come from the theme tokens, so light and dark need no
  extra work.
- Streaks: a weekend that is excluded neither breaks nor extends one, and a today
  that hasn't reached the goal yet doesn't break it either, the day not being
  over.
- Time is distributed across hours as well as days, in proportion, and the parts
  always add back up to the net duration exactly.

### Data

- Export as a full JSON backup or as CSV of the sessions (UTF-8 with a BOM, CRLF,
  RFC 4180 escaping, so a spreadsheet opens it without mangling anything).
- Import validates the file and shows a preview first; not one row is written
  before the user has seen what it is about to do. Merge or replace.
- Delete everything, behind a confirmation, keeping the settings.
- A fake data generator for development: two years, 5,000 sessions. It is
  stripped from a production build.

### Settings

- Nine sections: Statistics, Timer, Breaks, Do not disturb, Goals, Appearance,
  Sound, Data, About. Common settings at the top of each, the rest behind
  "Advanced".
- No save button. Every change is written as it is made, with a brief "Saved" in
  the header.
- Tags can be renamed, archived or deleted. Archiving is the prominent action:
  an archived tag keeps its history and simply stops being offered in the popup,
  whereas deleting one leaves its past sessions untagged.
- A working-hours editor, the custom breathing pattern, the accent colour picker,
  a sound preview, and a link to the browser's own keyboard shortcut page.
- A welcome flow on first install: three short steps, all skippable.

### Design and accessibility

- Light and dark from CSS variables, six accent colours, separate tones for focus
  and breaks, `prefers-reduced-motion` honoured throughout.
- Plus Jakarta Sans is bundled (SIL OFL), latin and latin-ext, loaded from the
  extension itself so no request ever leaves the machine.
- The icons are generated by `scripts/gen-icons.mjs`, with no dependencies and no
  binary in the repository.
- The mode tabs are a `radiogroup` rather than a `tablist`: with no tabpanel on
  screen, the `tab` role was misleading.
- Every control has a visible label bound through `label`/`id`, hints are read out
  to screen readers, and the toggles are `role="switch"` with `aria-checked`.
  Full keyboard use, with a focus ring you can see.

### Sound

- Ten tones synthesised with Web Audio; no audio files are shipped. On Chromium
  the tone plays in a throwaway offscreen document that closes as soon as it has
  finished; Firefox still has a background page with a DOM and plays it there.
- The break end plays lower than the focus end, so the two are distinguishable
  without looking.

### Build and packaging

- WXT 0.21, Preact 10, TypeScript 5.9 strict, Vitest, ESLint 9 flat config,
  Prettier. One codebase, MV3 for Chrome, Edge and Firefox.
- Settings live in `storage.sync`, falling back to `local` for good on a quota
  error. Timer state is `local`, deliberately, and today's totals sit in a small
  separate cache so the popup never opens IndexedDB.
- The Firefox bundle has the offscreen page and all the Chromium-specific audio
  code removed at build time (`wxt.exclude` plus a build flag), so it carries no
  `offscreen` permission, no `offscreen.html` and no `runtime.getContexts` call.
- `npm run zip` produces the three browser packages and the source archive AMO
  asks for.
- Store listings, per-permission justifications, the screenshot plan and a
  pre-submission checklist live in `store/`. The privacy policy is `PRIVACY.md`.

### Fixed along the way

- `--tone` was defined only on containers carrying `data-phase`, an attribute
  that exists solely in the popup and the break window. Every filled button on
  the settings, statistics and welcome screens was therefore rendering
  transparent, and every switched-on toggle white. An undefined CSS variable is
  not an error — the declaration is simply dropped — so nothing reported it. The
  tones now have root defaults that the phase surfaces merely override, and a
  test asserts the contract. `--tone-hover` and `--tone-fg` were added at the
  same time, so hovering during a break no longer jumps to the focus colour.
- A failing sound or notification used to take the whole timer transition with
  it. Those steps are isolated now: the state and the session row are written
  regardless.
- `runtime.getContexts` throwing, or not existing, broke the service worker's
  startup.
- Chrome refused the `tabs` permission request because something was awaited
  before it, which spends the user gesture. It is requested directly now.
- Opening the break window broke the health alarm chain, so a window that failed
  to appear stranded every later break.
- Changing a break's interval in settings didn't re-arm its counter.
- The break window crashed in an environment without `window.matchMedia`, found
  by the jsdom tests. A missing motion preference now reads as "no preference":
  an animation playing is a better outcome than a break never appearing.
- `pomodoroIndex` was wiped when the machine went idle, which reset the cycle
  dots mid-session. Found by the first integration test that was written.

### Tests

- 295 unit, integration and smoke tests. State transitions and pause arithmetic;
  the browser-closed and machine-asleep scenarios; day splitting across midnight
  and DST; settings migration and recovery from a corrupt record; the alarm,
  database and badge wiring against a fake browser; the rollup against a real
  IndexedDB with 5,000 sessions in it; and all three screens rendered in jsdom.
- Three of those suites exist because of a bug rather than in anticipation of
  one: the CSS token contract, the jsdom smoke tests and the locale audit each
  came out of something that shipped broken.
- [TEST.md](TEST.md) covers the manual side, from installing Node to loading the
  extension, with 41 scenarios and a troubleshooting section.
