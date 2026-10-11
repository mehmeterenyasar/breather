import { browser } from 'wxt/browser';
import type { PlayRequest } from '@/audio/synth';
import type { MutePreset } from '@/core/dnd';
import type { TimerEvent, TimerState } from '@/core/timer';
import type { TodaySummary } from '@/storage/today-cache';

/**
 * The typed message bridge.
 *
 * Note what is missing: nothing here is used for reading. The popup reads
 * settings, timer state and today's totals straight from `storage` and watches
 * them for changes, so it paints immediately instead of waiting for a sleeping
 * service worker to wake up and answer.
 *
 * Messages are commands only, which keeps the authority to change state and set
 * alarms in exactly one place.
 */

export interface Protocol {
  /** Sends an event to the timer and gets the new state back. */
  'timer.dispatch': { data: TimerEvent; result: TimerState };
  /** Asks the worker to bring the state in line with the clock. */
  'timer.sync': { data: void; result: TimerState };

  'today.refresh': { data: void; result: TodaySummary };
  /** The popup never opens IndexedDB, so the worker does this write for it. */
  'session.review': {
    data: { sessionId: string; rating?: 1 | 2 | 3 | 4 | 5; note?: string };
    result: void;
  };

  'suggestion.clear': { data: void; result: void };
  /** Answered by the offscreen document, not the worker. Never sent on Firefox. */
  'audio.play': { data: PlayRequest; result: void };
  /** The preview button in settings. */
  'sound.preview': { data: void; result: void };
  /** How the break window was dismissed. */
  'break.resolve': { data: { outcome: 'taken' | 'skipped' | 'snoozed' }; result: void };
  /** Returns the moment the mute will expire. */
  'dnd.mute': { data: { preset: MutePreset }; result: number };
  'dnd.unmute': { data: void; result: void };
  /** Returns the day's new total. */
  'water.add': { data: void; result: number };

  'idle.resolve': { data: { add: boolean }; result: void };
}

export type MessageType = keyof Protocol;

type Envelope<K extends MessageType = MessageType> = {
  __breather: 1;
  type: K;
  data: Protocol[K]['data'];
};

type Reply<K extends MessageType> =
  { ok: true; result: Protocol[K]['result'] } | { ok: false; error: string };

export type Handlers = {
  [K in MessageType]?: (
    data: Protocol[K]['data'],
  ) => Protocol[K]['result'] | Promise<Protocol[K]['result']>;
};

function isEnvelope(value: unknown): value is Envelope {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { __breather?: unknown }).__breather === 1 &&
    typeof (value as { type?: unknown }).type === 'string'
  );
}

/**
 * Chrome MV3 won't accept a Promise returned from an `onMessage` listener, so
 * this calls `sendResponse` and returns `true` to keep the channel open.
 */
export function registerHandlers(handlers: Handlers): void {
  browser.runtime.onMessage.addListener(
    (message: unknown, _sender: unknown, sendResponse: (response?: unknown) => void) => {
      if (!isEnvelope(message)) return undefined;

      const handler = handlers[message.type] as
        ((data: unknown) => unknown | Promise<unknown>) | undefined;
      if (!handler) return undefined;

      void Promise.resolve()
        .then(() => handler(message.data))
        .then(
          (result) => sendResponse({ ok: true, result }),
          (error: unknown) => {
            console.error('[breather] failed to handle message', message.type, error);
            sendResponse({ ok: false, error: errorMessage(error) });
          },
        );

      return true;
    },
  );
}

export async function sendMessage<K extends MessageType>(
  type: K,
  data: Protocol[K]['data'],
): Promise<Protocol[K]['result']> {
  const envelope: Envelope<K> = { __breather: 1, type, data };
  const reply = (await browser.runtime.sendMessage(envelope)) as Reply<K> | undefined;

  if (!reply) throw new Error(`No reply for ${type}`);
  if (!reply.ok) throw new Error(reply.error);
  return reply.result;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
