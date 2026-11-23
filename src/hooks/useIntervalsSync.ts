import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { User } from 'firebase/auth';
import type { Quality, SessionData } from '../types';
import type { TrainingBlock } from './useBlocksState';
import { addDays, getLocalYYYYMMDD } from '../utils/dateHelpers';
import {
  normalizeIntervalsWellness,
  classifyIntervalsActivity,
  buildSessionFromGarminActivity,
  type IntervalsWellnessEntry,
  type IntervalsActivityEntry,
  type PendingGarminActivity,
} from '../utils/intervalsMapper';

export interface AutoMetricsImportSummary {
  updatedCount: number;
  latestDate?: string;
  latestValues?: { vfc?: number; hrRest?: number; readiness?: number };
}

export interface ActivityOverride {
  qualityId?: string;
  rpeCardio?: number;
  rpeMusc?: number;
}

export interface UseIntervalsSyncOptions {
  currentUser: User | null;
  qualities: Quality[];
  rawEvents: Record<string, Record<string, SessionData>>;
  activeBlockToday: TrainingBlock | null;
  intervalsProcessedIds: string[];
  markIntervalsIdsProcessed: (ids: string[]) => void;
  clearIntervalsProcessedIds: () => void;
  saveEventWithImpacts: (
    qId: string,
    dateStr: string,
    sessionData: SessionData | null,
    applyImpacts?: boolean
  ) => void;
  applyGarminWellnessBatch: (
    entries: Array<{ dateStr: string; vfc?: number; hrRest?: number; readiness?: number }>
  ) => AutoMetricsImportSummary;
  isPaused?: boolean;
  onAutoMetricsImported?: (summary: AutoMetricsImportSummary) => void;
}

export type IntervalsConnectionState =
  | 'checking'
  | 'unconfigured'
  | 'auth_required'
  | 'ready'
  | 'syncing'
  | 'offline'
  | 'error';

const AUTO_SYNC_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes entre deux syncs automatiques

