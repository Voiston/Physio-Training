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
  computePerceivedFatigueAnalysis
} from '../utils/physiology';
import { getLocalYYYYMMDD } from '../utils/dateHelpers';

import { CURRENT_SCHEMA_VERSION, migrateData, migrateLocalStorage } from '../utils/migration';
import { isPrimary } from '../utils/loadHelpers';
import { SessionExercise, getSavedCustomExercises } from '../utils/muscleHelpers';

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
  parentQId?: string;
  parentContributions?: Record<string, SecondaryContribution>;
  originalLoad?: number;
  isSimulated?: boolean;
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
  DEFAULT_QUALITIES.forEach(q => (loadedEvents[q.id] = {}));
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || key === 'physio_qualities' || key === 'physio_target_competition') continue;
      const match = key.match(/^(\d{4}-\d{2}-\d{2})_(.+)$/);
      if (match) {
        const dateStr = match[1];
        const category = match[2];
        if (category === 'readiness' || category === 'vfc' || category === 'hrRest') continue;
        try {
          const rawItem = localStorage.getItem(key);
          if (!rawItem) continue;
          const parsed = JSON.parse(rawItem);
          if (!loadedEvents[category]) loadedEvents[category] = {};
          loadedEvents[category][dateStr] = parsed;
        } catch {
          const rawVal = localStorage.getItem(key);
          if (!loadedEvents[category]) loadedEvents[category] = {};
          loadedEvents[category][dateStr] = { load: parseInt(rawVal || '0', 10) * 5 };
        }
      }
    }
  } catch {}
  return loadedEvents;
}

function getInitialDailyMetrics(): Record<string, DailyMetrics> {
  const loadedMetrics: Record<string, DailyMetrics> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      const match = key.match(/^(\d{4}-\d{2}-\d{2})_(.+)$/);
      if (match) {
        const dateStr = match[1];
        const category = match[2];
        if (category === 'readiness' || category === 'vfc' || category === 'hrRest') {
          try {
            const rawItem = localStorage.getItem(key);
            if (!rawItem) continue;
            if (!loadedMetrics[dateStr]) loadedMetrics[dateStr] = {};
            loadedMetrics[dateStr][category] = Number(JSON.parse(rawItem));
          } catch {
            const rawVal = localStorage.getItem(key);
            if (!loadedMetrics[dateStr]) loadedMetrics[dateStr] = {};
            loadedMetrics[dateStr][category] = parseInt(rawVal || '0', 10);
          }
        }
      }
    }
  } catch {}
  return loadedMetrics;
}

