import React from 'react';
import PaneNode from './PaneNode';
import { useTabStore } from '../../store/useTabStore';

export default function Workspace(): React.JSX.Element {
  const { tabs, activeTabId } = useTabStore();

  if (tabs.length === 0) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-text-muted)',
          fontSize: 14,
        }}
      >
        No tabs open — press Ctrl+T to open a new tab
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        return (
          <div
            key={tab.id}
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              visibility: isActive ? 'visible' : 'hidden',
              pointerEvents: isActive ? 'auto' : 'none',
            }}
          >
            <PaneNode
              node={tab.paneTree}
              tabId={tab.id}
              activePaneId={tab.activePaneId}
            />
          </div>
        );
      })}
    </div>
  );
}
