export interface ShellProfile {
  id: string;
  name: string;
  executable: string;
  args?: string[];
  icon?: string;
  color?: string;
}

export type PaneTree =
  | { kind: 'terminal'; paneId: string; profileId: string }
  | {
      kind: 'split';
      direction: 'horizontal' | 'vertical';
      ratio: number;
      first: PaneTree;
      second: PaneTree;
    };

export interface Tab {
  id: string;
  title: string;
  paneTree: PaneTree;
  activePaneId: string;
}

export interface TerminalSettings {
  fontSize: number;
  fontFamily: string;
  theme: string;
  cursorStyle: 'block' | 'underline' | 'bar';
  cursorBlink: boolean;
  scrollback: number;
  defaultProfileId: string;
}

export interface RemoteSettings {
  relayUrl: string;
}

export interface AppSettings {
  terminal: TerminalSettings;
  profiles: ShellProfile[];
  remote: RemoteSettings;
}
