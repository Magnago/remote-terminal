import React, { useEffect, useRef, useState } from 'react';
import { useTerminal } from '../../hooks/useTerminal';
import RemoteSessionBanner from './RemoteSessionBanner';

interface Props {
  paneId: string;
  profileId: string;
  tabId: string;
  isActive: boolean;
}

export default function TerminalPane({ paneId, profileId, tabId, isActive }: Props): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const [remoteSession, setRemoteSession] = useState<{ code: string; url: string } | null>(null);

  const { termRef } = useTerminal({
    paneId,
    profileId,
    tabId,
    containerRef,
    onRemoteSession: (code, url) => setRemoteSession({ code, url }),
  });

  useEffect(() => {
    if (isActive) {
      termRef.current?.focus();
    }
  }, [isActive]);

  useEffect(() => {
    const removeStarted = window.electronAPI?.onRemoteSessionStarted((data) => {
      if (data.paneId === paneId) {
        setRemoteSession({ code: data.code, url: data.url });
      }
    });
    const removeStopped = window.electronAPI?.onRemoteSessionStopped((data) => {
      if (data.paneId === paneId) {
        setRemoteSession(null);
      }
    });
    return () => {
      removeStarted?.();
      removeStopped?.();
    };
  }, [paneId]);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        outline: isActive ? '1px solid rgba(0,120,212,0.4)' : '1px solid transparent',
        outlineOffset: '-1px',
      }}
    >
      <div
        ref={containerRef}
        onClick={() => termRef.current?.focus()}
        style={{
          width: '100%',
          height: remoteSession ? 'calc(100% - 48px)' : '100%',
          padding: '4px 0 0 4px',
        }}
      />
      {remoteSession && (
        <RemoteSessionBanner
          code={remoteSession.code}
          url={remoteSession.url}
          onDismiss={() => {
            window.electronAPI?.remoteSessionStop(paneId);
            setRemoteSession(null);
          }}
        />
      )}
    </div>
  );
}
