// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { render } from 'preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { MINUTE_MS } from '@/core/time';
import { db } from '@/db';
import { addSession } from '@/db/sessions';
import { updateSettings } from '@/storage/settings';
import { writeActiveBreak } from '@/storage/health-state';
import { writeTimerState } from '@/storage/timer-state';
import { App as PopupApp } from '@/entrypoints/popup/App';
import { App as OptionsApp } from '@/entrypoints/options/App';
import { App as BreakApp } from '@/entrypoints/break/App';

/**
 * Smoke tests: render all three screens in a real DOM and check that the text
 * we expect turns up, using the actual English catalog.
 *
 * Not pixel comparison. These catch the things you otherwise only find by
 * opening the extension and looking — a screen that doesn't render at all, a
 * missing translation key, a read off null.
 *
 * The screens read from storage and IndexedDB asynchronously, so each check
 * polls until the content appears. The clock is faked; the timers are not.
 */

const T0 = new Date(2026, 2, 2, 10, 0, 0, 0).getTime();
const WAIT = { timeout: 4000, interval: 10 } as const;

let host: HTMLDivElement;

function text(): string {
  return host.textContent ?? '';
}

async function draw(node: preact.ComponentChild): Promise<void> {
  render(node, host);
  await vi.waitFor(() => expect(text().length + host.childElementCount).toBeGreaterThan(0), WAIT);
}

async function seeText(needle: string): Promise<void> {
  await vi.waitFor(() => expect(text()).toContain(needle), WAIT);
}

async function seeElement(selector: string): Promise<void> {
  await vi.waitFor(() => expect(host.querySelector(selector)).not.toBeNull(), WAIT);
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(T0);
  fakeBrowser.reset();
  await Promise.all(db.tables.map((table) => table.clear()));

  host = document.createElement('div');
  document.body.append(host);
});

afterEach(() => {
  render(null, host);
  host.remove();
  vi.useRealTimers();
});

describe('popup', () => {
  it('renders when idle, with the main button', async () => {
    await draw(<PopupApp />);
    await seeText('Start');

    expect(text()).toContain('Pomodoro');
    // The ring shows the length of the next focus.
    expect(host.querySelector('.popup__time')?.textContent).toBe('25:00');
  });

  it('shows the remaining time and the secondary buttons while running', async () => {
    await writeTimerState({
      mode: 'pomodoro',
      phase: 'focus',
      status: 'running',
      startedAt: T0 - 10 * MINUTE_MS,
      plannedMs: 25 * MINUTE_MS,
      extendedMs: 0,
      targetEndAt: T0 + 15 * MINUTE_MS,
      pausedTotalMs: 0,
      pomodoroIndex: 1,
      autoStarted: false,
      sessionId: 'x',
    });

    await draw(<PopupApp />);
    await seeText('Pause');

    expect(host.querySelector('.popup__time')?.textContent).toBe('15:00');
    expect(text()).toContain('Skip');
    // One of the cycle dots should be filled.
    expect(host.querySelectorAll('.dots__dot--on')).toHaveLength(1);
  });

  it('shows the tags and the mute control', async () => {
    await updateSettings({ tags: [{ id: 'kod', name: 'Kod', color: '#4e8c7e' }] });

    await draw(<PopupApp />);
    await seeText('Kod');

    expect(text()).toContain('Mute');
  });

  it('renders the quick presets in countdown mode', async () => {
    await writeTimerState({
      mode: 'countdown',
      phase: 'idle',
      status: 'idle',
      extendedMs: 0,
      pausedTotalMs: 0,
      pomodoroIndex: 0,
      autoStarted: false,
    });

    await draw(<PopupApp />);
    await seeElement('.presets__item');

    expect(host.querySelectorAll('.presets__item').length).toBeGreaterThan(5);
  });
});

