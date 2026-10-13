/**
 * Module de sécurité et d'assainissement des données pour PhysioTracker PRO.
 * Prévient :
 * 1. La pollution de prototype (__proto__, constructor, prototype).
 * 2. L'injection de clés arbitraires ou réservées dans le localStorage.
 * 3. L'altération des formats de dates et de filières à l'import JSON ou Firestore.
 */

// Format sécurisé pour les identifiants de filières/qualités : lettres, chiffres, underscores (1 à 32 caractères)
export const SAFE_ID_REGEX = /^[a-z][a-z0-9_]{0,31}$/i;

// Format sécurisé strict ISO YYYY-MM-DD
export const SAFE_DATE_REGEX = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/;

// Clés interdites pour bloquer formellement toute pollution de prototype
export const FORBIDDEN_PROPERTIES = new Set([
  '__proto__',
  'constructor',
  'prototype',
  'valueOf',
  'toString',
  'hasOwnProperty',
  'isPrototypeOf',
  'propertyIsEnumerable',
  'toLocaleString'
]);

/**
 * Vérifie si un identifiant est sain et sécurisé
 */
export function isSafeId(id: unknown): id is string {
  if (typeof id !== 'string') return false;
  const trimmed = id.trim();
  if (trimmed.length === 0 || trimmed.length > 32) return false;
  if (FORBIDDEN_PROPERTIES.has(trimmed.toLowerCase())) return false;
  return SAFE_ID_REGEX.test(trimmed);
}

/**
 * Vérifie si une chaîne représente une date valide YYYY-MM-DD
 */
export function isSafeDate(dateStr: unknown): dateStr is string {
  if (typeof dateStr !== 'string') return false;
  if (!SAFE_DATE_REGEX.test(dateStr)) return false;
  
  // Vérification de la validité calendaire réelle (ex: éliminer 2026-02-31)
  const [y, m, d] = dateStr.split('-').map(Number);
  const dateObj = new Date(Date.UTC(y, m - 1, d));
  return (
    dateObj.getUTCFullYear() === y &&
    dateObj.getUTCMonth() === m - 1 &&
    dateObj.getUTCDate() === d
  );
}

/**
 * Crée un dictionnaire sans prototype pour se prémunir de toute pollution d'héritage
 */
export function createSafeNullDict<T = any>(): Record<string, T> {
  return Object.create(null) as Record<string, T>;
}

/**
 * Valide et assainit une session d'entraînement brute
 */
