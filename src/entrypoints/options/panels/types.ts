import type { Settings } from '@/storage/schema';
import type { useSettingsWriter } from '@/hooks/useSettingsWriter';

/** Every panel takes the same two things. */
export interface PanelProps {
  settings: Settings;
  write: ReturnType<typeof useSettingsWriter>['write'];
}
