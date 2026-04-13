# Remote Terminal

Remote Terminal is a pnpm workspace with three apps:

- An Electron desktop terminal built with React, `xterm.js`, and `node-pty`
- A relay server that exposes terminal sessions over WebSocket and HTTP
- A browser client for connecting to synced desktop terminal sessions from desktop or mobile

## Workspace Layout

```text
apps/
  desktop/  Electron desktop app
  relay/    Express + WebSocket relay server
  web/      Vite + React browser client
packages/
  shared/   Shared TypeScript types and IPC constants
```

## Requirements

- Node.js 20+
- pnpm 9+
- Windows for the desktop PTY workflow

## Install

```bash
pnpm install
```

## Development

Run the relay and desktop app together:

```bash
pnpm dev
```

`pnpm dev` will build the web client first if `apps/web/dist` is missing, so the relay can serve the mobile/browser UI.

Run individual apps:

```bash
pnpm dev:relay
pnpm dev:web
pnpm dev:desktop
```

## Build

```bash
pnpm build
```

This builds the shared package, relay server, web client, and desktop app through Turborepo.

## Test

```bash
pnpm test
```

Current automated tests cover the relay session manager and local PTY behavior.

## Lint

```bash
pnpm lint
```

## How It Works

### Desktop app

The desktop app hosts terminal panes with `xterm.js` and `node-pty`. It includes tab and workspace state, shell profile support, settings persistence, and relay-backed session sync exposed through Electron IPC.

### Relay server

The relay listens on port `3001` by default and provides:

- `ws://<host>:3001/desktop` for desktop session registration
- `ws://<host>:3001/browser?code=XXXXXX` for browser session attachment
- `ws://<host>:3001/control` for session list updates
- `ws://<host>:3001/control/desktop` for desktop control messages such as remote session creation
- `GET /health` for health checks
- `POST /api/desktop-session` to create a new desktop-owned session from the web client
- `POST /api/local-session` to create a local relay-backed PTY session
- `GET /api/sessions`, `PATCH /api/sessions/:code`, and `DELETE /api/sessions/:code`

The relay also serves the built web client from `apps/web/dist`.

### Web client

The web app supports:

- Connecting to a relay automatically when served by that relay
- Saving a relay URL for LAN or remote access
- Viewing the same live desktop sessions from desktop and mobile browsers
- Creating a new desktop session from the browser UI
- Closing a session from the browser and having it close in Electron as well
- Reconnecting to saved sessions from the browser UI
- Sending terminal input from desktop and mobile browsers

## Remote Sessions

Desktop and web sessions stay in sync through the relay. Creating or closing a session from Electron is reflected in the web client, and creating or closing a session from the web client is reflected in Electron.

The desktop app uses the configured relay URL from settings, or `REMOTE_TERMINAL_RELAY_URL` if that environment variable is set.

The helper script below starts the relay, launches the desktop app, and optionally opens a Cloudflare tunnel when `cloudflared` is installed:

```bash
pnpm dev
```

## Notes

- Build output, caches, logs, screenshots, and local test artifacts are intentionally ignored and should not be committed.
- This repository uses `pnpm-lock.yaml` as the only lockfile.
