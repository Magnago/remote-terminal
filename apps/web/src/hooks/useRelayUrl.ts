import { useState, useCallback } from 'react';

const STORAGE_KEY = 'relay-url';

function normalise(raw: string): string {
  return raw.trim().replace(/\/$/, '');
}

function toWsBase(httpBase: string): string {
  return httpBase.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');
}

function shouldPreferCurrentOrigin(currentOrigin: string, storedOrigin: string): boolean {
  if (!storedOrigin) return true;
  try {
    const current = new URL(currentOrigin);
    const stored = new URL(storedOrigin);
    const currentIsRemote =
      current.hostname !== 'localhost' &&
      current.hostname !== '127.0.0.1' &&
      current.port !== '3002';
    const storedIsLocal =
      stored.hostname === 'localhost' || stored.hostname === '127.0.0.1';
    return currentIsRemote && storedIsLocal;
  } catch {
    return true;
  }
}

export function useRelayUrl() {
  const [relayUrl, setRelayUrlState] = useState<string>(() => {
    const stored = localStorage.getItem(STORAGE_KEY) ?? '';
    const current = normalise(window.location.origin);
    if (shouldPreferCurrentOrigin(current, stored)) {
      localStorage.setItem(STORAGE_KEY, current);
      return current;
    }
    return stored;
  });

  const setRelayUrl = useCallback((url: string) => {
    const clean = normalise(url);
    localStorage.setItem(STORAGE_KEY, clean);
    setRelayUrlState(clean);
  }, []);

  const clearRelayUrl = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setRelayUrlState('');
  }, []);

  return {
    relayUrl,
    wsBase: relayUrl ? toWsBase(relayUrl) : '',
    isConfigured: relayUrl.length > 0,
    setRelayUrl,
    clearRelayUrl,
  };
}
