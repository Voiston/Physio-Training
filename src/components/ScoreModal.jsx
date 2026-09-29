import { useState, useMemo } from 'react';
import { 
  Heart, Dumbbell, Zap, Flame, ShieldAlert, Calendar, 
  ChevronLeft, ChevronRight, CheckCircle2, Clock, RotateCcw 
} from 'lucide-react';
import { getLocalYYYYMMDD } from '../utils/dateHelpers';
import { getQualityImpacts } from '../utils/physiology';

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
  const existing = currentSessionData || { rpeMusc: '', rpeCardio: '', fatigue: '', duration: '', isEccentric: false, sport: 'run' };

  const [sport, setSport] = useState(existing.sport || 'run');
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

  // Fonction pour basculer sur une autre date et recharger son formulaire
  const handleSelectDate = (newDateStr) => {
    setSelectedDate(newDateStr);
    const session = getSessionForDate(newDateStr);
    if (session) {
      if (typeof session === 'object') {
        setSport(session.sport || 'run');
        setRpeMusc(session.rpeMusc ?? session.rpeMusculaire ?? '');
        setRpeCardio(session.rpeCardio ?? '');
        setFatigue(session.fatigue ?? '');
        setDuration(session.duration ?? '');
        setIsEccentric(session.isEccentric !== undefined ? session.isEccentric : (info.qId === 'descente' || info.qId === 'plyo'));
      } else if (typeof session === 'number') {
        setSport('run');
        setRpeMusc(session);
        setRpeCardio(session);
        setFatigue(session);
        setDuration(45);
      }
    } else {
      // Nouvelle date vierge : conserver la durée par défaut ou vider
      setSport('run');
      setRpeMusc('');
      setRpeCardio('');
      setFatigue('');
      setDuration('');
      setIsEccentric(info.qId === 'descente' || info.qId === 'plyo');
    }
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

  // Calcul Multi-Facteurs (Cardio vs Musculaire vs Excentrique)
  const numDur = Number(duration) || 0;
  const numCardio = Number(rpeCardio) || 0;
  const numMusc = Number(rpeMusc) || 0;

  const eccentricMultiplier = isEccentric ? 1.35 : 1.0;
  const loadCardio = Math.round(numDur * numCardio);
  const loadMusc = Math.round(numDur * numMusc * eccentricMultiplier);
  
  // Charge globale équilibrée
  const load = numDur && numCardio && numMusc
    ? Math.round((loadCardio + loadMusc) / 2)
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
        sport: isMultiSport ? sport : (existing?.sport || 'run'),
        isEccentric: Boolean(isEccentric)
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
              Renseignez la charge aiguë TRIMP et les impacts physiologiques
            </p>
          </div>

          {isEccentric && (
            <span className="text-[10px] font-bold px-2 py-1 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1 shadow-sm">
              <Zap size={11} className="text-amber-400" /> Excentrique (+35%)
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
                  Descente trail, pliométrie, charges lourdes. Multiplie la contrainte structurelle (+35% créatine-kinase, 72h de régénération).
                </span>
              </div>
            </label>
          </div>

          <div className="input-group">
            <label className="text-xs font-medium text-slate-300">Fatigue Perçue Globale Post-Séance (1-10)</label>
            <input 
              type="number" 
              min="1" 
              max="10" 
              value={fatigue} 
              onChange={(e) => setFatigue(e.target.value)} 
              placeholder="Niveau d'épuisement général" 
            />
          </div>

          {/* Décomposition TRIMP Multi-Facteurs */}
          <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-300 font-semibold">Charge Globale Totale :</span>
              <strong className="text-lg font-mono font-bold text-white">
                {load > 0 ? load : '-'}
              </strong>
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
                      {loadMusc} {isEccentric && <span className="text-[9px] text-amber-400 font-normal">x1.35</span>}
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
                      return `${targetName} ${Math.round(i.ratio * 100)}%`;
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
              <button type="submit" className="btn-save">
                Valider ({selectedDate})
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
