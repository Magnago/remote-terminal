import React, { useEffect, useState } from 'react';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useTabStore } from '../../store/useTabStore';

interface Props {
  onClose: () => void;
}

export default function SettingsPanel({ onClose }: Props): React.JSX.Element {
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const profiles = useTabStore((s) => s.profiles);
  const [draft, setDraft] = useState(settings);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  if (!draft) {
    return <></>;
  }

  const commit = async () => {
    await updateSettings({
      terminal: draft.terminal,
      remote: draft.remote,
    });
    onClose();
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(6, 8, 16, 0.68)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: 440,
          maxWidth: 'calc(100vw - 32px)',
          background: '#121826',
          border: '1px solid rgba(255,255,255,0.09)',
          borderRadius: 12,
          boxShadow: '0 24px 80px rgba(0,0,0,0.45)',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '16px 18px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text-primary)' }}>Settings</div>
          <div style={{ marginTop: 4, fontSize: 12, color: 'var(--color-text-muted)' }}>
            Terminal appearance and relay connection
          </div>
        </div>

        <div style={{ display: 'grid', gap: 14, padding: 18 }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Relay URL</span>
            <input
              value={draft.remote.relayUrl}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  remote: {
                    ...draft.remote,
                    relayUrl: event.currentTarget.value,
                  },
                })
              }
              placeholder="http://localhost:3001"
              style={inputStyle}
            />
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Theme</span>
              <select
                value={draft.terminal.theme}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    terminal: {
                      ...draft.terminal,
                      theme: event.currentTarget.value,
                    },
                  })
                }
                style={inputStyle}
              >
                <option value="win11-dark">Win11 Dark</option>
                <option value="win11-light">Win11 Light</option>
              </select>
            </label>

            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Cursor</span>
              <select
                value={draft.terminal.cursorStyle}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    terminal: {
                      ...draft.terminal,
                      cursorStyle: event.currentTarget.value as 'block' | 'underline' | 'bar',
                    },
                  })
                }
                style={inputStyle}
              >
                <option value="block">Block</option>
                <option value="underline">Underline</option>
                <option value="bar">Bar</option>
              </select>
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Font size</span>
              <input
                type="number"
                min={10}
                max={32}
                value={draft.terminal.fontSize}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    terminal: {
                      ...draft.terminal,
                      fontSize: Number(event.currentTarget.value) || draft.terminal.fontSize,
                    },
                  })
                }
                style={inputStyle}
              />
            </label>

            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Default profile</span>
              <select
                value={draft.terminal.defaultProfileId}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    terminal: {
                      ...draft.terminal,
                      defaultProfileId: event.currentTarget.value,
                    },
                  })
                }
                style={inputStyle}
              >
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--color-text-secondary)', fontSize: 13 }}>
            <input
              type="checkbox"
              checked={draft.terminal.cursorBlink}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  terminal: {
                    ...draft.terminal,
                    cursorBlink: event.currentTarget.checked,
                  },
                })
              }
            />
            Blink cursor
          </label>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '0 18px 18px' }}>
          <button onClick={onClose} style={secondaryButtonStyle}>
            Cancel
          </button>
          <button onClick={() => void commit()} style={primaryButtonStyle}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: 36,
  borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(255,255,255,0.04)',
  color: 'var(--color-text-primary)',
  padding: '0 12px',
  fontSize: 13,
  outline: 'none',
};

const secondaryButtonStyle: React.CSSProperties = {
  height: 34,
  padding: '0 14px',
  borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'transparent',
  color: 'var(--color-text-secondary)',
  cursor: 'pointer',
};

const primaryButtonStyle: React.CSSProperties = {
  height: 34,
  padding: '0 14px',
  borderRadius: 8,
  border: 'none',
  background: '#0078d4',
  color: '#ffffff',
  cursor: 'pointer',
};
