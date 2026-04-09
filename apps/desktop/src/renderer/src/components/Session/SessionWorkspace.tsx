import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSessionStore } from '../../store/useSessionStore';
import RelayTerminalSurface from './RelayTerminalSurface';

const RELAY_BASE = 'http://localhost:3001';
const IS_ELECTRON = !!window.electronAPI;

export default function SessionWorkspace(): React.JSX.Element {
  const {
    sessions,
    activeSessionId,
    createRelaySession,
    setActiveSession,
    markExited,
    removeSession,
    renameSession,
  } = useSessionStore();

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null;
  const initialSyncDone = useRef(false);

  // Activity tracking — which sessions are currently receiving output
  const [activityIds, setActivityIds] = useState<Set<string>>(new Set());
  const activityTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const handleActivity = useCallback((sessionId: string) => {
    setActivityIds(prev => new Set([...prev, sessionId]));
    const existing = activityTimers.current.get(sessionId);
    if (existing) clearTimeout(existing);
    const t = setTimeout(() => {
      setActivityIds(prev => { const n = new Set(prev); n.delete(sessionId); return n; });
      activityTimers.current.delete(sessionId);
    }, 2000);
    activityTimers.current.set(sessionId, t);
  }, []);

  // Rename state
  const [renamingId, setRenamingId] = useState<string | null>(null);

  // Control WS — real-time session sync from relay
  useEffect(() => {
    const relayUrl = new URL(RELAY_BASE);
    const wsProtocol = relayUrl.protocol === 'https:' ? 'wss:' : 'ws:';
    let ws: WebSocket;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    const connect = () => {
      ws = new WebSocket(`${wsProtocol}//${relayUrl.host}/control`);

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as {
            type: string;
            sessions?: Array<{ code: string; title: string }>;
          };

          if (msg.type === 'sessions-updated' && msg.sessions) {
            const store = useSessionStore.getState();
            const relayCodes = msg.sessions.map((s) => s.code);

            // Remove sessions gone from relay
            store.sessions
              .filter((s) => s.relayCode && !relayCodes.includes(s.relayCode))
              .forEach((s) => store.removeSession(s.id));

            // Add new / update renamed sessions
            msg.sessions.forEach(({ code, title }) => {
              const exists = useSessionStore.getState().sessions.find((s) => s.relayCode === code);
              if (!exists) {
                store.addRelaySession(code, title);
              } else if (exists.title !== title) {
                // Relay renamed this session (PTY title or manual rename)
                store.renameSession(exists.id, title);
              }
            });

            if (!initialSyncDone.current) {
              initialSyncDone.current = true;
              if (msg.sessions.length === 0 && IS_ELECTRON) {
                void createNewSession();
              } else {
                const state = useSessionStore.getState();
                if (!state.activeSessionId && state.sessions.length > 0) {
                  state.setActiveSession(state.sessions[0].id);
                }
              }
            }
          }
        } catch {}
      };

      ws.onclose = () => { reconnectTimer = setTimeout(connect, 2000); };
      ws.onerror = () => { ws.close(); };
    };

    connect();
    return () => { clearTimeout(reconnectTimer); ws?.close(); };
  }, []);

  const createNewSession = async (): Promise<void> => {
    const store = useSessionStore.getState();
    const nextNum = store.sessions.length + 1;
    try {
      const resp = await fetch(`${RELAY_BASE}/api/local-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: `Session ${nextNum}` }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json() as { code: string; title: string };
      const existing = useSessionStore.getState().sessions.find((s) => s.relayCode === data.code);
      if (existing) {
        useSessionStore.getState().setActiveSession(existing.id);
      } else {
        createRelaySession(data.code, data.title);
      }
    } catch (err) {
      console.error('[SessionWorkspace] Failed to create relay session:', err);
    }
  };

  const closeSession = useCallback(async (sessionId: string) => {
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) return;
    if (session.relayCode) {
      try { await fetch(`${RELAY_BASE}/api/sessions/${session.relayCode}`, { method: 'DELETE' }); } catch {}
    }
    removeSession(sessionId);
    if (useSessionStore.getState().sessions.length === 0 && IS_ELECTRON) {
      void createNewSession();
    }
  }, [sessions, removeSession]);

  const handleRename = async (sessionId: string, relayCode: string | undefined, newTitle: string) => {
    setRenamingId(null);
    if (!newTitle.trim()) return;
    renameSession(sessionId, newTitle.trim());
    if (relayCode) {
      try {
        await fetch(`${RELAY_BASE}/api/sessions/${relayCode}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: newTitle.trim() }),
        });
      } catch {}
    }
  };

  return (
    <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '300px 1fr', minHeight: 0 }}>
      <aside style={{
        display: 'flex', flexDirection: 'column', minWidth: 0,
        background: 'radial-gradient(circle at top left, rgba(214,137,91,0.16), transparent 32%), #12131b',
        borderRight: '1px solid var(--color-border)',
        padding: 18, gap: 16,
      }}>
        <div>
          <div style={{ fontSize: 30, lineHeight: 1, marginBottom: 10, fontFamily: 'Georgia, serif' }}>Code</div>
          <div style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>
            Sessions sync across all connected clients.
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0, flex: 1, overflowY: 'auto' }}>
          {sessions.map((session) => {
            const isActive = activeSessionId === session.id;
            const hasActivity = activityIds.has(session.id) && !isActive;
            return (
              <button
                key={session.id}
                onClick={() => { if (renamingId !== session.id) setActiveSession(session.id); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  width: '100%', padding: '12px 14px', borderRadius: 14,
                  border: isActive ? '1px solid rgba(214,137,91,0.38)' : '1px solid transparent',
                  background: isActive ? 'rgba(255,255,255,0.06)' : 'transparent',
                  color: 'inherit', cursor: 'pointer', textAlign: 'left',
                }}
              >
                {/* Activity indicator dot */}
                <div style={{
                  width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                  background: hasActivity ? '#4ade80' : session.status === 'exited' ? 'rgba(255,255,255,0.26)' : '#8aa1ff',
                  boxShadow: hasActivity ? '0 0 8px rgba(74,222,128,0.8)' : 'none',
                  transition: 'background 0.3s, box-shadow 0.3s',
                }} />

                <div style={{ minWidth: 0, flex: 1 }}>
                  {renamingId === session.id ? (
                    <input
                      autoFocus
                      defaultValue={session.title}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        width: '100%', background: 'rgba(255,255,255,0.08)',
                        border: '1px solid rgba(214,137,91,0.4)', borderRadius: 4,
                        color: '#e0e0e0', padding: '2px 6px', fontSize: 15, outline: 'none',
                      }}
                      onBlur={(e) => { void handleRename(session.id, session.relayCode, e.currentTarget.value); }}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === 'Enter') void handleRename(session.id, session.relayCode, e.currentTarget.value);
                        if (e.key === 'Escape') setRenamingId(null);
                      }}
                    />
                  ) : (
                    <div style={{ fontSize: 16, color: 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {session.title}
                    </div>
                  )}
                  <div style={{ marginTop: 4, fontSize: 12, color: 'var(--color-text-muted)' }}>
                    {statusLabel(session.status)}
                  </div>
                </div>

                {/* Rename button */}
                <div
                  onClick={(e) => { e.stopPropagation(); setRenamingId(session.id); }}
                  style={{ ...closeBtn, fontSize: 13, opacity: 0.4 }}
                  title="Rename session"
                >✎</div>

                {/* Close button */}
                <div
                  onClick={(e) => { e.stopPropagation(); void closeSession(session.id); }}
                  style={closeBtn}
                  title="Close session"
                >×</div>
              </button>
            );
          })}
        </div>

        <button onClick={() => { void createNewSession(); }} style={primaryButtonStyle}>
          <span style={{ fontSize: 24, lineHeight: 1 }}>+</span>
          New session
        </button>
      </aside>

      <main style={{
        minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column',
        background: 'linear-gradient(180deg, rgba(20,21,30,0.98) 0%, rgba(12,13,20,1) 100%)',
      }}>
        {activeSession ? (
          <>
            <div style={{ padding: '20px 24px 14px', borderBottom: '1px solid var(--color-border)', background: 'rgba(255,255,255,0.015)' }}>
              <div style={{ fontSize: 24, fontWeight: 600, marginBottom: 6 }}>{activeSession.title}</div>
              <div style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>{statusLabel(activeSession.status)}</div>
            </div>

            <div style={{ flex: 1, minHeight: 0, padding: 16 }}>
              <div style={{ height: '100%', borderRadius: 16, border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden', background: '#0f1117', position: 'relative', boxShadow: '0 20px 54px rgba(0,0,0,0.32)' }}>
                {sessions.map((session) =>
                  session.relayCode ? (
                    <div key={session.id} style={{
                      position: 'absolute', inset: 0,
                      visibility: session.id === activeSessionId ? 'visible' : 'hidden',
                      pointerEvents: session.id === activeSessionId ? 'auto' : 'none',
                    }}>
                      <RelayTerminalSurface
                        code={session.relayCode}
                        relayBase={RELAY_BASE}
                        active={session.id === activeSessionId}
                        onActivity={() => handleActivity(session.id)}
                        onExit={() => markExited(session.id)}
                      />
                    </div>
                  ) : null
                )}
              </div>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'grid', placeItems: 'center', color: 'var(--color-text-muted)' }}>
            No active session
          </div>
        )}
      </main>
    </div>
  );
}

function statusLabel(status: 'starting' | 'ready' | 'exited'): string {
  if (status === 'starting') return 'Booting';
  if (status === 'exited') return 'Ended';
  return 'Connected';
}

const closeBtn: React.CSSProperties = {
  width: 22, height: 22, borderRadius: 999,
  display: 'grid', placeItems: 'center',
  color: 'var(--color-text-muted)', flexShrink: 0, cursor: 'pointer',
};

const primaryButtonStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  gap: 10, border: 'none', borderRadius: 999, background: '#d6895b',
  color: '#fff8f2', cursor: 'pointer', height: 44, padding: '0 20px',
  fontWeight: 600, fontSize: 15,
};
