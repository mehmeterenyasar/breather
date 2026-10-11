import { i18n } from '@/i18n';
import { useEffect, useState } from 'preact/hooks';
import { phaseDurationMs } from '@/core/pomodoro';
import { muteRemainingMs } from '@/core/dnd';
import type { MutePreset } from '@/core/dnd';
import { clampDurationMin } from '@/core/presets';
import { MINUTE_MS, formatClock, minutesToMs } from '@/core/time';
import { isCountUp, snapshot } from '@/core/timer';
import type { TimerState } from '@/core/timer';
import type { Mode, Tag } from '@/core/types';
import { formatDurationShort, phaseLabel } from '@/format';
import { browser } from 'wxt/browser';
import { sendMessage } from '@/messaging';
import { useIdlePrompt, useNextBreakAt } from '@/hooks/useHealth';
import { useNow } from '@/hooks/useNow';
import { useLanguage } from '@/hooks/useLanguage';
import { useSettings, useTheme } from '@/hooks/useSettings';
import { useTimer, useTodaySummary } from '@/hooks/useTimer';
import { useUiQueue } from '@/hooks/useUiQueue';
import type { Settings } from '@/storage/schema';
import { updateSettings } from '@/storage/settings';
import { CountdownPresets } from '@/ui/CountdownPresets';
import { MuteControl } from '@/ui/MuteControl';
import { ModeTabs } from '@/ui/ModeTabs';
import { ProgressRing } from '@/ui/ProgressRing';
import { ReviewCard } from '@/ui/ReviewCard';
import { SuggestionCard } from '@/ui/SuggestionCard';
import { TagChips } from '@/ui/TagChips';

/**
 * The popup, which is only a view: it holds no countdown of its own, so closing
 * it loses nothing. Reads come from `storage`, commands go to the worker.
 */
export function App() {
  const settings = useSettings();
  const { state, ready, dispatch } = useTimer();
  const summary = useTodaySummary();
  const { review, suggestion, submitReview, dismissSuggestion } = useUiQueue();
  const { prompt: idlePrompt, resolve: resolveIdle } = useIdlePrompt();
  const nextBreakAt = useNextBreakAt(settings);
  // Always ticking, even when the timer is stopped: the mute countdown and the
  // next-break line need it.
  const now = useNow(true);

  useTheme(settings);
  useLanguage();

  useEffect(() => {
    document.title = i18n.t('extName');
  }, []);

  if (!settings || !ready) {
    return <div class="popup popup--loading" aria-busy="true" />;
  }

  return (
    <Timer
      settings={settings}
      state={state}
      now={now}
      summary={summary}
      dispatch={dispatch}
      nextBreakAt={nextBreakAt}
      idlePrompt={idlePrompt}
      resolveIdle={resolveIdle}
      review={review}
      suggestion={suggestion}
      submitReview={submitReview}
      dismissSuggestion={dismissSuggestion}
    />
  );
}

interface TimerProps {
  settings: Settings;
  state: TimerState;
  now: number;
  summary: ReturnType<typeof useTodaySummary>;
  dispatch: ReturnType<typeof useTimer>['dispatch'];
  nextBreakAt: number | undefined;
  idlePrompt: ReturnType<typeof useIdlePrompt>['prompt'];
  resolveIdle: ReturnType<typeof useIdlePrompt>['resolve'];
  review: ReturnType<typeof useUiQueue>['review'];
  suggestion: ReturnType<typeof useUiQueue>['suggestion'];
  submitReview: ReturnType<typeof useUiQueue>['submitReview'];
  dismissSuggestion: ReturnType<typeof useUiQueue>['dismissSuggestion'];
}

