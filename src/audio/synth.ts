import { TONE_SPECS, toneDurationSec, transposeTone } from '@/core/tones';
import type { ToneId } from '@/core/tones';

/**
 * Synthesising the tones. Used by the offscreen document on Chrome and by the
 * background page on Firefox.
 *
 * A fresh AudioContext per tone, closed afterwards. Holding one open for the
 * life of the document costs resources for something that plays for a second
 * every twenty minutes.
 */

export interface PlayRequest {
  tone: ToneId;
  /** 0..1 */
  volume: number;
  /** Pitch multiplier; 1 leaves it alone. */
  transpose: number;
}

/** A ceiling even at volume 1. A notification shouldn't make you jump. */
const MASTER_CEILING = 0.7;

type AudioContextCtor = typeof AudioContext;

function getAudioContextCtor(): AudioContextCtor | undefined {
  const scope = globalThis as typeof globalThis & { webkitAudioContext?: AudioContextCtor };
  return scope.AudioContext ?? scope.webkitAudioContext;
}

/** False in a service worker, which has no Web Audio. */
export function canPlayAudioHere(): boolean {
  return getAudioContextCtor() != null;
}

export async function playTone(request: PlayRequest): Promise<void> {
  const Ctor = getAudioContextCtor();
  if (!Ctor) return;

  const spec = transposeTone(TONE_SPECS[request.tone], request.transpose);
  const volume = Math.min(1, Math.max(0, request.volume));
  if (volume === 0) return;

  const ctx = new Ctor();

  try {
    if (ctx.state === 'suspended') await ctx.resume();

    const master = ctx.createGain();
    master.gain.value = volume * MASTER_CEILING;
    master.connect(ctx.destination);

    const origin = ctx.currentTime + 0.02;

    for (const item of spec.notes) {
      const oscillator = ctx.createOscillator();
      const envelope = ctx.createGain();

      oscillator.type = item.wave;
      oscillator.frequency.value = item.freq;

      const start = origin + item.start;
      const end = start + item.duration;
      const attack = Math.min(0.02, item.duration / 4);

      // Ramp in and decay out, otherwise you hear a click at each end.
      envelope.gain.setValueAtTime(0.0001, start);
      envelope.gain.linearRampToValueAtTime(item.gain, start + attack);
      envelope.gain.exponentialRampToValueAtTime(0.0001, end);

      oscillator.connect(envelope);
      envelope.connect(master);
      oscillator.start(start);
      oscillator.stop(end + 0.02);
    }

    const totalMs = (toneDurationSec(spec) + 0.12) * 1000;
    await new Promise((resolve) => setTimeout(resolve, totalMs));
  } finally {
    await ctx.close().catch(() => undefined);
  }
}
