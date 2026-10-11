import { describe, expect, it } from 'vitest';
import {
  MAX_TAGS,
  TAG_COLORS,
  canAddTag,
  createTag,
  findTag,
  nextTagColor,
  normalizeTagName,
  quickPickTags,
} from '@/core/tags';
import type { Tag } from '@/core/types';

const tag = (id: string, name = id, color = '#4e8c7e', archived?: boolean): Tag => ({
  id,
  name,
  color,
  ...(archived ? { archived } : {}),
});

describe('tag names', () => {
  it('tidy up surrounding and repeated whitespace', () => {
    expect(normalizeTagName('  Lecture   notes ')).toBe('Lecture notes');
  });

  it('are truncated when too long', () => {
    expect(normalizeTagName('a'.repeat(50))).toHaveLength(24);
  });

  it('cannot be empty', () => {
    expect(createTag('1', '   ', '#4e8c7e')).toBeNull();
    expect(createTag('1', '', '#4e8c7e')).toBeNull();
  });

  it('produce a tag when valid', () => {
    expect(createTag('1', ' Kod ', '#4e8c7e')).toEqual({ id: '1', name: 'Kod', color: '#4e8c7e' });
  });
});

describe('picking a colour', () => {
  it('takes the first unused one from the palette', () => {
    expect(nextTagColor([])).toBe(TAG_COLORS[0]);
    expect(nextTagColor([tag('a', 'a', TAG_COLORS[0])])).toBe(TAG_COLORS[1]);
  });

  it('wraps round once the palette is used up', () => {
    const used = TAG_COLORS.map((color, i) => tag(String(i), String(i), color));
    expect(TAG_COLORS).toContain(nextTagColor(used));
  });
});

describe('the quick-pick list', () => {
  const tags = [tag('a'), tag('b'), tag('c'), tag('d'), tag('e'), tag('f')];

  it('puts the last used tag first', () => {
    expect(quickPickTags(tags, 'd').map((t) => t.id)).toEqual(['d', 'a', 'b', 'c']);
  });

  it('keeps the order when there is no last used tag', () => {
    expect(quickPickTags(tags, undefined).map((t) => t.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('leaves out archived tags', () => {
    const withArchived = [tag('a'), tag('b', 'b', '#4e8c7e', true), tag('c')];
    expect(quickPickTags(withArchived, undefined).map((t) => t.id)).toEqual(['a', 'c']);
  });

  it('survives a last-used tag that has since been deleted', () => {
    expect(quickPickTags(tags, 'yok').map((t) => t.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('respects the limit', () => {
    expect(quickPickTags(tags, undefined, 2)).toHaveLength(2);
  });
});

describe('the helpers', () => {
  it('find a tag by id', () => {
    const tags = [tag('a'), tag('b')];
    expect(findTag(tags, 'b')?.id).toBe('b');
    expect(findTag(tags, undefined)).toBeUndefined();
    expect(findTag(tags, 'yok')).toBeUndefined();
  });

  it('enforce the maximum number of tags', () => {
    expect(canAddTag([])).toBe(true);
    expect(canAddTag(Array.from({ length: MAX_TAGS }, (_, i) => tag(String(i))))).toBe(false);
  });
});
