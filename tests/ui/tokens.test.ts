import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * An undefined CSS variable is not an error. It is silently invalid, and the
 * declaration using it is dropped — so a filled button renders transparent and
 * a switched-on toggle stays white. Nothing reports it; you find out by looking
 * at the screen, which is exactly how this one got shipped once.
 *
 * Two things are checked. Every `var(--x)` in the styles has to be defined
 * somewhere, and the tones that the phaseless screens need have to be defined on
 * `:root` as well, not only under `[data-phase]`.
 */

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const SRC = join(ROOT, 'src');

function cssFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return cssFiles(path);
    return entry.endsWith('.css') ? [path] : [];
  });
}

const files = cssFiles(SRC);
const allCss = files.map((file) => readFileSync(file, 'utf8')).join('\n');

/** Everything declared as `--name:`. */
function definedProps(text: string): Set<string> {
  return new Set([...text.matchAll(/(--[\w-]+)\s*:/g)].map((match) => match[1]!));
}

/** Everything used as `var(--name)`, fallbacks included. */
function usedProps(text: string): Map<string, boolean> {
  const used = new Map<string, boolean>();
  for (const match of text.matchAll(/var\(\s*(--[\w-]+)\s*(,)?/g)) {
    const name = match[1]!;
    const hasFallback = match[2] === ',';
    used.set(name, (used.get(name) ?? true) && hasFallback);
  }
  return used;
}

const defined = definedProps(allCss);

describe('the CSS variables', () => {
  it('are all defined somewhere', () => {
    const missing: string[] = [];

    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      for (const [name, alwaysHasFallback] of usedProps(text)) {
        // A use with a fallback is safe; the colour may come from a component.
        if (alwaysHasFallback) continue;
        if (!defined.has(name)) missing.push(`${name} → ${file.slice(ROOT.length + 1)}`);
      }
    }

    expect([...new Set(missing)]).toEqual([]);
  });

  it('define the tones on the root, so a page with no phase still has colour', () => {
    const tokens = readFileSync(join(SRC, 'styles', 'tokens.css'), 'utf8');

    // The bodies of the `:root` blocks, leaving the data-phase ones out.
    const rootBlocks = [...tokens.matchAll(/:root[^{]*\{([^}]*)\}/g)].map((match) => match[1]!);
    const rootDefined = definedProps(rootBlocks.join('\n'));

    for (const token of ['--tone', '--tone-hover', '--tone-text', '--tone-soft', '--tone-fg']) {
      expect(rootDefined.has(token), `${token} must be defined on :root`).toBe(true);
    }
  });

  it('are redefined as a complete set by every phase block', () => {
    const tokens = readFileSync(join(SRC, 'styles', 'tokens.css'), 'utf8');
    const phaseBlocks = [...tokens.matchAll(/\[data-phase=[^{]*\{([^}]*)\}/g)].map(
      (match) => match[1]!,
    );

    expect(phaseBlocks.length).toBeGreaterThan(0);

    // Override only some of them and the rest keep their root values, which
    // leaves the phase wearing two colours at once.
    for (const block of phaseBlocks) {
      const names = definedProps(block);
      for (const token of ['--tone', '--tone-hover', '--tone-text', '--tone-soft', '--tone-fg']) {
        expect(names.has(token), `the phase block is missing ${token}`).toBe(true);
      }
    }
  });
});
