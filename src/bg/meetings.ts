import { browser } from 'wxt/browser';
import { isMeetingUrl } from '@/core/dnd';
import type { Settings } from '@/storage/schema';

/**
 * Meeting detection, which is the only reason this extension ever asks for
 * `tabs`, and only if the user switches the feature on. While it is off the
 * permission is never requested and no tab is ever queried.
 */

/** Fresh object each call; the browser types want a mutable array. */
const tabsPermission = () =>
  ({ permissions: ['tabs'] }) as Parameters<typeof browser.permissions.contains>[0];

export async function hasTabsPermission(): Promise<boolean> {
  try {
    return (await browser.permissions.contains(tabsPermission())) === true;
  } catch {
    return false;
  }
}

/**
 * Must be called straight from a user gesture. An `await` before this and
 * Chrome drops the gesture and refuses the request, which cost me an afternoon.
 */
export async function requestTabsPermission(): Promise<boolean> {
  try {
    return (await browser.permissions.request(tabsPermission())) === true;
  } catch (error) {
    console.warn('[breather] tabs izni istenemedi', error);
    return false;
  }
}

export async function removeTabsPermission(): Promise<void> {
  try {
    await browser.permissions.remove(tabsPermission());
  } catch {
    // nothing useful to do about it
  }
}

/** `false` whenever the feature is off or unpermitted, so reminders carry on. */
export async function isMeetingActive(settings: Settings): Promise<boolean> {
  if (!settings.dnd.meetings.enabled) return false;
  if (!(await hasTabsPermission())) return false;

  try {
    const tabs = await browser.tabs.query({ active: true });
    return tabs.some((tab) => {
      const url = tab.url;
      if (!url) return false;
      // Only the active tab counts; a call sitting in a background tab isn't a call.
      return isMeetingUrl(url, settings.dnd.meetings.domains);
    });
  } catch {
    return false;
  }
}
