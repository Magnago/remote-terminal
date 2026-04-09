import React, { useEffect, useRef, useState } from 'react';
import '@xterm/xterm/css/xterm.css';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';

interface Props {
  code: string;
  title: string;
  wsBase: string;
  active: boolean;
  onActivity?: () => void;
  onExit?: () => void;
}

const KEY_MAP: Record<string, string> = {
  Backspace:  '\x7f',
  Enter:      '\r',
  Tab:        '\t',
  Escape:     '\x1b',
  ArrowUp:    '\x1b[A',
  ArrowDown:  '\x1b[B',
  ArrowLeft:  '\x1b[D',
  ArrowRight: '\x1b[C',
  Home:       '\x1b[H',
  End:        '\x1b[F',
  Delete:     '\x1b[3~',
  PageUp:     '\x1b[5~',
  PageDown:   '\x1b[6~',
};

// ↵ Enter is now a pinned Send button — removed from scrollable strip
const TOOLBAR_BUTTONS: Array<{ label: string; payload: string; title: string }> = [
  { label: 'Tab',    payload: '\t',     title: 'Tab' },
  { label: 'Esc',    payload: '\x1b',   title: 'Escape' },
  { label: '↑',      payload: '\x1b[A', title: 'Previous command' },
  { label: '↓',      payload: '\x1b[B', title: 'Next command' },
  { label: 'Ctrl+C', payload: '\x03',   title: 'Ctrl+C (interrupt)' },
];

const haptic = () => navigator.vibrate?.(8);

