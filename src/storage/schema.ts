import { LANGUAGES } from '@/i18n';
import type { LangPreference } from '@/i18n';
import { TONES } from '@/core/tones';
import type { ToneId } from '@/core/tones';
import type { HealthKind, Mode, Tag, TimerSettings } from '@/core/types';

/**
 * One settings object, carrying a `version` so the `migrations` chain can bring
 * an older one forward.
 *
 * `migrateSettings` is pure and therefore testable: it merges whatever it is
 * given with the defaults and clamps the numbers into their valid ranges. No
 * browser APIs in here; settings.ts does the storage.
 */

export const SETTINGS_VERSION = 1;

export const ACCENTS = ['sage', 'indigo', 'plum', 'clay', 'ocean', 'graphite'] as const;
export type AccentId = (typeof ACCENTS)[number];

export const BREATH_PATTERNS = ['box', 'fourSevenEight', 'coherent', 'sigh', 'custom'] as const;
export type BreathPatternId = (typeof BREATH_PATTERNS)[number];

export const BREAK_PRESENTATIONS = ['notification', 'window', 'fullscreen'] as const;
export type BreakPresentation = (typeof BREAK_PRESENTATIONS)[number];

export const THEMES = ['system', 'light', 'dark'] as const;
export type ThemeId = (typeof THEMES)[number];

export const POPUP_SIZES = ['compact', 'normal'] as const;
export type PopupSize = (typeof POPUP_SIZES)[number];

export interface BreakConfig {
  enabled: boolean;
  /** Interval, in minutes. */
  everyMin: number;
  /** How long the break lasts, in seconds. Unused for water. */
  durationSec: number;
}

export interface CustomBreath {
  inhaleSec: number;
  holdSec: number;
  exhaleSec: number;
  holdAfterSec: number;
}

export interface BreaksSettings {
  eye: BreakConfig;
  breath: BreakConfig & { pattern: BreathPatternId; custom: CustomBreath };
  posture: BreakConfig;
  water: BreakConfig & { dailyGoalGlasses: number };
  /** Hold health breaks back during a focus and merge them into the Pomodoro break. */
  dontInterruptFocus: boolean;
  presentation: BreakPresentation;
  /** Disables Skip for ten seconds and limits snoozing per day. */
  strictMode: boolean;
  snoozeMin: number;
  dailySnoozeLimit: number;
}

/** Minutes into the day, so 09:00 is 540. */
export interface WorkHoursDay {
  enabled: boolean;
  startMin: number;
  endMin: number;
}

export interface DndSettings {
  workHours: { enabled: boolean; days: WorkHoursDay[] };
  idle: { enabled: boolean; afterMin: number; askToAddTime: boolean };
  /** Switching this on is what triggers the runtime `tabs` request. */
  meetings: { enabled: boolean; domains: string[] };
  /** When the mute expires, or null. */
  muteUntil: number | null;
}

export interface GoalsSettings {
  /** Daily focus goal, in minutes. */
  dailyFocusMin: number;
  /** Show the goal as a count of Pomodoros rather than minutes. */
  usePomodoroGoal: boolean;
  dailyPomodoroGoal: number;
  /** Whether weekends count towards a streak. */
  countWeekends: boolean;
  /** The Monday morning summary. */
  weeklyReport: boolean;
}

export interface AppearanceSettings {
  /** 'auto' follows the browser. */
  language: LangPreference;
  theme: ThemeId;
  accent: AccentId;
  popupSize: PopupSize;
  showBadge: boolean;
  /** Announce the remaining time once a minute, for screen readers. */
  announceMinutes: boolean;
}

export interface SoundSettings {
  enabled: boolean;
  /** 0..1 */
  volume: number;
  tone: ToneId;
}

export interface Settings {
  version: number;
  timer: TimerSettings;
  breaks: BreaksSettings;
  dnd: DndSettings;
  goals: GoalsSettings;
  appearance: AppearanceSettings;
  sound: SoundSettings;
  tags: Tag[];
  /** Offered first in the popup next time. */
  lastTagId?: string;
  lastMode: Mode;
  onboardingDone: boolean;
}

