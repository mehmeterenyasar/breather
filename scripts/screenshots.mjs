/**
 * Screenshots for the README, taken from the real extension.
 *
 * Loads the unpacked development build into Playwright's Chromium (Chrome
 * itself dropped `--load-extension`), sets each screen up through the
 * extension's own storage, and writes the PNGs to docs/.
 *
 * The Chromium binary is Playwright's own, because Chrome itself no longer
 * honours --load-extension. Fetch it once with:
 *
 *   npx playwright install chromium
 *
 * then run the whole thing with:
 *
 *   npm run screenshots
 */
import { chromium } from 'playwright-core';
import { mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const EXT = resolve(ROOT, '.output/chrome-mv3-dev');
const OUT = resolve(ROOT, 'docs');
const PROFILE = resolve(ROOT, '.output/.shotprofile');

mkdirSync(OUT, { recursive: true });
rmSync(PROFILE, { recursive: true, force: true });

const ctx = await chromium.launchPersistentContext(PROFILE, {
  headless: false,
  // A fresh profile would otherwise inherit the host locale, and the screens
  // follow the browser language by default.
  locale: 'en-US',
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, '--lang=en-US'],
});

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function extensionId() {
  for (let i = 0; i < 60; i++) {
    const worker = ctx.serviceWorkers()[0];
    if (worker) return new URL(worker.url()).host;
    await wait(250);
  }
  throw new Error('could not determine the extension id');
}

const id = await extensionId();
const url = (p) => `chrome-extension://${id}/${p}`;

// The install opens the welcome flow; close it so it cannot steal focus.
await wait(1500);
for (const p of ctx.pages()) {
  if (p.url().includes('options.html')) await p.close().catch(() => {});
}

const page = await ctx.newPage();

/** Writes straight into extension storage, which is what the screens read. */
const setStorage = (area, items) =>
  page.evaluate(([a, i]) => chrome.storage[a].set(i), [area, items]);

const TAG = { id: 'tag-code', name: 'Code', color: '#3f7d6f', createdAt: Date.now() };

/**
 * The ids the seeder uses. The stacked chart draws a segment per known tag, so
 * without these the seeded time is there but invisible.
 */
const SEED_TAGS = [
  { id: 'seed-code', name: 'Code', color: '#3f7d6f' },
  { id: 'seed-study', name: 'Study', color: '#5d7fa8' },
  { id: 'seed-reading', name: 'Reading', color: '#a8765d' },
  { id: 'seed-writing', name: 'Writing', color: '#8a6da8' },
].map((tag) => ({ ...tag, createdAt: Date.now() }));

/** Pin the language, so the shots do not depend on the host locale. */
async function forceEnglish() {
  await page.evaluate(async () => {
    const current = (await chrome.storage.sync.get('settings')).settings ?? {};
    await chrome.storage.sync.set({
      settings: { ...current, appearance: { ...(current.appearance ?? {}), language: 'en' } },
    });
  });
}

/* ---- 1. popup, mid-focus ---------------------------------------------- */

await page.goto(url('popup.html'), { waitUntil: 'domcontentloaded' });
await wait(800);

await forceEnglish();

const now = Date.now();
await setStorage('sync', {
  settings: await page.evaluate(async (tag) => {
    const current = (await chrome.storage.sync.get('settings')).settings ?? {};
    return { ...current, tags: [tag], lastTagId: tag.id, lastMode: 'pomodoro' };
  }, TAG),
});

