import React from 'react';
import type { PaneTree } from '@shared/types/terminal';
import TerminalPane from '../Terminal/TerminalPane';
import SplitContainer from './SplitContainer';

interface Props {
  node: PaneTree;
  tabId: string;
  activePaneId: string;
}

export default function PaneNode({ node, tabId, activePaneId }: Props): React.JSX.Element {
  if (node.kind === 'terminal') {
    return (
      <TerminalPane
        paneId={node.paneId}
        profileId={node.profileId}
        tabId={tabId}
        isActive={node.paneId === activePaneId}
      />
    );
  }

  return (
    <SplitContainer
      node={node}
      tabId={tabId}
      activePaneId={activePaneId}
    />
  );
}