const WORK_DAY: WorkHoursDay = { enabled: true, startMin: 9 * 60, endMin: 18 * 60 };
const WEEKEND_DAY: WorkHoursDay = { enabled: false, startMin: 9 * 60, endMin: 18 * 60 };

export const DEFAULT_SETTINGS: Settings = {
  version: SETTINGS_VERSION,
  timer: {
    focusMin: 25,
    shortBreakMin: 5,
    longBreakMin: 15,
    longBreakEvery: 4,
    autoStartBreak: false,
    autoStartFocus: false,
    extendMin: 5,
    countdownDefaultMin: 15,
    stopwatchRemindEveryMin: null,
    flowtimeBreakRatio: 0.2,
    flowtimeMinBreakMin: 3,
    flowtimeMaxBreakMin: 30,
  },
  breaks: {
    eye: { enabled: true, everyMin: 20, durationSec: 20 },
    breath: {
      enabled: true,
      everyMin: 60,
      durationSec: 60,
      pattern: 'box',
      custom: { inhaleSec: 4, holdSec: 4, exhaleSec: 4, holdAfterSec: 4 },
    },
    posture: { enabled: true, everyMin: 45, durationSec: 30 },
    water: { enabled: true, everyMin: 90, durationSec: 0, dailyGoalGlasses: 8 },
    dontInterruptFocus: true,
    presentation: 'window',
    strictMode: false,
    snoozeMin: 5,
    dailySnoozeLimit: 3,
  },
  dnd: {
    workHours: {
      enabled: false,
      // Sunday first, matching `getDay`.
      days: [WEEKEND_DAY, WORK_DAY, WORK_DAY, WORK_DAY, WORK_DAY, WORK_DAY, WEEKEND_DAY],
    },
    idle: { enabled: true, afterMin: 5, askToAddTime: true },
    meetings: {
      enabled: false,
      domains: ['meet.google.com', 'zoom.us', 'teams.microsoft.com', 'teams.live.com'],
    },
    muteUntil: null,
  },
  goals: {
    dailyFocusMin: 120,
    usePomodoroGoal: false,
    dailyPomodoroGoal: 6,
    countWeekends: false,
    weeklyReport: true,
  },
  appearance: {
    language: 'auto',
    theme: 'system',
    accent: 'sage',
    popupSize: 'normal',
    showBadge: true,
    announceMinutes: false,
  },
  sound: { enabled: true, volume: 0.6, tone: 'soft' },
  // No default tags: a tag name is user content and cannot be translated. The
  // welcome flow offers a few to start with instead.
  tags: [],
  lastMode: 'pomodoro',
  onboardingDone: false,
};

export const BREAK_KINDS: readonly HealthKind[] = ['eye', 'breath', 'posture', 'water'];

export { TONES };
export type { Tag, ToneId };

/**
 * One entry per schema version bump, e.g.
 *   2: (old) => ({ ...old, goals: { ...old.goals, newField: 0 } })
 */
const MIGRATIONS: Record<number, (old: Record<string, unknown>) => Record<string, unknown>> = {};

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const num = (v: unknown, fallback: number, min: number, max: number): number => {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  return Math.min(max, Math.max(min, n));
};

const int = (v: unknown, fallback: number, min: number, max: number): number =>
  Math.round(num(v, fallback, min, max));

const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback);

const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(v as T) ? (v as T) : fallback;

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function normalizeTags(v: unknown): Tag[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  const out: Tag[] = [];
  for (const raw of v) {
    if (!isRecord(raw)) continue;
    const id = typeof raw.id === 'string' && raw.id ? raw.id : null;
    const name = typeof raw.name === 'string' ? raw.name.trim().slice(0, 40) : '';
    if (!id || !name || seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      name,
      color: typeof raw.color === 'string' && HEX.test(raw.color) ? raw.color : '#7a8a99',
      ...(raw.archived === true ? { archived: true } : {}),
    });
    if (out.length >= 200) break;
  }
  return out;
}

