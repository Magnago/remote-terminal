import React, { useEffect, useRef } from 'react';
import '@xterm/xterm/css/xterm.css';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';

interface Props {
  code: string;
  relayBase: string;
  active?: boolean;
  onActivity?: () => void;
  onExit?: () => void;
}

export default function RelayTerminalSurface({ code, relayBase, active = true, onActivity, onExit }: Props): React.JSX.Element {
  const containerRef    = useRef<HTMLDivElement>(null);
  const termRef         = useRef<Terminal | null>(null);
  const fitAddonRef     = useRef<FitAddon | null>(null);
  const wsRef           = useRef<WebSocket | null>(null);
  const unmountedRef    = useRef(false);
  const reconnTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onActivityRef   = useRef(onActivity);
  const lastActivityRef = useRef(0);
  const sendResizeRef   = useRef<(() => void) | null>(null);

  useEffect(() => { onActivityRef.current = onActivity; }, [onActivity]);

  // Resize + fit when this pane becomes active
  useEffect(() => {
    if (active && fitAddonRef.current) {
      try { fitAddonRef.current.fit(); } catch {}
      sendResizeRef.current?.();
    }
    if (active) {
      termRef.current?.focus();
    }
  }, [active]);

  // Terminal + WebSocket setup
  useEffect(() => {
    if (!containerRef.current) return;
    unmountedRef.current = false;

    const term = new Terminal({
      fontFamily: "'Cascadia Code', Consolas, monospace",
      fontSize: 14,
      theme: {
        background: '#0f1117',
        foreground: '#e0e0e0',
        cursor: '#d6895b',
        selectionBackground: 'rgba(214,137,91,0.35)',
      },
      cursorBlink: true,
      scrollback: 10000,
      convertEol: false,
      smoothScrollDuration: 100,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon());
    term.open(containerRef.current);
    fitAddon.fit();
    termRef.current     = term;
    fitAddonRef.current = fitAddon;

    const relayUrl   = new URL(relayBase);
    const wsProtocol = relayUrl.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsBase     = `${wsProtocol}//${relayUrl.host}`;

    let hasConnectedOnce   = false;
    let hasReceivedContent = false;

    const sendData = (data: string) => {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'data', payload: data }));
      }
    };

    // Forward all terminal input (keyboard, paste, IME) to the relay
    term.onData((data) => sendData(data));

    const sendResize = () => {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
      }
    };
    sendResizeRef.current = sendResize;

    const connect = () => {
      if (unmountedRef.current) return;
      // Reset so reconnects accept the replay buffer from the relay
      hasReceivedContent = false;
      const ws = new WebSocket(`${wsBase}/browser?code=${code}`);
      wsRef.current = ws;

      let pingInterval: ReturnType<typeof setInterval> | null = null;

      ws.onopen = () => {
        hasConnectedOnce = true;
        sendResize();
        pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' }));
        }, 30000);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as { type: string; payload?: string };
          if (msg.type === 'replay' && msg.payload) {
            if (!hasReceivedContent) {
              term.reset();
              term.write(msg.payload);
              hasReceivedContent = true;
            }
          } else if (msg.type === 'data' && msg.payload) {
            hasReceivedContent = true;
            term.write(msg.payload);
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
        if (hasConnectedOnce) {
          reconnTimerRef.current = setTimeout(() => {
            if (!unmountedRef.current) connect();
          }, 2000);
        }
      };
    };

    const resizeObserver = new ResizeObserver(() => {
      try { fitAddon.fit(); } catch {}
      sendResize();
    });
    if (containerRef.current) resizeObserver.observe(containerRef.current);

    connect();

    return () => {
      unmountedRef.current = true;
      sendResizeRef.current = null;
      if (reconnTimerRef.current) { clearTimeout(reconnTimerRef.current); reconnTimerRef.current = null; }
      resizeObserver.disconnect();
      wsRef.current?.close();
      term.dispose();
      termRef.current     = null;
      fitAddonRef.current = null;
      wsRef.current       = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, relayBase]);

  return (
    <div style={{ height: '100%', width: '100%', background: '#0f1117', cursor: 'text' }}>
      <div
        ref={containerRef}
        style={{ height: '100%', width: '100%', padding: '10px 10px 6px' }}
      />
    </div>
  );
}
