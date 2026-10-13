import { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Heart, Dumbbell, Zap, Flame, ShieldAlert, Calendar, 
  ChevronLeft, ChevronRight, CheckCircle2, Clock, RotateCcw,
  Plus, Trash2, ChevronDown, ChevronUp, Layers, Sparkles, Scale, Info,
  BookmarkCheck, BookmarkPlus, Eye, Copy, Check, TrendingUp, ArrowUpRight,
  ArrowDownRight, Minus, Search, X, AlertCircle
} from 'lucide-react';
import { getLocalYYYYMMDD } from '../utils/dateHelpers';
import { getQualityImpacts } from '../utils/physiology';
import { 
  EXERCISE_CATALOG, 
  computeSessionMuscularBreakdown, 
  MUSCLE_GROUPS,
  getSavedCustomExercises,
  saveCustomExercise,
  deleteCustomExercise,
  getAllExerciseCatalog,
  findLastExercisePerformance,
  computeAdaptiveProgression,
  getFrequentRecentExercises,
  recordExerciseUsage,
  getExercisePrimaryMuscle,
  ORDERED_PRIMARY_MUSCLES
} from '../utils/muscleHelpers';
import { MuscleBodyMap } from './MuscleBodyMap';
import { haptics } from '../utils/haptics';

const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

const WEEKDAY_NAMES = ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di'];

function formatFrenchDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const weekdays = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  const months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  return `${weekdays[dt.getDay()]} ${d} ${months[m - 1]} ${y}`;
}

