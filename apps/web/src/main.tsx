import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useRelayUrl } from './hooks/useRelayUrl';
import SetupPage from './pages/SetupPage';
import AppShell from './pages/AppShell';

function RequireRelay({ children }: { children: React.ReactNode }) {
  const { isConfigured } = useRelayUrl();
  const location = useLocation();
  if (!isConfigured) {
    return <Navigate to="/setup" state={{ from: location }} replace />;
  }
  return <>{children}</>;
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/setup" element={<SetupPage />} />
        <Route path="/*" element={
          <RequireRelay>
            <AppShell />
          </RequireRelay>
        } />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);

// Register service worker for PWA / offline support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // SW registration is optional — fails silently on HTTP non-localhost
    });
  });
}
