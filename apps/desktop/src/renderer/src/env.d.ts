/// <reference types="vite/client" />

declare global {
  interface Window {
    electronAPI?: {
      ptyCreate: (payload: { paneId: string; profileId: string; cols: number; rows: number; cwd?: string }) => Promise<{ success: boolean }>;
      ptyWrite: (payload: { paneId: string; data: string }) => void;
      ptyResize: (payload: { paneId: string; cols: number; rows: number }) => void;
      ptyKill: (payload: { paneId: string }) => void;
      onPtyData: (callback: (payload: { paneId: string; data: string }) => void) => (() => void) | undefined;
      onPtyExit: (callback: (payload: { paneId: string; exitCode: number | undefined }) => void) => (() => void) | undefined;
      getSettings: () => Promise<{ terminal: { fontSize: number; fontFamily: string; theme: string; cursorStyle: 'block' | 'underline' | 'bar'; cursorBlink: boolean; scrollback: number; defaultProfileId: string }; profiles: Array<{ id: string; name: string; executable: string; args?: string[]; icon?: string; color?: string }>; remote: { relayUrl: string } }>;
      setSettings: (settings: object) => Promise<{ terminal: { fontSize: number; fontFamily: string; theme: string; cursorStyle: 'block' | 'underline' | 'bar'; cursorBlink: boolean; scrollback: number; defaultProfileId: string }; profiles: Array<{ id: string; name: string; executable: string; args?: string[]; icon?: string; color?: string }>; remote: { relayUrl: string } }>;
      onSettingsChanged: (callback: (settings: { terminal: { fontSize: number; fontFamily: string; theme: string; cursorStyle: 'block' | 'underline' | 'bar'; cursorBlink: boolean; scrollback: number; defaultProfileId: string }; profiles: Array<{ id: string; name: string; executable: string; args?: string[]; icon?: string; color?: string }>; remote: { relayUrl: string } }) => void) => (() => void) | undefined;
      getProfiles: () => Promise<Array<{ id: string; name: string; executable: string; args?: string[]; icon?: string; color?: string }>>;
      windowMinimize: () => void;
      windowMaximize: () => void;
      windowClose: () => void;
      windowIsMaximized: () => Promise<boolean>;
      onWindowMaximizedChanged: (callback: (maximized: boolean) => void) => (() => void) | undefined;
      remoteSessionStart: (paneId: string) => Promise<{ success: boolean; code?: string; url?: string; error?: string }>;
      remoteSessionStop: (paneId: string) => Promise<{ success: boolean }>;
      onRemoteSessionStarted: (callback: (data: { paneId: string; code: string; url: string }) => void) => (() => void) | undefined;
      onRemoteSessionStopped: (callback: (data: { paneId: string }) => void) => (() => void) | undefined;
      onRemoteSessionTerminated: (callback: (data: { paneId: string }) => void) => (() => void) | undefined;
      onDesktopSessionCreate: (callback: () => void) => (() => void) | undefined;
    };
  }
}

export {};
