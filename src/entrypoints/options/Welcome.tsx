import { i18n } from '@/i18n';
import { useState } from 'preact/hooks';
import type { HealthKind } from '@/core/types';
import type { Settings } from '@/storage/schema';
import type { DeepPartial } from '@/storage/settings';

/**
 * First install: three short steps, none of them required. The point is to get
 * to the first session in one click, not to tour the settings.
 */

const TOTAL_STEPS = 3;

const KIND_LABEL = {
  eye: 'break.eye.title',
  breath: 'break.breath.title',
  posture: 'break.posture.title',
  water: 'break.water.title',
} as const satisfies Record<HealthKind, string>;

const KINDS: HealthKind[] = ['eye', 'breath', 'posture', 'water'];

const KIND_HINT = {
  eye: 'break.eye.instruction',
  breath: 'break.breath.instruction',
  posture: 'welcome.breaks.postureHint',
  water: 'break.water.body',
} as const satisfies Record<HealthKind, string>;

type Style = 'pomodoro' | 'stopwatch' | 'breaksOnly';

interface Props {
  settings: Settings;
  write: (patch: DeepPartial<Settings>) => void;
  onFinish: () => void;
}

export function Welcome({ settings, write, onFinish }: Props) {
  const [step, setStep] = useState(1);

  function chooseStyle(style: Style) {
    // Just the starting mode; the durations keep their defaults.
    write({ lastMode: style === 'pomodoro' ? 'pomodoro' : 'stopwatch' });

    if (style === 'breaksOnly') {
      // With no timer in use there is no focus session to defer breaks to.
      write({ breaks: { dontInterruptFocus: false } });
    }

    setStep(2);
  }

  return (
    <div class="welcome">
      <header class="welcome__head">
        <span class="welcome__step num">
          {i18n.t('welcome.step', {
            current: String(Math.min(step, TOTAL_STEPS)),
            total: String(TOTAL_STEPS),
          })}
        </span>
        <div class="welcome__bar" role="presentation">
          <div
            class="welcome__bar-fill"
            style={{ width: `${(step / (TOTAL_STEPS + 1)) * 100}%` }}
          />
        </div>
      </header>

      {step === 1 && (
        <section class="welcome__body">
          <h1 class="welcome__title">{i18n.t('welcome.how.title')}</h1>
          <p class="welcome__text">{i18n.t('welcome.how.body')}</p>

          <div class="choices">
            <Choice
              title={i18n.t('welcome.how.pomodoro')}
              hint={i18n.t('welcome.how.pomodoroHint')}
              onClick={() => chooseStyle('pomodoro')}
            />
            <Choice
              title={i18n.t('welcome.how.stopwatch')}
              hint={i18n.t('welcome.how.stopwatchHint')}
              onClick={() => chooseStyle('stopwatch')}
            />
            <Choice
              title={i18n.t('welcome.how.breaksOnly')}
              hint={i18n.t('welcome.how.breaksOnlyHint')}
              onClick={() => chooseStyle('breaksOnly')}
            />
          </div>
        </section>
      )}

      {step === 2 && (
        <section class="welcome__body">
          <h1 class="welcome__title">{i18n.t('welcome.breaks.title')}</h1>
          <p class="welcome__text">{i18n.t('welcome.breaks.body')}</p>

          <ul class="checks">
            {KINDS.map((kind) => (
              <li key={kind}>
                <CheckCard
                  label={i18n.t(KIND_LABEL[kind])}
                  hint={i18n.t(KIND_HINT[kind])}
                  checked={settings.breaks[kind].enabled}
                  onChange={(enabled) => write({ breaks: { [kind]: { enabled } } })}
                />
              </li>
            ))}
          </ul>

          <Footer onBack={() => setStep(1)} onNext={() => setStep(3)} />
        </section>
      )}

      {step === 3 && (
        <section class="welcome__body">
          <h1 class="welcome__title">{i18n.t('welcome.hours.title')}</h1>
          <p class="welcome__text">{i18n.t('welcome.hours.body')}</p>

          <CheckCard
            label={i18n.t('welcome.hours.enable')}
            hint={i18n.t('settings.dnd.workHoursHint')}
            checked={settings.dnd.workHours.enabled}
            onChange={(enabled) => write({ dnd: { workHours: { enabled } } })}
          />

          <Footer onBack={() => setStep(2)} onNext={() => setStep(4)} skippable />
        </section>
      )}

      {step >= 4 && (
        <section class="welcome__body">
          <h1 class="welcome__title">{i18n.t('welcome.done.title')}</h1>
          <p class="welcome__text">{i18n.t('welcome.done.body')}</p>
          <p class="welcome__hint">{i18n.t('welcome.done.pinHint')}</p>

          <div class="row">
            <button type="button" class="btn btn--small btn--solid" onClick={onFinish}>
              {i18n.t('welcome.done.finish')}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

/** The whole row is clickable, and the state reads as a coloured box. */
function CheckCard({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      class={checked ? 'checkcard checkcard--on' : 'checkcard'}
      onClick={() => onChange(!checked)}
    >
      <span class="checkcard__box" aria-hidden="true">
        <svg viewBox="0 0 16 16" width="12" height="12" fill="none">
          <path
            d="M3.5 8.5l3 3 6-7"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </span>
      <span class="checkcard__text">
        <span class="checkcard__label">{label}</span>
        <span class="checkcard__hint">{hint}</span>
      </span>
    </button>
  );
}

function Choice({ title, hint, onClick }: { title: string; hint: string; onClick: () => void }) {
  return (
    <button type="button" class="choice" onClick={onClick}>
      <span class="choice__title">{title}</span>
      <span class="choice__hint">{hint}</span>
    </button>
  );
}

function Footer({
  onBack,
  onNext,
  skippable,
}: {
  onBack: () => void;
  onNext: () => void;
  skippable?: boolean;
}) {
  return (
    <div class="welcome__foot">
      <button type="button" class="linkbtn" onClick={onBack}>
        {i18n.t('common.back')}
      </button>
      <button type="button" class="btn btn--small btn--solid" onClick={onNext}>
        {i18n.t(skippable ? 'common.skip' : 'common.next')}
      </button>
    </div>
  );
}
