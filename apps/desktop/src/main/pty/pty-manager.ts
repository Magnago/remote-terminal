import * as pty from 'node-pty';
import { WebContents } from 'electron';
import { IpcChannels } from '@awesome-terminal/shared';
import type { PtyCreatePayload, PtyDataPayload, PtyExitPayload } from '@awesome-terminal/shared';

type RelayCallback = (data: string) => void;

interface PtyInstance {
  process: pty.IPty;
  webContentsId: number;
  relayCallbacks: Set<RelayCallback>;
}

const ptyInstances = new Map<string, PtyInstance>();

export function createPty(
  payload: PtyCreatePayload,
  webContents: WebContents,
  executable: string,
  args: string[]
): void {
  const shell = pty.spawn(executable, args, {
    name: 'xterm-256color',
    cols: payload.cols,
    rows: payload.rows,
    cwd: payload.cwd || process.env.HOME || process.env.USERPROFILE || 'C:\\',
    env: process.env as Record<string, string>,
  });

  const instance: PtyInstance = {
    process: shell,
    webContentsId: webContents.id,
    relayCallbacks: new Set(),
  };
  ptyInstances.set(payload.paneId, instance);

  shell.onData((data) => {
    if (!webContents.isDestroyed()) {
      const payload2: PtyDataPayload = { paneId: payload.paneId, data };
      webContents.send(IpcChannels.PTY_DATA, payload2);
    }
    // Forward to relay clients
    instance.relayCallbacks.forEach((cb) => cb(data));
  });

  shell.onExit(({ exitCode }) => {
    // Guard: only clean up if this is still the active instance for this paneId.
    // React StrictMode double-mount can cause PTY1's async exit to fire after PTY2
    // has already been created for the same paneId.
    const current = ptyInstances.get(payload.paneId);
    if (current?.process !== shell) return;

    ptyInstances.delete(payload.paneId);
    if (!webContents.isDestroyed()) {
      const exitPayload: PtyExitPayload = { paneId: payload.paneId, exitCode };
      webContents.send(IpcChannels.PTY_EXIT, exitPayload);
    }
  });
}

export function writeToPty(paneId: string, data: string): void {
  const instance = ptyInstances.get(paneId);
  if (instance) {
    instance.process.write(data);
  }
}

export function resizePty(paneId: string, cols: number, rows: number): void {
  const instance = ptyInstances.get(paneId);
  if (instance) {
    instance.process.resize(cols, rows);
  }
}

export function killPty(paneId: string): void {
  const instance = ptyInstances.get(paneId);
  if (instance) {
    instance.process.kill();
    ptyInstances.delete(paneId);
  }
}

export function addRelayCallback(paneId: string, cb: RelayCallback): () => void {
  const instance = ptyInstances.get(paneId);
  if (!instance) return () => {};
  instance.relayCallbacks.add(cb);
  return () => instance.relayCallbacks.delete(cb);
}

export function getPtyInstance(paneId: string): PtyInstance | undefined {
  return ptyInstances.get(paneId);
}
