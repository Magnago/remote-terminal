import { WebSocket } from 'ws';
import type { IPty } from 'node-pty';

const OUTPUT_BUFFER_MAX = 100 * 1024; // 100 KB replay buffer per session

export interface Session {
  code: string;
  title: string;
  desktopSocket: WebSocket | null;
  browserSockets: Set<WebSocket>;
  createdAt: number;
  lastActivity: number;
  localPty?: IPty;
  /** Rolling buffer of recent PTY output — replayed to browsers that connect late. */
  outputBuffer: string;
  outputVersion: number;
}

export { OUTPUT_BUFFER_MAX };

const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Strip cursor-movement and screen-manipulation sequences from raw PTY output
 * before storing in the replay buffer. Colors and text formatting are kept.
 * This prevents garbled display when the buffer is replayed on a fresh terminal.
 */
export function cleanForReplay(data: string): string {
  return data
    // Cursor movement (A-H), erase display/line (J,K), scroll (S,T), save/restore (s,u,f)
    .replace(/\x1b\[[0-9;]*[ABCDEFGHJKSTfsu]/g, '')
    // Private mode sequences — alternate screen, cursor visibility, bracketed paste, etc.
    .replace(/\x1b\[\?[0-9;]*[hl]/g, '')
    // Bare carriage return (without newline) → newline so overwritten lines stack instead of overlap
    .replace(/\r(?!\n)/g, '\n');
}

export class SessionManager {
  private sessions = new Map<string, Session>();
  private listeners = new Set<() => void>();

  onSessionsChange(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private notifyChange(): void {
    this.listeners.forEach((cb) => cb());
  }

  createSession(code: string, title?: string): Session {
    const session: Session = {
      code,
      title: title ?? `Session ${this.sessions.size + 1}`,
      desktopSocket: null,
      browserSockets: new Set(),
      createdAt: Date.now(),
      lastActivity: Date.now(),
      outputBuffer: '',
      outputVersion: 0,
    };
    this.sessions.set(code, session);
    this.scheduleExpiry(code);
    this.notifyChange();
    return session;
  }

  getSession(code: string): Session | undefined {
    return this.sessions.get(code);
  }

  getSessions(): Array<{ code: string; title: string }> {
    return Array.from(this.sessions.values()).map(({ code, title }) => ({ code, title }));
  }

  deleteSession(code: string): void {
    const session = this.sessions.get(code);
    if (session?.localPty) {
      try { session.localPty.kill(); } catch {}
    }
    this.sessions.delete(code);
    console.log(`[Relay] Session ${code} deleted`);
    this.notifyChange();
  }

  updateTitle(code: string, title: string): void {
    const session = this.sessions.get(code);
    if (!session || !title.trim() || session.title === title.trim()) return;
    session.title = title.trim();
    this.notifyChange();
  }

  appendOutput(code: string, data: string): number {
    const session = this.sessions.get(code);
    if (!session) return 0;
    session.outputBuffer += cleanForReplay(data);
    if (session.outputBuffer.length > OUTPUT_BUFFER_MAX) {
      session.outputBuffer = session.outputBuffer.slice(session.outputBuffer.length - OUTPUT_BUFFER_MAX);
    }
    session.outputVersion += 1;
    return session.outputVersion;
  }

  touch(code: string): void {
    const session = this.sessions.get(code);
    if (session) session.lastActivity = Date.now();
  }

  get count(): number {
    return this.sessions.size;
  }

  private scheduleExpiry(code: string): void {
    setTimeout(() => {
      const session = this.sessions.get(code);
      if (!session) return;
      const idle = Date.now() - session.lastActivity;
      if (idle >= SESSION_TTL_MS) {
        session.desktopSocket?.close();
        if (session.localPty) {
          try { session.localPty.kill(); } catch {}
        }
        session.browserSockets.forEach((ws) => ws.close());
        this.deleteSession(code);
      }
    }, SESSION_TTL_MS);
  }
}
