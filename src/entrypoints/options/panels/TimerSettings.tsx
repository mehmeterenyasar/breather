import { i18n } from '@/i18n';
import { useState } from 'preact/hooks';
import { MAX_TAG_NAME, canAddTag, createTag, nextTagColor } from '@/core/tags';
import type { Settings } from '@/storage/schema';
import { Advanced, Group, NumberField, SelectField, Toggle } from '@/ui/form';
import type { PanelProps } from './types';

/**
 * Durations and auto-start at the top, since that is what people change. The
 * settings for the other modes sit under "Advanced", where most never look.
 */
export function TimerSettings({ settings, write }: PanelProps) {
  const { timer } = settings;

  const remindOptions = [
    { value: 'off', label: i18n.t('settings.timer.stopwatchRemindOff') },
    ...[20, 30, 45, 50, 60, 90].map((minutes) => ({
      value: String(minutes),
      label: `${minutes} ${i18n.t('common.minuteShort')}`,
    })),
  ];

  return (
    <>
      <Group>
        <NumberField
          label={i18n.t('settings.timer.focus')}
          value={timer.focusMin}
          min={1}
          max={180}
          suffix={i18n.t('common.minuteShort')}
          onChange={(focusMin) => write({ timer: { focusMin } })}
        />
        <NumberField
          label={i18n.t('settings.timer.shortBreak')}
          value={timer.shortBreakMin}
          min={1}
          max={180}
          suffix={i18n.t('common.minuteShort')}
          onChange={(shortBreakMin) => write({ timer: { shortBreakMin } })}
        />
        <NumberField
          label={i18n.t('settings.timer.longBreak')}
          value={timer.longBreakMin}
          min={1}
          max={180}
          suffix={i18n.t('common.minuteShort')}
          onChange={(longBreakMin) => write({ timer: { longBreakMin } })}
        />
        <NumberField
          label={i18n.t('settings.timer.longBreakEvery')}
          hint={i18n.t('settings.timer.longBreakEveryHint')}
          value={timer.longBreakEvery}
          min={2}
          max={12}
          onChange={(longBreakEvery) => write({ timer: { longBreakEvery } })}
        />
        <Toggle
          label={i18n.t('settings.timer.autoStartBreak')}
          checked={timer.autoStartBreak}
          onChange={(autoStartBreak) => write({ timer: { autoStartBreak } })}
        />
        <Toggle
          label={i18n.t('settings.timer.autoStartFocus')}
          checked={timer.autoStartFocus}
          onChange={(autoStartFocus) => write({ timer: { autoStartFocus } })}
        />
      </Group>

      <Advanced label={i18n.t('settings.advanced')}>
        <NumberField
          label={i18n.t('settings.timer.extend')}
          value={timer.extendMin}
          min={1}
          max={60}
          suffix={i18n.t('common.minuteShort')}
          onChange={(extendMin) => write({ timer: { extendMin } })}
        />
        <NumberField
          label={i18n.t('settings.timer.countdownDefault')}
          value={timer.countdownDefaultMin}
          min={1}
          max={180}
          suffix={i18n.t('common.minuteShort')}
          onChange={(countdownDefaultMin) => write({ timer: { countdownDefaultMin } })}
        />
        <SelectField
          label={i18n.t('settings.timer.stopwatchRemind')}
          hint={i18n.t('settings.timer.stopwatchRemindHint')}
          value={
            timer.stopwatchRemindEveryMin == null ? 'off' : String(timer.stopwatchRemindEveryMin)
          }
          options={remindOptions}
          onChange={(value) =>
            write({ timer: { stopwatchRemindEveryMin: value === 'off' ? null : Number(value) } })
          }
        />
        <NumberField
          label={i18n.t('settings.timer.flowtimeRatio')}
          hint={i18n.t('settings.timer.flowtimeRatioHint')}
          value={Math.round(timer.flowtimeBreakRatio * 100)}
          min={5}
          max={100}
          step={5}
          suffix="%"
          onChange={(percent) => write({ timer: { flowtimeBreakRatio: percent / 100 } })}
        />
        <NumberField
          label={i18n.t('settings.timer.flowtimeMin')}
          value={timer.flowtimeMinBreakMin}
          min={1}
          max={60}
          suffix={i18n.t('common.minuteShort')}
          onChange={(flowtimeMinBreakMin) => write({ timer: { flowtimeMinBreakMin } })}
        />
        <NumberField
          label={i18n.t('settings.timer.flowtimeMax')}
          value={timer.flowtimeMaxBreakMin}
          min={1}
          max={120}
          suffix={i18n.t('common.minuteShort')}
          onChange={(flowtimeMaxBreakMin) => write({ timer: { flowtimeMaxBreakMin } })}
        />
      </Advanced>

      <TagManager settings={settings} write={write} />
    </>
  );
}

