export const CURRENT_SCHEMA_VERSION = 2;
import { isSafeDate, isSafeId } from './security';
import type { SessionData, Quality, TrainingBlock, BlockTemplate, TargetCompetition, PhysiologicalSettings } from '../hooks/useData';

export interface AppExportData {
  schemaVersion?: number;
  events?: Record<string, Record<string, SessionData>>;
  dailyMetrics?: Record<string, Record<string, number>>;
  trainingBlocks?: TrainingBlock[];
  qualities?: Quality[];
  blockTemplates?: BlockTemplate[];
  targetCompetition?: TargetCompetition | null;
  physioSettings?: PhysiologicalSettings;
  exportDate?: string;
  [key: string]: unknown;
}

/** Séance telle qu'elle peut exister dans d'anciens schémas (champs non garantis). */
interface LegacySession {
  duration?: number;
  rpeMusculaire?: number;
  rpeMusc?: number;
  rpeCardio?: number;
  isEccentric?: boolean;
  isSecondary?: boolean;
  load?: number;
  loadLegacy?: number;
  loadCardio?: number;
  loadMusc?: number;
  originalLoad?: number;
  [key: string]: unknown;
}

/** Vue mutable des données brutes pendant la migration. */
interface MigratableData {
  schemaVersion?: number;
  events?: Record<string, Record<string, LegacySession | number>>;
  targetCompetition?: { targetTsbUnit?: string; [key: string]: unknown } | null;
  [key: string]: unknown;
}

import { isCardioQuality, isForceQuality } from './qualities';
import { computeDetailedSessionLoad } from './loadHelpers';

/**
 * Calcule la charge pure d'une séance (stimulus) selon le type de filière,
 * en déléguant à la source unique de vérité loadHelpers.ts.
 */
export function calculateCleanSessionLoad(
  qualityId: string, 
  duration: number, 
  rpeMusc: number, 
  rpeCardio: number,
  isEccentric: boolean = false
): { load: number; loadCardio: number; loadMusc: number } {
  return computeDetailedSessionLoad(qualityId, duration, rpeCardio, rpeMusc, isEccentric);
}

/**
 * Migration automatique et ascendante des données de l'application
 */
export function migrateData(rawData: unknown): AppExportData {
  if (!rawData || typeof rawData !== 'object') {
    return { schemaVersion: CURRENT_SCHEMA_VERSION };
  }

  let migrated: MigratableData = { ...(rawData as MigratableData) };
  const version = Number(migrated.schemaVersion) || 0;

  // Migration v0 -> v1 (Normalisation initiale, détection des secondaires)
  if (version < 1) {
    const events = migrated.events;
    if (events && typeof events === 'object') {
      Object.keys(events).forEach(qId => {
        const dates = events[qId];
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
    const events = migrated.events;
    if (events && typeof events === 'object') {
      Object.keys(events).forEach(qId => {
        const dates = events[qId];
        if (dates && typeof dates === 'object') {
          Object.keys(dates).forEach(dateStr => {
            const session = dates[dateStr];
            if (typeof session === 'number') {
              // Auto-détection de l'échelle validée par l'utilisateur :
              // session <= 10 : RPE brut sur échelle 1-10 -> forfait 45 min
              // session > 10 : Charge Foster déjà consolidée en UA
              const isRawRpe = session <= 10;
              const dur = isRawRpe ? 45 : 45;
              const rpe = isRawRpe ? session : Math.min(10, Math.max(1, Math.round(session / 45)));
              const { load, loadCardio, loadMusc } = calculateCleanSessionLoad(qId, dur, rpe, rpe, false);
              const effectiveLoad = isRawRpe ? load : Math.round(session);
              dates[dateStr] = {
                duration: dur,
                rpeMusc: rpe,
                rpeCardio: rpe,
                fatigue: rpe,
                load: effectiveLoad,
                loadCardio: isRawRpe ? loadCardio : effectiveLoad,
                loadMusc: isRawRpe ? loadMusc : effectiveLoad,
                sport: isCardioQuality(qId) ? 'run' : 'muscu',
                isSecondary: false
              };
            } else if (session && typeof session === 'object') {
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
                // Si la séance est principale (non secondaire)
                if (!session.isSecondary) {
                  session.load = load;
                  session.loadCardio = loadCardio;
                  session.loadMusc = loadMusc;
                } else {
                  // Pour une séance secondaire, recalculer les composantes proportionnellement à son ratio réel
                  const parentLoad = Number(session.originalLoad) || load || 1;
                  const secRatio = Math.min(1.0, (Number(session.load) || 0) / parentLoad);
                  session.loadCardio = Math.round(loadCardio * secRatio);
                  session.loadMusc = Math.round(loadMusc * secRatio);
                }
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

  return migrated as AppExportData;
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

/**
 * Migre directement toutes les entrées présentes dans localStorage si la version est obsolète
 */
export function migrateLocalStorage(): void {
  try {
    const currentVer = Number(localStorage.getItem('physio_schema_version')) || 0;
    if (currentVer >= CURRENT_SCHEMA_VERSION) return;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      const match = key.match(/^(\d{4}-\d{2}-\d{2})_(.+)$/);
      if (match) {
        const dateStr = match[1];
        const qualityId = match[2];
        if (!isSafeDate(dateStr) || !isSafeId(qualityId)) continue;
        if (isCardioQuality(qualityId) || isForceQuality(qualityId) || qualityId === 'sprint') {
          const raw = localStorage.getItem(key);
          if (raw) {
            try {
              const session = JSON.parse(raw);
              if (session && typeof session === 'object') {
                const dur = Number(session.duration) || 0;
                const rM = session.rpeMusculaire ?? session.rpeMusc ?? 5;
                const rC = session.rpeCardio ?? 5;
                const isEcc = !!session.isEccentric;
                if (dur > 0) {
                  const { load, loadCardio, loadMusc } = calculateCleanSessionLoad(qualityId, dur, rM, rC, isEcc);
                  if (!session.isSecondary) {
                    session.load = load;
                    session.loadCardio = loadCardio;
                    session.loadMusc = loadMusc;
                    session.isSecondary = false;
                  } else {
                    const parentLoad = Number(session.originalLoad) || load || 1;
                    const secRatio = Math.min(1.0, (Number(session.load) || 0) / parentLoad);
                    session.loadCardio = Math.round(loadCardio * secRatio);
                    session.loadMusc = Math.round(loadMusc * secRatio);
                  }
                  localStorage.setItem(key, JSON.stringify(session));
                }
              }
            } catch (e) { console.warn('[migration] Session ignorée (JSON illisible ou écriture impossible)', e); }
          }
        }
      }
    }
    localStorage.setItem('physio_schema_version', String(CURRENT_SCHEMA_VERSION));
  } catch (e) { console.warn('[migration] Migration de schéma interrompue', e); }
}
