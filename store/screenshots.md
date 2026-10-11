# Screenshots

**Size:** 1280 × 800, the larger format both the Chrome Web Store and Edge
Add-ons accept. Each store wants between one and five images; take the five
below, in this order.

**Setup, for all of them**

1. Load a production build: `npm run build:chrome`, then `.output/chrome-mv3`.
2. Use a clean browser profile so no other extension is visible.
3. Display scale at 100%, browser window at 1280 × 800.
4. For the data in the charts: Settings → Data → Developer → "Generate fake
   data". That section only appears in a `npm run dev` build, so take these
   shots from that build and keep the developer section out of frame.
5. Light theme, except number 3, which is dark.
6. Leave the accent on the default (Sage).

---

## 1 — The popup, mid-focus

**Should show:** the Pomodoro tab selected, the ring about half full, the
remaining time in large figures, two of the cycle dots filled, a tag selected
("Code"), and the bottom strip with today's total and "Next break in 12 min".

**How:** add a tag, start a Pomodoro and wait, or shorten the focus duration in
a development build and catch it halfway.

**Suggested caption:** "Start with one click"

---

## 2 — The break window, breathing guide

**Should show:** the small break window centred, the circle at its largest,
"Inhale" and the seconds left, the round counter and the three buttons.

**How:** Settings → Breaks, set the breathing interval to a minute, wait for the
break, press Start and catch it mid-inhale.

**Suggested caption:** "Breaks for your eyes, breath and posture"

---

## 3 — Statistics, dark

**Should show:** the summary figures, the daily bar chart with the goal line, and
the year heatmap below it. Range set to "Last 30 days".

**How:** generate the fake data, Appearance → Theme → Dark, then Statistics.
Scroll so the charts are in frame.

**Suggested caption:** "See where your focus actually went"

---

## 4 — Best hours

**Should show:** the day-by-hour heatmap card in full, with the tag breakdown
bars below it.

**How:** scroll down the statistics page and centre the "Your best hours" card.

**Suggested caption:** "Find the hours that work for you"

---

## 5 — Settings, the breaks section

**Should show:** the menu on the left with Breaks open, the eye and breathing
groups with their interval and duration fields, and the "How should breaks
appear" choice underneath.

**How:** Settings → Breaks, with "Advanced" collapsed so it stays calm.

**Suggested caption:** "Set it to your own rhythm"

---

## Small promo tile (Chrome Web Store, 440 × 280)

The icon centred on a dark background, "Breather" under it and one line: "Focus
timer and break reminders". Not a screenshot, just a plain cover.

## Checklist

- [ ] No personal data anywhere in frame (tab titles, bookmarks, account name)
- [ ] No other extension icons in the toolbar
- [ ] Interface language matches the listing (switch the browser language and
      retake for each one)
- [ ] The fake data button is out of frame
- [ ] Every image exactly 1280 × 800
