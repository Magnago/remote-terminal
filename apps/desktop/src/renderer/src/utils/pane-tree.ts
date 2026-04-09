import type { PaneTree } from '@shared/types/terminal';
import { generateId } from './id';

export function splitPane(
  tree: PaneTree,
  targetPaneId: string,
  direction: 'horizontal' | 'vertical',
  profileId: string
): PaneTree {
  if (tree.kind === 'terminal') {
    if (tree.paneId === targetPaneId) {
      return {
        kind: 'split',
        direction,
        ratio: 0.5,
        first: tree,
        second: { kind: 'terminal', paneId: generateId(), profileId },
      };
    }
    return tree;
  }

  return {
    ...tree,
    first: splitPane(tree.first, targetPaneId, direction, profileId),
    second: splitPane(tree.second, targetPaneId, direction, profileId),
  };
}

export function removePane(tree: PaneTree, targetPaneId: string): PaneTree | null {
  if (tree.kind === 'terminal') {
    return tree.paneId === targetPaneId ? null : tree;
  }

  const newFirst = removePane(tree.first, targetPaneId);
  const newSecond = removePane(tree.second, targetPaneId);

  if (!newFirst) return newSecond;
  if (!newSecond) return newFirst;

  return { ...tree, first: newFirst, second: newSecond };
}

export function updateRatio(
  tree: PaneTree,
  targetPaneId: string,
  ratio: number
): PaneTree {
  if (tree.kind === 'terminal') return tree;

  if (
    tree.first.kind === 'terminal' && tree.first.paneId === targetPaneId ||
    tree.second.kind === 'terminal' && tree.second.paneId === targetPaneId
  ) {
    return { ...tree, ratio };
  }

  return {
    ...tree,
    first: updateRatio(tree.first, targetPaneId, ratio),
    second: updateRatio(tree.second, targetPaneId, ratio),
  };
}

export function getAllPaneIds(tree: PaneTree): string[] {
  if (tree.kind === 'terminal') return [tree.paneId];
  return [...getAllPaneIds(tree.first), ...getAllPaneIds(tree.second)];
}

export function getNewPaneIds(oldTree: PaneTree, newTree: PaneTree): string[] {
  const oldIds = new Set(getAllPaneIds(oldTree));
  return getAllPaneIds(newTree).filter((id) => !oldIds.has(id));
}
