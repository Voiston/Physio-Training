/**
 * PhysioTracker PRO — Passerelle sécurisée Intervals.icu pour GitHub Pages (Cloudflare Worker)
 *
 * Déploiement gratuit (2 min, sans carte bancaire) :
 * 1. Sur https://dash.cloudflare.com → Workers & Pages → Create → Create Worker.
 * 2. Collez ce fichier dans l'éditeur du Worker puis cliquez sur « Deploy ».
 * 3. Dans le Worker → Settings → Variables and Secrets → Add Secret :
 *      - Nom : INTERVALS_ICU_API_KEY   | Valeur : votre clé API Intervals.icu
 *      - (Optionnel) INTERVALS_ICU_ATHLETE_ID (par défaut : 0)
 *      - (Optionnel) ALLOWED_ORIGINS (ex: https://mon-domaine.fr)
 * 4. Copiez l'URL du Worker (ex: https://physio-garmin.xxx.workers.dev)
 *    dans GitHub → Settings → Secrets and variables → Actions → Variables :
 *      - Nom : VITE_INTERVALS_PROXY_URL
 *      - Valeur : https://physio-garmin.xxx.workers.dev
 * 5. Relancez le workflow « Deploy to GitHub Pages ».
 */

const INTERVALS_API_BASE = 'https://intervals.icu/api/v1';
const FIREBASE_PROJECT_ID = 'festive-condition-nzbz0';
const GOOGLE_JWKS_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

const SAFE_ISO_DATE_REGEX = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/;
const SAFE_ATHLETE_ID_REGEX = /^(?:0|i?\d{1,12})$/;
const GITHUB_PAGES_ORIGIN_REGEX = /^https:\/\/[a-z0-9-]+\.github\.io$/i;
const CLOUD_RUN_ORIGIN_REGEX = /^https:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)?\.run\.app$/i;
const LOCALHOST_ORIGIN_REGEX = /^http:\/\/(?:localhost|127\.0\.0\.1):3000$/;

const DEFAULT_ALLOWED_EMAILS = [
  'poketime.idle@gmail.com',
  'david.voisard2@gmail.com',
  'vdcoachsportif@gmail.com',
];

let jwksCache = {
  keys: new Map(),
  expiresAt: 0,
};

function getAllowedEmails(env) {
  const extra = String(env.INTERVALS_ALLOWED_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return new Set([...DEFAULT_ALLOWED_EMAILS, ...extra]);
}

function isAllowedOrigin(origin, env) {
  if (!origin || typeof origin !== 'string') return false;
  if (
    GITHUB_PAGES_ORIGIN_REGEX.test(origin) ||
    CLOUD_RUN_ORIGIN_REGEX.test(origin) ||
    LOCALHOST_ORIGIN_REGEX.test(origin)
  ) {
    return true;
  }
  const customOrigins = String(env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  return customOrigins.includes(origin);
}

function buildCorsHeaders(origin, env) {
  const headers = {
    Vary: 'Origin',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  };
  if (isAllowedOrigin(origin, env)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Authorization, Content-Type';
    headers['Access-Control-Max-Age'] = '600';
  }
  return headers;
}

function jsonResponse(body, status, origin, env) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...buildCorsHeaders(origin, env),
    },
  });
}