function QuickScaleSelector({ id, value, onChange, min = 1, max = 10, label, activeColor = 'blue' }) {
  const numVal = Number(value);

  const handleKeyDown = (e, currentNum) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      const nextNum = currentNum >= max ? min : currentNum + 1;
      if (haptics.selection) haptics.selection();
      onChange(String(nextNum));
      setTimeout(() => {
        document.getElementById(`${id}-option-${nextNum}`)?.focus();
      }, 0);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      const prevNum = currentNum <= min ? max : currentNum - 1;
      if (haptics.selection) haptics.selection();
      onChange(String(prevNum));
      setTimeout(() => {
        document.getElementById(`${id}-option-${prevNum}`)?.focus();
      }, 0);
    }
  };

  return (
    <div 
      id={id}
      className="flex items-center gap-1.5 overflow-x-auto py-1.5 custom-scrollbar" 
      role="radiogroup" 
      aria-label={`Échelle rapide de notation : ${label} de ${min} à ${max}`}
    >
      {Array.from({ length: max - min + 1 }, (_, i) => min + i).map((n) => {
        const isSelected = numVal === n;
        const isFocusable = isSelected || (!numVal && n === min);
        return (
          <button
            key={n}
            id={`${id}-option-${n}`}
            type="button"
            role="radio"
            tabIndex={isFocusable ? 0 : -1}
            aria-checked={isSelected}
            onClick={() => {
              if (haptics.selection) haptics.selection();
              onChange(String(n));
            }}
            onKeyDown={(e) => handleKeyDown(e, n)}
            className={`min-w-[44px] min-h-[44px] h-11 px-3 rounded-xl text-xs sm:text-sm font-mono font-bold transition-all cursor-pointer border flex items-center justify-center shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 ${
              isSelected
                ? activeColor === 'red'
                  ? 'bg-red-600 text-white border-red-300 shadow-md shadow-red-500/30 ring-2 ring-red-400'
                  : activeColor === 'sky'
                  ? 'bg-sky-600 text-white border-sky-300 shadow-md shadow-sky-500/30 ring-2 ring-sky-400'
                  : activeColor === 'amber'
                  ? 'bg-amber-600 text-white border-amber-300 shadow-md shadow-amber-500/30 ring-2 ring-amber-400'
                  : 'bg-blue-600 text-white border-blue-300 shadow-md shadow-blue-500/30 ring-2 ring-blue-400'
                : 'bg-white/5 hover:bg-white/10 text-slate-200 border-white/10 hover:border-slate-400'
            }`}
            aria-label={`${label} : niveau ${n} sur ${max}`}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}

export default function ScoreModal({ info, qualities = [], events = {}, onClose, onSave, onOpenLiveGym }) {
  const modalRef = useRef(null);
  const previousActiveElementRef = useRef(null);
  const [validationErrors, setValidationErrors] = useState({});
  const todayStr = getLocalYYYYMMDD(new Date());
  const isMultiSport = useMemo(() => ['vo2max', 'seuil', 'ef', 'sprint'].includes(info.qId), [info.qId]);
  
  // Date sélectionnée (initialisée à la date fournie ou aujourd'hui)
  const [selectedDate, setSelectedDate] = useState(info.dateStr || todayStr);
  const [showCalendarView, setShowCalendarView] = useState(false);

  // État du mois affiché dans le mini calendrier
  const [viewDate, setViewDate] = useState(() => {
    const base = info.dateStr || todayStr;
    const [y, m] = base.split('-').map(Number);
    return { year: y, month: m - 1 }; // month 0-indexed
  });

  // Récupérer les données de séance pour la date active
  const getSessionForDate = (dateStr) => {
    const qualityEvents = events[info.qId] || {};
    if (qualityEvents[dateStr] !== undefined) {
      return qualityEvents[dateStr];
    }
    if (dateStr === info.dateStr && info.currentData) {
      return info.currentData;
    }
    return null;
  };

  const currentSessionData = getSessionForDate(selectedDate);
  const defaultSportForQuality = ['vo2max', 'seuil', 'ef', 'sprint'].includes(info.qId) ? 'run' : 'muscu';
  const isIsolation = info.qId === 'isolation';
  const isForce = ['pull', 'push', 'leg', 'plyo', 'descente', 'abdos', 'proprio', 'isolation'].includes(info.qId);

  // Gestion multi-séances par filière et par jour (support 2+ séances par jour sans écrasement)
  const buildInitialSubSessions = (sess) => {
    if (sess && !sess.isSecondary) {
      if (Array.isArray(sess.subSessions) && sess.subSessions.length > 0) {
        return sess.subSessions.map((s, idx) => ({
          ...s,
          id: s.id || `sub_${idx}_${Date.now()}`,
          name: s.name || `Séance ${idx + 1}`,
          duration: s.duration ?? (isIsolation ? 10 : ''),
          rpeMusc: s.rpeMusc ?? s.rpeMusculaire ?? (isIsolation ? 8 : ''),
          rpeCardio: s.rpeCardio ?? (isIsolation ? 2 : ''),
          fatigue: s.fatigue ?? (isIsolation ? 2 : ''),
          sport: s.sport || defaultSportForQuality,
          isEccentric: s.isEccentric !== undefined ? s.isEccentric : (info.qId === 'descente' || info.qId === 'plyo'),
          exercises: Array.isArray(s.exercises) ? s.exercises : [],
          notes: s.notes || ''
        }));
      }
      return [{
        id: `sub_0_${Date.now()}`,
        name: 'Séance 1',
        duration: sess.duration ?? (isIsolation ? 10 : 45),
        rpeMusc: sess.rpeMusc ?? sess.rpeMusculaire ?? (typeof sess === 'number' ? sess : (isIsolation ? 8 : '')),
        rpeCardio: sess.rpeCardio ?? (isIsolation ? 2 : ''),
        fatigue: sess.fatigue ?? (isIsolation ? 2 : ''),
        sport: sess.sport || defaultSportForQuality,
        isEccentric: sess.isEccentric !== undefined ? sess.isEccentric : (info.qId === 'descente' || info.qId === 'plyo'),
        exercises: Array.isArray(sess.exercises) ? sess.exercises : [],
        notes: sess.notes || ''
      }];
    }
    return [{
      id: `sub_0_${Date.now()}`,
      name: 'Séance 1',
      duration: isIsolation ? 10 : '',
      rpeMusc: isIsolation ? 8 : '',
      rpeCardio: isIsolation ? 2 : '',
      fatigue: isIsolation ? 2 : '',
      sport: defaultSportForQuality,
      isEccentric: info.qId === 'descente' || info.qId === 'plyo',
      exercises: [],
      notes: ''
    }];
  };

  const [subSessionsList, setSubSessionsList] = useState(() => buildInitialSubSessions(currentSessionData));
  const [activeSessionIndex, setActiveSessionIndex] = useState(0);

  const activeSub = subSessionsList[activeSessionIndex] || subSessionsList[0];

  const [sport, setSport] = useState(activeSub?.sport || defaultSportForQuality);
  const [rpeMusc, setRpeMusc] = useState(activeSub?.rpeMusc ?? (isIsolation ? 8 : ''));
  const [rpeCardio, setRpeCardio] = useState(activeSub?.rpeCardio ?? (isIsolation ? 2 : ''));
  const [fatigue, setFatigue] = useState(activeSub?.fatigue ?? (isIsolation ? 2 : ''));
  const [duration, setDuration] = useState(activeSub?.duration ?? (isIsolation ? 10 : ''));
  const [isEccentric, setIsEccentric] = useState(
    activeSub?.isEccentric !== undefined 
      ? activeSub.isEccentric 
      : (info.qId === 'descente' || info.qId === 'plyo')
  );
  const [applyImpacts, setApplyImpacts] = useState(true);

  // --- NAVIGATION PAR ONGLETS (PARAMÈTRES vs EXERCICES) & DUPLICATION ---
  const [activeModalTab, setActiveModalTab] = useState(isIsolation ? 'exercises' : 'parameters');
  const [duplicateSuccess, setDuplicateSuccess] = useState(false);

  // --- MODULE MUSCULATION & EXERCICES PAR GROUPE MUSCULAIRE (OPTION A) ---
  const [exercises, setExercises] = useState(Array.isArray(activeSub?.exercises) ? activeSub.exercises : []);

  const syncFormWithSubSession = (sub) => {
    if (!sub) return;
    setSport(sub.sport || defaultSportForQuality);
    setRpeMusc(sub.rpeMusc ?? (isIsolation ? 8 : ''));
    setRpeCardio(sub.rpeCardio ?? (isIsolation ? 2 : ''));
    setFatigue(sub.fatigue ?? (isIsolation ? 2 : ''));
    setDuration(sub.duration ?? (isIsolation ? 10 : ''));
    setIsEccentric(sub.isEccentric !== undefined ? sub.isEccentric : (info.qId === 'descente' || info.qId === 'plyo'));
    setExercises(Array.isArray(sub.exercises) ? sub.exercises : []);
  };

  const handleSwitchSubSession = (targetIndex) => {
    if (targetIndex === activeSessionIndex || !subSessionsList[targetIndex]) return;
    setSubSessionsList(prev => {
      const next = [...prev];
      if (next[activeSessionIndex]) {
        next[activeSessionIndex] = {
          ...next[activeSessionIndex],
          sport,
          rpeMusc,
          rpeCardio,
          fatigue,
          duration,
          isEccentric,
          exercises
        };
      }
      return next;
    });
    setActiveSessionIndex(targetIndex);
    syncFormWithSubSession(subSessionsList[targetIndex]);
  };

  const handleAddSubSession = () => {
    haptics.tap();
    const newIdx = subSessionsList.length;
    const newSub = {
      id: `sub_${newIdx}_${Date.now()}`,
      name: `Séance ${newIdx + 1}`,
      duration: isIsolation ? 10 : '',
      rpeMusc: isIsolation ? 8 : '',
      rpeCardio: isIsolation ? 2 : '',
      fatigue: isIsolation ? 2 : '',
      sport: defaultSportForQuality,
      isEccentric: info.qId === 'descente' || info.qId === 'plyo',
      exercises: [],
      notes: ''
    };
    setSubSessionsList(prev => {
      const next = [...prev];
      if (next[activeSessionIndex]) {
        next[activeSessionIndex] = {
          ...next[activeSessionIndex],
          sport,
          rpeMusc,
          rpeCardio,
          fatigue,
          duration,
          isEccentric,
          exercises
        };
      }
      return [...next, newSub];
    });
    setActiveSessionIndex(newIdx);
    syncFormWithSubSession(newSub);
  };

  const handleRemoveSubSession = (indexToRemove) => {
    if (subSessionsList.length <= 1) return;
    haptics.tap();
    const updated = subSessionsList.filter((_, idx) => idx !== indexToRemove).map((s, idx) => ({
      ...s,
      name: `Séance ${idx + 1}`
    }));
    setSubSessionsList(updated);
    const nextIdx = Math.max(0, Math.min(activeSessionIndex >= indexToRemove ? activeSessionIndex - 1 : activeSessionIndex, updated.length - 1));
    setActiveSessionIndex(nextIdx);
    syncFormWithSubSession(updated[nextIdx]);
  };

  // Détection de la dernière séance ayant des exercices pour cette même filière (Accélérateur 1-clic)
  const lastSessionWithExercises = useMemo(() => {
    const qualityEvents = events[info.qId];
    if (!qualityEvents) return null;

    const candidateDates = Object.keys(qualityEvents)
      .filter(d => d !== selectedDate && qualityEvents[d]?.exercises && Array.isArray(qualityEvents[d].exercises) && qualityEvents[d].exercises.length > 0)
      .sort((a, b) => b.localeCompare(a));

    if (candidateDates.length === 0) return null;
    const targetDate = candidateDates[0];
    return {
      date: targetDate,
      session: qualityEvents[targetDate]
    };
  }, [events, info.qId, selectedDate]);

  const handleDuplicateLastSession = () => {
    if (!lastSessionWithExercises?.session?.exercises) return;
    haptics.validate();
    const cloned = JSON.parse(JSON.stringify(lastSessionWithExercises.session.exercises));
    setExercises(cloned);

    // Pré-remplir également la durée et le RPE si non renseignés
    if (!duration && lastSessionWithExercises.session.duration) {
      setDuration(lastSessionWithExercises.session.duration);
    }
    if (!rpeMusc && (lastSessionWithExercises.session.rpeMusc || lastSessionWithExercises.session.rpeMusculaire)) {
      setRpeMusc(lastSessionWithExercises.session.rpeMusc || lastSessionWithExercises.session.rpeMusculaire);
    }
    if (!fatigue && lastSessionWithExercises.session.fatigue) {
      setFatigue(lastSessionWithExercises.session.fatigue);
    }

    setDuplicateSuccess(true);
    setTimeout(() => setDuplicateSuccess(false), 3000);
  };

  const defaultExForQuality = useMemo(() => {
    if (info.qId === 'isolation') return 'biceps_curl';
    if (info.qId === 'push') return 'bench_press';
    if (info.qId === 'pull') return 'pull_ups';
    if (info.qId === 'leg' || info.qId === 'descente') return 'squat';
    if (info.qId === 'plyo') return 'squat';
    if (info.qId === 'abdos') return 'abdos_crunch';
    return 'biceps_curl';
  }, [info.qId]);

  const [customExercises, setCustomExercises] = useState(() => getSavedCustomExercises());
  const [selectedExId, setSelectedExId] = useState(defaultExForQuality);
  const [exerciseSearchFilter, setExerciseSearchFilter] = useState('');
  const [isExerciseDropdownOpen, setIsExerciseDropdownOpen] = useState(false);
  const [expandedModalMuscles, setExpandedModalMuscles] = useState({}); // De base, les catalogues sont repliés

  const isModalMuscleExpanded = (catId) => {
    if (exerciseSearchFilter.trim().length > 0) return true;
    return expandedModalMuscles[catId] === true;
  };

  const toggleModalMuscle = (catId) => {
    setExpandedModalMuscles(prev => ({
      ...prev,
      [catId]: !prev[catId]
    }));
  };

  const toggleAllModalMuscles = () => {
    const anyOpen = Object.values(expandedModalMuscles).some(Boolean);
    if (anyOpen) {
      setExpandedModalMuscles({});
    } else {
      const all = { frequent: true, custom: true };
      ORDERED_PRIMARY_MUSCLES.forEach(m => { all[m.id] = true; });
      setExpandedModalMuscles(all);
    }
  };

  const [isCreatingCustom, setIsCreatingCustom] = useState(false);
  const [newExName, setNewExName] = useState('');
  const [newExCategory, setNewExCategory] = useState('lower');
  const [newExPrimaryMuscle, setNewExPrimaryMuscle] = useState('quadriceps');
  const [newExSecondaryMuscle, setNewExSecondaryMuscle] = useState('');
  const [showBodyMapInModal, setShowBodyMapInModal] = useState(false);

  const [customExName, setCustomExName] = useState('');
  const [exSets, setExSets] = useState(isIsolation ? '5' : '4');
  const [exRir, setExRir] = useState('2');
  const [exReps, setExReps] = useState('');
  const [exWeight, setExWeight] = useState('');
  const [appliedFeedback, setAppliedFeedback] = useState(false);
  const [suggestionApplied, setSuggestionApplied] = useState(false);

  // Recherche transverse de la dernière performance pour l'exercice sélectionné
  const lastExercisePerf = useMemo(() => {
    if (!selectedExId || selectedExId === '__create_new__') return null;
    return findLastExercisePerformance(events, selectedExId, selectedDate);
  }, [events, selectedExId, selectedDate]);

  // Calcul adaptatif de la charge selon le RIR passé et la fatigue de séance
  const loadSuggestion = useMemo(() => {
    return computeAdaptiveProgression(lastExercisePerf, fatigue);
  }, [lastExercisePerf, fatigue]);

  const handleApplySuggestion = () => {
    if (!loadSuggestion || !loadSuggestion.hasHistory) return;
    if (loadSuggestion.suggestedWeightKg !== undefined) {
      setExWeight(String(loadSuggestion.suggestedWeightKg));
    }
    if (loadSuggestion.suggestedReps !== undefined) {
      setExReps(String(loadSuggestion.suggestedReps));
    }
    if (loadSuggestion.suggestedRir !== undefined) {
      setExRir(String(loadSuggestion.suggestedRir));
    }
    if (loadSuggestion.suggestedSets !== undefined) {
      setExSets(String(loadSuggestion.suggestedSets));
    }
    setSuggestionApplied(true);
    setTimeout(() => setSuggestionApplied(false), 2200);
  };

  // Analyse musculaire instantanée (avec prise en compte des exercices customisés de la bibliothèque et des micro-séances)
  const muscularAnalysis = useMemo(() => {
    return computeSessionMuscularBreakdown(exercises, customExercises, isIsolation);
  }, [exercises, customExercises, isIsolation]);

  const allAvailableExercises = useMemo(() => {
    return getAllExerciseCatalog(customExercises);
  }, [customExercises]);

  // Exercices les plus souvent utilisés récemment (en tête de liste et en gras)
  const frequentExercises = useMemo(() => {
    return getFrequentRecentExercises(events, allAvailableExercises, 8, selectedDate);
  }, [events, allAvailableExercises, selectedDate]);

  const frequentIds = useMemo(() => {
    return new Set(frequentExercises.map(f => f.exerciseId));
  }, [frequentExercises]);

  const handleSaveNewCustomExercise = () => {
    if (!newExName.trim()) return;
    const muscleRatios = { [newExPrimaryMuscle]: 1.0 };
    if (newExSecondaryMuscle && newExSecondaryMuscle !== newExPrimaryMuscle) {
      muscleRatios[newExSecondaryMuscle] = 0.5;
    }
    const createdId = `custom_${Date.now()}`;
    const updated = saveCustomExercise({
      id: createdId,
      name: newExName.trim(),
      category: newExCategory,
      isCompound: true,
      defaultReps: 8,
      muscleRatios
    });
    setCustomExercises(updated);
    setSelectedExId(createdId);
    setIsCreatingCustom(false);
    setNewExName('');
  };

  const handleDeleteCustomExercise = (id, e) => {
    e.stopPropagation();
    const updated = deleteCustomExercise(id);
    setCustomExercises(updated);
    if (selectedExId === id) {
      setSelectedExId(defaultExForQuality);
    }
  };

  const handleAddExercise = () => {
    const s = Math.max(1, Number(exSets) || 1);
    const rirVal = exRir !== '' ? Math.max(0, Number(exRir)) : 2;
    const rp = Math.min(10, Math.max(1, 10 - rirVal));
    const r = exReps && Number(exReps) > 0 ? Number(exReps) : undefined;
    const w = exWeight && Number(exWeight) > 0 ? Number(exWeight) : undefined;

    let exName = customExName.trim();
    let exId = selectedExId;
    let exRatios = null;

    if (selectedExId === 'custom') {
      if (!exName) exName = 'Exercice personnalisé';
      exId = `custom_${Date.now()}`;
    } else {
      const found = allAvailableExercises.find(c => c.id === selectedExId);
      exName = found ? found.name : selectedExId;
      exRatios = found?.muscleRatios;
    }

    setExercises(prev => [
      ...prev,
      {
        id: exId,
        name: exName,
        sets: s,
        rir: rirVal,
        rpe: rp,
        ...(r !== undefined ? { reps: r } : {}),
        ...(w !== undefined ? { weightKg: w } : {}),
        ...(exRatios && Object.keys(exRatios).length > 0 ? { customRatios: { ...exRatios } } : {})
      }
    ]);

    recordExerciseUsage(exId);

    setCustomExName('');
    setAppliedFeedback(false);
    setSuggestionApplied(false);
  };

  const handleRemoveExercise = (indexToRemove) => {
    setExercises(prev => prev.filter((_, idx) => idx !== indexToRemove));
    setAppliedFeedback(false);
  };

  const handleApplyToSession = () => {
    if (muscularAnalysis.totalSets === 0) return;
    setDuration(muscularAnalysis.suggestedDuration);
    setRpeMusc(muscularAnalysis.suggestedRpeMusc);
    if (!rpeCardio) setRpeCardio(isIsolation ? 2 : 4);
    if (!fatigue) setFatigue(isIsolation ? 2 : muscularAnalysis.suggestedRpeMusc);
    setAppliedFeedback(true);
    setTimeout(() => setAppliedFeedback(false), 2500);
  };

  // Fonction pour basculer sur une autre date et recharger son formulaire
  const handleSelectDate = (newDateStr) => {
    setSelectedDate(newDateStr);
    const session = getSessionForDate(newDateStr);
    const newSubs = buildInitialSubSessions(session);
    setSubSessionsList(newSubs);
    setActiveSessionIndex(0);
    syncFormWithSubSession(newSubs[0]);
    setAppliedFeedback(false);
  };

  // Navigations mois calendrier
  const handlePrevMonth = () => {
    setViewDate(prev => {
      if (prev.month === 0) return { year: prev.year - 1, month: 11 };
      return { ...prev, month: prev.month - 1 };
    });
  };

  const handleNextMonth = () => {
    setViewDate(prev => {
      if (prev.month === 11) return { year: prev.year + 1, month: 0 };
      return { ...prev, month: prev.month + 1 };
    });
  };

  // Raccourcis rapides de date
  const quickDateShortcuts = useMemo(() => {
    const today = new Date();
    const shortcuts = [];
    
    // Aujourd'hui
    shortcuts.push({ label: "Aujourd'hui", dateStr: getLocalYYYYMMDD(today), tag: 'J+0' });
    
    // Hier J-1
    const d1 = new Date(today);
    d1.setDate(today.getDate() - 1);
    shortcuts.push({ label: 'Hier', dateStr: getLocalYYYYMMDD(d1), tag: 'J-1' });

    // J-2
    const d2 = new Date(today);
    d2.setDate(today.getDate() - 2);
    shortcuts.push({ label: 'J-2', dateStr: getLocalYYYYMMDD(d2), tag: 'J-2' });

    // J-3
    const d3 = new Date(today);
    d3.setDate(today.getDate() - 3);
    shortcuts.push({ label: 'J-3', dateStr: getLocalYYYYMMDD(d3), tag: 'J-3' });

    return shortcuts;
  }, []);

  // Construction de la grille du mini calendrier
  const calendarGrid = useMemo(() => {
    const year = viewDate.year;
    const month = viewDate.month;
    
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayIndex = (new Date(year, month, 1).getDay() + 6) % 7; // Lundi = 0

    const days = [];

    // Cellules de remplissage pour le début du mois
    for (let i = 0; i < firstDayIndex; i++) {
      days.push({ day: null, dateStr: null });
    }

    // Jours réels du mois
    for (let d = 1; d <= daysInMonth; d++) {
      const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const hasSessionForThisQuality = Boolean(events[info.qId]?.[dStr]);
      
      // Vérifier si une autre qualité a été travaillée ce jour-là
      let hasOtherSession = false;
      Object.entries(events).forEach(([qId, qEvents]) => {
        if (qId !== info.qId && qEvents?.[dStr]) {
          hasOtherSession = true;
        }
      });

      days.push({
        day: d,
        dateStr: dStr,
        isToday: dStr === todayStr,
        isSelected: dStr === selectedDate,
        hasSessionForThisQuality,
        hasOtherSession
      });
    }

    return days;
  }, [viewDate, events, info.qId, todayStr, selectedDate]);

  // Derive impacts for display dynamically according to chosen sport (Course à pied vs Vélo)
  const activeImpacts = useMemo(() => {
    return getQualityImpacts(info.qId, isMultiSport ? sport : 'run', qualities);
  }, [info.qId, isMultiSport, sport, qualities]);

  const hasImpacts = activeImpacts && activeImpacts.length > 0;

  // Calcul Multi-Facteurs physiologique (C3: Dissociation Charge vs Réponse)
  const numDur = Number(duration) || 0;
  const numCardio = Number(rpeCardio) || 0;
  const numMusc = Number(rpeMusc) || 0;
  const numFatigue = Number(fatigue) || 5;

  const eccentricMultiplier = isEccentric ? 1.15 : 1.0;
  const loadCardio = Math.round(numDur * numCardio);
  const loadMusc = Math.round(numDur * numMusc * eccentricMultiplier);
  
  // RPE et Charge globale selon le domaine physiologique de la filière
  const isCardio = ['vo2max', 'seuil', 'ef', 'co2', 'gut'].includes(info.qId);
  
  const load = numDur > 0
    ? (isCardio ? loadCardio : isForce ? loadMusc : Math.round((loadCardio + loadMusc) / 2))
    : 0;

  // Cumul multi-séances pour la journée
  const totalDayStats = useMemo(() => {
    let tDur = 0;
    let tLoad = 0;
    subSessionsList.forEach((s, idx) => {
      const d = idx === activeSessionIndex ? (Number(duration) || 0) : (Number(s.duration) || 0);
      const rM = idx === activeSessionIndex ? (Number(rpeMusc) || 5) : (Number(s.rpeMusc) || 5);
      const rC = idx === activeSessionIndex ? (Number(rpeCardio) || 5) : (Number(s.rpeCardio) || 5);
      const ecc = (idx === activeSessionIndex ? isEccentric : s.isEccentric) ? 1.15 : 1.0;
      const lC = Math.round(d * rC);
      const lM = Math.round(d * rM * ecc);
      const sL = isCardio ? lC : isForce ? lM : Math.round((lC + lM) / 2);
      tDur += d;
      tLoad += sL;
    });
    return { totalDuration: tDur, totalLoad: tLoad };
  }, [subSessionsList, activeSessionIndex, duration, rpeMusc, rpeCardio, isEccentric, isCardio, isForce]);

  const handleSubmit = (e) => {
    e.preventDefault();
    let finalDuration = duration;
    let finalRpeMusc = rpeMusc;
    let finalRpeCardio = rpeCardio;
    let finalFatigue = fatigue;

    // Si des exercices sont saisis mais que certains champs généraux sont restés vides,
    // on utilise les estimations physiologiques de la séance
    if (exercises.length > 0) {
      if (!finalDuration && muscularAnalysis.suggestedDuration) {
        finalDuration = muscularAnalysis.suggestedDuration;
      }
      if (!finalRpeMusc && muscularAnalysis.suggestedRpeMusc) {
        finalRpeMusc = muscularAnalysis.suggestedRpeMusc;
      }
      if (!finalRpeCardio) {
        finalRpeCardio = isIsolation ? 2 : (isForce ? 4 : 5);
      }
      if (!finalFatigue) {
        finalFatigue = isIsolation ? 2 : (muscularAnalysis.suggestedRpeMusc || 6);
      }
    }

    const errors = {};
    if (!finalDuration || Number(finalDuration) <= 0) {
      errors.duration = 'Veuillez renseigner la durée effective (ex: 45 min).';
    }
    if (!finalRpeMusc || Number(finalRpeMusc) < 1 || Number(finalRpeMusc) > 10) {
      errors.rpeMusc = 'Le RPE musculaire doit être compris entre 1 et 10.';
    }
    if (!finalRpeCardio || Number(finalRpeCardio) < 1 || Number(finalRpeCardio) > 10) {
      errors.rpeCardio = 'Le RPE cardio doit être compris entre 1 et 10.';
    }
    if (!finalFatigue || Number(finalFatigue) < 1 || Number(finalFatigue) > 10) {
      errors.fatigue = 'Le niveau de fatigue perçue doit être compris entre 1 et 10.';
    }

    if (Object.keys(errors).length > 0) {
      haptics.warning();
      setValidationErrors(errors);
      setActiveModalTab('parameters');
      if (modalRef.current) {
        modalRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
      return;
    }

    setValidationErrors({});
    haptics.validate();
    const durNum = Number(finalDuration);
    const rpeMNum = Number(finalRpeMusc);
    const rpeCNum = Number(finalRpeCardio);

    // Mettre à jour et consolider toutes les sous-séances avec la séance active courante
    const updatedSubs = subSessionsList.map((s, idx) => {
      if (idx === activeSessionIndex) {
        return {
          ...s,
          sport: isMultiSport ? sport : (s.sport || defaultSportForQuality),
          rpeMusc: rpeMNum,
          rpeCardio: rpeCNum,
          fatigue: Number(finalFatigue),
          duration: durNum,
          isEccentric: Boolean(isEccentric),
          exercises: exercises.length > 0 ? exercises : []
        };
      }
      return s;
    });

    let totalDur = 0;
    let totalLoad = 0;
    let totalLoadCardio = 0;
    let totalLoadMusc = 0;
    let sumMuscWeighted = 0;
    let sumCardioWeighted = 0;
    let maxFatigue = 0;
    let anyEccentric = false;
    let allExs = [];

    const computedSubs = updatedSubs.map((sub, sIdx) => {
      const d = Number(sub.duration) || 0;
      const rM = Number(sub.rpeMusc) || 5;
      const rC = Number(sub.rpeCardio) || 5;
      const subMult = sub.isEccentric ? 1.15 : 1.0;
      const subCardio = Math.round(d * rC);
      const subMusc = Math.round(d * rM * subMult);
      const subLoad = isCardio ? subCardio : isForce ? subMusc : Math.round((subCardio + subMusc) / 2);

      totalDur += d;
      totalLoad += subLoad;
      totalLoadCardio += subCardio;
      totalLoadMusc += subMusc;
      sumMuscWeighted += d * rM;
      sumCardioWeighted += d * rC;
      maxFatigue = Math.max(maxFatigue, Number(sub.fatigue) || 0);
      if (sub.isEccentric) anyEccentric = true;
      if (Array.isArray(sub.exercises) && sub.exercises.length > 0) {
        allExs.push(...sub.exercises);
      }

      return {
        ...sub,
        id: sub.id || `sub_${sIdx}_${Date.now()}`,
        name: sub.name || `Séance ${sIdx + 1}`,
        duration: d,
        rpeMusc: rM,
        rpeCardio: rC,
        fatigue: Number(sub.fatigue) || 5,
        load: subLoad,
        loadCardio: subCardio,
        loadMusc: subMusc,
        sport: sub.sport || defaultSportForQuality,
        isEccentric: Boolean(sub.isEccentric),
        exercises: Array.isArray(sub.exercises) && sub.exercises.length > 0 ? sub.exercises : undefined
      };
    });

    const finalRpeMuscAvg = totalDur > 0 ? Math.round(sumMuscWeighted / totalDur) : rpeMNum;
    const finalRpeCardioAvg = totalDur > 0 ? Math.round(sumCardioWeighted / totalDur) : rpeCNum;

    onSave({ 
      rpeMusc: finalRpeMuscAvg, 
      rpeCardio: finalRpeCardioAvg, 
      fatigue: maxFatigue || Number(finalFatigue), 
      duration: totalDur, 
      load: totalLoad,
      loadCardio: totalLoadCardio,
      loadMusc: totalLoadMusc,
      sport: isMultiSport ? sport : (computedSubs[0]?.sport || defaultSportForQuality),
      isEccentric: anyEccentric,
      exercises: allExs.length > 0 ? allExs : undefined,
      subSessions: computedSubs.length > 1 ? computedSubs : undefined
    }, applyImpacts, selectedDate);
    onClose();
  };

  const handleTriggerDelete = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    haptics.warning();
    onSave(null, applyImpacts, selectedDate);
    onClose();
  };

  const handleTabKeyDown = (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const nextTab = activeModalTab === 'parameters' ? 'exercises' : 'parameters';
      setActiveModalTab(nextTab);
      const nextId = nextTab === 'parameters' ? 'tab-parameters' : 'tab-exercises';
      setTimeout(() => {
        document.getElementById(nextId)?.focus();
      }, 0);
    }
  };

  useEffect(() => {
    // Sauvegarde du trigger d'origine pour restitution de focus (WCAG 2.2 SC 2.4.3)
    previousActiveElementRef.current = document.activeElement;

    // Focus initial sur le premier élément pertinent
    const timer = setTimeout(() => {
      if (modalRef.current) {
        const firstFocusable = modalRef.current.querySelector(
          'button:not([disabled]), input:not([disabled]), select:not([disabled])'
        );
        if (firstFocusable) {
          firstFocusable.focus();
        } else {
          modalRef.current.focus();
        }
      }
    }, 50);

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      // Focus Trap (WCAG 2.2 SC 2.1.2)
      if (e.key === 'Tab' && modalRef.current) {
        const focusables = Array.from(
          modalRef.current.querySelectorAll(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        ).filter(el => el.offsetParent !== null);

        if (focusables.length === 0) return;

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first || document.activeElement === modalRef.current) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
      if (previousActiveElementRef.current && typeof previousActiveElementRef.current.focus === 'function') {
        previousActiveElementRef.current.focus();
      }
    };
  }, [onClose]);

  return (
    <div 
      className="modal-overlay" 
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="score-modal-title"
      aria-describedby="score-modal-subtitle"
    >
      <div 
        ref={modalRef}
        tabIndex={-1}
        className="modal-content !w-[96vw] !max-w-[960px] animate-fadeIn max-h-[92vh] overflow-y-auto custom-scrollbar focus:outline-none" 
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* En-tête de la modale avec Filière, Mode Salle, Statut Excentrique et Bouton Fermer */}
        <div className="flex items-start justify-between border-b border-white/10 pb-3 mb-3 gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 id="score-modal-title" className="text-xl font-bold text-slate-100 tracking-tight m-0">{info.qName}</h3>
              <span className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold border ${
                isIsolation
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                  : 'bg-blue-500/20 text-blue-300 border-blue-500/30'
              }`}>
                {isIsolation ? 'Micro-séance Ciblée' : 'Saisie Séance'}
              </span>
              {isEccentric && (
                <span className="text-xs font-bold px-2.5 py-1 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1 shadow-sm">
                  <Zap size={13} className="text-amber-400" aria-hidden="true" /> Excentrique (+15%)
                </span>
              )}
            </div>
            <p id="score-modal-subtitle" className="text-xs font-semibold text-slate-300 mt-1 mb-0">
              {isIsolation 
                ? 'Micro-séance : stimule vos muscles cibles sans impacter la fenêtre de rappel globale (Pull/Push)'
                : 'Renseignez la durée, la difficulté perçue (RPE) et les impacts'}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onOpenLiveGym && (
              <button
                type="button"
                onClick={() => {
                  haptics.modeSwitch();
                  onOpenLiveGym();
                }}
                className="min-h-[44px] px-3.5 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                title="Passer en mode saisie live à la salle avec chronomètre de repos automatique"
              >
                <Dumbbell size={14} className="text-emerald-400" aria-hidden="true" />
                <span className="hidden sm:inline">Mode Salle</span>
              </button>
            )}

            {/* Bouton de Fermeture Explicite (Accessible WCAG 2.5.5 >= 44x44px) */}
            <button
              type="button"
              onClick={onClose}
              className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl bg-white/5 hover:bg-white/10 active:bg-white/20 text-slate-300 hover:text-white border border-white/10 flex items-center justify-center transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
              aria-label="Fermer la boîte de dialogue"
              title="Fermer (Échap)"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        </div>

        {isIsolation && (
          <div className="mb-3 p-3 rounded-2xl bg-cyan-950/30 border border-cyan-500/30 flex items-center gap-2.5 text-xs text-cyan-200 animate-fadeIn">
            <Sparkles size={16} className="text-cyan-400 shrink-0" />
            <span className="leading-relaxed">
              <strong>Micro-séance d'isolation :</strong> Renseignez vos séries d'isolation (ex. Curls, Triceps...). Elles alimentent directement le volume hebdomadaire et la Body Map, sans remettre à zéro le rappel de <em>Musculation Pull</em> (dos) et avec un impact cardio minime.
            </span>
          </div>
        )}

        {/* SECTION SÉLECTEUR DE DATE & VUE CALENDRIER INTERACTIVE */}
        <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 space-y-3 mb-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400">
                <Calendar size={16} aria-hidden="true" />
              </div>
              <div>
                <label htmlFor="score-date-input" className="text-xs uppercase font-bold text-slate-300 tracking-wider block cursor-pointer">
                  Date de la séance
                </label>
                <span className="text-xs sm:text-sm font-bold text-white capitalize block mt-0.5">
                  {formatFrenchDate(selectedDate)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              {/* Sélecteur natif date rapide */}
              <input
                id="score-date-input"
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  if (e.target.value) {
                    handleSelectDate(e.target.value);
                    const [y, m] = e.target.value.split('-').map(Number);
                    setViewDate({ year: y, month: m - 1 });
                  }
                }}
                className="bg-slate-900 text-xs sm:text-sm font-mono text-slate-200 px-3 py-2 min-h-[44px] rounded-xl border border-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 cursor-pointer"
                aria-label="Sélectionner une date"
              />

              {/* Bouton d'ouverture / fermeture du calendrier intégré */}
              <button
                type="button"
                onClick={() => setShowCalendarView(!showCalendarView)}
                className={`px-3.5 py-2 min-h-[44px] rounded-xl text-xs font-semibold transition-all cursor-pointer border flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                  showCalendarView 
                    ? 'bg-blue-600 text-white border-blue-400 shadow-sm' 
                    : 'bg-white/5 hover:bg-white/10 text-slate-200 border-white/10 hover:text-white'
                }`}
                aria-expanded={showCalendarView}
                aria-label={showCalendarView ? 'Fermer le calendrier mensuel' : 'Ouvrir le calendrier mensuel'}
              >
                <span>{showCalendarView ? 'Fermer calendrier' : 'Vue calendrier'}</span>
              </button>
            </div>
          </div>

          {/* Raccourcis rapides de date (Aujourd'hui, Hier, J-2, J-3) */}
          <div className="flex items-center gap-2 flex-wrap pt-1.5 border-t border-white/5">
            <span className="text-xs text-slate-300 font-semibold mr-1">Raccourcis :</span>
            {quickDateShortcuts.map((sc) => {
              const isCurrent = selectedDate === sc.dateStr;
              return (
                <button
                  key={sc.dateStr}
                  type="button"
                  onClick={() => {
                    handleSelectDate(sc.dateStr);
                    const [y, m] = sc.dateStr.split('-').map(Number);
                    setViewDate({ year: y, month: m - 1 });
                  }}
                  className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer border flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                    isCurrent
                      ? 'bg-blue-600 text-white border-blue-400 shadow-sm font-bold ring-2 ring-blue-300'
                      : 'bg-white/5 hover:bg-white/10 text-slate-200 border-white/10 hover:text-white'
                  }`}
                  aria-pressed={isCurrent}
                >
                  {sc.label}
                </button>
              );
            })}

            {/* Indicateur si une séance est déjà enregistrée pour cette date */}
            {currentSessionData && (
              <span className="ml-auto inline-flex items-center gap-1.5 text-xs font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 px-3 py-1.5 rounded-full">
                <CheckCircle2 size={14} className="text-amber-400" aria-hidden="true" /> Séance existante ({currentSessionData.load || (currentSessionData * 5)} pts)
              </span>
            )}
          </div>

          {/* VUE CALENDRIER MENSUELLE DÉPLIABLE */}
          {showCalendarView && (
            <div className="pt-3 border-t border-white/10 animate-fadeIn space-y-2.5">
              {/* Navigation Mois & Année */}
              <div className="flex items-center justify-between px-1">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="min-w-[44px] min-h-[44px] p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 transition-colors cursor-pointer flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                  aria-label="Mois précédent"
                  title="Mois précédent"
                >
                  <ChevronLeft size={18} aria-hidden="true" />
                </button>

                <span className="text-xs sm:text-sm font-bold text-white font-mono uppercase tracking-wider">
                  {MONTH_NAMES[viewDate.month]} {viewDate.year}
                </span>

                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="min-w-[44px] min-h-[44px] p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 transition-colors cursor-pointer flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                  aria-label="Mois suivant"
                  title="Mois suivant"
                >
                  <ChevronRight size={18} aria-hidden="true" />
                </button>
              </div>

              {/* En-têtes jours de la semaine */}
              <div className="grid grid-cols-7 gap-1.5 text-center text-xs font-bold text-slate-300 border-b border-white/5 pb-1">
                {WEEKDAY_NAMES.map((wd, i) => (
                  <span key={i}>{wd}</span>
                ))}
              </div>

              {/* Grille des jours du mois */}
              <div className="grid grid-cols-7 gap-1.5">
                {calendarGrid.map((item, idx) => {
                  if (!item.day) {
                    return <div key={`empty-${idx}`} className="h-11 min-h-[44px]" />;
                  }

                  return (
                    <button
                      key={item.dateStr}
                      type="button"
                      onClick={() => handleSelectDate(item.dateStr)}
                      className={`relative min-h-[44px] h-11 rounded-xl text-xs font-semibold flex flex-col items-center justify-center transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                        item.isSelected
                          ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-500/30 ring-2 ring-blue-300'
                          : item.isToday
                          ? 'bg-blue-500/15 text-blue-300 border border-blue-500/40 hover:bg-blue-500/25'
                          : 'bg-white/5 hover:bg-white/10 text-slate-200 hover:text-white border border-white/5'
                      }`}
                      aria-label={`${formatFrenchDate(item.dateStr)}${item.hasSessionForThisQuality ? ' (Séance enregistrée)' : ''}`}
                      aria-pressed={item.isSelected}
                    >
                      <span>{item.day}</span>
                      
                      {/* Puce indicatrice si une séance a eu lieu */}
                      {item.hasSessionForThisQuality ? (
                        <span className="absolute bottom-1 w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_4px_rgba(251,191,36,0.8)]" aria-hidden="true" />
                      ) : item.hasOtherSession ? (
                        <span className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-slate-400 opacity-60" aria-hidden="true" />
                      ) : null}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between text-xs text-slate-300 px-1 pt-1">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" aria-hidden="true" />
                  Séance {info.qName}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-slate-400 inline-block opacity-60" aria-hidden="true" />
                  Autre séance
                </span>
              </div>
            </div>
          )}
        </div>
        
        {/* FORMULAIRE DE SAISIE DE LA SÉANCE */}
        <form onSubmit={handleSubmit} className="space-y-3.5" noValidate>
          
          {/* BANNIÈRE D'ERREUR D'ACCESSIBILITÉ SI VALIDATION INVALIDE */}
          {Object.keys(validationErrors).length > 0 && (
            <div 
              role="alert" 
              aria-live="assertive"
              className="p-3.5 rounded-xl bg-red-950/60 border border-red-500/60 text-red-200 text-xs flex items-start gap-2.5 animate-fadeIn mb-3 shadow-md"
            >
              <AlertCircle size={18} className="text-red-400 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="space-y-1">
                <strong className="block text-red-100 font-bold">Veuillez compléter les informations requises :</strong>
                <ul className="list-disc pl-4 space-y-0.5 text-red-200">
                  {Object.entries(validationErrors).map(([key, msg]) => (
                    <li key={key}>{msg}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* GESTION MULTI-SÉANCES DE LA JOURNÉE (Support 2+ séances le même jour sans écrasement) */}
          <div className="p-3 rounded-2xl bg-slate-900/80 border border-white/10 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-bold text-slate-300 mr-1 flex items-center gap-1.5">
                  <Clock size={14} className="text-blue-400" aria-hidden="true" />
                  <span>Séance(s) du jour :</span>
                </span>
                {subSessionsList.map((sub, idx) => {
                  const isActive = activeSessionIndex === idx;
                  const curDur = isActive ? (Number(duration) || 0) : (Number(sub.duration) || 0);
                  const isCurSportBike = (isActive ? sport : sub.sport) === 'bike';
                  return (
                    <div key={sub.id || idx} className="flex items-center">
                      <button
                        type="button"
                        onClick={() => handleSwitchSubSession(idx)}
                        className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                          isActive
                            ? 'bg-blue-600 text-white border-blue-400 shadow-md shadow-blue-500/25 ring-2 ring-blue-300'
                            : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/10 hover:text-white'
                        }`}
                        aria-pressed={isActive}
                      >
                        <span>{sub.name || `Séance ${idx + 1}`}</span>
                        {curDur > 0 && (
                          <span className="text-[10px] font-mono opacity-80">
                            ({curDur}m {isCurSportBike ? '🚴' : '🏃'})
                          </span>
                        )}
                      </button>
                      {subSessionsList.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveSubSession(idx);
                          }}
                          aria-label={`Supprimer la ${sub.name || `Séance ${idx + 1}`}`}
                          title="Supprimer cette séance spécifique"
                          className="w-7 h-7 -ml-2 min-h-[28px] min-w-[28px] rounded-full bg-red-900/60 hover:bg-red-700 text-red-200 border border-red-500/30 flex items-center justify-center text-xs font-black cursor-pointer transition-colors z-10"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  );
                })}

                <button
                  type="button"
                  onClick={handleAddSubSession}
                  className="min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-300 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 flex items-center gap-1.5 transition-all cursor-pointer shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                  title="Ajouter une autre séance sur cette même filière aujourd'hui (ex: séance du matin + séance du soir)"
                >
                  <Plus size={14} className="text-emerald-400" aria-hidden="true" />
                  <span>+ Ajouter une séance</span>
                </button>
              </div>

              {subSessionsList.length > 1 && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs font-mono font-bold">
                  <span>Cumul jour : {totalDayStats.totalDuration} min · {totalDayStats.totalLoad} UA ({subSessionsList.length} séances)</span>
                </div>
              )}
            </div>
          </div>

          {/* BARRE D'ONGLETS NAVIGATION RAPIDE (WAI-ARIA Tabs) */}
          <div 
            role="tablist" 
            aria-label="Sections du formulaire de séance"
            className="flex items-center gap-2 border-b border-white/10 pb-3"
            onKeyDown={handleTabKeyDown}
          >
            <button
              id="tab-parameters"
              role="tab"
              aria-selected={activeModalTab === 'parameters'}
              aria-controls="panel-parameters"
              tabIndex={activeModalTab === 'parameters' ? 0 : -1}
              type="button"
              onClick={() => setActiveModalTab('parameters')}
              className={`min-h-[44px] flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer border focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                activeModalTab === 'parameters'
                  ? 'bg-blue-600 text-white border-blue-400 shadow-md shadow-blue-500/25 ring-2 ring-blue-300'
                  : 'bg-white/5 hover:bg-white/10 text-slate-200 border-white/5 hover:text-white'
              }`}
            >
              <Zap size={16} className={activeModalTab === 'parameters' ? 'text-white' : 'text-amber-400'} aria-hidden="true" />
              <span>⚡ Paramètres & Charge</span>
            </button>

            <button
              id="tab-exercises"
              role="tab"
              aria-selected={activeModalTab === 'exercises'}
              aria-controls="panel-exercises"
              tabIndex={activeModalTab === 'exercises' ? 0 : -1}
              type="button"
              onClick={() => setActiveModalTab('exercises')}
              className={`min-h-[44px] flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer border focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                activeModalTab === 'exercises'
                  ? 'bg-blue-600 text-white border-blue-400 shadow-md shadow-blue-500/25 ring-2 ring-blue-300'
                  : 'bg-white/5 hover:bg-white/10 text-slate-200 border-white/5 hover:text-white'
              }`}
            >
              <Dumbbell size={16} className={activeModalTab === 'exercises' ? 'text-white' : 'text-red-400'} aria-hidden="true" />
              <span>🏋️ Musculation & Exercices</span>
              {exercises.length > 0 ? (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 font-bold ml-1">
                  {exercises.length} exo{exercises.length > 1 ? 's' : ''} · {muscularAnalysis.totalSets} s
                </span>
              ) : (
                <span className="text-xs font-normal text-slate-400 opacity-90">
                  (Optionnel)
                </span>
              )}
            </button>
          </div>

          {/* ONGLET 1 : PARAMÈTRES & CHARGE */}
          {activeModalTab === 'parameters' && (
            <div 
              id="panel-parameters"
              role="tabpanel"
              aria-labelledby="tab-parameters"
              className="space-y-4 animate-fadeIn"
            >
              {/* SÉLECTEUR DE SPORT (Course à pied vs Vélo / Home-trainer) pour VO2max, Seuil, EF et Sprint */}
              {isMultiSport && (
                <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2.5">
                  <label className="text-xs font-semibold text-slate-200 block">
                    Modalité sportive / Pratique :
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setSport('run')}
                      className={`min-h-[44px] flex items-center justify-center gap-2.5 p-3 rounded-xl border text-xs sm:text-sm font-bold transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                        sport === 'run'
                          ? 'bg-blue-600 border-blue-400 text-white shadow-md ring-2 ring-blue-300'
                          : 'bg-white/5 border-white/10 text-slate-200 hover:text-white hover:bg-white/10'
                      }`}
                      aria-pressed={sport === 'run'}
                    >
                      <span className="text-lg" aria-hidden="true">🏃</span>
                      <span>Course à pied</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSport('bike')}
                      className={`min-h-[44px] flex items-center justify-center gap-2.5 p-3 rounded-xl border text-xs sm:text-sm font-bold transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                        sport === 'bike'
                          ? 'bg-amber-600 border-amber-400 text-white shadow-md ring-2 ring-amber-300'
                          : 'bg-white/5 border-white/10 text-slate-200 hover:text-white hover:bg-white/10'
                      }`}
                      aria-pressed={sport === 'bike'}
                    >
                      <span className="text-lg" aria-hidden="true">🚴</span>
                      <span>Vélo / HT</span>
                    </button>
                  </div>
                  <p className="text-xs text-slate-300 leading-tight m-0">
                    {sport === 'bike' 
                      ? '🚴 Mode Vélo : Contraction concentrique pure sans chocs au sol. Impact pliométrique (plyo) exclu des transferts.' 
                      : '🏃 Mode Course : Contrainte pliométrique (SSC) et chocs structurels complets.'}
                  </p>
                </div>
              )}

              {/* Raccourci / Statut si des exercices sont renseignés */}
              {exercises.length > 0 ? (
                <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-950/30 to-blue-950/30 border border-emerald-500/30 flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
                      <Dumbbell size={16} aria-hidden="true" />
                    </div>
                    <div>
                      <span className="text-xs sm:text-sm font-bold text-white block">
                        {exercises.length} exercice{exercises.length > 1 ? 's' : ''} configuré{exercises.length > 1 ? 's' : ''} ({muscularAnalysis.totalSets} séries)
                      </span>
                      <span className="text-xs text-slate-300 block">
                        Estimation automatique : {muscularAnalysis.suggestedDuration} min · RPE {muscularAnalysis.suggestedRpeMusc}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleApplyToSession}
                      className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 border cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                        appliedFeedback 
                          ? 'bg-emerald-600 text-white border-emerald-400 shadow-sm'
                          : 'bg-white/10 hover:bg-white/20 text-emerald-300 border-emerald-500/30'
                      }`}
                      title="Copier la durée et le RPE calculés par les exercices"
                    >
                      <Sparkles size={14} aria-hidden="true" />
                      <span>{appliedFeedback ? 'Appliqué !' : 'Synchroniser durée & RPE'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveModalTab('exercises')}
                      className="min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold bg-blue-600/30 hover:bg-blue-600/50 text-blue-200 border border-blue-400/30 transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                    >
                      Voir exercices →
                    </button>
                  </div>
                </div>
              ) : lastSessionWithExercises && (
                <div className="p-3 rounded-xl bg-blue-950/30 border border-blue-500/20 flex items-center justify-between gap-3 flex-wrap">
                  <span className="text-xs text-slate-300 flex items-center gap-2">
                    <Copy size={15} className="text-blue-400" aria-hidden="true" />
                    Séance précédente trouvée ({lastSessionWithExercises.session.exercises.length} exercices)
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      handleDuplicateLastSession();
                      setActiveModalTab('exercises');
                    }}
                    className="min-h-[36px] px-3 py-1 text-xs font-bold text-blue-300 hover:text-white bg-blue-600/20 hover:bg-blue-600/40 border border-blue-400/30 rounded-lg cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 transition-all"
                  >
                    ⚡ Dupliquer en 1 clic
                  </button>
                </div>
              )}

              {/* Champ Durée Effective */}
              <div className="input-group">
                <label htmlFor="score-duration-input" className="text-xs font-semibold text-slate-200 block mb-1">
                  Durée effective de la séance (minutes) *
                </label>
                <div className="flex items-center gap-2">
                  <input 
                    id="score-duration-input"
                    type="number" 
                    min="1" 
                    max="600" 
                    value={duration} 
                    onChange={(e) => {
                      setDuration(e.target.value);
                      if (validationErrors.duration) {
                        setValidationErrors(prev => ({ ...prev, duration: undefined }));
                      }
                    }} 
                    placeholder="Ex: 45" 
                    className={`bg-slate-900 border rounded-xl px-3.5 py-2 min-h-[44px] text-sm sm:text-base font-mono font-bold text-white placeholder-slate-500 focus:outline-none transition-colors w-32 ${
                      validationErrors.duration ? 'border-red-500 ring-2 ring-red-500' : 'border-white/10 focus-visible:border-blue-400 focus-visible:ring-2 focus-visible:ring-blue-400'
                    }`}
                    aria-invalid={Boolean(validationErrors.duration)}
                    aria-describedby={validationErrors.duration ? 'score-duration-error' : undefined}
                  />
                  <span className="text-xs sm:text-sm text-slate-300 font-mono">minutes</span>
                </div>
                {validationErrors.duration && (
                  <span id="score-duration-error" className="text-xs text-red-400 mt-1 block font-semibold">
                    {validationErrors.duration}
                  </span>
                )}
              </div>

              {/* Grille RPE Musculaire et Cardio */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* RPE Musculaire */}
                <div className={`input-group !mb-0 p-3.5 rounded-2xl bg-red-950/20 border transition-all ${
                  validationErrors.rpeMusc ? 'border-red-500 ring-2 ring-red-500' : 'border-red-500/20'
                }`}>
                  <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
                    <label htmlFor="score-rpe-musc-input" className="text-xs font-bold text-red-300 flex items-center gap-1.5">
                      <Dumbbell size={15} className="text-red-400" aria-hidden="true" /> RPE Musculaire *
                    </label>
                    <span id="score-rpe-musc-hint" className="text-xs text-slate-300">Tension, fibres, cuisses</span>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <input 
                      id="score-rpe-musc-input"
                      type="number" 
                      min="1" 
                      max="10" 
                      placeholder="1-10" 
                      value={rpeMusc} 
                      onChange={(e) => {
                        setRpeMusc(e.target.value);
                        if (validationErrors.rpeMusc) setValidationErrors(prev => ({ ...prev, rpeMusc: undefined }));
                      }}
                      className="w-24 min-h-[44px] bg-slate-900 border border-white/15 rounded-xl px-3 py-2 text-base font-mono text-center font-bold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                      aria-invalid={Boolean(validationErrors.rpeMusc)}
                      aria-describedby="score-rpe-musc-hint"
                    />
                    <span className="text-xs sm:text-sm text-slate-300 font-mono">/ 10</span>
                  </div>
                  <QuickScaleSelector 
                    id="quick-rpe-musc" 
                    label="RPE Musculaire" 
                    value={rpeMusc} 
                    onChange={(val) => {
                      setRpeMusc(val);
                      if (validationErrors.rpeMusc) setValidationErrors(prev => ({ ...prev, rpeMusc: undefined }));
                    }} 
                    activeColor="red" 
                  />
                  {validationErrors.rpeMusc && (
                    <span className="text-xs text-red-400 mt-1 block font-semibold">{validationErrors.rpeMusc}</span>
                  )}
                </div>

                {/* RPE Cardio */}
                <div className={`input-group !mb-0 p-3.5 rounded-2xl bg-sky-950/20 border transition-all ${
                  validationErrors.rpeCardio ? 'border-red-500 ring-2 ring-red-500' : 'border-sky-500/20'
                }`}>
                  <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
                    <label htmlFor="score-rpe-cardio-input" className="text-xs font-bold text-sky-300 flex items-center gap-1.5">
                      <Heart size={15} className="text-sky-400" aria-hidden="true" /> RPE Cardio *
                    </label>
                    <span id="score-rpe-cardio-hint" className="text-xs text-slate-300">Souffle, FC, ventilation</span>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <input 
                      id="score-rpe-cardio-input"
                      type="number" 
                      min="1" 
                      max="10" 
                      placeholder="1-10" 
                      value={rpeCardio} 
                      onChange={(e) => {
                        setRpeCardio(e.target.value);
                        if (validationErrors.rpeCardio) setValidationErrors(prev => ({ ...prev, rpeCardio: undefined }));
                      }}
                      className="w-24 min-h-[44px] bg-slate-900 border border-white/15 rounded-xl px-3 py-2 text-base font-mono text-center font-bold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                      aria-invalid={Boolean(validationErrors.rpeCardio)}
                      aria-describedby="score-rpe-cardio-hint"
                    />
                    <span className="text-xs sm:text-sm text-slate-300 font-mono">/ 10</span>
                  </div>
                  <QuickScaleSelector 
                    id="quick-rpe-cardio" 
                    label="RPE Cardio" 
                    value={rpeCardio} 
                    onChange={(val) => {
                      setRpeCardio(val);
                      if (validationErrors.rpeCardio) setValidationErrors(prev => ({ ...prev, rpeCardio: undefined }));
                    }} 
                    activeColor="sky" 
                  />
                  {validationErrors.rpeCardio && (
                    <span className="text-xs text-red-400 mt-1 block font-semibold">{validationErrors.rpeCardio}</span>
                  )}
                </div>
              </div>

              {/* Option Excentrique & Chocs structurels */}
              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10">
                <label htmlFor="score-eccentric-check" className="flex items-start gap-3 cursor-pointer min-h-[44px]">
                  <input 
                    id="score-eccentric-check"
                    type="checkbox" 
                    checked={isEccentric} 
                    onChange={e => setIsEccentric(e.target.checked)} 
                    className="mt-1 rounded accent-amber-500 w-5 h-5 cursor-pointer" 
                  />
                  <div className="text-left">
                    <span className="text-xs sm:text-sm font-semibold text-amber-300 flex items-center gap-1.5">
                      <Flame size={14} className="text-amber-400" aria-hidden="true" /> Stress Excentrique & Impacts Musculaires Élevés
                    </span>
                    <span className="text-xs text-slate-300 block leading-tight mt-0.5">
                      Descente trail, pliométrie, charges lourdes (majore la contrainte structurelle mécanique de +15%).
                    </span>
                  </div>
                </label>
              </div>

              {/* Fatigue Perçue Globale */}
              <div className={`input-group p-3.5 rounded-2xl bg-white/[0.03] border transition-all ${
                validationErrors.fatigue ? 'border-red-500 ring-2 ring-red-500' : 'border-white/10'
              }`}>
                <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
                  <label htmlFor="score-fatigue-input" className="text-xs font-semibold text-slate-200">
                    Fatigue Perçue Globale Post-Séance (1-10) *
                  </label>
                  {fatigue && (
                    <span className={`text-xs font-mono px-2.5 py-1 rounded-md font-bold border ${
                      numFatigue > 6 
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' 
                        : numFatigue < 5 
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        : 'bg-white/10 text-slate-300 border-white/10'
                    }`}>
                      {numFatigue > 6 ? 'Fatigue marquée' : numFatigue > 4 ? 'Tolérance normale' : 'Très bien toléré'}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <input 
                    id="score-fatigue-input"
                    type="number" 
                    min="1" 
                    max="10" 
                    value={fatigue} 
                    onChange={(e) => {
                      setFatigue(e.target.value);
                      if (validationErrors.fatigue) setValidationErrors(prev => ({ ...prev, fatigue: undefined }));
                    }} 
                    placeholder="1-10" 
                    className="w-24 min-h-[44px] bg-slate-900 border border-white/15 rounded-xl px-3 py-2 text-base font-mono text-center font-bold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                    aria-invalid={Boolean(validationErrors.fatigue)}
                    aria-describedby="score-fatigue-hint"
                  />
                  <span className="text-xs sm:text-sm text-slate-300 font-mono">/ 10</span>
                </div>
                <QuickScaleSelector 
                  id="quick-fatigue" 
                  label="Fatigue perçue" 
                  value={fatigue} 
                  onChange={(val) => {
                    setFatigue(val);
                    if (validationErrors.fatigue) setValidationErrors(prev => ({ ...prev, fatigue: undefined }));
                  }} 
                  activeColor="amber" 
                />
                <p id="score-fatigue-hint" className="text-xs text-slate-300 mt-2 leading-relaxed m-0">
                  {numFatigue > 6 
                    ? `⚡ Marqueur de réponse : Fatigue perçue élevée (${numFatigue}/10). Veillez particulièrement à l'assimilation et au sommeil.` 
                    : numFatigue < 5 
                    ? `🍃 Marqueur de réponse : Séance très bien tolérée (${numFatigue}/10). Disponibilité préservée.`
                    : '🟢 Marqueur de réponse : Niveau de fatigue habituel (5/10).'}
                </p>
                {validationErrors.fatigue && (
                  <span className="text-xs text-red-400 mt-1 block font-semibold">{validationErrors.fatigue}</span>
                )}
              </div>

              {/* Décomposition Charge Multi-Facteurs (Modélisation Carl Foster sRPE) */}
              <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs sm:text-sm text-slate-200 font-bold">Charge Stimulus de Séance (sRPE Carl Foster) :</span>
                    {load > 0 && (
                      <span className="text-xs font-mono px-2.5 py-1 rounded font-bold bg-white/10 text-slate-200">
                        {isCardio ? 'Filière Cardio' : isForce ? 'Filière Musculaire' : 'Mixte'}
                      </span>
                    )}
                  </div>
                  <div className="text-right flex items-baseline gap-2">
                    <strong className="text-xl sm:text-2xl font-mono font-bold text-white">
                      {load > 0 ? `${load} UA` : '-'}
                    </strong>
                  </div>
                </div>

                {/* Formule didactique explicite de Foster selon la filière */}
                {duration && (rpeMusc || rpeCardio) && (
                  <div className="text-xs font-mono text-slate-300 bg-black/40 p-2.5 rounded-xl border border-white/10 flex items-center justify-between flex-wrap gap-2">
                    <span>
                      {isCardio ? (
                        <>📐 Formule Cardio : {duration} min × RPE cardio ({rpeCardio || 0})</>
                      ) : isForce ? (
                        <>📐 Formule Musculaire : {duration} min × RPE musc ({rpeMusc || 0}){isEccentric ? ' × 1.15 (excentrique)' : ''}</>
                      ) : (
                        <>📐 Formule Mixte : {duration} min × moyenne RPE ({((numCardio + numMusc * eccentricMultiplier) / 2).toFixed(1)})</>
                      )}
                    </span>
                    <span className="font-bold text-blue-300">
                      = {load} UA (Unités Arbitraires)
                    </span>
                  </div>
                )}

                {load > 0 && (
                  <>
                    <div className="grid grid-cols-2 gap-2.5 text-center text-xs">
                      <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/20">
                        <span className="text-xs text-sky-300 block flex items-center justify-center gap-1 font-semibold">
                          <Heart size={13} aria-hidden="true" /> Charge Cardio
                        </span>
                        <span className="font-bold font-mono text-sky-200 text-base sm:text-lg block my-0.5">{loadCardio}</span>
                        <span className="text-xs text-slate-300 block">{cardioPercent}% de la charge</span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
                        <span className="text-xs text-red-300 block flex items-center justify-center gap-1 font-semibold">
                          <Dumbbell size={13} aria-hidden="true" /> Charge Musculaire
                        </span>
                        <span className="font-bold font-mono text-red-200 text-base sm:text-lg block my-0.5">
                          {loadMusc} {isEccentric && <span className="text-xs text-amber-400 font-normal">x1.15</span>}
                        </span>
                        <span className="text-xs text-slate-300 block">{muscPercent}% de la charge</span>
                      </div>
                    </div>

                    {/* Barre de répartition */}
                    <div className="w-full h-2 rounded-full overflow-hidden flex bg-white/10">
                      <div className="bg-sky-400 h-full transition-all" style={{ width: `${cardioPercent}%` }} />
                      <div className="bg-red-400 h-full transition-all" style={{ width: `${muscPercent}%` }} />
                    </div>
                  </>
                )}

                {hasImpacts && (
                  <div className="pt-2 border-t border-white/10">
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-blue-300 hover:text-blue-200 transition-colors">
                      <input 
                        type="checkbox" 
                        checked={applyImpacts} 
                        onChange={e => setApplyImpacts(e.target.checked)} 
                        className="rounded border-none accent-blue-500" 
                      />
                      <span>
                        Appliquer impacts secondaires ({activeImpacts.map(i => {
                          const targetName = qualities.find(q => q.id === i.id)?.name || i.id;
                          return `${targetName} ${Math.round(i.ratio * 100)}% (${i.confidence || 'estimé'})`;
                        }).join(', ')})
                      </span>
                    </label>
                  </div>
                )}
                
                {existing?.isSecondary && (
                  <div className="text-[11px] text-amber-400 flex items-center gap-1">
                    <ShieldAlert size={12} /> Séance calculée automatiquement comme impact secondaire.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ONGLET 2 : MUSCULATION & EXERCICES */}
          {activeModalTab === 'exercises' && (
            <div 
              id="panel-exercises"
              role="tabpanel"
              aria-labelledby="tab-exercises"
              className="space-y-3.5 animate-fadeIn"
            >
              {/* BANNIÈRE D'ACCÉLÉRATION : DUPLIQUER LA DERNIÈRE SÉANCE */}
              {lastSessionWithExercises && (
                <div className="p-3.5 rounded-2xl bg-gradient-to-r from-blue-950/40 via-indigo-950/40 to-slate-900 border border-blue-500/30 flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400 shrink-0">
                      <Copy size={16} />
                    </div>
                    <div className="truncate">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs sm:text-sm font-bold text-white">
                          Séance précédente ({formatFrenchDate(lastSessionWithExercises.date)})
                        </span>
                        <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-white/10 text-blue-300">
                          {lastSessionWithExercises.session.exercises.length} exercice{lastSessionWithExercises.session.exercises.length > 1 ? 's' : ''}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 m-0 truncate mt-0.5">
                        {lastSessionWithExercises.session.exercises.map(e => e.name).join(' · ')}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleDuplicateLastSession}
                    className={`min-h-[44px] px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                      duplicateSuccess
                        ? 'bg-emerald-600 text-white shadow-emerald-500/30 ring-2 ring-emerald-400'
                        : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/25 hover:scale-[1.01]'
                    }`}
                    title="Cloner instantanément tous les exercices de la dernière séance"
                  >
                    {duplicateSuccess ? (
                      <>
                        <Check size={16} className="text-white" />
                        <span>Séance clonée avec succès !</span>
                      </>
                    ) : (
                      <>
                        <Copy size={16} />
                        <span>Dupliquer la dernière séance</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Formulaire d'ajout rapide d'un exercice */}
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Sélection de l'exercice */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold uppercase text-slate-200 block">
                        Exercice
                      </label>
                      <div className="flex items-center gap-2">
                        {customExercises.some(e => e.id === selectedExId) && (
                          <button
                            type="button"
                            onClick={(e) => handleDeleteCustomExercise(selectedExId, e)}
                            className="min-h-[36px] px-2.5 py-1 rounded-lg text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 font-semibold flex items-center gap-1 cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                            title="Supprimer cet exercice de la bibliothèque"
                          >
                            <Trash2 size={13} />
                            <span>Supprimer</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setIsCreatingCustom(!isCreatingCustom)}
                          className="min-h-[36px] px-2.5 py-1 rounded-lg text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 font-semibold flex items-center gap-1 cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                        >
                          <BookmarkPlus size={13} />
                          <span>{isCreatingCustom ? 'Fermer création' : '+ Créer exo perso'}</span>
                        </button>
                      </div>
                    </div>
                    <div className="relative mb-2">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <input
                        type="text"
                        value={exerciseSearchFilter}
                        onChange={(e) => {
                          setExerciseSearchFilter(e.target.value);
                          if (e.target.value.trim().length > 0) {
                            setIsExerciseDropdownOpen(true);
                          }
                        }}
                        placeholder="Recherche rapide (ex: squat, fentes, dips...)"
                        className="w-full min-h-[44px] bg-slate-900 border border-white/10 rounded-xl pl-9 pr-8 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                      />
                      {exerciseSearchFilter && (
                        <button
                          type="button"
                          onClick={() => setExerciseSearchFilter('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs p-1.5 cursor-pointer"
                          title="Effacer le filtre"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    {/* Menu déroulant personnalisé avec catalogue repliable par muscle */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setIsExerciseDropdownOpen(!isExerciseDropdownOpen)}
                        className="w-full min-h-[44px] flex items-center justify-between bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 text-left cursor-pointer hover:border-slate-400 transition-colors"
                      >
                        <div className="flex items-center gap-2 truncate">
                          {frequentIds.has(selectedExId) && (
                            <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0">
                              Fréquent
                            </span>
                          )}
                          {customExercises.some(c => c.id === selectedExId) && (
                            <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40 shrink-0">
                              Perso
                            </span>
                          )}
                          <span className="font-bold text-white truncate">
                            {allAvailableExercises.find(e => e.id === selectedExId)?.name || 'Sélectionner un exercice...'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                          <span className="text-xs text-slate-400 hidden sm:inline">Catalogue</span>
                          <ChevronDown size={16} className={`text-slate-400 transition-transform duration-200 ${isExerciseDropdownOpen ? 'rotate-180 text-blue-400' : ''}`} />
                        </div>
                      </button>

                      {isExerciseDropdownOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-30"
                            onClick={() => setIsExerciseDropdownOpen(false)}
                          />
                          <div className="absolute left-0 right-0 top-full mt-1.5 z-40 bg-slate-950 border border-slate-700/80 rounded-xl shadow-2xl overflow-hidden max-h-80 flex flex-col animate-fadeIn">
                            {/* Entête avec repliage général */}
                            <div className="px-3 py-2 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between text-xs text-slate-300 shrink-0">
                              <span className="font-bold flex items-center gap-2 text-slate-200">
                                <Layers size={14} className="text-blue-400" />
                                Catalogue par muscle principal
                              </span>
                              <button
                                type="button"
                                onClick={toggleAllModalMuscles}
                                className="text-blue-400 hover:text-blue-300 font-bold transition-colors cursor-pointer px-2.5 py-1 rounded bg-blue-500/10 hover:bg-blue-500/20 text-xs min-h-[32px]"
                              >
                                {Object.values(expandedModalMuscles).some(Boolean) ? 'Tout replier' : 'Tout déplier'}
                              </button>
                            </div>

                            {/* Catalogue replié de base */}
                            <div className="overflow-y-auto p-1.5 space-y-1 divide-y divide-slate-800/40">
                              {/* Fréquents & Récents */}
                              {frequentExercises.length > 0 && (() => {
                                const matches = frequentExercises.filter(f => !exerciseSearchFilter.trim() || f.name.toLowerCase().includes(exerciseSearchFilter.toLowerCase().trim()));
                                if (matches.length === 0) return null;
                                const isExp = isModalMuscleExpanded('frequent');
                                return (
                                  <div key="frequent" className="pt-1">
                                    <button
                                      type="button"
                                      onClick={() => toggleModalMuscle('frequent')}
                                      className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-left bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/20 text-amber-200 text-xs font-bold transition-colors cursor-pointer"
                                    >
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300">Fréquents</span>
                                        <span className="text-[11px]">Favoris récents</span>
                                      </div>
                                      <div className="flex items-center gap-1.5 text-[10px] text-amber-300/80">
                                        <span className="font-mono">{matches.length}</span>
                                        {isExp ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                      </div>
                                    </button>
                                    {isExp && (
                                      <div className="mt-1 space-y-0.5 pl-1.5">
                                        {matches.map(f => {
                                          const isSelected = selectedExId === f.exerciseId;
                                          return (
                                            <button
                                              key={`freq_${f.exerciseId}`}
                                              type="button"
                                              onClick={() => {
                                                setSelectedExId(f.exerciseId);
                                                setSuggestionApplied(false);
                                                setIsExerciseDropdownOpen(false);
                                              }}
                                              className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-left text-xs transition-colors cursor-pointer ${
                                                isSelected 
                                                  ? 'bg-amber-500/20 text-amber-200 font-bold border border-amber-500/30' 
                                                  : 'hover:bg-slate-800/80 text-slate-300'
                                              }`}
                                            >
                                              <span className="truncate">{f.name}</span>
                                              <span className="text-[10px] text-amber-400 font-mono shrink-0 ml-2">{f.count}×</span>
                                            </button>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}

                              {/* Exercices Personnalisés */}
                              {customExercises.length > 0 && (() => {
                                const matches = customExercises.filter(e => !exerciseSearchFilter.trim() || e.name.toLowerCase().includes(exerciseSearchFilter.toLowerCase().trim()));
                                if (matches.length === 0) return null;
                                const isExp = isModalMuscleExpanded('custom');
                                return (
                                  <div key="custom" className="pt-1">
                                    <button
                                      type="button"
                                      onClick={() => toggleModalMuscle('custom')}
                                      className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-left bg-blue-500/10 hover:bg-blue-500/15 border border-blue-500/20 text-blue-200 text-xs font-bold transition-colors cursor-pointer"
                                    >
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300">Perso</span>
                                        <span className="text-[11px]">Exercices personnalisés</span>
                                      </div>
                                      <div className="flex items-center gap-1.5 text-[10px] text-blue-300/80">
                                        <span className="font-mono">{matches.length}</span>
                                        {isExp ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                      </div>
                                    </button>
                                    {isExp && (
                                      <div className="mt-1 space-y-0.5 pl-1.5">
                                        {matches.map(e => {
                                          const isSelected = selectedExId === e.id;
                                          return (
                                            <button
                                              key={e.id}
                                              type="button"
                                              onClick={() => {
                                                setSelectedExId(e.id);
                                                setSuggestionApplied(false);
                                                setIsExerciseDropdownOpen(false);
                                              }}
                                              className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-left text-xs transition-colors cursor-pointer ${
                                                isSelected 
                                                  ? 'bg-blue-500/20 text-blue-200 font-bold border border-blue-500/30' 
                                                  : 'hover:bg-slate-800/80 text-slate-300'
                                              }`}
                                            >
                                              <span className="truncate">{e.name}</span>
                                              {isSelected && <Check size={12} className="text-blue-400 shrink-0 ml-2" />}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}

                              {/* Groupes par muscle principal (repliés par défaut) */}
                              {ORDERED_PRIMARY_MUSCLES.map(muscle => {
                                const matchingExercises = EXERCISE_CATALOG
                                  .filter(e => getExercisePrimaryMuscle(e) === muscle.id)
                                  .filter(e => !exerciseSearchFilter.trim() || e.name.toLowerCase().includes(exerciseSearchFilter.toLowerCase().trim()))
                                  .sort((a, b) => (frequentIds.has(b.id) ? 1 : 0) - (frequentIds.has(a.id) ? 1 : 0));

                                if (matchingExercises.length === 0) return null;
                                const isExp = isModalMuscleExpanded(muscle.id);

                                return (
                                  <div key={muscle.id} className="pt-1">
                                    <button
                                      type="button"
                                      onClick={() => toggleModalMuscle(muscle.id)}
                                      className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-left bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
                                    >
                                      <span className="text-[11px] font-bold text-slate-200">{muscle.name}</span>
                                      <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                                        <span className="font-mono bg-slate-800 px-1.5 py-0.2 rounded text-slate-300">
                                          {matchingExercises.length}
                                        </span>
                                        {isExp ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                      </div>
                                    </button>
                                    {isExp && (
                                      <div className="mt-1 space-y-0.5 pl-1.5">
                                        {matchingExercises.map(e => {
                                          const isSelected = selectedExId === e.id;
                                          const isFreq = frequentIds.has(e.id);
                                          return (
                                            <button
                                              key={e.id}
                                              type="button"
                                              onClick={() => {
                                                setSelectedExId(e.id);
                                                setSuggestionApplied(false);
                                                setIsExerciseDropdownOpen(false);
                                              }}
                                              className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-left text-xs transition-colors cursor-pointer ${
                                                isSelected 
                                                  ? 'bg-blue-600/30 text-white font-bold border border-blue-500/40' 
                                                  : 'hover:bg-slate-800/80 text-slate-300'
                                              }`}
                                            >
                                              <span className="truncate">{e.name}</span>
                                              <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                                {isFreq && (
                                                  <span className="text-[9px] font-bold px-1 rounded bg-amber-500/20 text-amber-300">
                                                    Fréquent
                                                  </span>
                                                )}
                                                {isSelected && <Check size={12} className="text-blue-400" />}
                                              </div>
                                            </button>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}

                              {/* Création d'exercice personnalisé */}
                              <div className="pt-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsCreatingCustom(true);
                                    setIsExerciseDropdownOpen(false);
                                  }}
                                  className="w-full flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg bg-blue-950/40 hover:bg-blue-900/40 text-blue-300 hover:text-blue-200 text-xs font-bold border border-blue-500/30 transition-colors cursor-pointer"
                                >
                                  <Plus size={13} />
                                  <span>Créer un nouvel exercice personnalisé...</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Cibles musculaires de l'exercice sélectionné */}
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400 self-end pb-2 flex-wrap">
                    {frequentIds.has(selectedExId) && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 inline-flex items-center gap-0.5">
                        Fréquent ({frequentExercises.find(f => f.exerciseId === selectedExId)?.count || 1}×)
                      </span>
                    )}
                    <Info size={13} className="text-blue-400 shrink-0" />
                    <span className="truncate">
                      Cibles : {Object.entries(allAvailableExercises.find(c => c.id === selectedExId)?.muscleRatios || {})
                        .map(([mId, r]) => `${MUSCLE_GROUPS[mId]?.name || mId} (${Math.round(r * 100)}%)`)
                        .join(', ')}
                    </span>
                  </div>
                </div>

                {/* FORMULAIRE DE CRÉATION D'EXERCICE PERSONNALISÉ */}
                {isCreatingCustom && (
                  <div className="p-3 rounded-xl bg-blue-950/30 border border-blue-500/30 space-y-2.5 animate-fadeIn">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-blue-300 flex items-center gap-1.5">
                        <BookmarkPlus size={13} className="text-blue-400" />
                        Créer un exercice personnalisé (Sauvegardé en bibliothèque)
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsCreatingCustom(false)}
                        className="text-[10px] text-slate-400 hover:text-white"
                      >
                        ✕ Annuler
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label htmlFor="custom-new-ex-name" className="text-xs font-semibold text-slate-300 block mb-1">
                          Nom de l'exercice *
                        </label>
                        <input
                          id="custom-new-ex-name"
                          type="text"
                          value={newExName}
                          onChange={(e) => setNewExName(e.target.value)}
                          placeholder="Ex: Hack Squat, Landmine Press..."
                          className="w-full bg-slate-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-400"
                        />
                      </div>

                      <div>
                        <label htmlFor="custom-new-ex-category" className="text-xs font-semibold text-slate-300 block mb-1">
                          Catégorie
                        </label>
                        <select
                          id="custom-new-ex-category"
                          value={newExCategory}
                          onChange={(e) => setNewExCategory(e.target.value)}
                          className="w-full bg-slate-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-400 cursor-pointer"
                        >
                          <option value="lower">Bas du corps (Lower)</option>
                          <option value="upper_push">Poussée Haut (Push)</option>
                          <option value="upper_pull">Tirage Haut (Pull)</option>
                          <option value="core">Tronc & Gainage (Core)</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label htmlFor="custom-new-ex-primary" className="text-xs font-semibold text-slate-300 block mb-1">
                          Muscle Moteur Principal (100% de tension)
                        </label>
                        <select
                          id="custom-new-ex-primary"
                          value={newExPrimaryMuscle}
                          onChange={(e) => setNewExPrimaryMuscle(e.target.value)}
                          className="w-full bg-slate-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-400 cursor-pointer"
                        >
                          {Object.values(MUSCLE_GROUPS).map(m => (
                            <option key={m.id} value={m.id}>{m.name} ({m.categoryLabel})</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label htmlFor="custom-new-ex-secondary" className="text-xs font-semibold text-slate-300 block mb-1">
                          Muscle Secondaire Synergiste (50% de tension, optionnel)
                        </label>
                        <select
                          id="custom-new-ex-secondary"
                          value={newExSecondaryMuscle}
                          onChange={(e) => setNewExSecondaryMuscle(e.target.value)}
                          className="w-full bg-slate-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-400 cursor-pointer"
                        >
                          <option value="">Aucun (Isolation pure)</option>
                          {Object.values(MUSCLE_GROUPS).map(m => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={handleSaveNewCustomExercise}
                        disabled={!newExName.trim()}
                        className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                      >
                        <BookmarkCheck size={13} />
                        <span>Enregistrer dans ma bibliothèque</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* ENCART SUGGESTION AUTOMATIQUE DE CHARGE (RIR & FATIGUE ACCUMULÉE) */}
                {loadSuggestion && (
                  loadSuggestion.hasHistory ? (
                    <div className="p-3 rounded-xl bg-slate-900/90 border border-white/10 space-y-2.5 shadow-sm">
                      {/* En-tête : Badge adaptatif et Récapitulatif séance précédente */}
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold border font-mono ${
                            loadSuggestion.status === 'increase'
                              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                              : loadSuggestion.status === 'decrease'
                              ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                              : 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                          }`}>
                            {loadSuggestion.status === 'increase' && <TrendingUp size={11} />}
                            {loadSuggestion.status === 'decrease' && <ArrowDownRight size={11} />}
                            {loadSuggestion.status === 'maintain' && <Minus size={11} />}
                            <span>
                              {loadSuggestion.status === 'increase'
                                ? 'Progression Adaptative'
                                : loadSuggestion.status === 'decrease'
                                ? 'Régulation de Charge'
                                : 'Consolidation Technique'}
                            </span>
                          </span>

                          <span className="text-[11px] text-slate-400">
                            Dernière séance : {loadSuggestion.lastDate ? formatFrenchDate(loadSuggestion.lastDate) : 'historique'}
                          </span>
                        </div>

                        {/* Rappel des métriques de la dernière séance */}
                        <div className="text-[11px] font-mono text-slate-400 flex items-center gap-2">
                          <span>
                            {loadSuggestion.lastSets} séries
                            {loadSuggestion.lastWeightKg !== undefined ? ` @ ${loadSuggestion.lastWeightKg} kg` : ''}
                            {loadSuggestion.lastReps !== undefined ? ` × ${loadSuggestion.lastReps} reps` : ''}
                          </span>
                          <span className="text-emerald-400/90">· {loadSuggestion.lastRir} RIR</span>
                          {loadSuggestion.lastSessionFatigue !== undefined && (
                            <span className="text-slate-500">· Fat. {loadSuggestion.lastSessionFatigue}/10</span>
                          )}
                        </div>
                      </div>

                      {/* Corps : Valeur recommandée, Explication et Bouton d'application 1-clic */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1.5 border-t border-white/5">
                        <div className="space-y-0.5">
                          <div className="flex items-baseline gap-2 flex-wrap">
                            {loadSuggestion.suggestedWeightKg !== undefined ? (
                              <>
                                <span className="text-xs text-slate-400">Charge suggérée :</span>
                                <span className="text-sm font-bold font-mono text-white tracking-tight">
                                  {loadSuggestion.suggestedWeightKg} kg
                                </span>
                                {loadSuggestion.weightDeltaKg !== 0 && (
                                  <span className={`text-[11px] font-mono font-semibold ${
                                    loadSuggestion.weightDeltaKg > 0 ? 'text-emerald-400' : 'text-amber-400'
                                  }`}>
                                    {loadSuggestion.weightDeltaKg > 0 ? `+${loadSuggestion.weightDeltaKg}` : loadSuggestion.weightDeltaKg} kg
                                    {loadSuggestion.percentageDelta !== 0 && ` (${loadSuggestion.percentageDelta > 0 ? `+${loadSuggestion.percentageDelta}%` : `${loadSuggestion.percentageDelta}%`})`}
                                  </span>
                                )}
                              </>
                            ) : (
                              <>
                                <span className="text-xs text-slate-400">Volume suggéré :</span>
                                <span className="text-sm font-bold font-mono text-white">
                                  {loadSuggestion.suggestedReps} reps
                                </span>
                              </>
                            )}

                            <span className="text-[11px] font-mono text-slate-400">
                              · Cible {loadSuggestion.suggestedRir} RIR (RPE {10 - loadSuggestion.suggestedRir})
                            </span>
                          </div>

                          <p className="text-[11px] text-slate-400">
                            {loadSuggestion.reason}
                          </p>
                        </div>

                        {/* Bouton d'action tactile 1-clic */}
                        <button
                          type="button"
                          onClick={handleApplySuggestion}
                          className={`self-start sm:self-center min-h-[44px] px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-2 shrink-0 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                            suggestionApplied
                              ? 'bg-emerald-600 text-white shadow-emerald-500/25 ring-2 ring-emerald-400'
                              : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 hover:border-emerald-400/60'
                          }`}
                          title="Pré-remplir automatiquement les paramètres avec cette suggestion"
                        >
                          {suggestionApplied ? (
                            <>
                              <Check size={16} className="stroke-[2.5]" />
                              <span>Suggestion appliquée !</span>
                            </>
                          ) : (
                            <>
                              <Sparkles size={15} className="text-emerald-400" />
                              <span>
                                Appliquer {loadSuggestion.suggestedWeightKg !== undefined ? `(${loadSuggestion.suggestedWeightKg} kg)` : 'la suggestion'}
                              </span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5 text-xs text-slate-300">
                      <div className="flex items-center gap-2">
                        <Sparkles size={14} className="text-blue-400 shrink-0" />
                        <span className="text-xs text-slate-300">{loadSuggestion.reason}</span>
                      </div>
                      <span className="text-xs font-mono text-slate-400 shrink-0">Zone MAV cible : 2 RIR</span>
                    </div>
                  )
                )}

                {/* Ligne Paramètres : Séries, RIR (Prioritaire), Reps (Optionnel), Poids (Optionnel) et Bouton Ajouter */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end pt-1">
                  {/* Séries (obligatoire) */}
                  <div className="sm:col-span-2">
                    <label htmlFor="exercise-sets-input" className="text-xs font-bold uppercase text-slate-200 block mb-1">
                      Séries *
                    </label>
                    <input
                      id="exercise-sets-input"
                      type="number"
                      min="1"
                      max="20"
                      value={exSets}
                      onChange={(e) => setExSets(e.target.value)}
                      className="w-full min-h-[44px] bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-base text-center font-mono font-bold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                    />
                  </div>

                  {/* RIR (Reps In Reserve - Prioritaire) */}
                  <div className="sm:col-span-4">
                    <div className="flex items-center justify-between mb-1">
                      <label htmlFor="exercise-rir-select" className="text-xs font-bold uppercase text-emerald-400 block">
                        RIR (Proximité échec) *
                      </label>
                      <span className="text-xs font-mono text-slate-300 font-semibold">
                        RPE {Math.min(10, Math.max(1, 10 - (Number(exRir) || 0)))}
                      </span>
                    </div>
                    <select
                      id="exercise-rir-select"
                      value={exRir}
                      onChange={(e) => setExRir(e.target.value)}
                      className="w-full bg-slate-900 border border-emerald-500/30 rounded-xl px-3 py-2 text-xs sm:text-sm font-semibold text-emerald-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 cursor-pointer min-h-[44px]"
                    >
                      <option value="0">0 RIR · Échec absolu (Max Effort · RPE 10)</option>
                      <option value="1">1 RIR · 1 rep en réserve (Très dur · RPE 9)</option>
                      <option value="2">2 RIR · 2 reps en réserve (Zone optimale MAV · RPE 8)</option>
                      <option value="3">3 RIR · 3 reps en réserve (Modéré · RPE 7)</option>
                      <option value="4">4 RIR · 4 reps en réserve (Technique / Vitesse · RPE 6)</option>
                      <option value="5">5+ RIR · Échauffement / Maintien (RPE ≤ 5)</option>
                    </select>
                  </div>

                  {/* Répétitions (Optionnel) */}
                  <div className="sm:col-span-2">
                    <label htmlFor="exercise-reps-input" className="text-xs font-semibold uppercase text-slate-200 block mb-1">
                      Reps <span className="text-xs text-slate-400 font-normal">(opt.)</span>
                    </label>
                    <input
                      id="exercise-reps-input"
                      type="number"
                      min="1"
                      max="100"
                      placeholder="Opt. (ex: 8)"
                      value={exReps}
                      onChange={(e) => setExReps(e.target.value)}
                      className="w-full min-h-[44px] bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-center font-mono text-slate-200 placeholder:text-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                    />
                  </div>

                  {/* Poids / Charge (Optionnel) */}
                  <div className="sm:col-span-2">
                    <label htmlFor="exercise-weight-input" className="text-xs font-semibold uppercase text-slate-200 block mb-1">
                      Poids kg <span className="text-xs text-slate-400 font-normal">(opt.)</span>
                    </label>
                    <input
                      id="exercise-weight-input"
                      type="number"
                      min="0"
                      step="0.5"
                      placeholder="Opt. (ex: 80)"
                      value={exWeight}
                      onChange={(e) => setExWeight(e.target.value)}
                      className="w-full min-h-[44px] bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-center font-mono text-slate-200 placeholder:text-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                    />
                  </div>

                  {/* Bouton Ajouter */}
                  <div className="sm:col-span-2">
                    <button
                      type="button"
                      onClick={handleAddExercise}
                      className="w-full min-h-[44px] py-2.5 px-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md hover:shadow-blue-500/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                      title="Ajouter cet exercice à la séance"
                    >
                      <Plus size={16} aria-hidden="true" />
                      <span>Ajouter</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Liste des exercices ajoutés */}
              {exercises.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-300 px-1">
                    <span className="font-semibold text-slate-200">Exercices programmés ({exercises.length}) :</span>
                    <span className="font-mono text-xs text-slate-300">{muscularAnalysis.totalSets} séries · RPE moy. {muscularAnalysis.weightedAvgRpe}</span>
                  </div>

                  <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                    {exercises.map((ex, idx) => {
                      const rirVal = ex.rir !== undefined ? ex.rir : (ex.rpe ? Math.max(0, 10 - ex.rpe) : 2);
                      let rirBadgeColor = 'bg-slate-800 text-slate-200 border-slate-700';
                      if (rirVal === 0) rirBadgeColor = 'bg-rose-500/20 text-rose-300 border-rose-500/40 font-bold';
                      else if (rirVal <= 2) rirBadgeColor = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 font-bold';
                      else if (rirVal === 3) rirBadgeColor = 'bg-sky-500/20 text-sky-300 border-sky-500/30';

                      const tonnage = (ex.reps && ex.weightKg) ? Math.round(ex.sets * ex.reps * ex.weightKg) : null;

                      return (
                        <div
                          key={`${ex.id}-${idx}`}
                          className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.04] border border-white/10 hover:border-white/20 text-xs transition-colors gap-2"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-xs font-mono font-bold text-slate-200 shrink-0">
                              {idx + 1}
                            </span>
                            <div className="truncate">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-white text-xs sm:text-sm truncate">{ex.name}</span>
                                <span className={`px-2.5 py-0.5 rounded-md text-xs font-mono border ${rirBadgeColor}`}>
                                  {rirVal} RIR (RPE {10 - rirVal})
                                </span>
                              </div>
                              <span className="text-xs text-slate-300 font-mono mt-0.5 block">
                                {ex.sets} séries
                                {ex.reps ? ` × ${ex.reps} reps` : ' effectives'}
                                {ex.weightKg ? ` @ ${ex.weightKg} kg` : ''}
                                {tonnage ? ` · Tonnage : ${tonnage} kg` : ''}
                              </span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveExercise(idx)}
                            className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 transition-colors cursor-pointer shrink-0 flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                            title="Supprimer cet exercice"
                            aria-label={`Supprimer l'exercice ${ex.name}`}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Synthèse visuelle de la charge par muscle avec bascule Mannequin */}
                  {muscularAnalysis.sortedMuscles.length > 0 && (
                    <div className="p-4 rounded-2xl bg-black/40 border border-white/10 space-y-3.5">
                      <div className="flex items-center justify-between flex-wrap gap-2.5">
                        <span className="text-xs font-bold uppercase text-slate-200 tracking-wider flex items-center gap-1.5">
                          <Layers size={14} className="text-blue-400" />
                          Charge calculée par muscle :
                        </span>
                        
                        {/* Bascule Vue Jauges vs Mannequin */}
                        <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/10">
                          <button
                            type="button"
                            onClick={() => setShowBodyMapInModal(false)}
                            className={`min-h-[40px] px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                              !showBodyMapInModal ? 'bg-blue-600 text-white font-bold shadow-sm' : 'text-slate-300 hover:text-white'
                            }`}
                          >
                            Jauges
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowBodyMapInModal(true)}
                            className={`min-h-[40px] px-3.5 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                              showBodyMapInModal ? 'bg-blue-600 text-white font-bold shadow-sm' : 'text-slate-300 hover:text-white'
                            }`}
                          >
                            <Eye size={14} />
                            <span>Mannequin Face & Dos</span>
                          </button>
                        </div>
                      </div>

                      {showBodyMapInModal ? (
                        <div className="animate-fadeIn p-2 bg-slate-950/70 rounded-xl border border-white/5">
                          <MuscleBodyMap muscleLoads={muscularAnalysis.muscleLoads} />
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                          {muscularAnalysis.sortedMuscles.map(m => (
                            <div
                              key={m.muscleId}
                              className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10 flex flex-col justify-between"
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-xs font-semibold text-slate-200 truncate" title={m.name}>
                                  {m.name}
                                </span>
                                <span className="text-xs font-mono font-bold text-blue-300 shrink-0">
                                  {m.effectiveSets} s
                                </span>
                              </div>
                              <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden mt-2">
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{
                                    backgroundColor: m.color,
                                    width: `${Math.min(100, (m.effectiveSets / 10) * 100)}%`
                                  }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Bouton Magique : Appliquer durée et RPE à la séance */}
                      <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-3 flex-wrap">
                        <div className="text-xs sm:text-sm text-slate-300 leading-tight">
                          Estimation séance : <strong className="text-white font-mono">{muscularAnalysis.suggestedDuration} min</strong> à RPE <strong className="text-amber-300 font-mono">{muscularAnalysis.suggestedRpeMusc}</strong>
                        </div>

                        <button
                          type="button"
                          onClick={handleApplyToSession}
                          className={`min-h-[44px] px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 cursor-pointer border focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                            appliedFeedback
                              ? 'bg-emerald-600 text-white border-emerald-400 shadow-md shadow-emerald-500/25'
                              : 'bg-white/10 hover:bg-white/20 text-blue-300 hover:text-white border-blue-500/30'
                          }`}
                          title="Synchronise la durée et le RPE de la séance selon vos exercices"
                        >
                          <Sparkles size={15} className={appliedFeedback ? 'text-white' : 'text-blue-400'} />
                          <span>{appliedFeedback ? 'Appliqué à la séance !' : 'Appliquer durée & RPE'}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-8 text-center rounded-2xl bg-white/[0.02] border border-dashed border-white/10 text-slate-300 text-xs space-y-2">
                  <div className="w-12 h-12 mx-auto rounded-full bg-white/5 flex items-center justify-center text-slate-400">
                    <Dumbbell size={22} />
                  </div>
                  <p className="font-semibold text-slate-200 text-sm m-0">Aucun exercice programmé pour le moment</p>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto m-0">
                    Sélectionnez un exercice ci-dessus ou cliquez sur « Dupliquer la dernière séance » pour insérer automatiquement vos séries et RIR.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* PIED DE MODALE FIXE : ACTIONS (WCAG 2.5.5 >= 44x44px) */}
          <div className="modal-actions pt-4 border-t border-white/10 flex items-center justify-between gap-3 flex-wrap">
            {currentSessionData ? (
              confirmDelete ? (
                <div className="flex items-center gap-2 animate-fadeIn p-1.5 rounded-xl bg-rose-950/40 border border-rose-500/40">
                  <span className="text-xs text-rose-200 font-semibold pl-1">Confirmer la suppression ?</span>
                  <button 
                    type="button" 
                    className="min-h-[44px] px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs sm:text-sm cursor-pointer shadow-md shadow-rose-600/30 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                    onClick={handleTriggerDelete}
                  >
                    Oui, supprimer
                  </button>
                  <button 
                    type="button" 
                    className="min-h-[44px] px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white text-xs sm:text-sm cursor-pointer transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                    onClick={() => setConfirmDelete(false)}
                  >
                    Annuler
                  </button>
                </div>
              ) : (
                <button 
                  type="button" 
                  className="btn-delete min-h-[44px] px-4 py-2.5 text-xs sm:text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400" 
                  onClick={() => setConfirmDelete(true)}
                  aria-label="Supprimer cette séance"
                >
                  Supprimer la séance
                </button>
              )
            ) : <div />}

            <div className="flex items-center gap-3 ml-auto">
              <button 
                type="button" 
                className="btn-cancel min-h-[44px] px-5 py-2.5 text-xs sm:text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400" 
                onClick={onClose}
              >
                Annuler
              </button>
              <button 
                type="submit" 
                className="btn-save min-h-[44px] px-5 py-2.5 flex items-center gap-2 font-bold text-xs sm:text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 shadow-md shadow-blue-500/25"
              >
                <CheckCircle2 size={18} aria-hidden="true" />
                <span>Enregistrer la séance · {formatFrenchDate(selectedDate)}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
