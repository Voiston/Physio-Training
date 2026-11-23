import { useState, useMemo } from 'react';
import { usePersistentState } from './usePersistentState';
import { 
  computeFosterMetrics, 
  computeBanisterPerformance, 
  getTaperingAnalysis, 
  computeCardioVsMuscularBalance, 
  computeIntensityDistribution, 
  computePerceivedFatigueAnalysis 
} from '../utils/physiology';
import {
  computeDualBanister,
  detectTrainingInterference,
  computeDailyBriefing,
  computeStrengthProgression,
} from '../utils/hybridIntelligence';
import type { Quality, SessionData } from './useData';

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

export interface TargetCompetition {
  name: string;
  date: string;
  type: string;
  targetTsb: number;
  targetTsbUnit?: 'percent' | 'points' | string;
  targetTime?: string;
  notes?: string;
}

export interface UseMetricsStateOptions {
  onPushSync?: () => void;
}

export function getInitialDailyMetrics(): Record<string, DailyMetrics> {
  const loadedMetrics: Record<string, DailyMetrics> = {};
  if (typeof localStorage === 'undefined') return loadedMetrics;
  const ALLOWED_METRICS = new Set(['readiness', 'vfc', 'hrRest']);

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      const match = key.match(/^(\d{4}-\d{2}-\d{2})_(.+)$/);
      if (match) {
        const dateStr = match[1];
        const metricType = match[2];
        if (ALLOWED_METRICS.has(metricType)) {
          const val = localStorage.getItem(key);
          if (val !== null) {
            const numVal = parseInt(val, 10);
            if (!Number.isNaN(numVal)) {
              if (!loadedMetrics[dateStr]) loadedMetrics[dateStr] = {};
              loadedMetrics[dateStr][metricType] = numVal;
            }
          }
        }
      }
    }
  } catch (err) { console.warn('[metrics] Lecture des métriques journalières impossible', err); }
  return loadedMetrics;
}

/**
 * Sous-hook gérant les métriques journalières (VFC, RHR, Sommeil), 
 * les paramètres physiologiques, les objectifs compétitifs et les calculs Banister/Foster.
 */
