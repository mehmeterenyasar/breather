import { isMuted, muteUntilFor, remindersAllowed } from '@/core/dnd';
import type { MutePreset } from '@/core/dnd';
import { readSettings, updateSettings } from '@/storage/settings';
import type { Settings } from '@/storage/schema';
import { ALARM, armAt, clearAlarms } from './alarms';
import { isMeetingActive } from './meetings';

/**
 * Quick mute is a `muteUntil` timestamp rather than a countdown, so it expires
 * on its own whatever happens to the worker. The alarm exists only so the badge
 * and the popup notice promptly.
 */

export async function muteFor(preset: MutePreset): Promise<number> {
  const now = Date.now();
  const until = muteUntilFor(preset, now);

  await updateSettings({ dnd: { muteUntil: until } });
  await armAt(ALARM.muteEnd, until);
  return until;
}

export async function unmute(): Promise<void> {
  await updateSettings({ dnd: { muteUntil: null } });
  await clearAlarms(ALARM.muteEnd);
}

/** Clears the expired mute. */
export async function handleMuteEnd(): Promise<void> {
  const settings = await readSettings();
  if (!isMuted(settings.dnd.muteUntil, Date.now())) {
    await updateSettings({ dnd: { muteUntil: null } });
  }
}

/** On startup: re-arm if the mute is still live, drop it if it isn't. */
export async function restoreMuteAlarm(settings: Settings): Promise<void> {
  const until = settings.dnd.muteUntil;
  if (until != null && until > Date.now()) {
    await armAt(ALARM.muteEnd, until);
  } else if (until != null) {
    await updateSettings({ dnd: { muteUntil: null } });
  }
}

/**
 * The meeting check comes last because it needs the `tabs` permission, and
 * there is no point asking the browser anything if the other gates are shut.
 */
export async function canRemindNow(settings: Settings, now: number): Promise<boolean> {
  if (
    !remindersAllowed(
      {
        muteUntil: settings.dnd.muteUntil,
        workHours: settings.dnd.workHours,
        meetingActive: false,
      },
      now,
    )
  ) {
    return false;
  }
  return !(await isMeetingActive(settings));
}
