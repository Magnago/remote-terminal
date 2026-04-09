export const IpcChannels = {
  // PTY operations
  PTY_CREATE: 'pty:create',
  PTY_WRITE: 'pty:write',
  PTY_RESIZE: 'pty:resize',
  PTY_KILL: 'pty:kill',
  PTY_DATA: 'pty:data',
  PTY_EXIT: 'pty:exit',

  // Settings
  GET_SETTINGS: 'settings:get',
  SET_SETTINGS: 'settings:set',
  SETTINGS_CHANGED: 'settings:changed',

  // Window controls
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_MAXIMIZE: 'window:maximize',
  WINDOW_CLOSE: 'window:close',
  WINDOW_IS_MAXIMIZED: 'window:is-maximized',
  WINDOW_MAXIMIZED_CHANGED: 'window:maximized-changed',

  // Remote session
  REMOTE_SESSION_START: 'remote-session:start',
  REMOTE_SESSION_STOP: 'remote-session:stop',
  REMOTE_SESSION_STARTED: 'remote-session:started',
  REMOTE_SESSION_STOPPED: 'remote-session:stopped',
  REMOTE_SESSION_TERMINATED: 'remote-session:terminated',
  DESKTOP_SESSION_CREATE: 'desktop-session:create',

  // Shell profiles
  GET_PROFILES: 'profiles:get',
} as const;

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels];
