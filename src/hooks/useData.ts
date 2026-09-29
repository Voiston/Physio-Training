import { useState, useEffect, useMemo, ChangeEvent } from 'react';
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
  getQualityImpacts
} from '../utils/physiology';
import { getLocalYYYYMMDD } from '../utils/dateHelpers';

export interface QualityImpact {
  id: string;
  ratio: number;
}

export interface Quality {
  id: string;
  name: string;
  g: number;
  o: number;
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
  targetTime?: string;
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
  sport?: 'run' | 'bike' | string;
  isEccentric?: boolean;
  isSecondary?: boolean;
  parentQId?: string;
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
}

export const DEFAULT_PHYSIO_SETTINGS: PhysiologicalSettings = {
  tauFatigue: 7,
  tauFitness: 28,
  profileName: 'Standard'
};

export function useData() {
  const [events, setEvents] = useState<Record<string, Record<string, SessionData>>>({});
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
              ...q,
              g: def.g,
              o: def.o,
              impacts: def.impacts || q.impacts
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

  const [dailyMetrics, setDailyMetrics] = useState<Record<string, DailyMetrics>>({}); // Stores VFC, Readiness
  
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
    const today = new Date();
    const todayStr = getLocalYYYYMMDD(today);
    const initialBlock: TrainingBlock = {
      id: 'block_default_force',
      name: 'Force max',
      type: 'force_max',
      startDate: todayStr,
      endDate: computeBlockEndDate(todayStr, 4),
      durationWeeks: 4,
      focusQualities: ['pull', 'push', 'leg', 'abdos', 'descente'],
      targetMultiplier: 0.45,
      maintenanceMultiplier: 1.0,
      notes: 'Bloc de force max : fréquence de développement sur la musculation (x0.45, 2-3 séances/semaine) et maintien nominal pour le cardio.'
    };
    return [initialBlock];
  });

  // Objectif Compétition / Épreuve cible
  const [targetCompetition, setTargetCompetitionState] = useState<TargetCompetition | null>(() => {
    try {
      const raw = localStorage.getItem('physio_target_competition');
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    const today = new Date();
    const d14 = new Date(today);
    d14.setDate(today.getDate() + 14);
    return {
      name: 'Course Objectif / Compétition',
      date: getLocalYYYYMMDD(d14),
      type: 'course',
      targetTsb: 18,
      notes: 'Pic de forme visé (TSB entre +15 et +22) avec fraîcheur neuromusculaire.'
    };
  });

  const saveTargetCompetition = (comp: TargetCompetition | null) => {
    setTargetCompetitionState(comp);
    if (!comp) {
      localStorage.removeItem('physio_target_competition');
    } else {
      localStorage.setItem('physio_target_competition', JSON.stringify(comp));
    }
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

  useEffect(() => {
    const loadedEvents: Record<string, Record<string, SessionData>> = {};
    qualities.forEach(q => (loadedEvents[q.id] = {}));
    const loadedMetrics: Record<string, DailyMetrics> = {};

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || key === 'physio_qualities' || key === 'physio_target_competition') continue;
      
      const match = key.match(/^(\d{4}-\d{2}-\d{2})_(.+)$/);
      if (match) {
        const dateStr = match[1];
        const category = match[2];
        try {
          const rawItem = localStorage.getItem(key);
          if (!rawItem) continue;
          const parsed = JSON.parse(rawItem);
          if (category === 'readiness' || category === 'vfc' || category === 'hrRest') {
            if (!loadedMetrics[dateStr]) loadedMetrics[dateStr] = {};
            loadedMetrics[dateStr][category] = Number(parsed);
          } else if (loadedEvents[category] !== undefined) {
            loadedEvents[category][dateStr] = parsed;
          }
        } catch (e) {
          const rawVal = localStorage.getItem(key);
          if (category === 'readiness' || category === 'vfc' || category === 'hrRest') {
            if (!loadedMetrics[dateStr]) loadedMetrics[dateStr] = {};
            loadedMetrics[dateStr][category] = parseInt(rawVal || '0', 10);
          } else if (loadedEvents[category] !== undefined) {
            loadedEvents[category][dateStr] = { load: parseInt(rawVal || '0', 10) * 5 };
          }
        }
      }
    }
    setEvents(loadedEvents);
    setDailyMetrics(loadedMetrics);
  }, [qualities]);

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
      physioSettings.tauFitness
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
      physioSettings.tauFitness
    );
  }, [targetCompetition, effectiveEvents, dailyMetrics, physioSettings]);

  // Balance TRIMP Multi-Facteurs (Cardio vs Musculaire vs Excentrique)
  const cardioMuscularBalance = useMemo(() => {
    return computeCardioVsMuscularBalance(effectiveEvents);
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
  };

  const deleteTrainingBlock = (blockId: string) => {
    setTrainingBlocks(prev => {
      const updated = prev.filter(b => b.id !== blockId);
      localStorage.setItem('physio_training_blocks', JSON.stringify(updated));
      return updated;
    });
  };

  const activeBlockToday = useMemo(() => {
    const todayStr = getLocalYYYYMMDD(new Date());
    return getActiveBlockForDate(todayStr, trainingBlocks);
  }, [trainingBlocks]);

  const setQualities = (newQualities: Quality[]) => {
    setQualitiesState(newQualities);
    localStorage.setItem('physio_qualities', JSON.stringify(newQualities));
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
  };

  const reorderByBlockFocus = (block?: TrainingBlock | null) => {
    const targetBlock = block || activeBlockToday;
    if (!targetBlock || !targetBlock.focusQualities) return;
    setQualitiesState(prev => {
      const next = reorderQualitiesForBlock(prev, targetBlock.focusQualities);
      localStorage.setItem('physio_qualities', JSON.stringify(next));
      return next;
    });
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
  };

  const resetBlockTemplates = () => {
    localStorage.removeItem('physio_block_templates');
    const defaults = getSavedBlockTemplates();
    setBlockTemplates(defaults);
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
  };

  const exportData = () => {
    const data = { 
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

  const importData = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const imported = JSON.parse(content);
        if (imported.events) {
          localStorage.clear();
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
          window.location.reload();
        }
      } catch (err) {
        alert("Erreur lors de l'import du fichier.");
      }
    };
    reader.readAsText(file);
  };

  const saveEventWithImpacts = (qId: string, dateStr: string, sessionData: SessionData | null, applyImpacts: boolean = true) => {
    // 1. Toujours nettoyer les anciens impacts secondaires générés par cette qualité sur cette date
    qualities.forEach(q => {
      if (q.id === qId) return;
      const key = `${dateStr}_${q.id}`;
      const raw = localStorage.getItem(key);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed.isSecondary && parsed.parentQId === qId) {
            saveEvent(q.id, dateStr, null);
          }
        } catch (e) {}
      }
    });

    if (!sessionData) {
      saveEvent(qId, dateStr, null);
    } else {
      saveEvent(qId, dateStr, sessionData);

      if (applyImpacts) {
        const impacts = getQualityImpacts(qId, sessionData.sport || 'run', qualities as any) as QualityImpact[];
        if (impacts && impacts.length > 0) {
          impacts.forEach(imp => {
            const calculatedSecLoad = Math.round(sessionData.load * imp.ratio);
            const secCardio = sessionData.loadCardio !== undefined ? Math.round(sessionData.loadCardio * imp.ratio) : undefined;
            const secMusc = sessionData.loadMusc !== undefined ? Math.round(sessionData.loadMusc * imp.ratio) : undefined;
            const secData: SessionData = {
              ...sessionData,
              load: calculatedSecLoad,
              loadCardio: secCardio,
              loadMusc: secMusc,
              isSecondary: true,
              parentQId: qId,
              originalLoad: sessionData.load
            };
            saveEvent(imp.id, dateStr, secData);
          });
        }
      }
    }
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
    // TRIMP Multi-Facteurs (Cardio vs Musculaire)
    cardioMuscularBalance,
    // Mode Simulation (What-If)
    isSimulationActive,
    simulatedEvents,
    toggleSimulation,
    addSimulatedEvent,
    removeSimulatedEvent,
    applySimulationScenario,
    clearSimulation,
    commitSimulation
  };
}
