# Breather — testing guide

This guide starts from nothing and assumes nothing. Two parts:

- **A — Automated tests:** one command, about 15 seconds. Covers the logic.
- **B — Manual testing:** in the browser, about 20 minutes. Covers what the
  automated suite cannot: that the extension actually loads and runs.

---

# A — Automated tests

## A1. Node version

```bash
node --version
```

- **v22.12 or newer** and you are ready; skip to A2.
- **v20.x** works, but `npm install` will print yellow `EBADENGINE` warnings.
  They are warnings, not errors, and safe to ignore. For a clean run, install
  Node 24 LTS from <https://nodejs.org> (the "LTS" button), then close and
  reopen the terminal.

## A2. Install the dependencies

In the project folder:

```bash
npm install
```

One to two minutes the first time. It should end with `added N packages`. Yellow
`warn` lines are fine; a red `ERR!` means something is wrong — see
Troubleshooting at the end.

## A3. Run everything

```bash
npm run check
```

That one command does three things in order: type check, lint, tests. The last
lines should be:

```
 Test Files  21 passed (21)
      Tests  295 passed (295)
```

If anything is red, the file name and line number in the output say where.

> **Do not chain commands.** In PowerShell a line like
> `npm install && npm run check` is a parser error. Run each command on its own.
> To run the tests and produce a build in one go, there is `npm run verify`.

### What the 295 tests cover

| Area             | Example                                                                                                                                        |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Timer logic      | Is the remaining time right after a pause and resume; is a session recorded with its real end time after the browser was closed for 10 minutes |
| Days and hours   | Is a session over midnight divided between both days; the 23 and 25 hour days at the DST transitions                                           |
| Break scheduling | Deferring during focus, merging into the Pomodoro break, the daily snooze limit                                                                |
| Do not disturb   | Quick mute, working hours including night shifts, meeting domain matching                                                                      |
| Database         | Correctness of the rollup table, query speed with 5,000 sessions, backup and restore                                                           |
| Strings          | Does every key exist in all six languages, with matching placeholders                                                                          |
| **Interface**    | Do the popup, settings and break window actually render, and is the expected text there                                                        |

That last row matters: **all three screens are rendered in a real DOM and
checked.** A "the screen doesn't open at all" bug is caught without touching the
browser.

---

# B — Manual testing

## B1. Build it

```bash
npm run build:chrome
```

You should get a file listing and `✔ Finished`. The output folder is
`.output\chrome-mv3`.

## B2. Load it into Chrome

1. Open Chrome, type `chrome://extensions` in the address bar, press Enter.
2. Turn **Developer mode** on, top right.
3. Press **Load unpacked**, which appears top left.
4. Select the **`.output\chrome-mv3`** folder inside the project — go into the
   folder and choose "Select folder", don't pick individual files.
5. The "Breather" card appears in the list.
6. Click the **jigsaw piece** in the toolbar and press the **pin** next to
   Breather. The icon is now in the toolbar.

> **Note:** on first install the welcome flow opens by itself in a new tab. That
> is one of the test items (number 1 in B4), so don't close it — use it there.

### After a code change

Run `npm run build:chrome` again, then press the **reload** arrow on the
Breather card at `chrome://extensions`.

## B3. Make the waiting bearable

The defaults are 25 minutes. Shorten them first:

1. Open the popup (the ring icon in the toolbar).
2. Press the **gear** at the bottom right; settings open in a full tab.
3. Under **Timer**:
   - Focus → **1**
   - Short break → **1**
   - Long break → **1**
   - Long break every → **2**
4. Under **Breaks**:
   - Eye break: on, every **1** min, for **10** sec
   - Breathing break: on, every **2** min, for **32** sec
   - Posture break: on, every **3** min, for **15** sec
   - Water break: on, every **4** min
5. **Do not disturb** → idle threshold → **1** min

Every change should flash a brief **"Saved"** in the top right. If it doesn't,
something is wrong — see Troubleshooting.

> Put these back afterwards. Note that **Data → Delete all data** clears the
> history but keeps the settings, so either reset them by hand or remove and
> reload the extension.

## B4. The scenarios