function base64UrlToUint8Array(base64Url) {
  const padded = base64Url.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((base64Url.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function decodeBase64UrlJson(base64Url) {
  const bytes = base64UrlToUint8Array(base64Url);
  const text = new TextDecoder().decode(bytes);
  return JSON.parse(text);
}

async function fetchGoogleJwks() {
  const now = Date.now();
  if (jwksCache.expiresAt > now && jwksCache.keys.size > 0) {
    return jwksCache.keys;
  }

  const resp = await fetch(GOOGLE_JWKS_URL, { signal: AbortSignal.timeout(8000) });
  if (!resp.ok) {
    throw new Error(`Unable to fetch Google JWKS (${resp.status})`);
  }

  const cacheControl = resp.headers.get('cache-control') || '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/i);
  const ttlMs = maxAgeMatch ? Math.max(60, Number(maxAgeMatch[1])) * 1000 : 3600 * 1000;

  const data = await resp.json();
  const keyMap = new Map();
  if (Array.isArray(data.keys)) {
    for (const jwk of data.keys) {
      if (jwk && typeof jwk.kid === 'string') {
        keyMap.set(jwk.kid, jwk);
      }
    }
  }

  jwksCache = { keys: keyMap, expiresAt: now + ttlMs };
  return keyMap;
}

async function verifyFirebaseBearerToken(authHeader, env) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { ok: false, status: 401, error: 'Authentification Google requise.' };
  }

  const token = authHeader.slice(7).trim();
  const parts = token.split('.');
  if (parts.length !== 3) {
    return { ok: false, status: 401, error: "Jeton d'authentification invalide." };
  }

  try {
    const [headerB64, payloadB64, sigB64] = parts;
    const header = decodeBase64UrlJson(headerB64);
    const payload = decodeBase64UrlJson(payloadB64);
    const projectId = String(env.FIREBASE_PROJECT_ID || FIREBASE_PROJECT_ID).trim();

    if (header.alg !== 'RS256' || typeof header.kid !== 'string' || !header.kid) {
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

    const jwks = await fetchGoogleJwks();
    const jwk = jwks.get(header.kid);
    if (!jwk) {
      return { ok: false, status: 401, error: 'Clé de signature inconnue.' };
    }

    const cryptoKey = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const dataBytes = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    const sigBytes = base64UrlToUint8Array(sigB64);
    const isValidSig = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      cryptoKey,
      sigBytes,
      dataBytes
    );

    if (!isValidSig) {
      return { ok: false, status: 401, error: 'Signature du jeton invalide.' };
    }

    const email = String(payload.email || '').toLowerCase();
    if (!payload.email_verified || !email || !getAllowedEmails(env).has(email)) {
      return {
        ok: false,
        status: 403,
        error: 'Compte Google non autorisé pour la synchronisation Garmin.',
      };
    }

    return { ok: true, user: { uid: payload.sub, email } };
  } catch {
    return { ok: false, status: 401, error: 'Vérification du jeton Google impossible.' };
  }
}

function isValidIsoCalendarDate(dateStr) {
  if (!SAFE_ISO_DATE_REGEX.test(dateStr)) return false;
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function formatUtcDate(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getIntervalsConfig(env) {
  const apiKey = String(env.INTERVALS_ICU_API_KEY || env.INTERVALS_API_KEY || '').trim();
  const rawAthleteId = String(env.INTERVALS_ICU_ATHLETE_ID || env.INTERVALS_ATHLETE_ID || '0').trim();
  const athleteId = SAFE_ATHLETE_ID_REGEX.test(rawAthleteId) ? rawAthleteId : '0';
  const authHeader = apiKey ? `Basic ${btoa(`API_KEY:${apiKey}`)}` : '';
  return { configured: apiKey.length > 0, athleteId, authHeader };
}

function toFiniteNumberOrNull(v) {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const parsed = Number(v);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function sanitizeWellnessItem(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  if (typeof raw.id !== 'string' || !isValidIsoCalendarDate(raw.id)) return null;
  return {
    id: raw.id,
    hrv: toFiniteNumberOrNull(raw.hrv),
    hrvSDNN: toFiniteNumberOrNull(raw.hrvSDNN),
    restingHR: toFiniteNumberOrNull(raw.restingHR),
    avgSleepingHR: toFiniteNumberOrNull(raw.avgSleepingHR),
    readiness: toFiniteNumberOrNull(raw.readiness),
    GarminTrainingReadiness: toFiniteNumberOrNull(raw.GarminTrainingReadiness),
    sleepScore: toFiniteNumberOrNull(raw.sleepScore),
    sleepSecs: toFiniteNumberOrNull(raw.sleepSecs),
    sleepQuality: toFiniteNumberOrNull(raw.sleepQuality),
    bodyBattery: toFiniteNumberOrNull(
      raw.bodyBattery ?? raw.BodyBattery ?? raw.GarminBodyBatteryMax
    ),
  };
}

function sanitizeActivityItem(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  if (
    (typeof raw.id !== 'string' && typeof raw.id !== 'number') ||
    typeof raw.start_date_local !== 'string'
  ) {
    return null;
  }
  const datePart = raw.start_date_local.slice(0, 10);
  if (!isValidIsoCalendarDate(datePart)) return null;

  const numOrNull = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

  return {
    id: String(raw.id).slice(0, 64),
    name: typeof raw.name === 'string' ? raw.name.slice(0, 120) : null,
    type: typeof raw.type === 'string' ? raw.type.slice(0, 40) : null,
    start_date_local: raw.start_date_local.slice(0, 32),
    moving_time: numOrNull(raw.moving_time),
    elapsed_time: numOrNull(raw.elapsed_time),
    distance: numOrNull(raw.distance),
    total_elevation_gain: numOrNull(raw.total_elevation_gain),
    average_heartrate: numOrNull(raw.average_heartrate),
    max_heartrate: numOrNull(raw.max_heartrate),
    icu_rpe: numOrNull(raw.icu_rpe),
    feel: numOrNull(raw.feel),
    icu_training_load: numOrNull(raw.icu_training_load),
    icu_intensity: numOrNull(raw.icu_intensity),
    icu_hr_zone_times: Array.isArray(raw.icu_hr_zone_times)
      ? raw.icu_hr_zone_times
          .slice(0, 10)
          .map((z) => (typeof z === 'number' && Number.isFinite(z) ? z : 0))
      : null,
    source: typeof raw.source === 'string' ? raw.source.slice(0, 40) : null,
    trainer: typeof raw.trainer === 'boolean' ? raw.trainer : null,
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const url = new URL(request.url);
    const pathname = url.pathname.replace(/\/+$/, '') || '/';

    if (request.method === 'OPTIONS') {
      if (!isAllowedOrigin(origin, env)) {
        return new Response(null, { status: 403 });
      }
      return new Response(null, { status: 204, headers: buildCorsHeaders(origin, env) });
    }

    if (request.method !== 'GET') {
      return jsonResponse({ error: 'Méthode non autorisée.' }, 405, origin, env);
    }

    if (pathname === '/' || pathname === '/api/health') {
      return jsonResponse({ status: 'healthy', service: 'PhysioTracker Garmin Proxy' }, 200, origin, env);
    }

    if (pathname === '/api/intervals/status') {
      const cfg = getIntervalsConfig(env);
      if (!cfg.configured) {
        return jsonResponse(
          { configured: false, authenticated: false, connected: false },
          200,
          origin,
          env
        );
      }

      const authResult = await verifyFirebaseBearerToken(request.headers.get('Authorization'), env);
      if (!authResult.ok) {
        return jsonResponse(
          { configured: true, authenticated: false, connected: false },
          200,
          origin,
          env
        );
      }

      try {
        const profileResp = await fetch(`${INTERVALS_API_BASE}/athlete/${cfg.athleteId}`, {
          headers: { Authorization: cfg.authHeader, Accept: 'application/json' },
          signal: AbortSignal.timeout(8000),
        });

        if (!profileResp.ok) {
          const message =
            profileResp.status === 401 || profileResp.status === 403
              ? 'Clé API Intervals.icu refusée (vérifiez INTERVALS_ICU_API_KEY dans les Secrets du Worker).'
              : `Intervals.icu indisponible (code ${profileResp.status}).`;
          return jsonResponse(
            { configured: true, authenticated: true, connected: false, error: message },
            200,
            origin,
            env
          );
        }

        const profile = await profileResp.json();
        return jsonResponse(
          {
            configured: true,
            authenticated: true,
            connected: true,
            athleteId:
              typeof profile.id === 'string' || typeof profile.id === 'number'
                ? String(profile.id)
                : cfg.athleteId,
            athleteName: typeof profile.name === 'string' ? profile.name.slice(0, 80) : undefined,
          },
          200,
          origin,
          env
        );
      } catch {
        return jsonResponse(
          {
            configured: true,
            authenticated: true,
            connected: false,
            error: 'Impossible de joindre Intervals.icu (délai dépassé ou erreur réseau).',
          },
          200,
          origin,
          env
        );
      }
    }

    if (pathname === '/api/intervals/sync') {
      const authResult = await verifyFirebaseBearerToken(request.headers.get('Authorization'), env);
      if (!authResult.ok) {
        return jsonResponse({ error: authResult.error }, authResult.status, origin, env);
      }

      const cfg = getIntervalsConfig(env);
      if (!cfg.configured) {
        return jsonResponse(
          {
            error: 'INTERVALS_NOT_CONFIGURED',
            message: 'Ajoutez INTERVALS_ICU_API_KEY dans les Secrets du Cloudflare Worker.',
          },
          503,
          origin,
          env
        );
      }

      const todayUtc = new Date();
      const defaultNewest = formatUtcDate(todayUtc);
      const defaultOldest = formatUtcDate(new Date(todayUtc.getTime() - 14 * 86400000));

      const oldest = (url.searchParams.get('oldest') || defaultOldest).trim();
      const newest = (url.searchParams.get('newest') || defaultNewest).trim();

      if (!isValidIsoCalendarDate(oldest) || !isValidIsoCalendarDate(newest)) {
        return jsonResponse(
          { error: 'Format de date invalide (YYYY-MM-DD attendu).' },
          400,
          origin,
          env
        );
      }

      const diffDays = Math.round(
        (Date.parse(`${newest}T00:00:00Z`) - Date.parse(`${oldest}T00:00:00Z`)) / 86400000
      );
      if (diffDays < 0 || diffDays > 60) {
        return jsonResponse(
          { error: 'La plage de synchronisation doit être comprise entre 0 et 60 jours.' },
          400,
          origin,
          env
        );
      }

      const params = new URLSearchParams({ oldest, newest });
      const headers = { Authorization: cfg.authHeader, Accept: 'application/json' };

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

        if (
          wellnessResp.status === 401 ||
          wellnessResp.status === 403 ||
          activitiesResp.status === 401 ||
          activitiesResp.status === 403
        ) {
          return jsonResponse(
            {
              error: 'INTERVALS_AUTH_FAILED',
              message: 'Clé API Intervals.icu invalide ou expirée.',
            },
            502,
            origin,
            env
          );
        }

        if (!wellnessResp.ok || !activitiesResp.ok) {
          return jsonResponse(
            {
              error: 'INTERVALS_UPSTREAM_ERROR',
              message: `Réponse inattendue d'Intervals.icu (${wellnessResp.status}/${activitiesResp.status}).`,
            },
            502,
            origin,
            env
          );
        }

        const [rawWellness, rawActivities] = await Promise.all([
          wellnessResp.json(),
          activitiesResp.json(),
        ]);

        const wellness = Array.isArray(rawWellness)
          ? rawWellness.map(sanitizeWellnessItem).filter(Boolean)
          : [];
        const activities = Array.isArray(rawActivities)
          ? rawActivities.slice(0, 100).map(sanitizeActivityItem).filter(Boolean)
          : [];

        return jsonResponse(
          {
            syncedAt: new Date().toISOString(),
            oldest,
            newest,
            wellness,
            activities,
          },
          200,
          origin,
          env
        );
      } catch {
        return jsonResponse(
          {
            error: 'INTERVALS_NETWORK_ERROR',
            message: 'Délai dépassé lors de la communication avec Intervals.icu.',
          },
          504,
          origin,
          env
        );
      }
    }

    return jsonResponse({ error: 'Route introuvable.' }, 404, origin, env);
  },
};
