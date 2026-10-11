import { i18n } from '@/i18n';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { BREATH_PRESETS, breathFrameAt, breathRounds } from '@/core/breath';
import type { BreathPattern } from '@/core/breath';
import { formatClock } from '@/core/time';
import type { HealthKind } from '@/core/types';
import { sendMessage } from '@/messaging';
import { useAnimationTime, usePrefersReducedMotion } from '@/hooks/useAnimationTime';
import { useLanguage } from '@/hooks/useLanguage';
import { useSettings, useTheme } from '@/hooks/useSettings';
import { readActiveBreak, watchActiveBreak } from '@/storage/health-state';
import type { ActiveBreak } from '@/storage/health-state';
import type { Settings } from '@/storage/schema';
import { BreathCircle } from '@/ui/BreathCircle';
import { ProgressRing } from '@/ui/ProgressRing';
import { StretchFigure } from '@/ui/StretchFigure';

/**
 * The break screen: the extension's own window, with nothing injected into any
 * page. One thing to look at, one sentence of instruction, three buttons.
 *
 * Breaks that were held back during a focus session arrive here together and
 * are shown one after another.
 */

/** How long Skip stays disabled in strict mode. */
const STRICT_LOCK_MS = 10_000;

type Stage = 'intro' | 'running' | 'done';

const TITLE_KEY = {
  eye: 'break.eye.title',
  breath: 'break.breath.title',
  posture: 'break.posture.title',
  water: 'break.water.title',
} as const satisfies Record<HealthKind, string>;

export function App() {
  const settings = useSettings();
  const [active, setActive] = useState<ActiveBreak | null>(null);
  const [loaded, setLoaded] = useState(false);

  useTheme(settings);
  useLanguage();

  useEffect(() => {
    let alive = true;
    void readActiveBreak().then((value) => {
      if (!alive) return;
      setActive(value);
      setLoaded(true);
    });

    const unwatch = watchActiveBreak((value) => setActive(value));
    return () => {
      alive = false;
      unwatch();
    };
  }, []);

  useEffect(() => {
    document.title = i18n.t('extName');
  }, []);

  if (!settings || !loaded) return <div class="break" aria-busy="true" />;
  if (!active) return <div class="break" />;

  return <BreakFlow key={active.id} active={active} settings={settings} />;
}

function BreakFlow({ active, settings }: { active: ActiveBreak; settings: Settings }) {
  const reducedMotion = usePrefersReducedMotion();
  const [index, setIndex] = useState(0);
  const [stage, setStage] = useState<Stage>('intro');
  const [startedAt, setStartedAt] = useState(0);
  const [openedAt] = useState(() => Date.now());

  const kind = active.kinds[index] ?? active.kinds[0]!;
  const config = settings.breaks[kind];
  const durationMs = Math.max(1, config.durationSec) * 1000;

  const now = useAnimationTime(stage === 'running', reducedMotion || kind !== 'breath');
  const elapsed = stage === 'running' ? Math.max(0, now - startedAt) : 0;
  const remaining = Math.max(0, durationMs - elapsed);

  // Long enough that skipping is a decision rather than a reflex.
  const skipLocked = settings.breaks.strictMode && now - openedAt < STRICT_LOCK_MS;

  useEffect(() => {
    if (stage !== 'running' || remaining > 0) return;

    const isLast = index >= active.kinds.length - 1;
    if (isLast) {
      setStage('done');
      return;
    }
    setIndex((value) => value + 1);
    setStage('intro');
  }, [stage, remaining, index, active.kinds.length]);

  useEffect(() => {
    if (stage !== 'done') return;
    const id = window.setTimeout(() => void resolve('taken'), 1200);
    return () => window.clearTimeout(id);
  }, [stage]);

  function begin() {
    setStartedAt(Date.now());
    setStage('running');
  }

  async function resolve(outcome: 'taken' | 'skipped' | 'snoozed') {
    try {
      await sendMessage('break.resolve', { outcome });
    } catch (error) {
      console.error('[breather] could not report the break outcome', error);
      window.close();
    }
  }

  if (stage === 'done') {
    return (
      <div class="break break--done" data-phase="shortBreak">
        <p class="break__title">{i18n.t('breakWindow.done')}</p>
      </div>
    );
  }

  return (
    <div class="break" data-phase="shortBreak">
      <header class="break__head">
        <h1 class="break__title">{i18n.t(TITLE_KEY[kind])}</h1>
        {active.kinds.length > 1 && (
          <span class="break__queue num">
            {index + 1} / {active.kinds.length}
          </span>
        )}
      </header>

      <div class="break__stage">
        {stage === 'intro' ? (
          <Preview kind={kind} active={active} settings={settings} />
        ) : (
          <Running
            kind={kind}
            active={active}
            settings={settings}
            elapsed={elapsed}
            remaining={remaining}
            durationMs={durationMs}
            reducedMotion={reducedMotion}
          />
        )}
      </div>

      <p class="break__instruction">{instructionFor(kind, active)}</p>

      <footer class="break__actions">
        {stage === 'intro' ? (
          <>
            <button type="button" class="btn btn--primary break__cta" onClick={begin}>
              {i18n.t('breakWindow.start')}
            </button>
            <button type="button" class="btn btn--ghost" onClick={() => void resolve('snoozed')}>
              {i18n.t('breakWindow.snooze', { minutes: String(settings.breaks.snoozeMin) })}
            </button>
            <button
              type="button"
              class="btn btn--ghost"
              disabled={skipLocked}
              title={skipLocked ? i18n.t('breakWindow.strictHint') : undefined}
              onClick={() => void resolve('skipped')}
            >
              {i18n.t('breakWindow.skip')}
            </button>
          </>
        ) : (
          <button
            type="button"
            class="btn btn--ghost break__cta"
            disabled={skipLocked}
            title={skipLocked ? i18n.t('breakWindow.strictHint') : undefined}
            onClick={() => void resolve('skipped')}
          >
            {i18n.t('breakWindow.skip')}
          </button>
        )}
      </footer>
    </div>
  );
}

