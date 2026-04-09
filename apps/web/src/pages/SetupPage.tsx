import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRelayUrl } from '../hooks/useRelayUrl';

export default function SetupPage(): React.JSX.Element {
  const { setRelayUrl } = useRelayUrl();
  const navigate = useNavigate();
  const [input, setInput] = useState('http://');
  const [error, setError] = useState('');
  const [detecting, setDetecting] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-detect: if we're already being served by the relay, use window.location.origin
  useEffect(() => {
    const tryAutoDetect = async () => {
      try {
        const origin = window.location.origin;
        const resp = await fetch(`${origin}/health`, { signal: AbortSignal.timeout(2000) });
        if (resp.ok) {
          const data = await resp.json() as { status?: string };
          if (data.status === 'ok') {
            setRelayUrl(origin);
            navigate('/', { replace: true });
            return;
          }
        }
      } catch {}
      setDetecting(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    };
    void tryAutoDetect();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const url = new URL(input.trim());
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        setError('URL must start with http:// or https://');
        return;
      }
      setRelayUrl(input.trim());
      navigate('/', { replace: true });
    } catch {
      setError('Invalid URL — example: http://192.168.1.42:3001');
    }
  };

  if (detecting) {
    return (
      <div style={styles.center}>
        <div style={styles.spinner} />
        <p style={styles.detectingText}>Detecting relay…</p>
      </div>
    );
  }

  return (
    <div style={styles.center}>
      <div style={styles.card}>
        <div style={styles.logo}>&gt;_</div>
        <h1 style={styles.title}>Awesome Terminal</h1>
        <p style={styles.subtitle}>Enter your relay server address</p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            ref={inputRef}
            type="url"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="http://192.168.1.x:3001"
            style={styles.input}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
          />
          {error && <p style={styles.error}>{error}</p>}
          <button type="submit" style={styles.button}>Connect</button>
        </form>

        <div style={styles.hint}>
          <p style={styles.hintTitle}>How to find your relay address:</p>
          <p style={styles.hintText}>
            1. On your computer, run <code style={styles.code}>ipconfig</code> (Windows) and find your Wi-Fi IPv4 address.
          </p>
          <p style={styles.hintText}>
            2. Enter it as <code style={styles.code}>http://192.168.1.x:3001</code>
          </p>
          <p style={styles.hintText}>
            3. For remote access anywhere, install <code style={styles.code}>cloudflared</code> on your PC and use the tunnel URL printed by <code style={styles.code}>pnpm dev</code>.
          </p>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  center: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0e0e16',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    background: '#12131b',
    borderRadius: 20,
    border: '1px solid rgba(255,255,255,0.08)',
    padding: 32,
  },
  logo: {
    fontSize: 40,
    fontFamily: "'Cascadia Code', Consolas, monospace",
    color: '#d6895b',
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 700,
    color: '#e0e0e0',
    margin: '0 0 6px',
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.45)',
    margin: '0 0 28px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    marginBottom: 28,
  },
  input: {
    background: '#0e0e16',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 10,
    padding: '14px 16px',
    color: '#e0e0e0',
    fontSize: 16,
    fontFamily: "'Cascadia Code', Consolas, monospace",
    outline: 'none',
    width: '100%',
  },
  error: {
    color: '#ff6b6b',
    fontSize: 13,
    margin: 0,
  },
  button: {
    background: '#d6895b',
    color: '#fff8f2',
    border: 'none',
    borderRadius: 999,
    padding: '14px 0',
    fontSize: 16,
    fontWeight: 600,
    cursor: 'pointer',
    touchAction: 'manipulation',
  },
  hint: {
    borderTop: '1px solid rgba(255,255,255,0.07)',
    paddingTop: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  hintTitle: {
    fontSize: 12,
    fontWeight: 600,
    color: 'rgba(255,255,255,0.4)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    margin: 0,
  },
  hintText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.45)',
    margin: 0,
    lineHeight: 1.5,
  },
  code: {
    background: 'rgba(255,255,255,0.08)',
    borderRadius: 4,
    padding: '1px 5px',
    fontFamily: "'Cascadia Code', Consolas, monospace",
    fontSize: 12,
  },
  detectingText: {
    color: 'rgba(255,255,255,0.4)',
    marginTop: 16,
    fontSize: 14,
  },
  spinner: {
    width: 36,
    height: 36,
    border: '3px solid rgba(255,255,255,0.1)',
    borderTop: '3px solid #d6895b',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
};
