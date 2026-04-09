import { app, BrowserWindow, ipcMain, nativeTheme } from 'electron';
import { join } from 'path';
import { createWindow } from './window';
import { registerTerminalIpc } from './ipc/terminal.ipc';
import { registerSettingsIpc } from './ipc/settings.ipc';
import { registerProfilesIpc } from './ipc/profiles.ipc';
import { registerRemoteSessionIpc } from './ipc/remote-session.ipc';
import { IpcChannels } from '@awesome-terminal/shared';

// Disable hardware acceleration temporarily to avoid blank window issues
// app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  const win = createWindow();

  registerTerminalIpc(win);
  registerSettingsIpc(win);
  registerProfilesIpc();
  registerRemoteSessionIpc(win);

  // Window control IPC
  ipcMain.on(IpcChannels.WINDOW_MINIMIZE, () => win.minimize());
  ipcMain.on(IpcChannels.WINDOW_MAXIMIZE, () => {
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  });
  ipcMain.on(IpcChannels.WINDOW_CLOSE, () => win.close());
  ipcMain.handle(IpcChannels.WINDOW_IS_MAXIMIZED, () => win.isMaximized());

  win.on('maximize', () => win.webContents.send(IpcChannels.WINDOW_MAXIMIZED_CHANGED, true));
  win.on('unmaximize', () => win.webContents.send(IpcChannels.WINDOW_MAXIMIZED_CHANGED, false));

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