export function sanitizeSessionData(rawSession: any): any | null {
  if (!rawSession || typeof rawSession !== 'object' || Array.isArray(rawSession)) {
    return null;
  }

  // Cloner de manière étanche sans prototype
  const safeSession: any = createSafeNullDict();

  if (typeof rawSession.duration === 'number' && Number.isFinite(rawSession.duration)) {
    safeSession.duration = Math.max(0, Math.min(1440, Math.round(rawSession.duration)));
  }

  if (typeof rawSession.load === 'number' && Number.isFinite(rawSession.load)) {
    safeSession.load = Math.max(0, Math.min(100000, Math.round(rawSession.load)));
  }

  if (typeof rawSession.rpeMusc === 'number' && Number.isFinite(rawSession.rpeMusc)) {
    safeSession.rpeMusc = Math.max(0, Math.min(10, rawSession.rpeMusc));
  }
  if (typeof rawSession.rpeMusculaire === 'number' && Number.isFinite(rawSession.rpeMusculaire)) {
    safeSession.rpeMusculaire = Math.max(0, Math.min(10, rawSession.rpeMusculaire));
  }
  if (typeof rawSession.rpeCardio === 'number' && Number.isFinite(rawSession.rpeCardio)) {
    safeSession.rpeCardio = Math.max(0, Math.min(10, rawSession.rpeCardio));
  }
  if (typeof rawSession.fatigue === 'number' && Number.isFinite(rawSession.fatigue)) {
    safeSession.fatigue = Math.max(0, Math.min(10, rawSession.fatigue));
  }

  if (typeof rawSession.loadCardio === 'number' && Number.isFinite(rawSession.loadCardio)) {
    safeSession.loadCardio = Math.max(0, Math.round(rawSession.loadCardio));
  }
  if (typeof rawSession.loadMusc === 'number' && Number.isFinite(rawSession.loadMusc)) {
    safeSession.loadMusc = Math.max(0, Math.round(rawSession.loadMusc));
  }

  if (typeof rawSession.sport === 'string' && isSafeId(rawSession.sport)) {
    safeSession.sport = rawSession.sport.slice(0, 32);
  }

  safeSession.isEccentric = Boolean(rawSession.isEccentric);
  safeSession.isSecondary = Boolean(rawSession.isSecondary);

  if (typeof rawSession.parentQId === 'string' && isSafeId(rawSession.parentQId)) {
    safeSession.parentQId = rawSession.parentQId;
  }

  if (typeof rawSession.originalLoad === 'number' && Number.isFinite(rawSession.originalLoad)) {
    safeSession.originalLoad = Math.max(0, Math.round(rawSession.originalLoad));
  }

  if (typeof rawSession.tonnageKg === 'number' && Number.isFinite(rawSession.tonnageKg)) {
    safeSession.tonnageKg = Math.max(0, Math.round(rawSession.tonnageKg));
  }

  if (typeof rawSession.notes === 'string') {
    safeSession.notes = rawSession.notes.slice(0, 1000);
  }

  if (typeof rawSession.source === 'string') {
    safeSession.source = rawSession.source.slice(0, 64);
  }

  if (typeof rawSession.completedAt === 'string') {
    safeSession.completedAt = rawSession.completedAt.slice(0, 64);
  }

  // Horodatage de modification / création pour arbitrage précis des conflits et corrections à la baisse
  if (typeof rawSession.updatedAt === 'number' && Number.isFinite(rawSession.updatedAt)) {
    safeSession.updatedAt = Math.round(rawSession.updatedAt);
  } else if (typeof rawSession.updatedAt === 'string') {
    const parsed = Date.parse(rawSession.updatedAt);
    if (Number.isFinite(parsed)) {
      safeSession.updatedAt = parsed;
    }
  }

  // Préservation des contributions parentes (pour les séances secondaires calculées)
  if (rawSession.parentContributions && typeof rawSession.parentContributions === 'object') {
    const safeContribs: Record<string, any> = createSafeNullDict();
    for (const [pKey, pVal] of Object.entries(rawSession.parentContributions)) {
      if (!isSafeId(pKey) || !pVal || typeof pVal !== 'object') continue;
      safeContribs[pKey] = {
        load: Math.max(0, Number((pVal as any).load) || 0),
        loadCardio: typeof (pVal as any).loadCardio === 'number' ? Math.max(0, Number((pVal as any).loadCardio)) : undefined,
        loadMusc: typeof (pVal as any).loadMusc === 'number' ? Math.max(0, Number((pVal as any).loadMusc)) : undefined,
        ratio: Math.max(0, Math.min(1, Number((pVal as any).ratio) || 0)),
        parentName: typeof (pVal as any).parentName === 'string' ? String((pVal as any).parentName).slice(0, 50) : undefined
      };
    }
    safeSession.parentContributions = Object.assign({}, safeContribs);
  }

  // Préservation détaillée des exercices de musculation (Mode Salle & Tracker)
  if (Array.isArray(rawSession.exercises)) {
    safeSession.exercises = rawSession.exercises
      .filter((ex: any) => ex && typeof ex === 'object' && typeof ex.name === 'string')
      .slice(0, 50)
      .map((ex: any) => {
        const item: any = {
          id: typeof ex.id === 'string' ? ex.id.slice(0, 64) : `ex_${Date.now()}`,
          name: String(ex.name).slice(0, 100),
          sets: Math.max(0, Math.min(100, Number(ex.sets) || 0)),
        };

        if (typeof ex.exerciseCatalogId === 'string') {
          item.exerciseCatalogId = ex.exerciseCatalogId.slice(0, 64);
        }

        // Poids en kg (correction critique : weightKg utilisé partout dans l'application)
        const rawWeight = ex.weightKg !== undefined ? ex.weightKg : ex.weight;
        if (typeof rawWeight === 'number' && Number.isFinite(rawWeight)) {
          item.weightKg = Math.max(0, Math.min(1000, Math.round(rawWeight * 10) / 10));
        }

        if (typeof ex.reps === 'number' && Number.isFinite(ex.reps)) {
          item.reps = Math.max(0, Math.min(1000, Math.round(ex.reps)));
        }

        if (typeof ex.rpe === 'number' && Number.isFinite(ex.rpe)) {
          item.rpe = Math.max(0, Math.min(10, ex.rpe));
        }

        if (typeof ex.rir === 'number' && Number.isFinite(ex.rir)) {
          item.rir = Math.max(0, Math.min(10, ex.rir));
        }

        // Préservation des séries détaillées saisies en Mode Salle
        if (Array.isArray(ex.detailSets)) {
          item.detailSets = ex.detailSets.slice(0, 50).map((s: any) => ({
            weightKg: typeof s.weightKg === 'number' ? Math.max(0, Math.min(1000, s.weightKg)) : undefined,
            reps: typeof s.reps === 'number' ? Math.max(0, Math.min(1000, s.reps)) : undefined,
            rir: typeof s.rir === 'number' ? Math.max(0, Math.min(10, s.rir)) : undefined,
            completed: Boolean(s.completed)
          }));
        }

        if (ex.customRatios && typeof ex.customRatios === 'object') {
          const ratios: Record<string, number> = {};
          for (const [mId, rVal] of Object.entries(ex.customRatios)) {
            if (isSafeId(mId) && typeof rVal === 'number') {
              ratios[mId] = Math.max(0, Math.min(1, rVal));
            }
          }
          item.customRatios = ratios;
        }

        return item;
      });
  }

  // Préservation des sous-séances multiples par filière et par jour
  if (Array.isArray(rawSession.subSessions)) {
    safeSession.subSessions = rawSession.subSessions
      .filter((sub: any) => sub && typeof sub === 'object')
      .slice(0, 10)
      .map((sub: any, idx: number) => {
        const item: any = {
          id: typeof sub.id === 'string' ? sub.id.slice(0, 64) : `sub_${idx}_${Date.now()}`,
          duration: Math.max(0, Math.min(1440, Math.round(Number(sub.duration) || 0))),
          load: Math.max(0, Math.min(100000, Math.round(Number(sub.load) || 0))),
        };
        if (typeof sub.name === 'string') item.name = sub.name.slice(0, 50);
        if (typeof sub.rpeMusc === 'number' && Number.isFinite(sub.rpeMusc)) item.rpeMusc = Math.max(0, Math.min(10, sub.rpeMusc));
        if (typeof sub.rpeCardio === 'number' && Number.isFinite(sub.rpeCardio)) item.rpeCardio = Math.max(0, Math.min(10, sub.rpeCardio));
        if (typeof sub.fatigue === 'number' && Number.isFinite(sub.fatigue)) item.fatigue = Math.max(0, Math.min(10, sub.fatigue));
        if (typeof sub.loadCardio === 'number' && Number.isFinite(sub.loadCardio)) item.loadCardio = Math.max(0, Math.round(sub.loadCardio));
        if (typeof sub.loadMusc === 'number' && Number.isFinite(sub.loadMusc)) item.loadMusc = Math.max(0, Math.round(sub.loadMusc));
        if (typeof sub.sport === 'string' && isSafeId(sub.sport)) item.sport = sub.sport.slice(0, 32);
        if (typeof sub.isEccentric === 'boolean') item.isEccentric = sub.isEccentric;
        if (typeof sub.notes === 'string') item.notes = sub.notes.slice(0, 500);
        return item;
      });
  }

  // Convertir en objet standard sécurisé pour compatibilité JSON / React
  return Object.assign({}, safeSession);
}

