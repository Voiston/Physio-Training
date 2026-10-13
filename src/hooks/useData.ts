import { useState, useEffect, useMemo, useCallback, useRef, ChangeEvent } from 'react';
import { useCloudSync } from './useCloudSync';
import { 
  DEFAULT_QUALITIES, 
  computeAllQualitiesEMA, 
  computeQualityEMAData,
  getActiveBlockForDate,
  computeBlockEndDate,
  reorderQualitiesForBlock,
  getSavedBlockTemplates,
  saveBlockTemplates,
  getTrainingRecommendations,
  computeFosterMetrics,
  computeBanisterPerformance,
  getTaperingAnalysis,
  computeCardioVsMuscularBalance,
  getQualityImpacts,
  computeIntensityDistribution,
  computePerceivedFatigueAnalysis,
  computeDerivedEvents
} from '../utils/physiology';
import { getLocalYYYYMMDD } from '../utils/dateHelpers';
import { computeAllWeeksStats, WeekStats } from '../utils/weekHelpers';

import { CURRENT_SCHEMA_VERSION, migrateData, migrateLocalStorage } from '../utils/migration';
import { isPrimary, computeSessionLoad, getAthleteBaselineDailyLoad } from '../utils/loadHelpers';
import { SessionExercise, getSavedCustomExercises } from '../utils/muscleHelpers';
import { 
  isSafeId, 
  isSafeDate, 
  sanitizeSessionData, 
  sanitizeEventsPayload, 
  sanitizeDailyMetricsPayload,
  sanitizeTombstonesPayload,
  getSavedTombstones,
  saveTombstone,
  removeTombstone,
  validateAndStageImportPayload,
  mergeEventsNonDestructive,
  mergeDailyMetricsNonDestructive
} from '../utils/security';

export interface QualityImpact {
  id: string;
  ratio: number;
}

export interface Quality {
  id: string;
  name: string;
  g: number;
  o: number;
  retentionDays?: number;
  category?: 'cardio' | 'force' | 'mixte' | string;
  impacts?: QualityImpact[];
}

export interface BlockTemplate {
  id: string;
  name: string;
  durationWeeks: number;
  focusQualities: string[];
  description: string;
  targetMultiplier: number;
  maintenanceMultiplier: number;
  color?: string;
  badge?: string;
}

export interface TrainingRecommendation {
  quality: Quality;
  rank: number;
  isBlockFocus: boolean;
  cellState: any;
  daysSinceLastSession: number;
  lastSessionData: any;
  urgencyScore: number;
  urgencyLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'OPTIMAL' | 'REST' | string;
  urgencyBadge: string;
  urgencyColor: string;
  reason: string;
  actionTip: string;
}

export interface TrainingBlock {
  id: string;
  name: string;
  type: string;
  startDate: string;
  endDate: string;
  durationWeeks: number;
  focusQualities: string[];
  targetMultiplier: number;
  maintenanceMultiplier: number;
  color?: string;
  notes?: string;
}

export interface TargetCompetition {
  name: string;
  date: string;
  type: string; // 'marathon' | 'trail' | 'triathlon' | 'force' | 'course' | 'autre'
  targetTsb: number; // e.g. 15 to 25
  targetTsbUnit?: 'percent' | 'points' | string;
  targetTime?: string;
  notes?: string;
}

export interface SecondaryContribution {
  load: number;
  loadCardio?: number;
  loadMusc?: number;
  ratio: number;
  parentName?: string;
}

export interface SubSession {
  id: string;
  name?: string;
  duration: number;
  rpeMusc?: number;
  rpeMusculaire?: number;
  rpeCardio?: number;
  fatigue?: number;
  load: number;
  loadCardio?: number;
  loadMusc?: number;
  sport?: string;
  isEccentric?: boolean;
  exercises?: SessionExercise[];
  notes?: string;
}

export interface SessionData {
  rpeMusc?: number;
  rpeMusculaire?: number;
  rpeCardio?: number;
  fatigue?: number;
  duration?: number;
  load: number;
  loadCardio?: number;
  loadMusc?: number;
  sport?: 'run' | 'bike' | 'muscu' | string;
  isEccentric?: boolean;
  isSecondary?: boolean;
  exercises?: SessionExercise[];
  subSessions?: SubSession[];
  parentQId?: string;
  parentContributions?: Record<string, SecondaryContribution>;
  originalLoad?: number;
  isSimulated?: boolean;
  updatedAt?: number;
}

export interface QualityEMASeriesPoint {
  dateStr: string;
  day: number;
  offset: number;
  load: number;
  ema3: number;
  ema7: number;
  ema21: number;
}

export interface QualityEMAData {
  qualityId: string;
  series: QualityEMASeriesPoint[];
  current: {
    load: number;
    ema3: number;
    ema7: number;
    ema21: number;
    prevEma3?: number;
    prevEma7?: number;
    prevEma21?: number;
    prevPeriodEma3?: number;
    prevPeriodEma7?: number;
    prevPeriodEma21?: number;
    prevWeekEma3?: number;
    prevWeekEma7?: number;
    prevWeekEma21?: number;
    delta3?: number;
    delta7?: number;
    delta21?: number;
    periodDelta3?: number;
    periodDelta7?: number;
    periodDelta21?: number;
    weekDelta3?: number;
    weekDelta7?: number;
    weekDelta21?: number;
    percent3?: number;
    percent7?: number;
    percent21?: number;
    periodPercent3?: number;
    periodPercent7?: number;
    periodPercent21?: number;
    weekPercent3?: number;
    weekPercent7?: number;
    weekPercent21?: number;
    trend3?: 'up' | 'down' | 'flat' | string;
    trend7?: 'up' | 'down' | 'flat' | string;
    trend21?: 'up' | 'down' | 'flat' | string;
    acwr: number;
    trend: 'up' | 'down' | 'flat' | string;
  };
  sparkline: QualityEMASeriesPoint[];
}

