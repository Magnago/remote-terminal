import { ipcMain, BrowserWindow } from 'electron';
import { IpcChannels } from '@remote-terminal/shared';
import { getSettings, setSettings } from '../store/settings-store';
import type { AppSettings } from '@remote-terminal/shared';

export function registerSettingsIpc(win: BrowserWindow): void {
  ipcMain.handle(IpcChannels.GET_SETTINGS, () => getSettings());

  ipcMain.handle(IpcChannels.SET_SETTINGS, (_event, settings: Partial<AppSettings>) => {
    setSettings(settings);
    win.webContents.send(IpcChannels.SETTINGS_CHANGED, getSettings());
    return getSettings();
  });
}