/**
 * Assainit un dictionnaire complet d'événements : Record<qId, Record<date, SessionData>>
 */
export function sanitizeEventsPayload(
  rawEvents: any
): Record<string, Record<string, any>> {
  const result: Record<string, Record<string, any>> = createSafeNullDict();

  if (!rawEvents || typeof rawEvents !== 'object' || Array.isArray(rawEvents)) {
    return Object.assign({}, result);
  }

  for (const qId of Object.keys(rawEvents)) {
    if (!isSafeId(qId)) continue;

    const datesObj = rawEvents[qId];
    if (!datesObj || typeof datesObj !== 'object' || Array.isArray(datesObj)) continue;

    const safeDates: Record<string, any> = createSafeNullDict();
    for (const dateStr of Object.keys(datesObj)) {
      if (!isSafeDate(dateStr)) continue;

      const rawSession = datesObj[dateStr];
      const cleaned = sanitizeSessionData(rawSession);
      // Les impacts secondaires sont calculés dynamiquement à la lecture par computeDerivedEvents
      // et ne doivent jamais être persistés ou synchronisés
      if (cleaned && !cleaned.isSecondary) {
        safeDates[dateStr] = cleaned;
      }
    }

    result[qId] = Object.assign({}, safeDates);
  }

  return Object.assign({}, result);
}

