import { WebSocket, RawData } from 'ws';
import { IncomingMessage } from 'http';
import { SessionManager } from './session-manager.js';

/** Extract window title from OSC 0/2 escape sequences */
function parseOscTitle(data: string): string | null {
  const match = data.match(/\x1b\](?:0|2);([^\x07\x1b]*?)(?:\x07|\x1b\\)/);
  return match?.[1] ?? null;
}

export function handleDesktopConnection(ws: WebSocket, manager: SessionManager): void {
  let sessionCode: string | null = null;

  ws.on('message', (raw: RawData) => {
    try {
      const msg = JSON.parse(raw.toString());

      if (msg.type === 'register-desktop') {
        sessionCode = msg.code as string;
        let session = manager.getSession(sessionCode);
        if (!session) session = manager.createSession(sessionCode);
        session.desktopSocket = ws;

        console.log(`[Relay] Desktop registered for session: ${sessionCode}`);

        // Notify waiting browsers
        session.browserSockets.forEach((browserWs) => {
          browserWs.send(JSON.stringify({ type: 'session-ready' }));
        });
      } else if (msg.type === 'data' && sessionCode) {
        const session = manager.getSession(sessionCode);
        if (!session) return;
        manager.touch(sessionCode);
        manager.appendOutput(sessionCode, msg.payload as string);

        // Auto-rename from PTY title sequences in desktop output
        const oscTitle = parseOscTitle(msg.payload as string);
        if (oscTitle) manager.updateTitle(sessionCode, oscTitle);

        // Broadcast terminal output to all browser clients
        const frame = JSON.stringify({ type: 'data', payload: msg.payload });
        session.browserSockets.forEach((browserWs) => {
          if (browserWs.readyState === WebSocket.OPEN) {
            browserWs.send(frame);
          }
        });
      }
    } catch (err) {
      console.error('[Relay] Desktop message error:', err);
    }
  });

  ws.on('close', () => {
    if (!sessionCode) return;
    const session = manager.getSession(sessionCode);
    if (session) {
      session.desktopSocket = null;
      session.browserSockets.forEach((browserWs) => {
        browserWs.send(JSON.stringify({ type: 'desktop-disconnected' }));
      });
    }
    console.log(`[Relay] Desktop disconnected from session: ${sessionCode}`);
  });

  ws.on('error', (err) => console.error('[Relay] Desktop WS error:', err));
}

export function handleBrowserConnection(
  ws: WebSocket,
  req: IncomingMessage,
  manager: SessionManager
): void {
  const urlParams = new URL(`http://localhost${req.url || ''}`).searchParams;
  const code = urlParams.get('code');

  if (!code) {
    ws.close(1008, 'Missing session code');
    return;
  }

  let session = manager.getSession(code);
  if (!session) session = manager.createSession(code);
  session.browserSockets.add(ws);

  console.log(`[Relay] Browser connected to session: ${code}`);

  // Session is ready if a desktop is connected OR a local PTY is running
  if (session.desktopSocket?.readyState === WebSocket.OPEN || session.localPty) {
    ws.send(JSON.stringify({ type: 'session-ready' }));
    // Replay buffered PTY output so late-connecting browsers see the terminal history.
    // Use 'replay' (not 'data') so clients know to reset before writing,
    // preventing duplicate output on reconnect.
    if (session.outputBuffer) {
      ws.send(JSON.stringify({ type: 'replay', payload: session.outputBuffer }));
    }
  } else {
    ws.send(JSON.stringify({ type: 'waiting-for-desktop' }));
  }

  ws.on('message', (raw: RawData) => {
    try {
      const msg = JSON.parse(raw.toString());
      const sess = manager.getSession(code);
      if (!sess) return;
      manager.touch(code);

      if (msg.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
        return;
      } else if (msg.type === 'data') {
        if (sess.desktopSocket?.readyState === WebSocket.OPEN) {
          sess.desktopSocket.send(JSON.stringify({ type: 'data', payload: msg.payload }));
        } else if (sess.localPty) {
          sess.localPty.write(msg.payload as string);
        }
      } else if (msg.type === 'resize') {
        if (sess.desktopSocket?.readyState === WebSocket.OPEN) {
          sess.desktopSocket.send(JSON.stringify({ type: 'resize', cols: msg.cols, rows: msg.rows }));
        } else if (sess.localPty) {
          try { sess.localPty.resize(msg.cols as number, msg.rows as number); } catch {}
        }
      }
    } catch (err) {
      console.error('[Relay] Browser message error:', err);
    }
  });

  ws.on('close', () => {
    const sess = manager.getSession(code);
    if (sess) {
      sess.browserSockets.delete(ws);
      // Sessions (and their PTYs) persist after all browsers disconnect.
      // They are only destroyed via DELETE /api/sessions/:code or TTL expiry.
    }
    console.log(`[Relay] Browser disconnected from session: ${code}`);
  });

  ws.on('error', (err) => console.error('[Relay] Browser WS error:', err));
}
