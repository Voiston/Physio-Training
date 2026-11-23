/**
 * Moteur pur de normalisation et de pré-classification physiologique
 * des données Garmin importées via Intervals.icu.
 */
import type { Quality, SessionData, SubSession } from '../types';
import { computeDetailedSessionLoad, isPrimary } from './loadHelpers';
import { isCardioQuality, isForceQuality } from './qualities';
import { isSafeDate } from './security';

export interface IntervalsWellnessEntry {
  id: string;
  hrv?: number | null;
  restingHR?: number | null;
  readiness?: number | null;
  sleepScore?: number | null;
  sleepSecs?: number | null;
  sleepQuality?: number | null;
}

export interface IntervalsActivityEntry {
  id: string;
  name?: string | null;
  type?: string | null;
  start_date_local: string;
  moving_time?: number | null;
  elapsed_time?: number | null;
  distance?: number | null;
  total_elevation_gain?: number | null;
  average_heartrate?: number | null;
  max_heartrate?: number | null;
  icu_rpe?: number | null;
  feel?: number | null;
  icu_training_load?: number | null;
  icu_intensity?: number | null;
  icu_hr_zone_times?: number[] | null;
  source?: string | null;
  trainer?: boolean | null;
}

export interface NormalizedDailyWellness {
  dateStr: string;
  vfc?: number;
  hrRest?: number;
  readiness?: number;
  readinessSource?: 'readiness' | 'sleepScore' | 'sleepQuality';
}

export interface PendingGarminActivity {
  externalId: string;
  dateStr: string;
  startTime: string;
  title: string;
  rawType: string;
  sport: 'run' | 'bike' | 'muscu';
  duration: number;
  distanceKm?: number;
  elevationGainM?: number;
  avgHr?: number;
  maxHr?: number;
  icuTrainingLoad?: number;
  icuIntensity?: number;
  suggestedQualityId: string;
  suggestedRpeCardio: number;
  suggestedRpeMusc: number;
  classificationReason: string;
  source?: string;
}

/**
 * Normalise une chaîne pour la détection insensible à la casse et aux accents.
 */
function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Convertit les champs Readiness / Sommeil d'Intervals.icu vers l'échelle 1–10 de PhysioTracker PRO.
 * - Garmin Training Readiness (0–100) ou Sleep Score (0–100) -> divisé par 10, borné [1, 10]
 * - Readiness déjà sur 1–10 -> conservé tel quel
 * - sleepQuality Intervals.icu (1=Excellent, 2=Bon, 3=Moyen, 4=Faible) -> 9 / 7 / 5 / 3
 */
export function normalizeReadinessScore(entry: IntervalsWellnessEntry): {
  value?: number;
  source?: 'readiness' | 'sleepScore' | 'sleepQuality';
} {
  if (typeof entry.readiness === 'number' && Number.isFinite(entry.readiness) && entry.readiness > 0) {
    const scaled = entry.readiness > 10 ? Math.round(entry.readiness / 10) : Math.round(entry.readiness);
    return {
      value: Math.max(1, Math.min(10, scaled)),
      source: 'readiness',
    };
  }

  if (typeof entry.sleepScore === 'number' && Number.isFinite(entry.sleepScore) && entry.sleepScore > 0) {
    const scaled = entry.sleepScore > 10 ? Math.round(entry.sleepScore / 10) : Math.round(entry.sleepScore);
    return {
      value: Math.max(1, Math.min(10, scaled)),
      source: 'sleepScore',
    };
  }

  if (typeof entry.sleepQuality === 'number' && Number.isFinite(entry.sleepQuality)) {
    const qualityMap: Record<number, number> = { 1: 9, 2: 7, 3: 5, 4: 3 };
    const mapped = qualityMap[Math.round(entry.sleepQuality)];
    if (mapped !== undefined) {
      return {
        value: mapped,
        source: 'sleepQuality',
      };
    }
  }

  return {};
}

/**
 * Normalise et valide un lot de métriques quotidiennes Intervals.icu (VFC, FC repos, Readiness).
 */
