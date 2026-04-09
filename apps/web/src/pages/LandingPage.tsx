import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function LandingPage(): React.JSX.Element {
  const [code, setCode] = useState('');
  const navigate = useNavigate();

  const handleConnect = () => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length === 6) navigate(`/session/${trimmed}`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 24 }}>
      <div style={{ textAlign: 'center' }}>
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" style={{ margin: '0 auto 16px' }}>
          <rect width="48" height="48" rx="10" fill="#0078d4" />
          <path d="M10 16l14 8-14 8V16z" fill="white" />
          <path d="M28 30h10" stroke="white" strokeWidth="3" strokeLinecap="round" />
        </svg>
        <h1 style={{ fontSize: 28, fontWeight: 600, color: '#ffffff', marginBottom: 8 }}>Remote Terminal</h1>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>Remote Session Connect</p>
      </div>

      <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 32, width: '100%', maxWidth: 360 }}>
        <label style={{ display: 'block', fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 8 }}>
          Session Code
        </label>
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
          placeholder="XXXXXX"
          maxLength={6}
          style={{
            width: '100%',
            padding: '10px 14px',
            background: 'rgba(255,255,255,0.07)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 8,
            color: '#ffffff',
            fontSize: 22,
            fontFamily: 'monospace',
            textAlign: 'center',
            letterSpacing: 6,
            outline: 'none',
            marginBottom: 16,
          }}
          autoFocus
        />
        <button
          onClick={handleConnect}
          disabled={code.trim().length !== 6}
          style={{
            width: '100%',
            padding: '10px',
            background: code.trim().length === 6 ? '#0078d4' : 'rgba(255,255,255,0.1)',
            border: 'none',
            borderRadius: 8,
            color: 'white',
            fontSize: 14,
            fontWeight: 600,
            cursor: code.trim().length === 6 ? 'pointer' : 'not-allowed',
            transition: 'background 0.15s',
          }}
        >
          Connect
        </button>
      </div>

      <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, textAlign: 'center', maxWidth: 300 }}>
        Type <code style={{ background: 'rgba(255,255,255,0.1)', padding: '1px 5px', borderRadius: 3 }}>/remote-session</code> in the desktop app to get a session code
      </p>
    </div>
  );
}