/**
 * Assainit les métriques journalières physiologiques (VFC, FC repos, Readiness)
 */
export function sanitizeDailyMetricsPayload(
  rawMetrics: any
): Record<string, Record<string, number>> {
  const result: Record<string, Record<string, number>> = createSafeNullDict();

  if (!rawMetrics || typeof rawMetrics !== 'object' || Array.isArray(rawMetrics)) {
    return Object.assign({}, result);
  }

  const ALLOWED_METRIC_KEYS = new Set(['readiness', 'vfc', 'hrRest']);

  for (const dateStr of Object.keys(rawMetrics)) {
    if (!isSafeDate(dateStr)) continue;

    const metrics = rawMetrics[dateStr];
    if (!metrics || typeof metrics !== 'object' || Array.isArray(metrics)) continue;

    const safeDayMetrics: Record<string, number> = createSafeNullDict();
    for (const metricKey of Object.keys(metrics)) {
      if (!ALLOWED_METRIC_KEYS.has(metricKey)) continue;

      const val = Number(metrics[metricKey]);
      if (Number.isFinite(val) && val >= 0 && val <= 1000) {
        safeDayMetrics[metricKey] = Math.round(val);
      }
    }

    result[dateStr] = Object.assign({}, safeDayMetrics);
  }

  return Object.assign({}, result);
}

/**
 * Assainit un dictionnaire de tombstones (enregistrements de suppression de séances)
 * Format : Record<`${dateStr}_${qId}`, timestampNumber>
 */
export function sanitizeTombstonesPayload(raw: any): Record<string, number> {
  const result: Record<string, number> = createSafeNullDict();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return Object.assign({}, result);
  }

  const now = Date.now();
  const MAX_TOMBSTONE_AGE_MS = 90 * 24 * 60 * 60 * 1000; // 90 jours max de rétention

  for (const [key, val] of Object.entries(raw)) {
    const match = key.match(/^(\d{4}-\d{2}-\d{2})_(.+)$/);
    if (!match) continue;
    const [, dateStr, qId] = match;
    if (!isSafeDate(dateStr) || !isSafeId(qId)) continue;

    const numVal = Number(val);
    // Timestamp raisonnable (> 2020 et <= maintenant + 1 jour de décalage d'horloge)
    if (Number.isFinite(numVal) && numVal > 1577836800000 && numVal <= now + 86400000) {
      if (now - numVal < MAX_TOMBSTONE_AGE_MS) {
        result[key] = Math.round(numVal);
      }
    }
  }

  return Object.assign({}, result);
}

/**
 * Récupère les tombstones enregistrées dans le localStorage
 */
export function getSavedTombstones(): Record<string, number> {
  try {
    const raw = localStorage.getItem('physio_tombstones');
    return raw ? sanitizeTombstonesPayload(JSON.parse(raw)) : {};
  } catch {
    return {};
  }
}

/**
 * Enregistre une tombstone de suppression pour une séance donnée
 */
export function saveTombstone(eventKey: string, timestamp: number = Date.now()): Record<string, number> {
  try {
    const current = getSavedTombstones();
    current[eventKey] = timestamp;
    const clean = sanitizeTombstonesPayload(current);
    localStorage.setItem('physio_tombstones', JSON.stringify(clean));
    return clean;
  } catch {
    return {};
  }
}

/**
 * Retire une tombstone lorsqu'une séance est recréée sur cette date
 */
export function removeTombstone(eventKey: string): Record<string, number> {
  try {
    const current = getSavedTombstones();
    if (current[eventKey]) {
      delete current[eventKey];
      localStorage.setItem('physio_tombstones', JSON.stringify(current));
    }
    return current;
  } catch {
    return {};
  }
}

/**
 * Fusion non destructrice granulaire des événements (séances d'entraînement) date par date.
 * Résout :
 * 1. La non-propagation des suppressions : grâce aux tombstones, une séance supprimée sur A
 *    ne ressuscite pas lorsqu'elle arrive de B.
 * 2. La correction de charge à la baisse : grâce au timestamp updatedAt, si la séance locale
 *    a été corrigée plus récemment (ex: de 600 à 60 pts), la version la plus récente gagne
 *    systématiquement au lieu de conserver la charge maximale arbitraire.
 * 3. La préservation hors-ligne : une séance créée hors-ligne (sans tombstone correspondante)
 *    est conservée et synchronisée vers le cloud.
 */
