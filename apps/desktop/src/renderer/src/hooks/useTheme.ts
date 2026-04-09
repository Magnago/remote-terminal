import { useSettingsStore } from '../store/useSettingsStore';
import { themes } from '../theme/themes';
import type { ITheme } from '@xterm/xterm';

export function useTheme(): ITheme {
  const settings = useSettingsStore((s) => s.settings);
  const themeName = settings?.terminal.theme || 'win11-dark';
  return themes[themeName] || themes['win11-dark'];
}
