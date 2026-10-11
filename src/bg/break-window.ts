import { browser } from 'wxt/browser';
import { storage } from 'wxt/utils/storage';

/**
 * The break screen opens as the extension's own window rather than being
 * injected into whatever page you happen to be on. That is what lets the
 * extension ship with no host permissions at all.
 *
 * Only one can be open at a time. Its id lives in local storage because the
 * worker may well have been suspended between opening and closing it.
 */

const WINDOW_ID_KEY = 'local:breakWindowId' as const;

/** Absolute, since a relative path resolves differently depending on caller. */
const page = () => browser.runtime.getURL('/break.html');

const SMALL = { width: 460, height: 520 };

async function storedWindowId(): Promise<number | null> {
  return (await storage.getItem<number>(WINDOW_ID_KEY)) ?? null;
}

async function windowExists(id: number): Promise<boolean> {
  try {
    await browser.windows.get(id);
    return true;
  } catch {
    return false;
  }
}

/** Raises the existing window if there is one. */
async function focusExisting(): Promise<boolean> {
  const id = await storedWindowId();
  if (id == null) return false;

  if (!(await windowExists(id))) {
    await storage.removeItem(WINDOW_ID_KEY);
    return false;
  }

  try {
    await browser.windows.update(id, { focused: true, drawAttention: true });
    return true;
  } catch {
    return false;
  }
}

export async function openBreakWindow(fullscreen: boolean): Promise<void> {
  if (await focusExisting()) return;

  try {
    // Centre on the current window so it lands on the monitor being used.
    const current = await browser.windows.getLastFocused().catch(() => null);

    const options: Parameters<typeof browser.windows.create>[0] = fullscreen
      ? { url: page(), type: 'popup', state: 'fullscreen', focused: true }
      : {
          url: page(),
          type: 'popup',
          focused: true,
          width: SMALL.width,
          height: SMALL.height,
          ...centerIn(current),
        };

    const created = await browser.windows.create(options);
    if (created?.id != null) await storage.setItem(WINDOW_ID_KEY, created.id);
  } catch (error) {
    console.warn('[breather] could not open the break window', error);
  }
}

function centerIn(
  reference: { left?: number; top?: number; width?: number; height?: number } | null,
): { left: number; top: number } | Record<string, never> {
  if (!reference?.width || !reference.height) return {};

  const left = Math.round((reference.left ?? 0) + (reference.width - SMALL.width) / 2);
  const top = Math.round((reference.top ?? 0) + (reference.height - SMALL.height) / 2);
  return { left: Math.max(0, left), top: Math.max(0, top) };
}

export async function closeBreakWindow(): Promise<void> {
  const id = await storedWindowId();
  await storage.removeItem(WINDOW_ID_KEY);
  if (id == null) return;

  try {
    await browser.windows.remove(id);
  } catch {
    // Already closed by hand, most likely.
  }
}

/** Forget the stored id when the user closes the window themselves. */
export async function forgetBreakWindow(closedId: number): Promise<boolean> {
  const id = await storedWindowId();
  if (id !== closedId) return false;

  await storage.removeItem(WINDOW_ID_KEY);
  return true;
}