export function mergeEventsNonDestructive(
  localEvents: Record<string, Record<string, any>>,
  remoteEvents: Record<string, Record<string, any>>,
  localTombstones?: Record<string, number>,
  remoteTombstones?: Record<string, number>
): { 
  merged: Record<string, Record<string, any>>; 
  hasNewLocalData: boolean;
  mergedTombstones: Record<string, number>;
  deletedKeysToPurge: string[];
} {
  const merged: Record<string, Record<string, any>> = createSafeNullDict();
  let hasNewLocalData = false;
  const deletedKeysToPurge: string[] = [];

  const safeLocalTombstones = sanitizeTombstonesPayload(localTombstones);
  const safeRemoteTombstones = sanitizeTombstonesPayload(remoteTombstones);

  // 1. Fusionner les tombstones (la suppression la plus récente l'emporte)
  const mergedTombstones: Record<string, number> = createSafeNullDict();
  const allTombstoneKeys = new Set([
    ...Object.keys(safeLocalTombstones),
    ...Object.keys(safeRemoteTombstones)
  ]);

  for (const k of allTombstoneKeys) {
    const tLocal = safeLocalTombstones[k] || 0;
    const tRemote = safeRemoteTombstones[k] || 0;
    mergedTombstones[k] = Math.max(tLocal, tRemote);
    if (tLocal > tRemote) {
      hasNewLocalData = true; // Le local a une tombstone plus récente à propager
    }
  }

  // 2. Initialiser l'ensemble de toutes les filières
  const allQIds = new Set([
    ...Object.keys(localEvents || {}),
    ...Object.keys(remoteEvents || {})
  ]);

  for (const qId of allQIds) {
    if (!isSafeId(qId)) continue;

    const localDates = (localEvents && localEvents[qId]) || {};
    const remoteDates = (remoteEvents && remoteEvents[qId]) || {};
    const mergedDates: Record<string, any> = createSafeNullDict();

    const allDates = new Set([
      ...Object.keys(localDates),
      ...Object.keys(remoteDates)
    ]);

    for (const dateStr of allDates) {
      if (!isSafeDate(dateStr)) continue;

      const eventKey = `${dateStr}_${qId}`;
      const tombstoneTime = mergedTombstones[eventKey] || 0;

      const localSession = localDates[dateStr];
      const remoteSession = remoteDates[dateStr];

      const localUpdated = Number(localSession?.updatedAt) || 0;
      const remoteUpdated = Number(remoteSession?.updatedAt) || 0;

      if (localSession && remoteSession) {
        // Conflit : séance présente en local ET à distance
        if (tombstoneTime > Math.max(localUpdated, remoteUpdated)) {
          // La suppression est plus récente que les deux versions : la séance est effacée
          deletedKeysToPurge.push(eventKey);
          continue;
        }

        // Arbitrage par timestamp updatedAt : la modification la plus récente gagne
        if (localUpdated > remoteUpdated) {
          mergedDates[dateStr] = localSession;
          hasNewLocalData = true;
        } else if (remoteUpdated > localUpdated) {
          mergedDates[dateStr] = remoteSession;
        } else {
          // Égalité parfaite de timestamp (ou 0 tous les deux) : départager sur le niveau de détail
          const localExercisesCount = Array.isArray(localSession.exercises) ? localSession.exercises.length : 0;
          const remoteExercisesCount = Array.isArray(remoteSession.exercises) ? remoteSession.exercises.length : 0;

          if (localExercisesCount > remoteExercisesCount) {
            mergedDates[dateStr] = localSession;
            hasNewLocalData = true;
          } else if (remoteExercisesCount > localExercisesCount) {
            mergedDates[dateStr] = remoteSession;
          } else {
            // Même nombre d'exercices : conserver remote par stabilité
            mergedDates[dateStr] = remoteSession;
          }
        }
      } else if (localSession && !remoteSession) {
        // Séance uniquement en local
        if (tombstoneTime >= localUpdated) {
          // Supprimée à distance : ne pas conserver, purger le stockage local
          deletedKeysToPurge.push(eventKey);
        } else {
          // Séance locale créée hors-ligne : préserver et propager au cloud
          mergedDates[dateStr] = localSession;
          hasNewLocalData = true;
        }
      } else if (!localSession && remoteSession) {
        // Séance uniquement distante
        if (tombstoneTime >= remoteUpdated) {
          // Supprimée localement : ne pas ressusciter, informer le cloud via tombstone
          hasNewLocalData = true;
        } else {
          // Nouvelle séance distante : intégrer
          mergedDates[dateStr] = remoteSession;
        }
      }
    }

    merged[qId] = Object.assign({}, mergedDates);
  }

  return {
    merged: Object.assign({}, merged),
    hasNewLocalData,
    mergedTombstones: Object.assign({}, mergedTombstones),
    deletedKeysToPurge
  };
}

