import { storage } from 'wxt/utils/storage';
import { DEFAULT_SETTINGS, migrateSettings, normalizeSettings } from './schema';
import type { Settings } from './schema';

/**
 * Settings go in `storage.sync` so they follow the user between machines.
 *
 * The quota there is small (Chrome gives about 100 KB in total, 8 KB per item)
 * and writes are rate limited, so a quota error drops us to `local` for good and
 * records a flag; later reads then know where to look.
 */

const SYNC_KEY = 'sync:settings' as const;
const LOCAL_KEY = 'local:settings' as const;
const FALLBACK_KEY = 'local:settingsUseLocal' as const;

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends readonly unknown[]
    ? T[K]
    : T[K] extends object
      ? DeepPartial<T[K]>
      : T[K];
};

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Arrays replace wholesale, objects merge field by field. */
function mergeDeep<T>(base: T, patch: unknown): T {
  if (!isPlainObject(patch)) return base;
  if (!isPlainObject(base)) return patch as T;

  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    const current = out[key];
    out[key] = isPlainObject(value) && isPlainObject(current) ? mergeDeep(current, value) : value;
  }
  return out as T;
}

async function usingLocal(): Promise<boolean> {
  return (await storage.getItem<boolean>(FALLBACK_KEY)) === true;
}

export async function readSettings(): Promise<Settings> {
  if (await usingLocal()) {
    return migrateSettings(await storage.getItem<unknown>(LOCAL_KEY));
  }

  const synced = await storage.getItem<unknown>(SYNC_KEY);
  if (synced != null) return migrateSettings(synced);

  // Nothing in `sync` may just mean we fell back to `local` at some point.
  const local = await storage.getItem<unknown>(LOCAL_KEY);
  return migrateSettings(local);
}

/** Falls back to `local` on a quota error; callers see no difference. */
export async function writeSettings(next: Settings): Promise<Settings> {
  const value = normalizeSettings(next);

  if (await usingLocal()) {
    await storage.setItem(LOCAL_KEY, value);
    return value;
  }

  try {
    await storage.setItem(SYNC_KEY, value);
  } catch (error) {
    console.warn('[breather] sync quota exceeded, moving settings to local storage', error);
    await storage.setItems([
      { key: FALLBACK_KEY, value: true },
      { key: LOCAL_KEY, value },
    ]);
  }

  return value;
}

/** Read, merge, normalize, write. */
export async function updateSettings(
  patch: DeepPartial<Settings> | ((current: Settings) => DeepPartial<Settings>),
): Promise<Settings> {
  const current = await readSettings();
  const delta = typeof patch === 'function' ? patch(current) : patch;
  return writeSettings(mergeDeep(current, delta));
}

export async function resetSettings(): Promise<Settings> {
  return writeSettings(structuredClone(DEFAULT_SETTINGS));
}

/** Watches both paths, since either one may be the live store. */
export function watchSettings(callback: (settings: Settings) => void): () => void {
  const unwatchSync = storage.watch<unknown>(SYNC_KEY, (value) => {
    callback(migrateSettings(value));
  });
  const unwatchLocal = storage.watch<unknown>(LOCAL_KEY, (value) => {
    callback(migrateSettings(value));
  });

  return () => {
    unwatchSync();
    unwatchLocal();
  };
}

export { DEFAULT_SETTINGS };
export type { Settings };