function Timer(props: TimerProps) {
  const { settings, state, now, summary, dispatch } = props;
  const todayFocusMs = summary?.focusMs ?? 0;
  const [countdownMin, setCountdownMin] = useState(settings.timer.countdownDefaultMin);

  const view = snapshot(state, settings.timer, now);
  const isIdle = state.status === 'idle';
  const mode = state.mode;

  const displayMs = isIdle ? idleDurationMs(mode, settings, countdownMin) : view.displayMs;
  const statusLabel =
    state.status === 'paused' ? i18n.t('phase.paused') : phaseLabel(isIdle ? 'idle' : state.phase);

  function start() {
    if (mode === 'countdown') {
      const minutes = clampDurationMin(countdownMin);
      void updateSettings({ timer: { countdownDefaultMin: minutes } });
      dispatch({ type: 'START', plannedMs: minutesToMs(minutes) });
      return;
    }
    dispatch({ type: 'TOGGLE' });
  }

  function selectMode(next: Mode) {
    dispatch({ type: 'SET_MODE', mode: next });
  }

  function createTag(tag: Tag) {
    void updateSettings((current) => ({ tags: [...current.tags, tag] }));
  }

  const ringSize = settings.appearance.popupSize === 'compact' ? 172 : 204;
  const remainingMinutes = Math.ceil(Math.max(0, displayMs) / MINUTE_MS);

  return (
    <div class="popup" data-phase={isIdle ? 'idle' : state.phase}>
      <ModeTabs mode={mode} locked={!isIdle} onSelect={selectMode} />

      <main class="popup__main">
        <span class="popup__status">{statusLabel}</span>

        <ProgressRing
          progress={isIdle ? 0 : view.progress}
          size={ringSize}
          label={i18n.t('a11y.progressRing')}
        >
          <span class="popup__time num">{formatClock(displayMs)}</span>
          {!isIdle && isCountUp(state) && (
            <span class="popup__mode">{i18n.t('popup.elapsed')}</span>
          )}
        </ProgressRing>

        <div class="popup__slot">
          {mode === 'pomodoro' && (
            <ol
              class="dots"
              aria-label={i18n.t('a11y.cycleDots', {
                current: String(view.dots.filter(Boolean).length),
                total: String(view.dots.length),
              })}
            >
              {view.dots.map((filled, index) => (
                <li key={index} class={filled ? 'dots__dot dots__dot--on' : 'dots__dot'} />
              ))}
            </ol>
          )}

          {mode === 'countdown' && isIdle && (
            <CountdownPresets selectedMin={countdownMin} onSelect={setCountdownMin} />
          )}

          {(mode === 'stopwatch' || mode === 'flowtime') && isIdle && (
            <p class="hint">
              {mode === 'flowtime' ? i18n.t('flowtime.hint') : i18n.t('stopwatch.hint')}
            </p>
          )}
        </div>
      </main>

      {props.suggestion && (
        <SuggestionCard
          ms={props.suggestion.ms}
          onAccept={() => {
            dispatch({ type: 'START', phase: 'shortBreak', plannedMs: props.suggestion?.ms });
            props.dismissSuggestion();
          }}
          onDismiss={props.dismissSuggestion}
        />
      )}

      {props.idlePrompt && (
        <section class="card">
          <span class="card__title">
            {i18n.t('idle.question', { duration: formatDurationShort(props.idlePrompt.ms) })}
          </span>
          <div class="card__row">
            <button
              type="button"
              class="btn btn--small btn--solid"
              onClick={() => props.resolveIdle(true)}
            >
              {i18n.t('idle.add')}
            </button>
            <button
              type="button"
              class="btn btn--small btn--quiet"
              onClick={() => props.resolveIdle(false)}
            >
              {i18n.t('idle.dismiss')}
            </button>
          </div>
        </section>
      )}

      {props.review && isIdle && !props.suggestion ? (
        <ReviewCard
          review={props.review}
          onSubmit={(input) =>
            props.submitReview({ sessionId: props.review?.sessionId ?? '', ...input })
          }
          onSkip={() => props.submitReview({ sessionId: props.review?.sessionId ?? '' })}
        />
      ) : (
        <TagChips
          tags={settings.tags}
          lastTagId={settings.lastTagId}
          selectedId={state.tagId}
          onSelect={(id) => dispatch({ type: 'SET_TAG', tagId: id })}
          onCreate={createTag}
        />
      )}

      <div class="controls">
        <button type="button" class="btn btn--primary" onClick={start}>
          {primaryLabel(state)}
        </button>

        {!isIdle && (
          <div class="controls__secondary" style={{ '--count': secondaryActions(state).length }}>
            {secondaryActions(state).map((action) => (
              <button
                key={action.key}
                type="button"
                class="btn btn--ghost"
                onClick={() => dispatch(action.event)}
              >
                {action.key === 'extend'
                  ? i18n.t('action.extend', { minutes: String(settings.timer.extendMin) })
                  : i18n.t(action.labelKey)}
              </button>
            ))}
          </div>
        )}
      </div>

      <footer class="strip">
        <div class="strip__row">
          <span class="strip__label">{i18n.t('popup.todayFocus')}</span>
          <span class="strip__value num">{formatDurationShort(todayFocusMs)}</span>
          <span class="strip__goal">{goalText(todayFocusMs, settings.goals.dailyFocusMin)}</span>
        </div>

        <div class="strip__row strip__row--tools">
          {props.nextBreakAt != null && (
            <span class="tool tool--static">
              {i18n.t('popup.nextBreak', {
                duration: formatDurationShort(Math.max(0, props.nextBreakAt - now)),
              })}
            </span>
          )}

          {settings.breaks.water.enabled && (
            <button
              type="button"
              class="tool"
              title={i18n.t('break.water.drank')}
              onClick={() => void sendMessage('water.add', undefined)}
            >
              {i18n.t('break.water.counter', {
                count: String(summary?.waterGlasses ?? 0),
                goal: String(settings.breaks.water.dailyGoalGlasses),
              })}
            </button>
          )}

          <span class="strip__spacer" />

          <MuteControl
            remainingMs={muteRemainingMs(settings.dnd.muteUntil, now)}
            onMute={(preset: MutePreset) => void sendMessage('dnd.mute', { preset })}
            onUnmute={() => void sendMessage('dnd.unmute', undefined)}
          />

          <span class="strip__icons">
            {canOpenSidePanel() && (
              <button
                type="button"
                class="tool tool--icon"
                title={i18n.t('popup.sidePanel')}
                aria-label={i18n.t('popup.sidePanel')}
                onClick={() => void openSidePanel()}
              >
                <PanelIcon />
              </button>
            )}

            <button
              type="button"
              class="tool tool--icon"
              title={i18n.t('popup.stats')}
              aria-label={i18n.t('popup.stats')}
              onClick={() => void openOptions('stats')}
            >
              <ChartIcon />
            </button>

            <button
              type="button"
              class="tool tool--icon"
              title={i18n.t('popup.settings')}
              aria-label={i18n.t('popup.settings')}
              onClick={() => void openOptions()}
            >
              <GearIcon />
            </button>
          </span>
        </div>
      </footer>

      {settings.appearance.announceMinutes && (
        <p class="sr-only" role="status" aria-live="polite">
          {i18n.t(isCountUp(state) && !isIdle ? 'a11y.elapsed' : 'a11y.remaining', {
            minutes: String(remainingMinutes),
          })}
        </p>
      )}
    </div>
  );
}

