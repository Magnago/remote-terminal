import React from 'react';
import type { Tab as TabType } from '@shared/types/terminal';
import { useTabStore } from '../../store/useTabStore';

interface Props {
  tab: TabType;
  isActive: boolean;
}

export default function Tab({ tab, isActive }: Props): React.JSX.Element {
  const { setActiveTab, closeTab } = useTabStore();

  return (
    <div
      onClick={() => setActiveTab(tab.id)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '0 10px 0 12px',
        height: 28,
        borderRadius: 'var(--radius-sm)',
        background: isActive ? 'var(--color-tab-active)' : 'transparent',
        border: isActive ? '1px solid var(--color-border)' : '1px solid transparent',
        cursor: 'pointer',
        color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
        fontSize: 12,
        flexShrink: 0,
        maxWidth: 180,
        transition: 'background 0.1s',
        userSelect: 'none',
      }}
      onMouseEnter={(e) => {
        if (!isActive) e.currentTarget.style.background = 'var(--color-tab-hover)';
      }}
      onMouseLeave={(e) => {
        if (!isActive) e.currentTarget.style.background = 'transparent';
      }}
    >
      <span
        style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1,
          minWidth: 0,
        }}
      >
        {tab.title}
      </span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          closeTab(tab.id);
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 16,
          height: 16,
          borderRadius: 3,
          border: 'none',
          background: 'transparent',
          color: 'inherit',
          cursor: 'pointer',
          flexShrink: 0,
          padding: 0,
          opacity: 0.6,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(255,255,255,0.15)';
          e.currentTarget.style.opacity = '1';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.opacity = '0.6';
        }}
        title="Close Tab"
      >
        <svg width="8" height="8" viewBox="0 0 8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <line x1="0" y1="0" x2="8" y2="8" />
          <line x1="8" y1="0" x2="0" y2="8" />
        </svg>
      </button>
    </div>
  );
}