function Preview({
  kind,
  active,
  settings,
}: {
  kind: HealthKind;
  active: ActiveBreak;
  settings: Settings;
}) {
  if (kind === 'posture' && active.stretch) {
    return <StretchFigure stretch={active.stretch} />;
  }

  const seconds = settings.breaks[kind].durationSec;
  return <span class="break__preview num">{formatClock(seconds * 1000)}</span>;
}

function Running(props: {
  kind: HealthKind;
  active: ActiveBreak;
  settings: Settings;
  elapsed: number;
  remaining: number;
  durationMs: number;
  reducedMotion: boolean;
}) {
  const { kind, active, settings, elapsed, remaining, durationMs, reducedMotion } = props;

  const pattern = useMemo(() => resolveBreathPattern(settings), [settings]);

  if (kind === 'breath') {
    const frame = breathFrameAt(pattern, elapsed, durationMs);
    return (
      <BreathCircle
        frame={frame}
        rounds={breathRounds(pattern, durationMs)}
        reducedMotion={reducedMotion}
      />
    );
  }

  if (kind === 'posture' && active.stretch) {
    return (
      <div class="break__stack">
        <StretchFigure stretch={active.stretch} />
        <span class="break__count num">{Math.ceil(remaining / 1000)}</span>
      </div>
    );
  }

  return (
    <ProgressRing
      progress={durationMs > 0 ? elapsed / durationMs : 0}
      size={196}
      label={i18n.t('a11y.progressRing')}
    >
      <span class="break__count num">{Math.ceil(remaining / 1000)}</span>
    </ProgressRing>
  );
}

function instructionFor(kind: HealthKind, active: ActiveBreak): string {
  switch (kind) {
    case 'eye':
      return i18n.t('break.eye.instruction');
    case 'breath':
      return i18n.t('break.breath.instruction');
    case 'water':
      return i18n.t('break.water.body');
    case 'posture':
      return active.stretch ? i18n.t(STRETCH_KEY[active.stretch]) : '';
  }
}

const STRETCH_KEY = {
  neck: 'stretch.neck',
  shoulders: 'stretch.shoulders',
  wrists: 'stretch.wrists',
  upperBack: 'stretch.upperBack',
  chest: 'stretch.chest',
  legs: 'stretch.legs',
} as const;

/** Turns the pattern chosen in settings into seconds per step. */
function resolveBreathPattern(settings: Settings): BreathPattern {
  const { pattern, custom } = settings.breaks.breath;

  if (pattern === 'custom') {
    return {
      inhaleSec: custom.inhaleSec,
      inhale2Sec: 0,
      holdSec: custom.holdSec,
      exhaleSec: custom.exhaleSec,
      holdAfterSec: custom.holdAfterSec,
    };
  }

  return BREATH_PRESETS[pattern];
}