Go in order. Each one has what to do and what you should see.

### Welcome and the basics

**1. Welcome flow**
Do: go to the tab that opened on install. (If you closed it: remove the
extension and repeat B2, or use the URL in B5.)
See: "How do you work?" and three options → the breaks step → the working hours
step → "You're ready" and the pinning instruction. The progress bar should fill.

**2. First session**
Do: open the popup, press **Start**.
See: the ring starts filling, the time counts down, the toolbar badge shows
minutes in green. The main button becomes **Pause**.

**3. Finishing with the popup closed**
Do: close the popup, minimise Chrome, wait a minute.
See: a desktop notification and a short **sound**. The badge clears.

**4. Session review**
Do: open the popup.
See: the "How did that focus go?" card with five stars and a note field. Press a
star and the card closes.

**5. Pause and resume**
Do: Start → after 20 seconds press **Pause** → wait 30 seconds → **Resume**.
See: the time holds steady while paused and carries on from there. The status
reads "Paused".

**6. Extend by a minute**
Do: press **+1 min** while running. (The amount comes from Timer → Advanced →
"Extend button value"; the default is 5 minutes.)
See: the remaining time jumps up immediately.

**7. Keyboard shortcuts**
Do: from any tab, `Alt+Shift+S`, then `Alt+Shift+S` again.
See: the timer starts, then pauses — open the popup to confirm. `Alt+Shift+K`
skips the phase.

### The other modes

**8. Stopwatch**
Do: the **Stopwatch** tab → Start → wait a minute.
See: the time counts up. After a minute, a "that's 1 min — fancy a break?"
notification, if you set Timer → Advanced → "Stopwatch nudge" to **1 min**.
**Finish** records the session.

**9. Countdown**
Do: the **Countdown** tab → press the **5** preset → Start.
See: it counts down from 5:00. Close and reopen the popup and 5 is still
selected.

**10. Flowtime**
Do: the **Flowtime** tab → Start → wait 5 minutes → **Finish**.
See: a "Suggested break: 1 min" card (a fifth of 5 minutes, clamped to the
minimum). **Start break** begins it.

**11. Mode lock**
Do: start a session, then try clicking another tab.
See: the tabs are greyed out and unclickable; hovering says the mode can't be
changed while the timer runs.

### Tags

**12. Add and use a tag**
Do: press the **+** chip in the popup, type "Code", press **Add**.
See: a coloured chip appears, selected. Complete a session, reopen the popup, and
"Code" is first.

### Health breaks

**13. The break window**
Do: wait a minute (the eye break interval).
See: a small dark window in the middle of the screen: "Eye break", the
instruction and three buttons (**Start / Snooze 1 min / Skip**).

**14. Take the break**
Do: press **Start**.
See: a 10 second countdown, then "Break done" and the window closes itself.

**15. Breathing guide**
Do: wait for the breathing break (2 min) → **Start**.
See: the circle grows and shrinks with the breath, "Inhale / Hold / Exhale" and
the seconds left in the middle, the round counter below.

**16. Reduced motion**
Do: Windows → Settings → Accessibility → Visual effects → turn **Animation
effects** off. Repeat the breathing break.
See: the step name, a large number and a progress bar instead of the circle.
(Turn it back on afterwards.)

**17. Posture break**
Do: wait for the posture break (3 min).
See: a simple figure with the relevant part highlighted, and a stretch
instruction. Two posture breaks in a row must give **different** stretches.

**18. Water break**
Do: wait for the water break (4 min).
See: **no window**, only a notification. Click the water counter in the popup's
bottom strip: 0/8 becomes 1/8.

**19. Not interrupting a focus**
Do: start a Pomodoro and let the eye break come due (1 min).
See: the break window does **not** open. When the focus ends and the break phase
starts, the waiting eye break is offered immediately.

**20. Strict mode**
Do: Settings → Breaks → Advanced → turn **Strict mode** on. Wait for a break.
See: Skip is greyed out and unclickable for the first 10 seconds; hovering says
to wait a few seconds.