describe('the settings page', () => {
  it('lists every section in the menu', async () => {
    window.location.hash = '#/timer';
    await draw(<OptionsApp />);
    await seeText('Timer');

    for (const label of [
      'Statistics',
      'Breaks',
      'Do not disturb',
      'Goals',
      'Appearance',
      'Sound',
      'Data',
      'About',
    ]) {
      expect(text(), label).toContain(label);
    }
  });

  it('shows the real values in the timer section', async () => {
    await updateSettings({ timer: { focusMin: 42 } });

    window.location.hash = '#/timer';
    await draw(<OptionsApp />);
    await seeElement('.stepper__input');

    const values = [...host.querySelectorAll<HTMLInputElement>('.stepper__input')].map(
      (input) => input.value,
    );
    expect(values).toContain('42');
  });

  it('renders all four breaks', async () => {
    window.location.hash = '#/breaks';
    await draw(<OptionsApp />);
    await seeText('Eye break');

    expect(text()).toContain('Breathing break');
    expect(text()).toContain('Posture break');
    expect(text()).toContain('Water break');
    expect(host.querySelectorAll('[role="switch"]').length).toBeGreaterThan(4);
  });

  it('lists seven days under do not disturb', async () => {
    await updateSettings({ dnd: { workHours: { enabled: true } } });

    window.location.hash = '#/dnd';
    await draw(<OptionsApp />);
    await seeElement('.days__row');

    expect(host.querySelectorAll('.days__row')).toHaveLength(7);
  });

  it('offers six accent colours', async () => {
    window.location.hash = '#/appearance';
    await draw(<OptionsApp />);
    await seeElement('.swatch');

    expect(host.querySelectorAll('.swatch')).toHaveLength(6);
  });

  it('shows the empty state in statistics when there is no data', async () => {
    window.location.hash = '#/stats';
    await draw(<OptionsApp />);
    await seeText('Nothing here yet');
  });

  it('renders the cards and the charts when there is', async () => {
    await addSession({
      id: 'a',
      mode: 'pomodoro',
      phase: 'focus',
      start: T0 - 60 * MINUTE_MS,
      end: T0 - 35 * MINUTE_MS,
      durationMs: 25 * MINUTE_MS,
      pausedMs: 0,
      completed: true,
    });

    window.location.hash = '#/stats';
    await draw(<OptionsApp />);
    await seeText('Daily focus time');

    expect(text()).toContain('Your most productive hours');
    // The bar chart and both heatmaps.
    expect(host.querySelector('.chart')).not.toBeNull();
    expect(host.querySelectorAll('.heatmap').length).toBeGreaterThanOrEqual(2);
    // And a row in the session list.
    expect(host.querySelectorAll('.table tbody tr').length).toBeGreaterThan(0);
  });

  it('offers export and delete in the data section', async () => {
    window.location.hash = '#/data';
    await draw(<OptionsApp />);
    await seeText('Download JSON backup');

    expect(text()).toContain('Choose file');
    expect(text()).toContain('Delete history');
  });

  it('opens the welcome flow on its first step', async () => {
    window.location.hash = '#/welcome';
    await draw(<OptionsApp />);
    await seeText('How do you work?');

    expect(host.querySelectorAll('.choice')).toHaveLength(3);
  });

  it('shows the empty state and the add row under tags', async () => {
    window.location.hash = '#/timer';
    await draw(<OptionsApp />);
    await seeText('No tags yet');

    // Swatch, name field, button.
    expect(host.querySelector('.addrow__input')).not.toBeNull();
    expect(host.querySelector('.addrow__swatch')).not.toBeNull();
  });

  it('lists the tags with their icon buttons', async () => {
    await updateSettings({
      tags: [{ id: 'kod', name: 'Kod', color: '#4e8c7e' }],
    });

    window.location.hash = '#/timer';
    await draw(<OptionsApp />);
    await seeElement('.taglist__row');

    expect(host.querySelectorAll('.taglist__row')).toHaveLength(1);
    // Archive and delete, both with accessible names.
    expect(host.querySelectorAll('.taglist__actions .iconbtn')).toHaveLength(2);
    for (const button of host.querySelectorAll('.iconbtn')) {
      expect(button.getAttribute('aria-label')).toBeTruthy();
    }
  });

  it('offers more than ten tones', async () => {
    window.location.hash = '#/sound';
    await draw(<OptionsApp />);
    await seeText('Tone');

    const tones = host.querySelectorAll('select option');
    expect(tones.length).toBeGreaterThanOrEqual(10);
  });
});

describe('the welcome checkboxes', () => {
  it('render four break cards with our own checkbox', async () => {
    window.location.hash = '#/welcome';
    await draw(<OptionsApp />);
    await seeElement('.choice');

    // Pick the first option to reach step two.
    (host.querySelector('.choice') as HTMLButtonElement).click();
    await seeElement('.checkcard');

    const cards = host.querySelectorAll('.checkcard');
    expect(cards).toHaveLength(4);

    for (const card of cards) {
      expect(card.getAttribute('role')).toBe('checkbox');
      expect(card.getAttribute('aria-checked')).toBeTruthy();
      // Each card has the drawn box and its hint.
      expect(card.querySelector('.checkcard__box')).not.toBeNull();
      expect(card.querySelector('.checkcard__hint')?.textContent).toBeTruthy();
    }
  });
});

describe('the break window', () => {
  it('renders the eye break with its instruction', async () => {
    await writeActiveBreak({ id: 'b1', kinds: ['eye'], startedAt: T0 });

    await draw(<BreakApp />);
    await seeText('Eye break');

    expect(text()).toContain('Look at something');
    expect(text()).toContain('Start');
    expect(text()).toContain('Skip');
  });

  it('shows the figure and the instruction for a posture break', async () => {
    await writeActiveBreak({ id: 'b2', kinds: ['posture'], startedAt: T0, stretch: 'neck' });

    await draw(<BreakApp />);
    await seeText('Tilt your head');

    expect(host.querySelector('.figure')).not.toBeNull();
  });

  it('shows the position indicator when breaks have piled up', async () => {
    await writeActiveBreak({ id: 'b3', kinds: ['eye', 'breath'], startedAt: T0 });

    await draw(<BreakApp />);
    await seeElement('.break__queue');

    expect(host.querySelector('.break__queue')?.textContent).toContain('1');
  });
});
