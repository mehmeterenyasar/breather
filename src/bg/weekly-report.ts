import {
  isWorthReporting,
  lastFullWeek,
  nextWeeklyReportAt,
  weekBefore,
  weeklySummary,
} from '@/core/weekly';
import { aggregatesForRange } from '@/db/queries';
import { readSettings } from '@/storage/settings';
import { ALARM, armAt, clearAlarms } from './alarms';
import { canRemindNow } from './dnd';
import { notifyWeeklyReport } from './notify';

/**
 * One notification on Monday morning: last week's total and how it compares.
 * An empty week is never reported.
 */

/** Local hour to send it. */
const REPORT_HOUR = 9;

export async function scheduleWeeklyReport(now = Date.now()): Promise<void> {
  const settings = await readSettings();

  if (!settings.goals.weeklyReport) {
    await clearAlarms(ALARM.weeklyReport);
    return;
  }

  await armAt(ALARM.weeklyReport, nextWeeklyReportAt(now, REPORT_HOUR));
}

export async function handleWeeklyReport(): Promise<void> {
  const now = Date.now();
  const settings = await readSettings();

  // Arm next week before anything else can return early and break the chain.
  await scheduleWeeklyReport(now);

  if (!settings.goals.weeklyReport) return;
  if (!(await canRemindNow(settings, now))) return;

  const week = lastFullWeek(now);
  const previous = weekBefore(week);

  const [thisWeek, lastWeek] = await Promise.all([
    aggregatesForRange(week),
    aggregatesForRange(previous),
  ]);

  const summary = weeklySummary(thisWeek, lastWeek);
  if (!isWorthReporting(summary)) return;

  await notifyWeeklyReport(summary.focusMs, summary.deltaPercent);
}
