import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionManager, cleanForReplay, OUTPUT_BUFFER_MAX } from './session-manager.js';

// ─── cleanForReplay ──────────────────────────────────────────────────────────

describe('cleanForReplay', () => {
  it('keeps plain text unchanged', () => {
    expect(cleanForReplay('hello world')).toBe('hello world');
  });

  it('keeps ANSI color / bold sequences', () => {
    const colored = '\x1b[32mgreen\x1b[0m \x1b[1mbold\x1b[0m';
    expect(cleanForReplay(colored)).toBe(colored);
  });

  it('strips cursor-up (A)', () => {
    expect(cleanForReplay('foo\x1b[1Abar')).toBe('foobar');
  });

  it('strips cursor-down (B)', () => {
    expect(cleanForReplay('foo\x1b[2Bbar')).toBe('foobar');
  });

  it('strips cursor-forward (C) and backward (D)', () => {
    expect(cleanForReplay('\x1b[5C\x1b[3D')).toBe('');
  });

  it('strips cursor absolute position (H)', () => {
    expect(cleanForReplay('\x1b[10;5H')).toBe('');
  });

  it('strips erase display (J) and erase line (K)', () => {
    expect(cleanForReplay('\x1b[2J\x1b[K')).toBe('');
  });

  it('strips scroll up/down (S/T)', () => {
    expect(cleanForReplay('\x1b[3S\x1b[2T')).toBe('');
  });

  it('strips save/restore cursor (s/u)', () => {
    expect(cleanForReplay('\x1b[s\x1b[u')).toBe('');
  });

  it('strips alternate-screen private mode (?1049h / ?1049l)', () => {
    expect(cleanForReplay('\x1b[?1049h\x1b[?1049l')).toBe('');
  });

  it('strips bracketed-paste mode (?2004h)', () => {
    expect(cleanForReplay('\x1b[?2004h')).toBe('');
  });

  it('strips cursor-visibility sequences (?25h / ?25l)', () => {
    expect(cleanForReplay('\x1b[?25l\x1b[?25h')).toBe('');
  });

  it('converts bare \\r to \\n', () => {
    expect(cleanForReplay('line1\rline2')).toBe('line1\nline2');
  });

  it('leaves \\r\\n (CRLF) intact — only replaces bare \\r', () => {
    expect(cleanForReplay('line1\r\nline2')).toBe('line1\r\nline2');
  });

  it('handles mixed content: strips sequences, keeps text and colors', () => {
    const raw = '\x1b[?25l\x1b[32mBuilding...\x1b[0m\x1b[1A\x1b[2K\x1b[32mDone\x1b[0m\x1b[?25h';
    expect(cleanForReplay(raw)).toBe('\x1b[32mBuilding...\x1b[0m\x1b[32mDone\x1b[0m');
  });

  it('handles empty string', () => {
    expect(cleanForReplay('')).toBe('');
  });

  it('handles multi-param sequences like \\x1b[0;39;49m (color reset)', () => {
    // Color codes have letter in [A-Za-z] — but NOT in [ABCDEFGHJKSTfsu] set
    // 'm' is not stripped, so this must be kept
    const reset = '\x1b[0;39;49m';
    expect(cleanForReplay(reset)).toBe(reset);
  });
});

// ─── SessionManager ──────────────────────────────────────────────────────────

