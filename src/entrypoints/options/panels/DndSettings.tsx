import { i18n } from '@/i18n';
import { useEffect, useState } from 'preact/hooks';
import { muteRemainingMs } from '@/core/dnd';
import { formatDurationShort } from '@/format';
import { hasTabsPermission, removeTabsPermission, requestTabsPermission } from '@/bg/meetings';
import { Advanced, Group, NumberField, Toggle } from '@/ui/form';
import type { PanelProps } from './types';

/**
 * This is where the `tabs` permission for meeting detection is requested, and it
 * has to be: `permissions.request` needs a user gesture, and the browser refuses
 * it outright from a service worker. Declining leaves the switch off with a line
 * explaining why.
 */

const DAY_LABEL = [
  'settings.days.sun',
  'settings.days.mon',
  'settings.days.tue',
  'settings.days.wed',
  'settings.days.thu',
  'settings.days.fri',
  'settings.days.sat',
] as const;

/** Monday first, where `getDay` puts Sunday. */
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

function InfoIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.7" />
      <path
        d="M12 11v5M12 7.6v.6"
        stroke="currentColor"
        stroke-width="1.9"
        stroke-linecap="round"
      />
    </svg>
  );
}

const toTime = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const fromTime = (value: string): number => {
  const [h, m] = value.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

export function DndSettings({ settings, write }: PanelProps) {
  const { dnd } = settings;
  const [permission, setPermission] = useState<boolean | null>(null);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    void hasTabsPermission().then(setPermission);
  }, []);

  async function toggleMeetings(enabled: boolean) {
    setDenied(false);

    if (!enabled) {
      write({ dnd: { meetings: { enabled: false } } });
      await removeTabsPermission();
      setPermission(false);
      return;
    }

    // Nothing may be awaited before this line. Chrome treats the gesture as
    // spent and refuses the request; it returns immediately if already granted.
    const granted = await requestTabsPermission();
    setPermission(granted);

    if (!granted) {
      setDenied(true);
      return;
    }

    write({ dnd: { meetings: { enabled: true } } });
  }

  const remaining = muteRemainingMs(dnd.muteUntil, Date.now());

  return (
    <>
      {remaining > 0 && (
        <p class="notice notice--ok">
          {i18n.t('settings.dnd.muted', { duration: formatDurationShort(remaining) })}
        </p>
      )}

      <Group title={i18n.t('settings.dnd.workHours')}>
        <Toggle
          label={i18n.t('settings.dnd.workHours')}
          hint={i18n.t('settings.dnd.workHoursHint')}
          checked={dnd.workHours.enabled}
          onChange={(enabled) => write({ dnd: { workHours: { enabled } } })}
        />

        {dnd.workHours.enabled && (
          <ul class="days">
            {DAY_ORDER.map((index) => {
              const day = dnd.workHours.days[index];
              if (!day) return null;

              const update = (changes: Partial<typeof day>) =>
                write((current) => ({
                  dnd: {
                    workHours: {
                      days: current.dnd.workHours.days.map((item, i) =>
                        i === index ? { ...item, ...changes } : item,
                      ),
                    },
                  },
                }));

              return (
                <li key={index} class={day.enabled ? 'days__row' : 'days__row days__row--off'}>
                  <label class="days__check">
                    <input
                      type="checkbox"
                      checked={day.enabled}
                      onChange={(event) => update({ enabled: event.currentTarget.checked })}
                    />
                    <span>{i18n.t(DAY_LABEL[index] ?? 'settings.days.mon')}</span>
                  </label>

                  <input
                    class="field num"
                    type="time"
                    value={toTime(day.startMin)}
                    disabled={!day.enabled}
                    aria-label={i18n.t('settings.dnd.workHours')}
                    onChange={(event) => update({ startMin: fromTime(event.currentTarget.value) })}
                  />
                  <span class="days__dash">–</span>
                  <input
                    class="field num"
                    type="time"
                    value={toTime(day.endMin)}
                    disabled={!day.enabled}
                    aria-label={i18n.t('settings.dnd.workHours')}
                    onChange={(event) => update({ endMin: fromTime(event.currentTarget.value) })}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </Group>

      <Group title={i18n.t('settings.dnd.idle')}>
        <Toggle
          label={i18n.t('settings.dnd.idle')}
          hint={i18n.t('settings.dnd.idleHint')}
          checked={dnd.idle.enabled}
          onChange={(enabled) => write({ dnd: { idle: { enabled } } })}
        />
        {dnd.idle.enabled && (
          <>
            <NumberField
              label={i18n.t('settings.dnd.idleAfter')}
              value={dnd.idle.afterMin}
              min={1}
              max={120}
              suffix={i18n.t('common.minuteShort')}
              onChange={(afterMin) => write({ dnd: { idle: { afterMin } } })}
            />
            <Toggle
              label={i18n.t('settings.dnd.idleAsk')}
              checked={dnd.idle.askToAddTime}
              onChange={(askToAddTime) => write({ dnd: { idle: { askToAddTime } } })}
            />
          </>
        )}
      </Group>

      <Group title={i18n.t('settings.dnd.meetings')}>
        <Toggle
          label={i18n.t('settings.dnd.meetingsToggle')}
          hint={i18n.t('settings.dnd.meetingsHint')}
          checked={dnd.meetings.enabled && permission !== false}
          onChange={(enabled) => void toggleMeetings(enabled)}
        />

        {!dnd.meetings.enabled && (
          <p class="sidenote">
            <InfoIcon />
            {i18n.t('settings.dnd.meetingsPermission')}
          </p>
        )}
        {denied && <p class="notice notice--error">{i18n.t('settings.dnd.meetingsDenied')}</p>}

        {dnd.meetings.enabled && (
          <Advanced label={i18n.t('settings.dnd.domains')}>
            <label class="field-row field-row--stack">
              <span class="field-row__text">
                <span class="field-row__label">{i18n.t('settings.dnd.domains')}</span>
                <span class="field-row__hint">{i18n.t('settings.dnd.domainsHint')}</span>
              </span>
              <textarea
                class="field field--area"
                rows={4}
                value={dnd.meetings.domains.join('\n')}
                onChange={(event) =>
                  write({
                    dnd: {
                      meetings: {
                        domains: event.currentTarget.value
                          .split('\n')
                          .map((line) => line.trim())
                          .filter(Boolean),
                      },
                    },
                  })
                }
              />
            </label>
          </Advanced>
        )}
      </Group>
    </>
  );
}
