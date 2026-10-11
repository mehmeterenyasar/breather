import { browser } from 'wxt/browser';

/**
 * `setTimeout` and `setInterval` die with the service worker, so every deadline
 * in the extension goes through `chrome.alarms` instead. They are all set with
 * an absolute `when`; the badge refresh is the only periodic one.
 *
 * Chrome rounds delays under 30 seconds up in packed extensions. The shortest
 * phase the settings allow is a minute, so that never bites.
 */

export const ALARM = {
  /** End of a counted-down phase. */
  timerEnd: 'timer:end',
  /** Refreshes the badge minute. Only armed while running. */
  badgeTick: 'badge:tick',
  /** Stopwatch nudge. */
  stopwatchRemind: 'stopwatch:remind',
  /** Whichever health break is due first. */
  healthTick: 'health:tick',
  /** When quick mute expires. */
  muteEnd: 'mute:end',
  /** Monday morning summary. */
  weeklyReport: 'summary:weekly',
} as const;

export type AlarmName = (typeof ALARM)[keyof typeof ALARM];

/** Replaces any existing alarm of the same name. */
export async function armAt(name: AlarmName, when: number): Promise<void> {
  await browser.alarms.create(name, { when });
}

/** The one periodic alarm we use. */
export async function armEveryMinute(name: AlarmName, minutes = 1): Promise<void> {
  await browser.alarms.create(name, {
    periodInMinutes: minutes,
    when: Date.now() + minutes * 60_000,
  });
}

export async function clearAlarm(name: AlarmName): Promise<void> {
  await browser.alarms.clear(name);
}

export async function clearAlarms(...names: AlarmName[]): Promise<void> {
  await Promise.all(names.map((name) => browser.alarms.clear(name)));
}
