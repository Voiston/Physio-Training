import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

const INTERVALS_API_BASE = 'https://intervals.icu/api/v1';
const GOOGLE_CERTS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
const SAFE_ISO_DATE_REGEX = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/;
const SAFE_ATHLETE_ID_REGEX = /^(?:0|i?\d{1,12})$/;

// Liste d'emails propriétaires autorisés (alignée sur firestore.rules)
const DEFAULT_ALLOWED_EMAILS = [
  'poketime.idle@gmail.com',
  'david.voisard2@gmail.com',
  'vdcoachsportif@gmail.com',
];

function getAllowedEmails(): Set<string> {
  const fromEnv = (process.env.INTERVALS_ALLOWED_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return new Set([...DEFAULT_ALLOWED_EMAILS, ...fromEnv]);
}

function getFirebaseProjectId(): string {
  try {
    const raw = fs.readFileSync(path.join(__dirname, 'firebase-applet-config.json'), 'utf8');
    const parsed = JSON.parse(raw) as { projectId?: string };
    return typeof parsed.projectId === 'string' ? parsed.projectId : '';
  } catch {
    return '';
  }
}

interface CertCache {
  certs: Record<string, string>;
  expiresAt: number;
}
let googleCertCache: CertCache | null = null;

async function fetchGooglePublicCerts(): Promise<Record<string, string>> {
  const now = Date.now();
  if (googleCertCache && googleCertCache.expiresAt > now) {
    return googleCertCache.certs;
  }

  const resp = await fetch(GOOGLE_CERTS_URL, {
    signal: AbortSignal.timeout(8000),
  });
  if (!resp.ok) {
    throw new Error(`Unable to fetch Google signing certificates (${resp.status})`);
  }

  const cacheControl = resp.headers.get('cache-control') || '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/i);
  const ttlMs = maxAgeMatch ? Math.max(60, Number(maxAgeMatch[1])) * 1000 : 3600 * 1000;
  const certs = (await resp.json()) as Record<string, string>;
  googleCertCache = { certs, expiresAt: now + ttlMs };
  return certs;
}

interface VerifiedUser {
  uid: string;
  email: string;
}

/**
 * Vérifie cryptographiquement un jeton d'identité Firebase (RS256) contre les certificats
 * publics Google, l'audience du projet et la liste d'adresses e-mail autorisées.
 */
async function verifyFirebaseBearerToken(authHeader?: string): Promise<
  | { ok: true; user: VerifiedUser }
  | { ok: false; status: 401 | 403; error: string }
> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { ok: false, status: 401, error: 'Authentification Google requise.' };
  }

  const token = authHeader.slice(7).trim();
  const parts = token.split('.');
  if (parts.length !== 3) {
    return { ok: false, status: 401, error: 'Jeton d\'authentification invalide.' };
  }

  try {
    const [headerB64, payloadB64, sigB64] = parts;
    const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8')) as {
      alg?: string;
      kid?: string;
    };
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as {
      aud?: string;
      iss?: string;
      sub?: string;
      exp?: number;
      iat?: number;
      email?: string;
      email_verified?: boolean;
    };

    const projectId = getFirebaseProjectId();
    if (!projectId) {
      return { ok: false, status: 401, error: 'Configuration projet Firebase absente.' };
    }

    if (header.alg !== 'RS256' || !header.kid) {
      return { ok: false, status: 401, error: 'Algorithme de signature non supporté.' };
    }

    const nowSec = Math.floor(Date.now() / 1000);
    if (
      payload.aud !== projectId ||
      payload.iss !== `https://securetoken.google.com/${projectId}` ||
      typeof payload.sub !== 'string' ||
      payload.sub.length === 0 ||
      typeof payload.exp !== 'number' ||
      payload.exp <= nowSec ||
      typeof payload.iat !== 'number' ||
      payload.iat > nowSec + 300
    ) {
      return { ok: false, status: 401, error: 'Session expirée ou invalide.' };
    }

    const certs = await fetchGooglePublicCerts();
    const certPem = certs[header.kid];
    if (!certPem) {
      return { ok: false, status: 401, error: 'Clé de signature inconnue.' };
    }

    const isValidSig = crypto.verify(
      'RSA-SHA256',
      Buffer.from(`${headerB64}.${payloadB64}`, 'utf8'),
      certPem,
      Buffer.from(sigB64, 'base64url')
    );

    if (!isValidSig) {
      return { ok: false, status: 401, error: 'Signature du jeton invalide.' };
    }

    const email = (payload.email || '').toLowerCase();
    if (!payload.email_verified || !email || !getAllowedEmails().has(email)) {
      return { ok: false, status: 403, error: 'Compte Google non autorisé pour la synchronisation Garmin.' };
    }

    return { ok: true, user: { uid: payload.sub, email } };
  } catch {
    return { ok: false, status: 401, error: 'Vérification du jeton Google impossible.' };
  }
}