export function normalizeIntervalsWellness(entries: IntervalsWellnessEntry[]): NormalizedDailyWellness[] {
  if (!Array.isArray(entries)) return [];

  const result: NormalizedDailyWellness[] = [];

  for (const entry of entries) {
    if (!entry || typeof entry !== 'object' || !isSafeDate(entry.id)) continue;

    const normalized: NormalizedDailyWellness = { dateStr: entry.id };

    if (typeof entry.hrv === 'number' && Number.isFinite(entry.hrv)) {
      const vfc = Math.round(entry.hrv);
      if (vfc >= 10 && vfc <= 300) {
        normalized.vfc = vfc;
      }
    }

    if (typeof entry.restingHR === 'number' && Number.isFinite(entry.restingHR)) {
      const hrRest = Math.round(entry.restingHR);
      if (hrRest >= 30 && hrRest <= 150) {
        normalized.hrRest = hrRest;
      }
    }

    const readiness = normalizeReadinessScore(entry);
    if (readiness.value !== undefined) {
      normalized.readiness = readiness.value;
      normalized.readinessSource = readiness.source;
    }

    if (
      normalized.vfc !== undefined ||
      normalized.hrRest !== undefined ||
      normalized.readiness !== undefined
    ) {
      result.push(normalized);
    }
  }

  return result;
}

/**
 * Mappe le type d'activité Intervals.icu / Garmin vers les 3 familles sportives PhysioTracker PRO.
 */
export function mapIntervalsSport(type?: string | null): 'run' | 'bike' | 'muscu' {
  const t = (type || '').toLowerCase();

  if (
    t.includes('ride') ||
    t.includes('cycling') ||
    t.includes('bike') ||
    t.includes('velomobile') ||
    t.includes('handcycle')
  ) {
    return 'bike';
  }

  if (
    t.includes('weight') ||
    t.includes('strength') ||
    t.includes('crossfit') ||
    t.includes('workout') ||
    t.includes('yoga') ||
    t.includes('pilates') ||
    t.includes('climbing') ||
    t.includes('hiit')
  ) {
    return 'muscu';
  }

  return 'run';
}

/**
 * Calcule la répartition des zones cardiaques à partir de `icu_hr_zone_times` (secondes par zone).
 * Retourne la part de temps passée en Z3-Z4 (seuil/tempo) et en Z5+ (VO2max/anaérobie).
 */
function analyzeHrZones(zoneTimes?: number[] | null): {
  totalSecs: number;
  z1z2Ratio: number;
  z3z4Ratio: number;
  z5PlusRatio: number;
} | null {
  if (!Array.isArray(zoneTimes) || zoneTimes.length < 4) return null;
  const clean = zoneTimes.map((v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0));
  const totalSecs = clean.reduce((acc, v) => acc + v, 0);
  if (totalSecs < 120) return null;

  const z1z2 = (clean[0] || 0) + (clean[1] || 0);
  const z3z4 = (clean[2] || 0) + (clean[3] || 0);
  const z5Plus = clean.slice(4).reduce((acc, v) => acc + v, 0);

  return {
    totalSecs,
    z1z2Ratio: z1z2 / totalSecs,
    z3z4Ratio: z3z4 / totalSecs,
    z5PlusRatio: z5Plus / totalSecs,
  };
}

/**
 * Normalise `icu_intensity` en ratio décimal (ex: 78 -> 0.78, 0.78 -> 0.78).
 */
function normalizeIntensityRatio(raw?: number | null): number | null {
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) return null;
  return raw > 2.5 ? raw / 100 : raw;
}

interface KeywordRule {
  qualityId: string;
  keywords: string[];
  label: string;
}