export function useData() {
  const [events, setEvents] = useState<Record<string, Record<string, SessionData>>>(() => getInitialEvents());
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
        saveEventWithImpacts(qId, dateStr, sessionData, false);
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

    if (scenarioType === 'tapering') {
      // Affûtage : J+2 séance rappel haute intensité (ex: VO2max court), J+5 séance rappel tonique, J+9 séance très courte de dynamisme, volume global divisé par 2
      const d2 = getLocalYYYYMMDD(new Date(today.getTime() + 2 * 86400000));
      const d5 = getLocalYYYYMMDD(new Date(today.getTime() + 5 * 86400000));
      const d7 = getLocalYYYYMMDD(new Date(today.getTime() + 7 * 86400000));
      const d9 = getLocalYYYYMMDD(new Date(today.getTime() + 9 * 86400000));
      const d12 = getLocalYYYYMMDD(new Date(today.getTime() + 12 * 86400000));

      newSim['vo2max'] = {
        [d2]: { duration: 35, rpeCardio: 8, rpeMusc: 6, load: 245, isSimulated: true },
        [d9]: { duration: 25, rpeCardio: 7, rpeMusc: 5, load: 150, isSimulated: true }
      };
      newSim['ef'] = {
        [d5]: { duration: 40, rpeCardio: 4, rpeMusc: 3, load: 140, isSimulated: true },
        [d12]: { duration: 25, rpeCardio: 3, rpeMusc: 2, load: 60, isSimulated: true }
      };
      newSim['sprint'] = {
        [d7]: { duration: 20, rpeCardio: 7, rpeMusc: 6, load: 130, isSimulated: true }
      };
    } else if (scenarioType === 'overload') {
      // Surcharge de bloc : séances fortes quotidiennes sur 7 jours
      for (let i = 1; i <= 7; i++) {
        const d = getLocalYYYYMMDD(new Date(today.getTime() + i * 86400000));
        const qId = i % 2 === 0 ? 'seuil' : 'leg';
        newSim[qId] = {
          ...(newSim[qId] || {}),
          [d]: { duration: 75, rpeCardio: 8, rpeMusc: 8, load: 600, isSimulated: true }
        };
      }
    } else if (scenarioType === 'recovery') {
      // Récupération active : 7 jours très doux
      for (let i = 1; i <= 6; i += 2) {
        const d = getLocalYYYYMMDD(new Date(today.getTime() + i * 86400000));
        newSim['proprio'] = {
          ...(newSim['proprio'] || {}),
          [d]: { duration: 30, rpeCardio: 2, rpeMusc: 2, load: 60, isSimulated: true }
        };
      }
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
  }, []);

  const onRemoteDataReceived = useCallback((remoteData: any) => {
    if (!remoteData) return;
    try {
      const imported = migrateData(remoteData);

      // SÉCURITÉ : Nettoyer les clés de dates existantes pour éviter que des séances
      // orphelines d'un profil précédent ne polluent les données du nouvel utilisateur
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && /^\d{4}-\d{2}-\d{2}_/.test(key)) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));
      } catch (err) {
        console.warn('Erreur lors du nettoyage préalable des clés de séances:', err);
      }

      if (imported.events) {
        setEvents(imported.events);
        Object.entries(imported.events as Record<string, Record<string, SessionData>>).forEach(([qId, dates]) => {
          Object.entries(dates).forEach(([date, data]) => {
            localStorage.setItem(`${date}_${qId}`, JSON.stringify(data));
          });
        });
      }
      if (imported.dailyMetrics) {
        setDailyMetrics(imported.dailyMetrics);
        Object.entries(imported.dailyMetrics as Record<string, Record<string, number>>).forEach(([dateStr, metrics]) => {
          Object.entries(metrics).forEach(([type, value]) => {
            localStorage.setItem(`${dateStr}_${type}`, String(value));
          });
        });
      }
      if (imported.trainingBlocks) {
        setTrainingBlocks(imported.trainingBlocks);
        localStorage.setItem('physio_training_blocks', JSON.stringify(imported.trainingBlocks));
      }
      if (imported.qualities) {
        setQualitiesState(imported.qualities);
        localStorage.setItem('physio_qualities', JSON.stringify(imported.qualities));
      }
      if (imported.blockTemplates) {
        setBlockTemplates(imported.blockTemplates);
        localStorage.setItem('physio_block_templates', JSON.stringify(imported.blockTemplates));
      }
      if (imported.targetCompetition !== undefined) {
        setTargetCompetitionState(imported.targetCompetition);
        if (imported.targetCompetition) {
          localStorage.setItem('physio_target_competition', JSON.stringify(imported.targetCompetition));
        } else {
          localStorage.removeItem('physio_target_competition');
        }
      }
      if (imported.physioSettings) {
        setPhysioSettingsState(imported.physioSettings);
        localStorage.setItem('physio_settings', JSON.stringify(imported.physioSettings));
      }
      if (Array.isArray(imported.customExercises)) {
        localStorage.setItem('physio_custom_exercises', JSON.stringify(imported.customExercises));
      }
    } catch (e) {
      console.error('Error applying remote data:', e);
    }
  }, []);

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
      updatedAt: new Date().toISOString(),
    };
  }, [events, dailyMetrics, trainingBlocks, qualities, blockTemplates, targetCompetition, physioSettings]);

  const cloudSync = useCloudSync({
    onRemoteDataReceived,
    getExportableData,
    onClearLocalHealthData: clearLocalHealthState,
  });
  cloudSyncRef.current = cloudSync;

  // Événements effectifs (réels ou fusionnés avec la simulation si active)
  const effectiveEvents = useMemo(() => {
    if (!isSimulationActive) return events;
    const merged: Record<string, Record<string, SessionData>> = {};
    qualities.forEach(q => {
      merged[q.id] = { ...(events[q.id] || {}) };
      if (simulatedEvents[q.id]) {
        Object.assign(merged[q.id], simulatedEvents[q.id]);
      }
    });
    return merged;
  }, [events, simulatedEvents, isSimulationActive, qualities]);

  // Calcul dynamique et réactif des courbes EMA (3, 7, 21 jours)
  const qualitiesEMA = useMemo<QualitiesEMAMap>(() => {
    return computeAllQualitiesEMA(qualities, effectiveEvents, 45, isSimulationActive ? 14 : 0) as QualitiesEMAMap;
  }, [qualities, effectiveEvents, isSimulationActive]);

  // Modèle Banister prédictif
  const banisterPerformance = useMemo(() => {
    return computeBanisterPerformance(
      effectiveEvents, 
      dailyMetrics, 
      30, 
      isSimulationActive ? 14 : 7,
      physioSettings.tauFatigue,
      physioSettings.tauFitness,
      physioSettings.initialCtl
    );
  }, [effectiveEvents, dailyMetrics, isSimulationActive, physioSettings]);

  // Métriques de Foster (Monotonie & Strain)
  const fosterMetrics = useMemo(() => {
    return computeFosterMetrics(effectiveEvents);
  }, [effectiveEvents]);

  // Analyse d'affûtage & Compétition
  const taperingAnalysis = useMemo(() => {
    return getTaperingAnalysis(
      targetCompetition, 
      effectiveEvents, 
      dailyMetrics,
      physioSettings.tauFatigue,
      physioSettings.tauFitness,
      physioSettings.initialCtl
    );
  }, [targetCompetition, effectiveEvents, dailyMetrics, physioSettings]);

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
    } else {
      localStorage.setItem(key, JSON.stringify(sessionData));
      setEvents(prev => ({
        ...prev,
        [qId]: { ...prev[qId], [dateStr]: sessionData }
      }));
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
      exportDate: new Date().toISOString() 
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
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

    // 1. Validation de la taille maximale (max 5 Mo pour prévenir tout déni de service / gel du navigateur)
    const MAX_FILE_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      inputElement.value = '';
      const msg = `Fichier trop volumineux (${(file.size / (1024 * 1024)).toFixed(1)} Mo). Limite autorisée : 5 Mo.`;
      console.warn('[Import Security]', msg);
      if (onError) onError(msg);
      return;
    }

    // 2. Validation du type de fichier
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
          throw new Error('Fichier vide ou illisible');
        }

        const rawImported = JSON.parse(content);
        if (!rawImported || typeof rawImported !== 'object') {
          throw new Error('Structure JSON non valide');
        }

        const imported = migrateData(rawImported);
        if (imported.events) {
          // Préservation des clés système (appairage device, session compte Google et brouillon en cours)
          const savedDeviceId = localStorage.getItem('physio_device_id');
          const savedUserAccount = localStorage.getItem('physio_user_account');
          const savedGymDraft = localStorage.getItem('training_live_session_draft_v1');

          localStorage.clear();

          // Restauration immédiate des identifiants système et de session
          if (savedDeviceId) localStorage.setItem('physio_device_id', savedDeviceId);
          if (savedUserAccount) localStorage.setItem('physio_user_account', savedUserAccount);
          if (savedGymDraft) localStorage.setItem('training_live_session_draft_v1', savedGymDraft);

          Object.entries(imported.events as Record<string, Record<string, SessionData>>).forEach(([qId, dates]) => {
            Object.entries(dates).forEach(([date, data]) => {
              localStorage.setItem(`${date}_${qId}`, JSON.stringify(data));
            });
          });
          if (imported.dailyMetrics) {
            Object.entries(imported.dailyMetrics as Record<string, Record<string, number>>).forEach(([dateStr, metrics]) => {
              Object.entries(metrics).forEach(([type, value]) => {
                localStorage.setItem(`${dateStr}_${type}`, String(value));
              });
            });
          }
          if (imported.trainingBlocks) {
            localStorage.setItem('physio_training_blocks', JSON.stringify(imported.trainingBlocks));
          }
          if (imported.qualities) {
            localStorage.setItem('physio_qualities', JSON.stringify(imported.qualities));
          }
          if (imported.blockTemplates) {
            localStorage.setItem('physio_block_templates', JSON.stringify(imported.blockTemplates));
          }
          if (imported.targetCompetition) {
            localStorage.setItem('physio_target_competition', JSON.stringify(imported.targetCompetition));
          }
          if (imported.physioSettings) {
            localStorage.setItem('physio_settings', JSON.stringify(imported.physioSettings));
          }
          if (Array.isArray(imported.customExercises)) {
            localStorage.setItem('physio_custom_exercises', JSON.stringify(imported.customExercises));
          }

          if (onSuccess) onSuccess();
          window.location.reload();
        } else {
          throw new Error('Aucune donnée valide trouvée dans la sauvegarde');
        }
      } catch (err: any) {
        inputElement.value = '';
        const msg = err?.message || 'Erreur lors du décodage du fichier JSON';
        console.error('Import error:', err);
        if (onError) onError(msg);
      }
    };
    reader.readAsText(file);
  };

  const saveEventWithImpacts = (qId: string, dateStr: string, sessionData: SessionData | null, applyImpacts: boolean = true) => {
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

    if (!applyImpacts) return;

    // 2. Recenser toutes les séances directes/principales de l'athlète sur cette date
    const primarySessionsOnDate: { qId: string; session: SessionData }[] = [];
    qualities.forEach(q => {
      if (q.id === qId) {
        if (sessionData) {
          const isCardio = ['vo2max', 'seuil', 'ef', 'co2', 'gut'].includes(qId);
          primarySessionsOnDate.push({
            qId: q.id,
            session: {
              ...sessionData,
              sport: sessionData.sport || (isCardio ? 'run' : 'muscu'),
              isSecondary: false
            }
          });
        }
      } else {
        const raw = localStorage.getItem(`${dateStr}_${q.id}`);
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (parsed && isPrimary(parsed)) {
              primarySessionsOnDate.push({ qId: q.id, session: parsed });
            }
          } catch (e) {}
        }
      }
    });

    const primaryQIds = new Set(primarySessionsOnDate.map(p => p.qId));

    // 3. Pour chaque qualité qui n'est PAS occupée par une séance directe :
    qualities.forEach(targetQ => {
      // RÈGLE CRITIQUE D'INTÉGRITÉ 1 : Ne JAMAIS écraser une séance principale existante
      if (primaryQIds.has(targetQ.id)) return;

      // Calculer le cumul multi-parents de tous les impacts ciblant targetQ
      const contributions: Record<string, SecondaryContribution> = {};
      let totalSecLoad = 0;
      let totalSecCardio = 0;
      let totalSecMusc = 0;

      primarySessionsOnDate.forEach(({ qId: parentId, session: parentSession }) => {
        const parentSport = parentSession.sport || (['vo2max', 'seuil', 'ef', 'co2', 'gut'].includes(parentId) ? 'run' : 'muscu');
        const parentImpacts = getQualityImpacts(parentId, parentSport, qualities as any) as QualityImpact[];
        const imp = parentImpacts?.find(i => i.id === targetQ.id);

        if (imp && imp.ratio > 0) {
          const pLoad = Number(parentSession.load) || 0;
          const pCardio = parentSession.loadCardio !== undefined ? Number(parentSession.loadCardio) : pLoad;
          const pMusc = parentSession.loadMusc !== undefined ? Number(parentSession.loadMusc) : pLoad;

          const calculatedSecLoad = Math.round(pLoad * imp.ratio);
          const calculatedSecCardio = Math.round(pCardio * imp.ratio);
          const calculatedSecMusc = Math.round(pMusc * imp.ratio);

          if (calculatedSecLoad > 0) {
            contributions[parentId] = {
              load: calculatedSecLoad,
              loadCardio: calculatedSecCardio,
              loadMusc: calculatedSecMusc,
              ratio: imp.ratio,
              parentName: qualities.find(q => q.id === parentId)?.name || parentId
            };
            totalSecLoad += calculatedSecLoad;
            totalSecCardio += calculatedSecCardio;
            totalSecMusc += calculatedSecMusc;
          }
        }
      });

      const existingRaw = localStorage.getItem(`${dateStr}_${targetQ.id}`);
      let existingSession: any = null;
      if (existingRaw) {
        try { existingSession = JSON.parse(existingRaw); } catch (e) {}
      }

      if (totalSecLoad > 0) {
        const isTargetCardio = ['vo2max', 'seuil', 'ef', 'co2', 'gut'].includes(targetQ.id);
        const secData: SessionData = {
          load: totalSecLoad,
          loadCardio: totalSecCardio,
          loadMusc: totalSecMusc,
          isSecondary: true,
          sport: isTargetCardio ? 'run' : 'muscu',
          duration: 0,
          rpeMusc: 0,
          rpeCardio: 0,
          parentContributions: contributions,
          parentQId: Object.keys(contributions)[0],
          originalLoad: totalSecLoad
        };
        saveEvent(targetQ.id, dateStr, secData);
      } else if (existingSession && !isPrimary(existingSession)) {
        // Plus aucun impact parent et séance secondaire présente : suppression propre
        saveEvent(targetQ.id, dateStr, null);
      }
    });
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
    cloudSync
  };
}
