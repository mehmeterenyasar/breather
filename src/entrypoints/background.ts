import { defineBackground } from 'wxt/utils/define-background';
import { browser } from 'wxt/browser';
import { ALARM } from '@/bg/alarms';
import { handleMuteEnd, muteFor, restoreMuteAlarm, unmute } from '@/bg/dnd';
import {
  addWaterGlass,
  handleBreakWindowClosed,
  handleHealthTick,
  resolveBreak,
  scheduleHealth,
} from '@/bg/health-controller';
import { forgetBreakWindow } from '@/bg/break-window';
import { applyIdleDetection, handleIdleStateChange } from '@/bg/idle';
import {
  applySessionReview,
  bootstrapTimer,
  dismissBreakSuggestion,
  dispatchTimer,
  handleBadgeTick,
  handleStopwatchReminder,
  handleTimerEndAlarm,
  playSoundPreview,
  refreshTodaySummary,
  resolveIdlePrompt,
  syncTimer,
} from '@/bg/timer-controller';
import { handleWeeklyReport, scheduleWeeklyReport } from '@/bg/weekly-report';
import { registerHandlers } from '@/messaging';
import { readSettings, watchSettings } from '@/storage/settings';

/**
 * SERVICE WORKER (Chromium) / EVENT PAGE (Firefox).
 *
 * Wiring only, no logic. The worker can be stopped and started at any moment,
 * so `main()` runs again from the top on every wake and the first thing it does
 * is bring the state back in line with the clock.
 */
export default defineBackground({
  type: 'module',
  main() {
    registerHandlers({
      'timer.dispatch': (event) => dispatchTimer(event),
      'timer.sync': () => syncTimer(),
      'today.refresh': () => refreshTodaySummary(),
      'session.review': (input) => applySessionReview(input),
      'suggestion.clear': () => dismissBreakSuggestion(),
      'sound.preview': () => playSoundPreview(),
      'break.resolve': ({ outcome }) => resolveBreak(outcome),
      'dnd.mute': ({ preset }) => muteFor(preset),
      'dnd.unmute': () => unmute(),
      'water.add': () => addWaterGlass(),
      'idle.resolve': ({ add }) => resolveIdlePrompt(add),
    });

    browser.alarms.onAlarm.addListener((alarm) => {
      switch (alarm.name) {
        case ALARM.timerEnd:
          void handleTimerEndAlarm();
          break;
        case ALARM.badgeTick:
          void handleBadgeTick();
          break;
        case ALARM.stopwatchRemind:
          void handleStopwatchReminder();
          break;
        case ALARM.healthTick:
          void handleHealthTick();
          break;
        case ALARM.muteEnd:
          void handleMuteEnd();
          break;
        case ALARM.weeklyReport:
          void handleWeeklyReport();
          break;
        default:
          break;
      }
    });

    browser.commands.onCommand.addListener((command) => {
      switch (command) {
        case 'toggle-timer':
          void dispatchTimer({ type: 'TOGGLE' });
          break;
        case 'skip-phase':
          void dispatchTimer({ type: 'SKIP' });
          break;
        default:
          break;
      }
    });

    // Closing the break window by hand counts as skipping the break.
    browser.windows.onRemoved.addListener((windowId) => {
      void forgetBreakWindow(windowId).then((wasBreakWindow) => {
        if (wasBreakWindow) return handleBreakWindowClosed();
        return undefined;
      });
    });

    // A settings change can move a break's due time or the idle threshold.
    watchSettings(() => {
      void scheduleHealth();
      void applyIdleDetection();
      void scheduleWeeklyReport();
    });

    browser.idle.onStateChanged.addListener((state) => {
      void handleIdleStateChange(String(state));
    });

    browser.runtime.onInstalled.addListener((details) => {
      void boot();
      // Only on a fresh install; an update shouldn't reopen it.
      if (details.reason === 'install') void openWelcome();
    });

    // After a browser restart: either the phase ran out while we were gone, in
    // which case it is recorded at the right moment, or the alarm is re-armed.
    browser.runtime.onStartup.addListener(() => {
      void boot();
    });

    void boot();
  },
});

/** The welcome flow is just a route on the options page. */
async function openWelcome(): Promise<void> {
  try {
    await browser.tabs.create({ url: browser.runtime.getURL('/options.html#/welcome') });
  } catch (error) {
    console.warn('[breather] could not open the welcome page', error);
  }
}

async function boot(): Promise<void> {
  await bootstrapTimer();
  await scheduleHealth();
  await applyIdleDetection();
  await restoreMuteAlarm(await readSettings());
  await scheduleWeeklyReport();
}
