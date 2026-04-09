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
  closePane: (paneId: string) => void;
}

export const useTabStore = create<TabState>()(
  immer((set, get) => ({
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

        // Kill all panes in this tab
        const tab = state.tabs[idx];
        const paneIds = getAllPaneIds(tab.paneTree);
        paneIds.forEach((paneId) => {
          window.electronAPI?.ptyKill({ paneId });
        });

        state.tabs.splice(idx, 1);

        if (state.activeTabId === tabId) {
          state.activeTabId =
            state.tabs[Math.min(idx, state.tabs.length - 1)]?.id ?? null;
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

        const newTree = splitPane(
          tab.paneTree,
          tab.activePaneId,
          direction,
          profileId
        );
        tab.paneTree = newTree;
      }),

    closePane: (paneId) =>
      set((state) => {
        const tab = state.tabs.find((t) => t.id === state.activeTabId);
        if (!tab) return;

        window.electronAPI?.ptyKill({ paneId });

        const newTree = removePane(tab.paneTree, paneId);
        if (!newTree) {
          // Last pane closed — close the tab
          const idx = state.tabs.findIndex((t) => t.id === state.activeTabId);
          state.tabs.splice(idx, 1);
          state.activeTabId = state.tabs[Math.max(0, idx - 1)]?.id ?? null;
        } else {
          tab.paneTree = newTree;
          if (tab.activePaneId === paneId) {
            const first = newTree.kind === 'terminal' ? newTree.paneId : getAllPaneIds(newTree)[0];
            tab.activePaneId = first;
          }
        }
      }),
  }))
);
