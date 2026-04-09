import { useState, useCallback } from 'react';

const STORAGE_KEY = 'relay-url';

function normalise(raw: string): string {
  return raw.trim().replace(/\/$/, '');
}

function toWsBase(httpBase: string): string {
  return httpBase.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');
}

export function useRelayUrl() {
  const [relayUrl, setRelayUrlState] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEY) ?? '';
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
