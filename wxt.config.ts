import { defineConfig } from 'wxt';
import preact from '@preact/preset-vite';

/**
 * A few decisions worth recording.
 *
 * `srcDir: 'src'` is WXT's standard layout, with entrypoints, locales and the
 * shared code all under src/. That matters because WXT's built-in `@` alias
 * overwrites a user-defined one, so a custom alias is not an option; moving to
 * the standard layout makes `@` point where we want it. `public/` stays at the
 * project root either way, which WXT insists on.
 *
 * Translations go through our own runtime in src/i18n rather than WXT's module,
 * so the language can be changed from the settings page. The manifest name and
 * description still live in `public/_locales`, since the browser reads those
 * before any of our code runs.
 *
 * `imports: false` turns WXT's auto-imports off. Everything is imported
 * explicitly: better to read, better to tree-shake, and no surprises in tests.
 * Preact comes in through the Vite preset directly, there being no official WXT
 * module for it.
 *
 * The `offscreen` permission exists only on Chromium; on Firefox the audio plays
 * in the background event page. `tabs` is optional and requested at runtime,
 * only when meeting detection is switched on.
 */
export default defineConfig({
  srcDir: 'src',
  // WXT defaults Firefox to MV2; we want MV3 on all three.
  manifestVersion: 3,
  imports: false,
  vite: () => ({
    plugins: [preact()],
  }),
  manifest: ({ browser }) => {
    const isFirefox = browser === 'firefox';

    return {
      name: '__MSG_extName__',
      description: '__MSG_extDescription__',
      default_locale: 'en',
      permissions: [
        'storage',
        'alarms',
        'notifications',
        'idle',
        ...(isFirefox ? [] : ['offscreen']),
      ],
      optional_permissions: ['tabs'],
      action: {
        default_title: '__MSG_extName__',
      },
      commands: {
        'toggle-timer': {
          suggested_key: { default: 'Alt+Shift+S' },
          description: '__MSG_cmdToggleTimer__',
        },
        'skip-phase': {
          suggested_key: { default: 'Alt+Shift+K' },
          description: '__MSG_cmdSkipPhase__',
        },
      },
      ...(isFirefox
        ? {
            browser_specific_settings: {
              gecko: {
                // Replace with your own domain before publishing.
                id: 'breather@breather.app',
                // The background script loads as an ES module, which Firefox
                // supports from 128 — also an ESR release.
                strict_min_version: '128.0',
              },
            },
          }
        : {
            minimum_chrome_version: '116',
          }),
    };
  },
});