export function useIntervalsSync({
  currentUser,
  qualities,
  rawEvents,
  activeBlockToday,
  intervalsProcessedIds,
  markIntervalsIdsProcessed,
  clearIntervalsProcessedIds,
  saveEventWithImpacts,
  applyGarminWellnessBatch,
  isPaused = false,
  onAutoMetricsImported,
}: UseIntervalsSyncOptions) {
  const [isConfigured, setIsConfigured] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [athleteName, setAthleteName] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [lastMetricsSummary, setLastMetricsSummary] = useState<AutoMetricsImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rawActivities, setRawActivities] = useState<IntervalsActivityEntry[]>([]);

  const lastAutoSyncTimestampRef = useRef<number>(0);
  const isSyncingRef = useRef<boolean>(false);
  const applyWellnessRef = useRef(applyGarminWellnessBatch);
  const onAutoMetricsRef = useRef(onAutoMetricsImported);

  useEffect(() => {
    applyWellnessRef.current = applyGarminWellnessBatch;
  }, [applyGarminWellnessBatch]);

  useEffect(() => {
    onAutoMetricsRef.current = onAutoMetricsImported;
  }, [onAutoMetricsImported]);

  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    if (!currentUser) return {};
    try {
      const token = await currentUser.getIdToken();
      return token ? { Authorization: `Bearer ${token}` } : {};
    } catch {
      return {};
    }
  }, [currentUser]);

  const checkStatus = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setIsCheckingStatus(false);
      return { configured: isConfigured, connected: false };
    }

    setIsCheckingStatus(true);
    try {
      const headers = await getAuthHeaders();
      const resp = await fetch('/api/intervals/status', {
        headers,
        cache: 'no-store',
      });
      if (!resp.ok) {
        setIsCheckingStatus(false);
        return { configured: false, connected: false };
      }

      const data = (await resp.json()) as {
        configured?: boolean;
        authenticated?: boolean;
        connected?: boolean;
        athleteName?: string;
        error?: string;
      };

      const configured = Boolean(data.configured);
      const connected = Boolean(data.connected);
      setIsConfigured(configured);
      setIsConnected(connected);
      setAthleteName(data.athleteName || null);
      setError(data.error || null);
      setIsCheckingStatus(false);
      return { configured, connected };
    } catch {
      setIsCheckingStatus(false);
      return { configured: false, connected: false };
    }
  }, [getAuthHeaders, isConfigured]);

  const syncNow = useCallback(
    async (
      daysBack: number = 14,
      options?: { silent?: boolean }
    ): Promise<{
      ok: boolean;
      metricsUpdated: number;
      newActivitiesCount: number;
      error?: string;
    }> => {
      if (isSyncingRef.current) {
        return { ok: false, metricsUpdated: 0, newActivitiesCount: 0 };
      }
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        const msg = 'Appareil hors-ligne : synchronisation Garmin mise en pause.';
        if (!options?.silent) setError(msg);
        return { ok: false, metricsUpdated: 0, newActivitiesCount: 0, error: msg };
      }
      if (!currentUser) {
        const msg = 'Connectez votre compte Google pour synchroniser Garmin.';
        if (!options?.silent) setError(msg);
        return { ok: false, metricsUpdated: 0, newActivitiesCount: 0, error: msg };
      }

      isSyncingRef.current = true;
      setIsSyncing(true);
      setError(null);

      try {
        const headers = await getAuthHeaders();
        const safeDays = Math.max(1, Math.min(60, Math.round(daysBack)));
        const now = new Date();
        const newest = getLocalYYYYMMDD(now);
        const oldest = getLocalYYYYMMDD(addDays(now, -safeDays));

        const resp = await fetch(`/api/intervals/sync?oldest=${oldest}&newest=${newest}`, {
          headers,
          cache: 'no-store',
        });

        const payload = (await resp.json()) as {
          wellness?: IntervalsWellnessEntry[];
          activities?: IntervalsActivityEntry[];
          error?: string;
          message?: string;
        };

        if (!resp.ok) {
          if (resp.status === 503 && payload.error === 'INTERVALS_NOT_CONFIGURED') {
            setIsConfigured(false);
            setIsConnected(false);
          }
          const errMsg = payload.message || payload.error || `Erreur serveur (${resp.status})`;
          setError(errMsg);
          return { ok: false, metricsUpdated: 0, newActivitiesCount: 0, error: errMsg };
        }

        setIsConfigured(true);
        setIsConnected(true);
        lastAutoSyncTimestampRef.current = Date.now();
        setLastSyncedAt(new Date());

        // 1. Import silencieux et automatique des métriques quotidiennes (VFC, FC repos, Readiness)
        const normalizedWellness = normalizeIntervalsWellness(payload.wellness || []);
        const summary = applyWellnessRef.current(normalizedWellness);
        if (summary.updatedCount > 0) {
          setLastMetricsSummary(summary);
          onAutoMetricsRef.current?.(summary);
        }

        // 2. Mise à jour des activités brutes pour la boîte de réception 1 clic
        const incomingActivities = Array.isArray(payload.activities) ? payload.activities : [];
        setRawActivities(incomingActivities);

        return {
          ok: true,
          metricsUpdated: summary.updatedCount,
          newActivitiesCount: incomingActivities.length,
        };
      } catch {
        const msg = 'Impossible de joindre le serveur de synchronisation Garmin.';
        if (!options?.silent) setError(msg);
        return { ok: false, metricsUpdated: 0, newActivitiesCount: 0, error: msg };
      } finally {
        isSyncingRef.current = false;
        setIsSyncing(false);
      }
    },
    [currentUser, getAuthHeaders]
  );

  // Vérification initiale du statut + synchronisation automatique à l'ouverture si prêt
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const status = await checkStatus();
      if (cancelled) return;
      if (
        status.configured &&
        status.connected &&
        currentUser &&
        !isPaused &&
        Date.now() - lastAutoSyncTimestampRef.current >= AUTO_SYNC_COOLDOWN_MS
      ) {
        syncNow(14, { silent: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUser?.uid, isPaused]); // eslint-disable-line react-hooks/exhaustive-deps

  // Resynchronisation silencieuse au retour sur l'application (avec cooldown de 10 min)
  useEffect(() => {
    const handleResume = () => {
      if (
        document.visibilityState === 'visible' &&
        navigator.onLine &&
        currentUser &&
        isConfigured &&
        !isPaused &&
        Date.now() - lastAutoSyncTimestampRef.current >= AUTO_SYNC_COOLDOWN_MS
      ) {
        syncNow(14, { silent: true });
      }
    };

    document.addEventListener('visibilitychange', handleResume);
    window.addEventListener('focus', handleResume);
    return () => {
      document.removeEventListener('visibilitychange', handleResume);
      window.removeEventListener('focus', handleResume);
    };
  }, [currentUser, isConfigured, isPaused, syncNow]);

  // Ensemble des externalId déjà enregistrés dans les séances locales
  const existingExternalIds = useMemo(() => {
    const set = new Set<string>(intervalsProcessedIds);
    Object.values(rawEvents || {}).forEach((dates) => {
      if (!dates) return;
      Object.values(dates).forEach((session) => {
        if (session?.externalId) set.add(session.externalId);
        if (Array.isArray(session?.subSessions)) {
          session.subSessions.forEach((sub) => {
            if (typeof sub.id === 'string' && sub.id.startsWith('icu_')) {
              set.add(sub.id.slice(4));
            }
          });
        }
      });
    });
    return set;
  }, [intervalsProcessedIds, rawEvents]);

  // Liste triée (plus récentes en premier) des activités Garmin prêtes à valider en 1 clic
  const pendingActivities = useMemo<PendingGarminActivity[]>(() => {
    const focusIds = activeBlockToday?.focusQualities || [];
    return rawActivities
      .filter((act) => act && act.id && !existingExternalIds.has(String(act.id)))
      .map((act) => classifyIntervalsActivity(act, qualities, focusIds))
      .filter((item): item is PendingGarminActivity => item !== null)
      .sort((a, b) => {
        const dateCmp = b.dateStr.localeCompare(a.dateStr);
        if (dateCmp !== 0) return dateCmp;
        return b.startTime.localeCompare(a.startTime);
      });
  }, [rawActivities, existingExternalIds, qualities, activeBlockToday]);

  const validateActivity = useCallback(
    (activity: PendingGarminActivity, overrides?: ActivityOverride) => {
      const targetQualityId = overrides?.qualityId || activity.suggestedQualityId;
      const targetRpeCardio = overrides?.rpeCardio ?? activity.suggestedRpeCardio;
      const targetRpeMusc = overrides?.rpeMusc ?? activity.suggestedRpeMusc;
      const existingSession = rawEvents[targetQualityId]?.[activity.dateStr] || null;

      const sessionData = buildSessionFromGarminActivity(
        activity,
        targetQualityId,
        targetRpeCardio,
        targetRpeMusc,
        existingSession
      );

      saveEventWithImpacts(targetQualityId, activity.dateStr, sessionData, true);
      markIntervalsIdsProcessed([activity.externalId]);

      return {
        qualityId: targetQualityId,
        sessionData,
        wasMerged: Boolean(existingSession),
      };
    },
    [rawEvents, saveEventWithImpacts, markIntervalsIdsProcessed]
  );

  const validateAllActivities = useCallback(
    (overridesByExternalId?: Record<string, ActivityOverride>) => {
      if (pendingActivities.length === 0) return 0;

      // Suivre les séances accumulées si deux activités tombent le même jour sur la même filière
      const workingMap: Record<string, Record<string, SessionData>> = {};
      const processedBatch: string[] = [];

      for (const act of [...pendingActivities].reverse()) {
        const override = overridesByExternalId?.[act.externalId];
        const qId = override?.qualityId || act.suggestedQualityId;
        const rC = override?.rpeCardio ?? act.suggestedRpeCardio;
        const rM = override?.rpeMusc ?? act.suggestedRpeMusc;

        const existing = workingMap[qId]?.[act.dateStr] ?? rawEvents[qId]?.[act.dateStr] ?? null;
        const built = buildSessionFromGarminActivity(act, qId, rC, rM, existing);

        if (!workingMap[qId]) workingMap[qId] = {};
        workingMap[qId][act.dateStr] = built;

        saveEventWithImpacts(qId, act.dateStr, built, true);
        processedBatch.push(act.externalId);
      }

      markIntervalsIdsProcessed(processedBatch);
      return processedBatch.length;
    },
    [pendingActivities, rawEvents, saveEventWithImpacts, markIntervalsIdsProcessed]
  );

  const dismissActivity = useCallback(
    (externalId: string) => {
      markIntervalsIdsProcessed([externalId]);
    },
    [markIntervalsIdsProcessed]
  );

  const restoreDismissedActivities = useCallback(async () => {
    clearIntervalsProcessedIds();
    await syncNow(14, { silent: false });
  }, [clearIntervalsProcessedIds, syncNow]);

  const connectionState: IntervalsConnectionState = useMemo(() => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return 'offline';
    if (isCheckingStatus) return 'checking';
    if (!isConfigured) return 'unconfigured';
    if (!currentUser) return 'auth_required';
    if (isSyncing) return 'syncing';
    if (error && !isConnected) return 'error';
    return 'ready';
  }, [isCheckingStatus, isConfigured, currentUser, isSyncing, error, isConnected]);

  return {
    connectionState,
    isConfigured,
    isConnected,
    isSyncing,
    athleteName,
    lastSyncedAt,
    lastMetricsSummary,
    error,
    pendingActivities,
    processedCount: intervalsProcessedIds.length,
    checkStatus,
    syncNow,
    validateActivity,
    validateAllActivities,
    dismissActivity,
    restoreDismissedActivities,
  };
}

export default useIntervalsSync;
