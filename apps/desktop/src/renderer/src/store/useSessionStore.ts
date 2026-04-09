import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { ShellProfile } from '@shared/types/terminal';
import { generateId } from '../utils/id';

export interface SessionEntry {
  id: string;
  kind: 'system' | 'command' | 'output';
  text: string;
  createdAt: number;
}

export interface SessionRemoteState {
  code: string;
  url: string;
}

export interface SessionRecord {
  id: string;
  paneId: string;
  profileId: string;
  profileName: string;
  title: string;
  status: 'starting' | 'ready' | 'exited';
  initialized: boolean;
  draft: string;
  pendingCommand: string | null;
  terminalBuffer: string;
  entries: SessionEntry[];
  remote: SessionRemoteState | null;
  /** Set for relay-hosted sessions created from the browser (no Electron). */
  relayCode?: string;
}

interface SessionState {
  profiles: ShellProfile[];
  sessions: SessionRecord[];
  activeSessionId: string | null;
  setProfiles: (profiles: ShellProfile[]) => void;
  createSession: (profileId?: string) => string | null;
  /** Creates a relay session and sets it as the active session. */
  createRelaySession: (code: string, title?: string) => string;
  /** Adds a relay session from sync without changing the active session. */
  addRelaySession: (code: string, title: string) => string;
  ensureInitialSession: () => void;
  setActiveSession: (sessionId: string) => void;
  setDraft: (sessionId: string, draft: string) => void;
  markInitialized: (sessionId: string) => void;
  appendEntry: (sessionId: string, entry: Omit<SessionEntry, 'id' | 'createdAt'>) => void;
  appendOutput: (sessionId: string, text: string) => void;
  markExited: (sessionId: string) => void;
  setRemoteState: (sessionId: string, remote: SessionRemoteState | null) => void;
  renameSession: (sessionId: string, title: string) => void;
  removeSession: (sessionId: string) => void;
}

