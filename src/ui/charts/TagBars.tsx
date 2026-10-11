import type { TagTotal } from '@/core/stats';
import type { Tag } from '@/core/types';

interface Props {
  totals: TagTotal[];
  tags: Tag[];
  untaggedLabel: string;
  formatMs: (ms: number) => string;
}

/**
 * Time per tag, as horizontal bars rather than a pie: past about five slices a
 * pie stops answering the question you asked it. The bars are HTML, not SVG,
 * because they sit next to text and text in a scaled SVG looks wrong.
 */
export function TagBars({ totals, tags, untaggedLabel, formatMs }: Props) {
  if (totals.length === 0) return null;

  const max = totals[0]?.ms ?? 1;

  return (
    <ul class="tagbars">
      {totals.map((total) => {
        const tag = tags.find((item) => item.id === total.tagId);
        const name = total.tagId === '' ? untaggedLabel : (tag?.name ?? total.tagId);

        return (
          <li key={total.tagId} class="tagbars__row">
            <span class="tagbars__name" title={name}>
              <span
                class="tagbars__dot"
                style={{ background: tag?.color ?? 'var(--fg-faint)' }}
                aria-hidden="true"
              />
              {name}
            </span>

            <span class="tagbars__track">
              <span
                class="tagbars__fill"
                style={{
                  width: `${(total.ms / max) * 100}%`,
                  background: tag?.color ?? 'var(--fg-faint)',
                }}
              />
            </span>

            <span class="tagbars__value num">{formatMs(total.ms)}</span>
            <span class="tagbars__share num">{Math.round(total.share * 100)}%</span>
          </li>
        );
      })}
    </ul>
  );
}
