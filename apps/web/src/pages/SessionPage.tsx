import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';

type ConnectionStatus = 'idle' | 'connecting' | 'waiting' | 'connected' | 'disconnected' | 'error';

interface StoredSession {
  code: string;
  label: string;
}

const STORAGE_KEY = 'remote-terminal-web-sessions';

function normalizeCode(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}

function loadStoredSessions(): StoredSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredSession[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((session) => ({ code: normalizeCode(session.code), label: (session.label || '').trim() }))
      .filter((session) => session.code.length === 6);
  } catch {
    return [];
  }
}

function saveStoredSessions(sessions: StoredSession[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

function statusColor(status: ConnectionStatus): string {
  if (status === 'connected') return '#23d18b';
  if (status === 'waiting' || status === 'connecting') return '#f5a623';
  if (status === 'disconnected' || status === 'error') return '#f14c4c';
  return 'rgba(255,255,255,0.35)';
}

function statusLabel(status: ConnectionStatus): string {
  if (status === 'connected') return 'Connected';
  if (status === 'waiting') return 'Waiting for desktop';
  if (status === 'connecting') return 'Connecting';
  if (status === 'disconnected') return 'Disconnected';
  if (status === 'error') return 'Connection error';
  return 'Idle';
}

function TerminalPanel({
  code,
  onStatusChange,
}: {
  code: string | null;
  onStatusChange: (status: ConnectionStatus) => void;
}): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!containerRef.current || !code) {
      onStatusChange('idle');
      return;
    }

    const term = new Terminal({
      fontFamily: "'Cascadia Code', Consolas, monospace",
      fontSize: 14,
      theme: {
        background: '#0e0e16',
        foreground: '#e0e0e0',
        cursor: '#d6895b',
        selectionBackground: 'rgba(214,137,91,0.35)',
      },
      cursorBlink: true,
      scrollback: 10000,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon());
    term.open(containerRef.current);
    fitAddon.fit();

    onStatusChange('connecting');
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}/browser?code=${code}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => onStatusChange('connecting');
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'session-ready') {
          onStatusChange('connected');
          term.writeln('\x1b[32mConnected to remote session.\x1b[0m');
        } else if (msg.type === 'waiting-for-desktop') {
          onStatusChange('waiting');
          term.writeln('\x1b[33mWaiting for desktop to connect...\x1b[0m');
        } else if (msg.type === 'data') {
          term.write(msg.payload);
        } else if (msg.type === 'desktop-disconnected') {
          onStatusChange('disconnected');
          term.writeln('\r\n\x1b[31mDesktop disconnected.\x1b[0m');
        }
      } catch {}
    };

    ws.onerror = () => onStatusChange('error');
    ws.onclose = () => onStatusChange('disconnected');

    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'data', payload: data }));
      }
    });

    const resizeObserver = new ResizeObserver(() => {
      try {
        fitAddon.fit();
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
        }
      } catch {}
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      ws.close();
      term.dispose();
    };
  }, [code, onStatusChange]);

  if (!code) {
    return (
      <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: 'rgba(255,255,255,0.45)' }}>
        Create or select a session.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div ref={containerRef} style={{ flex: 1, padding: '6px', overflow: 'hidden' }} />
      <div
        style={{
          display: 'flex',
          gap: 4,
          padding: '6px 8px',
          background: '#10101a',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          flexShrink: 0,
          overflowX: 'auto',
        }}
      >
        {[
          { label: 'Ctrl', key: '\x03' },
          { label: 'Alt', key: '\x1b' },
          { label: 'Tab', key: '\t' },
          { label: 'Esc', key: '\x1b' },
          { label: 'Up', key: '\x1b[A' },
          { label: 'Down', key: '\x1b[B' },
          { label: 'Left', key: '\x1b[D' },
          { label: 'Right', key: '\x1b[C' },
        ].map(({ label, key }) => (
          <button
            key={label}
            onClick={() => {
              if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({ type: 'data', payload: key }));
              }
            }}
            style={{
              padding: '6px 10px',
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 5,
              color: 'rgba(255,255,255,0.8)',
              cursor: 'pointer',
              fontSize: 12,
              fontFamily: 'monospace',
              flexShrink: 0,
              minWidth: 36,
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function SessionPage(): React.JSX.Element {
  const navigate = useNavigate();
  const { code: routeCode } = useParams<{ code: string }>();
  const [sessions, setSessions] = useState<StoredSession[]>(() => loadStoredSessions());
  const [activeCode, setActiveCode] = useState<string | null>(() => normalizeCode(routeCode || '') || null);
  const [newCode, setNewCode] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle');

  useEffect(() => {
    if (sessions.length === 0) return;
    const hasActive = activeCode && sessions.some((session) => session.code === activeCode);
    if (!hasActive) {
      setActiveCode(sessions[0].code);
    }
  }, [activeCode, sessions]);

  useEffect(() => {
    saveStoredSessions(sessions);
  }, [sessions]);

  useEffect(() => {
    const normalized = normalizeCode(routeCode || '');
    if (!normalized) return;

    setSessions((previous) => {
      if (previous.some((session) => session.code === normalized)) {
        return previous;
      }
      return [{ code: normalized, label: `Session ${normalized}` }, ...previous];
    });
    setActiveCode(normalized);
  }, [routeCode]);

  useEffect(() => {
    if (activeCode) {
      navigate(`/session/${activeCode}`, { replace: true });
    } else {
      navigate('/', { replace: true });
    }
  }, [activeCode, navigate]);

  const createSession = () => {
    const code = normalizeCode(newCode);
    if (code.length !== 6) return;

    setSessions((previous) => {
      if (previous.some((session) => session.code === code)) return previous;
      return [{ code, label: `Session ${code}` }, ...previous];
    });
    setActiveCode(code);
    setNewCode('');
  };

  const removeSession = (code: string) => {
    setSessions((previous) => {
      const filtered = previous.filter((session) => session.code !== code);
      if (activeCode === code) {
        setActiveCode(filtered[0]?.code ?? null);
      }
      return filtered;
    });
  };

  const currentSession = sessions.find((session) => session.code === activeCode) ?? null;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', height: '100%' }}>
      <aside
        style={{
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          background: 'radial-gradient(circle at top left, rgba(214,137,91,0.16), transparent 35%), #12131b',
          borderRight: '1px solid rgba(255,255,255,0.08)',
          padding: 18,
          gap: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 30, lineHeight: 1, marginBottom: 10, fontFamily: 'Georgia, serif', color: '#fff' }}>
            Code
          </div>
          <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12 }}>
            Add your desktop session code and switch between sessions.
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto',
            gap: 8,
            padding: 10,
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 12,
            background: 'rgba(255,255,255,0.02)',
          }}
        >
          <input
            value={newCode}
            onChange={(event) => setNewCode(normalizeCode(event.target.value))}
            onKeyDown={(event) => {
              if (event.key === 'Enter') createSession();
            }}
            placeholder="Session code"
            maxLength={6}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 8,
              color: '#fff',
              fontFamily: 'monospace',
              fontSize: 14,
              letterSpacing: 2,
              padding: '8px 10px',
              outline: 'none',
              textTransform: 'uppercase',
            }}
          />
          <button
            onClick={createSession}
            disabled={newCode.length !== 6}
            style={{
              border: 'none',
              borderRadius: 8,
              padding: '0 12px',
              fontWeight: 600,
              cursor: newCode.length === 6 ? 'pointer' : 'not-allowed',
              background: newCode.length === 6 ? '#d6895b' : 'rgba(255,255,255,0.12)',
              color: newCode.length === 6 ? '#fff8f2' : 'rgba(255,255,255,0.45)',
            }}
          >
            New session
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0, flex: 1, overflowY: 'auto' }}>
          {sessions.map((session) => (
            <button
              key={session.code}
              onClick={() => setActiveCode(session.code)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                borderRadius: 12,
                border:
                  session.code === activeCode
                    ? '1px solid rgba(214,137,91,0.4)'
                    : '1px solid rgba(255,255,255,0.06)',
                background: session.code === activeCode ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.02)',
                color: '#fff',
                textAlign: 'left',
                padding: '12px',
                cursor: 'pointer',
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: session.code === activeCode ? statusColor(connectionStatus) : 'rgba(255,255,255,0.35)',
                  flexShrink: 0,
                }}
              />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>{session.label}</div>
                <div style={{ marginTop: 2, fontSize: 12, color: 'rgba(255,255,255,0.55)', fontFamily: 'monospace' }}>
                  {session.code}
                </div>
              </div>
              <span
                onClick={(event) => {
                  event.stopPropagation();
                  removeSession(session.code);
                }}
                title="Remove session"
                style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, lineHeight: 1 }}
              >
                x
              </span>
            </button>
          ))}
        </div>
      </aside>

      <main
        style={{
          minWidth: 0,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(180deg, rgba(20,21,30,0.98) 0%, rgba(12,13,20,1) 100%)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 18px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            flexShrink: 0,
          }}
        >
          <div style={{ fontSize: 20, fontWeight: 600, color: '#fff' }}>{currentSession?.label ?? 'No session selected'}</div>
          <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.12)' }} />
          <code style={{ color: 'rgba(255,255,255,0.72)', letterSpacing: 2 }}>{activeCode ?? '------'}</code>
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor(connectionStatus) }} />
            <span style={{ fontSize: 12, color: statusColor(connectionStatus) }}>{statusLabel(connectionStatus)}</span>
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 0 }}>
          <TerminalPanel code={activeCode} onStatusChange={setConnectionStatus} />
        </div>
      </main>
    </div>
  );
}
