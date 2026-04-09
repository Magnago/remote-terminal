import React, { useEffect, useState } from 'react';
import TitleBar from './components/TitleBar/TitleBar';
import TabBar from './components/TabBar/TabBar';
import Workspace from './components/Workspace/Workspace';
import SettingsPanel from './components/Settings/SettingsPanel';
import { useTabStore } from './store/useTabStore';
import { useSettingsStore } from './store/useSettingsStore';

export default function App(): React.JSX.Element {
  const setProfiles = useTabStore((s) => s.setProfiles);
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    void loadSettings();
    window.electronAPI?.getProfiles()?.then((profiles) => {
      setProfiles(profiles);
      // Create the first tab once profiles are loaded
      if (useTabStore.getState().tabs.length === 0) {
        useTabStore.getState().addTab();
      }
    });

    const removeListener = window.electronAPI?.onSettingsChanged((settings) => {
      useSettingsStore.setState({ settings });
    });
    const removeCreateListener = window.electronAPI?.onDesktopSessionCreate(() => {
      useTabStore.getState().addTab();
    });
    return () => {
      removeListener?.();
      removeCreateListener?.();
    };
  }, [loadSettings, setProfiles]);

  return (
    <div className="app-root flex flex-col h-screen w-screen overflow-hidden select-none">
      <TitleBar onOpenSettings={() => setShowSettings(true)} />
      <TabBar />
      <Workspace />
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
    </div>
  );
}
