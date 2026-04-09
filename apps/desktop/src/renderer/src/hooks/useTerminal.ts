import { useEffect, useRef } from 'react';
import '@xterm/xterm/css/xterm.css';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { CanvasAddon } from '@xterm/addon-canvas';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { SearchAddon } from '@xterm/addon-search';
import { themes } from '../theme/themes';
import { useSettingsStore } from '../store/useSettingsStore';
import { useTabStore } from '../store/useTabStore';

interface UseTerminalOptions {
  paneId: string;
  profileId: string;
  tabId: string;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onRemoteSession?: (code: string, url: string) => void;
}

export function useTerminal({
  paneId,
  profileId,
  tabId,
  containerRef,
  onRemoteSession,
}: UseTerminalOptions) {
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const terminalSettings = useSettingsStore((s) => s.settings?.terminal);
  const setTabTitle = useTabStore((s) => s.setTabTitle);
  const setActivePaneId = useTabStore((s) => s.setActivePaneId);

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
      allowProposedApi: true,
      convertEol: false,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    const searchAddon = new SearchAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.loadAddon(searchAddon);

    term.open(containerRef.current);

    // Try canvas addon (GPU accelerated)
    try {
      const canvasAddon = new CanvasAddon();
      term.loadAddon(canvasAddon);
    } catch {}

    fitAddon.fit();

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    // Create pty
    window.electronAPI?.ptyCreate({
      paneId,
      profileId,
      cols: term.cols,
      rows: term.rows,
    });

    // Forward user input to pty, with remote-session command interception
    let inputBuffer = '';
    term.onData((data) => {
      // Intercept /remote-session command
      if (data === '\r') {
        const trimmed = inputBuffer.trim();
        if (trimmed === '/remote-session') {
          window.electronAPI?.remoteSessionStart(paneId).then((result: any) => {
            if (result?.success) {
              term.writeln('');
              term.writeln(`\x1b[32mRemote session started!\x1b[0m`);
              term.writeln(`\x1b[36mConnect at: \x1b[1m${result.url}\x1b[0m`);
              term.writeln(`\x1b[36mSession code: \x1b[1m${result.code}\x1b[0m`);
              onRemoteSession?.(result.code, result.url);
            } else {
              term.writeln('');
              term.writeln(`\x1b[31mFailed to start relay: is the relay server running?\x1b[0m`);
              term.writeln(`\x1b[33mStart it with: pnpm --filter @awesome-terminal/relay dev\x1b[0m`);
            }
          });
          inputBuffer = '';
          return; // Don't forward to pty
        } else if (trimmed === '/remote-session stop') {
          window.electronAPI?.remoteSessionStop(paneId).then(() => {
            term.writeln('');
            term.writeln('\x1b[33mRemote session stopped.\x1b[0m');
          });
          inputBuffer = '';
          return;
        }
        inputBuffer = '';
      } else if (data === '\x7f') {
        // Backspace
        inputBuffer = inputBuffer.slice(0, -1);
      } else {
        inputBuffer += data;
      }

      window.electronAPI?.ptyWrite({ paneId, data });
    });

    // Update tab title from terminal title
    term.onTitleChange((title) => {
      if (!title) return;
      if (/^[A-Za-z]:\\/.test(title)) return;
      if (title.length > 48) return;
      setTabTitle(tabId, title);
    });

    // Receive pty output
    const removeDataListener = window.electronAPI?.onPtyData((payload) => {
      if (payload.paneId === paneId) {
        term.write(payload.data);
      }
    });

    const removeExitListener = window.electronAPI?.onPtyExit((payload) => {
      if (payload.paneId === paneId) {
        term.writeln('\r\n\x1b[2m[Process exited]\x1b[0m');
      }
    });

    // Track focus at the container level since this xterm build does not expose term.onFocus().
    const focusTarget = containerRef.current;
    const handleFocusIn = () => setActivePaneId(tabId, paneId);
    focusTarget?.addEventListener('focusin', handleFocusIn);
    term.focus();

    // Resize observer
    const resizeObserver = new ResizeObserver(() => {
      try {
        fitAddon.fit();
        window.electronAPI?.ptyResize({ paneId, cols: term.cols, rows: term.rows });
      } catch {}
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      removeDataListener?.();
      removeExitListener?.();
      focusTarget?.removeEventListener('focusin', handleFocusIn);
      resizeObserver.disconnect();
      term.dispose();
      window.electronAPI?.ptyKill({ paneId });
    };
  }, [paneId, profileId]);

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
      window.electronAPI?.ptyResize({ paneId, cols: term.cols, rows: term.rows });
    } catch {}
  }, [paneId, terminalSettings]);

  return { termRef, fitAddonRef };
}