const KEYWORD_RULES: KeywordRule[] = [
  { qualityId: 'vo2max', keywords: ['vo2', 'vma', 'pma', '30/30', '30-30', '400m', '200m', 'fractionne court'], label: 'Mot-clé VO2/VMA' },
  { qualityId: 'seuil', keywords: ['seuil', 'tempo', 'threshold', 'allure', 'lactate', 'sweet spot', 'sst', 'ftp', '10k', 'semi'], label: 'Mot-clé Seuil/Tempo' },
  { qualityId: 'sprint', keywords: ['sprint', 'vitesse', 'alactique', 'lignes droites', 'cotes courtes'], label: 'Mot-clé Sprint/Vitesse' },
  { qualityId: 'descente', keywords: ['descente', 'downhill'], label: 'Mot-clé Descente' },
  { qualityId: 'plyo', keywords: ['plyo', 'plio', 'bondissement', 'saut'], label: 'Mot-clé Pliométrie' },
  { qualityId: 'leg', keywords: ['jambes', 'jambe', 'squat', 'lower', 'bas du corps', 'leg'], label: 'Mot-clé Bas du corps' },
  { qualityId: 'push', keywords: ['push', 'pec', 'pectoraux', 'developpe', 'pompes', 'epaules'], label: 'Mot-clé Push' },
  { qualityId: 'pull', keywords: ['pull', 'dos', 'traction', 'tirage', 'rowing'], label: 'Mot-clé Pull' },
  { qualityId: 'abdos', keywords: ['abdo', 'gainage', 'core', 'pilates'], label: 'Mot-clé Gainage/Abdos' },
  { qualityId: 'proprio', keywords: ['proprio', 'mobilite', 'yoga', 'equilibre', 'etirement', 'stretching'], label: 'Mot-clé Mobilité/Proprio' },
  { qualityId: 'isolation', keywords: ['isolation', 'biceps', 'triceps', 'mollet', 'bras'], label: 'Mot-clé Isolation' },
  { qualityId: 'ef', keywords: ['ef', 'endurance', 'footing', 'recup', 'recuperation', 'easy', 'z2', 'sortie longue', 'balade'], label: 'Mot-clé Endurance' },
];

function resolveAvailableQuality(
  preferredId: string,
  availableQualities: Quality[],
  fallbackCategory: 'cardio' | 'force'
): string {
  if (availableQualities.some((q) => q.id === preferredId)) {
    return preferredId;
  }
  const sameCategory = availableQualities.find((q) =>
    fallbackCategory === 'cardio' ? isCardioQuality(q.id, availableQualities) : isForceQuality(q.id, availableQualities)
  );
  return sameCategory?.id || availableQualities[0]?.id || preferredId;
}

/**
 * Estime un RPE cohérent (1–10) à partir des données Garmin/Intervals.icu.
 */
function estimateRpePair(
  activity: IntervalsActivityEntry,
  sport: 'run' | 'bike' | 'muscu',
  qualityId: string,
  durationMin: number,
  ifRatio: number | null,
  hrZones: ReturnType<typeof analyzeHrZones>
): { rpeCardio: number; rpeMusc: number } {
  let baseRpe: number;

  if (typeof activity.icu_rpe === 'number' && Number.isFinite(activity.icu_rpe) && activity.icu_rpe >= 1) {
    baseRpe = Math.max(1, Math.min(10, Math.round(activity.icu_rpe)));
  } else if (ifRatio !== null) {
    if (ifRatio >= 0.96) baseRpe = 9;
    else if (ifRatio >= 0.90) baseRpe = 8;
    else if (ifRatio >= 0.83) baseRpe = 7;
    else if (ifRatio >= 0.75) baseRpe = 5;
    else if (ifRatio >= 0.65) baseRpe = 4;
    else baseRpe = 3;
  } else if (hrZones) {
    if (hrZones.z5PlusRatio >= 0.18) baseRpe = 8;
    else if (hrZones.z3z4Ratio >= 0.40) baseRpe = 7;
    else if (hrZones.z3z4Ratio >= 0.20) baseRpe = 5;
    else baseRpe = 4;
  } else {
    const qualityDefaults: Record<string, number> = {
      vo2max: 8,
      seuil: 7,
      sprint: 7,
      descente: 7,
      ef: 4,
      leg: 7,
      push: 7,
      pull: 7,
      plyo: 7,
      abdos: 5,
      proprio: 4,
      isolation: 6,
    };
    baseRpe = qualityDefaults[qualityId] ?? 5;
  }

  // Ajustement léger pour les sorties longues (> 90 min)
  if (durationMin >= 90 && baseRpe <= 6) {
    baseRpe = Math.min(8, baseRpe + 1);
  }

  if (sport === 'muscu') {
    const rpeMusc = Math.max(1, Math.min(10, baseRpe));
    const rpeCardio = Math.max(2, Math.min(10, baseRpe - 2));
    return { rpeCardio, rpeMusc };
  }

  if (sport === 'bike') {
    const rpeCardio = Math.max(1, Math.min(10, baseRpe));
    const rpeMusc = Math.max(1, Math.min(10, baseRpe - 1));
    return { rpeCardio, rpeMusc };
  }

  // Course / Trail : impact excentrique musculaire plus marqué si dénivelé élevé ou longue durée
  const elevation = Number(activity.total_elevation_gain) || 0;
  const muscBonus = qualityId === 'descente' || elevation >= 400 || durationMin >= 75 ? 1 : 0;
  return {
    rpeCardio: Math.max(1, Math.min(10, baseRpe)),
    rpeMusc: Math.max(1, Math.min(10, baseRpe + muscBonus)),
  };
}

