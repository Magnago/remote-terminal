import React, { useEffect, useState } from 'react';
import Tab from './Tab';
import { useTabStore } from '../../store/useTabStore';

export default function TabBar(): React.JSX.Element {
  const { tabs, activeTabId, addTab, profiles } = useTabStore();
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 't') {
        e.preventDefault();
        addTab();
      }
      if (e.ctrlKey && e.key === 'w') {
        e.preventDefault();
        const { activeTabId, closeTab } = useTabStore.getState();
        if (activeTabId) closeTab(activeTabId);
      }
      if (e.ctrlKey && e.shiftKey && e.key.toUpperCase() === 'E') {
        e.preventDefault();
        useTabStore.getState().splitActivePane('horizontal');
      }
      if (e.ctrlKey && e.shiftKey && e.key.toUpperCase() === 'O') {
        e.preventDefault();
        useTabStore.getState().splitActivePane('vertical');
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  return (
    <div
      className="tabbar flex items-center shrink-0"
      style={{
        height: 'var(--tabbar-height)',
        background: 'var(--color-tab-bar)',
        borderBottom: '1px solid var(--color-border)',
        gap: '2px',
        padding: '0 4px',
        overflowX: 'auto',
        overflowY: 'hidden',
        WebkitAppRegion: 'no-drag' as any,
      }}
    >
      {tabs.map((tab) => (
        <Tab key={tab.id} tab={tab} isActive={tab.id === activeTabId} />
      ))}

      {/* New tab button — single click opens default, right-click shows profile picker */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => {
            if (profiles.length <= 1) {
              addTab();
            } else {
              setShowDropdown(!showDropdown);
            }
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            if (profiles.length > 1) setShowDropdown(!showDropdown);
          }}
          className="new-tab-btn"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 32,
            height: 28,
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            background: 'transparent',
            color: 'var(--color-text-muted)',
            cursor: 'pointer',
            flexShrink: 0,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-tab-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          title={profiles.length > 1 ? 'New Tab (click) / Choose profile (right-click)' : 'New Tab (Ctrl+T)'}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <path d="M6 0v12M0 6h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>

        {showDropdown && profiles.length > 1 && (
          <div
            className="dropdown"
            style={{
              position: 'fixed',
              top: 'var(--titlebar-height, 32px)',
              zIndex: 100,
              background: '#1c1c2e',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              minWidth: 180,
              padding: '4px 0',
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            }}
          >
            {profiles.map((profile) => (
              <button
                key={profile.id}
                onClick={() => {
                  addTab(profile.id);
                  setShowDropdown(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '8px 12px',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--color-text-primary)',
                  cursor: 'pointer',
                  fontSize: 13,
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: profile.color || '#0078d4',
                    flexShrink: 0,
                  }}
                />
                {profile.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {showDropdown && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 99 }}
          onClick={() => setShowDropdown(false)}
        />
      )}

      <div style={{ flex: 1 }} />
    </div>
  );
}
