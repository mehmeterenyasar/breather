import { storage } from 'wxt/utils/storage';
import { HOUR_MS, MINUTE_MS } from '@/core/time';
import type { Mode } from '@/core/types';

/**
 * Things the popup needs to show but wasn't open to receive.
 *
 * When a session ends the popup is usually shut, so the rating question and the
 * Flowtime break suggestion are parked here until it opens. Both expire: being
 * asked to rate yesterday's session is just noise.
 */

const REVIEW_KEY = 'local:pendingReview' as const;
const SUGGESTION_KEY = 'local:breakSuggestion' as const;
const IDLE_KEY = 'local:idlePrompt' as const;

export const REVIEW_TTL_MS = 8 * HOUR_MS;
/** A break suggestion nobody acted on half an hour ago is pointless. */
export const SUGGESTION_TTL_MS = 30 * MINUTE_MS;

export const IDLE_PROMPT_TTL_MS = 15 * MINUTE_MS;

export interface PendingReview {
  sessionId: string;
  /** When the session ended. */
  at: number;
  durationMs: number;
  mode: Mode;
}

export interface BreakSuggestion {
  /** How long a break we suggest. */
  ms: number;
  at: number;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const fresh = (at: unknown, now: number, ttl: number): boolean =>
  typeof at === 'number' && Number.isFinite(at) && now - at >= 0 && now - at <= ttl;

export async function setPendingReview(review: PendingReview): Promise<void> {
  await storage.setItem(REVIEW_KEY, review);
}

export async function readPendingReview(now: number): Promise<PendingReview | null> {
  const raw = await storage.getItem<unknown>(REVIEW_KEY);
  if (!isRecord(raw) || typeof raw.sessionId !== 'string') return null;
  if (!fresh(raw.at, now, REVIEW_TTL_MS)) return null;

  return {
    sessionId: raw.sessionId,
    at: raw.at as number,
    durationMs: typeof raw.durationMs === 'number' ? raw.durationMs : 0,
    mode: (raw.mode as Mode) ?? 'pomodoro',
  };
}

export async function clearPendingReview(): Promise<void> {
  await storage.removeItem(REVIEW_KEY);
}

export function watchPendingReview(
  now: () => number,
  callback: (review: PendingReview | null) => void,
): () => void {
  return storage.watch<unknown>(REVIEW_KEY, () => {
    void readPendingReview(now()).then(callback);
  });
}

export async function setBreakSuggestion(suggestion: BreakSuggestion): Promise<void> {
  await storage.setItem(SUGGESTION_KEY, suggestion);
}

export async function readBreakSuggestion(now: number): Promise<BreakSuggestion | null> {
  const raw = await storage.getItem<unknown>(SUGGESTION_KEY);
  if (!isRecord(raw) || typeof raw.ms !== 'number') return null;
  if (!fresh(raw.at, now, SUGGESTION_TTL_MS)) return null;

  return { ms: raw.ms, at: raw.at as number };
}

export async function clearBreakSuggestion(): Promise<void> {
  await storage.removeItem(SUGGESTION_KEY);
}

export function watchBreakSuggestion(
  now: () => number,
  callback: (suggestion: BreakSuggestion | null) => void,
): () => void {
  return storage.watch<unknown>(SUGGESTION_KEY, () => {
    void readBreakSuggestion(now()).then(callback);
  });
}

/** Time spent away that was recorded as a pause. */
export interface IdlePrompt {
  ms: number;
  at: number;
}

export async function setIdlePrompt(prompt: IdlePrompt): Promise<void> {
  await storage.setItem(IDLE_KEY, prompt);
}

export async function readIdlePrompt(now: number): Promise<IdlePrompt | null> {
  const raw = await storage.getItem<unknown>(IDLE_KEY);
  if (!isRecord(raw) || typeof raw.ms !== 'number' || raw.ms <= 0) return null;
  if (!fresh(raw.at, now, IDLE_PROMPT_TTL_MS)) return null;

  return { ms: raw.ms, at: raw.at as number };
}

export async function clearIdlePrompt(): Promise<void> {
  await storage.removeItem(IDLE_KEY);
}

export function watchIdlePrompt(
  now: () => number,
  callback: (prompt: IdlePrompt | null) => void,
): () => void {
  return storage.watch<unknown>(IDLE_KEY, () => {
    void readIdlePrompt(now()).then(callback);
  });
}