/**
 * Classifie une activité Intervals.icu en proposition prête pour validation en 1 clic.
 */
export function classifyIntervalsActivity(
  activity: IntervalsActivityEntry,
  availableQualities: Quality[],
  activeBlockFocus: string[] = []
): PendingGarminActivity | null {
  if (!activity || !activity.id || !activity.start_date_local) return null;

  const dateStr = activity.start_date_local.slice(0, 10);
  if (!isSafeDate(dateStr)) return null;

  const startTime = activity.start_date_local.length >= 16 ? activity.start_date_local.slice(11, 16) : '';
  const rawSeconds =
    typeof activity.moving_time === 'number' && activity.moving_time > 0
      ? activity.moving_time
      : typeof activity.elapsed_time === 'number' && activity.elapsed_time > 0
      ? activity.elapsed_time
      : 0;

  // Ignorer les micro-enregistrements accidentels (< 2 minutes)
  if (rawSeconds < 120) return null;

  const duration = Math.max(1, Math.min(1440, Math.round(rawSeconds / 60)));
  const rawType = (activity.type || 'Workout').trim();
  const sport = mapIntervalsSport(rawType);
  const title = (activity.name || rawType || 'Séance Garmin').trim().slice(0, 80);
  const normalizedTitle = normalizeText(title);

  const ifRatio = normalizeIntensityRatio(activity.icu_intensity);
  const hrZones = analyzeHrZones(activity.icu_hr_zone_times);

  let preferredQuality = sport === 'muscu' ? 'leg' : 'ef';
  let classificationReason = sport === 'muscu' ? 'Renforcement Garmin' : 'Endurance par défaut';

  // 1. Priorité aux mots-clés explicites dans le titre Garmin
  const matchedRule = KEYWORD_RULES.find((rule) =>
    rule.keywords.some((kw) => {
      if (kw.length <= 3) {
        return new RegExp(`(^|\\b|\\s)${kw}($|\\b|\\s)`).test(normalizedTitle);
      }
      return normalizedTitle.includes(kw);
    })
  );

  if (matchedRule) {
    preferredQuality = matchedRule.qualityId;
    classificationReason = matchedRule.label;
  } else if (sport === 'muscu') {
    const tLower = rawType.toLowerCase();
    if (tLower.includes('yoga') || tLower.includes('pilates')) {
      preferredQuality = tLower.includes('pilates') ? 'abdos' : 'proprio';
      classificationReason = `Activité ${rawType}`;
    } else {
      const blockForceFocus = activeBlockFocus.find((id) => isForceQuality(id, availableQualities));
      preferredQuality = blockForceFocus || 'leg';
      classificationReason = blockForceFocus ? 'Focus force du bloc actif' : 'Musculation Garmin';
    }
  } else {
    // 2. Classification objective par zones FC et Intensity Factor (IF)
    if (hrZones && hrZones.z5PlusRatio >= 0.14) {
      preferredQuality = 'vo2max';
      classificationReason = `Zone 5+ élevée (${Math.round(hrZones.z5PlusRatio * 100)}%)`;
    } else if (ifRatio !== null && ifRatio >= 0.92) {
      preferredQuality = 'vo2max';
      classificationReason = `Intensité élevée (IF ${Math.round(ifRatio * 100)}%)`;
    } else if ((hrZones && hrZones.z3z4Ratio >= 0.35) || (ifRatio !== null && ifRatio >= 0.80)) {
      preferredQuality = 'seuil';
      classificationReason =
        ifRatio !== null
          ? `Allure soutenue (IF ${Math.round(ifRatio * 100)}%)`
          : `Z3-Z4 soutenue (${Math.round((hrZones?.z3z4Ratio || 0) * 100)}%)`;
    } else {
      preferredQuality = 'ef';
      classificationReason = hrZones
        ? `Z1-Z2 dominant (${Math.round(hrZones.z1z2Ratio * 100)}%)`
        : ifRatio !== null
        ? `Endurance (IF ${Math.round(ifRatio * 100)}%)`
        : `${sport === 'bike' ? 'Vélo' : 'Course'} aérobie`;
    }
  }

  const suggestedQualityId = resolveAvailableQuality(
    preferredQuality,
    availableQualities,
    sport === 'muscu' ? 'force' : 'cardio'
  );

  const { rpeCardio, rpeMusc } = estimateRpePair(
    activity,
    sport,
    suggestedQualityId,
    duration,
    ifRatio,
    hrZones
  );

  const distanceKm =
    typeof activity.distance === 'number' && Number.isFinite(activity.distance) && activity.distance >= 100
      ? Math.round((activity.distance / 1000) * 10) / 10
      : undefined;

  const elevationGainM =
    typeof activity.total_elevation_gain === 'number' &&
    Number.isFinite(activity.total_elevation_gain) &&
    activity.total_elevation_gain >= 5
      ? Math.round(activity.total_elevation_gain)
      : undefined;

  const avgHr =
    typeof activity.average_heartrate === 'number' &&
    Number.isFinite(activity.average_heartrate) &&
    activity.average_heartrate >= 40
      ? Math.round(activity.average_heartrate)
      : undefined;

  const maxHr =
    typeof activity.max_heartrate === 'number' &&
    Number.isFinite(activity.max_heartrate) &&
    activity.max_heartrate >= 60
      ? Math.round(activity.max_heartrate)
      : undefined;

  const icuTrainingLoad =
    typeof activity.icu_training_load === 'number' &&
    Number.isFinite(activity.icu_training_load) &&
    activity.icu_training_load > 0
      ? Math.round(activity.icu_training_load)
      : undefined;

  return {
    externalId: String(activity.id),
    dateStr,
    startTime,
    title,
    rawType,
    sport,
    duration,
    distanceKm,
    elevationGainM,
    avgHr,
    maxHr,
    icuTrainingLoad,
    icuIntensity: ifRatio !== null ? Math.round(ifRatio * 100) : undefined,
    suggestedQualityId,
    suggestedRpeCardio: rpeCardio,
    suggestedRpeMusc: rpeMusc,
    classificationReason,
    source: activity.source || 'GARMIN_CONNECT',
  };
}

