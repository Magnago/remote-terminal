import React, { useEffect, useState } from 'react';

export default function WindowControls(): React.JSX.Element {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    window.electronAPI?.windowIsMaximized().then(setIsMaximized);
    const remove = window.electronAPI?.onWindowMaximizedChanged(setIsMaximized);
    return remove;
  }, []);

  const btnBase: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 46,
    height: 32,
    border: 'none',
    background: 'transparent',
    color: 'var(--color-text-secondary)',
    cursor: 'pointer',
    WebkitAppRegion: 'no-drag' as any,
    transition: 'background 0.1s',
  };

  return (
    <div className="flex" style={{ WebkitAppRegion: 'no-drag' as any }}>
      <button
        style={btnBase}
        title="Minimize"
        onClick={() => window.electronAPI?.windowMinimize()}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-minimize-hover)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        <svg width="10" height="1" viewBox="0 0 10 1" fill="currentColor">
          <rect width="10" height="1" />
        </svg>
      </button>
      <button
        style={btnBase}
        title={isMaximized ? 'Restore' : 'Maximize'}
        onClick={() => window.electronAPI?.windowMaximize()}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-maximize-hover)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        {isMaximized ? (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
            <rect x="2" y="0" width="8" height="8" />
            <path d="M0 2v8h8" />
          </svg>
        ) : (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
            <rect x="0" y="0" width="10" height="10" />
          </svg>
        )}
      </button>
      <button
        style={{ ...btnBase, color: 'rgba(255,255,255,0.7)' }}
        title="Close"
        onClick={() => window.electronAPI?.windowClose()}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--color-close-hover)';
          e.currentTarget.style.color = 'white';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = 'rgba(255,255,255,0.7)';
        }}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
          <line x1="0" y1="0" x2="10" y2="10" />
          <line x1="10" y1="0" x2="0" y2="10" />
        </svg>
      </button>
    </div>
  );
}