**21. Snooze limit**
Do: Settings → Breaks → Advanced → daily snooze limit **1**. Snooze two breaks
in a row.
See: the first snooze pushes the break a minute out; the second pushes it a
**full interval** instead.

**22. Closing the window by hand**
Do: close the break window with the **✕**.
See: it counts as skipped, the counter is re-armed, and the same break does not
immediately reappear.

### Do not disturb

**23. Quick mute**
Do: popup → **Mute** in the bottom strip → **30 minutes**.
See: "Muted: 30 min" in the strip. No break window appears during that time.
Click again to unmute and the waiting break arrives **at once** — it was held,
not skipped.

**24. Working hours**
Do: Settings → Do not disturb → turn **working hours** on and set today's range
so it does **not** include the current time (03:00–04:00, say).
See: no breaks. Widen the range again and they come back.

**25. Idle detection**
Do: start the stopwatch, lock the machine (`Win+L`), wait a minute or two, come
back.
See: the stopwatch is paused. The popup asks "You were away for 1 min. Add that
time to the session?" — **Add** puts it back.

**26. Meeting detection**
Do: Settings → Do not disturb → turn **meeting detection** on.
See: Chrome asks for permission to read your tabs. **Allow** and the switch stays
on. **Deny** and it stays off, with "Permission not granted" underneath.
(If you allowed it: open a `meet.google.com` tab and bring it to the front — no
break should arrive.)

### Durability — the four that matter most

**27. Browser closed completely and reopened**
Do: set the focus to **3 minutes**, start it, then **close Chrome entirely**
(every window). Wait 5 minutes, open Chrome, open the popup.
See: the timer is idle. Settings → Statistics → the session list shows a
**3 minute** session ending three minutes after you closed Chrome — not five.
The break must **not** have auto-started.

**28. Browser reopened before the time was up**
Do: set the focus to **10 minutes**, start it, close Chrome, open it a minute
later.
See: the timer carries on with the correct remaining time.

**29. Machine asleep**
Do: start a session, put the machine to sleep, wake it.
See: the timer and the statistics are intact.

**30. Service worker suspended**
Do: start a session, touch nothing for six or seven minutes (Chrome suspends the
worker), then open the popup.
See: the time is right. (At `chrome://extensions` → Breather, the "service
worker" label goes pale when it has been suspended — which is exactly the case
this is testing.)

### Statistics and data

**31. Statistics**
Do: popup → the chart icon.
See: the summary strip, the daily bar chart with its goal line, the year
heatmap, the day-by-hour heatmap, the tag breakdown, break compliance and the
session list.

**32. Range and filter**
Do: set the range to **This week** then **This year**, and change the tag filter.
See: every card and the list follow the filter.

**33. Adding a session by hand**
Do: in the sessions card, **Add session** → pick a time, 45 minutes → **Add**.
See: the list and the daily totals update.

**34. Deleting a session**
Do: **Delete** on a row.
See: it asks for confirmation, removes it, and the totals drop.

**35. Backup and restore**
Do: Data → **Download JSON backup** → then **Delete all data** (confirm) → then
**Choose file** and pick the backup you downloaded.
See: a **preview** first ("N sessions, N break records, date range"). Choose
**Replace** and everything comes back — the statistics as they were.

**36. CSV**
Do: Data → **Download sessions as CSV** → open it in Excel.
See: accented characters intact, and a tag containing a comma in a single cell.

### Appearance and accessibility

**37. Theme**
Do: Appearance → Theme → **Dark**.
See: settings, popup and break window all dark. The charts stay legible.

**38. Accent colour**
Do: Appearance → press a different colour.
See: the ring, buttons, charts and break window all change together.

**39. Keyboard**
Do: open the popup and use only `Tab` and `Enter`.
See: every control is reachable in turn, the focused one has a clear ring around
it, and nothing is skipped.

**40. Another language**
Do: Settings → Appearance → Language → **Deutsch**.
See: every string in the extension switches immediately — popup, settings and
break window — with no reload. Set it back to **English** or **Automatic**
afterwards.

### Last check

**41. Any console errors?**
Do: check all four places separately:

