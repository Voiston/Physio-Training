import { useState, useMemo } from 'react';
import { 
  Heart, Dumbbell, Zap, Flame, ShieldAlert, Calendar, 
  ChevronLeft, ChevronRight, CheckCircle2, Clock, RotateCcw,
  Plus, Trash2, ChevronDown, ChevronUp, Layers, Sparkles, Scale, Info,
  BookmarkCheck, BookmarkPlus, Eye
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
  CustomExercise
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

export default function ScoreModal({ info, qualities = [], events = {}, onClose, onSave }) {
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
  const existing = currentSessionData || { rpeMusc: '', rpeCardio: '', fatigue: '', duration: '', isEccentric: false, sport: defaultSportForQuality };

  const isForce = ['pull', 'push', 'leg', 'plyo', 'descente', 'abdos', 'proprio'].includes(info.qId);

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

  // --- MODULE MUSCULATION & EXERCICES PAR GROUPE MUSCULAIRE (OPTION A) ---
  const [exercises, setExercises] = useState(Array.isArray(existing.exercises) ? existing.exercises : []);
  const [isMusclesExpanded, setIsMusclesExpanded] = useState(
    Boolean(isForce || (existing.exercises && existing.exercises.length > 0))
  );

  const defaultExForQuality = useMemo(() => {
    if (info.qId === 'push') return 'bench_press';
    if (info.qId === 'pull') return 'pull_ups';
    if (info.qId === 'leg' || info.qId === 'descente') return 'squat';
    if (info.qId === 'plyo') return 'squat';
    if (info.qId === 'abdos') return 'abdos_crunch';
    return 'squat';
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
  const [exSets, setExSets] = useState('4');
  const [exReps, setExReps] = useState('8');
  const [exRpe, setExRpe] = useState('8');
  const [exWeight, setExWeight] = useState('');
  const [appliedFeedback, setAppliedFeedback] = useState(false);

  // Analyse musculaire instantanée (avec prise en compte des exercices customisés de la bibliothèque)
  const muscularAnalysis = useMemo(() => {
    return computeSessionMuscularBreakdown(exercises, customExercises);
  }, [exercises, customExercises]);

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
    const r = Math.max(1, Number(exReps) || 8);
    const rp = Math.min(10, Math.max(1, Number(exRpe) || 8));
    const w = exWeight ? Number(exWeight) : undefined;

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
        reps: r,
        rpe: rp,
        weightKg: w
      }
    ]);

    setCustomExName('');
    setAppliedFeedback(false);
  };

  const handleRemoveExercise = (indexToRemove) => {
    setExercises(prev => prev.filter((_, idx) => idx !== indexToRemove));
    setAppliedFeedback(false);
  };

  const handleApplyToSession = () => {
    if (muscularAnalysis.totalSets === 0) return;
    setDuration(muscularAnalysis.suggestedDuration);
    setRpeMusc(muscularAnalysis.suggestedRpeMusc);
    if (!rpeCardio) setRpeCardio(4);
    if (!fatigue) setFatigue(muscularAnalysis.suggestedRpeMusc);
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
      // Nouvelle date vierge : conserver la durée par défaut ou vider
      setSport('run');
      setRpeMusc('');
      setRpeCardio('');
      setFatigue('');
      setDuration('');
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
    if (rpeMusc && rpeCardio && fatigue && duration) {
      onSave({ 
        rpeMusc: Number(rpeMusc), 
        rpeCardio: Number(rpeCardio), 
        fatigue: Number(fatigue), 
        duration: Number(duration), 
        load,
        loadCardio,
        loadMusc,
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
      <div className="modal-content !max-w-lg animate-fadeIn max-h-[90vh] overflow-y-auto custom-scrollbar" onClick={(e) => e.stopPropagation()}>
        
        {/* En-tête de la modale avec Filière et statut Excentrique */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-bold text-slate-100 tracking-tight m-0">{info.qName}</h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                Saisie Séance
              </span>
            </div>
            <p className="text-xs font-semibold text-slate-400 mt-1 mb-0">
              Renseignez la durée, la difficulté perçue (RPE) et les impacts
            </p>
          </div>

          {isEccentric && (
            <span className="text-[10px] font-bold px-2 py-1 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1 shadow-sm">
              <Zap size={11} className="text-amber-400" /> Excentrique (+15%)
            </span>
          )}
        </div>

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

          <div className="input-group">
            <label className="text-xs font-medium text-slate-300">Durée effective (min)</label>
            <input 
              type="number" 
              min="1" 
              max="600" 
              value={duration} 
              onChange={(e) => setDuration(e.target.value)} 
              autoFocus 
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

          {/* MODULE MUSCULATION & EXERCICES PAR GROUPE (OPTION A) */}
          <div className="p-3 rounded-2xl bg-gradient-to-b from-slate-900/90 to-slate-950/90 border border-white/10 space-y-3">
            {/* Header Accordéon */}
            <div 
              onClick={() => setIsMusclesExpanded(!isMusclesExpanded)}
              className="flex items-center justify-between cursor-pointer select-none group"
            >
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-red-500/20 text-red-400">
                  <Dumbbell size={14} />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-white group-hover:text-blue-300 transition-colors">
                      Détail Musculation & Exercices
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-slate-300">
                      Optionnel
                    </span>
                    {exercises.length > 0 && (
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        {exercises.length} exo{exercises.length > 1 ? 's' : ''} · {muscularAnalysis.totalSets} séries
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 m-0">
                    Renseignez vos exercices & séries pour calculer la charge par groupe musculaire
                  </p>
                </div>
              </div>

              <button 
                type="button" 
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                {isMusclesExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
            </div>

            {isMusclesExpanded && (
              <div className="space-y-3 pt-2 border-t border-white/10 animate-fadeIn">
                {/* Formulaire d'ajout rapide d'un exercice */}
                <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 space-y-2.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {/* Sélection de l'exercice */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[10px] font-semibold uppercase text-slate-400 block">
                          Exercice
                        </label>
                        <button
                          type="button"
                          onClick={() => setIsCreatingCustom(!isCreatingCustom)}
                          className="text-[10px] text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <BookmarkPlus size={11} />
                          <span>{isCreatingCustom ? 'Fermer création' : '+ Créer exo perso'}</span>
                        </button>
                      </div>
                      <select
                        value={selectedExId}
                        onChange={(e) => {
                          if (e.target.value === '__create_new__') {
                            setIsCreatingCustom(true);
                          } else {
                            setSelectedExId(e.target.value);
                          }
                        }}
                        className="w-full bg-slate-900 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-400 cursor-pointer"
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
                    <div className="flex items-center gap-1 text-[11px] text-slate-400 self-end pb-1.5">
                      <Info size={12} className="text-blue-400 shrink-0" />
                      <span className="truncate">
                        Cibles : {Object.entries(allAvailableExercises.find(c => c.id === selectedExId)?.muscleRatios || {})
                          .map(([mId, r]) => `${MUSCLE_GROUPS[mId]?.name || mId} (${Math.round(r * 100)}%)`)
                          .join(', ')}
                      </span>
                    </div>
                  </div>

                  {/* FORMULAIRE DE CRÉATION D'EXERCICE PERSONNALISÉ (FEATURE 5) */}
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
                            className="w-full bg-slate-900 border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-400"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-semibold text-slate-300 block mb-0.5">
                            Catégorie
                          </label>
                          <select
                            value={newExCategory}
                            onChange={(e) => setNewExCategory(e.target.value)}
                            className="w-full bg-slate-900 border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-400 cursor-pointer"
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
                            className="w-full bg-slate-900 border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-400 cursor-pointer"
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
                            className="w-full bg-slate-900 border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-400 cursor-pointer"
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

                  {/* Ligne Paramètres : Séries, Reps, RPE, Poids et Bouton Ajouter */}
                  <div className="grid grid-cols-5 gap-2 items-end pt-1">
                    <div>
                      <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-0.5">
                        Séries
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="20"
                        value={exSets}
                        onChange={(e) => setExSets(e.target.value)}
                        className="w-full bg-slate-900 border border-white/10 rounded-lg px-2 py-1 text-xs text-center font-mono font-bold text-white focus:outline-none focus:border-blue-400"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-0.5">
                        Reps
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={exReps}
                        onChange={(e) => setExReps(e.target.value)}
                        className="w-full bg-slate-900 border border-white/10 rounded-lg px-2 py-1 text-xs text-center font-mono font-bold text-white focus:outline-none focus:border-blue-400"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-0.5">
                        RPE (1-10)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={exRpe}
                        onChange={(e) => setExRpe(e.target.value)}
                        className="w-full bg-slate-900 border border-white/10 rounded-lg px-2 py-1 text-xs text-center font-mono font-bold text-amber-300 focus:outline-none focus:border-blue-400"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-semibold uppercase text-slate-400 block mb-0.5">
                        Kg (opt.)
                      </label>
                      <input
                        type="number"
                        min="0"
                        placeholder="Ex: 80"
                        value={exWeight}
                        onChange={(e) => setExWeight(e.target.value)}
                        className="w-full bg-slate-900 border border-white/10 rounded-lg px-2 py-1 text-xs text-center font-mono text-slate-300 focus:outline-none focus:border-blue-400"
                      />
                    </div>

                    <div>
                      <button
                        type="button"
                        onClick={handleAddExercise}
                        className="w-full py-1 px-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-1 transition-all cursor-pointer shadow-sm"
                        title="Ajouter cet exercice à la séance"
                      >
                        <Plus size={13} />
                        <span>Ajouter</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Liste des exercices ajoutés */}
                {exercises.length > 0 ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                      <span>Exercices programmés ({exercises.length}) :</span>
                      <span className="font-mono text-[10px]">{muscularAnalysis.totalSets} séries · {muscularAnalysis.totalReps} reps · RPE moy. {muscularAnalysis.weightedAvgRpe}</span>
                    </div>

                    <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                      {exercises.map((ex, idx) => (
                        <div
                          key={`${ex.id}-${idx}`}
                          className="flex items-center justify-between p-2 rounded-xl bg-white/[0.04] border border-white/5 hover:border-white/10 text-xs transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-mono font-bold text-slate-300 shrink-0">
                              {idx + 1}
                            </span>
                            <div className="truncate">
                              <span className="font-bold text-white block truncate">{ex.name}</span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {ex.sets} séries × {ex.reps} reps @ RPE {ex.rpe}
                                {ex.weightKg ? ` (${ex.weightKg} kg)` : ''}
                              </span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveExercise(idx)}
                            className="p-1 rounded-lg text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 transition-colors cursor-pointer shrink-0 ml-2"
                            title="Supprimer cet exercice"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Synthèse visuelle de la charge par muscle avec bascule Mannequin (Feature 3) */}
                    {muscularAnalysis.sortedMuscles.length > 0 && (
                      <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 space-y-2">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider flex items-center gap-1">
                            <Layers size={11} className="text-blue-400" />
                            Charge calculée par muscle :
                          </span>
                          
                          {/* Bascule Vue Jauges vs Mannequin */}
                          <div className="flex items-center gap-1 bg-white/5 p-0.5 rounded-lg border border-white/10">
                            <button
                              type="button"
                              onClick={() => setShowBodyMapInModal(false)}
                              className={`px-2 py-0.5 text-[10px] font-semibold rounded transition-all cursor-pointer ${
                                !showBodyMapInModal ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                              }`}
                            >
                              Jauges
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowBodyMapInModal(true)}
                              className={`px-2 py-0.5 text-[10px] font-semibold rounded flex items-center gap-1 transition-all cursor-pointer ${
                                showBodyMapInModal ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                              }`}
                            >
                              <Eye size={10} />
                              <span>Mannequin</span>
                            </button>
                          </div>
                        </div>

                        {showBodyMapInModal ? (
                          <div className="animate-fadeIn">
                            <MuscleBodyMap muscleLoads={muscularAnalysis.muscleLoads} />
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                            {muscularAnalysis.sortedMuscles.map(m => (
                              <div
                                key={m.muscleId}
                                className="p-1.5 rounded-lg bg-white/[0.03] border border-white/5 flex flex-col justify-between"
                              >
                                <div className="flex items-center justify-between gap-1">
                                  <span className="text-[11px] font-semibold text-slate-200 truncate" title={m.name}>
                                    {m.name}
                                  </span>
                                  <span className="text-[10px] font-mono font-bold text-blue-300 shrink-0">
                                    {m.effectiveSets} s
                                  </span>
                                </div>
                                <div className="w-full bg-white/10 h-1 rounded-full overflow-hidden mt-1">
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
                        <div className="pt-2 border-t border-white/5 flex items-center justify-between gap-2 flex-wrap">
                          <div className="text-[10px] text-slate-400 leading-tight">
                            Estimation séance : <strong className="text-white font-mono">{muscularAnalysis.suggestedDuration} min</strong> à RPE <strong className="text-amber-300 font-mono">{muscularAnalysis.suggestedRpeMusc}</strong>
                          </div>

                          <button
                            type="button"
                            onClick={handleApplyToSession}
                            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                              appliedFeedback
                                ? 'bg-emerald-600 text-white border-emerald-400 shadow-md shadow-emerald-500/25'
                                : 'bg-white/10 hover:bg-white/20 text-blue-300 hover:text-white border-blue-500/30'
                            }`}
                            title="Pré-remplit automatiquement la durée et le RPE de la séance selon vos exercices"
                          >
                            <Sparkles size={12} className={appliedFeedback ? 'text-white' : 'text-blue-400'} />
                            <span>{appliedFeedback ? 'Appliqué à la séance !' : 'Appliquer durée & RPE'}</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3 text-center rounded-xl bg-white/[0.02] border border-dashed border-white/10 text-slate-400 text-xs">
                    Ajoutez vos exercices ci-dessus pour calculer automatiquement la charge par muscle.
                  </div>
                )}
              </div>
            )}
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

          <div className="modal-actions pt-2 flex items-center justify-between gap-2">
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
