import { useState, useEffect, useMemo, useCallback, useRef, ChangeEvent } from 'react';
import { usePersistentState } from './usePersistentState';
import { useCloudSync } from './useCloudSync';
import { useBlocksState, type TrainingBlock } from './useBlocksState';
import { useSimulationState } from './useSimulationState';
import { 
  useMetricsState, 
  type DailyMetrics, 
  DEFAULT_PHYSIO_SETTINGS 
} from './useMetricsState';

export type { BlockTemplate, TrainingBlock } from './useBlocksState';
export type { DailyMetrics, PhysiologicalSettings, TargetCompetition } from './useMetricsState';
export { DEFAULT_PHYSIO_SETTINGS } from './useMetricsState';

import { 
  DEFAULT_QUALITIES, 
  computeAllQualitiesEMA, 
  computeQualityEMAData,
  reorderQualitiesForBlock,
  getTrainingRecommendations,
  getSavedBlockTemplates,
  computeDerivedEvents
} from '../utils/physiology';
import { getLocalYYYYMMDD } from '../utils/dateHelpers';
import { computeAllWeeksStats, WeekStats } from '../utils/weekHelpers';

import { CURRENT_SCHEMA_VERSION, migrateData, migrateLocalStorage } from '../utils/migration';
import { isCardioQuality } from '../utils/qualities';
import { getSavedCustomExercises } from '../utils/muscleHelpers';
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

import type {
  Quality,
  TrainingRecommendation,
  SessionData,
  QualityEMAData,
  QualitiesEMAMap
} from '../types';
export type {
  QualityImpact,
  Quality,
  TrainingRecommendation,
  SecondaryContribution,
  SubSession,
  SessionData,
  QualityEMASeriesPoint,
  QualityEMAData,
  QualitiesEMAMap
} from '../types';




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
  } catch (err) { console.warn('[data] Lecture des séances locales impossible', err); }
  return loadedEvents;
}




