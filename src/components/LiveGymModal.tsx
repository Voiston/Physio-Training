import React, { useState, useEffect, useMemo, useRef, memo, useCallback, useReducer } from 'react';
import { useModalA11y } from '../hooks/useModalA11y';
import { GymRestTimer, GymActiveExercise, GymSetHistory } from './gym';
import { 
  Play, Pause, Plus, Check, Dumbbell, 
  ChevronDown, ChevronUp, Sparkles, Volume2, VolumeX,
  X, CheckCircle2, ChevronRight, Search, 
  Layers, Award, Timer, BatteryCharging, Sun
} from 'lucide-react';
import { 
  MUSCLE_GROUPS, 
  getAllExerciseCatalog, 
  getSavedCustomExercises,
  findLastExercisePerformance, 
  computeAdaptiveProgression,
  ExerciseDefinition,
  getFrequentRecentExercises,
  recordExerciseUsage,
  getExercisePrimaryMuscle,
  ORDERED_PRIMARY_MUSCLES
} from '../utils/muscleHelpers';
import { 
  playSetCompletedSound, 
  playVictoryFanfare, 
  triggerVibration 
} from '../utils/audioHelpers';
import { haptics } from '../utils/haptics';
import { computeDetailedSessionLoad } from '../utils/loadHelpers';
import type { EventsByQuality, SessionData } from '../types';

export interface LiveSet {
  id: string;
  setNumber: number;
  weightKg: number;
  reps: number;
  rir: number;
  restSeconds: number;
  completed: boolean;
  completedAt?: string;
}

export interface LiveExercise {
  id: string;
  exerciseCatalogId: string;
  name: string;
  category: string;
  muscleRatios?: Record<string, number>;
  notes?: string;
  sets: LiveSet[];
}

export interface LiveSessionDraft {
  qualityId: string;
  dateStr: string;
  startedAt: number; // timestamp ms
  elapsedSeconds?: number; // rétrocompatibilité ancien format
  pausedAt?: number | null;
  pausedTotalMs?: number;
  isPaused?: boolean;
  exercises: LiveExercise[];
  restTimer?: {
    running: boolean;
    remainingSeconds: number;
    targetSeconds: number;
    exerciseName?: string;
    setNumber?: number;
  } | null;
  restEndsAt?: number | null;
  restTotalSeconds?: number;
  restLabel?: string;
  restPausedRemainingMs?: number | null;
}

function isValidLiveDraft(data: unknown): data is LiveSessionDraft {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  if (typeof d.qualityId !== 'string') return false;
  if (!Array.isArray(d.exercises)) return false;
  return d.exercises.every((ex: unknown) => {
    if (!ex || typeof ex !== 'object') return false;
    const e = ex as Record<string, unknown>;
    return typeof e.name === 'string' && Array.isArray(e.sets);
  });
}

// Module-level pure set builder for cloning last workout sessions
export function buildClonedSets(
  rawEx: {
    sets?: number;
    weightKg?: number;
    reps?: number;
    rir?: number;
    detailSets?: Array<{ weightKg?: number; reps?: number; rir?: number; restSeconds?: number; completed?: boolean }>;
  },
  exerciseIdx = 0,
  defaultReps = 10,
  defaultRestSeconds = 90
): LiveSet[] {
  const setCount = Math.max(1, Number(rawEx.sets) || 3);
  const defaultWeight = Number(rawEx.weightKg) || 0;
  const targetReps = Number(rawEx.reps) || defaultReps;
  const defaultRir = Number(rawEx.rir ?? 2);

  const hasDetailSets = Array.isArray(rawEx.detailSets) && rawEx.detailSets.length > 0;
  if (hasDetailSets && rawEx.detailSets) {
    return rawEx.detailSets.map((ds, sIdx) => ({
      id: `s_${Date.now()}_${exerciseIdx}_${sIdx + 1}`,
      setNumber: sIdx + 1,
      weightKg: typeof ds.weightKg === 'number' ? ds.weightKg : defaultWeight,
      reps: typeof ds.reps === 'number' ? ds.reps : targetReps,
      rir: typeof ds.rir === 'number' ? ds.rir : defaultRir,
      restSeconds: typeof ds.restSeconds === 'number' ? ds.restSeconds : defaultRestSeconds,
      completed: false
    }));
  }

  return Array.from({ length: setCount }, (_, sIdx) => ({
    id: `s_${Date.now()}_${exerciseIdx}_${sIdx + 1}`,
    setNumber: sIdx + 1,
    weightKg: defaultWeight,
    reps: targetReps,
    rir: defaultRir,
    restSeconds: defaultRestSeconds,
    completed: false
  }));
}

// Module-level pure time formatter
function formatTime(secs: number): string {
  const mins = Math.floor(secs / 60);
  const remSecs = secs % 60;
  return `${mins.toString().padStart(2, '0')}:${remSecs.toString().padStart(2, '0')}`;
}

// Composant autonome pour le chronomètre de séance :
// Seul ce composant se re-rend chaque seconde, isolant les 1800 lignes du modal parent
const ElapsedClock = memo(function ElapsedClock({ 
  startedAt, 
  pausedAt, 
  pausedTotalMs 
}: { 
  startedAt: number; 
  pausedAt: number | null; 
  pausedTotalMs: number; 
}) {
  const [, tick] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    if (pausedAt !== null) return;
    const interval = setInterval(() => tick(), 1000);
    return () => clearInterval(interval);
  }, [pausedAt]);

  const effectiveNow = pausedAt !== null ? pausedAt : Date.now();
  const secs = Math.max(0, Math.floor((effectiveNow - startedAt - pausedTotalMs) / 1000));
  return <>{formatTime(secs)}</>;
});




interface QualityOption {
  id: string;
  name: string;
  color?: string;
  icon?: string;
  category?: string;
}

interface LiveGymModalProps {
  isOpen: boolean;
  onClose: () => void;
  qualities: QualityOption[];
  events: EventsByQuality;
  initialDateStr: string;
  onSaveSession: (qualityId: string, dateStr: string, sessionData: SessionData, applyImpacts: boolean) => void;
}

export interface EscapeActionInput {
  showAddExercisePicker: boolean;
  stage: 'setup' | 'active' | 'summary';
}

export type EscapeActionResult = 'close_picker' | 'confirm_abandon' | 'close_modal';

/**
 * Arbitrage hiérarchique de la touche Escape :
 * 1. Si le sélecteur d'exercices est ouvert -> fermer le picker uniquement sans confirm.
 * 2. Si la séance est active -> demander confirmation d'abandon.
 * 3. Sinon (setup / summary) -> fermer le modal avec réinitialisation.
 */
export function resolveLiveGymEscapeAction(input: EscapeActionInput): EscapeActionResult {
  if (input.showAddExercisePicker) {
    return 'close_picker';
  }
  if (input.stage === 'active') {
    return 'confirm_abandon';
  }
  return 'close_modal';
}

const STORAGE_DRAFT_KEY = 'training_live_session_draft_v1';