export function useMetricsState(
  effectiveEvents: Record<string, Record<string, SessionData>>,
  qualities: Quality[],
  isSimulationActive: boolean,
  options: UseMetricsStateOptions = {}
) {
  const { onPushSync } = options;

  const [dailyMetrics, setDailyMetrics] = useState<Record<string, DailyMetrics>>(() => getInitialDailyMetrics());

  // Objectif Compétition / Épreuve cible
  const [targetCompetition, setTargetCompetitionState] = useState<TargetCompetition | null>(() => {
    try {
      const raw = localStorage.getItem('physio_target_competition');
      if (raw) return JSON.parse(raw);
    } catch (err) { console.warn('[metrics] Objectif compétition illisible, ignoré', err); }
    return null;
  });

  const saveTargetCompetition = (comp: TargetCompetition | null) => {
    setTargetCompetitionState(comp);
    if (!comp) {
      localStorage.removeItem('physio_target_competition');
    } else {
      localStorage.setItem('physio_target_competition', JSON.stringify(comp));
    }
    onPushSync?.();
  };

  // Constantes physiologiques individuelles (tauFatigue, tauFitness)
  const [physioSettings, setPhysioSettingsState] = usePersistentState<PhysiologicalSettings>('physio_settings', () => {
    try {
      const raw = localStorage.getItem('physio_settings');
      if (raw) return JSON.parse(raw);
    } catch (err) { console.warn('[metrics] Paramètres physio illisibles, valeurs par défaut', err); }
    return DEFAULT_PHYSIO_SETTINGS;
  });

  const savePhysioSettings = (newSettings: PhysiologicalSettings) => {
    setPhysioSettingsState(newSettings);
    onPushSync?.();
  };

  const AUTO_METRICS_KEY = 'physio_intervals_auto_metrics';

  const readAutoMetricKeys = (): Set<string> => {
    try {
      const raw = localStorage.getItem(AUTO_METRICS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return new Set(parsed.filter((k): k is string => typeof k === 'string'));
        }
      }
    } catch {
      // Ignore corrupted local marker
    }
    return new Set();
  };

  const writeAutoMetricKeys = (keys: Set<string>) => {
    try {
      localStorage.setItem(AUTO_METRICS_KEY, JSON.stringify(Array.from(keys).slice(-600)));
    } catch {
      // Ignore quota errors
    }
  };

  const saveDailyMetric = (
    dateStr: string,
    type: 'readiness' | 'vfc' | 'hrRest' | string,
    score: string | number | null,
    saveOptions?: { source?: 'manual' | 'garmin' }
  ) => {
    const key = `${dateStr}_${type}`;
    const autoKeys = readAutoMetricKeys();

    if (score === null || score === undefined || score === '') {
      localStorage.removeItem(key);
      autoKeys.delete(key);
      writeAutoMetricKeys(autoKeys);
      setDailyMetrics(prev => {
        const updated = { ...prev, [dateStr]: { ...prev[dateStr] } };
        if (updated[dateStr]) delete updated[dateStr][type];
        return updated;
      });
    } else {
      const numVal = parseInt(String(score), 10);
      localStorage.setItem(key, String(numVal));
      if (saveOptions?.source === 'garmin') {
        autoKeys.add(key);
      } else {
        // Une saisie manuelle protège définitivement cette cellule contre les futurs imports auto Garmin
        autoKeys.delete(key);
      }
      writeAutoMetricKeys(autoKeys);
      setDailyMetrics(prev => ({ 
        ...prev, 
        [dateStr]: { ...prev[dateStr], [type]: numVal } 
      }));
    }
    onPushSync?.();
  };

  /**
   * Import silencieux et non destructif d'un lot de métriques quotidiennes Garmin / Intervals.icu.
   * Ne modifie jamais une valeur déjà saisie manuellement par l'utilisateur.
   */
  const applyGarminWellnessBatch = (
    entries: Array<{ dateStr: string; vfc?: number; hrRest?: number; readiness?: number }>
  ): {
    updatedCount: number;
    latestDate?: string;
    latestValues?: { vfc?: number; hrRest?: number; readiness?: number };
  } => {
    if (!Array.isArray(entries) || entries.length === 0) {
      return { updatedCount: 0 };
    }

    const autoKeys = readAutoMetricKeys();
    const updatesToApply: Array<{ dateStr: string; metric: 'vfc' | 'hrRest' | 'readiness'; value: number }> = [];

    for (const entry of entries) {
      const existingDay = dailyMetrics[entry.dateStr] || {};
      const fields: Array<['vfc' | 'hrRest' | 'readiness', number | undefined]> = [
        ['vfc', entry.vfc],
        ['hrRest', entry.hrRest],
        ['readiness', entry.readiness],
      ];

      for (const [metric, incomingVal] of fields) {
        if (incomingVal === undefined || !Number.isFinite(incomingVal)) continue;
        const storageKey = `${entry.dateStr}_${metric}`;
        const currentVal = existingDay[metric];
        const canOverwrite = currentVal === undefined || autoKeys.has(storageKey);

        if (canOverwrite && currentVal !== incomingVal) {
          updatesToApply.push({ dateStr: entry.dateStr, metric, value: incomingVal });
          autoKeys.add(storageKey);
        }
      }
    }

    if (updatesToApply.length === 0) {
      return { updatedCount: 0 };
    }

    // Persister en localStorage et mettre à jour React en un seul lot atomique
    updatesToApply.forEach(({ dateStr, metric, value }) => {
      localStorage.setItem(`${dateStr}_${metric}`, String(value));
    });
    writeAutoMetricKeys(autoKeys);

    setDailyMetrics(prev => {
      const next = { ...prev };
      updatesToApply.forEach(({ dateStr, metric, value }) => {
        next[dateStr] = { ...(next[dateStr] || {}), [metric]: value };
      });
      return next;
    });

    onPushSync?.();

    const sortedDates = Array.from(new Set(updatesToApply.map(u => u.dateStr))).sort();
    const latestDate = sortedDates[sortedDates.length - 1];
    const latestEntry = entries.find(e => e.dateStr === latestDate);

    return {
      updatedCount: updatesToApply.length,
      latestDate,
      latestValues: latestEntry
        ? {
            vfc: latestEntry.vfc,
            hrRest: latestEntry.hrRest,
            readiness: latestEntry.readiness,
          }
        : undefined,
    };
  };

  // Modèle Banister prédictif
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

  // Analyse d'affûtage & Compétition
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

  // Balance de charge (Cardio vs Musculaire)
  const cardioMuscularBalance = useMemo(() => {
    return computeCardioVsMuscularBalance(effectiveEvents);
  }, [effectiveEvents]);

  // Distribution d'intensité selon Stephen Seiler (Polarisation Z1 / Z2 / Z3)
  const intensityDistribution = useMemo(() => {
    return computeIntensityDistribution(effectiveEvents, qualities);
  }, [effectiveEvents, qualities]);

  // Analyse de la fatigue perçue & tolérance à l'effort
  const perceivedFatigueAnalysis = useMemo(() => {
    return computePerceivedFatigueAnalysis(effectiveEvents);
  }, [effectiveEvents]);

  // Dual-Banister hybride (Cardio/Central vs Musculaire/Périphérique + D+)
  const dualBanister = useMemo(() => {
    return computeDualBanister(
      effectiveEvents,
      qualities,
      30,
      isSimulationActive ? 14 : 7,
      physioSettings.tauFatigue,
      physioSettings.tauFitness
    );
  }, [effectiveEvents, qualities, isSimulationActive, physioSettings.tauFatigue, physioSettings.tauFitness]);

  // Détecteur d'interférences concurrentes (Force bas du corps vs Intensité / Plyo 0–48h)
  const interferenceAnalysis = useMemo(() => {
    return detectTrainingInterference(effectiveEvents, qualities);
  }, [effectiveEvents, qualities]);

  // Briefing "Aujourd'hui en 5 secondes" (Feu tricolore + 4 signaux + conseil)
  const dailyBriefing = useMemo(() => {
    return computeDailyBriefing({
      dailyMetrics,
      dualBanister,
      interference: interferenceAnalysis,
    });
  }, [dailyMetrics, dualBanister, interferenceAnalysis]);

  // Progression Force longitudinale (e1RM ajusté RIR + PRs)
  const strengthProgression = useMemo(() => {
    return computeStrengthProgression(effectiveEvents);
  }, [effectiveEvents]);

  return {
    dailyMetrics,
    setDailyMetrics,
    saveDailyMetric,
    applyGarminWellnessBatch,
    physioSettings,
    setPhysioSettingsState,
    savePhysioSettings,
    targetCompetition,
    setTargetCompetitionState,
    saveTargetCompetition,
    banisterPerformance,
    fosterMetrics,
    taperingAnalysis,
    cardioMuscularBalance,
    intensityDistribution,
    perceivedFatigueAnalysis,
    dualBanister,
    interferenceAnalysis,
    dailyBriefing,
    strengthProgression,
  };
}

export default useMetricsState;
