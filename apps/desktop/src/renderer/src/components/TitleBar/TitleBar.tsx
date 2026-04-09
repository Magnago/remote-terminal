import React from 'react';
import WindowControls from './WindowControls';

interface Props {
  onOpenSettings: () => void;
}

export default function TitleBar({ onOpenSettings }: Props): React.JSX.Element {
  return (
    <div
      className="titlebar flex items-center justify-between shrink-0"
      style={{
        height: 'var(--titlebar-height)',
        background: 'var(--color-tab-bar)',
        borderBottom: '1px solid var(--color-border)',
        WebkitAppRegion: 'drag' as any,
        paddingLeft: '12px',
      }}
    >
      <div
        className="flex items-center gap-2"
        style={{ WebkitAppRegion: 'no-drag' as any }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect width="16" height="16" rx="3" fill="#0078d4" />
          <path d="M3 5l5 3-5 3V5z" fill="white" />
          <path d="M9 10h4" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <span
          style={{
            fontSize: '12px',
            color: 'var(--color-text-secondary)',
            fontFamily: 'var(--font-ui)',
          }}
        >
          Awesome Terminal
        </span>
      </div>
      <div className="flex items-center" style={{ WebkitAppRegion: 'no-drag' as any }}>
        <button
          onClick={onOpenSettings}
          title="Settings"
          style={{
            width: 36,
            height: 32,
            border: 'none',
            background: 'transparent',
            color: 'var(--color-text-secondary)',
            cursor: 'pointer',
            transition: 'background 0.1s',
          }}
          onMouseEnter={(event) => (event.currentTarget.style.background = 'var(--color-tab-hover)')}
          onMouseLeave={(event) => (event.currentTarget.style.background = 'transparent')}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2">
            <circle cx="7" cy="7" r="2.1" />
            <path d="M7 1.4v1.2M7 11.4v1.2M12.6 7h-1.2M2.6 7H1.4M10.96 3.04l-.85.85M3.89 10.11l-.85.85M10.96 10.96l-.85-.85M3.89 3.89l-.85-.85" strokeLinecap="round" />
          </svg>
        </button>
        <WindowControls />
      </div>
    </div>
  );
}
