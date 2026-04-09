import React, { useRef, useCallback, useState } from 'react';
import type { PaneTree } from '@shared/types/terminal';
import PaneNode from './PaneNode';

interface Props {
  node: Extract<PaneTree, { kind: 'split' }>;
  tabId: string;
  activePaneId: string;
}

export default function SplitContainer({ node, tabId, activePaneId }: Props): React.JSX.Element {
  const [ratio, setRatio] = useState(node.ratio);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const isHorizontal = node.direction === 'horizontal';

  const handleDividerMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDragging.current = true;

      const onMouseMove = (ev: MouseEvent) => {
        if (!containerRef.current || !isDragging.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const newRatio = isHorizontal
          ? (ev.clientX - rect.left) / rect.width
          : (ev.clientY - rect.top) / rect.height;
        setRatio(Math.max(0.1, Math.min(0.9, newRatio)));
      };

      const onMouseUp = () => {
        isDragging.current = false;
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    },
    [isHorizontal]
  );

  const firstStyle: React.CSSProperties = isHorizontal
    ? { width: `${ratio * 100}%`, height: '100%' }
    : { width: '100%', height: `${ratio * 100}%` };

  const secondStyle: React.CSSProperties = isHorizontal
    ? { width: `${(1 - ratio) * 100}%`, height: '100%' }
    : { width: '100%', height: `${(1 - ratio) * 100}%` };

  const dividerStyle: React.CSSProperties = {
    flexShrink: 0,
    background: 'var(--color-border)',
    cursor: isHorizontal ? 'col-resize' : 'row-resize',
    zIndex: 10,
    transition: 'background 0.15s',
    ...(isHorizontal ? { width: 4, height: '100%' } : { height: 4, width: '100%' }),
  };

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        flexDirection: isHorizontal ? 'row' : 'column',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      <div style={firstStyle}>
        <PaneNode node={node.first} tabId={tabId} activePaneId={activePaneId} />
      </div>
      <div
        style={dividerStyle}
        onMouseDown={handleDividerMouseDown}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-accent)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--color-border)')}
      />
      <div style={secondStyle}>
        <PaneNode node={node.second} tabId={tabId} activePaneId={activePaneId} />
      </div>
    </div>
  );
}