function isValidIsoCalendarDate(dateStr: string): boolean {
  if (!SAFE_ISO_DATE_REGEX.test(dateStr)) return false;
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function formatUtcDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function readEnvKeyFromDotenvFiles(keys: string[]): string {
  const candidates = ['.env.local', '.env'];
  for (const filename of candidates) {
    const filePath = path.join(__dirname, filename);
    try {
      if (!fs.existsSync(filePath)) continue;
      const content = fs.readFileSync(filePath, 'utf8');
      for (const rawLine of content.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;
        const eqIdx = line.indexOf('=');
        if (eqIdx <= 0) continue;
        const k = line.slice(0, eqIdx).trim();
        if (!keys.includes(k)) continue;
        let v = line.slice(eqIdx + 1).trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
          v = v.slice(1, -1).trim();
        }
        if (v) return v;
      }
    } catch {
      // Ignore unreadable env files
    }
  }
  return '';
}

function getIntervalsServerConfig(): { configured: boolean; apiKey: string; athleteId: string; authHeader: string } {
  const apiKey = (
    process.env.INTERVALS_ICU_API_KEY ||
    process.env.INTERVALS_API_KEY ||
    readEnvKeyFromDotenvFiles(['INTERVALS_ICU_API_KEY', 'INTERVALS_API_KEY']) ||
    ''
  ).trim();
  const rawAthleteId = (
    process.env.INTERVALS_ICU_ATHLETE_ID ||
    process.env.INTERVALS_ATHLETE_ID ||
    readEnvKeyFromDotenvFiles(['INTERVALS_ICU_ATHLETE_ID', 'INTERVALS_ATHLETE_ID']) ||
    '0'
  ).trim();
  const athleteId = SAFE_ATHLETE_ID_REGEX.test(rawAthleteId) ? rawAthleteId : '0';
  const authHeader = apiKey ? `Basic ${Buffer.from(`API_KEY:${apiKey}`).toString('base64')}` : '';
  return { configured: apiKey.length > 0, apiKey, athleteId, authHeader };
}

function sanitizeWellnessItem(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const item = raw as Record<string, unknown>;
  if (typeof item.id !== 'string' || !isValidIsoCalendarDate(item.id)) return null;
  return {
    id: item.id,
    hrv: typeof item.hrv === 'number' && Number.isFinite(item.hrv) ? item.hrv : null,
    restingHR: typeof item.restingHR === 'number' && Number.isFinite(item.restingHR) ? item.restingHR : null,
    readiness: typeof item.readiness === 'number' && Number.isFinite(item.readiness) ? item.readiness : null,
    sleepScore: typeof item.sleepScore === 'number' && Number.isFinite(item.sleepScore) ? item.sleepScore : null,
    sleepSecs: typeof item.sleepSecs === 'number' && Number.isFinite(item.sleepSecs) ? item.sleepSecs : null,
    sleepQuality: typeof item.sleepQuality === 'number' && Number.isFinite(item.sleepQuality) ? item.sleepQuality : null,
  };
}

function sanitizeActivityItem(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const item = raw as Record<string, unknown>;
  if ((typeof item.id !== 'string' && typeof item.id !== 'number') || typeof item.start_date_local !== 'string') {
    return null;
  }
  const datePart = item.start_date_local.slice(0, 10);
  if (!isValidIsoCalendarDate(datePart)) return null;

  const numOrNull = (val: unknown) => (typeof val === 'number' && Number.isFinite(val) ? val : null);

  return {
    id: String(item.id).slice(0, 64),
    name: typeof item.name === 'string' ? item.name.slice(0, 120) : null,
    type: typeof item.type === 'string' ? item.type.slice(0, 40) : null,
    start_date_local: item.start_date_local.slice(0, 32),
    moving_time: numOrNull(item.moving_time),
    elapsed_time: numOrNull(item.elapsed_time),
    distance: numOrNull(item.distance),
    total_elevation_gain: numOrNull(item.total_elevation_gain),
    average_heartrate: numOrNull(item.average_heartrate),
    max_heartrate: numOrNull(item.max_heartrate),
    icu_rpe: numOrNull(item.icu_rpe),
    feel: numOrNull(item.feel),
    icu_training_load: numOrNull(item.icu_training_load),
    icu_intensity: numOrNull(item.icu_intensity),
    icu_hr_zone_times: Array.isArray(item.icu_hr_zone_times)
      ? item.icu_hr_zone_times.slice(0, 10).map((z) => (typeof z === 'number' && Number.isFinite(z) ? z : 0))
      : null,
    source: typeof item.source === 'string' ? item.source.slice(0, 40) : null,
    trainer: typeof item.trainer === 'boolean' ? item.trainer : null,
  };
}

