# Awesome Terminal

Awesome Terminal is a pnpm workspace with three apps:

- An Electron desktop terminal built with React, `xterm.js`, and `node-pty`
- A relay server that exposes terminal sessions over WebSocket and HTTP
- A browser client for connecting to local or remote terminal sessions

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

The desktop app hosts terminal panes with `xterm.js` and `node-pty`. It includes tab and workspace state, shell profile support, settings persistence, and remote-session controls exposed through Electron IPC.

### Relay server

The relay listens on port `3001` by default and provides:

- `ws://<host>:3001/desktop` for desktop session registration
- `ws://<host>:3001/browser?code=XXXXXX` for browser session attachment
- `ws://<host>:3001/control` for session list updates
- `GET /health` for health checks
- `POST /api/local-session` to create a local relay-backed PTY session
- `GET /api/sessions`, `PATCH /api/sessions/:code`, and `DELETE /api/sessions/:code`

The relay also serves the built web client from `apps/web/dist`.

### Web client

The web app supports:

- Connecting to a relay automatically when served by that relay
- Saving a relay URL for LAN or remote access
- Joining sessions by six-character code
- Reconnecting to saved sessions from the browser UI
- Sending terminal input from desktop and mobile browsers

## Remote Sessions

From the desktop app, start a remote session and open the generated browser URL. The desktop app uses the configured relay URL from settings, or `AWESOME_TERMINAL_RELAY_URL` if that environment variable is set.

The helper script below starts the relay, launches the desktop app, and optionally opens a Cloudflare tunnel when `cloudflared` is installed:

```bash
pnpm dev
```

## Notes

- Build output, caches, logs, screenshots, and local test artifacts are intentionally ignored and should not be committed.
- This repository uses `pnpm-lock.yaml` as the only lockfile.
