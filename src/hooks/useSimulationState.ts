import { useState } from 'react';
import { getLocalYYYYMMDD, addDays } from '../utils/dateHelpers';
import { computeSessionLoad, getAthleteBaselineDailyLoad } from '../utils/loadHelpers';
import type { Quality, SessionData } from './useData';

export interface UseSimulationStateOptions {
  onPushSync?: () => void;
}

/**
 * Sous-hook gérant l'état et les scénarios de simulation prédictive ("What-If").
 */
export function useSimulationState(options: UseSimulationStateOptions = {}) {
  const { onPushSync } = options;

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

  const commitSimulation = (
    saveEventWithImpacts: (qId: string, dateStr: string, sessionData: SessionData | null, applyImpacts?: boolean) => void
  ) => {
    Object.entries(simulatedEvents).forEach(([qId, dates]) => {
      Object.entries(dates).forEach(([dateStr, sessionData]) => {
        const { isSimulated, ...clean } = sessionData;
        saveEventWithImpacts(qId, dateStr, clean, true);
      });
    });
    setSimulatedEvents({});
    setIsSimulationActive(false);
    onPushSync?.();
  };

  const applySimulationScenario = (
    scenarioType: 'tapering' | 'overload' | 'recovery',
    qualities: Quality[],
    events: Record<string, Record<string, SessionData>>
  ) => {
    const today = new Date();
    const newSim: Record<string, Record<string, SessionData>> = {};
    qualities.forEach(q => (newSim[q.id] = {}));

    // Calibration relative basée sur la charge quotidienne moyenne réelle de l'athlète (28 derniers jours)
    const baseline = getAthleteBaselineDailyLoad(events, 28, today);

    if (scenarioType === 'tapering') {
      // Affûtage Compétition : volume réduit de ~35%, maintien de l'intensité sur rappels toniques ciblés
      const d2 = getLocalYYYYMMDD(addDays(today, 2));
      const d5 = getLocalYYYYMMDD(addDays(today, 5));
      const d7 = getLocalYYYYMMDD(addDays(today, 7));
      const d9 = getLocalYYYYMMDD(addDays(today, 9));
      const d12 = getLocalYYYYMMDD(addDays(today, 12));

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
        const d = getLocalYYYYMMDD(addDays(today, i));
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
      const d1 = getLocalYYYYMMDD(addDays(today, 1));
      const d3 = getLocalYYYYMMDD(addDays(today, 3));
      const d5 = getLocalYYYYMMDD(addDays(today, 5));

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

  return {
    isSimulationActive,
    setIsSimulationActive,
    simulatedEvents,
    setSimulatedEvents,
    toggleSimulation,
    addSimulatedEvent,
    removeSimulatedEvent,
    clearSimulation,
    commitSimulation,
    applySimulationScenario
  };
}

export default useSimulationState;
