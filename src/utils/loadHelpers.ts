import { SessionData } from '../hooks/useData';

/**
 * Détermine si une entrée d'entraînement est une séance principale (réalisée par l'athlète)
 * ou un impact secondaire rémanent (transfert physiologique calculé).
 */
export function isPrimary(session: any): boolean {
  if (!session) return false;
  if (typeof session === 'number') return true;
  if (typeof session === 'object') {
    return !session.isSecondary;
  }
  return false;
}

/**
 * Extrait la charge numérique d'une séance de manière robuste.
 */
export function extractSessionLoad(data: any): number {
  if (data === null || data === undefined) return 0;
  // Donnée historique au format RPE brut seul : durée forfaitaire de référence 45 min (45 * RPE)
  // identique au comportement de ScoreModal pour éliminer tout facteur d'échelle parasite
  if (typeof data === 'number') return Math.round(data * 45);
  if (typeof data === 'object') {
    if (typeof data.load === 'number') return data.load;
    const duration = Number(data.duration) || 0;
    const rpeMusc = Number(data.rpeMusc) || 5;
    const rpeCardio = Number(data.rpeCardio) || 5;
    const meanRpe = (rpeMusc + rpeCardio) / 2;
    return Math.round(duration * meanRpe);
  }
  return 0;
}

/**
 * SOURCE UNIQUE DE CHARGE ATHLÈTE (Single Source of Truth) :
 * Calcule la charge réelle cumulée subie par l'athlète sur une journée donnée.
 * EXCLUT STRICTEMENT les impacts secondaires pour éviter tout double-comptage.
 */
export function getDailyAthleteLoad(
  events: Record<string, Record<string, SessionData>> | null | undefined,
  dateStr: string
): number {
  if (!events) return 0;
  let totalLoad = 0;

  Object.values(events).forEach(qualityEvents => {
    if (!qualityEvents) return;
    const session = qualityEvents[dateStr];
    if (session && isPrimary(session)) {
      totalLoad += extractSessionLoad(session);
    }
  });

  return totalLoad;
}

/**
 * Calcule le temps total effectif d'entraînement (en minutes) réalisé par l'athlète sur la journée.
 * Exclut strictement les impacts secondaires.
 */
export function getDailyAthleteDuration(
  events: Record<string, Record<string, SessionData>> | null | undefined,
  dateStr: string
): number {
  if (!events) return 0;
  let totalDuration = 0;

  Object.values(events).forEach(qualityEvents => {
    if (!qualityEvents) return;
    const session = qualityEvents[dateStr];
    if (session && isPrimary(session)) {
      totalDuration += Number(session.duration) || 0;
    }
  });

  return totalDuration;
}

/**
 * Récupère la liste des séances principales de l'athlète sur la journée.
 */
export function getDailyAthleteSessions(
  events: Record<string, Record<string, SessionData>> | null | undefined,
  dateStr: string
): { qualityId: string; session: SessionData }[] {
  if (!events) return [];
  const list: { qualityId: string; session: SessionData }[] = [];

  Object.entries(events).forEach(([qualityId, qualityEvents]) => {
    if (!qualityEvents) return;
    const session = qualityEvents[dateStr];
    if (session && isPrimary(session)) {
      list.push({ qualityId, session });
    }
  });

  return list;
}

/**
 * Compte le nombre de séances principales de l'athlète sur la journée.
 */
export function getDailyAthleteSessionCount(
  events: Record<string, Record<string, SessionData>> | null | undefined,
  dateStr: string
): number {
  if (!events) return 0;
  let count = 0;

  Object.values(events).forEach(qualityEvents => {
    if (!qualityEvents) return;
    const session = qualityEvents[dateStr];
    if (session && isPrimary(session)) {
      if (Array.isArray(session.subSessions) && session.subSessions.length > 1) {
        count += session.subSessions.length;
      } else {
        count += 1;
      }
    }
  });

  return count;
}