/**
 * Fusion non destructrice des métriques journalières physiologiques (VFC, FC repos, Readiness)
 */
export function mergeDailyMetricsNonDestructive(
  localMetrics: Record<string, Record<string, number>>,
  remoteMetrics: Record<string, Record<string, number>>
): { merged: Record<string, Record<string, number>>; hasNewLocalData: boolean } {
  const merged: Record<string, Record<string, number>> = createSafeNullDict();
  let hasNewLocalData = false;

  const allDates = new Set([
    ...Object.keys(localMetrics || {}),
    ...Object.keys(remoteMetrics || {})
  ]);

  for (const dateStr of allDates) {
    if (!isSafeDate(dateStr)) continue;

    const localDay = (localMetrics && localMetrics[dateStr]) || {};
    const remoteDay = (remoteMetrics && remoteMetrics[dateStr]) || {};

    const mergedDay: Record<string, number> = createSafeNullDict();
    const allMetricKeys = new Set([...Object.keys(localDay), ...Object.keys(remoteDay)]);

    for (const key of allMetricKeys) {
      if (!['readiness', 'vfc', 'hrRest'].includes(key)) continue;

      const localVal = localDay[key];
      const remoteVal = remoteDay[key];

      if (remoteVal !== undefined && remoteVal !== null) {
        mergedDay[key] = remoteVal;
      } else if (localVal !== undefined && localVal !== null) {
        mergedDay[key] = localVal;
        hasNewLocalData = true;
      }
    }

    merged[dateStr] = Object.assign({}, mergedDay);
  }

  return {
    merged: Object.assign({}, merged),
    hasNewLocalData
  };
}

export interface StagedImportResult {
  isValid: boolean;
  error?: string;
  entriesToSet: Map<string, string>;
  summary: {
    sessionsCount: number;
    metricsCount: number;
    blocksCount: number;
  };
}

/**
 * Valide et prépare en mémoire l'intégralité d'un export JSON (transactions atomiques).
 * Ne modifie aucunement le localStorage ni l'état de l'application.
 */
