import React, { useState, useMemo } from 'react';
import type { TooltipContentProps } from 'recharts';
import { Quality, SessionData } from '../hooks/useData';
import { 
  computeAllWeeksStats, 
  sortQualitiesBreakdown, 
  QualitySortField, 
  WeekStats,
  formatMinutes
} from '../utils/weekHelpers';
import { 
  Bar, Line, ComposedChart, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, Cell
} from 'recharts';
import { 
  Calendar, Clock, Zap, TrendingUp, TrendingDown, ArrowUpRight, 
  ArrowDownRight, Sparkles, Filter, 
  ArrowUpDown, Scale, Copy, Check, Info, Bike, Footprints, Dumbbell, Layers
} from 'lucide-react';
import { 
  computeWeeklyMuscularSummary, 
  computeMuscularAlerts,
  getSavedCustomExercises,
  MUSCLE_GROUPS 
} from '../utils/muscleHelpers';
import { MuscleBodyMap } from './MuscleBodyMap';
import { MuscleRadarChart } from './MuscleRadarChart';
import { MuscleAlertsBanner } from './MuscleAlertsBanner';

interface WeeklyAnalysisViewProps {
  events: Record<string, Record<string, SessionData>>;
  qualities: Quality[];
  allWeeksStats?: WeekStats[];
  onOpenScoreModal?: (q: Quality, dateStr: string, sessionData?: SessionData) => void;
  showToast?: (toast: { type: 'success' | 'info' | 'warning' | 'error'; title: string; message: string }) => void;
}

interface WeeklyChartDatum {
  fullLabel: string;
  relative: string;
  totalLoad: number;
  durationHours: number;
  sessions: number;
  acwr: number;
}