export const useSessionStore = create<SessionState>()(
  immer((set, get) => ({
    profiles: [],
    sessions: [],
    activeSessionId: null,

    setProfiles: (profiles) =>
      set((state) => {
        state.profiles = profiles;
      }),

    createSession: (profileId) => {
      const state = get();
      const profile =
        state.profiles.find((candidate) => candidate.id === profileId) ??
        state.profiles[0];

      if (!profile) {
        return null;
      }

      const sessionId = generateId();
      const session: SessionRecord = {
        id: sessionId,
        paneId: generateId(),
        profileId: profile.id,
        profileName: profile.name,
        title: `Session ${state.sessions.length + 1}`,
        status: 'starting',
        initialized: false,
        draft: '',
        pendingCommand: null,
        terminalBuffer: '',
        entries: [
          {
            id: generateId(),
            kind: 'system',
            text: `Started ${profile.name}`,
            createdAt: Date.now(),
          },
        ],
        remote: null,
      };

      set((draft) => {
        draft.sessions.push(session);
        draft.activeSessionId = sessionId;
      });

      return sessionId;
    },

    createRelaySession: (code, title) => {
      const state = get();
      const sessionId = generateId();
      const session: SessionRecord = {
        id: sessionId,
        paneId: generateId(),
        profileId: 'relay',
        profileName: 'Shell',
        title: title ?? `Session ${state.sessions.length + 1}`,
        status: 'ready',
        initialized: true,
        draft: '',
        pendingCommand: null,
        terminalBuffer: '',
        entries: [],
        remote: null,
        relayCode: code,
      };
      set((draft) => {
        draft.sessions.push(session);
        draft.activeSessionId = sessionId;
      });
      return sessionId;
    },

    addRelaySession: (code, title) => {
      const sessionId = generateId();
      const session: SessionRecord = {
        id: sessionId,
        paneId: generateId(),
        profileId: 'relay',
        profileName: 'Shell',
        title,
        status: 'ready',
        initialized: true,
        draft: '',
        pendingCommand: null,
        terminalBuffer: '',
        entries: [],
        remote: null,
        relayCode: code,
      };
      set((draft) => {
        draft.sessions.push(session);
        // Only set active if nothing is currently active
        if (!draft.activeSessionId) {
          draft.activeSessionId = sessionId;
        }
      });
      return sessionId;
    },

    ensureInitialSession: () => {
      if (get().sessions.length === 0) {
        get().createSession();
      }
    },

    setActiveSession: (sessionId) =>
      set((state) => {
        state.activeSessionId = sessionId;
      }),

    setDraft: (sessionId, draft) =>
      set((state) => {
        const session = state.sessions.find((candidate) => candidate.id === sessionId);
        if (session) {
          session.draft = draft;
        }
      }),

    markInitialized: (sessionId) =>
      set((state) => {
        const session = state.sessions.find((candidate) => candidate.id === sessionId);
        if (session) {
          session.initialized = true;
          session.status = 'ready';
        }
      }),

    appendOutput: (sessionId, text) =>
      set((state) => {
        const session = state.sessions.find((candidate) => candidate.id === sessionId);
        if (!session || text.length === 0) return;

        const normalized = normalizeShellOutput(text, session.pendingCommand);
        session.terminalBuffer += text;
        if (!normalized) return;

        const previous = session.entries[session.entries.length - 1];
        if (previous?.kind === 'output') {
          previous.text += normalized;
          session.pendingCommand = null;
          return;
        }

        session.entries.push({
          id: generateId(),
          kind: 'output',
          text: normalized,
          createdAt: Date.now(),
        });
        session.pendingCommand = null;
      }),

    markExited: (sessionId) =>
      set((state) => {
        const session = state.sessions.find((candidate) => candidate.id === sessionId);
        if (!session) return;
        session.status = 'exited';
        session.entries.push({
          id: generateId(),
          kind: 'system',
          text: 'Session ended',
          createdAt: Date.now(),
        });
      }),

    setRemoteState: (sessionId, remote) =>
      set((state) => {
        const session = state.sessions.find((candidate) => candidate.id === sessionId);
        if (!session) return;
        session.remote = remote;
      }),

    renameSession: (sessionId, title) =>
      set((state) => {
        const session = state.sessions.find((candidate) => candidate.id === sessionId);
        if (session && title.trim().length > 0) {
          session.title = title.trim();
        }
      }),

    appendEntry: (sessionId, entry) =>
      set((state) => {
        const session = state.sessions.find((candidate) => candidate.id === sessionId);
        if (!session) return;
        session.entries.push({
          id: generateId(),
          createdAt: Date.now(),
          ...entry,
        });
        if (entry.kind === 'command') {
          session.pendingCommand = entry.text;
        }
      }),

    removeSession: (sessionId) =>
      set((state) => {
        const index = state.sessions.findIndex((candidate) => candidate.id === sessionId);
        if (index === -1) return;

        state.sessions.splice(index, 1);
        if (state.activeSessionId === sessionId) {
          state.activeSessionId = state.sessions[Math.max(0, index - 1)]?.id ?? state.sessions[0]?.id ?? null;
        }
      }),
  }))
);

function normalizeShellOutput(text: string, pendingCommand: string | null): string {
  let normalized = text
    .replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g, '')
    .replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  const lines = normalized
    .split('\n')
    .map((line) => line.replace(/\s+$/g, ''))
    .filter((line) => line.length > 0)
    .filter((line) => !/^[A-Z]:\\.*\.exe$/i.test(line))
    .filter((line) => !/^PS [^>]*>\s*$/.test(line))
    .filter((line) => !/^[A-Z]?>\s*$/.test(line));

  const filtered = pendingCommand
    ? lines.filter((line) => !line.includes(pendingCommand))
    : lines;

  if (filtered.length === 0) {
    return '';
  }

  return `${filtered.join('\n')}\n`;
}
