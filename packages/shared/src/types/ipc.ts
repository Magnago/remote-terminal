export interface PtyCreatePayload {
  paneId: string;
  profileId: string;
  cols: number;
  rows: number;
  cwd?: string;
}

export interface PtyWritePayload {
  paneId: string;
  data: string;
}

export interface PtyResizePayload {
  paneId: string;
  cols: number;
  rows: number;
}

export interface PtyKillPayload {
  paneId: string;
}

export interface PtyDataPayload {
  paneId: string;
  data: string;
}

export interface PtyExitPayload {
  paneId: string;
  exitCode: number | undefined;
}

export interface RemoteSessionStartPayload {
  paneId: string;
}

export interface RemoteSessionStopPayload {
  paneId: string;
}

export interface RemoteSessionStartedPayload {
  paneId: string;
  code: string;
  url: string;
}

export type SettingsPayload = Record<string, unknown>;