function normalizeWorkDays(v: unknown): WorkHoursDay[] {
  const fallback = DEFAULT_SETTINGS.dnd.workHours.days;
  const arr = Array.isArray(v) ? v : [];
  return fallback.map((def, i) => {
    const raw = arr[i];
    if (!isRecord(raw)) return { ...def };
    const startMin = int(raw.startMin, def.startMin, 0, 1439);
    const endMin = int(raw.endMin, def.endMin, 0, 1440);
    return { enabled: bool(raw.enabled, def.enabled), startMin, endMin };
  });
}

function normalizeBreak(v: unknown, def: BreakConfig): BreakConfig {
  const raw = isRecord(v) ? v : {};
  return {
    enabled: bool(raw.enabled, def.enabled),
    everyMin: int(raw.everyMin, def.everyMin, 1, 720),
    durationSec: int(raw.durationSec, def.durationSec, 0, 1800),
  };
}

/** Turns partial or broken data into a `Settings` we can rely on. */
export function normalizeSettings(raw: unknown): Settings {
  const d = DEFAULT_SETTINGS;
  const r = isRecord(raw) ? raw : {};

  const t = isRecord(r.timer) ? r.timer : {};
  const b = isRecord(r.breaks) ? r.breaks : {};
  const dnd = isRecord(r.dnd) ? r.dnd : {};
  const g = isRecord(r.goals) ? r.goals : {};
  const a = isRecord(r.appearance) ? r.appearance : {};
  const s = isRecord(r.sound) ? r.sound : {};

  const breath = isRecord(b.breath) ? b.breath : {};
  const breathCustom = isRecord(breath.custom) ? breath.custom : {};
  const water = isRecord(b.water) ? b.water : {};
  const workHours = isRecord(dnd.workHours) ? dnd.workHours : {};
  const idle = isRecord(dnd.idle) ? dnd.idle : {};
  const meetings = isRecord(dnd.meetings) ? dnd.meetings : {};

  const muteUntil =
    typeof dnd.muteUntil === 'number' && Number.isFinite(dnd.muteUntil) ? dnd.muteUntil : null;

  const tags = normalizeTags(r.tags);
  const lastTagId =
    typeof r.lastTagId === 'string' && tags.some((tag) => tag.id === r.lastTagId)
      ? r.lastTagId
      : undefined;

  return {
    version: SETTINGS_VERSION,
    timer: {
      focusMin: int(t.focusMin, d.timer.focusMin, 1, 180),
      shortBreakMin: int(t.shortBreakMin, d.timer.shortBreakMin, 1, 180),
      longBreakMin: int(t.longBreakMin, d.timer.longBreakMin, 1, 180),
      longBreakEvery: int(t.longBreakEvery, d.timer.longBreakEvery, 2, 12),
      autoStartBreak: bool(t.autoStartBreak, d.timer.autoStartBreak),
      autoStartFocus: bool(t.autoStartFocus, d.timer.autoStartFocus),
      extendMin: int(t.extendMin, d.timer.extendMin, 1, 60),
      countdownDefaultMin: int(t.countdownDefaultMin, d.timer.countdownDefaultMin, 1, 180),
      stopwatchRemindEveryMin:
        t.stopwatchRemindEveryMin == null ? null : int(t.stopwatchRemindEveryMin, 50, 5, 240),
      flowtimeBreakRatio: num(t.flowtimeBreakRatio, d.timer.flowtimeBreakRatio, 0.05, 1),
      flowtimeMinBreakMin: int(t.flowtimeMinBreakMin, d.timer.flowtimeMinBreakMin, 1, 60),
      flowtimeMaxBreakMin: int(t.flowtimeMaxBreakMin, d.timer.flowtimeMaxBreakMin, 1, 120),
    },
    breaks: {
      eye: normalizeBreak(b.eye, d.breaks.eye),
      breath: {
        ...normalizeBreak(b.breath, d.breaks.breath),
        pattern: pick(breath.pattern, BREATH_PATTERNS, d.breaks.breath.pattern),
        custom: {
          inhaleSec: int(breathCustom.inhaleSec, d.breaks.breath.custom.inhaleSec, 1, 30),
          holdSec: int(breathCustom.holdSec, d.breaks.breath.custom.holdSec, 0, 30),
          exhaleSec: int(breathCustom.exhaleSec, d.breaks.breath.custom.exhaleSec, 1, 30),
          holdAfterSec: int(breathCustom.holdAfterSec, d.breaks.breath.custom.holdAfterSec, 0, 30),
        },
      },
      posture: normalizeBreak(b.posture, d.breaks.posture),
      water: {
        ...normalizeBreak(b.water, d.breaks.water),
        dailyGoalGlasses: int(water.dailyGoalGlasses, d.breaks.water.dailyGoalGlasses, 1, 30),
      },
      dontInterruptFocus: bool(b.dontInterruptFocus, d.breaks.dontInterruptFocus),
      presentation: pick(b.presentation, BREAK_PRESENTATIONS, d.breaks.presentation),
      strictMode: bool(b.strictMode, d.breaks.strictMode),
      snoozeMin: int(b.snoozeMin, d.breaks.snoozeMin, 1, 60),
      dailySnoozeLimit: int(b.dailySnoozeLimit, d.breaks.dailySnoozeLimit, 0, 20),
    },
    dnd: {
      workHours: {
        enabled: bool(workHours.enabled, d.dnd.workHours.enabled),
        days: normalizeWorkDays(workHours.days),
      },
      idle: {
        enabled: bool(idle.enabled, d.dnd.idle.enabled),
        afterMin: int(idle.afterMin, d.dnd.idle.afterMin, 1, 120),
        askToAddTime: bool(idle.askToAddTime, d.dnd.idle.askToAddTime),
      },
      meetings: {
        enabled: bool(meetings.enabled, d.dnd.meetings.enabled),
        domains: Array.isArray(meetings.domains)
          ? meetings.domains
              .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
              .map((x) => x.trim().toLowerCase())
              .slice(0, 50)
          : [...d.dnd.meetings.domains],
      },
      muteUntil,
    },
    goals: {
      dailyFocusMin: int(g.dailyFocusMin, d.goals.dailyFocusMin, 5, 1440),
      usePomodoroGoal: bool(g.usePomodoroGoal, d.goals.usePomodoroGoal),
      dailyPomodoroGoal: int(g.dailyPomodoroGoal, d.goals.dailyPomodoroGoal, 1, 40),
      countWeekends: bool(g.countWeekends, d.goals.countWeekends),
      weeklyReport: bool(g.weeklyReport, d.goals.weeklyReport),
    },
    appearance: {
      language: pick(a.language, ['auto', ...LANGUAGES], d.appearance.language),
      theme: pick(a.theme, THEMES, d.appearance.theme),
      accent: pick(a.accent, ACCENTS, d.appearance.accent),
      popupSize: pick(a.popupSize, POPUP_SIZES, d.appearance.popupSize),
      showBadge: bool(a.showBadge, d.appearance.showBadge),
      announceMinutes: bool(a.announceMinutes, d.appearance.announceMinutes),
    },
    sound: {
      enabled: bool(s.enabled, d.sound.enabled),
      volume: num(s.volume, d.sound.volume, 0, 1),
      tone: pick(s.tone, TONES, d.sound.tone),
    },
    tags,
    ...(lastTagId ? { lastTagId } : {}),
    lastMode: pick(r.lastMode, ['pomodoro', 'stopwatch', 'countdown', 'flowtime'], d.lastMode),
    onboardingDone: bool(r.onboardingDone, d.onboardingDone),
  };
}

/** Runs the raw stored value through the migrations, then normalises it. */
export function migrateSettings(raw: unknown): Settings {
  if (!isRecord(raw)) return normalizeSettings(undefined);

  let value: Record<string, unknown> = raw;
  let version = typeof value.version === 'number' ? value.version : 0;

  while (version < SETTINGS_VERSION) {
    const next = version + 1;
    const migrate = MIGRATIONS[next];
    if (migrate) value = migrate(value);
    version = next;
  }

  return normalizeSettings({ ...value, version: SETTINGS_VERSION });
}