/**
 * Archiving is the prominent action, not deleting. Delete a tag and its past
 * sessions turn up untagged in the statistics; archive it and the history stays
 * intact, the tag just stops being offered in the popup.
 */
function TagManager({ settings, write }: PanelProps) {
  const [name, setName] = useState('');

  function add(event: Event) {
    event.preventDefault();
    const tag = createTag(crypto.randomUUID(), name, nextTagColor(settings.tags));
    if (!tag) return;

    write((current) => ({ tags: [...current.tags, tag] }));
    setName('');
  }

  return (
    <Group title={i18n.t('settings.tags.title')}>
      {settings.tags.length === 0 ? (
        <p class="emptyline">{i18n.t('settings.tags.empty')}</p>
      ) : (
        <ul class="taglist">
          {settings.tags.map((tag) => (
            <li
              key={tag.id}
              class={tag.archived ? 'taglist__row taglist__row--off' : 'taglist__row'}
            >
              <span class="taglist__dot" style={{ background: tag.color }} aria-hidden="true" />

              <input
                class="taglist__name"
                type="text"
                value={tag.name}
                maxLength={MAX_TAG_NAME}
                aria-label={i18n.t('settings.tags.namePlaceholder')}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  write((current) => ({
                    tags: current.tags.map((item) =>
                      item.id === tag.id ? { ...item, name: value } : item,
                    ),
                  }));
                }}
              />

              {tag.archived && (
                <span class="taglist__badge">{i18n.t('settings.tags.archived')}</span>
              )}

              <span class="taglist__actions">
                <button
                  type="button"
                  class="iconbtn"
                  title={i18n.t(tag.archived ? 'settings.tags.unarchive' : 'settings.tags.archive')}
                  aria-label={i18n.t(
                    tag.archived ? 'settings.tags.unarchive' : 'settings.tags.archive',
                  )}
                  onClick={() =>
                    write((current) => ({
                      tags: current.tags.map((item) =>
                        item.id === tag.id ? { ...item, archived: !item.archived } : item,
                      ),
                    }))
                  }
                >
                  <ArchiveIcon restore={tag.archived === true} />
                </button>

                <button
                  type="button"
                  class="iconbtn iconbtn--danger"
                  title={i18n.t('settings.tags.delete')}
                  aria-label={i18n.t('settings.tags.delete')}
                  onClick={() => {
                    if (!window.confirm(i18n.t('settings.tags.deleteConfirm'))) return;
                    write((current) => ({
                      tags: current.tags.filter((item) => item.id !== tag.id),
                    }));
                  }}
                >
                  <TrashIcon />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {canAddTag(settings.tags) && (
        <form class="addrow" onSubmit={add}>
          <span
            class="addrow__swatch"
            style={{ background: nextTagColor(settings.tags) }}
            aria-hidden="true"
          />
          <input
            class="addrow__input"
            type="text"
            value={name}
            maxLength={MAX_TAG_NAME}
            placeholder={i18n.t('settings.tags.namePlaceholder')}
            aria-label={i18n.t('settings.tags.namePlaceholder')}
            onInput={(event) => setName(event.currentTarget.value)}
          />
          <button type="submit" class="btn btn--small btn--solid" disabled={!name.trim()}>
            {i18n.t('settings.tags.add')}
          </button>
        </form>
      )}
    </Group>
  );
}

function ArchiveIcon({ restore }: { restore: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" fill="none">
      <path
        d="M3 7h18v3H3zM5 10v9h14v-9"
        stroke="currentColor"
        stroke-width="1.7"
        stroke-linejoin="round"
      />
      <path
        d={restore ? 'M12 17v-4m0 0l-2 2m2-2l2 2' : 'M12 13v4m0 0l-2-2m2 2l2-2'}
        stroke="currentColor"
        stroke-width="1.7"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" fill="none">
      <path
        d="M4 7h16M10 4h4M9 7v12m6-12v12M6 7l1 14h10l1-14"
        stroke="currentColor"
        stroke-width="1.7"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
}

export type { Settings };
