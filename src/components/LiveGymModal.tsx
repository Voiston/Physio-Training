import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Play, Pause, RotateCcw, Plus, Trash2, Check, Clock, Dumbbell, 
  ChevronDown, ChevronUp, AlertCircle, Sparkles, Volume2, VolumeX,
  X, Flame, Zap, ArrowRight, CheckCircle2, ChevronRight, Search, 
  Layers, ShieldAlert, Award, Timer, BatteryCharging, Info
} from 'lucide-react';
import { 
  MUSCLE_GROUPS, 
  getAllExerciseCatalog, 
  getSavedCustomExercises,
  findLastExercisePerformance, 
  computeAdaptiveProgression,
  computeSessionMuscularBreakdown,
  ExerciseDefinition
} from '../utils/muscleHelpers';
import { 
  playCountdownBeep, 
  playRestCompleteChime, 
  playSetCompletedSound, 
  playVictoryFanfare, 
  triggerVibration 
} from '../utils/audioHelpers';
import { haptics } from '../utils/haptics';

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
  startedAt: number; // timestamp
  elapsedSeconds: number;
  isPaused: boolean;
  exercises: LiveExercise[];
  restTimer: {
    running: boolean;
    remainingSeconds: number;
    targetSeconds: number;
    exerciseName?: string;
    setNumber?: number;
  } | null;
}

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
  events: Record<string, Record<string, any>>;
  initialDateStr: string;
  onSaveSession: (qualityId: string, dateStr: string, sessionData: any, applyImpacts: boolean) => void;
}

