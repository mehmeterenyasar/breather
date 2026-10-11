/**
 * Names that are never translated. The product name the user sees is not one of
 * these; that lives under `extName` in the locale catalogs.
 */
export const BRAND = {
  /** Used in storage and database names, so changing it orphans existing data. */
  slug: 'breather',

  dbName: 'breather',
  /** Replace with your own domain before publishing to AMO. */
  geckoId: 'breather@breather.app',
  /** Backups come out as breather-backup-2026-10-09.json */
  backupPrefix: 'breather-backup',
} as const;

/** Where the settings page sends you to rebind the keyboard shortcuts. */
export const SHORTCUTS_URL = {
  chromium: 'chrome://extensions/shortcuts',
  firefox: 'about:addons',
} as const;