/**
 * `sidePanel` on Chromium, `sidebarAction` on Firefox. Both insist on a user
 * gesture, which the click that got us here provides.
 */
type SidePanelApi = { open: (options: { windowId?: number }) => Promise<void> };
type SidebarApi = { open: () => Promise<void> };

function sidePanelApi(): SidePanelApi | undefined {
  return (browser as unknown as { sidePanel?: SidePanelApi }).sidePanel;
}

function sidebarApi(): SidebarApi | undefined {
  return (browser as unknown as { sidebarAction?: SidebarApi }).sidebarAction;
}

function canOpenSidePanel(): boolean {
  return sidePanelApi() != null || sidebarApi() != null;
}

async function openSidePanel(): Promise<void> {
  try {
    const panel = sidePanelApi();
    if (panel) {
      const current = await browser.windows.getCurrent();
      await panel.open({ windowId: current.id });
    } else {
      await sidebarApi()?.open();
    }
    window.close();
  } catch (error) {
    console.warn('[breather] could not open the side panel', error);
  }
}

function PanelIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" fill="none">
      <rect x="3" y="4" width="18" height="16" rx="2.5" stroke="currentColor" stroke-width="1.8" />
      <path d="M15 4v16" stroke="currentColor" stroke-width="1.8" />
    </svg>
  );
}

