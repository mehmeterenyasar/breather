import { i18n } from '@/i18n';
import { BREATH_PATTERNS, BREAK_PRESENTATIONS } from '@/storage/schema';
import type { BreakPresentation, BreathPatternId } from '@/storage/schema';
import type { HealthKind } from '@/core/types';
import { Advanced, Group, NumberField, SelectField, Toggle } from '@/ui/form';
import type { PanelProps } from './types';

/**
 * A group per break: the switch first, then the interval and the length. The
 * details of a break that is switched off are hidden rather than greyed out.
 */

const KIND_TITLE = {
  eye: 'break.eye.title',
  breath: 'break.breath.title',
  posture: 'break.posture.title',
  water: 'break.water.title',
} as const satisfies Record<HealthKind, string>;

const PATTERN_LABEL = {
  box: 'settings.breaks.patternBox',
  fourSevenEight: 'settings.breaks.patternFourSevenEight',
  coherent: 'settings.breaks.patternCoherent',
  sigh: 'settings.breaks.patternSigh',
  custom: 'settings.breaks.patternCustom',
} as const satisfies Record<BreathPatternId, string>;

const PRESENTATION_LABEL = {
  notification: 'settings.breaks.presentationNotification',
  window: 'settings.breaks.presentationWindow',
  fullscreen: 'settings.breaks.presentationFullscreen',
} as const satisfies Record<BreakPresentation, string>;