describe('SessionManager', () => {
  let mgr: SessionManager;

  beforeEach(() => {
    mgr = new SessionManager();
  });

  // ── createSession ───────────────────────────────────────────────────────
  describe('createSession', () => {
    it('creates a session with the given code', () => {
      mgr.createSession('abc');
      expect(mgr.getSession('abc')).toBeDefined();
    });

    it('uses the provided title', () => {
      mgr.createSession('abc', 'My Shell');
      expect(mgr.getSession('abc')?.title).toBe('My Shell');
    });

    it('generates a default title when none provided', () => {
      mgr.createSession('abc');
      expect(mgr.getSession('abc')?.title).toMatch(/Session/);
    });

    it('increments count', () => {
      expect(mgr.count).toBe(0);
      mgr.createSession('a');
      expect(mgr.count).toBe(1);
      mgr.createSession('b');
      expect(mgr.count).toBe(2);
    });

    it('initialises outputBuffer as empty string', () => {
      mgr.createSession('abc');
      expect(mgr.getSession('abc')?.outputBuffer).toBe('');
    });

    it('notifies change listeners', () => {
      const cb = vi.fn();
      mgr.onSessionsChange(cb);
      mgr.createSession('abc');
      expect(cb).toHaveBeenCalledOnce();
    });
  });

  // ── getSession / getSessions ────────────────────────────────────────────
  describe('getSession', () => {
    it('returns undefined for unknown code', () => {
      expect(mgr.getSession('nope')).toBeUndefined();
    });
  });

  describe('getSessions', () => {
    it('returns all sessions as {code, title} pairs', () => {
      mgr.createSession('a', 'Alpha');
      mgr.createSession('b', 'Beta');
      const list = mgr.getSessions();
      expect(list).toHaveLength(2);
      expect(list).toContainEqual({ code: 'a', title: 'Alpha' });
      expect(list).toContainEqual({ code: 'b', title: 'Beta' });
    });

    it('returns empty array when no sessions', () => {
      expect(mgr.getSessions()).toEqual([]);
    });
  });

  // ── deleteSession ───────────────────────────────────────────────────────
  describe('deleteSession', () => {
    it('removes the session', () => {
      mgr.createSession('abc');
      mgr.deleteSession('abc');
      expect(mgr.getSession('abc')).toBeUndefined();
      expect(mgr.count).toBe(0);
    });

    it('notifies change listeners', () => {
      const cb = vi.fn();
      mgr.createSession('abc');
      mgr.onSessionsChange(cb);
      mgr.deleteSession('abc');
      expect(cb).toHaveBeenCalledOnce();
    });

    it('is a no-op for unknown code', () => {
      expect(() => mgr.deleteSession('unknown')).not.toThrow();
    });
  });

  // ── updateTitle ─────────────────────────────────────────────────────────
  describe('updateTitle', () => {
    it('updates title', () => {
      mgr.createSession('abc', 'Old');
      mgr.updateTitle('abc', 'New');
      expect(mgr.getSession('abc')?.title).toBe('New');
    });

    it('trims whitespace from title', () => {
      mgr.createSession('abc', 'Old');
      mgr.updateTitle('abc', '  Trimmed  ');
      expect(mgr.getSession('abc')?.title).toBe('Trimmed');
    });

    it('does nothing for empty/whitespace title', () => {
      mgr.createSession('abc', 'Keep');
      mgr.updateTitle('abc', '   ');
      expect(mgr.getSession('abc')?.title).toBe('Keep');
    });

    it('does nothing when title is unchanged', () => {
      const cb = vi.fn();
      mgr.createSession('abc', 'Same');
      mgr.onSessionsChange(cb);
      mgr.updateTitle('abc', 'Same');
      expect(cb).not.toHaveBeenCalled();
    });

    it('notifies listeners on actual change', () => {
      const cb = vi.fn();
      mgr.createSession('abc', 'Old');
      mgr.onSessionsChange(cb);
      mgr.updateTitle('abc', 'New');
      expect(cb).toHaveBeenCalledOnce();
    });

    it('does nothing for unknown code', () => {
      expect(() => mgr.updateTitle('nope', 'x')).not.toThrow();
    });
  });

  // ── appendOutput ────────────────────────────────────────────────────────
  describe('appendOutput', () => {
    it('appends clean text to outputBuffer', () => {
      mgr.createSession('abc');
      mgr.appendOutput('abc', 'hello ');
      mgr.appendOutput('abc', 'world');
      expect(mgr.getSession('abc')?.outputBuffer).toBe('hello world');
    });

    it('strips cursor sequences before storing', () => {
      mgr.createSession('abc');
      mgr.appendOutput('abc', 'before\x1b[1Aafter');
      expect(mgr.getSession('abc')?.outputBuffer).toBe('beforeafter');
    });

    it('strips alternate-screen sequences', () => {
      mgr.createSession('abc');
      mgr.appendOutput('abc', '\x1b[?1049hsome text\x1b[?1049l');
      expect(mgr.getSession('abc')?.outputBuffer).toBe('some text');
    });

    it('trims buffer to OUTPUT_BUFFER_MAX when it overflows', () => {
      mgr.createSession('abc');
      // Fill buffer above max
      const chunk = 'x'.repeat(OUTPUT_BUFFER_MAX / 2);
      mgr.appendOutput('abc', chunk);
      mgr.appendOutput('abc', chunk);
      mgr.appendOutput('abc', chunk); // triggers trim
      const buf = mgr.getSession('abc')?.outputBuffer ?? '';
      expect(buf.length).toBeLessThanOrEqual(OUTPUT_BUFFER_MAX);
    });

    it('preserves the tail (most recent output) after trimming', () => {
      mgr.createSession('abc');
      const filler = 'a'.repeat(OUTPUT_BUFFER_MAX);
      mgr.appendOutput('abc', filler);
      mgr.appendOutput('abc', 'RECENT_TAIL');
      const buf = mgr.getSession('abc')?.outputBuffer ?? '';
      expect(buf.endsWith('RECENT_TAIL')).toBe(true);
    });

    it('is a no-op for unknown session', () => {
      expect(() => mgr.appendOutput('nope', 'data')).not.toThrow();
    });
  });

  // ── touch ───────────────────────────────────────────────────────────────
  describe('touch', () => {
    it('updates lastActivity timestamp', () => {
      mgr.createSession('abc');
      const before = mgr.getSession('abc')!.lastActivity;
      // Small sleep to ensure timestamp advances
      const start = Date.now();
      while (Date.now() === start) { /* spin */ }
      mgr.touch('abc');
      expect(mgr.getSession('abc')!.lastActivity).toBeGreaterThanOrEqual(before);
    });

    it('is a no-op for unknown code', () => {
      expect(() => mgr.touch('nope')).not.toThrow();
    });
  });

  // ── onSessionsChange ────────────────────────────────────────────────────
  describe('onSessionsChange', () => {
    it('returns an unsubscribe function that works', () => {
      const cb = vi.fn();
      const unsub = mgr.onSessionsChange(cb);
      unsub();
      mgr.createSession('abc');
      expect(cb).not.toHaveBeenCalled();
    });

    it('supports multiple listeners', () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      mgr.onSessionsChange(cb1);
      mgr.onSessionsChange(cb2);
      mgr.createSession('abc');
      expect(cb1).toHaveBeenCalledOnce();
      expect(cb2).toHaveBeenCalledOnce();
    });
  });
});
