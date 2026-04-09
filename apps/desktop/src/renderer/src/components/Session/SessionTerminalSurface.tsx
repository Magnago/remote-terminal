import React, { useEffect, useRef } from 'react';
import '@xterm/xterm/css/xterm.css';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { CanvasAddon } from '@xterm/addon-canvas';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { SearchAddon } from '@xterm/addon-search';
import { themes } from '../../theme/themes';
import { useSettingsStore } from '../../store/useSettingsStore';
import type { SessionRecord } from '../../store/useSessionStore';

interface Props {
  session: SessionRecord;
}

export default function SessionTerminalSurface({ session }: Props): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const renderedLengthRef = useRef(0);
  const terminalSettings = useSettingsStore((state) => state.settings?.terminal);

  useEffect(() => {
    if (!containerRef.current) return;

    const theme = themes[terminalSettings?.theme || 'win11-dark'];
    const term = new Terminal({
      fontFamily: terminalSettings?.fontFamily || "'Cascadia Code', Consolas, monospace",
      fontSize: terminalSettings?.fontSize || 14,
      theme,
      cursorBlink: terminalSettings?.cursorBlink ?? true,
      cursorStyle: terminalSettings?.cursorStyle || 'block',
      scrollback: terminalSettings?.scrollback || 10000,
      convertEol: false,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon());
    term.loadAddon(new SearchAddon());
    try { term.loadAddon(new CanvasAddon()); } catch {}

    term.open(containerRef.current);
    fitAddon.fit();

    termRef.current = term;
    fitAddonRef.current = fitAddon;
    renderedLengthRef.current = 0;

    if (session.terminalBuffer.length > 0) {
      term.write(session.terminalBuffer);
      renderedLengthRef.current = session.terminalBuffer.length;
    }

    term.onData((data) => {
      window.electronAPI?.ptyWrite({ paneId: session.paneId, data });
    });

    const resizeObserver = new ResizeObserver(() => {
      try {
        fitAddon.fit();
        window.electronAPI?.ptyResize({ paneId: session.paneId, cols: term.cols, rows: term.rows });
      } catch {}
    });

    resizeObserver.observe(containerRef.current);
    window.electronAPI?.ptyResize({ paneId: session.paneId, cols: term.cols, rows: term.rows });
    term.focus();

    return () => {
      resizeObserver.disconnect();
      term.dispose();
    };
  }, [session.id, session.paneId]);

  useEffect(() => {
    const term = termRef.current;
    const fitAddon = fitAddonRef.current;
    if (!term || !terminalSettings) return;

    term.options.fontFamily = terminalSettings.fontFamily;
    term.options.fontSize = terminalSettings.fontSize;
    term.options.theme = themes[terminalSettings.theme] || themes['win11-dark'];
    term.options.cursorBlink = terminalSettings.cursorBlink;
    term.options.cursorStyle = terminalSettings.cursorStyle;
    term.options.scrollback = terminalSettings.scrollback;

    try {
      fitAddon?.fit();
      window.electronAPI?.ptyResize({ paneId: session.paneId, cols: term.cols, rows: term.rows });
    } catch {}
  }, [session.paneId, terminalSettings]);

  useEffect(() => {
    const term = termRef.current;
    if (!term) return;

    const alreadyRendered = renderedLengthRef.current;
    if (session.terminalBuffer.length < alreadyRendered) {
      term.reset();
      term.write(session.terminalBuffer);
      renderedLengthRef.current = session.terminalBuffer.length;
      return;
    }

    const nextChunk = session.terminalBuffer.slice(alreadyRendered);
    if (!nextChunk) return;
    term.write(nextChunk);
    renderedLengthRef.current = session.terminalBuffer.length;
  }, [session.terminalBuffer]);

  return (
    <div
      style={{ height: '100%', width: '100%', background: '#0f1117' }}
      onClick={() => termRef.current?.focus()}
    >
      <div
        ref={containerRef}
        style={{ height: '100%', width: '100%', padding: '10px 10px 6px' }}
      />
    </div>
  );
}