/**
 * Construit un objet `SessionData` prêt à enregistrer dans PhysioTracker PRO,
 * en fusionnant automatiquement en `subSessions` si une séance primaire existe déjà
 * le même jour sur la même filière.
 */
export function buildSessionFromGarminActivity(
  activity: PendingGarminActivity,
  qualityId: string,
  rpeCardio: number,
  rpeMusc: number,
  existingSession?: SessionData | null
): SessionData {
  const safeRpeCardio = Math.max(1, Math.min(10, Math.round(rpeCardio)));
  const safeRpeMusc = Math.max(1, Math.min(10, Math.round(rpeMusc)));
  const isEccentric = qualityId === 'descente';

  const { load, loadCardio, loadMusc } = computeDetailedSessionLoad(
    qualityId,
    activity.duration,
    safeRpeCardio,
    safeRpeMusc,
    isEccentric
  );

  const noteParts = [`Garmin · ${activity.title}`];
  if (activity.distanceKm !== undefined) noteParts.push(`${activity.distanceKm} km`);
  if (activity.elevationGainM !== undefined) noteParts.push(`+${activity.elevationGainM} m`);
  if (activity.avgHr !== undefined) noteParts.push(`FC moy ${activity.avgHr} bpm`);
  if (activity.icuTrainingLoad !== undefined) noteParts.push(`Load Garmin ${activity.icuTrainingLoad}`);
  const notes = noteParts.join(' · ').slice(0, 500);

  const now = Date.now();
  const fatigue = isForceQuality(qualityId)
    ? safeRpeMusc
    : isCardioQuality(qualityId)
    ? safeRpeCardio
    : Math.round((safeRpeCardio + safeRpeMusc) / 2);

  // Fusion non destructrice en sous-séances si une séance primaire existe déjà ce jour-là
  if (existingSession && isPrimary(existingSession)) {
    const existingSubs: SubSession[] =
      Array.isArray(existingSession.subSessions) && existingSession.subSessions.length > 0
        ? [...existingSession.subSessions]
        : [
            {
              id: `existing_${existingSession.updatedAt || now - 1}`,
              name: existingSession.notes ? existingSession.notes.slice(0, 45) : 'Séance 1',
              duration: Number(existingSession.duration) || 0,
              rpeCardio: existingSession.rpeCardio ?? 5,
              rpeMusc: existingSession.rpeMusc ?? existingSession.rpeMusculaire ?? 5,
              fatigue: existingSession.fatigue ?? 5,
              load: Number(existingSession.load) || 0,
              loadCardio: existingSession.loadCardio,
              loadMusc: existingSession.loadMusc,
              sport: existingSession.sport,
              isEccentric: existingSession.isEccentric,
              notes: existingSession.notes,
            },
          ];

    const newSub: SubSession = {
      id: `icu_${activity.externalId}`,
      name: activity.title.slice(0, 50),
      duration: activity.duration,
      rpeCardio: safeRpeCardio,
      rpeMusc: safeRpeMusc,
      fatigue,
      load,
      loadCardio,
      loadMusc,
      sport: activity.sport,
      isEccentric,
      notes,
    };

    const allSubs = [...existingSubs, newSub].slice(0, 10);
    const totalDuration = allSubs.reduce((s, item) => s + (Number(item.duration) || 0), 0);
    const totalLoad = allSubs.reduce((s, item) => s + (Number(item.load) || 0), 0);
    const totalLoadCardio = allSubs.reduce(
      (s, item) => s + (Number(item.loadCardio) || Number(item.load) || 0),
      0
    );
    const totalLoadMusc = allSubs.reduce(
      (s, item) => s + (Number(item.loadMusc) || Number(item.load) || 0),
      0
    );

    const weightedCardio =
      totalDuration > 0
        ? Math.round(
            allSubs.reduce((s, item) => s + (Number(item.rpeCardio) || 5) * (Number(item.duration) || 0), 0) /
              totalDuration
          )
        : safeRpeCardio;
    const weightedMusc =
      totalDuration > 0
        ? Math.round(
            allSubs.reduce((s, item) => s + (Number(item.rpeMusc) || 5) * (Number(item.duration) || 0), 0) /
              totalDuration
          )
        : safeRpeMusc;

    return {
      ...existingSession,
      duration: totalDuration,
      rpeCardio: Math.max(1, Math.min(10, weightedCardio)),
      rpeMusc: Math.max(1, Math.min(10, weightedMusc)),
      rpeMusculaire: Math.max(1, Math.min(10, weightedMusc)),
      fatigue: Math.max(existingSession.fatigue ?? 0, fatigue),
      load: totalLoad,
      loadCardio: totalLoadCardio,
      loadMusc: totalLoadMusc,
      isSecondary: false,
      subSessions: allSubs,
      notes: existingSession.notes ? `${existingSession.notes} | ${notes}`.slice(0, 950) : notes,
      source: 'intervals_icu',
      externalId: activity.externalId,
      updatedAt: now,
    };
  }

  return {
    duration: activity.duration,
    rpeCardio: safeRpeCardio,
    rpeMusc: safeRpeMusc,
    rpeMusculaire: safeRpeMusc,
    fatigue,
    load,
    loadCardio,
    loadMusc,
    sport: activity.sport,
    isEccentric,
    isSecondary: false,
    notes,
    source: 'intervals_icu',
    externalId: activity.externalId,
    updatedAt: now,
  };
}
