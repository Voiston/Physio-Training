/**
 * Shared security, validation, CORS, and sanitization core for the Intervals.icu proxy.
 * Used directly by server.ts (Node/Express) and verified for parity with workers/intervals-proxy.js.
 */

export const INTERVALS_API_BASE = 'https://intervals.icu/api/v1';

export const SAFE_ISO_DATE_REGEX = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/;
export const SAFE_ATHLETE_ID_REGEX = /^(?:0|i?\d{1,12})$/;
export const GITHUB_PAGES_ORIGIN_REGEX = /^https:\/\/[a-z0-9-]+\.github\.io$/i;
export const CLOUD_RUN_ORIGIN_REGEX = /^https:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)?\.run\.app$/i;
export const LOCALHOST_ORIGIN_REGEX = /^http:\/\/(?:localhost|127\.0\.0\.1):3000$/;

// Liste d'emails propriétaires autorisés (alignée sur firestore.rules)
export const DEFAULT_ALLOWED_EMAILS = [
  'poketime.idle@gmail.com',
  'david.voisard2@gmail.com',
  'vdcoachsportif@gmail.com',
];

export function getAllowedEmails(extraEmailsCsv = '') {
  const extra = String(extraEmailsCsv || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return new Set([...DEFAULT_ALLOWED_EMAILS, ...extra]);
}

export function isAllowedCorsOrigin(origin, extraOriginsCsv = '') {
  if (!origin || typeof origin !== 'string') return false;
  if (
    GITHUB_PAGES_ORIGIN_REGEX.test(origin) ||
    CLOUD_RUN_ORIGIN_REGEX.test(origin) ||
    LOCALHOST_ORIGIN_REGEX.test(origin)
  ) {
    return true;
  }
  const customOrigins = String(extraOriginsCsv || '')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  return customOrigins.includes(origin);
}

export function isValidIsoCalendarDate(dateStr) {
  if (typeof dateStr !== 'string' || !SAFE_ISO_DATE_REGEX.test(dateStr)) return false;
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function validateSyncDateRange(oldest, newest, maxDays = 60) {
  if (!isValidIsoCalendarDate(oldest) || !isValidIsoCalendarDate(newest)) {
    return { ok: false, error: 'Format de date invalide (YYYY-MM-DD attendu).' };
  }
  const diffDays = Math.round(
    (Date.parse(`${newest}T00:00:00Z`) - Date.parse(`${oldest}T00:00:00Z`)) / 86400000
  );
  if (diffDays < 0 || diffDays > maxDays) {
    return {
      ok: false,
      error: `La plage de synchronisation doit être comprise entre 0 et ${maxDays} jours.`,
    };
  }
  return { ok: true, diffDays };
}

export function formatUtcDate(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function sanitizeAthleteId(rawAthleteId) {
  const trimmed = String(rawAthleteId || '0').trim();
  return SAFE_ATHLETE_ID_REGEX.test(trimmed) ? trimmed : '0';
}

export function sanitizeWellnessItem(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  if (typeof raw.id !== 'string' || !isValidIsoCalendarDate(raw.id)) return null;
  const numOrNull = (val) => (typeof val === 'number' && Number.isFinite(val) ? val : null);
  return {
    id: raw.id,
    hrv: numOrNull(raw.hrv),
    restingHR: numOrNull(raw.restingHR),
    readiness: numOrNull(raw.readiness),
    sleepScore: numOrNull(raw.sleepScore),
    sleepSecs: numOrNull(raw.sleepSecs),
    sleepQuality: numOrNull(raw.sleepQuality),
  };
}

export function sanitizeActivityItem(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  if (
    (typeof raw.id !== 'string' && typeof raw.id !== 'number') ||
    typeof raw.start_date_local !== 'string'
  ) {
    return null;
  }
  const datePart = raw.start_date_local.slice(0, 10);
  if (!isValidIsoCalendarDate(datePart)) return null;

  const numOrNull = (val) => (typeof val === 'number' && Number.isFinite(val) ? val : null);

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