export function BreakSettings({ settings, write }: PanelProps) {
  const { breaks } = settings;
  const minute = i18n.t('common.minuteShort');
  const second = i18n.t('common.secondShort');

  return (
    <>
      <Group title={i18n.t(KIND_TITLE.eye)}>
        <Toggle
          label={i18n.t('common.on')}
          checked={breaks.eye.enabled}
          onChange={(enabled) => write({ breaks: { eye: { enabled } } })}
        />
        {breaks.eye.enabled && (
          <>
            <NumberField
              label={i18n.t('settings.breaks.every')}
              value={breaks.eye.everyMin}
              min={1}
              max={720}
              suffix={minute}
              onChange={(everyMin) => write({ breaks: { eye: { everyMin } } })}
            />
            <NumberField
              label={i18n.t('settings.breaks.duration')}
              value={breaks.eye.durationSec}
              min={5}
              max={300}
              step={5}
              suffix={second}
              onChange={(durationSec) => write({ breaks: { eye: { durationSec } } })}
            />
          </>
        )}
      </Group>

      <Group title={i18n.t(KIND_TITLE.breath)}>
        <Toggle
          label={i18n.t('common.on')}
          checked={breaks.breath.enabled}
          onChange={(enabled) => write({ breaks: { breath: { enabled } } })}
        />
        {breaks.breath.enabled && (
          <>
            <NumberField
              label={i18n.t('settings.breaks.every')}
              value={breaks.breath.everyMin}
              min={1}
              max={720}
              suffix={minute}
              onChange={(everyMin) => write({ breaks: { breath: { everyMin } } })}
            />
            <NumberField
              label={i18n.t('settings.breaks.duration')}
              value={breaks.breath.durationSec}
              min={15}
              max={600}
              step={15}
              suffix={second}
              onChange={(durationSec) => write({ breaks: { breath: { durationSec } } })}
            />
            <SelectField
              label={i18n.t('settings.breaks.pattern')}
              value={breaks.breath.pattern}
              options={BREATH_PATTERNS.map((pattern) => ({
                value: pattern,
                label: i18n.t(PATTERN_LABEL[pattern]),
              }))}
              onChange={(pattern) => write({ breaks: { breath: { pattern } } })}
            />

            {breaks.breath.pattern === 'custom' && (
              <div class="custombreath">
                {(
                  [
                    ['inhaleSec', 'settings.breaks.customInhale', 1],
                    ['holdSec', 'settings.breaks.customHold', 0],
                    ['exhaleSec', 'settings.breaks.customExhale', 1],
                    ['holdAfterSec', 'settings.breaks.customHoldAfter', 0],
                  ] as const
                ).map(([key, label, min]) => (
                  <label key={key} class="custombreath__field">
                    <span>{i18n.t(label)}</span>
                    <input
                      class="field num"
                      type="number"
                      min={min}
                      max={30}
                      value={breaks.breath.custom[key]}
                      onChange={(event) =>
                        write({
                          breaks: {
                            breath: { custom: { [key]: Number(event.currentTarget.value) } },
                          },
                        })
                      }
                    />
                  </label>
                ))}
              </div>
            )}
          </>
        )}
      </Group>

      <Group title={i18n.t(KIND_TITLE.posture)}>
        <Toggle
          label={i18n.t('common.on')}
          checked={breaks.posture.enabled}
          onChange={(enabled) => write({ breaks: { posture: { enabled } } })}
        />
        {breaks.posture.enabled && (
          <>
            <NumberField
              label={i18n.t('settings.breaks.every')}
              value={breaks.posture.everyMin}
              min={1}
              max={720}
              suffix={minute}
              onChange={(everyMin) => write({ breaks: { posture: { everyMin } } })}
            />
            <NumberField
              label={i18n.t('settings.breaks.duration')}
              value={breaks.posture.durationSec}
              min={10}
              max={600}
              step={5}
              suffix={second}
              onChange={(durationSec) => write({ breaks: { posture: { durationSec } } })}
            />
          </>
        )}
      </Group>

      <Group title={i18n.t(KIND_TITLE.water)}>
        <Toggle
          label={i18n.t('common.on')}
          checked={breaks.water.enabled}
          onChange={(enabled) => write({ breaks: { water: { enabled } } })}
        />
        {breaks.water.enabled && (
          <>
            <NumberField
              label={i18n.t('settings.breaks.every')}
              value={breaks.water.everyMin}
              min={1}
              max={720}
              suffix={minute}
              onChange={(everyMin) => write({ breaks: { water: { everyMin } } })}
            />
            <NumberField
              label={i18n.t('settings.breaks.waterGoal')}
              value={breaks.water.dailyGoalGlasses}
              min={1}
              max={30}
              suffix={i18n.t('settings.breaks.waterGoalUnit')}
              onChange={(dailyGoalGlasses) => write({ breaks: { water: { dailyGoalGlasses } } })}
            />
          </>
        )}
      </Group>

      <Group>
        <SelectField
          label={i18n.t('settings.breaks.presentation')}
          value={breaks.presentation}
          options={BREAK_PRESENTATIONS.map((value) => ({
            value,
            label: i18n.t(PRESENTATION_LABEL[value]),
          }))}
          onChange={(presentation) => write({ breaks: { presentation } })}
        />
        <Toggle
          label={i18n.t('settings.breaks.dontInterrupt')}
          hint={i18n.t('settings.breaks.dontInterruptHint')}
          checked={breaks.dontInterruptFocus}
          onChange={(dontInterruptFocus) => write({ breaks: { dontInterruptFocus } })}
        />
      </Group>

      <Advanced label={i18n.t('settings.advanced')}>
        <Toggle
          label={i18n.t('settings.breaks.strict')}
          hint={i18n.t('settings.breaks.strictHint')}
          checked={breaks.strictMode}
          onChange={(strictMode) => write({ breaks: { strictMode } })}
        />
        <NumberField
          label={i18n.t('settings.breaks.snooze')}
          value={breaks.snoozeMin}
          min={1}
          max={60}
          suffix={minute}
          onChange={(snoozeMin) => write({ breaks: { snoozeMin } })}
        />
        <NumberField
          label={i18n.t('settings.breaks.snoozeLimit')}
          hint={i18n.t('settings.breaks.snoozeLimitHint')}
          value={breaks.dailySnoozeLimit}
          min={0}
          max={20}
          onChange={(dailySnoozeLimit) => write({ breaks: { dailySnoozeLimit } })}
        />
      </Advanced>
    </>
  );
}
