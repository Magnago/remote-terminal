import express from 'express';
import { createServer } from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import { customAlphabet } from 'nanoid';
import { SessionManager } from './session-manager.js';
import { handleDesktopConnection, handleBrowserConnection } from './session-handler.js';
import { spawnLocalPty } from './local-pty.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;

const nanoid = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 6);

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const sessionManager = new SessionManager();

// Control clients — receive session list broadcasts
const controlClients = new Set<WebSocket>();
const desktopControlClients = new Set<WebSocket>();

const broadcastSessions = () => {
  const sessions = sessionManager.getSessions();
  const frame = JSON.stringify({ type: 'sessions-updated', sessions });
  controlClients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(frame);
  });
};

sessionManager.onSessionsChange(broadcastSessions);

// CORS — allow requests from the Electron renderer dev server and any other origin
app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

app.options('*', (_req, res) => { res.sendStatus(204); });

app.use(express.json());

// List all active sessions
app.get('/api/sessions', (_req, res) => {
  res.json(sessionManager.getSessions());
});

// Create a local PTY session and return its code.
app.post('/api/local-session', (req, res) => {
  const title = (req.body as { title?: string }).title;
  const code = nanoid();
  sessionManager.createSession(code, title);
  const pty = spawnLocalPty(code, sessionManager);
  if (!pty) {
    res.status(500).json({ error: 'Failed to spawn PTY' });
    return;
  }
  res.json({ code, title: sessionManager.getSession(code)!.title, url: `http://localhost:${PORT}/session/${code}` });
});

app.post('/api/desktop-session', (_req, res) => {
  const desktopClient = Array.from(desktopControlClients).find((ws) => ws.readyState === WebSocket.OPEN);
  if (!desktopClient) {
    res.status(503).json({ error: 'Desktop app is not connected' });
    return;
  }
  desktopClient.send(JSON.stringify({ type: 'create-session' }));
  res.status(202).json({ accepted: true });
});

// Rename a session
app.patch('/api/sessions/:code', (req, res) => {
  const { title } = req.body as { title?: string };
  const session = sessionManager.getSession(req.params.code);
  if (!session) { res.status(404).json({ error: 'Session not found' }); return; }
  if (title?.trim()) sessionManager.updateTitle(req.params.code, title.trim());
  res.json({ code: req.params.code, title: session.title });
});

// Delete (kill) a session
app.delete('/api/sessions/:code', (req, res) => {
  const session = sessionManager.getSession(req.params.code);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  // Notify browser clients before deleting
  session.browserSockets.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN)
      ws.send(JSON.stringify({ type: 'desktop-disconnected' }));
  });
  if (session.desktopSocket?.readyState === WebSocket.OPEN) {
    session.desktopSocket.send(JSON.stringify({ type: 'terminate' }));
  }
  sessionManager.deleteSession(req.params.code);
  res.sendStatus(204);
});

// Serve web client static files
app.use(express.static(join(__dirname, '../../web/dist')));

// Session info endpoint
app.get('/api/session/:code', (req, res) => {
  const session = sessionManager.getSession(req.params.code);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  res.json({ active: session.desktopSocket !== null || !!session.localPty, code: req.params.code });
});

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok', sessions: sessionManager.count }));

// Fallback to web client
app.get('*', (_req, res) => {
  const webIndex = join(__dirname, '../../web/dist/index.html');
  res.sendFile(webIndex, (err) => {
    if (err) res.status(200).send('<html><body><h2>Awesome Terminal Relay</h2><p>Web client not built. Run: pnpm --filter @awesome-terminal/web build</p></body></html>');
  });
});

wss.on('connection', (ws, req) => {
  const url = req.url || '/';

  if (url.startsWith('/desktop')) {
    handleDesktopConnection(ws, sessionManager);
  } else if (url.startsWith('/control/desktop')) {
    desktopControlClients.add(ws);
    ws.on('close', () => desktopControlClients.delete(ws));
    ws.on('error', () => desktopControlClients.delete(ws));
  } else if (url.startsWith('/browser')) {
    handleBrowserConnection(ws, req, sessionManager);
  } else if (url.startsWith('/control')) {
    // Send current session list immediately on connect
    ws.send(JSON.stringify({ type: 'sessions-updated', sessions: sessionManager.getSessions() }));
    controlClients.add(ws);
    ws.on('close', () => controlClients.delete(ws));
    ws.on('error', () => controlClients.delete(ws));
  } else {
    ws.close(1008, 'Unknown connection type');
  }
});

server.listen(PORT, () => {
  console.log(`[Relay] Server running on http://localhost:${PORT}`);
  console.log(`[Relay] WebSocket endpoints:`);
  console.log(`  Desktop: ws://localhost:${PORT}/desktop`);
  console.log(`  Browser: ws://localhost:${PORT}/browser?code=XXXXXX`);
  console.log(`  Control: ws://localhost:${PORT}/control`);
  console.log(`  Local session API: POST http://localhost:${PORT}/api/local-session`);
});
