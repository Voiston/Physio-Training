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
    onPushSync?.();
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

  return {
    dailyMetrics,
    setDailyMetrics,
    saveDailyMetric,
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
    perceivedFatigueAnalysis
  };
}

export default useMetricsState;
