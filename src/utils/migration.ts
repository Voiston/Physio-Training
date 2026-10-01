export const CURRENT_SCHEMA_VERSION = 2;

export interface AppExportData {
  schemaVersion?: number;
  events?: Record<string, Record<string, any>>;
  dailyMetrics?: Record<string, Record<string, number>>;
  trainingBlocks?: any[];
  qualities?: any[];
  blockTemplates?: any[];
  targetCompetition?: any;
  physioSettings?: any;
  exportDate?: string;
  [key: string]: any;
}

const CARDIO_QUALITIES = new Set(['vo2max', 'seuil', 'ef', 'co2', 'gut']);
const FORCE_QUALITIES = new Set(['pull', 'push', 'leg', 'plyo', 'descente', 'abdos', 'proprio']);

/**
 * Calcule la charge pure d'une séance (stimulus) selon le type de filière,
 * sans corrompre le stimulus par le marqueur de réponse (fatigue perçue).
 */
export function calculateCleanSessionLoad(
  qualityId: string, 
  duration: number, 
  rpeMusc: number, 
  rpeCardio: number,
  isEccentric: boolean = false
): { load: number; loadCardio: number; loadMusc: number } {
  const dur = Math.max(0, Number(duration) || 0);
  const rM = Math.max(0, Math.min(10, Number(rpeMusc) || 5));
  const rC = Math.max(0, Math.min(10, Number(rpeCardio) || 5));

  let rpeGlobal: number;
  if (CARDIO_QUALITIES.has(qualityId)) {
    rpeGlobal = rC;
  } else if (FORCE_QUALITIES.has(qualityId)) {
    rpeGlobal = isEccentric ? Math.min(10, rM * 1.15) : rM;
  } else {
    // Mixte (sprint, etc.)
    rpeGlobal = (rM + rC) / 2;
  }

  const load = Math.round(dur * rpeGlobal);
  const loadCardio = Math.round(dur * rC);
  const loadMusc = Math.round(dur * (isEccentric ? Math.min(10, rM * 1.15) : rM));

  return { load, loadCardio, loadMusc };
}

/**
 * Migration automatique et ascendante des données de l'application
 */
export function migrateData(rawData: any): AppExportData {
  if (!rawData || typeof rawData !== 'object') {
    return { schemaVersion: CURRENT_SCHEMA_VERSION };
  }

  const version = Number(rawData.schemaVersion) || 0;
  let migrated = { ...rawData };

  // Migration v0 -> v1 (Normalisation initiale, détection des secondaires)
  if (version < 1) {
    if (migrated.events && typeof migrated.events === 'object') {
      Object.keys(migrated.events).forEach(qId => {
        const dates = migrated.events[qId];
        if (dates && typeof dates === 'object') {
          Object.keys(dates).forEach(dateStr => {
            const session = dates[dateStr];
            if (session && typeof session === 'object') {
              if (session.isSecondary === undefined) {
                session.isSecondary = false;
              }
            }
          });
        }
      });
    }
  }

  // Migration v1 -> v2 (Dissociation charge pure / réponse de fatigue, recalcul de load depuis les champs bruts)
  if (version < 2) {
    if (migrated.events && typeof migrated.events === 'object') {
      Object.keys(migrated.events).forEach(qId => {
        const dates = migrated.events[qId];
        if (dates && typeof dates === 'object') {
          Object.keys(dates).forEach(dateStr => {
            const session = dates[dateStr];
            if (session && typeof session === 'object') {
              const dur = session.duration ?? 0;
              const rM = session.rpeMusculaire ?? session.rpeMusc ?? 5;
              const rC = session.rpeCardio ?? 5;
              const isEcc = !!session.isEccentric;

              // Conserver la charge historique pour traçabilité
              if (session.load !== undefined && session.loadLegacy === undefined) {
                session.loadLegacy = session.load;
              }

              // Recalculer le stimulus pur selon la filière sans le modificateur de fatigue
              if (dur > 0) {
                const { load, loadCardio, loadMusc } = calculateCleanSessionLoad(qId, dur, rM, rC, isEcc);
                // Si la séance n'est pas un impact secondaire calculé
                if (!session.isSecondary) {
                  session.load = load;
                }
                session.loadCardio = loadCardio;
                session.loadMusc = loadMusc;
              }
            }
          });
        }
      });
    }

    // Migration targetCompetition: s'assurer de l'unité
    if (migrated.targetCompetition && typeof migrated.targetCompetition === 'object') {
      if (!migrated.targetCompetition.targetTsbUnit) {
        migrated.targetCompetition.targetTsbUnit = 'points';
      }
    }

    migrated.schemaVersion = 2;
  }

  return migrated;
}

/**
 * Récupère le schéma courant du localStorage ou initialise
 */
export function ensureLocalStorageSchema(): number {
  try {
    const raw = localStorage.getItem('physio_schema_version');
    if (!raw) {
      localStorage.setItem('physio_schema_version', String(CURRENT_SCHEMA_VERSION));
      return CURRENT_SCHEMA_VERSION;
    }
    return Number(raw) || CURRENT_SCHEMA_VERSION;
  } catch (e) {
    return CURRENT_SCHEMA_VERSION;
  }
}