export function useData() {
  const [events, setEvents] = useState<Record<string, Record<string, SessionData>>>(() => getInitialEvents());
  const [tombstones, setTombstones] = useState<Record<string, number>>(() => getSavedTombstones());
  const tombstonesRef = useRef(tombstones);
  useEffect(() => {
    tombstonesRef.current = tombstones;
  }, [tombstones]);

  const [qualities, setQualitiesState] = usePersistentState<Quality[]>('physio_qualities', () => {
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
    } catch (e) { console.warn('[data] Qualités locales illisibles, valeurs par défaut', e); }
    return DEFAULT_QUALITIES;
  });
  // Cloud Synchronization for Smartphone ↔ PC Real-Time Sync
  const cloudSyncRef = useRef<any>(null);
  const triggerSyncPush = useCallback(() => {
    cloudSyncRef.current?.triggerDebouncedPush();
  }, []);

  // Sous-hook 1 : Blocs et modèles de périodisation
  const {
    trainingBlocks,
    setTrainingBlocks,
    activeBlockToday,
    saveTrainingBlock,
    deleteTrainingBlock,
    blockTemplates,
    setBlockTemplates,
    saveBlockTemplate,
    resetBlockTemplates
  } = useBlocksState({ onPushSync: triggerSyncPush });

  // Sous-hook 2 : Simulation prédictive ("What-If")
  const {
    isSimulationActive,
    setIsSimulationActive,
    simulatedEvents,
    setSimulatedEvents,
    toggleSimulation,
    addSimulatedEvent,
    removeSimulatedEvent,
    clearSimulation,
    commitSimulation: commitSimulationInternal,
    applySimulationScenario: applySimulationScenarioInternal
  } = useSimulationState({ onPushSync: triggerSyncPush });

  // Gestion des événements directs (séances réelles)
  const saveEvent = useCallback((qId: string, dateStr: string, sessionData: SessionData | null) => {
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
  }, [triggerSyncPush]);

  const saveEventWithImpacts = useCallback((qId: string, dateStr: string, sessionData: SessionData | null, _applyImpacts: boolean = true) => {
    if (!sessionData) {
      saveEvent(qId, dateStr, null);
    } else {
      const isCardio = isCardioQuality(qId, qualities);
      const normalizedSport = sessionData.sport || (isCardio ? 'run' : 'muscu');
      const normalizedSession: SessionData = {
        ...sessionData,
        sport: normalizedSport,
        isSecondary: false
      };
      saveEvent(qId, dateStr, normalizedSession);
    }
  }, [qualities, saveEvent]);

  const commitSimulation = useCallback(() => {
    commitSimulationInternal(saveEventWithImpacts);
  }, [commitSimulationInternal, saveEventWithImpacts]);

  const applySimulationScenario = useCallback((scenarioType: 'tapering' | 'overload' | 'recovery') => {
    applySimulationScenarioInternal(scenarioType, qualities, events);
  }, [applySimulationScenarioInternal, qualities, events]);

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

  // Sous-hook 3 : Métriques journalières, paramètres physiologiques, objectifs et calculs Banister/Foster
  const {
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
  } = useMetricsState(effectiveEvents, qualities, isSimulationActive, { onPushSync: triggerSyncPush });


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
      let needPush = false;
      let newMergedTombstones: Record<string, number> | null = null;
      let keysToDelete: string[] = [];
      let sessionsToSave: Record<string, Record<string, SessionData>> = {};

      setEvents(prevLocalEvents => {
        const incomingRemoteEvents = imported.events ? sanitizeEventsPayload(imported.events) : {};
        const incomingRemoteTombstones = imported.tombstones ? sanitizeTombstonesPayload(imported.tombstones) : {};

        const { merged, hasNewLocalData, mergedTombstones, deletedKeysToPurge } = mergeEventsNonDestructive(
          prevLocalEvents,
          incomingRemoteEvents,
          tombstonesRef.current,
          incomingRemoteTombstones
        );

        newMergedTombstones = mergedTombstones;
        keysToDelete = deletedKeysToPurge;
        sessionsToSave = merged;
        if (hasNewLocalData) needPush = true;

        return merged;
      });

      // Effets de bord exécutés en dehors du reducer (pureté React 19)
      if (newMergedTombstones) {
        setTombstones(newMergedTombstones);
        localStorage.setItem('physio_tombstones', JSON.stringify(newMergedTombstones));
      }
      keysToDelete.forEach(k => {
        localStorage.removeItem(k);
      });
      Object.entries(sessionsToSave).forEach(([qId, dates]) => {
        if (!isSafeId(qId)) return;
        Object.entries(dates).forEach(([date, data]) => {
          if (!isSafeDate(date)) return;
          localStorage.setItem(`${date}_${qId}`, JSON.stringify(data));
        });
      });
      if (needPush) {
        setTimeout(() => triggerSyncPush(), 1000);
      }

      // 3. FUSION NON DESTRUCTRICE DES MÉTRIQUES JOURNALIÈRES
      let metricsToPersist: Record<string, DailyMetrics> = {};
      setDailyMetrics(prevLocalMetrics => {
        const incomingRemoteMetrics = imported.dailyMetrics ? sanitizeDailyMetricsPayload(imported.dailyMetrics) : {};
        const { merged } = mergeDailyMetricsNonDestructive(prevLocalMetrics, incomingRemoteMetrics);
        metricsToPersist = merged;
        return merged;
      });

      Object.entries(metricsToPersist).forEach(([dateStr, metrics]) => {
        if (!isSafeDate(dateStr)) return;
        Object.entries(metrics).forEach(([type, value]) => {
          if (!['readiness', 'vfc', 'hrRest'].includes(type)) return;
          localStorage.setItem(`${dateStr}_${type}`, String(value));
        });
      });

      // 4. APPLICATION VALIDÉE DES BLOCS, QUALITÉS, COMPÉTITION ET RÉGLAGES
      const stagedEntries = staged.entriesToSet;

      if (stagedEntries.has('physio_training_blocks')) {
        const val = JSON.parse(stagedEntries.get('physio_training_blocks')!);
        setTrainingBlocks(val);
      }

      if (stagedEntries.has('physio_qualities')) {
        const val = JSON.parse(stagedEntries.get('physio_qualities')!);
        setQualitiesState(val);
      }

      if (stagedEntries.has('physio_block_templates')) {
        const val = JSON.parse(stagedEntries.get('physio_block_templates')!);
        setBlockTemplates(val);
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
  // Calcul dynamique et réactif des courbes EMA (3, 7, 21 jours)
  const qualitiesEMA = useMemo<QualitiesEMAMap>(() => {
    return computeAllQualitiesEMA(qualities, effectiveEvents, 45, isSimulationActive ? 14 : 0) as QualitiesEMAMap;
  }, [qualities, effectiveEvents, isSimulationActive]);

  // Synthèse hebdomadaire mémoïsée (-6 semaines passées à +2 semaines futures)
  const allWeeksStats = useMemo<WeekStats[]>(() => {
    return computeAllWeeksStats(effectiveEvents, qualities, 6, 2);
  }, [effectiveEvents, qualities]);

  const currentWeekStats = useMemo<WeekStats | undefined>(() => {
    return allWeeksStats.find(w => w.isCurrentWeek) || allWeeksStats[allWeeksStats.length - 1];
  }, [allWeeksStats]);

  // Helper pour récupérer l'historique EMA d'une qualité sur une durée personnalisée
  const getQualityEMA = (qualityId: string, daysHistory: number = 45): QualityEMAData => {
    return computeQualityEMAData(qualityId, effectiveEvents[qualityId] || {}, daysHistory, isSimulationActive ? 14 : 0) as QualityEMAData;
  };


  const setQualities = (newQualities: Quality[]) => {
    setQualitiesState(newQualities);
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
      return next;
    });
    triggerSyncPush();
  };

  const reorderByBlockFocus = (block?: TrainingBlock | null) => {
    const targetBlock = block || activeBlockToday;
    if (!targetBlock || !targetBlock.focusQualities) return;
    setQualitiesState(prev => {
      return reorderQualitiesForBlock(prev, targetBlock.focusQualities);
    });
    triggerSyncPush();
  };

  const resetQualitiesOrder = () => {
    setQualities(DEFAULT_QUALITIES);
  };

  const trainingRecommendations = useMemo<TrainingRecommendation[]>(() => {
    return getTrainingRecommendations(qualities, effectiveEvents, dailyMetrics, activeBlockToday);
  }, [qualities, effectiveEvents, dailyMetrics, activeBlockToday]);

  const reorderByUrgency = () => {
    const sortedIds = trainingRecommendations.map(r => r.quality.id);
    setQualitiesState(prev => {
      return [...prev].sort((a, b) => sortedIds.indexOf(a.id) - sortedIds.indexOf(b.id));
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
    a.download = `physiotracker_${getLocalYYYYMMDD(new Date())}.json`;
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
