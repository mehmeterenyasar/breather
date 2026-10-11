import { i18n } from '@/i18n';
import { browser } from 'wxt/browser';
import { LANGUAGES } from '@/i18n';
import { applyLanguagePreference } from '@/i18n/init';
import type { LangPreference } from '@/i18n';
import { TONES } from '@/core/tones';
import { SHORTCUTS_URL } from '@/brand';
import { sendMessage } from '@/messaging';
import { ACCENTS, POPUP_SIZES, THEMES } from '@/storage/schema';
import type { AccentId, PopupSize, ThemeId, ToneId } from '@/storage/schema';
import { Group, NumberField, SelectField, Slider, Toggle } from '@/ui/form';
import type { PanelProps } from './types';

/** Goals, appearance, sound and about. */

const THEME_LABEL = {
  system: 'settings.appearance.themeSystem',
  light: 'settings.appearance.themeLight',
  dark: 'settings.appearance.themeDark',
} as const satisfies Record<ThemeId, string>;

const SIZE_LABEL = {
  compact: 'settings.appearance.popupCompact',
  normal: 'settings.appearance.popupNormal',
} as const satisfies Record<PopupSize, string>;

const ACCENT_LABEL = {
  sage: 'settings.accent.sage',
  indigo: 'settings.accent.indigo',
  plum: 'settings.accent.plum',
  clay: 'settings.accent.clay',
  ocean: 'settings.accent.ocean',
  graphite: 'settings.accent.graphite',
} as const satisfies Record<AccentId, string>;

/** The same in every catalog: each language is named in itself. */
const LANGUAGE_LABEL = {
  auto: 'language.auto',
  en: 'language.en',
  de: 'language.de',
  es: 'language.es',
  fr: 'language.fr',
  pt: 'language.pt',
  tr: 'language.tr',
} as const satisfies Record<LangPreference, string>;

const TONE_LABEL = {
  soft: 'sound.soft',
  chime: 'sound.chime',
  bell: 'sound.bell',
  glass: 'sound.glass',
  marimba: 'sound.marimba',
  pebble: 'sound.pebble',
  drop: 'sound.drop',
  rise: 'sound.rise',
  pulse: 'sound.pulse',
  woodblock: 'sound.woodblock',
} as const satisfies Record<ToneId, string>;

export function GoalSettings({ settings, write }: PanelProps) {
  const { goals } = settings;

  return (
    <Group>
      <Toggle
        label={i18n.t('settings.goals.usePomodoro')}
        checked={goals.usePomodoroGoal}
        onChange={(usePomodoroGoal) => write({ goals: { usePomodoroGoal } })}
      />

      {goals.usePomodoroGoal ? (
        <NumberField
          label={i18n.t('settings.goals.dailyPomodoro')}
          value={goals.dailyPomodoroGoal}
          min={1}
          max={40}
          onChange={(dailyPomodoroGoal) => write({ goals: { dailyPomodoroGoal } })}
        />
      ) : (
        <NumberField
          label={i18n.t('settings.goals.daily')}
          value={goals.dailyFocusMin}
          min={5}
          max={1440}
          step={15}
          suffix={i18n.t('common.minuteShort')}
          onChange={(dailyFocusMin) => write({ goals: { dailyFocusMin } })}
        />
      )}

      <Toggle
        label={i18n.t('settings.goals.countWeekends')}
        hint={i18n.t('settings.goals.countWeekendsHint')}
        checked={goals.countWeekends}
        onChange={(countWeekends) => write({ goals: { countWeekends } })}
      />

      <Toggle
        label={i18n.t('settings.goals.weeklyReport')}
        hint={i18n.t('settings.goals.weeklyReportHint')}
        checked={goals.weeklyReport}
        onChange={(weeklyReport) => write({ goals: { weeklyReport } })}
      />
    </Group>
  );
}

