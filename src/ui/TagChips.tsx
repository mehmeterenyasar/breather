import { i18n } from '@/i18n';
import { useState } from 'preact/hooks';
import { TAG_COLORS, canAddTag, createTag, nextTagColor, quickPickTags } from '@/core/tags';
import type { Tag } from '@/core/types';

interface Props {
  tags: Tag[];
  lastTagId?: string;
  selectedId?: string;
  onSelect: (id: string | undefined) => void;
  onCreate: (tag: Tag) => void;
}

/**
 * A few tags, most recently used first; the full list is managed in settings.
 *
 * Adding one is possible from here because having to open settings before you
 * can label what you are about to work on is exactly the wrong moment to be
 * sent somewhere else.
 */
export function TagChips({ tags, lastTagId, selectedId, onSelect, onCreate }: Props) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');

  const quick = quickPickTags(tags, lastTagId);
  const color = nextTagColor(tags);

  function submit(event: Event) {
    event.preventDefault();
    const tag = createTag(crypto.randomUUID(), name, color);
    if (!tag) return;

    onCreate(tag);
    onSelect(tag.id);
    setName('');
    setAdding(false);
  }

  if (adding) {
    return (
      <form class="tagform" onSubmit={submit}>
        <span class="tagform__swatch" style={{ background: color }} aria-hidden="true" />
        <input
          class="tagform__input"
          type="text"
          value={name}
          maxLength={24}
          autoFocus
          placeholder={i18n.t('tag.namePlaceholder')}
          aria-label={i18n.t('tag.namePlaceholder')}
          onInput={(event) => setName(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setAdding(false);
          }}
        />
        <button type="submit" class="tagform__ok" disabled={!name.trim()}>
          {i18n.t('common.add')}
        </button>
      </form>
    );
  }

  return (
    <div class="tags" role="group" aria-label={i18n.t('a11y.tagList')}>
      {quick.map((tag) => {
        const selected = tag.id === selectedId;
        return (
          <button
            key={tag.id}
            type="button"
            class={selected ? 'chip chip--on' : 'chip'}
            style={{ '--chip-color': tag.color }}
            aria-pressed={selected}
            onClick={() => onSelect(selected ? undefined : tag.id)}
          >
            <span class="chip__dot" aria-hidden="true" />
            {tag.name}
          </button>
        );
      })}

      {canAddTag(tags) && (
        <button
          type="button"
          class="chip chip--add"
          aria-label={i18n.t('tag.new')}
          title={i18n.t('tag.new')}
          onClick={() => setAdding(true)}
        >
          +
        </button>
      )}
    </div>
  );
}

export { TAG_COLORS };
