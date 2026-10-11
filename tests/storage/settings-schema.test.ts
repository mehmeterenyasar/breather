import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  SETTINGS_VERSION,
  migrateSettings,
  normalizeSettings,
} from '@/storage/schema';

describe('migrating and normalising settings', () => {
  it('falls back to the defaults for missing or broken input', () => {
    expect(migrateSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(migrateSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(migrateSettings('bozuk')).toEqual(DEFAULT_SETTINGS);
    expect(migrateSettings([1, 2, 3])).toEqual(DEFAULT_SETTINGS);
  });

  it('merges partial data with the defaults', () => {
    const result = migrateSettings({ version: 1, timer: { focusMin: 50 } });

    expect(result.timer.focusMin).toBe(50);
    expect(result.timer.shortBreakMin).toBe(DEFAULT_SETTINGS.timer.shortBreakMin);
    expect(result.breaks.eye).toEqual(DEFAULT_SETTINGS.breaks.eye);
    expect(result.version).toBe(SETTINGS_VERSION);
  });

  it('migrates older data that has no version', () => {
    const result = migrateSettings({ timer: { focusMin: 30 } });
    expect(result.version).toBe(SETTINGS_VERSION);
    expect(result.timer.focusMin).toBe(30);
  });

  it('normalises a version from the future rather than refusing it', () => {
    const result = migrateSettings({ version: 99, timer: { focusMin: 42 } });
    expect(result.version).toBe(SETTINGS_VERSION);
    expect(result.timer.focusMin).toBe(42);
  });

  it('clamps the numbers to sensible ranges', () => {
    const result = normalizeSettings({
      timer: {
        focusMin: 9999,
        shortBreakMin: 0,
        longBreakEvery: 1,
        extendMin: -5,
        flowtimeBreakRatio: 50,
      },
      sound: { volume: 3 },
      goals: { dailyFocusMin: 0 },
    });

    expect(result.timer.focusMin).toBe(180);
    expect(result.timer.shortBreakMin).toBe(1);
    expect(result.timer.longBreakEvery).toBe(2);
    expect(result.timer.extendMin).toBe(1);
    expect(result.timer.flowtimeBreakRatio).toBe(1);
    expect(result.sound.volume).toBe(1);
    expect(result.goals.dailyFocusMin).toBe(5);
  });

  it('replaces a value that is not a number', () => {
    const result = normalizeSettings({
      timer: { focusMin: 'yirmibes', shortBreakMin: Number.NaN, longBreakMin: Infinity },
    });

    expect(result.timer.focusMin).toBe(DEFAULT_SETTINGS.timer.focusMin);
    expect(result.timer.shortBreakMin).toBe(DEFAULT_SETTINGS.timer.shortBreakMin);
    expect(result.timer.longBreakMin).toBe(DEFAULT_SETTINGS.timer.longBreakMin);
  });

  it('replaces an unknown option with the default', () => {
    const result = normalizeSettings({
      appearance: { theme: 'neon', accent: 'pembe', popupSize: 'huge' },
      breaks: { presentation: 'hologram', breath: { pattern: 'yoga' } },
      sound: { tone: 'gong' },
      lastMode: 'turbo',
    });

    expect(result.appearance.theme).toBe('system');
    expect(result.appearance.accent).toBe('sage');
    expect(result.appearance.popupSize).toBe('normal');
    expect(result.breaks.presentation).toBe('window');
    expect(result.breaks.breath.pattern).toBe('box');
    expect(result.sound.tone).toBe('soft');
    expect(result.lastMode).toBe('pomodoro');
  });

  it('allows the stopwatch nudge to be switched off, and clamps it otherwise', () => {
    expect(
      normalizeSettings({ timer: { stopwatchRemindEveryMin: null } }).timer.stopwatchRemindEveryMin,
    ).toBeNull();
    expect(
      normalizeSettings({ timer: { stopwatchRemindEveryMin: 1 } }).timer.stopwatchRemindEveryMin,
    ).toBe(5);
    expect(
      normalizeSettings({ timer: { stopwatchRemindEveryMin: 50 } }).timer.stopwatchRemindEveryMin,
    ).toBe(50);
  });

  it('throws out tags with no id, no name, or a duplicate id', () => {
    const result = normalizeSettings({
      tags: [
        { id: 'a', name: 'Kod', color: '#4e8c7e' },
        { id: 'a', name: 'Tekrar', color: '#4e8c7e' },
        { id: 'b', name: '   ', color: '#4e8c7e' },
        { name: 'Kimliksiz', color: '#4e8c7e' },
        { id: 'c', name: 'Okuma', color: 'yesil' },
        'bozuk',
      ],
    });

    expect(result.tags).toEqual([
      { id: 'a', name: 'Kod', color: '#4e8c7e' },
      { id: 'c', name: 'Okuma', color: '#7a8a99' },
    ]);
  });

  it('forgets a last-used tag that no longer exists', () => {
    const withTag = normalizeSettings({
      tags: [{ id: 'a', name: 'Kod', color: '#4e8c7e' }],
      lastTagId: 'a',
    });
    const orphan = normalizeSettings({ tags: [], lastTagId: 'a' });

    expect(withTag.lastTagId).toBe('a');
    expect(orphan.lastTagId).toBeUndefined();
  });

  it('fills the working hours out to seven days', () => {
    const result = normalizeSettings({
      dnd: { workHours: { enabled: true, days: [{ enabled: true, startMin: 600, endMin: 1200 }] } },
    });

    expect(result.dnd.workHours.days).toHaveLength(7);
    expect(result.dnd.workHours.days[0]).toEqual({ enabled: true, startMin: 600, endMin: 1200 });
    expect(result.dnd.workHours.days[1]).toEqual(DEFAULT_SETTINGS.dnd.workHours.days[1]);
  });

  it('lowercases the meeting domains and trims them', () => {
    const result = normalizeSettings({
      dnd: { meetings: { enabled: true, domains: ['  Meet.Google.com ', '', 42, 'zoom.us'] } },
    });

    expect(result.dnd.meetings.domains).toEqual(['meet.google.com', 'zoom.us']);
  });

  it('clears a mute timestamp that is not a number', () => {
    expect(normalizeSettings({ dnd: { muteUntil: 'yarin' } }).dnd.muteUntil).toBeNull();
    expect(normalizeSettings({ dnd: { muteUntil: 1_700_000_000_000 } }).dnd.muteUntil).toBe(
      1_700_000_000_000,
    );
  });

  it('is idempotent', () => {
    const once = normalizeSettings(DEFAULT_SETTINGS);
    const twice = normalizeSettings(once);
    expect(twice).toEqual(once);
    expect(once).toEqual(DEFAULT_SETTINGS);
  });
});