export function validateAndStageImportPayload(imported: any): StagedImportResult {
  if (!imported || typeof imported !== 'object' || Array.isArray(imported)) {
    return {
      isValid: false,
      error: 'Structure du fichier JSON invalide ou corrompue.',
      entriesToSet: new Map(),
      summary: { sessionsCount: 0, metricsCount: 0, blocksCount: 0 },
    };
  }

  const entriesToSet = new Map<string, string>();
  let sessionsCount = 0;
  let metricsCount = 0;
  let blocksCount = 0;

  try {
    // 1. Validation & assainissement des séances (events)
    if (imported.events && typeof imported.events === 'object') {
      const cleanEvents = sanitizeEventsPayload(imported.events);
      for (const [qId, dates] of Object.entries(cleanEvents)) {
        if (!isSafeId(qId)) continue;
        for (const [dateStr, sessionData] of Object.entries(dates)) {
          if (!isSafeDate(dateStr)) continue;
          entriesToSet.set(`${dateStr}_${qId}`, JSON.stringify(sessionData));
          sessionsCount++;
        }
      }
    }

    // 2. Validation & assainissement des métriques journalières (dailyMetrics)
    if (imported.dailyMetrics && typeof imported.dailyMetrics === 'object') {
      const cleanMetrics = sanitizeDailyMetricsPayload(imported.dailyMetrics);
      for (const [dateStr, metrics] of Object.entries(cleanMetrics)) {
        if (!isSafeDate(dateStr)) continue;
        for (const [metricKey, metricVal] of Object.entries(metrics)) {
          if (!['readiness', 'vfc', 'hrRest'].includes(metricKey)) continue;
          entriesToSet.set(`${dateStr}_${metricKey}`, String(metricVal));
          metricsCount++;
        }
      }
    }

    // 3. Validation des blocs d'entraînement
    if (Array.isArray(imported.trainingBlocks)) {
      const safeBlocks = imported.trainingBlocks
        .filter((b: any) => b && typeof b === 'object' && typeof b.id === 'string' && isSafeId(b.id))
        .slice(0, 50)
        .map((b: any) => ({
          id: b.id,
          name: String(b.name || 'Bloc').slice(0, 50),
          type: String(b.type || 'standard').slice(0, 30),
          startDate: isSafeDate(b.startDate) ? b.startDate : new Date().toISOString().split('T')[0],
          endDate: isSafeDate(b.endDate) ? b.endDate : new Date().toISOString().split('T')[0],
          durationWeeks: Math.max(1, Math.min(52, Number(b.durationWeeks) || 4)),
          focusQualities: Array.isArray(b.focusQualities) 
            ? b.focusQualities.filter((q: any) => typeof q === 'string' && isSafeId(q)).slice(0, 10)
            : [],
          // Multiplicateurs conformes au modèle d'Issurin (0.45 cible / 1.0 maintien par défaut)
          targetMultiplier: Math.max(0.1, Math.min(3, Number(b.targetMultiplier) || 0.45)),
          maintenanceMultiplier: Math.max(0.1, Math.min(3, Number(b.maintenanceMultiplier) || 1.0)),
          color: typeof b.color === 'string' ? b.color.slice(0, 30) : undefined,
          notes: typeof b.notes === 'string' ? b.notes.slice(0, 500) : undefined,
        }));
      entriesToSet.set('physio_training_blocks', JSON.stringify(safeBlocks));
      blocksCount = safeBlocks.length;
    }

    // 4. Validation des qualités
    if (Array.isArray(imported.qualities)) {
      const safeQualities = imported.qualities
        .filter((q: any) => q && typeof q === 'object' && typeof q.id === 'string' && isSafeId(q.id))
        .slice(0, 50)
        .map((q: any) => ({
          id: q.id,
          name: String(q.name || q.id).slice(0, 50),
          g: Math.max(0.1, Math.min(20, Number(q.g) || 1)),
          o: Math.max(0.1, Math.min(20, Number(q.o) || 1)),
          retentionDays: typeof q.retentionDays === 'number' ? Math.max(1, Math.min(365, q.retentionDays)) : undefined,
          category: typeof q.category === 'string' ? q.category.slice(0, 30) : undefined,
          impacts: Array.isArray(q.impacts)
            ? q.impacts
                .filter((imp: any) => imp && typeof imp === 'object' && typeof imp.id === 'string' && isSafeId(imp.id))
                .slice(0, 10)
                .map((imp: any) => ({
                  id: imp.id,
                  ratio: Math.max(0, Math.min(1, Number(imp.ratio) || 0)),
                }))
            : undefined,
        }));
      if (safeQualities.length > 0) {
        entriesToSet.set('physio_qualities', JSON.stringify(safeQualities));
      }
    }

    // 5. Validation des modèles de blocs (blockTemplates)
    if (Array.isArray(imported.blockTemplates)) {
      const safeTemplates = imported.blockTemplates
        .filter((t: any) => t && typeof t === 'object' && typeof t.id === 'string' && isSafeId(t.id))
        .slice(0, 50)
        .map((t: any) => ({
          id: t.id,
          name: String(t.name || t.id).slice(0, 50),
          durationWeeks: Math.max(1, Math.min(52, Number(t.durationWeeks) || 4)),
          focusQualities: Array.isArray(t.focusQualities)
            ? t.focusQualities.filter((q: any) => typeof q === 'string' && isSafeId(q)).slice(0, 10)
            : [],
          description: String(t.description || '').slice(0, 200),
          targetMultiplier: Math.max(0.1, Math.min(3, Number(t.targetMultiplier) || 0.45)),
          maintenanceMultiplier: Math.max(0.1, Math.min(3, Number(t.maintenanceMultiplier) || 1.0)),
          color: typeof t.color === 'string' ? t.color.slice(0, 30) : undefined,
          badge: typeof t.badge === 'string' ? t.badge.slice(0, 30) : undefined,
        }));
      entriesToSet.set('physio_block_templates', JSON.stringify(safeTemplates));
    }

    // 6. Validation de l'objectif de compétition (targetCompetition)
    if (imported.targetCompetition && typeof imported.targetCompetition === 'object') {
      const comp = imported.targetCompetition;
      if (typeof comp.name === 'string' && isSafeDate(comp.date)) {
        const safeComp = {
          name: comp.name.slice(0, 100),
          date: comp.date,
          type: typeof comp.type === 'string' ? comp.type.slice(0, 30) : 'autre',
          targetTsb: Math.max(-50, Math.min(100, Number(comp.targetTsb) || 15)),
          targetTsbUnit: typeof comp.targetTsbUnit === 'string' ? comp.targetTsbUnit.slice(0, 20) : 'points',
          targetTime: typeof comp.targetTime === 'string' ? comp.targetTime.slice(0, 20) : undefined,
          notes: typeof comp.notes === 'string' ? comp.notes.slice(0, 500) : undefined,
        };
        entriesToSet.set('physio_target_competition', JSON.stringify(safeComp));
      }
    }

    // 7. Validation des réglages physiologiques (physioSettings) avec initialCtl
    if (imported.physioSettings && typeof imported.physioSettings === 'object') {
      const ps = imported.physioSettings;
      const safePs: Record<string, any> = {
        tauFatigue: Math.max(3, Math.min(20, Number(ps.tauFatigue) || 7)),
        tauFitness: Math.max(15, Math.min(60, Number(ps.tauFitness) || 28)),
        profileName: typeof ps.profileName === 'string' ? ps.profileName.slice(0, 50) : 'Standard',
      };
      if (typeof ps.initialCtl === 'number' && Number.isFinite(ps.initialCtl)) {
        safePs.initialCtl = Math.max(0, Math.min(300, Math.round(ps.initialCtl)));
      }
      entriesToSet.set('physio_settings', JSON.stringify(safePs));
    }

    // 8. Validation des exercices personnalisés (customExercises) au format réel { id, name, category, muscleRatios, isCompound }
    if (Array.isArray(imported.customExercises)) {
      const safeEx = imported.customExercises
        .filter((ex: any) => ex && typeof ex === 'object' && typeof ex.name === 'string')
        .slice(0, 200)
        .map((ex: any) => {
          const item: any = {
            id: typeof ex.id === 'string' ? ex.id.slice(0, 64) : `custom_ex_${Date.now()}`,
            name: String(ex.name).slice(0, 100),
            category: typeof ex.category === 'string' ? ex.category.slice(0, 30) : 'upper_push',
            isCompound: Boolean(ex.isCompound),
            defaultReps: Math.max(1, Math.min(100, Number(ex.defaultReps) || 10)),
            isCustom: true,
          };

          if (ex.muscleRatios && typeof ex.muscleRatios === 'object') {
            const ratios: Record<string, number> = {};
            for (const [mKey, mRatio] of Object.entries(ex.muscleRatios)) {
              if (isSafeId(mKey) && typeof mRatio === 'number') {
                ratios[mKey] = Math.max(0, Math.min(1, mRatio));
              }
            }
            item.muscleRatios = ratios;
          } else {
            item.muscleRatios = { pectoraux: 1.0 };
          }

          return item;
        });
      entriesToSet.set('physio_custom_exercises', JSON.stringify(safeEx));
    }

    // 9. Validation des tombstones (suppressions de séances synchronisées)
    if (imported.tombstones && typeof imported.tombstones === 'object') {
      const safeTombstones = sanitizeTombstonesPayload(imported.tombstones);
      if (Object.keys(safeTombstones).length > 0) {
        entriesToSet.set('physio_tombstones', JSON.stringify(safeTombstones));
      }
    }

    // 10. Vérification de cohérence : au moins une donnée utile
    if (entriesToSet.size === 0) {
      return {
        isValid: false,
        error: 'Aucune donnée valide (séances, métriques ou configuration) identifiée dans le fichier.',
        entriesToSet: new Map(),
        summary: { sessionsCount: 0, metricsCount: 0, blocksCount: 0 },
      };
    }

    // Enregistrer le schéma de version
    entriesToSet.set('physio_schema_version', '2');

    return {
      isValid: true,
      entriesToSet,
      summary: {
        sessionsCount,
        metricsCount,
        blocksCount,
      },
    };
  } catch (err: any) {
    return {
      isValid: false,
      error: `Erreur d'analyse des données : ${err?.message || 'Format inattendu'}`,
      entriesToSet: new Map(),
      summary: { sessionsCount: 0, metricsCount: 0, blocksCount: 0 },
    };
  }
}