const WeeklyChartTooltip = React.memo(function WeeklyChartTooltip({ active, payload }: TooltipContentProps) {
  if (active && payload && payload.length) {
    const data = payload[0].payload as WeeklyChartDatum;
    return (
      <div className="bg-slate-950/95 backdrop-blur-md p-3 border border-white/15 rounded-xl shadow-2xl text-xs min-w-[200px]">
        <div className="font-bold text-white border-b border-white/10 pb-1 mb-1.5 flex justify-between">
          <span>{data.fullLabel}</span>
          <span className="text-blue-400 font-mono">{data.relative}</span>
        </div>
        <div className="space-y-1 font-mono">
          <div className="flex justify-between text-amber-300">
            <span>Charge totale :</span>
            <span className="font-bold">{data.totalLoad} UA</span>
          </div>
          <div className="flex justify-between text-sky-300">
            <span>Temps total :</span>
            <span className="font-bold">{data.durationHours} h ({Math.round(data.durationHours * 60)}m)</span>
          </div>
          <div className="flex justify-between text-slate-300">
            <span>Séances :</span>
            <span>{data.sessions}</span>
          </div>
          <div className="flex justify-between text-purple-300 border-t border-white/10 pt-1 mt-1">
            <span>Ratio ACWR :</span>
            <span className="font-bold">{data.acwr}</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
});

export const WeeklyAnalysisView: React.FC<WeeklyAnalysisViewProps> = ({
  events,
  qualities,
  allWeeksStats,
  showToast
}) => {
  // Statistiques hebdomadaires (injectées depuis useData ou calculées en fallback)
  const allWeeks = useMemo(() => {
    if (allWeeksStats && allWeeksStats.length > 0) return allWeeksStats;
    return computeAllWeeksStats(events, qualities, 6, 2);
  }, [allWeeksStats, events, qualities]);

  // Semaine actuellement sélectionnée pour inspection détaillée (par défaut : semaine en cours S0)
  const currentWeek = useMemo(() => {
    return allWeeks.find(w => w.isCurrentWeek) || allWeeks[allWeeks.length - 1];
  }, [allWeeks]);

  const [selectedWeekId, setSelectedWeekId] = useState<string>(currentWeek.weekId);

  // Semaine active inspectée
  const activeWeek = useMemo(() => {
    return allWeeks.find(w => w.weekId === selectedWeekId) || currentWeek;
  }, [allWeeks, selectedWeekId]);

  // Mode Comparateur direct (Semaine A vs Semaine B)
  const [isCompareMode, setIsCompareMode] = useState<boolean>(false);
  const [compareWeekId, setCompareWeekId] = useState<string>(() => {
    // Par défaut, comparer avec la semaine précédente (S-1)
    const curIdx = allWeeks.findIndex(w => w.weekId === currentWeek.weekId);
    if (curIdx > 0) return allWeeks[curIdx - 1].weekId;
    return allWeeks[0]?.weekId || '';
  });

  const comparisonTargetWeek = useMemo(() => {
    return allWeeks.find(w => w.weekId === compareWeekId) || null;
  }, [allWeeks, compareWeekId]);

  // Tri et filtre par qualité
  const [sortBy, setSortBy] = useState<QualitySortField>('load');
  const [sortDescending, setSortDescending] = useState<boolean>(true);
  const [selectedQualityFilter, setSelectedQualityFilter] = useState<string>('all');
  const [copiedSummary, setCopiedSummary] = useState<boolean>(false);
  const [breakdownTab, setBreakdownTab] = useState<'qualities' | 'muscles'>('qualities');
  const [selectedMuscleId, setSelectedMuscleId] = useState<string | null>(null);
  const [showVolumeGuide, setShowVolumeGuide] = useState<boolean>(false);

  // Bibliothèque des exercices personnalisés persistants
  const customExercises = useMemo(() => getSavedCustomExercises(), []);

  // Synthèse musculaire de la semaine sélectionnée
  const weeklyMuscularSummary = useMemo(() => {
    return computeWeeklyMuscularSummary(events, activeWeek.startDate, activeWeek.endDate, customExercises);
  }, [events, activeWeek.startDate, activeWeek.endDate, customExercises]);

  // Alertes physiologiques et biomécaniques (H:Q, Pull:Push, MRV)
  const muscularAlerts = useMemo(() => {
    return computeMuscularAlerts(weeklyMuscularSummary);
  }, [weeklyMuscularSummary]);

  // Qualités triées et filtrées pour la semaine active
  const filteredAndSortedQualities = useMemo(() => {
    let list = activeWeek.qualitiesBreakdown;
    if (selectedQualityFilter !== 'all') {
      list = list.filter(q => q.qualityId === selectedQualityFilter);
    }
    return sortQualitiesBreakdown(list, sortBy, sortDescending);
  }, [activeWeek, selectedQualityFilter, sortBy, sortDescending]);

  // Données pour le graphique Recharts
  const chartData = useMemo(() => {
    return allWeeks.map(w => {
      // Si un filtre sur une qualité est actif, on affiche la charge de cette qualité uniquement
      let displayedLoad = w.totalLoad;
      let displayedDurationHours = Math.round((w.totalDurationMinutes / 60) * 10) / 10;
      
      if (selectedQualityFilter !== 'all') {
        const qStats = w.qualitiesBreakdown.find(qb => qb.qualityId === selectedQualityFilter);
        displayedLoad = qStats?.totalLoad || 0;
        displayedDurationHours = Math.round(((qStats?.durationMinutes || 0) / 60) * 10) / 10;
      }

      return {
        weekId: w.weekId,
        label: w.shortLabel,
        fullLabel: w.label,
        relative: w.relativeLabel,
        isCurrent: w.isCurrentWeek,
        totalLoad: displayedLoad,
        durationHours: displayedDurationHours,
        sessions: w.sessionCount,
        bikeLoad: w.sports.bike.load,
        runLoad: w.sports.run.load,
        otherLoad: w.sports.other.load,
        acwr: w.acwr || 1.0,
        monotony: w.monotony
      };
    });
  }, [allWeeks, selectedQualityFilter]);

  // Copier le résumé hebdomadaire
  const handleCopySummary = () => {
    const lines = [
      `📊 BILAN PHYSIOLOGIQUE - ${activeWeek.label.toUpperCase()}`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `⚡ Charge Totale : ${activeWeek.totalLoad} UA (${activeWeek.comparison.percentLoadChange !== null ? `${activeWeek.comparison.percentLoadChange >= 0 ? '+' : ''}${activeWeek.comparison.percentLoadChange}% vs S-1` : '1ère semaine'})`,
      `⏱️ Temps d'entraînement : ${activeWeek.totalDurationFormatted} (${activeWeek.totalDurationMinutes} min)`,
      `📅 Séances effectuées : ${activeWeek.sessionCount}`,
      `🎯 Ratio Charge Aiguë/Chronique (indicatif) : ${activeWeek.acwr !== null ? activeWeek.acwr : '—'}`,
      `📈 Monotonie Foster : ${activeWeek.monotony} (Strain: ${activeWeek.strain})`,
      ``,
      `🏆 VENTILATION PAR QUALITÉ PHYSIQUE :`,
      ...activeWeek.qualitiesBreakdown
        .filter(q => q.totalLoad > 0)
        .sort((a, b) => b.totalLoad - a.totalLoad)
        .map(q => ` • ${q.qualityName} : ${q.totalLoad} UA (${formatMinutes(q.durationMinutes)}, ${q.sessionCount} séance${q.sessionCount > 1 ? 's' : ''}, ${q.percentOfTotalLoad}% de la charge)`),
      ``,
      `🚴 Vélo: ${activeWeek.sports.bike.load} UA (${formatMinutes(activeWeek.sports.bike.durationMinutes)}) | 🏃 CàP: ${activeWeek.sports.run.load} UA (${formatMinutes(activeWeek.sports.run.durationMinutes)})`
    ];

    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2500);

    if (showToast) {
      showToast({
        type: 'success',
        title: 'Bilan copié',
        message: 'Le résumé de la semaine a été copié dans votre presse-papiers.'
      });
    }
  };

  // Comparaison côte à côte (Semaine A = activeWeek, Semaine B = comparisonTargetWeek)
  const diffMetrics = useMemo(() => {
    if (!comparisonTargetWeek) return null;
    const deltaLoad = activeWeek.totalLoad - comparisonTargetWeek.totalLoad;
    const percentLoad = comparisonTargetWeek.totalLoad > 0
      ? Math.round((deltaLoad / comparisonTargetWeek.totalLoad) * 100)
      : null;

    const deltaDuration = activeWeek.totalDurationMinutes - comparisonTargetWeek.totalDurationMinutes;
    const percentDuration = comparisonTargetWeek.totalDurationMinutes > 0
      ? Math.round((deltaDuration / comparisonTargetWeek.totalDurationMinutes) * 100)
      : null;

    const deltaSessions = activeWeek.sessionCount - comparisonTargetWeek.sessionCount;

    return {
      deltaLoad,
      percentLoad,
      deltaDuration,
      percentDuration,
      deltaSessions
    };
  }, [activeWeek, comparisonTargetWeek]);

  return (
    <section 
      aria-label="Synthèse et analyse hebdomadaire de la charge" 
      className="flex flex-col gap-6 animate-fadeIn pb-12"
    >
      {/* BANDEAU SUPÉRIEUR : TITRE, RÉSUMÉ RAPIDE ET ACTIONS */}
      <header className="bg-gradient-to-r from-blue-950/40 via-slate-900/60 to-indigo-950/30 border border-white/10 rounded-2xl p-5 shadow-xl backdrop-blur-md">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20 text-white shrink-0">
              <Scale size={24} aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white">
                  Synthèse Hebdomadaire & Comparateur
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  {activeWeek.relativeLabel}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5 hidden sm:block">
                Volumes totaux de charge, heures d'entraînement, comparaison à S-1 et ventilation par qualité physique.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto" role="toolbar" aria-label="Actions de synthèse">
            {/* Bouton bascule mode Comparateur */}
            <button
              type="button"
              onClick={() => setIsCompareMode(prev => !prev)}
              aria-pressed={isCompareMode}
              className={`flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2 min-h-[44px] rounded-xl text-xs sm:text-sm font-semibold border transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 ${
                isCompareMode
                  ? 'bg-indigo-600 text-white border-indigo-400 shadow-md shadow-indigo-600/30'
                  : 'bg-white/5 hover:bg-white/10 text-slate-200 hover:text-white border-white/10'
              }`}
              title="Comparer côte à côte deux semaines au choix"
            >
              <ArrowUpDown size={15} aria-hidden="true" />
              <span>{isCompareMode ? 'Fermer le comparateur' : 'Comparer deux semaines'}</span>
            </button>

            {/* Bouton Copier Résumé */}
            <button
              type="button"
              onClick={handleCopySummary}
              className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2 min-h-[44px] rounded-xl text-xs sm:text-sm font-semibold bg-white/5 hover:bg-white/10 text-slate-200 hover:text-white border border-white/10 transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
              title="Copier le bilan de la semaine pour votre coach ou carnet"
            >
              {copiedSummary ? <Check size={15} className="text-emerald-400" aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
              <span>{copiedSummary ? 'Bilan copié !' : 'Copier le résumé'}</span>
            </button>
          </div>
        </div>

        {/* 4 CARTES KPI CLÉS DE LA SEMAINE ACTIVE */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
          {/* KPI 1 : Charge Totale */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 relative overflow-hidden group hover:border-blue-500/40 transition-all">
            <div className="flex items-center justify-between text-slate-300 text-xs mb-1">
              <span className="flex items-center gap-1.5 font-semibold">
                <Zap size={14} className="text-amber-400" aria-hidden="true" /> Charge Totale
              </span>
              {activeWeek.comparison.percentLoadChange !== null && (
                <span className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded border ${
                  activeWeek.comparison.percentLoadChange > 15 
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                    : activeWeek.comparison.percentLoadChange > 5
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    : activeWeek.comparison.percentLoadChange < -15
                    ? 'bg-sky-500/20 text-sky-300 border-sky-500/30'
                    : 'bg-slate-500/20 text-slate-300 border-slate-500/30'
                }`}>
                  {activeWeek.comparison.percentLoadChange >= 0 ? `+${activeWeek.comparison.percentLoadChange}%` : `${activeWeek.comparison.percentLoadChange}%`} vs S-1
                </span>
              )}
            </div>
            <div className="text-xl sm:text-2xl font-mono font-extrabold text-white tracking-tight">
              {activeWeek.totalLoad} <span className="text-xs font-normal text-slate-300">UA</span>
            </div>
            <div className="text-xs text-slate-300 mt-1 flex items-center justify-between">
              <span>Moyenne/jour : {activeWeek.meanDailyLoad} UA</span>
              <span className="text-xs text-slate-400 font-medium">{activeWeek.comparison.statusBadge}</span>
            </div>
          </div>

          {/* KPI 2 : Temps d'Entraînement */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 relative overflow-hidden group hover:border-blue-500/40 transition-all">
            <div className="flex items-center justify-between text-slate-300 text-xs mb-1">
              <span className="flex items-center gap-1.5 font-semibold">
                <Clock size={14} className="text-sky-400" aria-hidden="true" /> Temps Total
              </span>
              {activeWeek.comparison.percentDurationChange !== null && (
                <span className="text-xs font-mono font-semibold text-slate-300">
                  {activeWeek.comparison.percentDurationChange >= 0 ? `+${activeWeek.comparison.percentDurationChange}%` : `${activeWeek.comparison.percentDurationChange}%`}
                </span>
              )}
            </div>
            <div className="text-xl sm:text-2xl font-mono font-extrabold text-white tracking-tight">
              {activeWeek.totalDurationFormatted}
            </div>
            <div className="text-xs text-slate-300 mt-1">
              {activeWeek.totalDurationMinutes} minutes enregistrées
            </div>
          </div>

          {/* KPI 3 : Nombre de Séances */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 relative overflow-hidden group hover:border-blue-500/40 transition-all">
            <div className="flex items-center justify-between text-slate-300 text-xs mb-1">
              <span className="flex items-center gap-1.5 font-semibold">
                <Calendar size={14} className="text-emerald-400" aria-hidden="true" /> Séances
              </span>
              <span className="text-xs font-mono text-slate-300 font-semibold">
                {activeWeek.comparison.deltaSessions >= 0 ? `+${activeWeek.comparison.deltaSessions}` : activeWeek.comparison.deltaSessions} vs S-1
              </span>
            </div>
            <div className="text-xl sm:text-2xl font-mono font-extrabold text-white tracking-tight">
              {activeWeek.sessionCount} <span className="text-xs font-normal text-slate-300">séances</span>
            </div>
            <div className="text-xs text-slate-300 mt-1 flex items-center gap-2">
              <span className="flex items-center gap-1"><Bike size={13} className="text-blue-400" aria-hidden="true" /> {activeWeek.sports.bike.sessionCount}</span>
              <span className="flex items-center gap-1"><Footprints size={13} className="text-amber-400" aria-hidden="true" /> {activeWeek.sports.run.sessionCount}</span>
              <span className="flex items-center gap-1"><Dumbbell size={13} className="text-emerald-400" aria-hidden="true" /> {activeWeek.sports.other.sessionCount}</span>
            </div>
          </div>

          {/* KPI 4 : ACWR & Monotonie (Charge Aiguë/Chronique & Foster) */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 relative overflow-hidden group hover:border-blue-500/40 transition-all">
            <div className="flex items-center justify-between text-slate-300 text-xs mb-1">
              <span className="flex items-center gap-1.5 font-semibold">
                <Sparkles size={14} className="text-purple-400" aria-hidden="true" /> Aigu/Chronique & Foster
              </span>
              <span className="text-xs font-mono text-slate-300">Ratio Aigu:Chronique</span>
            </div>
            <div className="flex items-baseline gap-2">
              <div className="text-xl sm:text-2xl font-mono font-extrabold text-white tracking-tight">
                {activeWeek.acwr !== null ? activeWeek.acwr : '—'}
              </div>
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded border ${
                activeWeek.acwr === null ? 'bg-slate-500/20 text-slate-300 border-slate-500/30'
                : activeWeek.acwr >= 0.8 && activeWeek.acwr <= 1.3
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                : activeWeek.acwr > 1.5
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
              }`}>
                {activeWeek.acwr === null ? 'En cours (J1-J3)'
                : activeWeek.acwr >= 0.8 && activeWeek.acwr <= 1.3 ? 'Sweet Spot'
                : activeWeek.acwr > 1.5 ? 'Risque Surcharge' : 'Vigilance'}
              </span>
            </div>
            <div className="text-xs text-slate-300 mt-1 flex items-center justify-between">
              <span>Monotonie : {activeWeek.monotony}</span>
              <span>Strain : {activeWeek.strain}</span>
            </div>
          </div>
        </div>
      </header>

      {/* SÉLECTEUR HORIZONTAL DES SEMAINES (TIMELINE DES CARTES SEMAINE) */}
      <section aria-labelledby="timeline-weeks-heading" className="flex flex-col gap-2">
        <div className="flex items-center justify-between px-1">
          <h3 id="timeline-weeks-heading" className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5 m-0">
            <Calendar size={14} className="text-sky-400" aria-hidden="true" />
            <span>Sélectionner une Semaine pour Inspection</span>
          </h3>
          <span className="text-xs text-slate-300">
            {allWeeks.length} semaines calculées (du {allWeeks[0]?.startDate} au {allWeeks[allWeeks.length - 1]?.endDate})
          </span>
        </div>

        <div 
          role="tablist"
          aria-label="Sélection de la semaine d'analyse"
          className="flex overflow-x-auto pb-2 snap-x sm:grid sm:grid-cols-4 lg:grid-cols-8 gap-2 custom-scrollbar focus:outline-none"
        >
          {allWeeks.map((week, idx) => {
            const isSelected = week.weekId === activeWeek.weekId;
            const isCurrent = week.isCurrentWeek;

            return (
              <button
                key={week.weekId}
                type="button"
                role="tab"
                aria-selected={isSelected}
                aria-current={isCurrent ? 'date' : undefined}
                tabIndex={isSelected ? 0 : -1}
                aria-label={`${week.label}, ${week.totalLoad} UA, ${week.totalDurationFormatted}, ${week.sessionCount} séances${isCurrent ? ' (Semaine en cours)' : ''}`}
                onClick={() => setSelectedWeekId(week.weekId)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowRight') {
                    e.preventDefault();
                    const nextWeek = allWeeks[Math.min(allWeeks.length - 1, idx + 1)];
                    if (nextWeek) setSelectedWeekId(nextWeek.weekId);
                  } else if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    const prevWeek = allWeeks[Math.max(0, idx - 1)];
                    if (prevWeek) setSelectedWeekId(prevWeek.weekId);
                  }
                }}
                className={`flex flex-col p-3 min-h-[96px] rounded-xl border text-left touch-press active:scale-95 transition-all cursor-pointer relative shrink-0 w-36 sm:w-auto snap-start focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 ${
                  isSelected
                    ? 'bg-blue-600/30 border-blue-400 shadow-md shadow-blue-500/20 text-white'
                    : isCurrent
                    ? 'bg-white/10 border-white/20 hover:bg-white/15 text-slate-200'
                    : 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-300'
                }`}
              >
                {isCurrent && (
                  <span className="absolute -top-1.5 -right-1 px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-tight bg-blue-500 text-white shadow-sm border border-blue-400">
                    Auj.
                  </span>
                )}
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="text-xs font-mono font-bold tracking-tight text-white">
                    {week.shortLabel}
                  </span>
                  <span className="text-xs text-slate-300 font-mono">
                    {week.relativeLabel}
                  </span>
                </div>

                <div className="text-sm font-mono font-extrabold text-white">
                  {week.totalLoad} <span className="text-xs font-normal text-slate-300">UA</span>
                </div>

                <div className="text-xs font-mono text-slate-200 mt-0.5">
                  ⏱️ {week.totalDurationFormatted}
                </div>

                {/* Badge Delta vs S-1 */}
                <div className="mt-2 pt-1.5 border-t border-white/10 flex items-center justify-between text-xs">
                  <span className="text-slate-300">{week.sessionCount} séanc.</span>
                  {week.comparison.percentLoadChange !== null ? (
                    <span className={`font-mono font-bold ${
                      week.comparison.percentLoadChange > 15 ? 'text-amber-300'
                      : week.comparison.percentLoadChange > 0 ? 'text-emerald-300'
                      : week.comparison.percentLoadChange < -15 ? 'text-sky-300'
                      : 'text-slate-300'
                    }`}>
                      {week.comparison.percentLoadChange >= 0 ? `+${week.comparison.percentLoadChange}%` : `${week.comparison.percentLoadChange}%`}
                    </span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* COMPARATEUR DIRECT CÔTE-À-CÔTE (SI ACTIVÉ) */}
      {isCompareMode && (
        <section aria-labelledby="comparator-heading" className="bg-[#121216] border-2 border-indigo-500/40 rounded-2xl p-5 shadow-2xl animate-fadeIn">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-white/10 pb-4 mb-4">
            <div className="flex items-center gap-2">
              <Scale size={20} className="text-indigo-400" aria-hidden="true" />
              <h3 id="comparator-heading" className="text-base font-bold text-white m-0">
                Comparateur Direct : Semaine A vs Semaine B
              </h3>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-300 font-medium">Comparer</span>
              <span className="font-mono font-bold text-blue-300 px-2.5 py-1 bg-blue-500/20 rounded-lg border border-blue-500/30">
                {activeWeek.shortLabel} ({activeWeek.label})
              </span>
              <label htmlFor="compare-week-select" className="text-slate-300 font-medium">avec :</label>
              <select
                id="compare-week-select"
                aria-label="Sélectionner la semaine à comparer avec la semaine active"
                value={compareWeekId}
                onChange={(e) => setCompareWeekId(e.target.value)}
                className="min-h-[44px] bg-slate-800 border border-white/20 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 cursor-pointer"
              >
                {allWeeks.map(w => (
                  <option key={w.weekId} value={w.weekId} className="bg-slate-900 text-white">
                    {w.shortLabel} — {w.label} ({w.totalLoad} UA)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {comparisonTargetWeek && diffMetrics && (
            <div className="space-y-4">
              {/* Carte des deltas globaux */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-white/5 border border-white/10 rounded-xl p-3.5">
                  <div className="text-xs text-slate-300 mb-1 font-medium">Différence de Charge Totale</div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-mono font-extrabold text-white">
                      {diffMetrics.deltaLoad >= 0 ? `+${diffMetrics.deltaLoad}` : diffMetrics.deltaLoad} UA
                    </span>
                    {diffMetrics.percentLoad !== null && (
                      <span className={`text-xs font-mono font-bold ${
                        diffMetrics.percentLoad > 0 ? 'text-amber-400' : 'text-sky-400'
                      }`}>
                        ({diffMetrics.percentLoad >= 0 ? `+${diffMetrics.percentLoad}%` : `${diffMetrics.percentLoad}%`})
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-300 mt-1 flex justify-between font-mono">
                    <span>{activeWeek.shortLabel}: {activeWeek.totalLoad} UA</span>
                    <span>vs {comparisonTargetWeek.shortLabel}: {comparisonTargetWeek.totalLoad} UA</span>
                  </div>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-xl p-3.5">
                  <div className="text-xs text-slate-300 mb-1 font-medium">Différence de Volume Horaire</div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-mono font-extrabold text-white">
                      {diffMetrics.deltaDuration >= 0 ? `+${formatMinutes(diffMetrics.deltaDuration)}` : `-${formatMinutes(Math.abs(diffMetrics.deltaDuration))}`}
                    </span>
                    {diffMetrics.percentDuration !== null && (
                      <span className="text-xs font-mono font-bold text-slate-300">
                        ({diffMetrics.percentDuration >= 0 ? `+${diffMetrics.percentDuration}%` : `${diffMetrics.percentDuration}%`})
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-300 mt-1 flex justify-between font-mono">
                    <span>{activeWeek.shortLabel}: {activeWeek.totalDurationFormatted}</span>
                    <span>vs {comparisonTargetWeek.shortLabel}: {comparisonTargetWeek.totalDurationFormatted}</span>
                  </div>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-xl p-3.5">
                  <div className="text-xs text-slate-300 mb-1 font-medium">Différence de Séances</div>
                  <div className="text-2xl font-mono font-extrabold text-white">
                    {diffMetrics.deltaSessions >= 0 ? `+${diffMetrics.deltaSessions}` : diffMetrics.deltaSessions} séance{Math.abs(diffMetrics.deltaSessions) > 1 ? 's' : ''}
                  </div>
                  <div className="text-xs text-slate-300 mt-1 flex justify-between font-mono">
                    <span>{activeWeek.shortLabel}: {activeWeek.sessionCount} séanc.</span>
                    <span>vs {comparisonTargetWeek.shortLabel}: {comparisonTargetWeek.sessionCount} séanc.</span>
                  </div>
                </div>
              </div>

              {/* Tableau comparatif par qualité */}
              <div className="bg-black/40 rounded-xl border border-white/10 overflow-hidden">
                <div className="p-3 bg-white/5 border-b border-white/10 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300">
                    Ventilation Comparative par Qualité Physique
                  </span>
                  <span className="text-xs text-slate-300 font-mono">
                    {activeWeek.shortLabel} vs {comparisonTargetWeek.shortLabel}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-white/[0.02] border-b border-white/5 text-xs uppercase text-slate-300 font-mono">
                        <th className="p-2.5">Qualité Physique</th>
                        <th className="p-2.5 text-right">{activeWeek.shortLabel} (Charge / Temps)</th>
                        <th className="p-2.5 text-right">{comparisonTargetWeek.shortLabel} (Charge / Temps)</th>
                        <th className="p-2.5 text-right">Écart (Δ)</th>
                        <th className="p-2.5 text-center">Tendance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 font-mono">
                      {qualities.map(q => {
                        const aStat = activeWeek.qualitiesBreakdown.find(qb => qb.qualityId === q.id);
                        const bStat = comparisonTargetWeek.qualitiesBreakdown.find(qb => qb.qualityId === q.id);
                        const aLoad = aStat?.totalLoad || 0;
                        const bLoad = bStat?.totalLoad || 0;
                        const delta = aLoad - bLoad;
                        const pct = bLoad > 0 ? Math.round((delta / bLoad) * 100) : null;

                        if (aLoad === 0 && bLoad === 0) return null;

                        return (
                          <tr key={q.id} className="hover:bg-white/[0.02] transition-colors">
                            <td className="p-2.5 font-sans font-semibold text-white">
                              {q.name}
                            </td>
                            <td className="p-2.5 text-right">
                              <span className="font-bold text-blue-300">{aLoad} UA</span>
                              <span className="text-slate-300 text-xs ml-2 font-normal font-sans">({formatMinutes(aStat?.durationMinutes || 0)})</span>
                            </td>
                            <td className="p-2.5 text-right">
                              <span className="font-bold text-slate-300">{bLoad} UA</span>
                              <span className="text-slate-300 text-xs ml-2 font-normal font-sans">({formatMinutes(bStat?.durationMinutes || 0)})</span>
                            </td>
                            <td className="p-2.5 text-right font-bold">
                              <span className={delta > 0 ? 'text-amber-400' : delta < 0 ? 'text-sky-400' : 'text-slate-300'}>
                                {delta >= 0 ? `+${delta}` : delta} UA
                                {pct !== null && <span className="text-xs font-normal ml-1">({pct >= 0 ? `+${pct}%` : `${pct}%`})</span>}
                              </span>
                            </td>
                            <td className="p-2.5 text-center">
                              {delta > 10 ? (
                                <span className="inline-flex items-center text-amber-400 text-xs font-semibold">
                                  <ArrowUpRight size={14} aria-hidden="true" /> Augmentation
                                </span>
                              ) : delta < -10 ? (
                                <span className="inline-flex items-center text-sky-400 text-xs font-semibold">
                                  <ArrowDownRight size={14} aria-hidden="true" /> Décharge
                                </span>
                              ) : (
                                <span className="text-slate-400 text-xs font-semibold">≈ Équivalent</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* GRAPHIQUE INTERACTIF DE PROGRESSION HEBDOMADAIRE (RECHARTS) */}
      <section 
        aria-labelledby="chart-progression-heading"
        className="bg-slate-900/60 border border-white/10 rounded-2xl p-5 shadow-xl backdrop-blur-md"
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 id="chart-progression-heading" className="text-base font-bold text-white flex items-center gap-2">
              <TrendingUp size={16} className="text-blue-400" />
              <span>Progression Chronologique Hebdomadaire</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Évolution de la charge d'entraînement (UA) et des heures passées semaine par semaine.
            </p>
          </div>

          {/* Filtre rapide de qualité directement sur le graphique */}
          <div className="flex items-center gap-2">
            <label htmlFor="quick-quality-filter" className="text-xs text-slate-300 font-medium flex items-center gap-1.5 cursor-pointer">
              <Filter size={14} className="text-slate-400" aria-hidden="true" /> Qualité :
            </label>
            <select
              id="quick-quality-filter"
              aria-label="Filtrer le graphique par qualité physique spécifique"
              value={selectedQualityFilter}
              onChange={(e) => setSelectedQualityFilter(e.target.value)}
              className="min-h-[44px] bg-slate-800 border border-white/20 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 cursor-pointer"
            >
              <option value="all" className="bg-slate-900 text-white">Toutes les qualités cumulées</option>
              {qualities.map(q => (
                <option key={q.id} value={q.id} className="bg-slate-900 text-white">
                  {q.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tableau alternatif pour technologies d'assistance (WCAG 2.2 AA) */}
        <div className="sr-only">
          <table aria-label="Données du graphique de progression chronologique hebdomadaire">
            <thead>
              <tr>
                <th>Semaine</th>
                <th>Charge Totale</th>
                <th>Temps d'entraînement</th>
                <th>Séances</th>
                <th>ACWR</th>
              </tr>
            </thead>
            <tbody>
              {chartData.map(d => (
                <tr key={d.weekId}>
                  <td>{d.fullLabel}</td>
                  <td>{d.totalLoad} UA</td>
                  <td>{d.durationHours} h</td>
                  <td>{d.sessions} séances</td>
                  <td>{d.acwr}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="h-64 sm:h-72 w-full" aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff15" vertical={false} />
              <XAxis dataKey="label" stroke="#94a3b8" tick={{ fill: '#cbd5e1', fontSize: 11 }} />
              <YAxis yAxisId="left" stroke="#94a3b8" tick={{ fill: '#cbd5e1', fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" stroke="#38bdf8" tick={{ fill: '#38bdf8', fontSize: 11 }} unit="h" />
              <Tooltip content={WeeklyChartTooltip} />
              <Legend 
                wrapperStyle={{ fontSize: 11, paddingTop: 10 }}
                formatter={(val) => val === 'totalLoad' ? 'Charge Totale (UA)' : 'Temps (Heures)'} 
              />
              <Bar 
                yAxisId="left" 
                dataKey="totalLoad" 
                name="totalLoad" 
                radius={[4, 4, 0, 0]}
              >
                {chartData.map((entry) => (
                  <Cell 
                    key={`cell-${entry.weekId}`} 
                    fill={entry.weekId === activeWeek.weekId ? '#3b82f6' : entry.isCurrent ? '#60a5fa' : '#334155'} 
                  />
                ))}
              </Bar>
              <Line 
                yAxisId="right" 
                type="monotone" 
                dataKey="durationHours" 
                name="durationHours" 
                stroke="#38bdf8" 
                strokeWidth={2.5} 
                dot={{ r: 4, fill: '#38bdf8' }} 
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* SECTION DU BAS : VENTILATION DÉTAILLÉE PAR QUALITÉ PHYSIQUE OU PAR GROUPE MUSCULAIRE (OPTION A) */}
      <section 
        aria-label="Ventilation analytique de la charge"
        className="bg-slate-900/60 border border-white/10 rounded-2xl p-5 shadow-xl backdrop-blur-md"
      >
        
        {/* ONGLET DE BASCULE QUALITÉS GLOBALES vs GROUPES MUSCULAIRES */}
        <div 
          role="tablist" 
          aria-label="Mode de ventilation de la charge" 
          className="flex items-center gap-2 mb-4 border-b border-white/10 pb-3 flex-wrap"
        >
          <button
            type="button"
            role="tab"
            id="tab-qualities"
            aria-controls="panel-qualities"
            aria-selected={breakdownTab === 'qualities'}
            onClick={() => setBreakdownTab('qualities')}
            className={`flex items-center gap-2 px-3.5 py-2 min-h-[44px] rounded-xl text-xs font-bold transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
              breakdownTab === 'qualities'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 ring-1 ring-blue-400'
                : 'text-slate-300 hover:text-white hover:bg-white/5 border border-white/5'
            }`}
          >
            <Layers size={16} aria-hidden="true" />
            <span>Filières & Qualités Physiques</span>
            <span className="px-2 py-0.5 rounded font-mono text-xs bg-white/20 text-white font-bold">
              {qualities.length}
            </span>
          </button>

          <button
            type="button"
            role="tab"
            id="tab-muscles"
            aria-controls="panel-muscles"
            aria-selected={breakdownTab === 'muscles'}
            onClick={() => setBreakdownTab('muscles')}
            className={`flex items-center gap-2 px-3.5 py-2 min-h-[44px] rounded-xl text-xs font-bold transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
              breakdownTab === 'muscles'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 ring-1 ring-blue-400'
                : 'text-slate-300 hover:text-white hover:bg-white/5 border border-white/5'
            }`}
          >
            <Dumbbell size={16} aria-hidden="true" />
            <span>Charge par Groupe Musculaire</span>
            {weeklyMuscularSummary.totalSets > 0 ? (
              <span className="px-2 py-0.5 rounded-full font-mono text-xs bg-emerald-500/25 text-emerald-200 border border-emerald-500/40 font-bold">
                {weeklyMuscularSummary.totalSets} séries
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded font-mono text-xs bg-white/10 text-slate-300">
                Séries effectives
              </span>
            )}
          </button>
        </div>

        {breakdownTab === 'qualities' ? (
          <div id="panel-qualities" role="tabpanel" aria-labelledby="tab-qualities">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <Layers size={18} className="text-blue-400" aria-hidden="true" />
                  <h3 className="text-base font-bold text-white m-0">
                    Ventilation par Qualité Physique : {activeWeek.label}
                  </h3>
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  Classement et détails pour chaque filière d'entraînement sur la semaine sélectionnée.
                </p>
              </div>

              {/* BARRE D'OUTILS DE TRI ET DE FILTRE (DEMANDE UTILISATEUR) */}
              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto" role="toolbar" aria-label="Outils de filtrage et de tri des qualités">
                {/* Filtre qualité */}
                <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-xl px-2.5 py-1 text-xs text-slate-300 min-h-[44px]">
                  <Filter size={14} className="text-slate-400" aria-hidden="true" />
                  <select
                    id="quality-table-filter"
                    aria-label="Filtrer les qualités physiques affichées"
                    value={selectedQualityFilter}
                    onChange={(e) => setSelectedQualityFilter(e.target.value)}
                    className="bg-transparent text-white font-medium focus:outline-none cursor-pointer py-1.5"
                  >
                    <option value="all" className="bg-slate-900 text-white">Toutes les qualités ({qualities.length})</option>
                    {qualities.map(q => (
                      <option key={q.id} value={q.id} className="bg-slate-900 text-white">
                        {q.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Tri par critère */}
                <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-xl px-2.5 py-1 text-xs text-slate-300 min-h-[44px]">
                  <ArrowUpDown size={14} className="text-slate-400" aria-hidden="true" />
                  <span className="text-slate-300 font-medium">Trier par :</span>
                  <select
                    id="quality-table-sort"
                    aria-label="Critère de tri du tableau des qualités"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as QualitySortField)}
                    className="bg-transparent text-white font-medium focus:outline-none cursor-pointer py-1.5"
                  >
                    <option value="load" className="bg-slate-900 text-white">⚡ Charge décroissante</option>
                    <option value="duration" className="bg-slate-900 text-white">⏱️ Temps d'entraînement</option>
                    <option value="sessions" className="bg-slate-900 text-white">🔢 Nombre de séances</option>
                    <option value="name" className="bg-slate-900 text-white">🔤 Nom alphabétique</option>
                    <option value="default" className="bg-slate-900 text-white">📋 Ordre de la grille</option>
                  </select>
                </div>

                {/* Inverser ordre ascendant / descendant */}
                <button
                  type="button"
                  onClick={() => setSortDescending(prev => !prev)}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 hover:text-white transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                  title={sortDescending ? "Tri décroissant (du plus grand au plus petit)" : "Tri croissant (du plus petit au plus grand)"}
                  aria-label={sortDescending ? "Passer en ordre croissant" : "Passer en ordre décroissant"}
                >
                  {sortDescending ? <TrendingDown size={16} aria-hidden="true" /> : <TrendingUp size={16} aria-hidden="true" />}
                </button>
              </div>
            </div>

            {/* TABLEAU DES QUALITÉS AVEC JAUGE DE CHARGE HEBDOMADAIRE */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <caption className="sr-only">
                  Ventilation détaillée des charges et durées d'entraînement par qualité physique pour la semaine {activeWeek.label}
                </caption>
                <thead>
                  <tr className="bg-white/5 border-y border-white/10 text-xs uppercase text-slate-300 font-mono tracking-wider">
                    <th scope="col" className="p-3">Qualité Physique</th>
                    <th scope="col" className="p-3 text-right">Charge Hebdo</th>
                    <th scope="col" className="p-3 w-48 hidden sm:table-cell">% de la Charge Semaine</th>
                    <th scope="col" className="p-3 text-right">Temps Passé</th>
                    <th scope="col" className="p-3 text-center">Séances</th>
                    <th scope="col" className="p-3 text-right">Évolution vs S-1</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredAndSortedQualities.map((item) => {
                    const isZero = item.totalLoad === 0;

                    return (
                      <tr 
                        key={item.qualityId}
                        className={`hover:bg-white/[0.03] transition-colors ${
                          isZero ? 'opacity-40 hover:opacity-100' : ''
                        }`}
                      >
                        {/* Nom de la qualité */}
                        <td className="p-3">
                          <div className="flex flex-col">
                            <span className="font-bold text-white text-xs sm:text-sm">
                              {item.qualityName}
                            </span>
                            {item.secondaryLoad > 0 && (
                              <span className="text-xs text-slate-400 font-mono hidden sm:inline">
                                Direct: {item.directLoad} UA • Impact indirect: {item.secondaryLoad} UA
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Charge totale */}
                        <td className="p-3 text-right font-mono font-bold text-xs sm:text-sm">
                          <span className={item.totalLoad > 0 ? 'text-amber-300' : 'text-slate-400'}>
                            {item.totalLoad} <span className="text-xs font-normal text-slate-400">UA</span>
                          </span>
                        </td>

                        {/* Barre de répartition */}
                        <td className="p-3 hidden sm:table-cell">
                          <div className="flex items-center gap-2">
                            <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                              <div 
                                className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full rounded-full transition-all"
                                style={{ width: `${Math.min(100, item.percentOfTotalLoad)}%` }}
                              />
                            </div>
                            <span className="font-mono text-xs text-slate-300 w-12 text-right font-semibold">
                              {item.percentOfTotalLoad}%
                            </span>
                          </div>
                        </td>

                        {/* Temps */}
                        <td className="p-3 text-right font-mono text-slate-200 font-medium">
                          {formatMinutes(item.durationMinutes)}
                        </td>

                        {/* Séances */}
                        <td className="p-3 text-center font-mono">
                          <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${
                            item.sessionCount > 0 
                              ? 'bg-blue-500/20 text-blue-200 border border-blue-500/30' 
                              : 'text-slate-500'
                          }`}>
                            {item.sessionCount}
                          </span>
                        </td>

                        {/* Évolution vs S-1 */}
                        <td className="p-3 text-right font-mono font-bold">
                          {item.percentChangeVsPrevWeek !== null ? (
                            <span className={`inline-flex items-center gap-1 ${
                              item.percentChangeVsPrevWeek > 0 ? 'text-emerald-400'
                              : item.percentChangeVsPrevWeek < 0 ? 'text-sky-400'
                              : 'text-slate-300'
                            }`}>
                              {item.percentChangeVsPrevWeek > 0 ? <ArrowUpRight size={14} aria-hidden="true" /> : item.percentChangeVsPrevWeek < 0 ? <ArrowDownRight size={14} aria-hidden="true" /> : null}
                              {item.percentChangeVsPrevWeek >= 0 ? `+${item.percentChangeVsPrevWeek}%` : `${item.percentChangeVsPrevWeek}%`}
                              <span className="text-xs text-slate-400 font-normal hidden sm:inline">
                                ({item.deltaLoadVsPrevWeek >= 0 ? `+${item.deltaLoadVsPrevWeek}` : item.deltaLoadVsPrevWeek} UA)
                              </span>
                            </span>
                          ) : item.totalLoad > 0 ? (
                            <span className="text-emerald-400 text-xs font-semibold">+ Nouveau</span>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* VUE PAR GROUPE MUSCULAIRE (OPTION A) */
          <div id="panel-muscles" role="tabpanel" aria-labelledby="tab-muscles" className="space-y-5 animate-fadeIn">
            <div>
              <div className="flex items-center gap-2">
                <Dumbbell size={18} className="text-red-400" aria-hidden="true" />
                <h3 className="text-base font-bold text-white m-0">
                  Volume Hebdomadaire par Groupe Musculaire : {activeWeek.label}
                </h3>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Comptabilisation des séries effectives (Hard Sets) et équilibre fonctionnel selon les standards en sciences du sport.
              </p>
            </div>

            {/* 4 KPI MUSCULAIRES & ÉQUILIBRES */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl bg-white/5 border border-white/10">
                <span className="text-xs uppercase font-bold text-slate-300 block mb-1">
                  Séries Effectives
                </span>
                <div className="text-xl font-mono font-extrabold text-white">
                  {weeklyMuscularSummary.totalSets} <span className="text-xs font-normal text-slate-300">séries</span>
                </div>
                <span className="text-xs text-slate-300 mt-0.5 block">
                  {weeklyMuscularSummary.totalSessionsWithExercises} séance{weeklyMuscularSummary.totalSessionsWithExercises > 1 ? 's' : ''} détaillée{weeklyMuscularSummary.totalSessionsWithExercises > 1 ? 's' : ''}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-white/5 border border-white/10">
                <span className="text-xs uppercase font-bold text-slate-300 block mb-1">
                  Répétitions Totales
                </span>
                <div className="text-xl font-mono font-extrabold text-white">
                  {weeklyMuscularSummary.totalReps} <span className="text-xs font-normal text-slate-300">reps</span>
                </div>
                <span className="text-xs text-slate-300 mt-0.5 block">
                  Volume-stimulus cumulé
                </span>
              </div>

              {/* Ratio H:Q (Ischios / Quadriceps) */}
              <div className="p-3.5 rounded-xl bg-white/5 border border-white/10">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs uppercase font-bold text-slate-300">
                    Ratio Ischios/Quad (H:Q)
                  </span>
                  <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-white/10 text-slate-200 font-semibold">
                    ≥ 0.60
                  </span>
                </div>
                <div className="text-xl font-mono font-extrabold text-white">
                  {weeklyMuscularSummary.hqRatio !== null ? weeklyMuscularSummary.hqRatio : '—'}
                </div>
                <span className={`text-xs font-semibold mt-0.5 block ${
                  weeklyMuscularSummary.hqRatio === null
                    ? 'text-slate-400'
                    : weeklyMuscularSummary.hqRatio >= 0.60
                    ? 'text-emerald-400'
                    : 'text-amber-400'
                }`}>
                  {weeklyMuscularSummary.hqRatio === null
                    ? 'Données insuffisantes'
                    : weeklyMuscularSummary.hqRatio >= 0.60
                    ? '✓ Équilibré (santé genou)'
                    : '⚠️ Dominance Quadriceps'}
                </span>
              </div>

              {/* Ratio Pull / Push */}
              <div className="p-3.5 rounded-xl bg-white/5 border border-white/10">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs uppercase font-bold text-slate-300">
                    Ratio Tirage/Poussée
                  </span>
                  <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-white/10 text-slate-200 font-semibold">
                    ≥ 1.00
                  </span>
                </div>
                <div className="text-xl font-mono font-extrabold text-white">
                  {weeklyMuscularSummary.pushPullRatio !== null ? weeklyMuscularSummary.pushPullRatio : '—'}
                </div>
                <span className={`text-xs font-semibold mt-0.5 block ${
                  weeklyMuscularSummary.pushPullRatio === null
                    ? 'text-slate-400'
                    : weeklyMuscularSummary.pushPullRatio >= 1.0
                    ? 'text-emerald-400'
                    : 'text-amber-400'
                }`}>
                  {weeklyMuscularSummary.pushPullRatio === null
                    ? 'Données insuffisantes'
                    : weeklyMuscularSummary.pushPullRatio >= 1.0
                    ? '✓ Équilibré (santé épaule)'
                    : '⚠️ Dominance Poussée'}
                </span>
              </div>
            </div>

            {/* REPÈRES SCIENTIFIQUES DE VOLUME (ISRAETEL & SCHOENFELD) */}
            <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center justify-between w-full sm:w-auto">
                <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Info size={14} className="text-blue-400" aria-hidden="true" />
                  Repères de séries (Israetel) :
                </span>
                <button
                  type="button"
                  onClick={() => setShowVolumeGuide(prev => !prev)}
                  className="sm:hidden min-h-[44px] text-xs text-blue-300 font-semibold px-3 py-2 rounded-xl bg-blue-500/15 border border-blue-500/30 cursor-pointer active:scale-95 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                >
                  {showVolumeGuide ? 'Masquer repères' : 'Afficher repères (MV/MAV)'}
                </button>
              </div>
              <div className={`${showVolumeGuide ? 'flex' : 'hidden'} sm:flex flex-wrap items-center gap-2 pt-1 sm:pt-0`}>
                <span className="px-2.5 py-1 rounded-md text-xs font-mono border bg-slate-800 text-slate-200 border-slate-700">
                  MV &lt; 6 : Maintien
                </span>
                <span className="px-2.5 py-1 rounded-md text-xs font-mono border bg-blue-500/20 text-blue-200 border-blue-500/30">
                  MEV 6-10 : Stimulus Min
                </span>
                <span className="px-2.5 py-1 rounded-md text-xs font-mono border bg-emerald-500/20 text-emerald-200 border-emerald-500/30 font-bold">
                  MAV 10-20 : Optimal
                </span>
                <span className="px-2.5 py-1 rounded-md text-xs font-mono border bg-amber-500/20 text-amber-200 border-amber-500/30">
                  MRV &gt; 20 : Plafond Max
                </span>
              </div>
            </div>

            {/* ALERTES ET DIAGNOSTICS DE DÉSÉQUILIBRE MUSCULAIRE (FEATURE 4) */}
            <MuscleAlertsBanner alerts={muscularAlerts} />

            {/* DOUBLE VISUALISATION : MANNEQUIN FACE & DOS + RADAR SPIDER CHART (FEATURE 3) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Mannequin anatomique interactif Face & Dos */}
              <MuscleBodyMap 
                muscleLoads={weeklyMuscularSummary.muscles}
                selectedMuscleId={selectedMuscleId}
                onSelectMuscle={(id) => setSelectedMuscleId(prev => prev === id ? null : id)}
              />

              {/* Graphique Radar Musculaire (Spider Chart avec Couloir MAV 10-20s) */}
              <MuscleRadarChart 
                muscles={weeklyMuscularSummary.muscles}
                selectedMuscleId={selectedMuscleId}
                onSelectMuscle={(id) => setSelectedMuscleId(prev => prev === id ? null : id)}
              />
            </div>

            {/* Indicateur de filtre/sélection active */}
            {selectedMuscleId && (
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-blue-500/15 border border-blue-500/30 text-xs animate-fadeIn">
                <div className="flex items-center gap-2 text-white">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: MUSCLE_GROUPS[selectedMuscleId]?.color || '#38bdf8' }} aria-hidden="true" />
                  <span>Groupe musculaire inspecté : <strong className="text-blue-300">{MUSCLE_GROUPS[selectedMuscleId]?.name || selectedMuscleId}</strong> ({weeklyMuscularSummary.muscles[selectedMuscleId]?.effectiveSets || 0} séries effectives)</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedMuscleId(null)}
                  className="min-h-[44px] px-2 py-1 text-xs text-blue-300 hover:text-white underline cursor-pointer rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                >
                  Afficher tous les groupes
                </button>
              </div>
            )}

            {/* GRILLE DÉTAILLÉE PAR GROUPE MUSCULAIRE */}
            {weeklyMuscularSummary.sortedMuscles.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {weeklyMuscularSummary.sortedMuscles.map(m => {
                  const targetMav = 20;
                  const percentOfMav = Math.min(100, Math.round((m.effectiveSets / targetMav) * 100));
                  const isSelected = selectedMuscleId === m.muscleId;

                  return (
                    <button
                      key={m.muscleId}
                      type="button"
                      aria-pressed={isSelected}
                      aria-label={`${m.name}, ${m.categoryLabel}, ${m.effectiveSets} séries effectives sur cible ${targetMav}, statut ${m.statusLabel}`}
                      onClick={() => setSelectedMuscleId(prev => prev === m.muscleId ? null : m.muscleId)}
                      className={`p-3.5 rounded-xl transition-all space-y-2.5 cursor-pointer text-left w-full min-h-[96px] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                        isSelected 
                          ? 'bg-blue-950/40 border-2 border-blue-400 ring-2 ring-blue-500/30 shadow-lg shadow-blue-500/10' 
                          : 'bg-white/[0.04] border border-white/10 hover:border-white/20 hover:bg-white/[0.07]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: m.color }} aria-hidden="true" />
                            <h4 className="text-sm font-bold text-white m-0">{m.name}</h4>
                            <span className="text-xs font-medium text-slate-200 bg-white/10 px-2 py-0.5 rounded">
                              {m.categoryLabel}
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-base font-mono font-extrabold text-white">
                            {m.effectiveSets} <span className="text-xs font-normal text-slate-300">séries</span>
                          </span>
                        </div>
                      </div>

                      {/* Barre de jauge du volume */}
                      <div>
                        <div className="flex items-center justify-between text-xs text-slate-300 mb-1">
                          <span className={`px-2 py-0.5 rounded-md border text-xs font-bold ${m.statusBadgeColor}`}>
                            {m.statusLabel}
                          </span>
                          <span className="font-mono text-slate-300">
                            {m.repsTotal} reps totales
                          </span>
                        </div>

                        <div 
                          role="progressbar"
                          aria-valuenow={m.effectiveSets}
                          aria-valuemin={0}
                          aria-valuemax={targetMav}
                          aria-label={`Progression des séries pour ${m.name}`}
                          className="w-full h-2 rounded-full bg-white/10 overflow-hidden"
                        >
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              backgroundColor: m.color,
                              width: `${percentOfMav}%`
                            }}
                          />
                        </div>
                      </div>

                      {/* Exercices ayant contribué à ce muscle */}
                      {m.exercises.length > 0 && (
                        <div className="pt-1.5 border-t border-white/5 flex flex-wrap gap-1.5 items-center">
                          <span className="text-xs text-slate-400 font-medium mr-1">Exercices :</span>
                          {Array.from(new Set(m.exercises.map(e => `${e.name} (${e.sets}s)`))).map((exStr, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-xs font-mono text-slate-200"
                            >
                              {exStr}
                            </span>
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center rounded-2xl bg-white/[0.02] border border-dashed border-white/10 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mx-auto text-slate-300">
                  <Dumbbell size={24} aria-hidden="true" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white mb-1">
                    Aucun exercice de musculation renseigné sur cette semaine
                  </h4>
                  <p className="text-xs text-slate-300 max-w-md mx-auto m-0 leading-relaxed">
                    Pour activer la ventilation automatique par muscle, ouvrez une séance de musculation 
                    (<em>Push, Pull, Leg, Abdos...</em>) dans la grille et complétez la section 
                    <strong>« Détail Musculation & Exercices »</strong>.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </section>
  );
};
