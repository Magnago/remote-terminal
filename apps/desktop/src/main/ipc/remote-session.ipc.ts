import { ipcMain, BrowserWindow } from 'electron';
import { IpcChannels } from '@awesome-terminal/shared';
import type { RemoteSessionStartPayload, RemoteSessionStopPayload } from '@awesome-terminal/shared';
import { WebSocket } from 'ws';
import { customAlphabet } from 'nanoid';
import { addPtyExitCallback, addRelayCallback, killPty, resizePty, writeToPty } from '../pty/pty-manager';
import { getSettings } from '../store/settings-store';

const nanoid = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 6);

interface ActiveSession {
  paneId: string;
  code: string;
  url: string;
  ws: WebSocket;
  removeRelayCallback: () => void;
  removeExitCallback: () => void;
}

const activeSessions = new Map<string, ActiveSession>();

async function deleteRelaySession(code: string): Promise<void> {
  const configuredRelayUrl =
    process.env.AWESOME_TERMINAL_RELAY_URL || getSettings().remote.relayUrl;
  const relayUrl = new URL(configuredRelayUrl);
  try {
    await fetch(`${relayUrl.origin}/api/sessions/${code}`, { method: 'DELETE' });
  } catch {}
}

function getRelayEndpoints(code: string): { browserUrl: string; desktopWsUrl: string } {
  const configuredRelayUrl =
    process.env.AWESOME_TERMINAL_RELAY_URL || getSettings().remote.relayUrl;
  const relayUrl = new URL(configuredRelayUrl);
  const wsProtocol = relayUrl.protocol === 'https:' ? 'wss:' : 'ws:';
  const relayOrigin = relayUrl.origin.replace(/\/$/, '');

  return {
    browserUrl: `${relayOrigin}/session/${code}`,
    desktopWsUrl: `${wsProtocol}//${relayUrl.host}/desktop`,
  };
}

export function registerRemoteSessionIpc(_win: BrowserWindow): void {
  ipcMain.handle(IpcChannels.REMOTE_SESSION_START, async (_event, payload: RemoteSessionStartPayload) => {
    const result = await startRemoteSession(payload.paneId);
    if (result.success && result.code && result.url) {
      _win.webContents.send(IpcChannels.REMOTE_SESSION_STARTED, {
        paneId: payload.paneId,
        code: result.code,
        url: result.url,
      });
    }
    return result;
  });

  ipcMain.handle(IpcChannels.REMOTE_SESSION_STOP, async (_event, payload: RemoteSessionStopPayload) => {
    await stopRemoteSession(payload.paneId);
    _win.webContents.send(IpcChannels.REMOTE_SESSION_STOPPED, { paneId: payload.paneId });
    return { success: true };
  });
}

export async function startRemoteSession(
  paneId: string,
): Promise<{ success: boolean; code?: string; url?: string; error?: string }> {
  const existing = activeSessions.get(paneId);
  if (existing) {
    return { success: true, code: existing.code, url: existing.url };
  }

  const code = nanoid();

  try {
    const relayEndpoints = getRelayEndpoints(code);
    const ws = new WebSocket(relayEndpoints.desktopWsUrl);

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Connection timeout after 5s')), 5000);
      ws.on('open', () => {
        clearTimeout(timeout);
        resolve();
      });
      ws.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    ws.send(JSON.stringify({ type: 'register-desktop', code }));

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'data') {
          writeToPty(paneId, msg.payload);
        } else if (msg.type === 'resize') {
          resizePty(paneId, msg.cols, msg.rows);
        } else if (msg.type === 'terminate') {
          killPty(paneId);
        }
      } catch {}
    });

    const removeRelayCallback = addRelayCallback(paneId, (data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'data', payload: data }));
      }
    });
    const removeExitCallback = addPtyExitCallback(paneId, () => {
      void stopRemoteSession(paneId);
    });

    ws.on('close', () => {
      removeRelayCallback();
      removeExitCallback();
      activeSessions.delete(paneId);
    });

    activeSessions.set(paneId, {
      paneId,
      code,
      url: relayEndpoints.browserUrl,
      ws,
      removeRelayCallback,
      removeExitCallback,
    });
    return { success: true, code, url: relayEndpoints.browserUrl };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function stopRemoteSession(paneId: string): Promise<void> {
  const session = activeSessions.get(paneId);
  if (session) {
    session.removeRelayCallback();
    session.removeExitCallback();
    await deleteRelaySession(session.code);
    session.ws.close();
    activeSessions.delete(paneId);
  }
}
