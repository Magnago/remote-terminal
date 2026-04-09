import { ipcMain, BrowserWindow } from 'electron';
import { IpcChannels } from '@remote-terminal/shared';
import type { PtyCreatePayload, PtyWritePayload, PtyResizePayload, PtyKillPayload, PtyDataPayload } from '@remote-terminal/shared';
import { createPty, writeToPty, resizePty, killPty } from '../pty/pty-manager';
import { detectProfiles } from '../pty/profiles';
import { getSettings } from '../store/settings-store';
import { startRemoteSession, stopRemoteSession } from './remote-session.ipc';

interface CommandCaptureState {
  capture: string | null;
  atLineStart: boolean;
}

const commandCaptureByPane = new Map<string, CommandCaptureState>();

function getCaptureState(paneId: string): CommandCaptureState {
  const existing = commandCaptureByPane.get(paneId);
  if (existing) return existing;
  const initial: CommandCaptureState = { capture: null, atLineStart: true };
  commandCaptureByPane.set(paneId, initial);
  return initial;
}

function sendTerminalText(win: BrowserWindow, paneId: string, data: string): void {
  const payload: PtyDataPayload = { paneId, data };
  win.webContents.send(IpcChannels.PTY_DATA, payload);
}

function isControlCharacter(ch: string): boolean {
  const code = ch.charCodeAt(0);
  return code < 32 && ch !== '\r' && ch !== '\n' && ch !== '\t';
}

async function tryHandleCapturedCommand(
  win: BrowserWindow,
  paneId: string,
  command: string,
): Promise<boolean> {
  if (command === '/remote-session') {
    sendTerminalText(win, paneId, '/remote-session\r\n');
    const result = await startRemoteSession(paneId);
    if (result.success && result.code && result.url) {
      sendTerminalText(win, paneId, `\x1b[32mRemote session started\x1b[0m\r\n`);
      sendTerminalText(win, paneId, `\x1b[36m${result.url}\x1b[0m\r\n`);
      sendTerminalText(win, paneId, `\x1b[36mCode: ${result.code}\x1b[0m\r\n`);
      win.webContents.send(IpcChannels.REMOTE_SESSION_STARTED, {
        paneId,
        code: result.code,
        url: result.url,
      });
    } else {
      sendTerminalText(
        win,
        paneId,
        `\x1b[31mFailed to start remote session: ${result.error || 'unknown error'}\x1b[0m\r\n`,
      );
    }
    return true;
  }

  if (command === '/remote-session stop') {
    sendTerminalText(win, paneId, '/remote-session stop\r\n');
    await stopRemoteSession(paneId);
    sendTerminalText(win, paneId, `\x1b[33mRemote session stopped\x1b[0m\r\n`);
    win.webContents.send(IpcChannels.REMOTE_SESSION_STOPPED, { paneId });
    return true;
  }

  return false;
}

async function processPtyWrite(win: BrowserWindow, payload: PtyWritePayload): Promise<void> {
  const state = getCaptureState(payload.paneId);
  let forwardData = '';

  for (let i = 0; i < payload.data.length; i++) {
    const ch = payload.data[i];

    if (state.capture !== null) {
      if (ch === '\x7f') {
        state.capture = state.capture.slice(0, -1);
        continue;
      }

      if (ch === '\r' || ch === '\n') {
        const command = state.capture.trim();
        const handled = await tryHandleCapturedCommand(win, payload.paneId, command);
        if (!handled) {
          forwardData += `${state.capture}${ch}`;
        }
        state.capture = null;
        state.atLineStart = true;
        continue;
      }

      if (isControlCharacter(ch)) {
        forwardData += `${state.capture}${ch}`;
        state.capture = null;
        state.atLineStart = false;
        continue;
      }

      state.capture += ch;
      state.atLineStart = false;
      continue;
    }

    if (state.atLineStart && ch === '/') {
      state.capture = '/';
      state.atLineStart = false;
      continue;
    }

    forwardData += ch;
    if (ch === '\r' || ch === '\n') {
      state.atLineStart = true;
    } else if (ch !== '\x7f') {
      state.atLineStart = false;
    }
  }

  if (forwardData.length > 0) {
    writeToPty(payload.paneId, forwardData);
  }
}

export function registerTerminalIpc(win: BrowserWindow): void {
  const profiles = detectProfiles();
  const settings = getSettings();

  ipcMain.handle(IpcChannels.PTY_CREATE, (_event, payload: PtyCreatePayload) => {
    const profile = profiles.find((p) => p.id === payload.profileId) || profiles[0];
    if (!profile) return;
    createPty(payload, win.webContents, profile.executable, profile.args || []);
    void startRemoteSession(payload.paneId).then((result) => {
      if (result.success && result.code && result.url) {
        win.webContents.send(IpcChannels.REMOTE_SESSION_STARTED, {
          paneId: payload.paneId,
          code: result.code,
          url: result.url,
        });
      }
    });
    return { success: true };
  });

  ipcMain.on(IpcChannels.PTY_WRITE, (_event, payload: PtyWritePayload) => {
    void processPtyWrite(win, payload);
  });

  ipcMain.on(IpcChannels.PTY_RESIZE, (_event, payload: PtyResizePayload) => {
    resizePty(payload.paneId, payload.cols, payload.rows);
  });

  ipcMain.on(IpcChannels.PTY_KILL, (_event, payload: PtyKillPayload) => {
    commandCaptureByPane.delete(payload.paneId);
    void stopRemoteSession(payload.paneId);
    killPty(payload.paneId);
  });
}