const MIN = 60_000;
/** Matches dayKey() in src/core/time.ts: the LOCAL calendar day. */
const localDay = (ts) => {
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
await setStorage('local', {
  timerState: {
    mode: 'pomodoro',
    phase: 'focus',
    status: 'running',
    startedAt: now - 11 * MIN,
    plannedMs: 25 * MIN,
    extendedMs: 0,
    targetEndAt: now + 14 * MIN,
    pausedTotalMs: 0,
    pomodoroIndex: 2,
    tagId: TAG.id,
    sessionId: 'shot',
  },
  todaySummary: {
    dayKey: localDay(now),
    focusMs: 95 * MIN,
    pomodoroCount: 3,
    sessionCount: 4,
    waterGlasses: 3,
    updatedAt: now,
  },
  healthState: {
    dayKey: localDay(now),
    entries: {
      eye: { nextDueAt: now + 12 * MIN, deferred: false, snoozedToday: 0 },
      breath: { nextDueAt: now + 40 * MIN, deferred: false, snoozedToday: 0 },
      posture: { nextDueAt: now + 25 * MIN, deferred: false, snoozedToday: 0 },
      water: { nextDueAt: now + 60 * MIN, deferred: false, snoozedToday: 0 },
    },
  },
});

await page.reload({ waitUntil: 'domcontentloaded' });
await wait(1500);

const popup = await page.evaluate(() => {
  const el = document.querySelector('.popup') ?? document.body.firstElementChild;
  const r = el.getBoundingClientRect();
  return { width: Math.ceil(r.width), height: Math.ceil(r.height) };
});
await page.setViewportSize({ width: popup.width, height: popup.height });
await wait(400);
await page.screenshot({ path: resolve(OUT, 'popup.png') });
console.log('docs/popup.png', popup);

/* ---- 2. break window, breathing ---------------------------------------- */

await page.setViewportSize({ width: 460, height: 520 }); // the real window size
await page.evaluate(async () => {
  const current = (await chrome.storage.sync.get('settings')).settings ?? {};
  await chrome.storage.sync.set({
    settings: { ...current, appearance: { ...(current.appearance ?? {}), theme: 'dark' } },
  });
});
await setStorage('local', {
  activeBreak: { id: 'shot', kinds: ['breath'], startedAt: Date.now() },
});
await page.goto(url('break.html'), { waitUntil: 'domcontentloaded' });
await wait(1200);

const start = page.getByRole('button', { name: /^start$/i }).first();
if (await start.count()) {
  await start.click();
  // Box breathing is 4-4-4-4. Waiting for the inhale and then sitting inside
  // the hold that follows it catches the circle at its largest, with four
  // seconds of slack rather than a single frame to hit.
  for (let i = 0; i < 60; i++) {
    if (/Breathe in/i.test((await page.textContent('body')) ?? '')) break;
    await wait(150);
  }
  for (let i = 0; i < 60; i++) {
    if (/Hold/i.test((await page.textContent('body')) ?? '')) break;
    await wait(150);
  }
  await wait(900);
}
await page.screenshot({ path: resolve(OUT, 'break.png') });
console.log('docs/break.png');

/* ---- seed two years of sessions through the dev button ----------------- */

await page.setViewportSize({ width: 1340, height: 980 });
await page.goto(url('options.html#/data'), { waitUntil: 'domcontentloaded' });
await wait(1200);

const seed = page.getByRole('button', { name: /fake data/i }).first();
if (await seed.count()) {
  await seed.click();
  // dev.result is "{sessions} sessions, {days} days - {ms} ms". Matching the
  // button's own label instead would return instantly and abort the seeding.
  let done = false;
  for (let i = 0; i < 240; i++) {
    if (/\d[\d.,]*\s*sessions,\s*\d+\s*days/i.test((await page.textContent('body')) ?? '')) {
      done = true;
      break;
    }
    await wait(500);
  }
  console.log(done ? 'seeded' : 'WARN: seeding did not report back');
} else {
  console.log('WARN: no seed button - is this a development build?');
}

/* ---- 3. statistics, dark ----------------------------------------------- */

await page.evaluate(async (tags) => {
  const current = (await chrome.storage.sync.get('settings')).settings ?? {};
  await chrome.storage.sync.set({ settings: { ...current, tags } });
}, SEED_TAGS);

await setStorage('sync', {
  settings: await page.evaluate(async () => {
    const current = (await chrome.storage.sync.get('settings')).settings ?? {};
    return { ...current, appearance: { ...(current.appearance ?? {}), theme: 'dark' } };
  }),
});

await page.goto(url('options.html#/stats'), { waitUntil: 'domcontentloaded' });
await wait(3500);
// The "N ms" badge is dev-only (import.meta.env.DEV) and is not in a release
// build, so it has no business in a screenshot of one.
await page.addStyleTag({
  content: `
    .panel__meta { visibility: hidden }
    ::-webkit-scrollbar { width: 0; height: 0 }
  `,
});
await page.screenshot({ path: resolve(OUT, 'stats.png') });
console.log('docs/stats.png');

/* ---- 4. best hours ----------------------------------------------------- */

// Just the card: a second full-page shot would only repeat the one above.
const hours = page.locator('.block', { hasText: /most productive hours/i }).first();
if (await hours.count()) {
  await hours.scrollIntoViewIfNeeded();
  await wait(1000);
  await hours.screenshot({ path: resolve(OUT, 'hours.png') });
  console.log('docs/hours.png');
}

/* ---- 5. settings, breaks, light ---------------------------------------- */

await setStorage('sync', {
  settings: await page.evaluate(async () => {
    const current = (await chrome.storage.sync.get('settings')).settings ?? {};
    return { ...current, appearance: { ...(current.appearance ?? {}), theme: 'light' } };
  }),
});
await page.goto(url('options.html#/breaks'), { waitUntil: 'domcontentloaded' });
await wait(2000);
await page.addStyleTag({ content: '::-webkit-scrollbar { width: 0; height: 0 }' });
await page.screenshot({ path: resolve(OUT, 'settings.png') });
console.log('docs/settings.png');

await ctx.close();