export const LiveGymModal: React.FC<LiveGymModalProps> = ({
  isOpen,
  onClose,
  qualities,
  events,
  initialDateStr,
  onSaveSession
}) => {
  // --- ÉTAPE DE LA MODALE : 'setup' | 'active' | 'summary' ---
  const [stage, setStage] = useState<'setup' | 'active' | 'summary'>('setup');
  
  // Filière ciblée sélectionnée
  const [selectedQualityId, setSelectedQualityId] = useState<string>(() => {
    // Par défaut, prioriser Push, Pull, Legs, Abdos ou Isolation
    const gymQualities = ['push', 'pull', 'leg', 'abdos', 'isolation'];
    const found = qualities.find(q => gymQualities.includes(q.id.toLowerCase()));
    return found ? found.id : (qualities[0]?.id || 'push');
  });

  // Détection de la filière active et de sa catégorie anatomique (ex: 'upper_pull' pour Pull)
  const targetSessionCategory = useMemo(() => {
    const qId = selectedQualityId.toLowerCase();
    if (qId.includes('pull')) return 'upper_pull';
    if (qId.includes('push')) return 'upper_push';
    if (qId.includes('leg')) return 'lower';
    if (qId.includes('abdo') || qId.includes('core')) return 'core';
    return null;
  }, [selectedQualityId]);

  const isPullSession = targetSessionCategory === 'upper_pull';

  // Draft en cours
  const [draftExists, setDraftExists] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Chrono général de séance basé sur timestamps absolus (zéro re-rendu du parent chaque seconde)
  const [startedAt, setStartedAt] = useState<number>(() => Date.now());
  const [pausedAt, setPausedAt] = useState<number | null>(null);
  const [pausedTotalMs, setPausedTotalMs] = useState<number>(0);

  // Minuteur de repos basé sur timestamps absolus (recalé sur l'horloge système sans dérive)
  const [restTimerState, setRestTimerState] = useState<{
    endsAt: number;
    targetSeconds: number;
    label?: string;
    pausedRemainingMs: number | null;
  } | null>(null);

  const isWorkoutPaused = pausedAt !== null;

  const handleToggleWorkoutPause = useCallback(() => {
    if (pausedAt !== null) {
      // Reprise
      const pauseDuration = Date.now() - pausedAt;
      setPausedTotalMs(prev => prev + pauseDuration);
      setPausedAt(null);
    } else {
      // Pause
      setPausedAt(Date.now());
    }
  }, [pausedAt]);

  const getElapsedSeconds = useCallback(() => {
    const effectiveNow = pausedAt !== null ? pausedAt : Date.now();
    return Math.max(0, Math.floor((effectiveNow - startedAt - pausedTotalMs) / 1000));
  }, [startedAt, pausedAt, pausedTotalMs]);

  // Exercices actifs
  const [activeExercises, setActiveExercises] = useState<LiveExercise[]>([]);

  // Modale d'ajout d'exercice
  const [showAddExercisePicker, setShowAddExercisePicker] = useState(false);
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [expandedMuscles, setExpandedMuscles] = useState<Record<string, boolean>>({});

  // De base, les catalogues sont repliés (sauf si l'utilisateur saisit une recherche)
  const isMuscleExpanded = (muscleId: string) => {
    if (exerciseSearch.trim().length > 0) return true;
    return expandedMuscles[muscleId] === true;
  };

  const toggleMuscleCollapse = (muscleId: string) => {
    setExpandedMuscles(prev => ({
      ...prev,
      [muscleId]: !prev[muscleId]
    }));
  };

  const toggleAllMuscleGroups = () => {
    const anyOpen = ORDERED_PRIMARY_MUSCLES.some(m => expandedMuscles[m.id]);
    if (anyOpen) {
      setExpandedMuscles({});
    } else {
      const allOpen: Record<string, boolean> = {};
      ORDERED_PRIMARY_MUSCLES.forEach(m => { allOpen[m.id] = true; });
      setExpandedMuscles(allOpen);
    }
  };

  // Fin de séance (Summary)
  const [sessionRpeMusc, setSessionRpeMusc] = useState<number>(8);
  const [sessionRpeCardio, setSessionRpeCardio] = useState<number>(3);
  const [sessionFatigue, setSessionFatigue] = useState<number>(4);
  const [applyImpacts, setApplyImpacts] = useState<boolean>(true);
  const [workoutNotes, setWorkoutNotes] = useState<string>('');

  // Custom exercises catalog
  const customExercises = useMemo(() => getSavedCustomExercises(), []);
  const allExercises = useMemo(() => getAllExerciseCatalog(customExercises), [customExercises]);

  // Exercices les plus souvent utilisés récemment
  const frequentExercises = useMemo(() => {
    return getFrequentRecentExercises(events, allExercises, 8, initialDateStr);
  }, [events, allExercises, initialDateStr]);

  const frequentMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const f of frequentExercises) {
      map.set(f.exerciseId, f.count);
    }
    return map;
  }, [frequentExercises]);

  // Récupération de la dernière séance de la filière sélectionnée
  const lastSessionForQuality = useMemo(() => {
    const qEvents = events[selectedQualityId];
    if (!qEvents) return null;
    const datesWithEx = Object.keys(qEvents)
      .filter(d => qEvents[d]?.exercises && Array.isArray(qEvents[d].exercises) && qEvents[d].exercises.length > 0)
      .sort((a, b) => b.localeCompare(a));
    if (datesWithEx.length === 0) return null;
    const date = datesWithEx[0];
    return {
      date,
      session: qEvents[date]
    };
  }, [events, selectedQualityId]);

  // Mémoïsation des calculs de progression adaptative par exercice pour éviter de scanner l'historique complet à chaque render
  const exerciseIdsKey = useMemo(() => {
    return activeExercises.map(e => e.exerciseCatalogId).join('|');
  }, [activeExercises]);

  const adaptiveProgressionMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof computeAdaptiveProgression>>();
    for (const id of exerciseIdsKey.split('|').filter(Boolean)) {
      if (!map.has(id)) {
        const lastPerf = findLastExercisePerformance(events, id, initialDateStr);
        map.set(id, computeAdaptiveProgression(lastPerf, 4));
      }
    }
    return map;
  }, [events, initialDateStr, exerciseIdsKey]);

  // Gestion du Wake Lock API pour empêcher l'écran du smartphone de se verrouiller
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const [keepScreenAwake, setKeepScreenAwake] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('physio_wake_lock_enabled');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const toggleKeepScreenAwake = () => {
    setKeepScreenAwake(prev => {
      const next = !prev;
      try {
        localStorage.setItem('physio_wake_lock_enabled', String(next));
      } catch (err) { console.warn("[LiveGym] Impossible d'enregistrer la préférence wake lock", err); }
      return next;
    });
  };

  useEffect(() => {
    // Relâcher le Wake Lock si la séance est terminée, en pause, ou si l'utilisateur a désactivé le maintien de l'écran
    if (!isOpen || stage !== 'active' || isWorkoutPaused || !keepScreenAwake) {
      if (wakeLockRef.current) {
        try {
          wakeLockRef.current.release();
        } catch (e) {
          // ignore
        }
        wakeLockRef.current = null;
      }
      return;
    }

    // Tenter d'activer le Wake Lock
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLockRef.current = await navigator.wakeLock.request('screen');
        }
      } catch (err) {
        // Le navigateur ou les réglages économie d'énergie peuvent refuser
      }
    };

    requestWakeLock();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && stage === 'active' && !isWorkoutPaused && keepScreenAwake) {
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLockRef.current) {
        try {
          wakeLockRef.current.release();
        } catch (e) {
          // ignore
        }
        wakeLockRef.current = null;
      }
    };
  }, [isOpen, stage, isWorkoutPaused, keepScreenAwake]);

  // Vérifier s'il existe déjà un brouillon sauvegardé dans localStorage
  useEffect(() => {
    if (!isOpen) return;
    try {
      const saved = localStorage.getItem(STORAGE_DRAFT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (isValidLiveDraft(parsed) && parsed.exercises.length > 0) {
          setDraftExists(true);
        } else {
          localStorage.removeItem(STORAGE_DRAFT_KEY);
        }
      }
    } catch (e) {
      // Nettoyer si corrompu
      try { localStorage.removeItem(STORAGE_DRAFT_KEY); } catch (err) { console.warn('[LiveGym] Impossible de supprimer le brouillon corrompu', err); }
    }
  }, [isOpen]);

  // Réinitialisation complète de l'état interne de la séance en direct
  const resetLiveSessionState = useCallback(() => {
    setStage('setup');
    setActiveExercises([]);
    setRestTimerState(null);
    setWorkoutNotes('');
    setShowAddExercisePicker(false);
    setStartedAt(0);
    setPausedAt(null);
    setPausedTotalMs(0);
  }, []);

  // Réinitialiser automatiquement l'état interne lorsque la modale se ferme
  useEffect(() => {
    if (!isOpen) {
      resetLiveSessionState();
    }
  }, [isOpen, resetLiveSessionState]);

  // Sauvegarde automatique du brouillon avec debounce de 1 seconde
  // Ne s'exécute QUE si la structure change (exercices, séries, pause), JAMAIS à chaque seconde du chrono
  const saveDraftToStorage = useCallback(() => {
    if (stage !== 'active' || activeExercises.length === 0) return;
    try {
      const draft: LiveSessionDraft = {
        qualityId: selectedQualityId,
        dateStr: initialDateStr,
        startedAt,
        pausedAt,
        pausedTotalMs,
        isPaused: pausedAt !== null,
        exercises: activeExercises,
        restTimer: restTimerState ? {
          running: restTimerState.pausedRemainingMs === null,
          remainingSeconds: restTimerState.pausedRemainingMs !== null 
            ? Math.ceil(restTimerState.pausedRemainingMs / 1000)
            : Math.max(0, Math.ceil((restTimerState.endsAt - Date.now()) / 1000)),
          targetSeconds: restTimerState.targetSeconds,
          exerciseName: restTimerState.label
        } : null,
        restEndsAt: restTimerState ? restTimerState.endsAt : null,
        restTotalSeconds: restTimerState ? restTimerState.targetSeconds : undefined,
        restLabel: restTimerState ? restTimerState.label : undefined,
        restPausedRemainingMs: restTimerState ? restTimerState.pausedRemainingMs : null
      };
      localStorage.setItem(STORAGE_DRAFT_KEY, JSON.stringify(draft));
    } catch (e) {
      // Ignore
    }
  }, [stage, activeExercises, startedAt, pausedAt, pausedTotalMs, restTimerState, selectedQualityId, initialDateStr]);

  // Debounce l'autosave lors des changements de données réels
  useEffect(() => {
    if (stage !== 'active' || activeExercises.length === 0) return;
    const timerId = setTimeout(() => {
      saveDraftToStorage();
    }, 1000);
    return () => clearTimeout(timerId);
  }, [saveDraftToStorage, stage, activeExercises]);

  // Flush immédiat du brouillon sur pagehide / avant fermeture du navigateur
  useEffect(() => {
    const handlePageHide = () => {
      saveDraftToStorage();
    };
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handlePageHide);
    return () => {
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handlePageHide);
    };
  }, [saveDraftToStorage]);

  // Calculs en direct : Tonnage cumulé & Séries validées
  const { totalCompletedSets, totalPlannedSets, totalTonnageKg } = useMemo(() => {
    let completedSets = 0;
    let plannedSets = 0;
    let tonnage = 0;

    activeExercises.forEach(ex => {
      ex.sets.forEach(s => {
        plannedSets++;
        if (s.completed) {
          completedSets++;
          tonnage += (s.weightKg || 0) * (s.reps || 0);
        }
      });
    });

    return {
      totalCompletedSets: completedSets,
      totalPlannedSets: plannedSets,
      totalTonnageKg: Math.round(tonnage)
    };
  }, [activeExercises]);

  // --- ACTIONS INITIALISATION ---
  const handleStartBlank = () => {
    // Démarrer séance vierge
    setStartedAt(Date.now());
    setPausedAt(null);
    setPausedTotalMs(0);
    setRestTimerState(null);
    // On ajoute un premier exercice par défaut selon la filière
    let initialExId = 'bench_press';
    if (selectedQualityId === 'pull') initialExId = 'pull_ups';
    if (selectedQualityId === 'leg') initialExId = 'squat';
    if (selectedQualityId === 'abdos') initialExId = 'abdos_crunch';
    if (selectedQualityId === 'isolation') initialExId = 'biceps_curl';

    const def = allExercises.find(e => e.id === initialExId) || allExercises[0];
    const initialEx: LiveExercise = {
      id: `ex_${Date.now()}`,
      exerciseCatalogId: def.id,
      name: def.name,
      category: def.category,
      muscleRatios: def.muscleRatios,
      sets: [
        { id: `s_${Date.now()}_1`, setNumber: 1, weightKg: 0, reps: def.defaultReps || 10, rir: 2, restSeconds: 90, completed: false },
        { id: `s_${Date.now()}_2`, setNumber: 2, weightKg: 0, reps: def.defaultReps || 10, rir: 2, restSeconds: 90, completed: false },
        { id: `s_${Date.now()}_3`, setNumber: 3, weightKg: 0, reps: def.defaultReps || 10, rir: 2, restSeconds: 90, completed: false }
      ]
    };

    setActiveExercises([initialEx]);
    haptics.modeSwitch();
    setStage('active');
  };

  const handleStartFromLastSession = () => {
    if (!lastSessionForQuality?.session?.exercises) {
      handleStartBlank();
      return;
    }

    const clonedExercises: LiveExercise[] = lastSessionForQuality.session.exercises.map((rawEx, idx) => {
      const def = allExercises.find(e => e.id === rawEx.id) || {
        id: rawEx.id,
        name: rawEx.name || 'Exercice',
        category: 'upper_push',
        defaultReps: rawEx.reps || 10,
        muscleRatios: {}
      };

      const sets = buildClonedSets(rawEx, idx, def.defaultReps || 10, 90);

      return {
        id: `ex_${Date.now()}_${idx}`,
        exerciseCatalogId: def.id,
        name: rawEx.name || def.name,
        category: def.category,
        muscleRatios: def.muscleRatios,
        sets
      };
    });

    setActiveExercises(clonedExercises);
    setStartedAt(Date.now());
    setPausedAt(null);
    setPausedTotalMs(0);
    setRestTimerState(null);
    haptics.modeSwitch();
    setStage('active');
  };

  const handleResumeDraft = () => {
    try {
      const saved = localStorage.getItem(STORAGE_DRAFT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (!isValidLiveDraft(parsed)) {
          localStorage.removeItem(STORAGE_DRAFT_KEY);
          handleStartBlank();
          return;
        }
        if (parsed.qualityId) setSelectedQualityId(parsed.qualityId);

        if (typeof parsed.startedAt === 'number') {
          setStartedAt(parsed.startedAt);
          setPausedAt(parsed.pausedAt ?? null);
          setPausedTotalMs(parsed.pausedTotalMs || 0);
        } else if (typeof parsed.elapsedSeconds === 'number') {
          const computedStartedAt = Date.now() - (parsed.elapsedSeconds * 1000);
          setStartedAt(computedStartedAt);
          setPausedAt(parsed.isPaused ? Date.now() : null);
          setPausedTotalMs(0);
        }

        if (parsed.exercises && parsed.exercises.length > 0) {
          setActiveExercises(parsed.exercises);
        }

        if (parsed.restEndsAt && parsed.restEndsAt > Date.now()) {
          setRestTimerState({
            endsAt: parsed.restEndsAt,
            targetSeconds: parsed.restTotalSeconds || 90,
            label: parsed.restLabel,
            pausedRemainingMs: parsed.restPausedRemainingMs ?? null
          });
        } else if (parsed.restPausedRemainingMs !== null && parsed.restPausedRemainingMs !== undefined && parsed.restPausedRemainingMs > 0) {
          setRestTimerState({
            endsAt: Date.now() + parsed.restPausedRemainingMs,
            targetSeconds: parsed.restTotalSeconds || 90,
            label: parsed.restLabel,
            pausedRemainingMs: parsed.restPausedRemainingMs
          });
        } else if (parsed.restTimer && parsed.restTimer.remainingSeconds > 0) {
          setRestTimerState({
            endsAt: Date.now() + parsed.restTimer.remainingSeconds * 1000,
            targetSeconds: parsed.restTimer.targetSeconds,
            label: parsed.restTimer.exerciseName,
            pausedRemainingMs: parsed.restTimer.running ? null : parsed.restTimer.remainingSeconds * 1000
          });
        } else {
          setRestTimerState(null);
        }

        haptics.modeSwitch();
        setStage('active');
      }
    } catch (e) {
      handleStartBlank();
    }
  };

  // --- GESTION DES SÉRIES ET VALIDATION ---
  const handleValidateSet = (exerciseIndex: number, setIndex: number) => {
    const ex = activeExercises[exerciseIndex];
    if (!ex) return;
    const currentSet = ex.sets[setIndex];
    if (!currentSet) return;

    const newCompleted = !currentSet.completed;

    if (newCompleted) {
      // Feedback sonore et tactile
      if (soundEnabled) {
        playSetCompletedSound();
      }
      triggerVibration(60);

      // Lancement automatique du minuteur de repos basé sur timestamps
      const restSecs = currentSet.restSeconds || 90;
      setRestTimerState({
        endsAt: Date.now() + restSecs * 1000,
        targetSeconds: restSecs,
        label: `${ex.name} (Série ${currentSet.setNumber})`,
        pausedRemainingMs: null
      });
    }

    setActiveExercises(prev => {
      const clone = [...prev];
      const targetEx = { ...clone[exerciseIndex] };
      const targetSets = [...targetEx.sets];

      targetSets[setIndex] = {
        ...targetSets[setIndex],
        completed: newCompleted,
        completedAt: newCompleted ? new Date().toISOString() : undefined
      };

      // Si on vient de valider et qu'il y a une série suivante non complétée, 
      // pré-remplir automatiquement son poids et reps avec ceux de la série validée
      if (newCompleted && setIndex + 1 < targetSets.length && !targetSets[setIndex + 1].completed) {
        targetSets[setIndex + 1] = {
          ...targetSets[setIndex + 1],
          weightKg: targetSets[setIndex].weightKg,
          reps: targetSets[setIndex].reps,
          rir: targetSets[setIndex].rir
        };
      }

      targetEx.sets = targetSets;
      clone[exerciseIndex] = targetEx;
      return clone;
    });
  };

  const handleUpdateSetValue = (exerciseIndex: number, setIndex: number, field: keyof LiveSet, value: LiveSet[keyof LiveSet]) => {
    setActiveExercises(prev => {
      const clone = [...prev];
      const targetEx = { ...clone[exerciseIndex] };
      const targetSets = [...targetEx.sets];
      targetSets[setIndex] = {
        ...targetSets[setIndex],
        [field]: value
      };
      targetEx.sets = targetSets;
      clone[exerciseIndex] = targetEx;
      return clone;
    });
  };

  const handleQuickAdjustWeight = (exerciseIndex: number, setIndex: number, delta: number) => {
    const current = activeExercises[exerciseIndex]?.sets[setIndex]?.weightKg || 0;
    const nextVal = Math.max(0, Math.round((current + delta) * 10) / 10);
    handleUpdateSetValue(exerciseIndex, setIndex, 'weightKg', nextVal);
  };

  const handleQuickAdjustReps = (exerciseIndex: number, setIndex: number, delta: number) => {
    const current = activeExercises[exerciseIndex]?.sets[setIndex]?.reps || 0;
    const nextVal = Math.max(1, current + delta);
    handleUpdateSetValue(exerciseIndex, setIndex, 'reps', nextVal);
  };

  const handleAddSetToExercise = (exerciseIndex: number) => {
    const ex = activeExercises[exerciseIndex];
    if (!ex) return;
    const lastSet = ex.sets[ex.sets.length - 1];
    const newSetNumber = ex.sets.length + 1;
    const newSet: LiveSet = {
      id: `s_${Date.now()}_${newSetNumber}`,
      setNumber: newSetNumber,
      weightKg: lastSet ? lastSet.weightKg : 0,
      reps: lastSet ? lastSet.reps : 10,
      rir: lastSet ? lastSet.rir : 2,
      restSeconds: lastSet ? lastSet.restSeconds : 90,
      completed: false
    };

    setActiveExercises(prev => {
      const clone = [...prev];
      clone[exerciseIndex] = {
        ...clone[exerciseIndex],
        sets: [...clone[exerciseIndex].sets, newSet]
      };
      return clone;
    });
  };

  const handleRemoveSet = (exerciseIndex: number, setIndex: number) => {
    setActiveExercises(prev => {
      const clone = [...prev];
      const targetEx = { ...clone[exerciseIndex] };
      if (targetEx.sets.length <= 1) return prev; // Conserver au moins 1 série
      const filtered = targetEx.sets.filter((_, idx) => idx !== setIndex).map((s, idx) => ({
        ...s,
        setNumber: idx + 1
      }));
      targetEx.sets = filtered;
      clone[exerciseIndex] = targetEx;
      return clone;
    });
  };

  const handleRemoveExercise = (exerciseIndex: number) => {
    setActiveExercises(prev => prev.filter((_, idx) => idx !== exerciseIndex));
  };

  const handleApplyAdaptiveSuggestion = useCallback((exerciseIndex: number) => {
    const ex = activeExercises[exerciseIndex];
    if (!ex) return;
    const adaptive = adaptiveProgressionMap.get(ex.exerciseCatalogId);
    if (!adaptive || !adaptive.hasHistory) return;

    setActiveExercises(prev => {
      const clone = [...prev];
      if (!clone[exerciseIndex]) return prev;
      clone[exerciseIndex] = {
        ...clone[exerciseIndex],
        sets: clone[exerciseIndex].sets.map(s => {
          if (s.completed) return s;
          return {
            ...s,
            weightKg: adaptive.suggestedWeightKg ?? s.weightKg,
            reps: adaptive.suggestedReps ?? s.reps,
            rir: adaptive.suggestedRir ?? s.rir
          };
        })
      };
      return clone;
    });
  }, [activeExercises, adaptiveProgressionMap]);

  const handleAddExerciseFromCatalog = (catalogEx: ExerciseDefinition) => {
    recordExerciseUsage(catalogEx.id);
    const newEx: LiveExercise = {
      id: `ex_${Date.now()}`,
      exerciseCatalogId: catalogEx.id,
      name: catalogEx.name,
      category: catalogEx.category,
      muscleRatios: catalogEx.muscleRatios,
      sets: [
        { id: `s_${Date.now()}_1`, setNumber: 1, weightKg: 0, reps: catalogEx.defaultReps || 10, rir: 2, restSeconds: 90, completed: false },
        { id: `s_${Date.now()}_2`, setNumber: 2, weightKg: 0, reps: catalogEx.defaultReps || 10, rir: 2, restSeconds: 90, completed: false },
        { id: `s_${Date.now()}_3`, setNumber: 3, weightKg: 0, reps: catalogEx.defaultReps || 10, rir: 2, restSeconds: 90, completed: false }
      ]
    };

    setActiveExercises(prev => [...prev, newEx]);
    setShowAddExercisePicker(false);
    setExerciseSearch('');
  };

  // --- ACTIONS MINUTEUR DE REPOS ---
  const handleAdjustRestTimer = useCallback((deltaSecs: number) => {
    setRestTimerState(prev => {
      if (!prev) return null;
      if (prev.pausedRemainingMs !== null) {
        const nextMs = Math.max(0, prev.pausedRemainingMs + deltaSecs * 1000);
        return { ...prev, pausedRemainingMs: nextMs };
      }
      const nextEndsAt = Math.max(Date.now(), prev.endsAt + deltaSecs * 1000);
      return { ...prev, endsAt: nextEndsAt };
    });
  }, []);

  const handleToggleRestPause = useCallback(() => {
    setRestTimerState(prev => {
      if (!prev) return null;
      if (prev.pausedRemainingMs !== null) {
        // Reprise du repos
        return {
          ...prev,
          endsAt: Date.now() + prev.pausedRemainingMs,
          pausedRemainingMs: null
        };
      } else {
        // Mise en pause du repos
        const remainingMs = Math.max(0, prev.endsAt - Date.now());
        return {
          ...prev,
          pausedRemainingMs: remainingMs
        };
      }
    });
  }, []);

  const handleSkipRestTimer = useCallback(() => {
    setRestTimerState(null);
  }, []);

  // --- FIN DE SÉANCE ET ENREGISTREMENT ---
  const handleOpenSummary = () => {
    haptics.validate();
    // Calculer RPE suggéré à partir de la moyenne des RIR et des séries
    const completedSetsList = activeExercises.flatMap(ex => ex.sets.filter(s => s.completed));
    let suggestedRpe = 8;
    if (completedSetsList.length > 0) {
      const avgRir = completedSetsList.reduce((acc, s) => acc + s.rir, 0) / completedSetsList.length;
      suggestedRpe = Math.round(10 - avgRir);
    }
    setSessionRpeMusc(Math.min(10, Math.max(1, suggestedRpe)));
    setStage('summary');
  };

  const handleConfirmSaveSession = () => {
    // Vibration physique de succès et célébration
    haptics.success();

    // Conversion en structure compatible avec le reste de l'application
    const elapsedSecs = getElapsedSeconds();
    const sessionDurationMin = Math.max(5, Math.round(elapsedSecs / 60));

    // Synthétiser les exercices
    const packagedExercises = activeExercises.map(ex => {
      const completed = ex.sets.filter(s => s.completed);
      const targetSets = completed.length > 0 ? completed : ex.sets;
      const setCount = targetSets.length;
      const avgWeight = Math.round((targetSets.reduce((acc, s) => acc + (s.weightKg || 0), 0) / setCount) * 10) / 10;
      const avgReps = Math.round(targetSets.reduce((acc, s) => acc + (s.reps || 10), 0) / setCount);
      const avgRir = Math.round(targetSets.reduce((acc, s) => acc + (s.rir ?? 2), 0) / setCount);

      return {
        id: ex.exerciseCatalogId,
        name: ex.name,
        sets: setCount,
        weightKg: avgWeight > 0 ? avgWeight : undefined,
        reps: avgReps > 0 ? avgReps : undefined,
        rir: avgRir,
        rpe: 10 - avgRir,
        customRatios: ex.muscleRatios && Object.keys(ex.muscleRatios).length > 0 ? { ...ex.muscleRatios } : undefined,
        detailSets: ex.sets.map(s => ({
          weightKg: s.weightKg,
          reps: s.reps,
          rir: s.rir,
          completed: s.completed
        }))
      };
    });

    const { load: lTotal, loadCardio: lCardio, loadMusc: lMusc } = computeDetailedSessionLoad(
      selectedQualityId,
      sessionDurationMin,
      sessionRpeCardio,
      sessionRpeMusc,
      false
    );

    const sessionData = {
      duration: sessionDurationMin,
      rpeMusc: sessionRpeMusc,
      rpeCardio: sessionRpeCardio,
      fatigue: sessionFatigue,
      load: lTotal,
      loadMusc: lMusc,
      loadCardio: lCardio,
      sport: 'gym',
      isEccentric: false,
      notes: workoutNotes.trim() ? workoutNotes.trim() : undefined,
      tonnageKg: totalTonnageKg,
      exercises: packagedExercises.length > 0 ? packagedExercises : undefined,
      source: 'live_gym_tracker',
      completedAt: new Date().toISOString(),
      updatedAt: Date.now()
    };

    // Jouer fanfare de victoire
    if (soundEnabled) {
      playVictoryFanfare();
    }

    // Sauvegarde via la prop
    onSaveSession(selectedQualityId, initialDateStr, sessionData, applyImpacts);

    // Nettoyage du brouillon
    try {
      localStorage.removeItem(STORAGE_DRAFT_KEY);
    } catch (e) {
      // Ignore
    }

    resetLiveSessionState();
    onClose();
  };

  const handleAbandonWorkout = useCallback(() => {
    if (window.confirm('Voulez-vous vraiment abandonner cette séance ? Les données non enregistrées seront effacées.')) {
      haptics.warning();
      try {
        localStorage.removeItem(STORAGE_DRAFT_KEY);
      } catch (e) {
        // Ignore
      }
      resetLiveSessionState();
      onClose();
    }
  }, [resetLiveSessionState, onClose]);

  const modalRef = useRef<HTMLDivElement>(null);

  const handleEscape = useCallback(() => {
    const action = resolveLiveGymEscapeAction({ showAddExercisePicker, stage });
    if (action === 'close_picker') {
      setShowAddExercisePicker(false);
      return;
    }
    if (action === 'confirm_abandon') {
      handleAbandonWorkout();
    } else {
      resetLiveSessionState();
      onClose();
    }
  }, [showAddExercisePicker, stage, handleAbandonWorkout, resetLiveSessionState, onClose]);

  const handleSafeClose = useCallback(() => {
    resetLiveSessionState();
    onClose();
  }, [resetLiveSessionState, onClose]);

  // Focus trap, Escape listener & Focus restoration (WCAG 2.2 SC 2.1.2 & 2.4.3)
  useModalA11y(isOpen, onClose, modalRef, handleEscape);

  // Suspension des animations GPU de la grille d'arrière-plan pendant que la modale de salle est ouverte
  useEffect(() => {
    if (!isOpen) return;
    document.body.classList.add('gym-open');
    return () => {
      document.body.classList.remove('gym-open');
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-0 sm:p-4 overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="live-gym-title"
    >
      <div 
        ref={modalRef}
        tabIndex={-1}
        className="relative w-full max-w-4xl bg-slate-900 border-0 sm:border border-slate-700/80 rounded-none sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[100dvh] sm:h-auto sm:max-h-[96vh] animate-fadeIn focus:outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ==================================================================== */}
        {/* ÉCRAN 1 : INITIALISATION / SETUP                                     */}
        {/* ==================================================================== */}
        {stage === 'setup' && (
          <div className="p-5 sm:p-8 space-y-6 overflow-y-auto">
            {/* Header Setup */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    <Dumbbell size={24} aria-hidden="true" />
                  </span>
                  <div>
                    <h2 id="live-gym-title" className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                      Mode Salle <span className="text-emerald-400">· Live Gym</span>
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-400 font-medium mt-0.5">
                      Saisie tactile en temps réel, minuteur de repos automatique et charge adaptative.
                    </p>
                  </div>
                </div>
              </div>
              <button 
                onClick={handleSafeClose}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                title="Fermer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Brouillon en cours détecté */}
            {draftExists && (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 animate-pulse">
                    <BatteryCharging size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-amber-200">Séance en cours détectée</p>
                    <p className="text-xs text-amber-300/80">Un brouillon interrompu est toujours disponible en mémoire.</p>
                  </div>
                </div>
                <button
                  onClick={handleResumeDraft}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs sm:text-sm transition-all shadow-lg shadow-amber-500/20 flex items-center gap-1.5 shrink-0"
                >
                  <Play size={14} className="fill-current" /> Reprendre
                </button>
              </div>
            )}

            {/* Sélection de la filière / Qualité */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                1. Filière cible pour cette séance
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                {qualities.map(q => {
                  const isSelected = selectedQualityId === q.id;
                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => setSelectedQualityId(q.id)}
                      className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                        isSelected 
                          ? 'bg-blue-600/20 border-blue-500 text-white shadow-md shadow-blue-500/10 ring-1 ring-blue-500' 
                          : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800 hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-1">
                        <span className="text-xs font-extrabold uppercase tracking-wide truncate">{q.name}</span>
                        {isSelected && <CheckCircle2 size={16} className="text-blue-400 shrink-0" />}
                      </div>
                      <span className="text-[11px] text-slate-400 truncate">
                        {q.id === 'push' ? 'Pectoraux · Épaules · Triceps' : 
                         q.id === 'pull' ? 'Dos · Biceps · Arrière d\'épaule' :
                         q.id === 'leg' ? 'Quadriceps · Ischios · Fessiers' :
                         q.id === 'abdos' ? 'Core · Sangle abdominale' :
                         q.id === 'isolation' ? 'Micro-séance ciblée' : 'Renforcement'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Choix du mode de démarrage */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                2. Méthode d'initialisation
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Option Dernière Séance / Modèle */}
                <button
                  type="button"
                  onClick={handleStartFromLastSession}
                  disabled={!lastSessionForQuality}
                  className={`p-4 rounded-2xl border text-left transition-all flex items-start gap-3.5 ${
                    lastSessionForQuality
                      ? 'bg-emerald-950/20 border-emerald-500/30 hover:border-emerald-500/60 hover:bg-emerald-950/30 text-white group cursor-pointer'
                      : 'bg-slate-800/30 border-slate-800 text-slate-500 cursor-not-allowed opacity-60'
                  }`}
                >
                  <div className={`p-3 rounded-xl shrink-0 ${lastSessionForQuality ? 'bg-emerald-500/20 text-emerald-400 group-hover:scale-110 transition-transform' : 'bg-slate-800 text-slate-600'}`}>
                    <Sparkles size={22} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-sm sm:text-base text-white">Cloner la dernière séance</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        Recommandé
                      </span>
                    </div>
                    {lastSessionForQuality ? (
                      <p className="text-xs text-slate-300 leading-relaxed">
                        Pré-remplit vos exercices ({lastSessionForQuality.session.exercises?.length || 0}) et charges de la séance du <strong>{lastSessionForQuality.date}</strong>.
                      </p>
                    ) : (
                      <p className="text-xs text-slate-500">Aucun historique d'exercices trouvé pour cette filière.</p>
                    )}
                  </div>
                </button>

                {/* Option Séance Vierge */}
                <button
                  type="button"
                  onClick={handleStartBlank}
                  className="p-4 rounded-2xl bg-blue-950/20 border border-blue-500/30 hover:border-blue-500/60 hover:bg-blue-950/30 text-white text-left transition-all flex items-start gap-3.5 group cursor-pointer"
                >
                  <div className="p-3 rounded-xl bg-blue-500/20 text-blue-400 group-hover:scale-110 transition-transform shrink-0">
                    <Plus size={22} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-sm sm:text-base text-white">Démarrer une séance vierge</span>
                      <ChevronRight size={16} className="text-blue-400 group-hover:translate-x-1 transition-transform" />
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Construisez votre séance en direct en choisissant vos exercices et séries au fur et à mesure.
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {/* Préférences Audio & Écran */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800 text-xs text-slate-400">
              <span className="flex items-center gap-2">
                <Timer size={15} className="text-slate-400" />
                Minuteur automatique après validation de série
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleKeepScreenAwake}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition-colors cursor-pointer"
                  title={keepScreenAwake ? "L'écran reste allumé pendant la séance" : "L'écran peut se mettre en veille pour économiser la batterie"}
                  aria-label={keepScreenAwake ? "Écran maintenu allumé activé" : "Veille normale de l'écran activée"}
                >
                  <Sun size={14} className={keepScreenAwake ? "text-amber-400" : "text-slate-500"} />
                  {keepScreenAwake ? 'Écran allumé' : 'Veille auto'}
                </button>
                <button
                  type="button"
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition-colors cursor-pointer"
                >
                  {soundEnabled ? <Volume2 size={14} className="text-emerald-400" /> : <VolumeX size={14} className="text-rose-400" />}
                  {soundEnabled ? 'Sons activés' : 'Muet'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* ÉCRAN 2 : SÉANCE ACTIVE EN SALLE (HUD & TRACKER TACTILE)             */}
        {/* ==================================================================== */}
        {stage === 'active' && (
          <div className="flex flex-col h-full overflow-hidden">
            {/* Top Bar HUD / En-tête de la séance */}
            <div className="bg-slate-900 border-b border-slate-800 px-3 sm:px-6 py-2.5 sm:py-3.5 flex items-center justify-between gap-2 shrink-0">
              {/* Chrono et Filière */}
              <div className="flex items-center gap-2.5 sm:gap-4">
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${isWorkoutPaused ? 'bg-amber-500' : 'bg-emerald-500 animate-ping'}`} />
                  <span className={`font-mono font-black text-lg sm:text-2xl tabular-nums ${isWorkoutPaused ? 'text-amber-400' : 'text-emerald-400'}`}>
                    <ElapsedClock 
                      startedAt={startedAt} 
                      pausedAt={pausedAt} 
                      pausedTotalMs={pausedTotalMs} 
                    />
                  </span>
                </div>
                <div className="hidden sm:flex items-center gap-2 border-l border-slate-700 pl-3">
                  <span className="px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 text-xs font-bold uppercase tracking-wider border border-blue-500/30">
                    {qualities.find(q => q.id === selectedQualityId)?.name || selectedQualityId}
                  </span>
                </div>
              </div>

              {/* Compteurs Tonnage & Séries */}
              <div className="flex items-center gap-2 sm:gap-4 text-xs font-bold text-slate-300">
                <div className="bg-slate-800/80 px-2 sm:px-3 py-1 rounded-lg border border-slate-700/60 flex items-center gap-1.5">
                  <Dumbbell size={13} className="text-blue-400" />
                  <span className="font-mono tabular-nums text-white">{totalTonnageKg.toLocaleString()}</span>
                  <span className="text-[10px] text-slate-400 font-normal">kg</span>
                </div>
                <div className="bg-slate-800/80 px-2 sm:px-3 py-1 rounded-lg border border-slate-700/60 flex items-center gap-1.5">
                  <CheckCircle2 size={13} className="text-emerald-400" />
                  <span className="font-mono tabular-nums text-emerald-300">{totalCompletedSets}</span>
                  <span className="text-slate-500">/</span>
                  <span className="font-mono tabular-nums text-slate-400">{totalPlannedSets}</span>
                </div>
              </div>

              {/* Bouton Pause & Fin de séance */}
              <div className="flex items-center gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onClick={toggleKeepScreenAwake}
                  className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                    keepScreenAwake 
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20' 
                      : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300'
                  }`}
                  title={keepScreenAwake ? "Écran maintenu allumé (cliquer pour autoriser la veille)" : "Veille automatique autorisée (cliquer pour forcer l'écran allumé)"}
                  aria-label={keepScreenAwake ? "Écran maintenu allumé actif" : "Mise en veille normale de l'écran active"}
                >
                  <Sun size={16} />
                </button>
                <button
                  type="button"
                  onClick={handleToggleWorkoutPause}
                  className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                    isWorkoutPaused 
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300' 
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                  }`}
                  title={isWorkoutPaused ? 'Reprendre la séance' : 'Mettre la séance en pause'}
                  aria-label={isWorkoutPaused ? 'Reprendre la séance' : 'Mettre la séance en pause'}
                >
                  {isWorkoutPaused ? <Play size={16} /> : <Pause size={16} />}
                </button>
                <button
                  type="button"
                  onClick={handleOpenSummary}
                  className="px-3 sm:px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs sm:text-sm transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-1.5 cursor-pointer"
                >
                  <Award size={15} />
                  <span>Terminer</span>
                </button>
              </div>
            </div>

            {/* BANNIÈRE MINUTEUR DE REPOS AUTONOME (Zéro dérive, aucun re-rendu du parent) */}
            {restTimerState && (
              <GymRestTimer
                timerState={restTimerState}
                soundEnabled={soundEnabled}
                onDone={handleSkipRestTimer}
                onAdjust={handleAdjustRestTimer}
                onTogglePause={handleToggleRestPause}
                onSkip={handleSkipRestTimer}
              />
            )}

            {/* CONTENU PRINCIPAL : LISTE DES EXERCICES ET SÉRIES */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-4">
              {activeExercises.map((ex, exIdx) => (
                <GymActiveExercise
                  key={ex.id}
                  exercise={ex}
                  exerciseIndex={exIdx}
                  adaptiveSuggestion={adaptiveProgressionMap.get(ex.exerciseCatalogId)}
                  onUpdateSetValue={handleUpdateSetValue}
                  onQuickAdjustWeight={handleQuickAdjustWeight}
                  onQuickAdjustReps={handleQuickAdjustReps}
                  onValidateSet={handleValidateSet}
                  onRemoveSet={handleRemoveSet}
                  onAddSet={handleAddSetToExercise}
                  onRemoveExercise={handleRemoveExercise}
                  onApplyAdaptiveSuggestion={handleApplyAdaptiveSuggestion}
                />
              ))}


              {/* Bouton pour ajouter un exercice */}
              <button
                type="button"
                onClick={() => {
                  setExpandedMuscles({});
                  setExerciseSearch('');
                  setShowAddExercisePicker(true);
                }}
                className="w-full py-3.5 rounded-2xl border-2 border-dashed border-slate-700 hover:border-blue-500/60 bg-slate-900/40 hover:bg-blue-950/20 text-slate-300 hover:text-white font-bold text-sm transition-all flex items-center justify-center gap-2 group cursor-pointer"
              >
                <div className="p-1 rounded-lg bg-blue-500/20 text-blue-400 group-hover:scale-110 transition-transform">
                  <Plus size={16} />
                </div>
                <span>Ajouter un exercice à la séance</span>
              </button>
            </div>

            {/* Bottom Bar Mobile Helper */}
            <div className="bg-slate-900 border-t border-slate-800 p-2.5 sm:hidden flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <Timer size={13} className="text-emerald-400" />
                Validation = Repos auto
              </span>
              <button
                type="button"
                onClick={handleAbandonWorkout}
                className="text-rose-400 hover:text-rose-300 text-[11px] font-bold"
              >
                Abandonner
              </button>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* ÉCRAN 3 : RÉCAPITULATIF ET ENREGISTREMENT DANS LA FILIÈRE            */}
        {/* ==================================================================== */}
        {stage === 'summary' && (
          <div className="p-5 sm:p-8 space-y-6 overflow-y-auto">
            {/* Header Résumé */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <Award size={26} />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                    Séance Terminée ! 🎯
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-400 font-medium mt-0.5">
                    Validation des métriques et intégration directe dans la filière <strong>{qualities.find(q => q.id === selectedQualityId)?.name || selectedQualityId}</strong>.
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setStage('active')}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors"
              >
                ← Retour à la séance
              </button>
            </div>

            {/* Métriques Clés Résumées */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700/80">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Durée réelle</span>
                <span className="font-mono font-black text-xl text-white">
                  {Math.max(5, Math.round(getElapsedSeconds() / 60))} <span className="text-xs font-normal text-slate-400">min</span>
                </span>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700/80">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Tonnage cumulé</span>
                <span className="font-mono font-black text-xl text-blue-400">
                  {totalTonnageKg.toLocaleString()} <span className="text-xs font-normal text-slate-400">kg</span>
                </span>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700/80">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Séries effectives</span>
                <span className="font-mono font-black text-xl text-emerald-400">
                  {totalCompletedSets} <span className="text-xs font-normal text-slate-400">séries</span>
                </span>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700/80">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Exercices réalisés</span>
                <span className="font-mono font-black text-xl text-purple-400">
                  {activeExercises.length}
                </span>
              </div>
            </div>

            {/* Historique détaillé des séries complétées */}
            <GymSetHistory 
              exercises={activeExercises}
              totalTonnageKg={totalTonnageKg}
              totalCompletedSets={totalCompletedSets}
              totalPlannedSets={totalPlannedSets}
              elapsedSeconds={getElapsedSeconds()}
            />

            {/* Saisie RPE & Fatigue */}
            <div className="space-y-4 bg-black/40 p-4 sm:p-5 rounded-2xl border border-slate-800">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Ressenti et charge physiologique
              </h4>

              {/* RPE Musculaire */}
              <div>
                <div className="flex items-center justify-between text-xs font-bold text-slate-300 mb-1">
                  <label htmlFor="summary-rpe-musc">RPE Musculaire (Difficulté perçue de 1 à 10)</label>
                  <span className="font-mono text-base text-blue-400">{sessionRpeMusc} / 10</span>
                </div>
                <input
                  id="summary-rpe-musc"
                  type="range"
                  min="1"
                  max="10"
                  step="0.5"
                  value={sessionRpeMusc}
                  onChange={(e) => setSessionRpeMusc(Number(e.target.value))}
                  aria-label="RPE Musculaire : difficulté perçue de l'effort"
                  aria-valuemin={1}
                  aria-valuemax={10}
                  aria-valuenow={sessionRpeMusc}
                  aria-valuetext={`RPE ${sessionRpeMusc} sur 10. ${
                    sessionRpeMusc >= 9 ? 'Effort maximal ou proche de l échec' :
                    sessionRpeMusc >= 7.5 ? 'Effort difficile, 1 à 2 répétitions en réserve' :
                    sessionRpeMusc >= 6 ? 'Effort modéré à soutenu' : 'Effort léger'
                  }`}
                  className="w-full accent-blue-500 h-2 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* RPE Cardio */}
              <div>
                <div className="flex items-center justify-between text-xs font-bold text-slate-300 mb-1">
                  <label htmlFor="summary-rpe-cardio">RPE Cardio (Essoufflement de 1 à 10)</label>
                  <span className="font-mono text-base text-emerald-400">{sessionRpeCardio} / 10</span>
                </div>
                <input
                  id="summary-rpe-cardio"
                  type="range"
                  min="1"
                  max="10"
                  step="0.5"
                  value={sessionRpeCardio}
                  onChange={(e) => setSessionRpeCardio(Number(e.target.value))}
                  aria-label="RPE Cardio : ressenti cardiovasculaire"
                  aria-valuemin={1}
                  aria-valuemax={10}
                  aria-valuenow={sessionRpeCardio}
                  aria-valuetext={`RPE Cardio ${sessionRpeCardio} sur 10`}
                  className="w-full accent-emerald-500 h-2 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Fatigue globale */}
              <div>
                <div className="flex items-center justify-between text-xs font-bold text-slate-300 mb-1">
                  <label htmlFor="summary-fatigue">Fatigue ressentie post-séance</label>
                  <span className="font-mono text-base text-amber-400">{sessionFatigue} / 10</span>
                </div>
                <input
                  id="summary-fatigue"
                  type="range"
                  min="1"
                  max="10"
                  step="0.5"
                  value={sessionFatigue}
                  onChange={(e) => setSessionFatigue(Number(e.target.value))}
                  aria-label="Fatigue globale ressentie après la séance"
                  aria-valuemin={1}
                  aria-valuemax={10}
                  aria-valuenow={sessionFatigue}
                  aria-valuetext={`Niveau de fatigue ${sessionFatigue} sur 10`}
                  className="w-full accent-amber-500 h-2 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Notes optionnelles */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Notes de la séance (optionnel)
                </label>
                <input
                  type="text"
                  value={workoutNotes}
                  onChange={(e) => setWorkoutNotes(e.target.value)}
                  placeholder="Ex: Excellentes sensations sur le développé couché, congestion forte"
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* Checkbox application impacts */}
              <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer pt-2">
                <input
                  type="checkbox"
                  checked={applyImpacts}
                  onChange={(e) => setApplyImpacts(e.target.checked)}
                  className="w-4 h-4 rounded accent-emerald-500"
                />
                <span>
                  Appliquer les impacts métaboliques, mettre à jour la fatigue des qualités associées et le volume MEV/MRV
                </span>
              </label>
            </div>

            {/* Boutons d'action fin */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleAbandonWorkout}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-rose-400 hover:text-rose-300 font-bold text-xs sm:text-sm transition-colors"
              >
                Abandonner sans enregistrer
              </button>
              <button
                type="button"
                onClick={handleConfirmSaveSession}
                className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs sm:text-sm transition-all shadow-xl shadow-emerald-500/20 flex items-center gap-2 cursor-pointer"
              >
                <Check size={16} />
                <span>Enregistrer dans {qualities.find(q => q.id === selectedQualityId)?.name || 'la qualité'}</span>
              </button>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* MODALE TIERS : CATALOGUE POUR AJOUTER UN EXERCICE                    */}
        {/* ==================================================================== */}
        {showAddExercisePicker && (
          <div 
            className="absolute inset-0 z-50 bg-black/90 p-4 flex flex-col justify-end sm:justify-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-exercise-modal-title"
          >
            <div className="bg-slate-900 border border-slate-700 rounded-2xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl max-w-xl mx-auto w-full animate-fadeIn">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Dumbbell size={18} className="text-blue-400" aria-hidden="true" />
                  <h3 id="add-exercise-modal-title" className="font-bold text-white text-base">Ajouter un exercice</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddExercisePicker(false)}
                  className="min-h-[40px] min-w-[40px] rounded-lg text-slate-400 hover:text-white flex items-center justify-center transition-colors"
                  aria-label="Fermer le sélecteur d'exercices"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Recherche et filtres catégories */}
              <div className="p-3 border-b border-slate-800 space-y-2 bg-slate-950/50">
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden="true" />
                  <input
                    type="text"
                    autoFocus
                    value={exerciseSearch}
                    onChange={(e) => setExerciseSearch(e.target.value)}
                    placeholder="Rechercher (ex: Squat, Développé, Traction...)"
                    aria-label="Rechercher un exercice dans le catalogue"
                    className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs" role="toolbar" aria-label="Filtres de catégories">
                  {[
                    ...(frequentExercises.length > 0 ? [{ id: 'frequent', label: 'Récents & Fréquents' }] : []),
                    { id: 'all', label: isPullSession ? 'Tous (Pull en 1er)' : 'Tous' },
                    { id: 'upper_pull', label: isPullSession ? 'Pull (Séance)' : 'Pull (Dos/Biceps)' },
                    { id: 'upper_push', label: 'Push (Pecs/Épaules/Triceps)' },
                    { id: 'lower', label: 'Jambes' },
                    { id: 'core', label: 'Abdos/Core' }
                  ].map(cat => {
                    const isSelected = selectedCategoryFilter === cat.id;
                    const isSessionCat = isPullSession && cat.id === 'upper_pull';
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setSelectedCategoryFilter(cat.id)}
                        className={`px-2.5 py-1 rounded-lg whitespace-nowrap font-bold text-[11px] transition-all flex items-center gap-1 ${
                          isSelected
                            ? isSessionCat
                              ? 'bg-emerald-500 text-slate-950 font-black shadow-md shadow-emerald-500/20'
                              : 'bg-blue-600 text-white'
                            : isSessionCat
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                            : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {cat.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Entête contrôle de la liste */}
              <div className="px-3 pt-2 pb-1 flex items-center justify-between text-[11px] text-slate-400 border-b border-slate-800/60 bg-slate-950/30">
                <span className="flex items-center gap-1.5 font-bold text-slate-300">
                  <Layers size={13} className="text-blue-400" />
                  {selectedCategoryFilter === 'frequent'
                    ? 'Vos exercices favoris récents'
                    : 'Classé par muscle principal travaillé'}
                </span>
                {selectedCategoryFilter !== 'frequent' && (
                  <button
                    type="button"
                    onClick={toggleAllMuscleGroups}
                    className="text-blue-400 hover:text-blue-300 font-bold transition-colors cursor-pointer text-[10px] px-2 py-0.5 rounded bg-blue-500/10 hover:bg-blue-500/20"
                  >
                    {ORDERED_PRIMARY_MUSCLES.some(m => !isMuscleExpanded(m.id)) ? 'Tout déplier' : 'Tout replier'}
                  </button>
                )}
              </div>

              {/* Liste filtrée et organisée par muscle principal */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
                {selectedCategoryFilter === 'frequent' ? (
                  /* Affichage direct des exercices fréquents */
                  <div className="space-y-1.5 divide-y divide-slate-800/40">
                    {allExercises
                      .filter(ex => frequentMap.has(ex.id))
                      .filter(ex => !exerciseSearch.trim() || ex.name.toLowerCase().includes(exerciseSearch.toLowerCase().trim()))
                      .sort((a, b) => (frequentMap.get(b.id) || 0) - (frequentMap.get(a.id) || 0))
                      .map(catalogEx => {
                        const usageCount = frequentMap.get(catalogEx.id) || 1;
                        const primaryMuscleId = getExercisePrimaryMuscle(catalogEx);
                        const muscleMeta = MUSCLE_GROUPS[primaryMuscleId];

                        return (
                          <button
                            key={catalogEx.id}
                            type="button"
                            onClick={() => handleAddExerciseFromCatalog(catalogEx)}
                            className="w-full text-left p-2.5 rounded-xl transition-all flex items-center justify-between group pt-3 bg-slate-800/90 border border-amber-500/35 hover:border-amber-400 hover:bg-slate-800 shadow-sm cursor-pointer"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 inline-flex items-center gap-1">
                                  Fréquent ({usageCount}×)
                                </span>
                                <span className="font-black text-sm text-white">
                                  {catalogEx.name}
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400">
                                {muscleMeta && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/15 text-blue-300">
                                    {muscleMeta.name}
                                  </span>
                                )}
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${catalogEx.isCompound ? 'bg-blue-500/15 text-blue-300' : 'bg-emerald-500/15 text-emerald-300'}`}>
                                  {catalogEx.isCompound ? 'Polyarticulaire' : 'Isolation'}
                                </span>
                                <span>·</span>
                                <span className="text-[10px]">Défaut : {catalogEx.defaultReps} reps</span>
                              </div>
                            </div>
                            <Plus size={18} className="text-amber-400 group-hover:scale-125 transition-transform shrink-0 ml-2" />
                          </button>
                        );
                      })}
                  </div>
                ) : (
                  /* Affichage par groupe de muscle principal (liste déroulante accordéon) */
                  ORDERED_PRIMARY_MUSCLES
                    .filter(muscle => {
                      if (selectedCategoryFilter === 'all') return true;
                      return muscle.category === selectedCategoryFilter;
                    })
                    .sort((a, b) => {
                      // Si séance Pull, placer les muscles de Pull en premier
                      if (isPullSession) {
                        const aIsPull = a.category === 'upper_pull';
                        const bIsPull = b.category === 'upper_pull';
                        if (aIsPull && !bIsPull) return -1;
                        if (!aIsPull && bIsPull) return 1;
                      } else if (targetSessionCategory) {
                        const aIsTarget = a.category === targetSessionCategory;
                        const bIsTarget = b.category === targetSessionCategory;
                        if (aIsTarget && !bIsTarget) return -1;
                        if (!aIsTarget && bIsTarget) return 1;
                      }
                      return 0;
                    })
                    .map(muscle => {
                      const muscleExercises = allExercises
                        .filter(ex => getExercisePrimaryMuscle(ex) === muscle.id)
                        .filter(ex => !exerciseSearch.trim() || ex.name.toLowerCase().includes(exerciseSearch.toLowerCase().trim()))
                        .sort((a, b) => {
                          const aCount = frequentMap.get(a.id) || 0;
                          const bCount = frequentMap.get(b.id) || 0;
                          if (aCount !== bCount) return bCount - aCount;
                          return a.name.localeCompare(b.name, 'fr');
                        });

                      if (muscleExercises.length === 0) return null;

                      const isExpanded = isMuscleExpanded(muscle.id);
                      const isTargetMuscle = (isPullSession && muscle.category === 'upper_pull') || (targetSessionCategory === muscle.category);

                      return (
                        <div key={muscle.id} className="space-y-1.5 pt-0.5">
                          {/* En-tête déroulant du muscle principal */}
                          <button
                            type="button"
                            onClick={() => toggleMuscleCollapse(muscle.id)}
                            aria-expanded={isExpanded}
                            aria-controls={`muscle-group-panel-${muscle.id}`}
                            className={`w-full flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                              isTargetMuscle
                                ? 'bg-emerald-950/35 border-emerald-500/40 hover:bg-emerald-950/50 text-emerald-200 shadow-sm'
                                : 'bg-slate-800/80 border-slate-700/60 hover:bg-slate-800 text-slate-200'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-xs text-white tracking-wide">
                                {muscle.name}
                              </span>
                              {isTargetMuscle && (
                                <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                  {isPullSession ? 'Cible Pull' : 'Cible Séance'}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-400">
                              <span className="text-[10px] font-mono font-bold bg-black/40 px-2 py-0.5 rounded-md text-slate-300">
                                {muscleExercises.length} exo{muscleExercises.length > 1 ? 's' : ''}
                              </span>
                              {isExpanded ? <ChevronUp size={15} className="text-slate-400" /> : <ChevronDown size={15} className="text-slate-400" />}
                            </div>
                          </button>

                          {/* Exercices déroulés pour ce muscle */}
                          {isExpanded && (
                            <div 
                              id={`muscle-group-panel-${muscle.id}`}
                              className="space-y-1.5 pl-1 sm:pl-2 pt-0.5 animate-fadeIn"
                            >
                              {muscleExercises.map(catalogEx => {
                                const isFrequent = frequentMap.has(catalogEx.id);
                                const usageCount = frequentMap.get(catalogEx.id);
                                const isTargetSessionEx = isTargetMuscle;

                                return (
                                  <button
                                    key={catalogEx.id}
                                    type="button"
                                    onClick={() => handleAddExerciseFromCatalog(catalogEx)}
                                    className={`w-full text-left p-2.5 rounded-xl transition-all flex items-center justify-between group cursor-pointer ${
                                      isTargetSessionEx
                                        ? 'bg-gradient-to-r from-emerald-950/45 via-slate-800/90 to-slate-800/80 border-2 border-emerald-500/60 hover:border-emerald-400 hover:bg-emerald-950/50 shadow-sm'
                                        : isFrequent
                                        ? 'bg-slate-800/90 border border-amber-500/35 hover:border-amber-400 hover:bg-slate-800 shadow-sm'
                                        : 'hover:bg-slate-800/80 border border-slate-800/70 bg-slate-900/40'
                                    }`}
                                  >
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        {isTargetSessionEx && (
                                          <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 inline-flex items-center gap-1">
                                            {isPullSession ? 'Pull' : 'Séance'}
                                          </span>
                                        )}
                                        {isFrequent && !isTargetSessionEx && (
                                          <span className="px-1.5 py-0.2 rounded text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 inline-flex items-center gap-1">
                                            Fréquent ({usageCount}×)
                                          </span>
                                        )}
                                        {isFrequent && isTargetSessionEx && (
                                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-500/15 text-amber-300/90 border border-amber-500/30 inline-flex items-center gap-1">
                                            Fréquent ({usageCount}×)
                                          </span>
                                        )}
                                        <span className={`block ${
                                          isTargetSessionEx 
                                            ? 'font-black text-sm text-white group-hover:text-emerald-200' 
                                            : isFrequent 
                                            ? 'font-black text-sm text-white' 
                                            : 'font-bold text-sm text-slate-200 group-hover:text-white'
                                        }`}>
                                          {catalogEx.name}
                                        </span>
                                      </div>
                                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400">
                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/15 text-blue-300">
                                          {muscle.name}
                                        </span>
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                          isTargetSessionEx
                                            ? 'bg-emerald-500/20 text-emerald-300'
                                            : catalogEx.isCompound 
                                            ? 'bg-blue-500/15 text-blue-300' 
                                            : 'bg-emerald-500/15 text-emerald-300'
                                        }`}>
                                          {catalogEx.isCompound ? 'Polyarticulaire' : 'Isolation'}
                                        </span>
                                        <span>·</span>
                                        <span className="text-[10px]">Défaut : {catalogEx.defaultReps} reps</span>
                                        <span>·</span>
                                        <span className="text-[10px] text-slate-400">
                                          {Object.entries(catalogEx.muscleRatios || {})
                                            .map(([mId, r]) => `${MUSCLE_GROUPS[mId]?.name || mId} (${Math.round(r * 100)}%)`)
                                            .join(', ')}
                                        </span>
                                      </div>
                                    </div>
                                    <Plus size={18} className={`${isTargetSessionEx ? 'text-emerald-400' : isFrequent ? 'text-amber-400' : 'text-blue-400'} group-hover:scale-125 transition-transform shrink-0 ml-2`} />
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