/** Opens settings, optionally straight to one section. */
async function openOptions(section?: string): Promise<void> {
  const url = browser.runtime.getURL('/options.html') + (section ? `#/${section}` : '');
  await browser.tabs.create({ url });
  window.close();
}

function ChartIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" fill="none">
      <path
        d="M4 19v-7M10 19V6M16 19v-4M21 19H3"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
      />
    </svg>
  );
}

/**
 * Eight teeth and a hole in the middle. The first attempt was a circle with
 * spokes, which everyone read as a sun.
 */
function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
      <path
        fill="currentColor"
        fill-rule="evenodd"
        d="M19.14 12.94a7.07 7.07 0 0 0 0-1.88l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.03 7.03 0 0 0-1.62-.94l-.36-2.54a.5.5 0 0 0-.5-.42h-3.84a.5.5 0 0 0-.5.42l-.36 2.54c-.59.24-1.13.56-1.62.94l-2.39-.96a.5.5 0 0 0-.6.22L2.67 8.84a.5.5 0 0 0 .12.64l2.03 1.58a7.07 7.07 0 0 0 0 1.88l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32c.12.21.37.3.6.22l2.39-.96c.49.38 1.03.7 1.62.94l.36 2.54c.04.24.25.42.5.42h3.84c.25 0 .46-.18.5-.42l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.23.08.48-.01.6-.22l1.92-3.32a.5.5 0 0 0-.12-.64zM12 15.6A3.6 3.6 0 1 1 15.6 12 3.6 3.6 0 0 1 12 15.6"
      />
    </svg>
  );
}

/** While idle the ring shows the next session's length, never "00:00". */
function idleDurationMs(mode: Mode, settings: Settings, countdownMin: number): number {
  if (mode === 'countdown') return minutesToMs(countdownMin);
  if (mode === 'pomodoro') return phaseDurationMs(settings.timer, 'focus');
  return 0;
}

function primaryLabel(state: TimerState): string {
  if (state.status === 'running') return i18n.t('action.pause');
  if (state.status === 'paused') return i18n.t('action.resume');
  return i18n.t('action.start');
}

type TimerCommand = Parameters<ReturnType<typeof useTimer>['dispatch']>[0];

/**
 * "+X min" needs a substitution and the others don't, and the i18n types won't
 * let the two kinds of key mix. Hence the separate variant.
 */
type SecondaryAction =
  | { key: 'extend'; event: TimerCommand }
  | {
      key: 'reset' | 'skip' | 'finish';
      labelKey: 'action.reset' | 'action.skip' | 'action.finish';
      event: TimerCommand;
    };

/** "+X min" only means something while counting down; otherwise it's "Finish". */
function secondaryActions(state: TimerState): SecondaryAction[] {
  const reset: SecondaryAction = {
    key: 'reset',
    labelKey: 'action.reset',
    event: { type: 'RESET' },
  };
  const extend: SecondaryAction = { key: 'extend', event: { type: 'EXTEND' } };

  if (state.mode === 'pomodoro') {
    return [reset, { key: 'skip', labelKey: 'action.skip', event: { type: 'SKIP' } }, extend];
  }

  if (state.mode === 'countdown') {
    return [reset, extend, { key: 'finish', labelKey: 'action.finish', event: { type: 'FINISH' } }];
  }

  return [reset, { key: 'finish', labelKey: 'action.finish', event: { type: 'FINISH' } }];
}

function goalText(focusMs: number, dailyFocusMin: number): string {
  const remaining = dailyFocusMin - Math.floor(focusMs / MINUTE_MS);
  return remaining > 0
    ? i18n.t('popup.goalRemaining', { minutes: String(remaining) })
    : i18n.t('popup.goalReached');
}
