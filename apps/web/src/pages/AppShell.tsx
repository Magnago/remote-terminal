import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRelayUrl } from '../hooks/useRelayUrl';
import { useControlSync } from '../hooks/useControlSync';
import MobileTerminal from '../components/MobileTerminal';

export default function AppShell(): React.JSX.Element {
  const { relayUrl, wsBase, clearRelayUrl } = useRelayUrl();
  const { sessions, status } = useControlSync(wsBase);
  const [activeCode, setActiveCode] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const [vpHeight, setVpHeight] = useState(() => window.visualViewport?.height ?? window.innerHeight);
  const [notifPerm, setNotifPerm] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  );
  // Activity tracking
  const [activeCodes, setActiveCodes] = useState<Set<string>>(new Set());
  const activityTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  // Rename state
  const [renamingCode, setRenamingCode] = useState<string | null>(null);

  // Reference screen height once — used to detect keyboard open state
  const screenAvailH = useRef(window.screen.availHeight || window.innerHeight);

  useEffect(() => {
    const update = () => setVpHeight(window.visualViewport?.height ?? window.innerHeight);
    window.visualViewport?.addEventListener('resize', update);
    window.addEventListener('resize', update);
    return () => {
      window.visualViewport?.removeEventListener('resize', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('relay-active-code');
    if (saved) setActiveCode(saved);
  }, []);

  useEffect(() => {
    if (sessions.length === 0) { setActiveCode(null); return; }
    setActiveCode((prev) => {
      const still = sessions.find((s) => s.code === prev);
      const next = still ? prev : sessions[0].code;
      localStorage.setItem('relay-active-code', next ?? '');
      return next;
    });
  }, [sessions]);

  const activeSession = sessions.find((s) => s.code === activeCode);

  useEffect(() => {
    document.title = activeSession ? `${activeSession.title} — Terminal` : 'Awesome Terminal';
  }, [activeSession]);

  const switchSession = useCallback((code: string) => {
    setActiveCode(code);
    localStorage.setItem('relay-active-code', code);
    if (isMobile) setSidebarOpen(false);
  }, [isMobile]);

  // Wake lock
  useEffect(() => {
    if (sessions.length === 0) return;
    let sentinel: { release: () => Promise<void> } | null = null;
    const acquire = async () => {
      try { sentinel = await (navigator as any).wakeLock?.request('screen'); } catch {} // eslint-disable-line @typescript-eslint/no-explicit-any
    };
    void acquire();
    const onVisible = () => { if (document.visibilityState === 'visible') void acquire(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { document.removeEventListener('visibilitychange', onVisible); void sentinel?.release(); };
  }, [sessions.length]);

  // Swipe left/right on terminal area to switch sessions
  const swipeTouchX = useRef(0);
  const swipeTouchY = useRef(0);
  const onSwipeStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    swipeTouchX.current = e.touches[0].clientX;
    swipeTouchY.current = e.touches[0].clientY;
  };
  const onSwipeEnd = useCallback((e: React.TouchEvent) => {
    if (e.changedTouches.length !== 1) return;
    const dx = e.changedTouches[0].clientX - swipeTouchX.current;
    const dy = e.changedTouches[0].clientY - swipeTouchY.current;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    const idx = sessions.findIndex(s => s.code === activeCode);
    if (dx < 0 && idx < sessions.length - 1) switchSession(sessions[idx + 1].code);
    if (dx > 0 && idx > 0) switchSession(sessions[idx - 1].code);
  }, [sessions, activeCode, switchSession]);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Activity indicator
  const handleActivity = useCallback((code: string) => {
    setActiveCodes(prev => new Set([...prev, code]));
    const existing = activityTimers.current.get(code);
    if (existing) clearTimeout(existing);
    const t = setTimeout(() => {
      setActiveCodes(prev => { const n = new Set(prev); n.delete(code); return n; });
      activityTimers.current.delete(code);
    }, 2000);
    activityTimers.current.set(code, t);
  }, []);

  const handleRename = async (code: string, _newTitle: string) => {
    setRenamingCode(null);
    switchSession(code);
  };

  const closeSession = useCallback(async (code: string) => {
    try {
      await fetch(`${relayUrl}/api/sessions/${code}`, { method: 'DELETE' });
    } catch {}
  }, [relayUrl]);

  const requestNotifications = async () => {
    if (typeof Notification === 'undefined') return;
    setNotifPerm(await Notification.requestPermission());
  };

  const statusDot = (
    <span style={{
      width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
      background: status === 'live' ? '#4ade80' : status === 'connecting' ? '#facc15' : '#ef4444',
    }} />
  );

  // Sidebar (used on desktop and as bottom-sheet on mobile)
  const sidebar = (
    <aside style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: 'radial-gradient(circle at top left, rgba(214,137,91,0.16), transparent 32%), #12131b',
      borderRight: isMobile ? 'none' : '1px solid rgba(255,255,255,0.08)',
      padding: 16, gap: 12, minWidth: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 22, fontFamily: 'Georgia, serif', flex: 1 }}>Sessions</span>
        {statusDot}
        <button onPointerDown={(e) => { e.preventDefault(); clearRelayUrl(); }} style={{ ...iconBtn, fontSize: 11 }} title="Change relay URL">⚙</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {sessions.length === 0 && status === 'live' && (
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, textAlign: 'center', marginTop: 24 }}>
            Open a session in the desktop app to view it here.
          </p>
        )}
        {sessions.map((session) => {
          const isActive = session.code === activeCode;
          const hasActivity = activeCodes.has(session.code) && !isActive;
          return (
            <button
              key={session.code}
              onClick={() => { if (renamingCode !== session.code) switchSession(session.code); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                width: '100%', padding: '10px 12px', borderRadius: 12,
                border: isActive ? '1px solid rgba(214,137,91,0.38)' : '1px solid transparent',
                background: isActive ? 'rgba(255,255,255,0.06)' : 'transparent',
                color: 'inherit', cursor: 'pointer', textAlign: 'left', touchAction: 'manipulation',
              }}
            >
              <span style={{
                width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                background: hasActivity ? '#4ade80' : '#8aa1ff',
                boxShadow: hasActivity ? '0 0 8px rgba(74,222,128,0.8)' : 'none',
                transition: 'background 0.3s, box-shadow 0.3s',
              }} />

              {renamingCode === session.code ? (
                <input
                  autoFocus
                  defaultValue={session.title}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    flex: 1, background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(214,137,91,0.4)', borderRadius: 4,
                    color: '#e0e0e0', padding: '2px 6px', fontSize: 14, outline: 'none',
                  }}
                  onBlur={(e) => { void handleRename(session.code, e.currentTarget.value); }}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Enter') void handleRename(session.code, e.currentTarget.value);
                    if (e.key === 'Escape') setRenamingCode(null);
                  }}
                />
              ) : (
                <span style={{ flex: 1, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {session.title}
                </span>
              )}

              <span
                onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); void closeSession(session.code); }}
                style={{ ...iconBtn, fontSize: 16 }}
                title="Close session"
              >×</span>

            </button>
          );
        })}
      </div>

      <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, lineHeight: 1.5 }}>
        Sessions are created and owned by the desktop app.
      </div>
    </aside>
  );

  // ── Mobile layout ──────────────────────────────────────────────────────────
  if (isMobile) {
    // #6: Two-mode layout — detect keyboard open by comparing visual viewport height to screen height
    const kbOpen = vpHeight < screenAvailH.current * 0.72;

    return (
      <div style={{ width: '100%', height: vpHeight, display: 'flex', flexDirection: 'column', background: '#0f1117', position: 'relative', overflow: 'hidden' }}>

        {/* #6: Header — hidden when keyboard is open (saves ~44px for the terminal) */}
        {!kbOpen && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 14px', background: '#12131b',
            borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0,
          }}>
            {statusDot}
            <span style={{ flex: 1, fontSize: 16, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {activeSession?.title ?? 'No session'}
            </span>
            {typeof Notification !== 'undefined' && (
              <button onClick={() => { void requestNotifications(); }} style={{ ...iconBtn, fontSize: 18, padding: '2px 6px' }} title={notifPerm === 'granted' ? 'Notifications on' : 'Enable finish notifications'}>
                {notifPerm === 'granted' ? '🔔' : '🔕'}
              </button>
            )}
            <button onClick={() => setSidebarOpen(true)} style={{ ...iconBtn, fontSize: 22, padding: '2px 6px' }} title="All sessions">≡</button>
          </div>
        )}

        {/* Terminal area */}
        <div style={{ flex: 1, minHeight: 0, position: 'relative' }} onTouchStart={onSwipeStart} onTouchEnd={onSwipeEnd}>
          {sessions.map((session) => (
            <div key={session.code} style={{
              position: 'absolute', inset: 0,
              visibility: session.code === activeCode ? 'visible' : 'hidden',
              pointerEvents: session.code === activeCode ? 'auto' : 'none',
            }}>
              <MobileTerminal
                code={session.code}
                title={session.title}
                wsBase={wsBase}
                active={session.code === activeCode}
                onActivity={() => handleActivity(session.code)}
                onExit={() => { void closeSession(session.code); }}
              />
            </div>
          ))}
          {sessions.length === 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(255,255,255,0.3)', fontSize: 14, flexDirection: 'column', gap: 16 }}>
              <span style={{ fontSize: 32 }}>⌨</span>
              Start a session in the desktop app
            </div>
          )}
        </div>

        {/* #5: Session tab bar — horizontal scrollable pills, always visible */}
        <div style={{
          display: 'flex', alignItems: 'center',
          background: '#12131b',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          overflowX: 'auto', flexShrink: 0,
          minHeight: 44, padding: '0 8px', gap: 6,
          // Hide scrollbar but keep it scrollable
          scrollbarWidth: 'none',
        }}>
          {sessions.map((session) => {
            const isActive = session.code === activeCode;
            const hasActivity = activeCodes.has(session.code) && !isActive;
            return (
              <button
                key={session.code}
                onPointerDown={() => switchSession(session.code)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  flexShrink: 0, height: 32, padding: '0 10px 0 8px',
                  borderRadius: 999,
                  border: isActive ? '1px solid rgba(214,137,91,0.55)' : '1px solid rgba(255,255,255,0.1)',
                  background: isActive ? 'rgba(214,137,91,0.14)' : 'rgba(255,255,255,0.04)',
                  color: isActive ? '#d6895b' : 'rgba(255,255,255,0.55)',
                  fontSize: 12, maxWidth: 140, cursor: 'pointer',
                  touchAction: 'manipulation', transition: 'background 0.15s, border-color 0.15s',
                }}
              >
                {/* Activity/status dot */}
                <span style={{
                  width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                  background: hasActivity ? '#4ade80' : isActive ? '#d6895b' : 'rgba(255,255,255,0.3)',
                  boxShadow: hasActivity ? '0 0 6px rgba(74,222,128,0.8)' : 'none',
                  transition: 'background 0.3s, box-shadow 0.3s',
                }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                  {session.title}
                </span>
                <span
                  onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); void closeSession(session.code); }}
                  style={{ fontSize: 14, opacity: 0.6, marginLeft: 2, lineHeight: 1, flexShrink: 0 }}
                >×</span>
              </button>
            );
          })}
        </div>

        {/* Full session list — bottom sheet */}
        {sidebarOpen && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100 }} onClick={() => setSidebarOpen(false)}>
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '60%', borderRadius: '20px 20px 0 0', overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
              {sidebar}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Desktop layout ─────────────────────────────────────────────────────────
  return (
    <div style={{ width: '100%', height: '100%', display: 'grid', gridTemplateColumns: '280px 1fr', minHeight: 0 }}>
      {sidebar}
      <main style={{ minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', background: '#0f1117', position: 'relative' }}>
        {activeSession ? (
          <>
            <div style={{ padding: '18px 22px 12px', borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.015)', flexShrink: 0 }}>
              <div style={{ fontSize: 22, fontWeight: 600 }}>{activeSession.title}</div>
              <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, marginTop: 4 }}>Connected</div>
            </div>
            <div style={{ flex: 1, minHeight: 0, padding: 14 }}>
              <div style={{ height: '100%', borderRadius: 14, border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden', position: 'relative' }}>
                {sessions.map((session) => (
                  <div key={session.code} style={{
                    position: 'absolute', inset: 0,
                    visibility: session.code === activeCode ? 'visible' : 'hidden',
                    pointerEvents: session.code === activeCode ? 'auto' : 'none',
                  }}>
                    <MobileTerminal
                      code={session.code}
                      title={session.title}
                      wsBase={wsBase}
                      active={session.code === activeCode}
                      onActivity={() => handleActivity(session.code)}
                      onExit={() => { void closeSession(session.code); }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'grid', placeItems: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>
            Create a session to get started
          </div>
        )}
      </main>
    </div>
  );
}

const iconBtn: React.CSSProperties = {
  background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)',
  cursor: 'pointer', borderRadius: 6, padding: '4px 6px',
  touchAction: 'manipulation', userSelect: 'none', WebkitUserSelect: 'none', flexShrink: 0,
};
