import ElectronStore from 'electron-store';
import type { AppSettings } from '@remote-terminal/shared';

const defaults: AppSettings = {
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

const store = new ElectronStore<AppSettings>({
  name: 'settings',
  defaults,
});

export function getSettings(): AppSettings {
  return {
    terminal: store.get('terminal', defaults.terminal),
    profiles: store.get('profiles', defaults.profiles),
    remote: store.get('remote', defaults.remote),
  };
}

export function setSettings(settings: Partial<AppSettings>): void {
  if (settings.terminal) {
    store.set('terminal', {
      ...store.get('terminal', defaults.terminal),
      ...settings.terminal,
    });
  }
  if (settings.profiles) store.set('profiles', settings.profiles);
  if (settings.remote) {
    store.set('remote', {
      ...store.get('remote', defaults.remote),
      ...settings.remote,
    });
  }
}
