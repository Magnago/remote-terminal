import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { Tab, PaneTree, ShellProfile } from '@shared/types/terminal';
import { generateId } from '../utils/id';
import { splitPane, removePane, getAllPaneIds } from '../utils/pane-tree';
import { useSettingsStore } from './useSettingsStore';

interface TabState {
  tabs: Tab[];
  activeTabId: string | null;
  profiles: ShellProfile[];
  setProfiles: (profiles: ShellProfile[]) => void;
  addTab: (profileId?: string) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  setActivePaneId: (tabId: string, paneId: string) => void;
  setTabTitle: (tabId: string, title: string) => void;
  splitActivePane: (direction: 'horizontal' | 'vertical') => void;
  closePane: (paneId: string, options?: { skipPtyKill?: boolean }) => void;
}

export const useTabStore = create<TabState>()(
  immer((set) => ({
    tabs: [],
    activeTabId: null,
    profiles: [],

    setProfiles: (profiles) =>
      set((state) => {
        state.profiles = profiles;
      }),

    addTab: (profileId?: string) =>
      set((state) => {
        const id = generateId();
        const paneId = generateId();
        const defaultProfileId = useSettingsStore.getState().settings?.terminal.defaultProfileId;
        const resolvedProfileId =
          profileId ||
          state.profiles.find((profile) => profile.id === defaultProfileId)?.id ||
          state.profiles[0]?.id ||
          'powershell5';

        const newTab: Tab = {
          id,
          title: `Session ${state.tabs.length + 1}`,
          activePaneId: paneId,
          paneTree: { kind: 'terminal', paneId, profileId: resolvedProfileId },
        };

        state.tabs.push(newTab);
        state.activeTabId = id;
      }),

    closeTab: (tabId) =>
      set((state) => {
        const idx = state.tabs.findIndex((t) => t.id === tabId);
        if (idx === -1) return;

        const tab = state.tabs[idx];
        const paneIds = getAllPaneIds(tab.paneTree);
        paneIds.forEach((paneId) => {
          window.electronAPI?.ptyKill({ paneId });
        });

        state.tabs.splice(idx, 1);

        if (state.activeTabId === tabId) {
          state.activeTabId = state.tabs[Math.min(idx, state.tabs.length - 1)]?.id ?? null;
        }
      }),

    setActiveTab: (tabId) =>
      set((state) => {
        state.activeTabId = tabId;
      }),

    setActivePaneId: (tabId, paneId) =>
      set((state) => {
        const tab = state.tabs.find((t) => t.id === tabId);
        if (tab) tab.activePaneId = paneId;
      }),

    setTabTitle: (tabId, title) =>
      set((state) => {
        const tab = state.tabs.find((t) => t.id === tabId);
        if (tab) tab.title = title;
      }),

    splitActivePane: (direction) =>
      set((state) => {
        const tab = state.tabs.find((t) => t.id === state.activeTabId);
        if (!tab) return;

        const defaultProfileId = useSettingsStore.getState().settings?.terminal.defaultProfileId;
        const profileId =
          state.profiles.find((profile) => profile.id === defaultProfileId)?.id ||
          state.profiles[0]?.id ||
          'powershell5';

        const newTree = splitPane(tab.paneTree, tab.activePaneId, direction, profileId);
        tab.paneTree = newTree;
      }),

    closePane: (paneId, options) =>
      set((state) => {
        const tab = state.tabs.find((candidate) =>
          getAllPaneIds(candidate.paneTree).includes(paneId)
        );
        if (!tab) return;

        if (!options?.skipPtyKill) {
          window.electronAPI?.ptyKill({ paneId });
        }

        const newTree = removePane(tab.paneTree, paneId);
        if (!newTree) {
          const idx = state.tabs.findIndex((t) => t.id === tab.id);
          state.tabs.splice(idx, 1);
          if (state.activeTabId === tab.id) {
            state.activeTabId = state.tabs[Math.min(idx, state.tabs.length - 1)]?.id ?? null;
          }
          return;
        }

        tab.paneTree = newTree;
        if (tab.activePaneId === paneId) {
          tab.activePaneId =
            newTree.kind === 'terminal' ? newTree.paneId : getAllPaneIds(newTree)[0];
        }
      }),
  }))
);
