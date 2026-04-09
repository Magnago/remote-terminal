import { spawn as cpSpawn } from 'child_process';
import { createRequire } from 'module';
import { WebSocket } from 'ws';
import type { SessionManager } from './session-manager.js';
import type { IPty } from 'node-pty';

type NodePtySpawn = typeof import('node-pty').spawn;

// Attempt to load node-pty (preferred — gives a real interactive PTY).
// Falls back to child_process.spawn if node-pty is unavailable (e.g., not yet installed).
// Uses createRequire for CJS interop in this ESM module.
const _require = createRequire(import.meta.url);
let ptySpawn: NodePtySpawn | null = null;
try {
  const mod = _require('node-pty') as { spawn: NodePtySpawn };
  ptySpawn = mod.spawn;
  console.log('[Relay] node-pty loaded — full PTY support enabled.');
} catch {
  console.warn('[Relay] node-pty not available — using child_process fallback (no interactive PTY). Run pnpm install to enable full PTY.');
}

/** Extract window title from OSC 0/2 escape sequences: \x1b]0;title\x07 */
function parseOscTitle(data: string): string | null {
  const match = data.match(/\x1b\](?:0|2);([^\x07\x1b]*?)(?:\x07|\x1b\\)/);
  return match?.[1] ?? null;
}

const DEFAULT_SHELL =
  process.platform === 'win32'
    ? 'powershell.exe'
    : (process.env.SHELL ?? 'bash');

const DEFAULT_CWD =
  process.env.USERPROFILE ?? process.env.HOME ?? '/';

/**
 * Build shell args and extra env vars that inject a prompt hook emitting
 * OSC 0 title = current directory name.  The relay already listens for
 * OSC titles and calls manager.updateTitle(), so sessions auto-rename as
 * the user navigates directories.
 */
export function cwdTitleInjection(shell: string): { args: string[]; env: Record<string, string> } {
  const s = shell.toLowerCase();
  const isPwsh = s.includes('powershell') || s.includes('pwsh');

  if (isPwsh) {
    // Override the prompt function: emit OSC title = directory basename, then normal PS prompt
    const promptFn =
      "function prompt { $p = (Get-Location).Path; $leaf = Split-Path $p -Leaf; " +
      "$title = if ($leaf) { $leaf } else { $p }; " +
      "$host.UI.RawUI.WindowTitle = $title; " +
      "'PS ' + $p + '> ' }";
    return { args: ['-NoExit', '-Command', promptFn], env: {} };
  }

  // bash / zsh / sh — PROMPT_COMMAND runs before each prompt
  // ${PWD##*/} strips everything up to the last slash (directory basename)
  return {
    args: [],
    env: { PROMPT_COMMAND: 'printf "\\033]0;%s\\007" "${PWD##*/}"' },
  };
}

/**
 * Spawns either a real PTY (via node-pty) or a plain child_process shell,
 * and wires its I/O to any browsers connected to the given relay session.
 */
export function spawnLocalPty(code: string, manager: SessionManager): { kill: () => void } | null {
  const session = manager.getSession(code);
  if (!session) return null;

  const broadcast = (data: string) => {
    const s = manager.getSession(code);
    if (!s) return;
    const version = manager.appendOutput(code, data);
    // Auto-rename session from PTY title escape sequences
    const title = parseOscTitle(data);
    if (title) manager.updateTitle(code, title);
    const frame = JSON.stringify({ type: 'data', payload: data, version });
    s.browserSockets.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(frame);
    });
  };

  const notifyExit = () => {
    const s = manager.getSession(code);
    if (s) {
      s.browserSockets.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN)
          ws.send(JSON.stringify({ type: 'desktop-disconnected' }));
      });
    }
    manager.deleteSession(code);
  };

  if (ptySpawn) {
    // Full PTY via node-pty
    const { args: shellArgs, env: shellEnv } = cwdTitleInjection(DEFAULT_SHELL);
    const pty = ptySpawn(DEFAULT_SHELL, shellArgs, {
      name: 'xterm-color',
      cols: 120,
      rows: 40,
      cwd: DEFAULT_CWD,
      env: { ...(process.env as Record<string, string>), ...shellEnv },
    });

    session.localPty = pty;
    pty.onData(broadcast);
    pty.onExit(notifyExit);

    return { kill: () => { try { pty.kill(); } catch {} } };
  }

  // child_process fallback — no proper PTY, but commands work
  const { args: shellArgs, env: shellEnv } = cwdTitleInjection(DEFAULT_SHELL);
  const child = cpSpawn(DEFAULT_SHELL, shellArgs, {
    cwd: DEFAULT_CWD,
    env: { ...process.env, ...shellEnv } as NodeJS.ProcessEnv,
    stdio: 'pipe',
    windowsHide: true,
  });

  child.stdout?.on('data', (chunk: Buffer) => broadcast(chunk.toString()));
  child.stderr?.on('data', (chunk: Buffer) => broadcast(chunk.toString()));
  child.on('exit', notifyExit);
  child.on('error', (err: Error) => broadcast(`\r\n\x1b[31mError: ${err.message}\x1b[0m\r\n`));

  session.localPty = {
    write: (data: string) => { child.stdin?.write(data); },
    resize: () => { /* no-op without real PTY */ },
    kill: () => { child.kill(); },
  } as unknown as IPty;

  return { kill: () => { try { child.kill(); } catch {} } };
}
