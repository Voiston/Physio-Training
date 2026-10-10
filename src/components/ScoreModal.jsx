import { useState, useMemo } from 'react';
import { 
  Heart, Dumbbell, Zap, Flame, ShieldAlert, Calendar, 
  ChevronLeft, ChevronRight, CheckCircle2, Clock, RotateCcw,
  Plus, Trash2, ChevronDown, ChevronUp, Layers, Sparkles, Scale, Info,
  BookmarkCheck, BookmarkPlus, Eye, Copy, Check, TrendingUp, ArrowUpRight,
  ArrowDownRight, Minus
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
  computeAdaptiveProgression
} from '../utils/muscleHelpers';
import { MuscleBodyMap } from './MuscleBodyMap';

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

export default function ScoreModal({ info, qualities = [], events = {}, onClose, onSave, onOpenLiveGym }) {
  const todayStr = useMemo(() => getLocalYYYYMMDD(new Date()), []);
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

  const existing = currentSessionData || { 
    rpeMusc: isIsolation ? 8 : '', 
    rpeCardio: isIsolation ? 2 : '', 
    fatigue: isIsolation ? 2 : '', 
    duration: isIsolation ? 10 : '', 
    isEccentric: false, 
    sport: defaultSportForQuality 
  };

  const [sport, setSport] = useState(existing.sport || defaultSportForQuality);
  const [rpeMusc, setRpeMusc] = useState(existing.rpeMusc || (typeof existing === 'number' ? existing : ''));
  const [rpeCardio, setRpeCardio] = useState(existing.rpeCardio || '');
  const [fatigue, setFatigue] = useState(existing.fatigue || '');
  const [duration, setDuration] = useState(existing.duration || '');
  const [isEccentric, setIsEccentric] = useState(
    existing.isEccentric !== undefined 
      ? existing.isEccentric 
      : (info.qId === 'descente' || info.qId === 'plyo')
  );
  const [applyImpacts, setApplyImpacts] = useState(true);

  // --- NAVIGATION PAR ONGLETS (PARAMÈTRES vs EXERCICES) & DUPLICATION ---
  const [activeModalTab, setActiveModalTab] = useState(isIsolation ? 'exercises' : 'parameters');
  const [duplicateSuccess, setDuplicateSuccess] = useState(false);

  // --- MODULE MUSCULATION & EXERCICES PAR GROUPE MUSCULAIRE (OPTION A) ---
  const [exercises, setExercises] = useState(Array.isArray(existing.exercises) ? existing.exercises : []);

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

    if (selectedExId === 'custom') {
      if (!exName) exName = 'Exercice personnalisé';
      exId = `custom_${Date.now()}`;
    } else {
      const found = allAvailableExercises.find(c => c.id === selectedExId);
      exName = found ? found.name : selectedExId;
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
        ...(w !== undefined ? { weightKg: w } : {})
      }
    ]);

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
    if (session) {
      if (typeof session === 'object') {
        setSport(session.sport || defaultSportForQuality);
        setRpeMusc(session.rpeMusc ?? session.rpeMusculaire ?? '');
        setRpeCardio(session.rpeCardio ?? '');
        setFatigue(session.fatigue ?? '');
        setDuration(session.duration ?? '');
        setIsEccentric(session.isEccentric !== undefined ? session.isEccentric : (info.qId === 'descente' || info.qId === 'plyo'));
        setExercises(Array.isArray(session.exercises) ? session.exercises : []);
      } else if (typeof session === 'number') {
        setSport('run');
        setRpeMusc(session);
        setRpeCardio(session);
        setFatigue(session);
        setDuration(45);
        setExercises([]);
      }
    } else {
      // Nouvelle date vierge : calibrage selon la filière (micro-séance ou standard)
      setSport(defaultSportForQuality);
      setRpeMusc(isIsolation ? 8 : '');
      setRpeCardio(isIsolation ? 2 : '');
      setFatigue(isIsolation ? 2 : '');
      setDuration(isIsolation ? 10 : '');
      setIsEccentric(info.qId === 'descente' || info.qId === 'plyo');
      setExercises([]);
    }
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

  // Dominance métabolique
  const totalFactor = (loadCardio + loadMusc) || 1;
  const cardioPercent = Math.round((loadCardio / totalFactor) * 100);
  const muscPercent = 100 - cardioPercent;

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

    if (finalRpeMusc && finalRpeCardio && finalFatigue && finalDuration) {
      const durNum = Number(finalDuration);
      const rpeMNum = Number(finalRpeMusc);
      const rpeCNum = Number(finalRpeCardio);
      const mult = isEccentric ? 1.15 : 1.0;
      const lCardio = Math.round(durNum * rpeCNum);
      const lMusc = Math.round(durNum * rpeMNum * mult);
      const lTotal = isCardio ? lCardio : isForce ? lMusc : Math.round((lCardio + lMusc) / 2);

      onSave({ 
        rpeMusc: rpeMNum, 
        rpeCardio: rpeCNum, 
        fatigue: Number(finalFatigue), 
        duration: durNum, 
        load: lTotal,
        loadCardio: lCardio,
        loadMusc: lMusc,
        sport: isMultiSport ? sport : (existing?.sport || defaultSportForQuality),
        isEccentric: Boolean(isEccentric),
        exercises: exercises.length > 0 ? exercises : undefined
      }, applyImpacts, selectedDate);
    } else {
      onSave(null, applyImpacts, selectedDate);
    }
    onClose();
  };

  const handleDelete = () => {
    onSave(null, applyImpacts, selectedDate);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content !w-[96vw] !max-w-[960px] animate-fadeIn max-h-[92vh] overflow-y-auto custom-scrollbar" onClick={(e) => e.stopPropagation()}>
        
        {/* En-tête de la modale avec Filière et statut Excentrique */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3 flex-wrap gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-bold text-slate-100 tracking-tight m-0">{info.qName}</h3>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                isIsolation
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                  : 'bg-blue-500/20 text-blue-300 border-blue-500/30'
              }`}>
                {isIsolation ? 'Micro-séance Ciblée' : 'Saisie Séance'}
              </span>
            </div>
            <p className="text-xs font-semibold text-slate-400 mt-1 mb-0">
              {isIsolation 
                ? 'Micro-séance : stimule vos muscles cibles sans impacter la fenêtre de rappel globale (Pull/Push)'
                : 'Renseignez la durée, la difficulté perçue (RPE) et les impacts'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {onOpenLiveGym && (
              <button
                type="button"
                onClick={onOpenLiveGym}
                className="px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                title="Passer en mode saisie live à la salle avec chronomètre de repos automatique"
              >
                <Dumbbell size={13} className="text-emerald-400" />
                <span>Mode Salle ⏱️</span>
              </button>
            )}

            {isEccentric && (
              <span className="text-[10px] font-bold px-2 py-1 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1 shadow-sm">
                <Zap size={11} className="text-amber-400" /> Excentrique (+15%)
              </span>
            )}
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
        <div className="p-3 rounded-2xl bg-black/40 border border-white/10 space-y-2.5 mb-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400">
                <Calendar size={14} />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                  Date de la séance
                </span>
                <span className="text-xs font-bold text-white capitalize block mt-0.5">
                  {formatFrenchDate(selectedDate)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Sélecteur natif date rapide */}
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  if (e.target.value) {
                    handleSelectDate(e.target.value);
                    const [y, m] = e.target.value.split('-').map(Number);
                    setViewDate({ year: y, month: m - 1 });
                  }
                }}
                className="bg-slate-900 text-xs font-mono text-slate-200 px-2 py-1 rounded-xl border border-white/10 focus:outline-none focus:border-blue-500 cursor-pointer"
              />

              {/* Bouton d'ouverture / fermeture du calendrier intégré */}
              <button
                type="button"
                onClick={() => setShowCalendarView(!showCalendarView)}
                className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer border flex items-center gap-1 ${
                  showCalendarView 
                    ? 'bg-blue-600 text-white border-blue-400 shadow-sm' 
                    : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/10'
                }`}
                title="Afficher la vue calendrier mensuelle"
              >
                <span>{showCalendarView ? 'Fermer calendrier' : 'Vue calendrier'}</span>
              </button>
            </div>
          </div>

          {/* Raccourcis rapides de date (Aujourd'hui, Hier, J-2, J-3) */}
          <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-white/5">
            <span className="text-[10px] text-slate-400 font-medium">Raccourcis :</span>
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
                  className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer border ${
                    isCurrent
                      ? 'bg-blue-600 text-white border-blue-400 shadow-sm font-bold'
                      : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/5'
                  }`}
                >
                  {sc.label}
                </button>
              );
            })}

            {/* Indicateur si une séance est déjà enregistrée pour cette date */}
            {currentSessionData && (
              <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full">
                <CheckCircle2 size={11} className="text-amber-400" /> Séance existante ({currentSessionData.load || (currentSessionData * 5)} pts)
              </span>
            )}
          </div>

          {/* VUE CALENDRIER MENSUELLE DÉPLIABLE */}
          {showCalendarView && (
            <div className="pt-2 border-t border-white/10 animate-fadeIn space-y-2">
              {/* Navigation Mois & Année */}
              <div className="flex items-center justify-between px-1">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 transition-colors cursor-pointer"
                  title="Mois précédent"
                >
                  <ChevronLeft size={14} />
                </button>

                <span className="text-xs font-bold text-white font-mono uppercase tracking-wider">
                  {MONTH_NAMES[viewDate.month]} {viewDate.year}
                </span>

                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 transition-colors cursor-pointer"
                  title="Mois suivant"
                >
                  <ChevronRight size={14} />
                </button>
              </div>

              {/* En-têtes jours de la semaine */}
              <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400 border-b border-white/5 pb-1">
                {WEEKDAY_NAMES.map((wd, i) => (
                  <span key={i}>{wd}</span>
                ))}
              </div>

              {/* Grille des jours du mois */}
              <div className="grid grid-cols-7 gap-1">
                {calendarGrid.map((item, idx) => {
                  if (!item.day) {
                    return <div key={`empty-${idx}`} className="h-7" />;
                  }

                  return (
                    <button
                      key={item.dateStr}
                      type="button"
                      onClick={() => handleSelectDate(item.dateStr)}
                      className={`relative h-7 rounded-lg text-xs font-semibold flex flex-col items-center justify-center transition-all cursor-pointer ${
                        item.isSelected
                          ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-500/30 ring-1 ring-blue-300'
                          : item.isToday
                          ? 'bg-blue-500/15 text-blue-300 border border-blue-500/40 hover:bg-blue-500/25'
                          : 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/5'
                      }`}
                      title={item.dateStr}
                    >
                      <span>{item.day}</span>
                      
                      {/* Puce indicatrice si une séance a eu lieu */}
                      {item.hasSessionForThisQuality ? (
                        <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-amber-400 shadow-[0_0_4px_rgba(251,191,36,0.8)]" />
                      ) : item.hasOtherSession ? (
                        <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-slate-400 opacity-60" />
                      ) : null}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-400 px-1 pt-1">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                  Séance {info.qName}
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 inline-block opacity-60" />
                  Autre séance
                </span>
              </div>
            </div>
          )}
        </div>
        
        {/* FORMULAIRE DE SAISIE DE LA SÉANCE */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          
          {/* BARRE D'ONGLETS NAVIGATION RAPIDE */}
          <div className="flex items-center gap-2 border-b border-white/10 pb-2.5">
            <button
              type="button"
              onClick={() => setActiveModalTab('parameters')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                activeModalTab === 'parameters'
                  ? 'bg-blue-600 text-white border-blue-400 shadow-md shadow-blue-500/25 ring-1 ring-blue-300'
                  : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/5 hover:text-white'
              }`}
            >
              <Zap size={14} className={activeModalTab === 'parameters' ? 'text-white' : 'text-amber-400'} />
              <span>⚡ Paramètres & Charge</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveModalTab('exercises')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                activeModalTab === 'exercises'
                  ? 'bg-blue-600 text-white border-blue-400 shadow-md shadow-blue-500/25 ring-1 ring-blue-300'
                  : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/5 hover:text-white'
              }`}
            >
              <Dumbbell size={14} className={activeModalTab === 'exercises' ? 'text-white' : 'text-red-400'} />
              <span>🏋️ Musculation & Exercices</span>
              {exercises.length > 0 ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 font-bold ml-1">
                  {exercises.length} exo{exercises.length > 1 ? 's' : ''} · {muscularAnalysis.totalSets} s
                </span>
              ) : (
                <span className="text-[10px] font-normal text-slate-400 opacity-75">
                  (Optionnel)
                </span>
              )}
            </button>
          </div>

          {/* ONGLET 1 : PARAMÈTRES & CHARGE */}
          {activeModalTab === 'parameters' && (
            <div className="space-y-3.5 animate-fadeIn">
              {/* SÉLECTEUR DE SPORT (Course à pied vs Vélo / Home-trainer) pour VO2max, Seuil, EF et Sprint */}
              {isMultiSport && (
                <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2">
                  <label className="text-xs font-semibold text-slate-300 block">
                    Modalité sportive / Pratique :
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setSport('run')}
                      className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        sport === 'run'
                          ? 'bg-blue-600 border-blue-400 text-white shadow-md ring-1 ring-blue-400'
                          : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <span className="text-base">🏃</span>
                      <span>Course à pied</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSport('bike')}
                      className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        sport === 'bike'
                          ? 'bg-amber-600 border-amber-400 text-white shadow-md ring-1 ring-amber-400'
                          : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <span className="text-base">🚴</span>
                      <span>Vélo / HT</span>
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-tight m-0">
                    {sport === 'bike' 
                      ? '🚴 Mode Vélo : Contraction concentrique pure sans chocs au sol. Impact pliométrique (plyo) exclu des transferts.' 
                      : '🏃 Mode Course : Contrainte pliométrique (SSC) et chocs structurels complets.'}
                  </p>
                </div>
              )}

              {/* Raccourci / Statut si des exercices sont renseignés */}
              {exercises.length > 0 ? (
                <div className="p-3 rounded-2xl bg-gradient-to-r from-emerald-950/30 to-blue-950/30 border border-emerald-500/30 flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                      <Dumbbell size={14} />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white block">
                        {exercises.length} exercice{exercises.length > 1 ? 's' : ''} configuré{exercises.length > 1 ? 's' : ''} ({muscularAnalysis.totalSets} séries)
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        Estimation automatique : {muscularAnalysis.suggestedDuration} min · RPE {muscularAnalysis.suggestedRpeMusc}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleApplyToSession}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 border cursor-pointer ${
                        appliedFeedback 
                          ? 'bg-emerald-600 text-white border-emerald-400'
                          : 'bg-white/10 hover:bg-white/20 text-emerald-300 border-emerald-500/30'
                      }`}
                      title="Copier la durée et le RPE calculés par les exercices"
                    >
                      <Sparkles size={12} />
                      <span>{appliedFeedback ? 'Appliqué !' : 'Synchroniser durée & RPE'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveModalTab('exercises')}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-600/30 hover:bg-blue-600/50 text-blue-200 border border-blue-400/30 transition-all cursor-pointer"
                    >
                      Voir exercices →
                    </button>
                  </div>
                </div>
              ) : lastSessionWithExercises && (
                <div className="p-2.5 rounded-xl bg-blue-950/30 border border-blue-500/20 flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-[11px] text-slate-300 flex items-center gap-1.5">
                    <Copy size={12} className="text-blue-400" />
                    Séance précédente trouvée ({lastSessionWithExercises.session.exercises.length} exercices)
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      handleDuplicateLastSession();
                      setActiveModalTab('exercises');
                    }}
                    className="text-xs font-bold text-blue-400 hover:text-blue-300 underline cursor-pointer"
                  >
                    ⚡ Dupliquer en 1 clic
                  </button>
                </div>
              )}

              <div className="input-group">
                <label className="text-xs font-medium text-slate-300">Durée effective (min)</label>
                <input 
                  type="number" 
                  min="1" 
                  max="600" 
                  value={duration} 
                  onChange={(e) => setDuration(e.target.value)} 
                  placeholder="Ex: 45" 
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="input-group !mb-0 p-2.5 rounded-xl bg-red-950/20 border border-red-500/20">
                  <label className="text-xs font-semibold text-red-300 flex items-center gap-1">
                    <Dumbbell size={13} className="text-red-400" /> RPE Musculaire
                  </label>
                  <input 
                    type="number" 
                    min="1" 
                    max="10" 
                    placeholder="1-10" 
                    value={rpeMusc} 
                    onChange={(e) => setRpeMusc(e.target.value)} 
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">Tension, fibres, cuisses</span>
                </div>

                <div className="input-group !mb-0 p-2.5 rounded-xl bg-sky-950/20 border border-sky-500/20">
                  <label className="text-xs font-semibold text-sky-300 flex items-center gap-1">
                    <Heart size={13} className="text-sky-400" /> RPE Cardio
                  </label>
                  <input 
                    type="number" 
                    min="1" 
                    max="10" 
                    placeholder="1-10" 
                    value={rpeCardio} 
                    onChange={(e) => setRpeCardio(e.target.value)} 
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">Souffle, FC, ventilation</span>
                </div>
              </div>

              {/* Option Excentrique & Chocs structurels */}
              <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={isEccentric} 
                    onChange={e => setIsEccentric(e.target.checked)} 
                    className="mt-0.5 rounded accent-amber-500" 
                  />
                  <div className="text-left">
                    <span className="text-xs font-semibold text-amber-300 block flex items-center gap-1">
                      <Flame size={12} className="text-amber-400" /> Stress Excentrique & Impacts Musculaires Élevés
                    </span>
                    <span className="text-[10px] text-slate-400 block leading-tight mt-0.5">
                      Descente trail, pliométrie, charges lourdes (majore la contrainte structurelle mécanique de +15%).
                    </span>
                  </div>
                </label>
              </div>

              <div className="input-group">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-slate-300">Fatigue Perçue Globale Post-Séance (1-10)</label>
                  {fatigue && (
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md font-bold border ${
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
                <input 
                  type="number" 
                  min="1" 
                  max="10" 
                  value={fatigue} 
                  onChange={(e) => setFatigue(e.target.value)} 
                  placeholder="1 (très frais) à 10 (épuisement total)" 
                />
                <p className="text-[10px] text-slate-400 mt-1 leading-tight m-0">
                  {numFatigue > 6 
                    ? `⚡ Marqueur de réponse : Fatigue perçue élevée (${numFatigue}/10). Veillez particulièrement à l'assimilation et au sommeil.` 
                    : numFatigue < 5 
                    ? `🍃 Marqueur de réponse : Séance très bien tolérée (${numFatigue}/10). Disponibilité préservée.`
                    : '🟢 Marqueur de réponse : Niveau de fatigue habituel (5/10).'}
                </p>
              </div>

              {/* Décomposition Charge Multi-Facteurs */}
              <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-300 font-semibold">Charge Stimulus de Séance :</span>
                    {load > 0 && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded font-bold bg-white/10 text-slate-300">
                        {isCardio ? 'Filière Cardio' : isForce ? 'Filière Musculaire' : 'Mixte'}
                      </span>
                    )}
                  </div>
                  <div className="text-right flex items-baseline gap-1.5">
                    <strong className="text-lg font-mono font-bold text-white">
                      {load > 0 ? `${load} UA` : '-'}
                    </strong>
                  </div>
                </div>

                {load > 0 && (
                  <>
                    <div className="grid grid-cols-2 gap-2 text-center text-xs">
                      <div className="p-1.5 rounded-lg bg-sky-500/10 border border-sky-500/20">
                        <span className="text-[10px] text-sky-300 block flex items-center justify-center gap-1">
                          <Heart size={10} /> Charge Cardio
                        </span>
                        <span className="font-bold font-mono text-sky-200">{loadCardio}</span>
                        <span className="text-[9px] text-slate-400 block">{cardioPercent}%</span>
                      </div>

                      <div className="p-1.5 rounded-lg bg-red-500/10 border border-red-500/20">
                        <span className="text-[10px] text-red-300 block flex items-center justify-center gap-1">
                          <Dumbbell size={10} /> Charge Musculaire
                        </span>
                        <span className="font-bold font-mono text-red-200">
                          {loadMusc} {isEccentric && <span className="text-[9px] text-amber-400 font-normal">x1.15</span>}
                        </span>
                        <span className="text-[9px] text-slate-400 block">{muscPercent}%</span>
                      </div>
                    </div>

                    {/* Barre de répartition */}
                    <div className="w-full h-1.5 rounded-full overflow-hidden flex bg-white/10">
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
            <div className="space-y-3.5 animate-fadeIn">
              {/* BANNIÈRE D'ACCÉLÉRATION : DUPLIQUER LA DERNIÈRE SÉANCE */}
              {lastSessionWithExercises && (
                <div className="p-3 rounded-2xl bg-gradient-to-r from-blue-950/40 via-indigo-950/40 to-slate-900 border border-blue-500/30 flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400 shrink-0">
                      <Copy size={16} />
                    </div>
                    <div className="truncate">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-white">
                          Séance précédente ({formatFrenchDate(lastSessionWithExercises.date)})
                        </span>
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-white/10 text-blue-300">
                          {lastSessionWithExercises.session.exercises.length} exercice{lastSessionWithExercises.session.exercises.length > 1 ? 's' : ''}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 m-0 truncate">
                        {lastSessionWithExercises.session.exercises.map(e => e.name).join(' · ')}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleDuplicateLastSession}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-md ${
                      duplicateSuccess
                        ? 'bg-emerald-600 text-white shadow-emerald-500/30 ring-1 ring-emerald-400'
                        : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/25 hover:scale-[1.02]'
                    }`}
                    title="Cloner instantanément tous les exercices de la dernière séance"
                  >
                    {duplicateSuccess ? (
                      <>
                        <Check size={14} className="text-white" />
                        <span>Séance clonée avec succès !</span>
                      </>
                    ) : (
                      <>
                        <Copy size={14} />
                        <span>Dupliquer la dernière séance</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Formulaire d'ajout rapide d'un exercice */}
              <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {/* Sélection de l'exercice */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] font-bold uppercase text-slate-300 block">
                        Exercice
                      </label>
                      <div className="flex items-center gap-2">
                        {customExercises.some(e => e.id === selectedExId) && (
                          <button
                            type="button"
                            onClick={(e) => handleDeleteCustomExercise(selectedExId, e)}
                            className="text-[10px] text-rose-400 hover:text-rose-300 font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                            title="Supprimer cet exercice de la bibliothèque"
                          >
                            <Trash2 size={11} />
                            <span>Supprimer</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setIsCreatingCustom(!isCreatingCustom)}
                          className="text-[10px] text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <BookmarkPlus size={11} />
                          <span>{isCreatingCustom ? 'Fermer création' : '+ Créer exo perso'}</span>
                        </button>
                      </div>
                    </div>
                    <select
                      value={selectedExId}
                      onChange={(e) => {
                        if (e.target.value === '__create_new__') {
                          setIsCreatingCustom(true);
                        } else {
                          setSelectedExId(e.target.value);
                          setSuggestionApplied(false);
                        }
                      }}
                      className="w-full bg-slate-900 border border-white/10 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none focus:border-blue-400 cursor-pointer"
                    >
                      {customExercises.length > 0 && (
                        <optgroup label="⭐ Mes Exercices Personnalisés">
                          {customExercises.map(e => (
                            <option key={e.id} value={e.id}>⭐ {e.name}</option>
                          ))}
                        </optgroup>
                      )}
                      <optgroup label="Bas du corps (Lower)">
                        {EXERCISE_CATALOG.filter(e => e.category === 'lower').map(e => (
                          <option key={e.id} value={e.id}>{e.name}</option>
                        ))}
                      </optgroup>
                      <optgroup label="Haut du corps - Poussée (Push)">
                        {EXERCISE_CATALOG.filter(e => e.category === 'upper_push').map(e => (
                          <option key={e.id} value={e.id}>{e.name}</option>
                        ))}
                      </optgroup>
                      <optgroup label="Haut du corps - Tirage (Pull)">
                        {EXERCISE_CATALOG.filter(e => e.category === 'upper_pull').map(e => (
                          <option key={e.id} value={e.id}>{e.name}</option>
                        ))}
                      </optgroup>
                      <optgroup label="Tronc & Core">
                        {EXERCISE_CATALOG.filter(e => e.category === 'core').map(e => (
                          <option key={e.id} value={e.id}>{e.name}</option>
                        ))}
                      </optgroup>
                      <option value="__create_new__">➕ Créer un nouvel exercice personnalisé...</option>
                    </select>
                  </div>

                  {/* Cibles musculaires de l'exercice sélectionné */}
                  <div className="flex items-center gap-1 text-[11px] text-slate-400 self-end pb-2">
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
                        <label className="text-[10px] font-semibold text-slate-300 block mb-0.5">
                          Nom de l'exercice
                        </label>
                        <input
                          type="text"
                          value={newExName}
                          onChange={(e) => setNewExName(e.target.value)}
                          placeholder="Ex: Hack Squat, Landmine Press..."
                          className="w-full bg-slate-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-400"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-semibold text-slate-300 block mb-0.5">
                          Catégorie
                        </label>
                        <select
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
                        <label className="text-[10px] font-semibold text-slate-300 block mb-0.5">
                          Muscle Moteur Principal (100% de tension)
                        </label>
                        <select
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
                        <label className="text-[10px] font-semibold text-slate-300 block mb-0.5">
                          Muscle Secondaire Synergiste (50% de tension, optionnel)
                        </label>
                        <select
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
                          className={`self-start sm:self-center px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 shadow-sm ${
                            suggestionApplied
                              ? 'bg-emerald-600 text-white shadow-emerald-500/25 ring-1 ring-emerald-400'
                              : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 hover:border-emerald-400/60'
                          }`}
                          title="Pré-remplir automatiquement les paramètres avec cette suggestion"
                        >
                          {suggestionApplied ? (
                            <>
                              <Check size={14} className="stroke-[2.5]" />
                              <span>Suggestion appliquée !</span>
                            </>
                          ) : (
                            <>
                              <Sparkles size={13} className="text-emerald-400" />
                              <span>
                                Appliquer {loadSuggestion.suggestedWeightKg !== undefined ? `(${loadSuggestion.suggestedWeightKg} kg)` : 'la suggestion'}
                              </span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/5 text-xs text-slate-400">
                      <div className="flex items-center gap-2">
                        <Sparkles size={13} className="text-blue-400/70 shrink-0" />
                        <span className="text-[11px] text-slate-300">{loadSuggestion.reason}</span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-500 shrink-0">Zone MAV cible : 2 RIR</span>
                    </div>
                  )
                )}

                {/* Ligne Paramètres : Séries, RIR (Prioritaire), Reps (Optionnel), Poids (Optionnel) et Bouton Ajouter */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end pt-1">
                  {/* Séries (obligatoire) */}
                  <div className="sm:col-span-2">
                    <label className="text-[10px] font-bold uppercase text-slate-300 block mb-1">
                      Séries *
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={exSets}
                      onChange={(e) => setExSets(e.target.value)}
                      className="w-full bg-slate-900 border border-white/10 rounded-xl px-2.5 py-2 text-xs text-center font-mono font-bold text-white focus:outline-none focus:border-blue-400"
                    />
                  </div>

                  {/* RIR (Reps In Reserve - Prioritaire) */}
                  <div className="sm:col-span-4">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] font-bold uppercase text-emerald-400 block">
                        RIR (Proximité échec) *
                      </label>
                      <span className="text-[9px] font-mono text-slate-400">
                        RPE {Math.min(10, Math.max(1, 10 - (Number(exRir) || 0)))}
                      </span>
                    </div>
                    <select
                      value={exRir}
                      onChange={(e) => setExRir(e.target.value)}
                      className="w-full bg-slate-900 border border-emerald-500/30 rounded-xl px-2.5 py-2 text-xs font-semibold text-emerald-300 focus:outline-none focus:border-emerald-400 cursor-pointer"
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
                    <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
                      Reps <span className="text-[9px] text-slate-500 font-normal">(opt.)</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      placeholder="Opt. (ex: 8)"
                      value={exReps}
                      onChange={(e) => setExReps(e.target.value)}
                      className="w-full bg-slate-900 border border-white/10 rounded-xl px-2.5 py-2 text-xs text-center font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-400"
                    />
                  </div>

                  {/* Poids / Charge (Optionnel) */}
                  <div className="sm:col-span-2">
                    <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
                      Poids kg <span className="text-[9px] text-slate-500 font-normal">(opt.)</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      placeholder="Opt. (ex: 80)"
                      value={exWeight}
                      onChange={(e) => setExWeight(e.target.value)}
                      className="w-full bg-slate-900 border border-white/10 rounded-xl px-2.5 py-2 text-xs text-center font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-400"
                    />
                  </div>

                  {/* Bouton Ajouter */}
                  <div className="sm:col-span-2">
                    <button
                      type="button"
                      onClick={handleAddExercise}
                      className="w-full py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm hover:shadow-blue-500/25"
                      title="Ajouter cet exercice à la séance"
                    >
                      <Plus size={14} />
                      <span>Ajouter</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Liste des exercices ajoutés */}
              {exercises.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                    <span className="font-semibold text-slate-300">Exercices programmés ({exercises.length}) :</span>
                    <span className="font-mono text-[11px]">{muscularAnalysis.totalSets} séries · RPE moy. {muscularAnalysis.weightedAvgRpe}</span>
                  </div>

                  <div className="space-y-2 max-h-56 overflow-y-auto custom-scrollbar pr-1">
                    {exercises.map((ex, idx) => {
                      const rirVal = ex.rir !== undefined ? ex.rir : (ex.rpe ? Math.max(0, 10 - ex.rpe) : 2);
                      let rirBadgeColor = 'bg-slate-800 text-slate-300 border-slate-700';
                      if (rirVal === 0) rirBadgeColor = 'bg-rose-500/20 text-rose-300 border-rose-500/40 font-bold';
                      else if (rirVal <= 2) rirBadgeColor = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 font-bold';
                      else if (rirVal === 3) rirBadgeColor = 'bg-sky-500/20 text-sky-300 border-sky-500/30';

                      const tonnage = (ex.reps && ex.weightKg) ? Math.round(ex.sets * ex.reps * ex.weightKg) : null;

                      return (
                        <div
                          key={`${ex.id}-${idx}`}
                          className="flex items-center justify-between p-3 rounded-xl bg-white/[0.04] border border-white/5 hover:border-white/10 text-xs transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-mono font-bold text-slate-300 shrink-0">
                              {idx + 1}
                            </span>
                            <div className="truncate">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-white truncate">{ex.name}</span>
                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono border ${rirBadgeColor}`}>
                                  {rirVal} RIR (RPE {10 - rirVal})
                                </span>
                              </div>
                              <span className="text-[11px] text-slate-400 font-mono mt-0.5 block">
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
                            className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 transition-colors cursor-pointer shrink-0 ml-2"
                            title="Supprimer cet exercice"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Synthèse visuelle de la charge par muscle avec bascule Mannequin */}
                  {muscularAnalysis.sortedMuscles.length > 0 && (
                    <div className="p-3 rounded-2xl bg-black/40 border border-white/10 space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <span className="text-xs font-bold uppercase text-slate-300 tracking-wider flex items-center gap-1.5">
                          <Layers size={13} className="text-blue-400" />
                          Charge calculée par muscle :
                        </span>
                        
                        {/* Bascule Vue Jauges vs Mannequin */}
                        <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/10">
                          <button
                            type="button"
                            onClick={() => setShowBodyMapInModal(false)}
                            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                              !showBodyMapInModal ? 'bg-blue-600 text-white font-bold shadow-sm' : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            Jauges
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowBodyMapInModal(true)}
                            className={`px-3 py-1 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                              showBodyMapInModal ? 'bg-blue-600 text-white font-bold shadow-sm' : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            <Eye size={12} />
                            <span>Mannequin Face & Dos</span>
                          </button>
                        </div>
                      </div>

                      {showBodyMapInModal ? (
                        <div className="animate-fadeIn p-2 bg-slate-950/70 rounded-xl border border-white/5">
                          <MuscleBodyMap muscleLoads={muscularAnalysis.muscleLoads} />
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                          {muscularAnalysis.sortedMuscles.map(m => (
                            <div
                              key={m.muscleId}
                              className="p-2 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col justify-between"
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-xs font-semibold text-slate-200 truncate" title={m.name}>
                                  {m.name}
                                </span>
                                <span className="text-[10px] font-mono font-bold text-blue-300 shrink-0">
                                  {m.effectiveSets} s
                                </span>
                              </div>
                              <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden mt-1.5">
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
                      <div className="pt-2.5 border-t border-white/10 flex items-center justify-between gap-2 flex-wrap">
                        <div className="text-xs text-slate-300 leading-tight">
                          Estimation séance : <strong className="text-white font-mono">{muscularAnalysis.suggestedDuration} min</strong> à RPE <strong className="text-amber-300 font-mono">{muscularAnalysis.suggestedRpeMusc}</strong>
                        </div>

                        <button
                          type="button"
                          onClick={handleApplyToSession}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                            appliedFeedback
                              ? 'bg-emerald-600 text-white border-emerald-400 shadow-md shadow-emerald-500/25'
                              : 'bg-white/10 hover:bg-white/20 text-blue-300 hover:text-white border-blue-500/30'
                          }`}
                          title="Synchronise la durée et le RPE de la séance selon vos exercices"
                        >
                          <Sparkles size={13} className={appliedFeedback ? 'text-white' : 'text-blue-400'} />
                          <span>{appliedFeedback ? 'Appliqué à la séance !' : 'Appliquer durée & RPE'}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-8 text-center rounded-2xl bg-white/[0.02] border border-dashed border-white/10 text-slate-400 text-xs space-y-2">
                  <div className="w-10 h-10 mx-auto rounded-full bg-white/5 flex items-center justify-center text-slate-400">
                    <Dumbbell size={20} />
                  </div>
                  <p className="font-semibold text-slate-300 m-0">Aucun exercice programmé pour le moment</p>
                  <p className="text-[11px] text-slate-500 max-w-sm mx-auto m-0">
                    Sélectionnez un exercice ci-dessus ou cliquez sur « Dupliquer la dernière séance » pour insérer automatiquement vos séries et RIR.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* PIED DE MODALE FIXE : ACTIONS */}
          <div className="modal-actions pt-3 border-t border-white/10 flex items-center justify-between gap-2">
            {currentSessionData ? (
              <button 
                type="button" 
                className="btn-delete" 
                onClick={handleDelete}
              >
                Supprimer
              </button>
            ) : <div />}

            <div className="flex items-center gap-2">
              <button type="button" className="btn-cancel" onClick={onClose}>
                Annuler
              </button>
              <button type="submit" className="btn-save flex items-center gap-1.5 font-bold">
                <CheckCircle2 size={14} />
                <span>Enregistrer ({selectedDate})</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
