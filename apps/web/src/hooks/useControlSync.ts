import { useState, useEffect, useRef } from 'react';

export interface RelaySession {
  code: string;
  title: string;
}

export type SyncStatus = 'connecting' | 'live' | 'offline';

export function useControlSync(wsBase: string) {
  const [sessions, setSessions] = useState<RelaySession[]>([]);
  const [status, setStatus] = useState<SyncStatus>('connecting');
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!wsBase) return;

    let cancelled = false;

    const connect = () => {
      if (cancelled) return;
      setStatus('connecting');
      const ws = new WebSocket(`${wsBase}/control`);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!cancelled) setStatus('live');
      };

      ws.onmessage = (event) => {
        if (cancelled) return;
        try {
          const msg = JSON.parse(event.data as string) as {
            type: string;
            sessions?: RelaySession[];
          };
          if (msg.type === 'sessions-updated' && msg.sessions) {
            setSessions(msg.sessions);
          }
        } catch {}
      };

      ws.onclose = () => {
        if (cancelled) return;
        setStatus('offline');
        reconnectTimer.current = setTimeout(connect, 2000);
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [wsBase]);

  return { sessions, status };
}
