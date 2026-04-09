import { describe, it, expect } from 'vitest';
import { cwdTitleInjection } from './local-pty.js';

describe('cwdTitleInjection', () => {
  // ── PowerShell ─────────────────────────────────────────────────────────────
  describe('powershell.exe', () => {
    const result = cwdTitleInjection('powershell.exe');

    it('uses -NoExit flag', () => {
      expect(result.args).toContain('-NoExit');
    });

    it('uses -Command flag', () => {
      expect(result.args).toContain('-Command');
    });

    it('command defines a prompt function', () => {
      const cmd = result.args[result.args.indexOf('-Command') + 1];
      expect(cmd).toContain('function prompt');
    });

    it('command sets WindowTitle to directory name', () => {
      const cmd = result.args[result.args.indexOf('-Command') + 1];
      expect(cmd).toContain('WindowTitle');
    });

    it('returns empty env additions', () => {
      expect(result.env).toEqual({});
    });
  });

  describe('pwsh.exe (PowerShell Core)', () => {
    const result = cwdTitleInjection('pwsh.exe');

    it('treats pwsh as PowerShell', () => {
      expect(result.args).toContain('-NoExit');
      expect(result.args).toContain('-Command');
    });

    it('returns empty env', () => {
      expect(result.env).toEqual({});
    });
  });

  // Case-insensitive path matching (e.g. C:\Windows\System32\WindowsPowerShell\...)
  describe('POWERSHELL.EXE (uppercase)', () => {
    it('is detected as PowerShell', () => {
      const result = cwdTitleInjection('POWERSHELL.EXE');
      expect(result.args).toContain('-NoExit');
    });
  });

  // ── bash / zsh ─────────────────────────────────────────────────────────────
  describe('bash', () => {
    const result = cwdTitleInjection('bash');

    it('passes no extra shell args', () => {
      expect(result.args).toEqual([]);
    });

    it('sets PROMPT_COMMAND in env', () => {
      expect(result.env).toHaveProperty('PROMPT_COMMAND');
    });

    it('PROMPT_COMMAND emits an OSC 0 title sequence', () => {
      // Must contain the ESC ] 0 ; sequence
      expect(result.env.PROMPT_COMMAND).toContain('\\033]0;');
    });

    it('PROMPT_COMMAND uses PWD basename expansion', () => {
      expect(result.env.PROMPT_COMMAND).toContain('PWD');
    });
  });

  describe('zsh', () => {
    const result = cwdTitleInjection('/usr/bin/zsh');

    it('passes no extra args', () => {
      expect(result.args).toEqual([]);
    });

    it('sets PROMPT_COMMAND', () => {
      expect(result.env).toHaveProperty('PROMPT_COMMAND');
    });
  });

  describe('/bin/sh', () => {
    it('falls back to POSIX behaviour (no args)', () => {
      const result = cwdTitleInjection('/bin/sh');
      expect(result.args).toEqual([]);
      expect(result.env).toHaveProperty('PROMPT_COMMAND');
    });
  });
});