/**
 * Récupère la charge reçue par une qualité spécifique sur une journée.
 * includeSecondary = true : inclut la contrainte directe ET les transferts indirects reçus.
 */
export function getQualityDayLoad(
  events: Record<string, Record<string, SessionData>> | null | undefined,
  qualityId: string,
  dateStr: string,
  includeSecondary: boolean = true
): number {
  if (!events || !events[qualityId]) return 0;
  const session = events[qualityId][dateStr];
  if (!session) return 0;
  if (!includeSecondary && !isPrimary(session)) return 0;
  return extractSessionLoad(session);
}

export const CARDIO_QUALITIES = ['vo2max', 'seuil', 'ef', 'co2', 'gut'];
export const FORCE_QUALITIES = ['pull', 'push', 'leg', 'plyo', 'descente', 'abdos', 'proprio', 'isolation'];

/**
 * Calcule la charge d'entraînement (en UA Foster) selon le domaine physiologique de la filière.
 * - Filière Cardio : Durée * RPE Cardio (ex: VO2max 35 min @ RPE 8 = 280 UA)
 * - Filière Force : Durée * RPE Musculaire * (1.15 si excentrique)
 * - Filière Mixte : Moyenne Cardio & Musculaire
 */
export function computeSessionLoad(
  qualityId: string,
  duration: number,
  rpeCardio: number,
  rpeMusc: number,
  isEccentric: boolean = false
): number {
  const numDur = Math.max(0, Number(duration) || 0);
  if (numDur === 0) return 0;
  const numCardio = Math.max(0, Math.min(10, Number(rpeCardio) || 5));
  const numMusc = Math.max(0, Math.min(10, Number(rpeMusc) || 5));
  const eccentricMultiplier = isEccentric ? 1.15 : 1.0;

  const loadCardio = Math.round(numDur * numCardio);
  const loadMusc = Math.round(numDur * numMusc * eccentricMultiplier);

  const isCardio = CARDIO_QUALITIES.includes(qualityId);
  const isForce = FORCE_QUALITIES.includes(qualityId);

  if (isCardio) return loadCardio;
  if (isForce) return loadMusc;
  return Math.round((loadCardio + loadMusc) / 2);
}

/**
 * Calcule la charge quotidienne moyenne de référence de l'athlète sur les N derniers jours (par défaut 28 jours).
 * Renvoie une charge standard réaliste si l'historique est vierge ou inférieur à un seuil minimal.
 */
export function getAthleteBaselineDailyLoad(
  events: Record<string, Record<string, SessionData>> | null | undefined,
  daysCount: number = 28,
  referenceDate: Date = new Date()
): { dailyAvg: number; weeklyAvg: number; hasHistoricalData: boolean } {
  if (!events) {
    return { dailyAvg: 350, weeklyAvg: 2450, hasHistoricalData: false };
  }

  let totalHistoricalLoad = 0;
  let activeDays = 0;

  for (let i = 1; i <= daysCount; i++) {
    const d = new Date(referenceDate.getTime() - i * 86400000);
    const dateStr = d.toISOString().split('T')[0];
    const dayLoad = getDailyAthleteLoad(events, dateStr);
    if (dayLoad > 0) {
      totalHistoricalLoad += dayLoad;
      activeDays += 1;
    }
  }

  // Si l'athlète a au moins 3 jours d'entraînement enregistrés sur la période
  if (activeDays >= 3 && totalHistoricalLoad > 0) {
    const dailyAvg = Math.round(totalHistoricalLoad / daysCount);
    const effectiveDailyAvg = Math.max(150, dailyAvg);
    return {
      dailyAvg: effectiveDailyAvg,
      weeklyAvg: effectiveDailyAvg * 7,
      hasHistoricalData: true,
    };
  }

  return { dailyAvg: 350, weeklyAvg: 2450, hasHistoricalData: false };
}

