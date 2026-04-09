import React from 'react';

interface Props {
  code: string;
  url: string;
  onDismiss: () => void;
}

async function copyToClipboard(value: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(value);
    return;
  } catch {}

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  try {
    document.execCommand('copy');
  } finally {
    document.body.removeChild(textarea);
  }
}

export default function RemoteSessionBanner({ code, url, onDismiss }: Props): React.JSX.Element {
  return (
    <div
      style={{
        position: 'absolute',
        top: 12,
        right: 12,
        left: 12,
        minHeight: 48,
        background: 'rgba(18, 28, 46, 0.92)',
        border: '1px solid rgba(0, 120, 212, 0.4)',
        borderRadius: 10,
        display: 'flex',
        alignItems: 'center',
        padding: '10px 12px',
        gap: 12,
        fontSize: 12,
        color: 'var(--color-text-primary)',
        backdropFilter: 'blur(4px)',
        zIndex: 30,
        pointerEvents: 'auto',
      }}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="7" stroke="#0078d4" strokeWidth="1.5" />
        <path d="M5 8h6M8 5l3 3-3 3" stroke="#0078d4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div style={{ flex: 1 }}>
        <span style={{ color: 'var(--color-text-secondary)' }}>Remote session active</span>
        <span style={{ color: 'var(--color-text-muted)', marginLeft: 8 }}>Code: </span>
        <strong style={{ letterSpacing: 2 }}>{code}</strong>
        <div style={{ color: '#8eb8ff', marginTop: 4, fontFamily: 'monospace' }}>{url}</div>
      </div>
      <button
        onClick={() => void copyToClipboard(url)}
        style={{
          background: 'rgba(0,120,212,0.2)',
          border: '1px solid rgba(0,120,212,0.5)',
          borderRadius: 6,
          color: '#9fd0ff',
          cursor: 'pointer',
          padding: '5px 10px',
          fontSize: 11,
          whiteSpace: 'nowrap',
        }}
        title="Copy session URL"
      >
        Copy URL
      </button>
      <button
        onClick={onDismiss}
        style={{
          background: 'transparent',
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: 6,
          color: 'var(--color-text-secondary)',
          cursor: 'pointer',
          padding: '5px 10px',
          fontSize: 11,
          whiteSpace: 'nowrap',
        }}
      >
        Stop
      </button>
    </div>
  );
}