export function AppearanceSettings({ settings, write }: PanelProps) {
  const { appearance } = settings;

  return (
    <Group>
      <SelectField
        label={i18n.t('settings.appearance.language')}
        value={appearance.language}
        options={(['auto', ...LANGUAGES] as LangPreference[]).map((value) => ({
          value,
          label: i18n.t(LANGUAGE_LABEL[value]),
        }))}
        onChange={(language) => {
          // Load the catalog before writing the setting, so the repaint that
          // the change triggers already has the new strings.
          void applyLanguagePreference(language).then(() => write({ appearance: { language } }));
        }}
      />

      <SelectField
        label={i18n.t('settings.appearance.theme')}
        value={appearance.theme}
        options={THEMES.map((value) => ({ value, label: i18n.t(THEME_LABEL[value]) }))}
        onChange={(theme) => write({ appearance: { theme } })}
      />

      <div class="field-row">
        <span class="field-row__text">
          <span class="field-row__label">{i18n.t('settings.appearance.accent')}</span>
        </span>
        <span
          class="field-row__control swatches"
          role="radiogroup"
          aria-label={i18n.t('settings.appearance.accent')}
        >
          {ACCENTS.map((accent) => (
            <button
              key={accent}
              type="button"
              role="radio"
              aria-checked={appearance.accent === accent}
              aria-label={i18n.t(ACCENT_LABEL[accent])}
              title={i18n.t(ACCENT_LABEL[accent])}
              class={appearance.accent === accent ? 'swatch swatch--on' : 'swatch'}
              data-accent={accent}
              onClick={() => write({ appearance: { accent } })}
            />
          ))}
        </span>
      </div>

      <SelectField
        label={i18n.t('settings.appearance.popupSize')}
        value={appearance.popupSize}
        options={POPUP_SIZES.map((value) => ({ value, label: i18n.t(SIZE_LABEL[value]) }))}
        onChange={(popupSize) => write({ appearance: { popupSize } })}
      />

      <Toggle
        label={i18n.t('settings.appearance.badge')}
        checked={appearance.showBadge}
        onChange={(showBadge) => write({ appearance: { showBadge } })}
      />

      <Toggle
        label={i18n.t('settings.appearance.announce')}
        hint={i18n.t('settings.appearance.announceHint')}
        checked={appearance.announceMinutes}
        onChange={(announceMinutes) => write({ appearance: { announceMinutes } })}
      />
    </Group>
  );
}

export function SoundSettings({ settings, write }: PanelProps) {
  const { sound } = settings;

  return (
    <Group>
      <Toggle
        label={i18n.t('settings.sound.enabled')}
        checked={sound.enabled}
        onChange={(enabled) => write({ sound: { enabled } })}
      />

      {sound.enabled && (
        <>
          <Slider
            label={i18n.t('settings.sound.volume')}
            value={Math.round(sound.volume * 100)}
            min={0}
            max={100}
            step={5}
            format={(value) => `${value}%`}
            onChange={(value) => write({ sound: { volume: value / 100 } })}
          />

          <SelectField
            label={i18n.t('settings.sound.tone')}
            value={sound.tone}
            options={TONES.map((value) => ({ value, label: i18n.t(TONE_LABEL[value]) }))}
            onChange={(tone) => write({ sound: { tone } })}
          />

          <div class="row">
            <button
              type="button"
              class="btn btn--small"
              onClick={() => void sendMessage('sound.preview', undefined)}
            >
              {i18n.t('settings.sound.preview')}
            </button>
          </div>
        </>
      )}
    </Group>
  );
}

export function AboutPanel() {
  const manifest = browser.runtime.getManifest();
  const isFirefox = import.meta.env.BROWSER === 'firefox';

  return (
    <>
      <Group>
        <div class="field-row">
          <span class="field-row__text">
            <span class="field-row__label">{i18n.t('settings.about.version')}</span>
          </span>
          <span class="field-row__control num">{manifest.version}</span>
        </div>
      </Group>

      <Group title={i18n.t('settings.about.shortcuts')}>
        <p class="muted">{i18n.t('settings.about.shortcutsHint')}</p>
        <div class="row">
          <button
            type="button"
            class="btn btn--small"
            onClick={() =>
              void browser.tabs.create({
                url: isFirefox ? SHORTCUTS_URL.firefox : SHORTCUTS_URL.chromium,
              })
            }
          >
            {i18n.t('settings.about.shortcutsOpen')}
          </button>
        </div>
      </Group>

      <Group title={i18n.t('settings.about.privacy')}>
        <p class="muted">{i18n.t('settings.about.privacyBody')}</p>
      </Group>

      <Group title={i18n.t('settings.about.license')}>
        <p class="muted">{i18n.t('settings.about.licenseBody')}</p>
      </Group>
    </>
  );
}
