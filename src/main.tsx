import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { initPWAInstall } from './hooks/usePWAInstall.ts';
import './index.css';

// Rechargement automatique lorsqu'un chunk lazy échoue suite à un nouveau déploiement (hash obsolète)
window.addEventListener('vite:preloadError', (event) => {
  console.warn('[Vite] Erreur de préchargement de chunk (mise à jour détectée), actualisation de la page...', event);
  window.location.reload();
});

// Capture unique et globale de l'événement PWA avant le premier montage React
initPWAInstall();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
