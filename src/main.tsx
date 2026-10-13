import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { initPWAInstall } from './hooks/usePWAInstall.ts';
import './index.css';

// Capture unique et globale de l'événement PWA avant le premier montage React
initPWAInstall();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