const STORAGE_DRAFT_KEY = 'training_live_session_draft_v1';
const DEFAULT_REST_PRESETS = [45, 60, 90, 120, 180];

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

  // Draft en cours
  const [draftExists, setDraftExists] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Chrono général de séance
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isWorkoutPaused, setIsWorkoutPaused] = useState(false);

  // Minuteur de repos
  const [restTimer, setRestTimer] = useState<{
    running: boolean;
    remaining: number;
    total: number;
    label?: string;
  } | null>(null);

  // Exercices actifs
  const [activeExercises, setActiveExercises] = useState<LiveExercise[]>([]);

  // Modale d'ajout d'exercice
  const [showAddExercisePicker, setShowAddExercisePicker] = useState(false);
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');

  // Fin de séance (Summary)
  const [sessionRpeMusc, setSessionRpeMusc] = useState<number>(8);
  const [sessionRpeCardio, setSessionRpeCardio] = useState<number>(3);
  const [sessionFatigue, setSessionFatigue] = useState<number>(4);
  const [applyImpacts, setApplyImpacts] = useState<boolean>(true);
  const [workoutNotes, setWorkoutNotes] = useState<string>('');

  // Custom exercises catalog
  const customExercises = useMemo(() => getSavedCustomExercises(), []);
  const allExercises = useMemo(() => getAllExerciseCatalog(customExercises), [customExercises]);

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

  // Gestion du Wake Lock API pour empêcher l'écran du smartphone de se verrouiller
  const wakeLockRef = useRef<any>(null);

  useEffect(() => {
    if (!isOpen || stage !== 'active') {
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
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        }
      } catch (err) {
        // Le navigateur ou les réglages économie d'énergie peuvent refuser
      }
    };

    requestWakeLock();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && stage === 'active') {
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
  }, [isOpen, stage]);

  // Vérifier s'il existe déjà un brouillon sauvegardé dans localStorage
  useEffect(() => {
    if (!isOpen) return;
    try {
      const saved = localStorage.getItem(STORAGE_DRAFT_KEY);
      if (saved) {
        const parsed: LiveSessionDraft = JSON.parse(saved);
        if (parsed.exercises && parsed.exercises.length > 0) {
          setDraftExists(true);
        }
      }
    } catch (e) {
      // Ignore
    }
  }, [isOpen]);

  // Sauvegarde automatique du brouillon en continu pendant la séance active
  useEffect(() => {
    if (stage !== 'active' || activeExercises.length === 0) return;
    try {
      const draft: LiveSessionDraft = {
        qualityId: selectedQualityId,
        dateStr: initialDateStr,
        startedAt: Date.now() - (elapsedSeconds * 1000),
        elapsedSeconds,
        isPaused: isWorkoutPaused,
        exercises: activeExercises,
        restTimer: restTimer ? {
          running: restTimer.running,
          remainingSeconds: restTimer.remaining,
          targetSeconds: restTimer.total,
          exerciseName: restTimer.label
        } : null
      };
      localStorage.setItem(STORAGE_DRAFT_KEY, JSON.stringify(draft));
    } catch (e) {
      // Ignore
    }
  }, [stage, activeExercises, elapsedSeconds, isWorkoutPaused, restTimer, selectedQualityId, initialDateStr]);

  // Timer principal : Chronomètre de la séance
  useEffect(() => {
    if (stage !== 'active' || isWorkoutPaused) return;
    const interval = setInterval(() => {
      setElapsedSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [stage, isWorkoutPaused]);

  // Minuteur de repos : Décompte, bips sonores et carillon final
  useEffect(() => {
    if (stage !== 'active' || !restTimer || !restTimer.running) return;

    if (restTimer.remaining <= 0) {
      // Fin du repos atteinte !
      if (soundEnabled) {
        playRestCompleteChime();
        triggerVibration([200, 100, 200, 100, 400]);
      }
      setRestTimer(null);
      return;
    }

    // Bips d'avertissement aux 3 dernières secondes
    if (soundEnabled && restTimer.remaining <= 3 && restTimer.remaining >= 1) {
      playCountdownBeep(restTimer.remaining === 1 ? 660 : 520, 80);
      triggerVibration(40);
    }

    const timer = setTimeout(() => {
      setRestTimer(prev => {
        if (!prev) return null;
        return {
          ...prev,
          remaining: prev.remaining - 1
        };
      });
    }, 1000);

    return () => clearTimeout(timer);
  }, [stage, restTimer, soundEnabled]);

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

  // Formattage temps
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remSecs = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remSecs.toString().padStart(2, '0')}`;
  };

  // --- ACTIONS INITIALISATION ---
  const handleStartBlank = () => {
    // Démarrer séance vierge
    setElapsedSeconds(0);
    setIsWorkoutPaused(false);
    setRestTimer(null);
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

    const clonedExercises: LiveExercise[] = lastSessionForQuality.session.exercises.map((rawEx: any, idx: number) => {
      const def = allExercises.find(e => e.id === rawEx.id) || {
        id: rawEx.id,
        name: rawEx.name || 'Exercice',
        category: 'upper_push',
        defaultReps: rawEx.reps || 10,
        muscleRatios: {}
      };

      const setCount = Math.max(1, Number(rawEx.sets) || 3);
      const defaultWeight = Number(rawEx.weightKg) || 0;
      const defaultReps = Number(rawEx.reps) || def.defaultReps || 10;
      const defaultRir = Number(rawEx.rir ?? 2);

      const sets: LiveSet[] = Array.from({ length: setCount }, (_, sIdx) => ({
        id: `s_${Date.now()}_${idx}_${sIdx + 1}`,
        setNumber: sIdx + 1,
        weightKg: defaultWeight,
        reps: defaultReps,
        rir: defaultRir,
        restSeconds: 90,
        completed: false
      }));

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
    setElapsedSeconds(0);
    setIsWorkoutPaused(false);
    setRestTimer(null);
    haptics.modeSwitch();
    setStage('active');
  };

  const handleResumeDraft = () => {
    try {
      const saved = localStorage.getItem(STORAGE_DRAFT_KEY);
      if (saved) {
        const parsed: LiveSessionDraft = JSON.parse(saved);
        if (parsed.qualityId) setSelectedQualityId(parsed.qualityId);
        if (parsed.elapsedSeconds) setElapsedSeconds(parsed.elapsedSeconds);
        if (parsed.isPaused !== undefined) setIsWorkoutPaused(parsed.isPaused);
        if (parsed.exercises && parsed.exercises.length > 0) {
          setActiveExercises(parsed.exercises);
        }
        if (parsed.restTimer && parsed.restTimer.remainingSeconds > 0) {
          setRestTimer({
            running: parsed.restTimer.running,
            remaining: parsed.restTimer.remainingSeconds,
            total: parsed.restTimer.targetSeconds,
            label: parsed.restTimer.exerciseName
          });
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

      // Lancement automatique du minuteur de repos
      const restSecs = currentSet.restSeconds || 90;
      setRestTimer({
        running: true,
        remaining: restSecs,
        total: restSecs,
        label: `${ex.name} (Série ${currentSet.setNumber})`
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

  const handleUpdateSetValue = (exerciseIndex: number, setIndex: number, field: keyof LiveSet, value: any) => {
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

  const handleAddExerciseFromCatalog = (catalogEx: ExerciseDefinition) => {
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
  const handleAdjustRestTimer = (deltaSecs: number) => {
    if (!restTimer) return;
    setRestTimer(prev => {
      if (!prev) return null;
      const nextRemaining = Math.max(0, prev.remaining + deltaSecs);
      return {
        ...prev,
        remaining: nextRemaining,
        total: Math.max(prev.total, nextRemaining)
      };
    });
  };

  const handleToggleRestPause = () => {
    if (!restTimer) return;
    setRestTimer(prev => prev ? { ...prev, running: !prev.running } : null);
  };

  const handleSkipRestTimer = () => {
    setRestTimer(null);
  };

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
    const sessionDurationMin = Math.max(5, Math.round(elapsedSeconds / 60));
    const isIso = selectedQualityId === 'isolation';

    // Synthétiser les exercices
    const packagedExercises = activeExercises.map(ex => {
      const completed = ex.sets.filter(s => s.completed);
      const targetSets = completed.length > 0 ? completed : ex.sets;
      const setCount = targetSets.length;
      const avgWeight = Math.round(targetSets.reduce((acc, s) => acc + (s.weightKg || 0), 0) / setCount);
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
        detailSets: ex.sets.map(s => ({
          weightKg: s.weightKg,
          reps: s.reps,
          rir: s.rir,
          completed: s.completed
        }))
      };
    });

    const lMusc = Math.round(sessionDurationMin * sessionRpeMusc);
    const lCardio = Math.round(sessionDurationMin * sessionRpeCardio);
    const lTotal = lMusc; // Musculation

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
      completedAt: new Date().toISOString()
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

    onClose();
  };

  const handleAbandonWorkout = () => {
    if (window.confirm('Voulez-vous vraiment abandonner cette séance ? Les données non enregistrées seront effacées.')) {
      haptics.warning();
      try {
        localStorage.removeItem(STORAGE_DRAFT_KEY);
      } catch (e) {
        // Ignore
      }
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-0 sm:p-4 overflow-hidden">
      <div 
        className="relative w-full max-w-4xl bg-slate-900 border-0 sm:border border-slate-700/80 rounded-none sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[100dvh] sm:h-auto sm:max-h-[96vh] animate-fadeIn"
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
                    <Dumbbell size={24} />
                  </span>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                      Mode Salle <span className="text-emerald-400">· Live Gym</span>
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-400 font-medium mt-0.5">
                      Saisie tactile en temps réel, minuteur de repos automatique et charge adaptative.
                    </p>
                  </div>
                </div>
              </div>
              <button 
                onClick={onClose}
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

            {/* Préférences Audio */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs text-slate-400">
              <span className="flex items-center gap-2">
                <Timer size={15} className="text-slate-400" />
                Minuteur automatique après validation de série (bips & haptique)
              </span>
              <button
                type="button"
                onClick={() => setSoundEnabled(!soundEnabled)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition-colors"
              >
                {soundEnabled ? <Volume2 size={14} className="text-emerald-400" /> : <VolumeX size={14} className="text-rose-400" />}
                {soundEnabled ? 'Sons activés' : 'Muet'}
              </button>
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
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                  <span className="font-mono font-black text-lg sm:text-2xl text-emerald-400 tabular-nums">
                    {formatTime(elapsedSeconds)}
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
                  onClick={() => setIsWorkoutPaused(!isWorkoutPaused)}
                  className={`p-2 rounded-xl border transition-colors ${
                    isWorkoutPaused 
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300' 
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                  }`}
                  title={isWorkoutPaused ? 'Reprendre' : 'Mettre en pause'}
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

            {/* BANNIÈRE MINUTEUR DE REPOS FLOTTANTE / ACTIVE */}
            {restTimer && (
              <div className="bg-gradient-to-r from-blue-900/90 via-indigo-900/90 to-purple-900/90 border-b border-indigo-500/40 px-3 sm:px-6 py-2.5 flex items-center justify-between gap-3 animate-fadeIn shrink-0 shadow-lg">
                <div className="flex items-center gap-3">
                  <div className="relative flex items-center justify-center w-10 h-10 rounded-full bg-indigo-500/30 border border-indigo-400/50">
                    <Timer size={18} className="text-indigo-200 animate-pulse" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-indigo-200 uppercase tracking-wider">Repos en cours</span>
                      {restTimer.label && (
                        <span className="text-[11px] text-indigo-300/80 truncate max-w-[150px] sm:max-w-xs">
                          {restTimer.label}
                        </span>
                      )}
                    </div>
                    <div className="font-mono font-black text-xl sm:text-2xl text-white tracking-tight tabular-nums">
                      {formatTime(restTimer.remaining)}
                    </div>
                  </div>
                </div>

                {/* Commandes rapides de repos (+30s, -15s, passer) */}
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <button
                    type="button"
                    onClick={() => handleAdjustRestTimer(-15)}
                    className="px-2 sm:px-2.5 py-1 rounded-lg bg-indigo-950/60 hover:bg-indigo-900 border border-indigo-400/30 text-[11px] font-bold text-indigo-200"
                    title="Enlever 15 secondes"
                  >
                    -15s
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAdjustRestTimer(30)}
                    className="px-2 sm:px-2.5 py-1 rounded-lg bg-indigo-950/60 hover:bg-indigo-900 border border-indigo-400/30 text-[11px] font-bold text-indigo-200"
                    title="Ajouter 30 secondes"
                  >
                    +30s
                  </button>
                  <button
                    type="button"
                    onClick={handleToggleRestPause}
                    className="p-1.5 rounded-lg bg-indigo-950/60 hover:bg-indigo-900 border border-indigo-400/30 text-indigo-200"
                    title={restTimer.running ? 'Pause' : 'Reprendre'}
                  >
                    {restTimer.running ? <Pause size={14} /> : <Play size={14} />}
                  </button>
                  <button
                    type="button"
                    onClick={handleSkipRestTimer}
                    className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] font-bold text-white transition-colors"
                  >
                    Passer
                  </button>
                </div>
              </div>
            )}

            {/* CONTENU PRINCIPAL : LISTE DES EXERCICES ET SÉRIES */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-4">
              {activeExercises.map((ex, exIdx) => {
                // Recherche de la dernière performance et progression adaptative pour cet exercice
                const lastPerf = findLastExercisePerformance(events, ex.exerciseCatalogId, initialDateStr);
                const adaptive = computeAdaptiveProgression(lastPerf, 4);

                return (
                  <div 
                    key={ex.id}
                    className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-3 sm:p-4 shadow-sm space-y-3"
                  >
                    {/* Header de l'exercice */}
                    <div className="flex items-start justify-between gap-2 border-b border-slate-700/50 pb-2.5">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-black text-base sm:text-lg text-white tracking-tight truncate">
                            {ex.name}
                          </h3>
                          {ex.category && (
                            <span className="px-2 py-0.5 rounded-md bg-slate-700/60 text-slate-300 text-[10px] font-bold uppercase tracking-wider">
                              {ex.category === 'lower' ? 'Bas' : ex.category === 'upper_push' ? 'Push' : ex.category === 'upper_pull' ? 'Pull' : 'Core'}
                            </span>
                          )}
                        </div>

                        {/* Suggestion adaptative si historique */}
                        {adaptive && adaptive.hasHistory && (
                          <div className="mt-1 flex items-center gap-2 flex-wrap text-xs">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold flex items-center gap-1 border ${
                              adaptive.status === 'increase'
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                : adaptive.status === 'decrease'
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                : 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                            }`}>
                              <Sparkles size={11} />
                              {adaptive.status === 'increase' ? 'Cible +' : adaptive.status === 'decrease' ? 'Décharge' : 'Maintien'} : 
                              {adaptive.suggestedWeightKg ? ` ${adaptive.suggestedWeightKg} kg` : ''} 
                              {adaptive.suggestedReps ? ` × ${adaptive.suggestedReps} reps` : ''} 
                              (RIR {adaptive.suggestedRir})
                            </span>
                            <span className="text-[11px] text-slate-400">
                              Précédent : {adaptive.lastWeightKg ? `${adaptive.lastWeightKg} kg` : ''} {adaptive.lastReps ? `× ${adaptive.lastReps}` : ''} ({adaptive.lastRir} RIR le {adaptive.lastDate})
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                // Appliquer la suggestion à toutes les séries non complétées de cet exercice
                                setActiveExercises(prev => {
                                  const clone = [...prev];
                                  clone[exIdx] = {
                                    ...clone[exIdx],
                                    sets: clone[exIdx].sets.map(s => {
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
                              }}
                              className="text-[10px] text-cyan-400 hover:text-cyan-300 underline font-bold cursor-pointer"
                            >
                              Appliquer à cet exercice
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Supprimer exercice */}
                      <button
                        type="button"
                        onClick={() => handleRemoveExercise(exIdx)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        title="Retirer cet exercice"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    {/* TABLEAU / CARTES DES SÉRIES TACTILES */}
                    <div className="space-y-2">
                      <div className="grid grid-cols-12 gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1">
                        <div className="col-span-1 text-center">Set</div>
                        <div className="col-span-4 sm:col-span-3 text-center">Charge (kg)</div>
                        <div className="col-span-3 sm:col-span-2 text-center">Reps</div>
                        <div className="hidden sm:block sm:col-span-2 text-center">RIR</div>
                        <div className="hidden sm:block sm:col-span-2 text-center">Repos</div>
                        <div className="col-span-4 sm:col-span-2 text-center">Validation</div>
                      </div>

                      {ex.sets.map((set, sIdx) => {
                        const isSetDone = set.completed;

                        return (
                          <div 
                            key={set.id}
                            className={`grid grid-cols-12 gap-1.5 items-center p-2 rounded-xl border transition-all ${
                              isSetDone
                                ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-100 shadow-sm'
                                : 'bg-slate-900/60 border-slate-700/60 text-slate-200'
                            }`}
                          >
                            {/* Numéro de série */}
                            <div className="col-span-1 flex flex-col items-center justify-center">
                              <span className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs ${
                                isSetDone ? 'bg-emerald-500/30 text-emerald-300 font-black' : 'bg-slate-800 text-slate-300'
                              }`}>
                                {set.setNumber}
                              </span>
                            </div>

                            {/* Charge (kg) avec boutons tactiles +/- */}
                            <div className="col-span-4 sm:col-span-3 flex items-center justify-center gap-1">
                              <button
                                type="button"
                                disabled={isSetDone}
                                onClick={() => handleQuickAdjustWeight(exIdx, sIdx, -2.5)}
                                className="w-7 sm:w-6 h-8 sm:h-7 rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-95 disabled:opacity-30 text-slate-300 text-sm sm:text-xs font-black flex items-center justify-center shrink-0 touch-manipulation select-none"
                                title="-2.5 kg"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                inputMode="decimal"
                                step="0.5"
                                disabled={isSetDone}
                                value={set.weightKg === 0 ? '' : set.weightKg}
                                onChange={(e) => handleUpdateSetValue(exIdx, sIdx, 'weightKg', Number(e.target.value) || 0)}
                                placeholder="0"
                                className="w-14 sm:w-16 h-8 text-center font-mono font-bold text-sm bg-black/40 border border-slate-700 disabled:border-transparent rounded-lg text-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
                              />
                              <button
                                type="button"
                                disabled={isSetDone}
                                onClick={() => handleQuickAdjustWeight(exIdx, sIdx, 2.5)}
                                className="w-7 sm:w-6 h-8 sm:h-7 rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-95 disabled:opacity-30 text-slate-300 text-sm sm:text-xs font-black flex items-center justify-center shrink-0 touch-manipulation select-none"
                                title="+2.5 kg"
                              >
                                +
                              </button>
                            </div>

                            {/* Répétitions avec boutons tactiles +/- */}
                            <div className="col-span-3 sm:col-span-2 flex items-center justify-center gap-1">
                              <button
                                type="button"
                                disabled={isSetDone}
                                onClick={() => handleQuickAdjustReps(exIdx, sIdx, -1)}
                                className="w-7 sm:w-6 h-8 sm:h-7 rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-95 disabled:opacity-30 text-slate-300 text-sm sm:text-xs font-black flex items-center justify-center shrink-0 touch-manipulation select-none"
                                title="-1 rep"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                inputMode="numeric"
                                disabled={isSetDone}
                                value={set.reps || ''}
                                onChange={(e) => handleUpdateSetValue(exIdx, sIdx, 'reps', Math.max(1, Number(e.target.value) || 1))}
                                placeholder="10"
                                className="w-11 sm:w-12 h-8 text-center font-mono font-bold text-sm bg-black/40 border border-slate-700 disabled:border-transparent rounded-lg text-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
                              />
                              <button
                                type="button"
                                disabled={isSetDone}
                                onClick={() => handleQuickAdjustReps(exIdx, sIdx, 1)}
                                className="w-7 sm:w-6 h-8 sm:h-7 rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-95 disabled:opacity-30 text-slate-300 text-sm sm:text-xs font-black flex items-center justify-center shrink-0 touch-manipulation select-none"
                                title="+1 rep"
                              >
                                +
                              </button>
                            </div>

                            {/* RIR (Répétitions en réserve) */}
                            <div className="hidden sm:flex sm:col-span-2 items-center justify-center">
                              <select
                                disabled={isSetDone}
                                value={set.rir}
                                onChange={(e) => handleUpdateSetValue(exIdx, sIdx, 'rir', Number(e.target.value))}
                                className="h-8 px-2 bg-black/40 border border-slate-700 disabled:border-transparent rounded-lg text-xs font-bold text-slate-200 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                              >
                                <option value="0">0 (Échec)</option>
                                <option value="1">1 (Trés dur)</option>
                                <option value="2">2 (Optimal)</option>
                                <option value="3">3 (Modéré)</option>
                                <option value="4">4+ (Léger)</option>
                              </select>
                            </div>

                            {/* Temps de repos par défaut pour ce set */}
                            <div className="hidden sm:flex sm:col-span-2 items-center justify-center">
                              <select
                                disabled={isSetDone}
                                value={set.restSeconds}
                                onChange={(e) => handleUpdateSetValue(exIdx, sIdx, 'restSeconds', Number(e.target.value))}
                                className="h-8 px-2 bg-black/40 border border-slate-700 disabled:border-transparent rounded-lg text-xs font-bold text-slate-200 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                              >
                                <option value="45">45s</option>
                                <option value="60">60s</option>
                                <option value="90">90s (1m30)</option>
                                <option value="120">120s (2m)</option>
                                <option value="180">180s (3m)</option>
                              </select>
                            </div>

                            {/* BOUTON TACTILE DE VALIDATION */}
                            <div className="col-span-4 sm:col-span-2 flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleValidateSet(exIdx, sIdx)}
                                className={`w-full h-8.5 py-1.5 px-2 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm touch-manipulation ${
                                  isSetDone
                                    ? 'bg-emerald-500/30 hover:bg-emerald-500/40 text-emerald-300 border border-emerald-500/40'
                                    : 'bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-300 text-slate-950 shadow-emerald-500/20 active:scale-95'
                                }`}
                              >
                                <Check size={15} className={isSetDone ? 'text-emerald-400' : 'text-slate-950 stroke-[3]'} />
                                <span>{isSetDone ? 'Fait' : 'Valider'}</span>
                              </button>

                              {/* Supprimer la série si plus d'une */}
                              {ex.sets.length > 1 && !isSetDone && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveSet(exIdx, sIdx)}
                                  className="w-7 h-8 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 flex items-center justify-center transition-colors touch-manipulation"
                                  title="Retirer cette série"
                                >
                                  <X size={15} />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Ajouter une série à cet exercice */}
                    <div className="pt-1 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => handleAddSetToExercise(exIdx)}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 hover:text-white transition-colors flex items-center gap-1.5 border border-slate-700/80"
                      >
                        <Plus size={13} /> Ajouter une série
                      </button>

                      <span className="text-[11px] text-slate-400">
                        {ex.sets.filter(s => s.completed).length} / {ex.sets.length} séries validées
                      </span>
                    </div>
                  </div>
                );
              })}

              {/* Bouton pour ajouter un exercice */}
              <button
                type="button"
                onClick={() => setShowAddExercisePicker(true)}
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
                  {Math.max(5, Math.round(elapsedSeconds / 60))} <span className="text-xs font-normal text-slate-400">min</span>
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

            {/* Saisie RPE & Fatigue */}
            <div className="space-y-4 bg-black/40 p-4 sm:p-5 rounded-2xl border border-slate-800">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Ressenti et charge physiologique
              </h4>

              {/* RPE Musculaire */}
              <div>
                <div className="flex items-center justify-between text-xs font-bold text-slate-300 mb-1">
                  <span>RPE Musculaire (Difficulté perçue de 1 à 10)</span>
                  <span className="font-mono text-base text-blue-400">{sessionRpeMusc} / 10</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="0.5"
                  value={sessionRpeMusc}
                  onChange={(e) => setSessionRpeMusc(Number(e.target.value))}
                  className="w-full accent-blue-500 h-2 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Fatigue globale */}
              <div>
                <div className="flex items-center justify-between text-xs font-bold text-slate-300 mb-1">
                  <span>Fatigue ressentie post-séance</span>
                  <span className="font-mono text-base text-amber-400">{sessionFatigue} / 10</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="0.5"
                  value={sessionFatigue}
                  onChange={(e) => setSessionFatigue(Number(e.target.value))}
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
          <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm p-4 flex flex-col justify-end sm:justify-center">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl max-w-xl mx-auto w-full animate-fadeIn">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Dumbbell size={18} className="text-blue-400" />
                  <h3 className="font-bold text-white text-base">Ajouter un exercice</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddExercisePicker(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Recherche et filtres catégories */}
              <div className="p-3 border-b border-slate-800 space-y-2 bg-slate-950/50">
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    value={exerciseSearch}
                    onChange={(e) => setExerciseSearch(e.target.value)}
                    placeholder="Rechercher (ex: Squat, Développé, Traction...)"
                    className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                  {[
                    { id: 'all', label: 'Tous' },
                    { id: 'upper_push', label: 'Push (Pecs/Épaules/Triceps)' },
                    { id: 'upper_pull', label: 'Pull (Dos/Biceps)' },
                    { id: 'lower', label: 'Jambes' },
                    { id: 'core', label: 'Abdos/Core' }
                  ].map(cat => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedCategoryFilter(cat.id)}
                      className={`px-2.5 py-1 rounded-lg whitespace-nowrap font-bold text-[11px] transition-colors ${
                        selectedCategoryFilter === cat.id
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Liste filtrée */}
              <div className="flex-1 overflow-y-auto p-3 space-y-1.5 divide-y divide-slate-800/40">
                {allExercises
                  .filter(ex => {
                    const matchCategory = selectedCategoryFilter === 'all' || ex.category === selectedCategoryFilter;
                    const matchSearch = !exerciseSearch.trim() || ex.name.toLowerCase().includes(exerciseSearch.toLowerCase());
                    return matchCategory && matchSearch;
                  })
                  .map(catalogEx => (
                    <button
                      key={catalogEx.id}
                      type="button"
                      onClick={() => handleAddExerciseFromCatalog(catalogEx)}
                      className="w-full text-left p-2.5 rounded-xl hover:bg-slate-800/80 transition-colors flex items-center justify-between group pt-3"
                    >
                      <div>
                        <span className="font-bold text-sm text-slate-200 group-hover:text-white block">
                          {catalogEx.name}
                        </span>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                          <span>{catalogEx.isCompound ? 'Polyarticulaire' : 'Isolation'}</span>
                          <span>·</span>
                          <span>Défaut : {catalogEx.defaultReps} reps</span>
                        </div>
                      </div>
                      <Plus size={16} className="text-blue-400 group-hover:scale-125 transition-transform" />
                    </button>
                  ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
