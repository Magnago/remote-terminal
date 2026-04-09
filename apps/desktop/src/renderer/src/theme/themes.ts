import type { ITheme } from '@xterm/xterm';

export const win11Dark: ITheme = {
  background: '#0e0e16',
  foreground: '#e0e0e0',
  cursor: '#0078d4',
  cursorAccent: '#0e0e16',
  selectionBackground: 'rgba(0, 120, 212, 0.35)',
  black: '#0e0e16',
  red: '#f14c4c',
  green: '#23d18b',
  yellow: '#f5f543',
  blue: '#0078d4',
  magenta: '#bc3fbc',
  cyan: '#29b8db',
  white: '#e5e5e5',
  brightBlack: '#666666',
  brightRed: '#f1897f',
  brightGreen: '#23d18b',
  brightYellow: '#f5f543',
  brightBlue: '#3b8eea',
  brightMagenta: '#d670d6',
  brightCyan: '#29b8db',
  brightWhite: '#ffffff',
};

export const win11Light: ITheme = {
  background: '#f3f3f3',
  foreground: '#1a1a1a',
  cursor: '#0078d4',
  cursorAccent: '#f3f3f3',
  selectionBackground: 'rgba(0, 120, 212, 0.25)',
  black: '#1a1a1a',
  red: '#cd3131',
  green: '#00bc00',
  yellow: '#949800',
  blue: '#0451a5',
  magenta: '#bc05bc',
  cyan: '#0598bc',
  white: '#555555',
  brightBlack: '#666666',
  brightRed: '#cd3131',
  brightGreen: '#00bc00',
  brightYellow: '#949800',
  brightBlue: '#0451a5',
  brightMagenta: '#bc05bc',
  brightCyan: '#0598bc',
  brightWhite: '#a5a5a5',
};

export const themes: Record<string, ITheme> = {
  'win11-dark': win11Dark,
  'win11-light': win11Light,
};