export type QualitiesEMAMap = Record<string, QualityEMAData>;

export interface DailyMetrics {
  readiness?: number;
  vfc?: number;
  hrRest?: number;
  [key: string]: number | undefined;
}

export interface PhysiologicalSettings {
  tauFatigue: number; // 5 to 12 days, default 7
  tauFitness: number; // 21 to 45 days, default 28
  profileName?: string;
  initialCtl?: number;
}

export const DEFAULT_PHYSIO_SETTINGS: PhysiologicalSettings = {
  tauFatigue: 7,
  tauFitness: 28,
  profileName: 'Standard'
};

function getInitialEvents(): Record<string, Record<string, SessionData>> {
  try {
    migrateLocalStorage();
  } catch (err) {
    console.warn('Migration error during initial events loading:', err);
  }
  const loadedEvents: Record<string, Record<string, SessionData>> = {};
  DEFAULT_QUALITIES.forEach(q => {
    if (isSafeId(q.id)) {
      loadedEvents[q.id] = {};
    }
  });

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || key === 'physio_qualities' || key === 'physio_target_competition') continue;
      const match = key.match(/^(\d{4}-\d{2}-\d{2})_(.+)$/);
      if (match) {
        const dateStr = match[1];
        const category = match[2];

        // SÉCURITÉ : Rejeter strictement les clés toxiques, prototype et identifiants invalides
        if (!isSafeDate(dateStr) || !isSafeId(category)) continue;
        if (category === 'readiness' || category === 'vfc' || category === 'hrRest') continue;

        try {
          const rawItem = localStorage.getItem(key);
          if (!rawItem) continue;
          const parsed = JSON.parse(rawItem);
          const cleanedSession = sanitizeSessionData(parsed);
          if (!cleanedSession) continue;

          // PURGE DES IMPACTS SECONDAIRES HISTORIQUES :
          // Si une entrée en localStorage est un impact secondaire rémanent, la purger du stockage local
          // et ne pas l'ajouter aux événements primaires (elle est calculée dynamiquement à la lecture).
          if (cleanedSession.isSecondary) {
            localStorage.removeItem(key);
            continue;
          }

          if (!loadedEvents[category]) {
            loadedEvents[category] = {};
          }
          loadedEvents[category][dateStr] = cleanedSession;
        } catch {
          const rawVal = localStorage.getItem(key);
          const fallbackLoad = parseInt(rawVal || '0', 10) * 5;
          if (!Number.isNaN(fallbackLoad) && fallbackLoad >= 0) {
            if (!loadedEvents[category]) loadedEvents[category] = {};
            loadedEvents[category][dateStr] = { load: fallbackLoad };
          }
        }
      }
    }
  } catch {}
  return loadedEvents;
}

function getInitialDailyMetrics(): Record<string, DailyMetrics> {
  const loadedMetrics: Record<string, DailyMetrics> = {};
  const ALLOWED_METRICS = new Set(['readiness', 'vfc', 'hrRest']);

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      const match = key.match(/^(\d{4}-\d{2}-\d{2})_(.+)$/);
      if (match) {
        const dateStr = match[1];
        const category = match[2];

        if (!isSafeDate(dateStr) || !ALLOWED_METRICS.has(category)) continue;

        try {
          const rawItem = localStorage.getItem(key);
          if (!rawItem) continue;
          const parsedNum = Number(JSON.parse(rawItem));
          if (Number.isFinite(parsedNum) && parsedNum >= 0 && parsedNum <= 1000) {
            if (!loadedMetrics[dateStr]) loadedMetrics[dateStr] = {};
            loadedMetrics[dateStr][category] = parsedNum;
          }
        } catch {
          const rawVal = localStorage.getItem(key);
          const parsedNum = parseInt(rawVal || '0', 10);
          if (Number.isFinite(parsedNum) && parsedNum >= 0 && parsedNum <= 1000) {
            if (!loadedMetrics[dateStr]) loadedMetrics[dateStr] = {};
            loadedMetrics[dateStr][category] = parsedNum;
          }
        }
      }
    }
  } catch {}
  return loadedMetrics;
}

