import { create } from 'zustand';
import type { AppSettings } from '@shared/types/terminal';

interface SettingsState {
  settings: AppSettings | null;
  loadSettings: () => Promise<void>;
  updateSettings: (settings: Partial<AppSettings>) => Promise<void>;
}

const defaultSettings: AppSettings = {
  terminal: {
    fontSize: 14,
    fontFamily: "'Cascadia Code', 'Cascadia Mono', Consolas, monospace",
    theme: 'win11-dark',
    cursorStyle: 'block',
    cursorBlink: true,
    scrollback: 10000,
    defaultProfileId: 'pwsh7',
  },
  profiles: [],
  remote: {
    relayUrl: 'http://localhost:3001',
  },
};

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: defaultSettings,

  loadSettings: async () => {
    try {
      const settings = await window.electronAPI?.getSettings();
      if (settings) set({ settings });
    } catch {}
  },

  updateSettings: async (partial) => {
    try {
      const updated = await window.electronAPI?.setSettings(partial);
      if (updated) set({ settings: updated });
    } catch {}
  },
}));
