import type { Tag } from './types';

/**
 * Tag names are user content and never translated.
 *
 * Colours come from a fixed palette rather than a picker: it keeps every tag
 * legible in both themes, and spares the user a decision they don't care about.
 */

export const TAG_COLORS = [
  '#4e8c7e',
  '#5361c8',
  '#80529a',
  '#a75f42',
  '#2f7395',
  '#6b7f3e',
  '#a8546f',
  '#5e6b73',
] as const;

export const MAX_TAGS = 60;
export const MAX_TAG_NAME = 24;

/** First unused palette colour, wrapping round once they are all taken. */
export function nextTagColor(tags: readonly Tag[]): string {
  const used = new Set(tags.map((tag) => tag.color));
  return (
    TAG_COLORS.find((color) => !used.has(color)) ?? TAG_COLORS[tags.length % TAG_COLORS.length]!
  );
}

/** Empty names are rejected. */
export function normalizeTagName(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, MAX_TAG_NAME);
}

export function createTag(id: string, name: string, color: string): Tag | null {
  const clean = normalizeTagName(name);
  if (!clean) return null;
  return { id, name: clean, color };
}

export function findTag(tags: readonly Tag[], id: string | undefined): Tag | undefined {
  if (!id) return undefined;
  return tags.find((tag) => tag.id === id);
}

/**
 * What the popup shows: unarchived tags, most recently used first. It is meant
 * for one-click selection, not management; that lives in settings.
 */
export function quickPickTags(
  tags: readonly Tag[],
  lastTagId: string | undefined,
  limit = 4,
): Tag[] {
  const active = tags.filter((tag) => !tag.archived);
  const last = findTag(active, lastTagId);
  if (!last) return active.slice(0, limit);

  return [last, ...active.filter((tag) => tag.id !== last.id)].slice(0, limit);
}

export function canAddTag(tags: readonly Tag[]): boolean {
  return tags.length < MAX_TAGS;
}
