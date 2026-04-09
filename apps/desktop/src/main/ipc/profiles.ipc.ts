import { ipcMain } from 'electron';
import { IpcChannels } from '@remote-terminal/shared';
import { detectProfiles } from '../pty/profiles';

export function registerProfilesIpc(): void {
  ipcMain.handle(IpcChannels.GET_PROFILES, () => detectProfiles());
}
