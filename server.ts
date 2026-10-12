import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  const app = express();

  // 1. Obfuscation & suppression de l'empreinte serveur
  app.disable('x-powered-by');

  // 2. Defensive HTTP Security Headers
  const CSP_POLICY = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://apis.google.com https://www.gstatic.com https://festive-condition-nzbz0.firebaseapp.com https://accounts.google.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https://lh3.googleusercontent.com https://*.googleusercontent.com https://www.gstatic.com",
    "connect-src 'self' https://firestore.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://festive-condition-nzbz0.firebaseapp.com https://apis.google.com https://accounts.google.com",
    "frame-src 'self' https://festive-condition-nzbz0.firebaseapp.com https://accounts.google.com https://apis.google.com",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');

  app.use((_req, res, next) => {
    res.setHeader('Content-Security-Policy', CSP_POLICY);
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    // HSTS (HTTP Strict Transport Security) : force HTTPS pendant 1 an (sans preload pour éviter de bloquer tout domaine parent)
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    // Permissions Policy
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
    // X-XSS-Protection: 0 désactive l'ancien filtre XSS faillible et vulnérable aux attaques par injection
    res.setHeader('X-XSS-Protection', '0');
    next();
  });

  // 3. Healthcheck API
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'healthy',
      service: 'PhysioTracker PRO',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    });
  });

  // 4. Deprecated Unauthenticated Sync Endpoints (closed for security)
  app.all('/api/sync*', (_req, res) => {
    res.status(410).json({
      error: 'Unauthenticated API sync has been deprecated. All data synchronization is strictly isolated and authenticated via Google Auth & Firebase Firestore.',
    });
  });

  // 5. Serve static build in production, or Vite in development
  if (process.env.NODE_ENV === 'production') {
    const distPath = path.join(__dirname, 'dist');
    if (!fs.existsSync(distPath)) {
      throw new Error('Production bundle missing: "dist" folder not found. Run "npm run build" first.');
    }
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`PhysioTracker PRO server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
