import { playTone } from '@/audio/synth';
import { registerHandlers } from '@/messaging';

/**
 * The offscreen document, Chromium only.
 *
 * It exists because a service worker has no Web Audio and playing a sound needs
 * a context with a DOM. It is opened to play a tone and closed again as soon as
 * the tone has finished; see src/bg/audio.ts.
 */
registerHandlers({
  'audio.play': (request) => playTone(request),
});