// Strip ANSI escape codes for prompt detection
const ANSI_RE = /\x1b\[[0-9;?]*[A-Za-z]|\x1b[()][AB012]/g;
// Shell prompt patterns — line ending with $, %, #, >, ❯ followed by optional spaces
const PROMPT_RE = /[$%#>❯]\s*$/m;

export default function MobileTerminal({ code, title, wsBase, active, onActivity, onExit }: Props): React.JSX.Element {
  const containerRef    = useRef<HTMLDivElement>(null);
  const keyboardRef     = useRef<HTMLTextAreaElement>(null);
  const termRef         = useRef<Terminal | null>(null);
  const fitAddonRef     = useRef<FitAddon | null>(null);
  const wsRef           = useRef<WebSocket | null>(null);
  const unmountedRef    = useRef(false);
  const reconnTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onActivityRef   = useRef(onActivity);
  const lastActivityRef = useRef(0);
  const maxSeenVersionRef = useRef(0);
  // #2: track scroll position without React re-render lag
  const atBottomRef     = useRef(true);
  useEffect(() => { onActivityRef.current = onActivity; }, [onActivity]);
  // Font size persisted across reloads
  const fontSizeRef  = useRef(parseFloat(localStorage.getItem('terminal-font-size') ?? '14'));
  const pinchDistRef = useRef(0);

  const [atBottom, setAtBottom]         = useState(true);
  const [hasSelection, setHasSelection] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [isLandscape, setIsLandscape]   = useState(() => window.innerWidth > window.innerHeight);

  useEffect(() => {
    const mq = window.matchMedia('(orientation: landscape)');
    const handler = (e: MediaQueryListEvent) => setIsLandscape(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    if (active) {
      try { fitAddonRef.current?.fit(); } catch {}
      termRef.current?.focus();
      keyboardRef.current?.focus({ preventScroll: true });
    }
  }, [active]);

  // Main setup — runs once per (code, wsBase)
  useEffect(() => {
    if (!containerRef.current) return;
    unmountedRef.current = false;

    // ── xterm.js ─────────────────────────────────────────────────────────────
    const term = new Terminal({
      fontFamily: "'Cascadia Code', Consolas, monospace",
      fontSize: fontSizeRef.current,
      theme: {
        background: '#0f1117',
        foreground: '#e0e0e0',
        cursor: '#d6895b',
        selectionBackground: 'rgba(214,137,91,0.35)',
      },
      cursorBlink: true,
      scrollback: 5000,
      convertEol: false,
      smoothScrollDuration: 180,
      scrollSensitivity: 0.85,
      fastScrollSensitivity: 2,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon());
    term.open(containerRef.current);
    try { fitAddon.fit(); } catch {}
    termRef.current     = term;
    fitAddonRef.current = fitAddon;

    // #2: Scroll position tracking — ref for use inside WS handler
    term.onScroll(() => {
      const buf = term.buffer.active;
      const ab = buf.viewportY >= buf.baseY;
      atBottomRef.current = ab;
      setAtBottom(ab);
    });

    // Copy-selection tracking
    term.onSelectionChange(() => setHasSelection(term.getSelection().length > 0));

    // ── Prompt detection for "agent finished" notifications ──────────────────
    let hadActivity = false;
    let lastNotifiedAt = 0;

    const checkForPrompt = (raw: string) => {
      const clean = raw.replace(ANSI_RE, '');
      if (PROMPT_RE.test(clean)) {
        if (
          hadActivity &&
          document.visibilityState === 'hidden' &&
          typeof Notification !== 'undefined' &&
          Notification.permission === 'granted' &&
          Date.now() - lastNotifiedAt > 5000
        ) {
          lastNotifiedAt = Date.now();
          new Notification(title, {
            body: 'Command finished',
            icon: '/icon.svg',
            tag: code,
          });
        }
        hadActivity = false;
      } else if (clean.replace(/\s/g, '').length > 5) {
        hadActivity = true;
      }
    };

    // ── WebSocket with ping/pong keep-alive and auto-reconnect ────────────────
    let hasConnectedOnce = false;
    let hasReceivedContent = false;

    const send = (payload: string) => {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'data', payload }));
      }
    };

    const sendResize = () => {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
      }
    };

    const connect = () => {
      if (unmountedRef.current) return;
      // Reset so reconnects accept the replay buffer from the relay
      hasReceivedContent = false;
      maxSeenVersionRef.current = 0;
      const ws = new WebSocket(`${wsBase}/browser?code=${code}`);
      wsRef.current = ws;

      let pingInterval: ReturnType<typeof setInterval> | null = null;

      ws.onopen = () => {
        hasConnectedOnce = true;
        setReconnecting(false);
        pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 30000);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as { type: string; payload?: string; version?: number };
          if (msg.type === 'replay' && msg.payload) {
            if (!hasReceivedContent) {
              term.reset();
              term.write(msg.payload);
              hasReceivedContent = true;
              maxSeenVersionRef.current = Math.max(maxSeenVersionRef.current, msg.version ?? 0);
              // Always scroll to bottom after replay
              term.scrollToBottom();
              atBottomRef.current = true;
              setAtBottom(true);
            }
          } else if (msg.type === 'data' && msg.payload) {
            if ((msg.version ?? 0) <= maxSeenVersionRef.current) {
              return;
            }
            maxSeenVersionRef.current = Math.max(maxSeenVersionRef.current, msg.version ?? 0);
            hasReceivedContent = true;
            term.write(msg.payload);
            checkForPrompt(msg.payload);
            const now = Date.now();
            if (now - lastActivityRef.current > 500) {
              lastActivityRef.current = now;
              onActivityRef.current?.();
            }
          } else if (msg.type === 'desktop-disconnected') {
            term.writeln('\r\n\x1b[31mSession ended.\x1b[0m');
            onExit?.();
          }
        } catch {}
      };

      ws.onerror = () => { /* onclose handles reconnect */ };

      ws.onclose = () => {
        if (pingInterval) { clearInterval(pingInterval); pingInterval = null; }
        if (unmountedRef.current) return;
        wsRef.current = null;
        if (hasConnectedOnce) setReconnecting(true);
        reconnTimerRef.current = setTimeout(() => {
          if (!unmountedRef.current) connect();
        }, 2000);
      };
    };

    connect();

    // Re-connect immediately when app comes to foreground
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const ws = wsRef.current;
        if (!ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
          if (reconnTimerRef.current) { clearTimeout(reconnTimerRef.current); reconnTimerRef.current = null; }
          connect();
        }
        try { fitAddon.fit(); } catch {}
        sendResize();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    term.onData((data) => send(data));

    // ── Diff-based textarea input (handles autocomplete replacements) ─────────
    let lastValue = '';

    const onInput = () => {
      const textarea = keyboardRef.current;
      if (!textarea) return;
      const newValue = textarea.value;
      if (newValue === lastValue) return;

      let i = 0;
      while (i < lastValue.length && i < newValue.length && lastValue[i] === newValue[i]) i++;
      const deletedCount = lastValue.length - i;
      const inserted = newValue.slice(i);

      if (deletedCount > 0) send('\x7f'.repeat(deletedCount));
      if (inserted) send(inserted);
      lastValue = newValue;

      if (newValue.length > 200 || newValue.includes('\n')) {
        textarea.value = '';
        lastValue = '';
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const seq = KEY_MAP[e.key];
      if (seq) {
        e.preventDefault();
        send(seq);
        if (e.key === 'Enter' || e.key === 'Escape') {
          const ta = keyboardRef.current;
          if (ta) ta.value = '';
          lastValue = '';
        }
      }
    };

    const textarea = keyboardRef.current;
    if (textarea) {
      textarea.addEventListener('input', onInput);
      textarea.addEventListener('keydown', onKeyDown);
    }

    const onContainerClick = () => keyboardRef.current?.focus({ preventScroll: true });
    containerRef.current?.addEventListener('click', onContainerClick);

    // ── #10: Long-press on terminal = paste from clipboard ────────────────────
    let longPressTimer: ReturnType<typeof setTimeout> | null = null;
    let lpStartX = 0, lpStartY = 0;

    const onLongPressStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      lpStartX = e.touches[0].clientX;
      lpStartY = e.touches[0].clientY;
      longPressTimer = setTimeout(async () => {
        longPressTimer = null;
        haptic();
        try {
          const text = await navigator.clipboard.readText();
          if (text) send(text);
        } catch { /* clipboard permission denied */ }
      }, 600);
    };
    const onLongPressMove = (e: TouchEvent) => {
      if (!longPressTimer) return;
      const dx = e.touches[0].clientX - lpStartX;
      const dy = e.touches[0].clientY - lpStartY;
      // Cancel if the finger moved more than 10px (it's a scroll, not a press)
      if (Math.hypot(dx, dy) > 10) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    };
    const onLongPressEnd = () => {
      if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
    };
    containerRef.current?.addEventListener('touchstart', onLongPressStart, { passive: true });
    containerRef.current?.addEventListener('touchmove', onLongPressMove, { passive: true });
    containerRef.current?.addEventListener('touchend', onLongPressEnd, { passive: true });

    // ── Pinch-to-zoom font size ───────────────────────────────────────────────
    const onPinchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        pinchDistRef.current = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY,
        );
      }
    };
    const onPinchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      e.preventDefault();
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
      const delta = dist - pinchDistRef.current;
      pinchDistRef.current = dist;
      fontSizeRef.current = Math.max(8, Math.min(28, fontSizeRef.current + delta * 0.05));
      const rounded = Math.round(fontSizeRef.current);
      term.options.fontSize = rounded;
      localStorage.setItem('terminal-font-size', String(rounded));
      try { fitAddon.fit(); } catch {}
      sendResize();
    };
    containerRef.current?.addEventListener('touchstart', onPinchStart, { passive: true });
    containerRef.current?.addEventListener('touchmove', onPinchMove, { passive: false });

    // ── ResizeObserver + visualViewport ──────────────────────────────────────
    const resizeObserver = new ResizeObserver(() => {
      try { fitAddon.fit(); } catch {}
      sendResize();
    });
    if (containerRef.current) resizeObserver.observe(containerRef.current);

    const handleViewportResize = () => {
      try { fitAddon.fit(); } catch {}
      sendResize();
    };
    window.visualViewport?.addEventListener('resize', handleViewportResize);
    window.addEventListener('resize', handleViewportResize);
    const onTextareaBlur = () => {
      setTimeout(() => { try { fitAddon.fit(); } catch {} sendResize(); }, 100);
    };
    textarea?.addEventListener('blur', onTextareaBlur);

    if (active) {
      term.focus();
      textarea?.focus({ preventScroll: true });
    }

    return () => {
      unmountedRef.current = true;
      if (reconnTimerRef.current) { clearTimeout(reconnTimerRef.current); reconnTimerRef.current = null; }
      if (longPressTimer) { clearTimeout(longPressTimer); }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      resizeObserver.disconnect();
      window.visualViewport?.removeEventListener('resize', handleViewportResize);
      window.removeEventListener('resize', handleViewportResize);
      textarea?.removeEventListener('blur', onTextareaBlur);
      containerRef.current?.removeEventListener('click', onContainerClick);
      containerRef.current?.removeEventListener('touchstart', onLongPressStart);
      containerRef.current?.removeEventListener('touchmove', onLongPressMove);
      containerRef.current?.removeEventListener('touchend', onLongPressEnd);
      containerRef.current?.removeEventListener('touchstart', onPinchStart);
      containerRef.current?.removeEventListener('touchmove', onPinchMove);
      if (textarea) {
        textarea.removeEventListener('input', onInput);
        textarea.removeEventListener('keydown', onKeyDown);
      }
      wsRef.current?.close();
      term.dispose();
      termRef.current     = null;
      fitAddonRef.current = null;
      wsRef.current       = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, wsBase]);

  const sendPayload = (payload: string) => {
    haptic();
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'data', payload }));
    }
    keyboardRef.current?.focus({ preventScroll: true });
  };

  const handlePaste = async () => {
    haptic();
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        const ws = wsRef.current;
        if (ws?.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'data', payload: text }));
        }
      }
    } catch { /* clipboard permission denied */ }
    keyboardRef.current?.focus({ preventScroll: true });
  };

  const handleCopy = () => {
    haptic();
    const sel = termRef.current?.getSelection();
    if (sel) {
      void navigator.clipboard.writeText(sel);
      termRef.current?.clearSelection();
      setHasSelection(false);
    }
  };

  const scrollToBottom = () => {
    termRef.current?.scrollToBottom();
    atBottomRef.current = true;
    setAtBottom(true);
  };

  const tbHeight  = isLandscape ? 34 : 44;
  const btnHeight = isLandscape ? 26 : 32;
  const btnFontSz = isLandscape ? 11 : 12;

  // #9: Toolbar swipe — swipe up = ↑ (prev command), swipe down = ↓ (next command)
  const tbSwipeY   = useRef(0);
  const tbSwipeFired = useRef(false);
  const onToolbarTouchStart = (e: React.TouchEvent) => {
    tbSwipeY.current    = e.touches[0].clientY;
    tbSwipeFired.current = false;
  };
  const onToolbarTouchEnd = (e: React.TouchEvent) => {
    if (tbSwipeFired.current) return;
    const dy = tbSwipeY.current - e.changedTouches[0].clientY;
    if (Math.abs(dy) > 28) {
      tbSwipeFired.current = true;
      sendPayload(dy > 0 ? '\x1b[A' : '\x1b[B');
    }
  };

  return (
    <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', background: '#0f1117', position: 'relative' }}>
      {/* Hidden textarea — all mobile input goes through here */}
      <textarea
        ref={keyboardRef}
        style={{
          position: 'fixed', top: -200, left: -200,
          width: 1, height: 1, opacity: 0, fontSize: 16,
          background: 'transparent', border: 'none', outline: 'none',
          resize: 'none', pointerEvents: 'none',
        }}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        // Disable Grammarly and similar browser extensions
        data-gramm="false"
        data-gramm_editor="false"
        data-enable-grammarly="false"
        tabIndex={-1}
        aria-hidden="true"
      />

      {/* xterm.js container */}
      <div ref={containerRef} style={{ flex: 1, minHeight: 0, padding: '8px 8px 0', cursor: 'text' }} />

      {/* Reconnecting overlay */}
      {reconnecting && (
        <div style={{
          position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(18,19,27,0.92)', border: '1px solid rgba(250,204,21,0.35)',
          borderRadius: 8, padding: '5px 14px', color: '#facc15', fontSize: 12,
          zIndex: 20, backdropFilter: 'blur(4px)', whiteSpace: 'nowrap', pointerEvents: 'none',
        }}>
          ⟳ Reconnecting…
        </div>
      )}

      {/* Copy selection button */}
      {hasSelection && (
        <button
          onPointerDown={(e) => { e.preventDefault(); handleCopy(); }}
          style={{
            position: 'absolute', top: 8, right: 12,
            height: 30, padding: '0 12px', borderRadius: 6,
            border: '1px solid rgba(214,137,91,0.4)',
            background: 'rgba(18,19,27,0.92)', color: '#d6895b',
            fontSize: 12, fontFamily: "'Cascadia Code', Consolas, monospace",
            cursor: 'pointer', zIndex: 20, backdropFilter: 'blur(4px)',
          }}
        >
          Copy
        </button>
      )}

      {/* Scroll-to-bottom button */}
      {!atBottom && (
        <button
          onPointerDown={(e) => { e.preventDefault(); scrollToBottom(); }}
          style={{
            position: 'absolute', bottom: tbHeight + 8, right: 12,
            width: 36, height: 36, borderRadius: '50%',
            border: '1px solid rgba(255,255,255,0.15)',
            background: 'rgba(18,19,27,0.92)', color: '#e0e0e0',
            fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', zIndex: 10, backdropFilter: 'blur(4px)',
          }}
        >
          ↓
        </button>
      )}

      {/* Toolbar: scrollable key strip + pinned Send button (#8) */}
      <div
        style={{
          height: tbHeight, display: 'flex', alignItems: 'center',
          background: '#12131b', borderTop: '1px solid rgba(255,255,255,0.08)',
          flexShrink: 0,
        }}
        onTouchStart={onToolbarTouchStart}
        onTouchEnd={onToolbarTouchEnd}
      >
        {/* Scrollable strip */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4, padding: '0 6px', overflowX: 'auto' }}>
          {TOOLBAR_BUTTONS.map(({ label, payload, title: btnTitle }) => (
            <button
              key={label}
              onPointerDown={(e) => { e.preventDefault(); sendPayload(payload); }}
              style={btnStyle(btnHeight, btnFontSz)}
              title={btnTitle}
            >
              {label}
            </button>
          ))}
          <button
            onPointerDown={(e) => { e.preventDefault(); void handlePaste(); }}
            style={{ ...btnStyle(btnHeight, btnFontSz), minWidth: 48 }}
            title="Paste from clipboard"
          >
            Paste
          </button>
        </div>

        {/* #8: Pinned Send button — always visible, can't be scrolled away */}
        <button
          onPointerDown={(e) => { e.preventDefault(); sendPayload('\r'); }}
          style={{
            flexShrink: 0,
            height: tbHeight - 6,
            minWidth: isLandscape ? 52 : 64,
            margin: '3px 6px 3px 2px',
            borderRadius: 8,
            border: 'none',
            background: '#d6895b',
            color: '#0e0e16',
            fontSize: isLandscape ? 12 : 14,
            fontWeight: 700,
            cursor: 'pointer',
            touchAction: 'manipulation',
            userSelect: 'none',
            WebkitUserSelect: 'none',
          }}
          title="Send / Enter"
        >
          ↵ Send
        </button>
      </div>
    </div>
  );
}

const btnStyle = (height: number, fontSize: number): React.CSSProperties => ({
  flexShrink: 0,
  height,
  minWidth: 36,
  padding: '0 8px',
  borderRadius: 6,
  border: 'none',
  background: 'rgba(255,255,255,0.08)',
  color: '#e0e0e0',
  fontSize,
  fontFamily: "'Cascadia Code', Consolas, monospace",
  cursor: 'pointer',
  touchAction: 'manipulation',
  userSelect: 'none',
  WebkitUserSelect: 'none',
});
