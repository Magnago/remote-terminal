import { contextBridge, ipcRenderer } from 'electron';
import { IpcChannels } from '@remote-terminal/shared';
import type {
  PtyCreatePayload,
  PtyWritePayload,
  PtyResizePayload,
  PtyKillPayload,
  PtyDataPayload,
  PtyExitPayload,
} from '@remote-terminal/shared';
import type { AppSettings, ShellProfile } from '@remote-terminal/shared';

export type ElectronAPI = typeof api;

const api = {
  // PTY
  ptyCreate: (payload: PtyCreatePayload) =>
    ipcRenderer.invoke(IpcChannels.PTY_CREATE, payload),
  ptyWrite: (payload: PtyWritePayload) =>
    ipcRenderer.send(IpcChannels.PTY_WRITE, payload),
  ptyResize: (payload: PtyResizePayload) =>
    ipcRenderer.send(IpcChannels.PTY_RESIZE, payload),
  ptyKill: (payload: PtyKillPayload) =>
    ipcRenderer.send(IpcChannels.PTY_KILL, payload),
  onPtyData: (callback: (payload: PtyDataPayload) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: PtyDataPayload) =>
      callback(payload);
    ipcRenderer.on(IpcChannels.PTY_DATA, listener);
    return () => ipcRenderer.removeListener(IpcChannels.PTY_DATA, listener);
  },
  onPtyExit: (callback: (payload: PtyExitPayload) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: PtyExitPayload) =>
      callback(payload);
    ipcRenderer.on(IpcChannels.PTY_EXIT, listener);
    return () => ipcRenderer.removeListener(IpcChannels.PTY_EXIT, listener);
  },

  // Settings
  getSettings: (): Promise<AppSettings> =>
    ipcRenderer.invoke(IpcChannels.GET_SETTINGS),
  setSettings: (settings: Partial<AppSettings>): Promise<AppSettings> =>
    ipcRenderer.invoke(IpcChannels.SET_SETTINGS, settings),
  onSettingsChanged: (callback: (settings: AppSettings) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, settings: AppSettings) =>
      callback(settings);
    ipcRenderer.on(IpcChannels.SETTINGS_CHANGED, listener);
    return () => ipcRenderer.removeListener(IpcChannels.SETTINGS_CHANGED, listener);
  },

  // Profiles
  getProfiles: (): Promise<ShellProfile[]> =>
    ipcRenderer.invoke(IpcChannels.GET_PROFILES),

  // Window controls
  windowMinimize: () => ipcRenderer.send(IpcChannels.WINDOW_MINIMIZE),
  windowMaximize: () => ipcRenderer.send(IpcChannels.WINDOW_MAXIMIZE),
  windowClose: () => ipcRenderer.send(IpcChannels.WINDOW_CLOSE),
  windowIsMaximized: (): Promise<boolean> =>
    ipcRenderer.invoke(IpcChannels.WINDOW_IS_MAXIMIZED),
  onWindowMaximizedChanged: (callback: (maximized: boolean) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, maximized: boolean) =>
      callback(maximized);
    ipcRenderer.on(IpcChannels.WINDOW_MAXIMIZED_CHANGED, listener);
    return () =>
      ipcRenderer.removeListener(IpcChannels.WINDOW_MAXIMIZED_CHANGED, listener);
  },

  // Remote session
  remoteSessionStart: (paneId: string) =>
    ipcRenderer.invoke(IpcChannels.REMOTE_SESSION_START, { paneId }),
  remoteSessionStop: (paneId: string) =>
    ipcRenderer.invoke(IpcChannels.REMOTE_SESSION_STOP, { paneId }),
  onRemoteSessionStarted: (
    callback: (data: { paneId: string; code: string; url: string }) => void,
  ): (() => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      data: { paneId: string; code: string; url: string },
    ) =>
      callback(data);
    ipcRenderer.on(IpcChannels.REMOTE_SESSION_STARTED, listener);
    return () => ipcRenderer.removeListener(IpcChannels.REMOTE_SESSION_STARTED, listener);
  },
  onRemoteSessionStopped: (callback: (data: { paneId: string }) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: { paneId: string }) => callback(data);
    ipcRenderer.on(IpcChannels.REMOTE_SESSION_STOPPED, listener);
    return () => ipcRenderer.removeListener(IpcChannels.REMOTE_SESSION_STOPPED, listener);
  },
  onRemoteSessionTerminated: (callback: (data: { paneId: string }) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: { paneId: string }) => callback(data);
    ipcRenderer.on(IpcChannels.REMOTE_SESSION_TERMINATED, listener);
    return () => ipcRenderer.removeListener(IpcChannels.REMOTE_SESSION_TERMINATED, listener);
  },
  onDesktopSessionCreate: (callback: () => void): (() => void) => {
    const listener = () => callback();
    ipcRenderer.on(IpcChannels.DESKTOP_SESSION_CREATE, listener);
    return () => ipcRenderer.removeListener(IpcChannels.DESKTOP_SESSION_CREATE, listener);
  },
};

contextBridge.exposeInMainWorld('electronAPI', api);