async function startServer() {
  const app = express();

  // 1. Obfuscation & suppression de l'empreinte serveur
  app.disable('x-powered-by');

  // 2. Defensive HTTP Security Headers
  const isProd = process.env.NODE_ENV === 'production';
  const CSP_POLICY = [
    "default-src 'self'",
    `script-src 'self'${isProd ? '' : " 'unsafe-inline'"} https://apis.google.com https://www.gstatic.com https://festive-condition-nzbz0.firebaseapp.com https://accounts.google.com`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https://lh3.googleusercontent.com https://*.googleusercontent.com https://www.gstatic.com",
    "connect-src 'self' https://*.googleapis.com https://firestore.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://festive-condition-nzbz0.firebaseapp.com https://*.firebaseapp.com https://*.firebaseio.com wss://*.firebaseio.com https://apis.google.com https://accounts.google.com https://*.workers.dev https://*.run.app",
    "frame-src 'self' https://festive-condition-nzbz0.firebaseapp.com https://accounts.google.com https://apis.google.com",
    "frame-ancestors 'self' https://*.google.com https://*.run.app https://aistudio.google.com https://*.googleusercontent.com",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');

  app.use((_req, res, next) => {
    res.setHeader('Content-Security-Policy', CSP_POLICY);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
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

  // 4. Proxy sécurisé Intervals.icu (Garmin Connect -> Intervals.icu -> PhysioTracker PRO)
  // Autorise les appels CORS strictement vérifiés depuis GitHub Pages (*.github.io) ou origines configurées
  const GITHUB_PAGES_ORIGIN_REGEX = /^https:\/\/[a-z0-9-]+\.github\.io$/i;
  const CLOUD_RUN_ORIGIN_REGEX = /^https:\/\/[a-z0-9-]+\.run\.app$/i;
  const LOCALHOST_ORIGIN_REGEX = /^http:\/\/(?:localhost|127\.0\.0\.1):3000$/;

  const isAllowedCorsOrigin = (origin?: string): boolean => {
    if (!origin) return false;
    if (
      GITHUB_PAGES_ORIGIN_REGEX.test(origin) ||
      CLOUD_RUN_ORIGIN_REGEX.test(origin) ||
      LOCALHOST_ORIGIN_REGEX.test(origin)
    ) {
      return true;
    }
    const extra = (process.env.INTERVALS_ALLOWED_ORIGINS || '')
      .split(',')
      .map((o) => o.trim().replace(/\/+$/, ''))
      .filter(Boolean);
    return extra.includes(origin);
  };

  app.use('/api/intervals', (req, res, next) => {
    const origin = typeof req.headers.origin === 'string' ? req.headers.origin : '';
    res.setHeader('Vary', 'Origin');
    if (origin && isAllowedCorsOrigin(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      res.setHeader('Access-Control-Max-Age', '600');
    }
    if (req.method === 'OPTIONS') {
      res.status(origin && isAllowedCorsOrigin(origin) ? 204 : 403).end();
      return;
    }
    next();
  });

  app.get('/api/intervals/status', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const cfg = getIntervalsServerConfig();

    if (!cfg.configured) {
      res.json({
        configured: false,
        authenticated: false,
        connected: false,
      });
      return;
    }

    const authResult = await verifyFirebaseBearerToken(req.headers.authorization);
    if (!authResult.ok) {
      res.json({
        configured: true,
        authenticated: false,
        connected: false,
      });
      return;
    }

    try {
      const profileResp = await fetch(`${INTERVALS_API_BASE}/athlete/${cfg.athleteId}`, {
        headers: {
          Authorization: cfg.authHeader,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(8000),
      });

      if (!profileResp.ok) {
        const message =
          profileResp.status === 401 || profileResp.status === 403
            ? 'Clé API Intervals.icu refusée (vérifiez INTERVALS_ICU_API_KEY dans les Secrets).'
            : `Intervals.icu indisponible (code ${profileResp.status}).`;
        res.json({
          configured: true,
          authenticated: true,
          connected: false,
          error: message,
        });
        return;
      }

      const profile = (await profileResp.json()) as { name?: unknown; id?: unknown };
      res.json({
        configured: true,
        authenticated: true,
        connected: true,
        athleteId: typeof profile.id === 'string' || typeof profile.id === 'number' ? String(profile.id) : cfg.athleteId,
        athleteName: typeof profile.name === 'string' ? profile.name.slice(0, 80) : undefined,
      });
    } catch {
      res.json({
        configured: true,
        authenticated: true,
        connected: false,
        error: 'Impossible de joindre Intervals.icu (délai dépassé ou erreur réseau).',
      });
    }
  });

  app.get('/api/intervals/sync', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');

    const authResult = await verifyFirebaseBearerToken(req.headers.authorization);
    if (!authResult.ok) {
      res.status(authResult.status).json({ error: authResult.error });
      return;
    }

    const cfg = getIntervalsServerConfig();
    if (!cfg.configured) {
      res.status(503).json({
        error: 'INTERVALS_NOT_CONFIGURED',
        message: 'Ajoutez INTERVALS_ICU_API_KEY dans les Secrets serveur pour activer la synchronisation Garmin.',
      });
      return;
    }

    const todayUtc = new Date();
    const defaultNewest = formatUtcDate(todayUtc);
    const defaultOldestDate = new Date(todayUtc.getTime() - 14 * 86400000);
    const defaultOldest = formatUtcDate(defaultOldestDate);

    const oldest = typeof req.query.oldest === 'string' ? req.query.oldest.trim() : defaultOldest;
    const newest = typeof req.query.newest === 'string' ? req.query.newest.trim() : defaultNewest;

    if (!isValidIsoCalendarDate(oldest) || !isValidIsoCalendarDate(newest)) {
      res.status(400).json({ error: 'Format de date invalide (YYYY-MM-DD attendu).' });
      return;
    }

    const diffDays = Math.round((Date.parse(`${newest}T00:00:00Z`) - Date.parse(`${oldest}T00:00:00Z`)) / 86400000);
    if (diffDays < 0 || diffDays > 60) {
      res.status(400).json({ error: 'La plage de synchronisation doit être comprise entre 0 et 60 jours.' });
      return;
    }

    const params = new URLSearchParams({ oldest, newest });
    const headers = {
      Authorization: cfg.authHeader,
      Accept: 'application/json',
    };

    try {
      const [wellnessResp, activitiesResp] = await Promise.all([
        fetch(`${INTERVALS_API_BASE}/athlete/${cfg.athleteId}/wellness.json?${params.toString()}`, {
          headers,
          signal: AbortSignal.timeout(10000),
        }),
        fetch(`${INTERVALS_API_BASE}/athlete/${cfg.athleteId}/activities?${params.toString()}`, {
          headers,
          signal: AbortSignal.timeout(10000),
        }),
      ]);

      if (wellnessResp.status === 401 || wellnessResp.status === 403 || activitiesResp.status === 401 || activitiesResp.status === 403) {
        res.status(502).json({
          error: 'INTERVALS_AUTH_FAILED',
          message: 'Clé API Intervals.icu invalide ou expirée. Vérifiez INTERVALS_ICU_API_KEY dans vos Secrets.',
        });
        return;
      }

      if (!wellnessResp.ok || !activitiesResp.ok) {
        res.status(502).json({
          error: 'INTERVALS_UPSTREAM_ERROR',
          message: `Réponse inattendue d'Intervals.icu (${wellnessResp.status}/${activitiesResp.status}).`,
        });
        return;
      }

      const [rawWellness, rawActivities] = await Promise.all([wellnessResp.json(), activitiesResp.json()]);

      const wellness = Array.isArray(rawWellness)
        ? rawWellness.map(sanitizeWellnessItem).filter((x): x is Record<string, unknown> => x !== null)
        : [];
      const activities = Array.isArray(rawActivities)
        ? rawActivities
            .slice(0, 100)
            .map(sanitizeActivityItem)
            .filter((x): x is Record<string, unknown> => x !== null)
        : [];

      res.json({
        syncedAt: new Date().toISOString(),
        oldest,
        newest,
        wellness,
        activities,
      });
    } catch {
      res.status(504).json({
        error: 'INTERVALS_NETWORK_ERROR',
        message: 'Délai dépassé lors de la communication avec Intervals.icu.',
      });
    }
  });

  // 5. Deprecated Unauthenticated Sync Endpoints (closed for security)
  app.all('/api/sync*', (_req, res) => {
    res.status(410).json({
      error: 'Unauthenticated API sync has been deprecated. All data synchronization is strictly isolated and authenticated via Google Auth & Firebase Firestore.',
    });
  });

  // 6. Serve static build in production, or Vite in development
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