export function useData() {
  const [events, setEvents] = useState<Record<string, Record<string, SessionData>>>(() => getInitialEvents());
  const [tombstones, setTombstones] = useState<Record<string, number>>(() => getSavedTombstones());
  const [qualities, setQualitiesState] = useState<Quality[]>(() => {
    try {
      const raw = localStorage.getItem('physio_qualities');
      if (raw) {
        const parsed: Quality[] = JSON.parse(raw);
        const defaultMap = new Map(DEFAULT_QUALITIES.map(q => [q.id, q]));
        const updated = parsed.map(q => {
          const def = defaultMap.get(q.id);
          if (def) {
            return {
              ...def,
              ...q,
              retentionDays: def.retentionDays,
              category: def.category,
              impacts: q.id === 'leg' ? def.impacts : (q.impacts || def.impacts)
            };
          }
          return q;
        });
        const existingIds = new Set(updated.map(q => q.id));
        const missing = DEFAULT_QUALITIES.filter(q => !existingIds.has(q.id));
        return [...updated, ...missing];
      }
    } catch (e) {}
    return DEFAULT_QUALITIES;
  });

  const [dailyMetrics, setDailyMetrics] = useState<Record<string, DailyMetrics>>(() => getInitialDailyMetrics());
  
  const [blockTemplates, setBlockTemplates] = useState<BlockTemplate[]>(() => {
    return getSavedBlockTemplates();
  });

  const [trainingBlocks, setTrainingBlocks] = useState<TrainingBlock[]>(() => {
    try {
      const raw = localStorage.getItem('physio_training_blocks');
      if (raw !== null) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.map((b: TrainingBlock) => ({
            ...b,
            targetMultiplier: b.targetMultiplier === 0.75 ? 0.45 : (b.targetMultiplier ?? 0.45),
            maintenanceMultiplier: b.maintenanceMultiplier === 1.35 ? 1.0 : (b.maintenanceMultiplier ?? 1.0)
          }));
        }
      }
    } catch (e) {}
    // Empty state propre : aucun bloc imposé par défaut
    return [];
  });

  // Objectif Compétition / Épreuve cible
  const [targetCompetition, setTargetCompetitionState] = useState<TargetCompetition | null>(() => {
    try {
      const raw = localStorage.getItem('physio_target_competition');
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    // Empty state propre : aucune compétition imposée par défaut
    return null;
  });

  const saveTargetCompetition = (comp: TargetCompetition | null) => {
    setTargetCompetitionState(comp);
    if (!comp) {
      localStorage.removeItem('physio_target_competition');
    } else {
      localStorage.setItem('physio_target_competition', JSON.stringify(comp));
    }
    triggerSyncPush();
  };

  // Constantes physiologiques individuelles (tauFatigue, tauFitness)
  const [physioSettings, setPhysioSettingsState] = useState<PhysiologicalSettings>(() => {
    try {
      const raw = localStorage.getItem('physio_settings');
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return DEFAULT_PHYSIO_SETTINGS;
  });

  const savePhysioSettings = (newSettings: PhysiologicalSettings) => {
    setPhysioSettingsState(newSettings);
    localStorage.setItem('physio_settings', JSON.stringify(newSettings));
    triggerSyncPush();
  };

  // Mode Simulation Prédictive ("What-If")
  const [isSimulationActive, setIsSimulationActive] = useState<boolean>(false);
  const [simulatedEvents, setSimulatedEvents] = useState<Record<string, Record<string, SessionData>>>({});

  const toggleSimulation = (active?: boolean) => {
    setIsSimulationActive(prev => (typeof active === 'boolean' ? active : !prev));
  };

  const addSimulatedEvent = (qId: string, dateStr: string, sessionData: SessionData) => {
    setSimulatedEvents(prev => ({
      ...prev,
      [qId]: {
        ...(prev[qId] || {}),
        [dateStr]: { ...sessionData, isSimulated: true }
      }
    }));
  };

  const removeSimulatedEvent = (qId: string, dateStr: string) => {
    setSimulatedEvents(prev => {
      const next = { ...prev, [qId]: { ...(prev[qId] || {}) } };
      delete next[qId][dateStr];
      return next;
    });
  };

  const clearSimulation = () => {
    setSimulatedEvents({});
  };

  const commitSimulation = () => {
    Object.entries(simulatedEvents).forEach(([qId, dates]) => {
      Object.entries(dates).forEach(([dateStr, sessionData]) => {
        const { isSimulated, ...clean } = sessionData;
        saveEventWithImpacts(qId, dateStr, clean, true);
      });
    });
    setSimulatedEvents({});
    setIsSimulationActive(false);
    triggerSyncPush();
  };

  const applySimulationScenario = (scenarioType: 'tapering' | 'overload' | 'recovery') => {
    const today = new Date();
    const newSim: Record<string, Record<string, SessionData>> = {};
    qualities.forEach(q => (newSim[q.id] = {}));

    // Calibration relative basée sur la charge quotidienne moyenne réelle de l'athlète (28 derniers jours)
    const baseline = getAthleteBaselineDailyLoad(events, 28, today);

    if (scenarioType === 'tapering') {
      // Affûtage Compétition : volume réduit de ~35%, maintien de l'intensité sur rappels toniques ciblés
      const d2 = getLocalYYYYMMDD(new Date(today.getTime() + 2 * 86400000));
      const d5 = getLocalYYYYMMDD(new Date(today.getTime() + 5 * 86400000));
      const d7 = getLocalYYYYMMDD(new Date(today.getTime() + 7 * 86400000));
      const d9 = getLocalYYYYMMDD(new Date(today.getTime() + 9 * 86400000));
      const d12 = getLocalYYYYMMDD(new Date(today.getTime() + 12 * 86400000));

      const scale = Math.max(0.6, Math.min(1.4, baseline.dailyAvg / 350));
      const durVo2 = Math.round(35 * scale);
      const durEf = Math.round(40 * scale);
      const durSprint = Math.max(15, Math.round(20 * scale));
      const durVo2Short = Math.max(20, Math.round(25 * scale));
      const durEfShort = Math.max(20, Math.round(25 * scale));

      newSim['vo2max'] = {
        [d2]: { 
          duration: durVo2, 
          rpeCardio: 8, 
          rpeMusc: 6, 
          load: computeSessionLoad('vo2max', durVo2, 8, 6), 
          isSimulated: true 
        },
        [d9]: { 
          duration: durVo2Short, 
          rpeCardio: 7, 
          rpeMusc: 5, 
          load: computeSessionLoad('vo2max', durVo2Short, 7, 5), 
          isSimulated: true 
        }
      };
      newSim['ef'] = {
        [d5]: { 
          duration: durEf, 
          rpeCardio: 4, 
          rpeMusc: 3, 
          load: computeSessionLoad('ef', durEf, 4, 3), 
          isSimulated: true 
        },
        [d12]: { 
          duration: durEfShort, 
          rpeCardio: 3, 
          rpeMusc: 2, 
          load: computeSessionLoad('ef', durEfShort, 3, 2), 
          isSimulated: true 
        }
      };
      newSim['sprint'] = {
        [d7]: { 
          duration: durSprint, 
          rpeCardio: 7, 
          rpeMusc: 6, 
          load: computeSessionLoad('sprint', durSprint, 7, 6), 
          isSimulated: true 
        }
      };
    } else if (scenarioType === 'overload') {
      // Surcharge de bloc : +30% de charge quotidienne répartie sur 7 jours
      const targetDailyLoad = Math.round(baseline.dailyAvg * 1.3);
      for (let i = 1; i <= 7; i++) {
        const d = getLocalYYYYMMDD(new Date(today.getTime() + i * 86400000));
        const isCardioDay = i % 2 === 0;
        const qId = isCardioDay ? 'seuil' : 'leg';
        const rpeCardio = isCardioDay ? 8 : 6;
        const rpeMusc = isCardioDay ? 6 : 8;
        const effectiveRpe = 8;
        const duration = Math.max(40, Math.min(100, Math.round(targetDailyLoad / effectiveRpe)));
        const load = computeSessionLoad(qId, duration, rpeCardio, rpeMusc);

        newSim[qId] = {
          ...(newSim[qId] || {}),
          [d]: { 
            duration, 
            rpeCardio, 
            rpeMusc, 
            load, 
            isSimulated: true 
          }
        };
      }
    } else if (scenarioType === 'recovery') {
      // Récupération active : séances douces à charge minimale (< 100 UA)
      const d1 = getLocalYYYYMMDD(new Date(today.getTime() + 1 * 86400000));
      const d3 = getLocalYYYYMMDD(new Date(today.getTime() + 3 * 86400000));
      const d5 = getLocalYYYYMMDD(new Date(today.getTime() + 5 * 86400000));

      newSim['proprio'] = {
        [d1]: { duration: 30, rpeCardio: 2, rpeMusc: 2, load: computeSessionLoad('proprio', 30, 2, 2), isSimulated: true },
        [d5]: { duration: 25, rpeCardio: 2, rpeMusc: 2, load: computeSessionLoad('proprio', 25, 2, 2), isSimulated: true }
      };
      newSim['ef'] = {
        [d3]: { duration: 30, rpeCardio: 2, rpeMusc: 2, load: computeSessionLoad('ef', 30, 2, 2), isSimulated: true }
      };
    }

    setSimulatedEvents(newSim);
    setIsSimulationActive(true);
  };


  // Cloud Synchronization for Smartphone ↔ PC Real-Time Sync
  const cloudSyncRef = useRef<any>(null);
  const triggerSyncPush = useCallback(() => {
    cloudSyncRef.current?.triggerDebouncedPush();
  }, []);

  // Callback de purge et réinitialisation atomique des états React (appelé au logout)
  const clearLocalHealthState = useCallback(() => {
    // 1. Réinitialiser les événements de séances à vide
    const emptyEvents: Record<string, Record<string, SessionData>> = {};
    DEFAULT_QUALITIES.forEach(q => (emptyEvents[q.id] = {}));
    setEvents(emptyEvents);

    // 2. Réinitialiser les métriques journalières
    setDailyMetrics({});

    // 3. Réinitialiser les blocs et compétitions
    setTrainingBlocks([]);
    setTargetCompetitionState(null);
    setQualitiesState(DEFAULT_QUALITIES);
    setBlockTemplates(getSavedBlockTemplates());
    setPhysioSettingsState(DEFAULT_PHYSIO_SETTINGS);
    setIsSimulationActive(false);
    setSimulatedEvents({});
    setTombstones({});
    localStorage.removeItem('physio_tombstones');
  }, []);

  const onRemoteDataReceived = useCallback((remoteData: any) => {
    if (!remoteData) return;
    try {
      const imported = migrateData(remoteData);

      // 1. Validation intégrale et sécurisée de l'ensemble du payload distant
      const staged = validateAndStageImportPayload(imported);
      if (!staged.isValid) {
        console.warn('[Cloud Sync] Payload distant rejeté pour non conformité:', staged.error);
        return;
      }

      // 2. FUSION NON DESTRUCTRICE DES SÉANCES (Préserve les séances hors-ligne, propage les suppressions et arbitrages récents)
      setEvents(prevLocalEvents => {
        const incomingRemoteEvents = imported.events ? sanitizeEventsPayload(imported.events) : {};
        const incomingRemoteTombstones = imported.tombstones ? sanitizeTombstonesPayload(imported.tombstones) : {};

        const { merged, hasNewLocalData, mergedTombstones, deletedKeysToPurge } = mergeEventsNonDestructive(
          prevLocalEvents,
          incomingRemoteEvents,
          tombstones,
          incomingRemoteTombstones
        );

        // Mettre à jour l'état et le stockage des tombstones
        setTombstones(mergedTombstones);
        localStorage.setItem('physio_tombstones', JSON.stringify(mergedTombstones));

        // Purger physiquement les séances supprimées du stockage local
        deletedKeysToPurge.forEach(k => {
          localStorage.removeItem(k);
        });

        // Répercuter les séances fusionnées dans le stockage local
        Object.entries(merged).forEach(([qId, dates]) => {
          if (!isSafeId(qId)) return;
          Object.entries(dates).forEach(([date, data]) => {
            if (!isSafeDate(date)) return;
            localStorage.setItem(`${date}_${qId}`, JSON.stringify(data));
          });
        });

        // Si l'athlète avait des séances locales plus complètes créées hors-ligne ou des suppressions à synchroniser,
        // déclencher un push automatique vers le cloud pour consolider la base distante
        if (hasNewLocalData) {
          setTimeout(() => triggerSyncPush(), 1000);
        }

        return merged;
      });

      // 3. FUSION NON DESTRUCTRICE DES MÉTRIQUES JOURNALIÈRES
      setDailyMetrics(prevLocalMetrics => {
        const incomingRemoteMetrics = imported.dailyMetrics ? sanitizeDailyMetricsPayload(imported.dailyMetrics) : {};
        const { merged } = mergeDailyMetricsNonDestructive(prevLocalMetrics, incomingRemoteMetrics);

        Object.entries(merged).forEach(([dateStr, metrics]) => {
          if (!isSafeDate(dateStr)) return;
          Object.entries(metrics).forEach(([type, value]) => {
            if (!['readiness', 'vfc', 'hrRest'].includes(type)) return;
            localStorage.setItem(`${dateStr}_${type}`, String(value));
          });
        });

        return merged;
      });

      // 4. APPLICATION VALIDÉE DES BLOCS, QUALITÉS, COMPÉTITION ET RÉGLAGES
      const stagedEntries = staged.entriesToSet;

      if (stagedEntries.has('physio_training_blocks')) {
        const val = JSON.parse(stagedEntries.get('physio_training_blocks')!);
        setTrainingBlocks(val);
        localStorage.setItem('physio_training_blocks', JSON.stringify(val));
      }

      if (stagedEntries.has('physio_qualities')) {
        const val = JSON.parse(stagedEntries.get('physio_qualities')!);
        setQualitiesState(val);
        localStorage.setItem('physio_qualities', JSON.stringify(val));
      }

      if (stagedEntries.has('physio_block_templates')) {
        const val = JSON.parse(stagedEntries.get('physio_block_templates')!);
        setBlockTemplates(val);
        localStorage.setItem('physio_block_templates', JSON.stringify(val));
      }

      if (stagedEntries.has('physio_target_competition')) {
        const val = JSON.parse(stagedEntries.get('physio_target_competition')!);
        setTargetCompetitionState(val);
        localStorage.setItem('physio_target_competition', JSON.stringify(val));
      } else if (imported.targetCompetition === null) {
        setTargetCompetitionState(null);
        localStorage.removeItem('physio_target_competition');
      }

      if (stagedEntries.has('physio_settings')) {
        const val = JSON.parse(stagedEntries.get('physio_settings')!);
        setPhysioSettingsState(val);
        localStorage.setItem('physio_settings', JSON.stringify(val));
      }

      if (stagedEntries.has('physio_custom_exercises')) {
        const val = stagedEntries.get('physio_custom_exercises')!;
        localStorage.setItem('physio_custom_exercises', val);
      }
    } catch (e) {
      console.error('[Cloud Sync] Error applying remote data:', e);
    }
  }, [triggerSyncPush]);

  const getExportableData = useCallback(() => {
    return {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      events,
      dailyMetrics,
      trainingBlocks,
      qualities,
      blockTemplates,
      targetCompetition,
      physioSettings,
      customExercises: getSavedCustomExercises(),
      tombstones,
      updatedAt: new Date().toISOString(),
    };
  }, [events, dailyMetrics, trainingBlocks, qualities, blockTemplates, targetCompetition, physioSettings, tombstones]);

  const cloudSync = useCloudSync({
    onRemoteDataReceived,
    getExportableData,
    onClearLocalHealthData: clearLocalHealthState,
  });
  cloudSyncRef.current = cloudSync;

  // Événements effectifs : fusionne les séances réelles et simulées,
  // puis calcule dynamiquement à la lecture tous les impacts secondaires rémanents via computeDerivedEvents
  const effectiveEvents = useMemo(() => {
    const basePrimary: Record<string, Record<string, SessionData>> = {};
    qualities.forEach(q => {
      basePrimary[q.id] = { ...(events[q.id] || {}) };
      if (isSimulationActive && simulatedEvents[q.id]) {
        Object.assign(basePrimary[q.id], simulatedEvents[q.id]);
      }
    });
    return computeDerivedEvents(basePrimary, qualities as any) as Record<string, Record<string, SessionData>>;
  }, [events, simulatedEvents, isSimulationActive, qualities]);

  // Calcul dynamique et réactif des courbes EMA (3, 7, 21 jours)
  const qualitiesEMA = useMemo<QualitiesEMAMap>(() => {
    return computeAllQualitiesEMA(qualities, effectiveEvents, 45, isSimulationActive ? 14 : 0) as QualitiesEMAMap;
  }, [qualities, effectiveEvents, isSimulationActive]);

  // Modèle Banister prédictif (couvre la projection de simulation ou de compétition)
  const banisterPerformance = useMemo(() => {
    let futureDays = isSimulationActive ? 14 : 7;
    if (targetCompetition?.date) {
      const today = new Date();
      const [ty, tm, td] = targetCompetition.date.split('-').map(Number);
      const compDate = new Date(ty, tm - 1, td);
      const daysRemaining = Math.ceil((compDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
      futureDays = Math.max(futureDays, Math.min(180, Math.max(0, daysRemaining) + 3));
    }

    return computeBanisterPerformance(
      effectiveEvents, 
      dailyMetrics, 
      30, 
      futureDays,
      physioSettings.tauFatigue,
      physioSettings.tauFitness,
      physioSettings.initialCtl
    );
  }, [effectiveEvents, dailyMetrics, isSimulationActive, physioSettings, targetCompetition]);

  // Métriques de Foster (Monotonie & Strain)
  const fosterMetrics = useMemo(() => {
    return computeFosterMetrics(effectiveEvents);
  }, [effectiveEvents]);

  // Analyse d'affûtage & Compétition (réutilise directement le calcul Banister existant)
  const taperingAnalysis = useMemo(() => {
    return getTaperingAnalysis(
      targetCompetition, 
      effectiveEvents, 
      dailyMetrics,
      physioSettings.tauFatigue,
      physioSettings.tauFitness,
      physioSettings.initialCtl,
      banisterPerformance
    );
  }, [targetCompetition, effectiveEvents, dailyMetrics, physioSettings, banisterPerformance]);

  // Synthèse hebdomadaire mémoïsée (-6 semaines passées à +2 semaines futures)
  const allWeeksStats = useMemo<WeekStats[]>(() => {
    return computeAllWeeksStats(effectiveEvents, qualities, 6, 2);
  }, [effectiveEvents, qualities]);

  const currentWeekStats = useMemo<WeekStats | undefined>(() => {
    return allWeeksStats.find(w => w.isCurrentWeek) || allWeeksStats[allWeeksStats.length - 1];
  }, [allWeeksStats]);

  // Balance de charge (Cardio vs Musculaire, Dual-Tau, Excentrique)
  const cardioMuscularBalance = useMemo(() => {
    return computeCardioVsMuscularBalance(effectiveEvents);
  }, [effectiveEvents]);

  // Distribution d'intensité selon Stephen Seiler (Polarisation Z1 / Z2 / Z3)
  const intensityDistribution = useMemo(() => {
    return computeIntensityDistribution(effectiveEvents, qualities as any);
  }, [effectiveEvents, qualities]);

  // Analyse de la fatigue perçue & tolérance à l'effort (Charge / Réponse)
  const perceivedFatigueAnalysis = useMemo(() => {
    return computePerceivedFatigueAnalysis(effectiveEvents);
  }, [effectiveEvents]);

  // Helper pour récupérer l'historique EMA d'une qualité sur une durée personnalisée
  const getQualityEMA = (qualityId: string, daysHistory: number = 45): QualityEMAData => {
    return computeQualityEMAData(qualityId, effectiveEvents[qualityId] || {}, daysHistory, isSimulationActive ? 14 : 0) as QualityEMAData;
  };

  const saveEvent = (qId: string, dateStr: string, sessionData: SessionData | null) => {
    const key = `${dateStr}_${qId}`;
    if (!sessionData) {
      localStorage.removeItem(key);
      setEvents(prev => {
        const updated = { ...prev, [qId]: { ...prev[qId] } };
        delete updated[qId][dateStr];
        return updated;
      });
      // Enregistrer une tombstone de suppression pour propager la suppression aux autres appareils
      const now = Date.now();
      const updatedTombstones = saveTombstone(key, now);
      setTombstones(updatedTombstones);
    } else {
      const now = Date.now();
      const sessionWithTimestamp: SessionData = {
        ...sessionData,
        updatedAt: sessionData.updatedAt || now
      };
      localStorage.setItem(key, JSON.stringify(sessionWithTimestamp));
      setEvents(prev => ({
        ...prev,
        [qId]: { ...prev[qId], [dateStr]: sessionWithTimestamp }
      }));
      // Retirer toute tombstone antérieure pour cette séance recréée ou éditée
      const updatedTombstones = removeTombstone(key);
      setTombstones(updatedTombstones);
    }
    triggerSyncPush();
  };

  const saveDailyMetric = (dateStr: string, type: 'readiness' | 'vfc' | string, score: string | number | null) => {
    const key = `${dateStr}_${type}`;
    if (score === null || score === undefined || score === '') {
      localStorage.removeItem(key);
      setDailyMetrics(prev => {
        const updated = { ...prev, [dateStr]: { ...prev[dateStr] } };
        if (updated[dateStr]) delete updated[dateStr][type];
        return updated;
      });
    } else {
      const numVal = parseInt(String(score), 10);
      localStorage.setItem(key, String(numVal));
      setDailyMetrics(prev => ({ 
        ...prev, 
        [dateStr]: { ...prev[dateStr], [type]: numVal } 
      }));
    }
    triggerSyncPush();
  };

  const saveTrainingBlock = (block: TrainingBlock) => {
    setTrainingBlocks(prev => {
      const idx = prev.findIndex(b => b.id === block.id);
      let updated: TrainingBlock[];
      if (idx >= 0) {
        updated = [...prev];
        updated[idx] = block;
      } else {
        updated = [...prev, block];
      }
      localStorage.setItem('physio_training_blocks', JSON.stringify(updated));
      return updated;
    });
    triggerSyncPush();
  };

  const deleteTrainingBlock = (blockId: string) => {
    setTrainingBlocks(prev => {
      const updated = prev.filter(b => b.id !== blockId);
      localStorage.setItem('physio_training_blocks', JSON.stringify(updated));
      return updated;
    });
    triggerSyncPush();
  };

  const activeBlockToday = useMemo(() => {
    const todayStr = getLocalYYYYMMDD(new Date());
    return getActiveBlockForDate(todayStr, trainingBlocks);
  }, [trainingBlocks]);

  const setQualities = (newQualities: Quality[]) => {
    setQualitiesState(newQualities);
    localStorage.setItem('physio_qualities', JSON.stringify(newQualities));
    triggerSyncPush();
  };

  const moveQuality = (qId: string, direction: 'up' | 'down') => {
    setQualitiesState(prev => {
      const idx = prev.findIndex(q => q.id === qId);
      if (idx < 0) return prev;
      if (direction === 'up' && idx === 0) return prev;
      if (direction === 'down' && idx === prev.length - 1) return prev;

      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      const next = [...prev];
      const item = next[idx];
      next[idx] = next[targetIdx];
      next[targetIdx] = item;
      localStorage.setItem('physio_qualities', JSON.stringify(next));
      return next;
    });
    triggerSyncPush();
  };

  const moveQualityToTop = (qId: string) => {
    setQualitiesState(prev => {
      const idx = prev.findIndex(q => q.id === qId);
      if (idx <= 0) return prev;
      const next = [...prev];
      const [item] = next.splice(idx, 1);
      next.unshift(item);
      localStorage.setItem('physio_qualities', JSON.stringify(next));
      return next;
    });
    triggerSyncPush();
  };

  const reorderQualities = (sourceId: string, targetId: string, position: 'before' | 'after' = 'before') => {
    if (!sourceId || !targetId || sourceId === targetId) return;
    setQualitiesState(prev => {
      const sourceIndex = prev.findIndex(q => q.id === sourceId);
      if (sourceIndex === -1) return prev;

      const next = [...prev];
      const [movedItem] = next.splice(sourceIndex, 1);

      const targetIndex = next.findIndex(q => q.id === targetId);
      if (targetIndex === -1) return prev;

      const insertIndex = position === 'after' ? targetIndex + 1 : targetIndex;
      next.splice(insertIndex, 0, movedItem);

      localStorage.setItem('physio_qualities', JSON.stringify(next));
      return next;
    });
    triggerSyncPush();
  };

  const moveQualityToIndex = (sourceIndex: number, targetIndex: number) => {
    if (sourceIndex === targetIndex) return;
    setQualitiesState(prev => {
      if (sourceIndex < 0 || sourceIndex >= prev.length || targetIndex < 0 || targetIndex >= prev.length) return prev;
      const next = [...prev];
      const [movedItem] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, movedItem);
      localStorage.setItem('physio_qualities', JSON.stringify(next));
      return next;
    });
    triggerSyncPush();
  };

  const reorderByBlockFocus = (block?: TrainingBlock | null) => {
    const targetBlock = block || activeBlockToday;
    if (!targetBlock || !targetBlock.focusQualities) return;
    setQualitiesState(prev => {
      const next = reorderQualitiesForBlock(prev, targetBlock.focusQualities);
      localStorage.setItem('physio_qualities', JSON.stringify(next));
      return next;
    });
    triggerSyncPush();
  };

  const resetQualitiesOrder = () => {
    setQualities(DEFAULT_QUALITIES);
  };

  const saveBlockTemplate = (template: BlockTemplate) => {
    setBlockTemplates(prev => {
      const idx = prev.findIndex(t => t.id === template.id);
      let updated: BlockTemplate[];
      if (idx >= 0) {
        updated = [...prev];
        updated[idx] = template;
      } else {
        updated = [...prev, template];
      }
      saveBlockTemplates(updated);
      return updated;
    });
    triggerSyncPush();
  };

  const resetBlockTemplates = () => {
    localStorage.removeItem('physio_block_templates');
    const defaults = getSavedBlockTemplates();
    setBlockTemplates(defaults);
    triggerSyncPush();
  };

  const trainingRecommendations = useMemo<TrainingRecommendation[]>(() => {
    return getTrainingRecommendations(qualities, effectiveEvents, dailyMetrics, activeBlockToday);
  }, [qualities, effectiveEvents, dailyMetrics, activeBlockToday]);

  const reorderByUrgency = () => {
    const sortedIds = trainingRecommendations.map(r => r.quality.id);
    setQualitiesState(prev => {
      const next = [...prev].sort((a, b) => sortedIds.indexOf(a.id) - sortedIds.indexOf(b.id));
      localStorage.setItem('physio_qualities', JSON.stringify(next));
      return next;
    });
    triggerSyncPush();
  };

  const exportData = () => {
    const data = { 
      schemaVersion: CURRENT_SCHEMA_VERSION,
      events, 
      dailyMetrics, 
      trainingBlocks,
      qualities,
      blockTemplates,
      targetCompetition,
      physioSettings,
      customExercises: getSavedCustomExercises(),
      tombstones,
      exportDate: new Date().toISOString() 
    };
    // Export compact sans indentation inutile : divise le volume par deux et garantit une réimportation fluide
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `physiotracker_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importData = (
    event: ChangeEvent<HTMLInputElement>,
    onSuccess?: () => void,
    onError?: (errorMsg: string) => void
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const inputElement = event.target;

    // 1. Plafond de taille de lecture : 1 Mo (permet de charger d'anciennes sauvegardes indentées avec null, 2)
    const MAX_FILE_SIZE_BYTES = 1024 * 1024; // 1 Mo
    if (file.size > MAX_FILE_SIZE_BYTES) {
      inputElement.value = '';
      const sizeKo = (file.size / 1024).toFixed(0);
      const msg = `Fichier trop volumineux (${sizeKo} Ko). La limite maximale autorisée est de 1 Mo.`;
      console.warn('[Import Security]', msg);
      if (onError) onError(msg);
      return;
    }

    // 2. Validation stricte du type de fichier
    if (!file.name.toLowerCase().endsWith('.json') && file.type && !file.type.includes('json')) {
      inputElement.value = '';
      const msg = 'Format invalide : seuls les fichiers de sauvegarde .json sont acceptés.';
      console.warn('[Import Security]', msg);
      if (onError) onError(msg);
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => {
      inputElement.value = '';
      const msg = 'Impossible de lire le fichier sélectionné.';
      if (onError) onError(msg);
    };

    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        if (!content || typeof content !== 'string') {
          throw new Error('Fichier de sauvegarde vide ou illisible');
        }

        let rawImported: any;
        try {
          rawImported = JSON.parse(content);
        } catch {
          throw new Error('Structure JSON corrompue : syntaxe invalide.');
        }

        if (!rawImported || typeof rawImported !== 'object' || Array.isArray(rawImported)) {
          throw new Error('Structure JSON invalide : objet attendu.');
        }

        // Vérification de la taille minifiée réelle (Firestore limite le document à 500 000 caractères)
        const minifiedSize = JSON.stringify(rawImported).length;
        if (minifiedSize > 500000) {
          throw new Error(`Le volume de données minifié (${(minifiedSize / 1024).toFixed(0)} Ko) dépasse le plafond Firestore de 500 000 caractères.`);
        }

        // 3. Migration descendante / ascendante en mémoire
        const migrated = migrateData(rawImported);

        // 4. VALIDATION TRANSACTIONNELLE STRICTE EN MÉMOIRE (Pattern Tout-ou-Rien)
        // Aucune clé locale n'est altérée ou supprimée tant que l'ensemble du payload n'est pas validé.
        const staged = validateAndStageImportPayload(migrated);
        if (!staged.isValid || staged.entriesToSet.size === 0) {
          throw new Error(staged.error || 'Aucune donnée valide trouvée dans la sauvegarde.');
        }

        // 5. COMMIT ATOMIQUE : Remplacement sans destruction des identifiants système ni des exercices personnalisés
        const savedDeviceId = localStorage.getItem('physio_device_id');
        const savedUserAccount = localStorage.getItem('physio_user_account');
        const savedGymDraft = localStorage.getItem('training_live_session_draft_v1');
        const savedCustomExercises = localStorage.getItem('physio_custom_exercises');

        // Identifier et purger UNIQUEMENT les anciennes données de séances/métriques sans écraser les exercices personnalisés
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (!key) continue;
          if (
            /^\d{4}-\d{2}-\d{2}_/.test(key) || 
            (key.startsWith('physio_') && 
             key !== 'physio_device_id' && 
             key !== 'physio_user_account' && 
             key !== 'physio_custom_exercises')
          ) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));

        // Écriture atomique du lot validé
        staged.entriesToSet.forEach((value, key) => {
          localStorage.setItem(key, value);
        });

        // Restauration garantie des clés système et préservation des exercices personnalisés si non fournis dans l'import
        if (savedDeviceId) localStorage.setItem('physio_device_id', savedDeviceId);
        if (savedUserAccount) localStorage.setItem('physio_user_account', savedUserAccount);
        if (savedGymDraft) localStorage.setItem('training_live_session_draft_v1', savedGymDraft);
        if (savedCustomExercises && !staged.entriesToSet.has('physio_custom_exercises')) {
          localStorage.setItem('physio_custom_exercises', savedCustomExercises);
        }

        inputElement.value = '';
        if (onSuccess) onSuccess();

        // Rechargement propre pour hydrater immédiatement tous les contextes et hooks
        window.location.reload();
      } catch (err: any) {
        inputElement.value = '';
        const msg = err?.message || 'Erreur lors du décodage du fichier JSON';
        console.error('Import error:', err);
        if (onError) onError(msg);
      }
    };
    reader.readAsText(file);
  };

  const saveEventWithImpacts = (qId: string, dateStr: string, sessionData: SessionData | null, _applyImpacts: boolean = true) => {
    // 1. Sauvegarder ou supprimer la séance directe de l'athlète
    if (!sessionData) {
      saveEvent(qId, dateStr, null);
    } else {
      const isCardio = ['vo2max', 'seuil', 'ef', 'co2', 'gut'].includes(qId);
      const normalizedSport = sessionData.sport || (isCardio ? 'run' : 'muscu');
      const normalizedSession: SessionData = {
        ...sessionData,
        sport: normalizedSport,
        isSecondary: false
      };
      saveEvent(qId, dateStr, normalizedSession);
    }
    // Note d'architecture : Les impacts secondaires ne sont plus persistés sur disque ni synchronisés.
    // Ils sont dérivés dynamiquement et instantanément à la lecture par computeDerivedEvents dans effectiveEvents,
    // garantissant une cohérence absolue même lors de modifications de la matrice d'impacts,
    // tout en divisant la taille du payload de synchronisation Firestore par 5 à 7.
  };

  return { 
    events: effectiveEvents, 
    rawEvents: events,
    qualities, 
    setQualities,
    moveQuality,
    moveQualityToTop,
    reorderQualities,
    moveQualityToIndex,
    reorderByBlockFocus,
    reorderByUrgency,
    resetQualitiesOrder,
    dailyMetrics, 
    trainingBlocks,
    activeBlockToday,
    saveTrainingBlock,
    deleteTrainingBlock,
    blockTemplates,
    saveBlockTemplate,
    resetBlockTemplates,
    trainingRecommendations,
    qualitiesEMA,
    getQualityEMA,
    saveEvent, 
    saveEventWithImpacts, 
    saveDailyMetric, 
    exportData, 
    importData,
    // Constantes physiologiques
    physioSettings,
    savePhysioSettings,
    // Compétition & Tapering
    targetCompetition,
    saveTargetCompetition,
    fosterMetrics,
    taperingAnalysis,
    banisterPerformance,
    // Modélisation physiologique avancée
    cardioMuscularBalance,
    intensityDistribution,
    perceivedFatigueAnalysis,
    // Mode Simulation (What-If)
    isSimulationActive,
    simulatedEvents,
    toggleSimulation,
    addSimulatedEvent,
    removeSimulatedEvent,
    applySimulationScenario,
    clearSimulation,
    commitSimulation,
    // Synchronisation Cloud Smartphone ↔ PC
    cloudSync,
    // Synthèse hebdomadaire mémoïsée unique
    allWeeksStats,
    currentWeekStats
  };
}
