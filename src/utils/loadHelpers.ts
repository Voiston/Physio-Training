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
      count += 1;
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
