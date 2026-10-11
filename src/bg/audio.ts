import { browser } from 'wxt/browser';
import { canPlayAudioHere, playTone } from '@/audio/synth';
import type { PlayRequest } from '@/audio/synth';
import { TONE_TRANSPOSE } from '@/core/tones';
import { sendMessage } from '@/messaging';
import type { Settings } from '@/storage/schema';

/**
 * Playing the notification tone.
 *
 * A service worker has no Web Audio, so on Chromium the tone goes through a
 * throwaway offscreen document that is closed as soon as it has finished.
 * Keeping it open would hold memory for nothing and invites questions during
 * store review.
 *
 * Firefox still gives MV3 extensions a background page with a DOM, so there it
 * just plays here.
 */

const OFFSCREEN_PATH = 'offscreen.html';
const JUSTIFICATION = 'Plays a short notification tone when a focus session or break ends.';

/** Constant at build time, so the Firefox bundle drops this branch entirely. */
const SUPPORTS_OFFSCREEN = import.meta.env.BROWSER !== 'firefox';

/** Keeps the document alive while overlapping requests are still playing. */
let activePlays = 0;
let creating: Promise<void> | null = null;

type OffscreenApi = {
  createDocument: (options: {
    url: string;
    reasons: string[];
    justification: string;
  }) => Promise<void>;
  closeDocument: () => Promise<void>;
};

function offscreenApi(): OffscreenApi | undefined {
  if (!SUPPORTS_OFFSCREEN) return undefined;
  return (browser as unknown as { offscreen?: OffscreenApi }).offscreen;
}

/**
 * If the API is missing or throws, assume there is no document. A failure to
 * play a sound must never be allowed to break the timer.
 */
async function hasOffscreenDocument(): Promise<boolean> {
  if (!SUPPORTS_OFFSCREEN) return false;

  const runtime = browser.runtime as unknown as {
    getContexts?: (filter: { contextTypes: string[] }) => Promise<unknown[]>;
  };
  if (typeof runtime.getContexts !== 'function') return false;

  try {
    const contexts = await runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
    return contexts.length > 0;
  } catch {
    return false;
  }
}

async function ensureOffscreenDocument(): Promise<boolean> {
  const api = offscreenApi();
  if (!api) return false;
  if (await hasOffscreenDocument()) return true;

  // Two concurrent requests should create one document, not two.
  creating ??= api
    .createDocument({
      url: OFFSCREEN_PATH,
      reasons: ['AUDIO_PLAYBACK'],
      justification: JUSTIFICATION,
    })
    .finally(() => {
      creating = null;
    });

  try {
    await creating;
    return true;
  } catch (error) {
    // Chrome can throw if it already exists, which is fine, we just use it.
    return hasOffscreenDocument().catch(() => {
      console.warn('[breather] could not create the offscreen document', error);
      return false;
    });
  }
}

async function closeOffscreenDocument(): Promise<void> {
  const api = offscreenApi();
  if (!api) return;
  if (!(await hasOffscreenDocument())) return;
  await api.closeDocument().catch(() => undefined);
}

/** Clears a document left behind by a previous worker. Never throws. */
export async function cleanupAudio(): Promise<void> {
  if (!SUPPORTS_OFFSCREEN || activePlays > 0) return;
  try {
    await closeOffscreenDocument();
  } catch (error) {
    console.warn('[breather] offscreen belge temizlenemedi', error);
  }
}

async function play(request: PlayRequest): Promise<void> {
  // Firefox: there is a DOM right here, no detour needed.
  if (!SUPPORTS_OFFSCREEN || canPlayAudioHere()) {
    await playTone(request);
    return;
  }

  activePlays += 1;
  try {
    if (!(await ensureOffscreenDocument())) return;
    await sendToOffscreen(request);
  } catch (error) {
    console.warn('[breather] could not play the tone', error);
  } finally {
    activePlays -= 1;
    if (activePlays === 0) await closeOffscreenDocument();
  }
}

/**
 * `createDocument` resolves once the document exists, but its module script may
 * still be loading, and the first message then lands on nobody. Hence the retry.
 */
async function sendToOffscreen(request: PlayRequest, attempts = 3): Promise<void> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      await sendMessage('audio.play', request);
      return;
    } catch (error) {
      if (attempt === attempts - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 60));
    }
  }
}

export async function playFocusEndSound(settings: Settings): Promise<void> {
  if (!settings.sound.enabled) return;
  await play({
    tone: settings.sound.tone,
    volume: settings.sound.volume,
    transpose: TONE_TRANSPOSE.focusEnd,
  });
}

/** Same tone, lower, so you can tell the two apart without looking. */
export async function playBreakEndSound(settings: Settings): Promise<void> {
  if (!settings.sound.enabled) return;
  await play({
    tone: settings.sound.tone,
    volume: settings.sound.volume,
    transpose: TONE_TRANSPOSE.breakEnd,
  });
}

/** For the "play" button in settings. */
export async function previewSound(settings: Settings): Promise<void> {
  await play({
    tone: settings.sound.tone,
    volume: settings.sound.volume,
    transpose: TONE_TRANSPOSE.focusEnd,
  });
}