- Popup: **right-click the popup → Inspect** → Console
- Settings: `F12` on the page → Console
- Break window: right-click the window → Inspect → Console
- Background: `chrome://extensions` → click **service worker** on the Breather
  card → Console

See: **no** red errors. Yellow warnings are acceptable.

---

## B5. Useful URLs

The extension id is under the Breather card at `chrome://extensions` (the long
string of letters). Put it in place of `ID` below:

| What                     | URL                                           |
| ------------------------ | --------------------------------------------- |
| Settings                 | `chrome-extension://ID/options.html`          |
| Welcome flow             | `chrome-extension://ID/options.html#/welcome` |
| Statistics               | `chrome-extension://ID/options.html#/stats`   |
| Break window, on its own | `chrome-extension://ID/break.html`            |

---

## B6. Edge

Edge uses the same build as Chrome.

```bash
npm run build:edge
```

`edge://extensions` → **Developer mode**, bottom left → **Load unpacked** →
`.output\edge-mv3`

Repeating scenarios 2, 3, 13, 23, 27, 31 and 41 is enough here.

## B7. Firefox

```bash
npm run build:firefox
```

1. Open `about:debugging#/runtime/this-firefox`.
2. **Load Temporary Add-on** → select `.output\firefox-mv3\manifest.json`.
3. Pin the icon to the toolbar (right-click → "Pin to Toolbar").

Pay particular attention to:

- **Sound** (scenario 3): Firefox plays it on the background page rather than in
  an offscreen document. If there is no sound, check `about:debugging` →
  Breather → **Inspect** → Console.
- **The break window** (13) and the full screen presentation.
- **Notifications** (3) — Firefox's notification permission may be off at the
  system level.
- Scenario 27: a temporary add-on is **removed** when Firefox closes, so you
  have to load it again. The session is still in IndexedDB and shows up in the
  statistics.

> A temporary install disappears every time Firefox closes. A permanent one needs
> a signed package, which is part of publishing.

---

# Troubleshooting

### `npm install` prints a red `ERR!`

Usually a half-finished install. Try:

```bash
Remove-Item -Recurse -Force node_modules
```

Then again:

```bash
npm install
```

### `npm run check` says "Cannot find module '#i18n'"

The generated types are missing. Run:

```bash
npx wxt prepare
```

This runs by itself after `npm install`; if it was skipped, run it by hand.

### "Load unpacked" gives an error

Probably the wrong folder. You want `.output\chrome-mv3` inside the project —
the folder with `manifest.json` in it. If it isn't there, run
`npm run build:chrome` first.

### I change a setting and no "Saved" appears

Press `F12` on the settings page and look at the Console. A `storage` error may
mean the Chrome profile's sync quota is full; the extension falls back to local
storage in that case and should still work.

### No notifications

Windows → Settings → System → Notifications: are notifications on for Google
Chrome? **Focus assist / Do not disturb** must also be off — Windows hides
notifications while it is on.

### No sound

Settings → Sound: is the notification sound on, and is the volume above zero? Try
the **Play** button. If there is still nothing, check the service worker console
for a `[breather] could not play the tone` warning. Sound never breaks the
timer; it is skipped silently.

### The break window doesn't open

1. Settings → Breaks → is "How should breaks appear" set to **Small window**?
2. Is quick mute on (the popup's bottom strip)?
3. Are you outside your working hours?
4. Are you mid-Pomodoro-focus, where it deliberately doesn't interrupt?

If none of those, check the service worker console.

### The timer shows the wrong time

This is the most heavily tested area in the suite. If you see it by hand, note
the mode, the phase, the configured duration, what you did (pause, close, sleep)
and both the expected and the actual time.

### Starting over completely

`chrome://extensions` → Breather → **Remove**, then repeat B2. That clears every
setting and all history.

---

# The short version

> **Run the commands one at a time.** Chaining with `&&` is a parser error in
> PowerShell; each block below is its own command.

Once, for the dependencies:

```bash
npm install
```

After every change — runs the tests and produces the Chrome build:

```bash
npm run verify
```

Then: `chrome://extensions` → Developer mode → Load unpacked →
`.output\chrome-mv3` → the quick settings from B3 → the 41 scenarios in B4.
