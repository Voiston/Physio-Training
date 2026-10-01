import React, { useState, useMemo } from 'react';
import { Quality, SessionData } from '../hooks/useData';
import { 
  computeAllWeeksStats, 
  sortQualitiesBreakdown, 
  QualitySortField, 
  WeekStats,
  formatMinutes
} from '../utils/weekHelpers';
import { 
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, Cell
} from 'recharts';
import { 
  Calendar, Clock, Zap, TrendingUp, TrendingDown, ArrowRight, ArrowUpRight, 
  ArrowDownRight, CheckCircle2, AlertTriangle, ShieldAlert, Sparkles, Filter, 
  ArrowUpDown, Scale, Copy, Check, Info, Bike, Footprints, Dumbbell, Layers, ChevronRight, RefreshCw
} from 'lucide-react';

interface WeeklyAnalysisViewProps {
  events: Record<string, Record<string, SessionData>>;
  qualities: Quality[];
  onOpenScoreModal?: (q: Quality, dateStr: string, sessionData?: any) => void;
  showToast?: (toast: { type: 'success' | 'info' | 'warning' | 'error'; title: string; message: string }) => void;
}

export const WeeklyAnalysisView: React.FC<WeeklyAnalysisViewProps> = ({
  events,
  qualities,
  showToast
}) => {
  // Calcul de toutes les statistiques hebdomadaires (-6 semaines passées à +2 semaines futures)
  const allWeeks = useMemo(() => {
    return computeAllWeeksStats(events, qualities, 6, 2);
  }, [events, qualities]);

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
    <div className="flex flex-col gap-6 animate-fadeIn pb-12">
      {/* BANDEAU SUPÉRIEUR : TITRE, RÉSUMÉ RAPIDE ET ACTIONS */}
      <div className="bg-gradient-to-r from-blue-950/40 via-slate-900/60 to-indigo-950/30 border border-white/10 rounded-2xl p-5 shadow-xl backdrop-blur-md">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20 text-white shrink-0">
              <Scale size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white">
                  Synthèse Hebdomadaire & Comparateur
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  {activeWeek.relativeLabel}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Volumes totaux de charge, heures d'entraînement, comparaison à S-1 et ventilation par qualité physique.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-stretch md:self-auto">
            {/* Bouton bascule mode Comparateur */}
            <button
              onClick={() => setIsCompareMode(prev => !prev)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                isCompareMode
                  ? 'bg-indigo-600 text-white border-indigo-400 shadow-md shadow-indigo-600/30'
                  : 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border-white/10'
              }`}
              title="Comparer côte à côte deux semaines au choix"
            >
              <ArrowUpDown size={14} />
              <span>{isCompareMode ? 'Fermer Comparateur' : 'Comparer 2 Semaines'}</span>
            </button>

            {/* Bouton Copier Résumé */}
            <button
              onClick={handleCopySummary}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-all cursor-pointer"
              title="Copier le bilan de la semaine pour votre coach ou carnet"
            >
              {copiedSummary ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              <span>{copiedSummary ? 'Copié !' : 'Copier le Bilan'}</span>
            </button>
          </div>
        </div>

        {/* 4 CARTES KPI CLÉS DE LA SEMAINE ACTIVE */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
          {/* KPI 1 : Charge Totale */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 relative overflow-hidden group hover:border-blue-500/40 transition-all">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span className="flex items-center gap-1 font-medium">
                <Zap size={13} className="text-amber-400" /> Charge Totale
              </span>
              {activeWeek.comparison.percentLoadChange !== null && (
                <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${
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
              {activeWeek.totalLoad} <span className="text-xs font-normal text-slate-400">UA</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
              <span>Moyenne/jour : {activeWeek.meanDailyLoad} UA</span>
              <span className="text-[10px] text-slate-500">{activeWeek.comparison.statusBadge}</span>
            </div>
          </div>

          {/* KPI 2 : Temps d'Entraînement */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 relative overflow-hidden group hover:border-blue-500/40 transition-all">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span className="flex items-center gap-1 font-medium">
                <Clock size={13} className="text-sky-400" /> Temps Total
              </span>
              {activeWeek.comparison.percentDurationChange !== null && (
                <span className="text-[10px] font-mono font-semibold text-slate-300">
                  {activeWeek.comparison.percentDurationChange >= 0 ? `+${activeWeek.comparison.percentDurationChange}%` : `${activeWeek.comparison.percentDurationChange}%`}
                </span>
              )}
            </div>
            <div className="text-xl sm:text-2xl font-mono font-extrabold text-white tracking-tight">
              {activeWeek.totalDurationFormatted}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              {activeWeek.totalDurationMinutes} minutes enregistrées
            </div>
          </div>

          {/* KPI 3 : Nombre de Séances */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 relative overflow-hidden group hover:border-blue-500/40 transition-all">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span className="flex items-center gap-1 font-medium">
                <Calendar size={13} className="text-emerald-400" /> Séances
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                {activeWeek.comparison.deltaSessions >= 0 ? `+${activeWeek.comparison.deltaSessions}` : activeWeek.comparison.deltaSessions} vs S-1
              </span>
            </div>
            <div className="text-xl sm:text-2xl font-mono font-extrabold text-white tracking-tight">
              {activeWeek.sessionCount} <span className="text-xs font-normal text-slate-400">séances</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-2">
              <span className="flex items-center gap-0.5"><Bike size={11} className="text-blue-400" /> {activeWeek.sports.bike.sessionCount}</span>
              <span className="flex items-center gap-0.5"><Footprints size={11} className="text-amber-400" /> {activeWeek.sports.run.sessionCount}</span>
              <span className="flex items-center gap-0.5"><Dumbbell size={11} className="text-emerald-400" /> {activeWeek.sports.other.sessionCount}</span>
            </div>
          </div>

          {/* KPI 4 : ACWR & Monotonie (Charge Aiguë/Chronique & Foster) */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 relative overflow-hidden group hover:border-blue-500/40 transition-all">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span className="flex items-center gap-1 font-medium">
                <Sparkles size={13} className="text-purple-400" /> Aigu/Chronique & Foster
              </span>
              <span className="text-[10px] font-mono text-slate-400">Ratio Aigu:Chronique</span>
            </div>
            <div className="flex items-baseline gap-2">
              <div className="text-xl sm:text-2xl font-mono font-extrabold text-white tracking-tight">
                {activeWeek.acwr !== null ? activeWeek.acwr : '1.00'}
              </div>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                activeWeek.acwr === null ? 'bg-slate-500/20 text-slate-400 border-slate-500/30'
                : activeWeek.acwr >= 0.8 && activeWeek.acwr <= 1.3
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                : activeWeek.acwr > 1.5
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
              }`}>
                {activeWeek.acwr === null ? 'Neutre'
                : activeWeek.acwr >= 0.8 && activeWeek.acwr <= 1.3 ? 'Sweet Spot'
                : activeWeek.acwr > 1.5 ? 'Risque Surcharge' : 'Vigilance'}
              </span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
              <span>Monotonie : {activeWeek.monotony}</span>
              <span>Strain : {activeWeek.strain}</span>
            </div>
          </div>
        </div>
      </div>

      {/* SÉLECTEUR HORIZONTAL DES SEMAINES (TIMELINE DES CARTES SEMAINE) */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
            <Calendar size={14} className="text-sky-400" />
            <span>Sélectionner une Semaine pour Inspection</span>
          </span>
          <span className="text-[11px] text-slate-400">
            {allWeeks.length} semaines calculées (du {allWeeks[0]?.startDate} au {allWeeks[allWeeks.length - 1]?.endDate})
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {allWeeks.map((week) => {
            const isSelected = week.weekId === activeWeek.weekId;
            const isCurrent = week.isCurrentWeek;

            return (
              <button
                key={week.weekId}
                onClick={() => setSelectedWeekId(week.weekId)}
                className={`flex flex-col p-3 rounded-xl border text-left transition-all cursor-pointer relative ${
                  isSelected
                    ? 'bg-blue-600/20 border-blue-500 shadow-md shadow-blue-500/20 text-white'
                    : isCurrent
                    ? 'bg-white/10 border-white/20 hover:bg-white/15 text-slate-200'
                    : 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-300'
                }`}
              >
                {isCurrent && (
                  <span className="absolute -top-1.5 -right-1 px-1.5 py-0.2 rounded-full text-[8.5px] font-black uppercase tracking-tight bg-blue-500 text-white shadow-sm">
                    Auj.
                  </span>
                )}
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="text-xs font-mono font-bold tracking-tight text-white">
                    {week.shortLabel}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {week.relativeLabel}
                  </span>
                </div>

                <div className="text-sm font-mono font-extrabold text-white">
                  {week.totalLoad} <span className="text-[10px] font-normal text-slate-400">UA</span>
                </div>

                <div className="text-[11px] font-mono text-slate-300 mt-0.5">
                  ⏱️ {week.totalDurationFormatted}
                </div>

                {/* Badge Delta vs S-1 */}
                <div className="mt-2 pt-1.5 border-t border-white/5 flex items-center justify-between text-[10px]">
                  <span className="text-slate-400">{week.sessionCount} séanc.</span>
                  {week.comparison.percentLoadChange !== null ? (
                    <span className={`font-mono font-bold ${
                      week.comparison.percentLoadChange > 15 ? 'text-amber-400'
                      : week.comparison.percentLoadChange > 0 ? 'text-emerald-400'
                      : week.comparison.percentLoadChange < -15 ? 'text-sky-400'
                      : 'text-slate-400'
                    }`}>
                      {week.comparison.percentLoadChange >= 0 ? `+${week.comparison.percentLoadChange}%` : `${week.comparison.percentLoadChange}%`}
                    </span>
                  ) : (
                    <span className="text-slate-500">—</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* COMPARATEUR DIRECT CÔTE-À-CÔTE (SI ACTIVÉ) */}
      {isCompareMode && (
        <div className="bg-[#121216] border-2 border-indigo-500/40 rounded-2xl p-5 shadow-2xl animate-fadeIn">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-white/10 pb-4 mb-4">
            <div className="flex items-center gap-2">
              <Scale size={20} className="text-indigo-400" />
              <h3 className="text-base font-bold text-white">
                Comparateur Direct : Semaine A vs Semaine B
              </h3>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400">Comparer</span>
              <span className="font-mono font-bold text-blue-400 px-2 py-0.5 bg-blue-500/20 rounded border border-blue-500/30">
                {activeWeek.shortLabel} ({activeWeek.label})
              </span>
              <span className="text-slate-400">avec :</span>
              <select
                value={compareWeekId}
                onChange={(e) => setCompareWeekId(e.target.value)}
                className="bg-white/10 border border-white/20 rounded-lg px-2.5 py-1 text-white font-mono text-xs focus:outline-none focus:border-indigo-400"
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
                  <div className="text-xs text-slate-400 mb-1">Différence de Charge Totale</div>
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
                  <div className="text-[11px] text-slate-400 mt-1 flex justify-between font-mono">
                    <span>{activeWeek.shortLabel}: {activeWeek.totalLoad} UA</span>
                    <span>vs {comparisonTargetWeek.shortLabel}: {comparisonTargetWeek.totalLoad} UA</span>
                  </div>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-xl p-3.5">
                  <div className="text-xs text-slate-400 mb-1">Différence de Volume Horaire</div>
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
                  <div className="text-[11px] text-slate-400 mt-1 flex justify-between font-mono">
                    <span>{activeWeek.shortLabel}: {activeWeek.totalDurationFormatted}</span>
                    <span>vs {comparisonTargetWeek.shortLabel}: {comparisonTargetWeek.totalDurationFormatted}</span>
                  </div>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-xl p-3.5">
                  <div className="text-xs text-slate-400 mb-1">Différence de Séances</div>
                  <div className="text-2xl font-mono font-extrabold text-white">
                    {diffMetrics.deltaSessions >= 0 ? `+${diffMetrics.deltaSessions}` : diffMetrics.deltaSessions} séance{Math.abs(diffMetrics.deltaSessions) > 1 ? 's' : ''}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1 flex justify-between font-mono">
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
                  <span className="text-[10px] text-slate-400 font-mono">
                    {activeWeek.shortLabel} vs {comparisonTargetWeek.shortLabel}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-white/[0.02] border-b border-white/5 text-[10px] uppercase text-slate-400 font-mono">
                        <th className="p-2.5">Qualité Physique</th>
                        <th className="p-2.5 text-right">{activeWeek.shortLabel} (Charge / Temps)</th>
                        <th className="p-2.5 text-right">{comparisonTargetWeek.shortLabel} (Charge / Temps)</th>
                        <th className="p-2.5 text-right">Écart ($\Delta$)</th>
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
                              <span className="text-slate-400 text-[10px] ml-2 font-normal font-sans">({formatMinutes(aStat?.durationMinutes || 0)})</span>
                            </td>
                            <td className="p-2.5 text-right">
                              <span className="font-bold text-slate-300">{bLoad} UA</span>
                              <span className="text-slate-500 text-[10px] ml-2 font-normal font-sans">({formatMinutes(bStat?.durationMinutes || 0)})</span>
                            </td>
                            <td className="p-2.5 text-right font-bold">
                              <span className={delta > 0 ? 'text-amber-400' : delta < 0 ? 'text-sky-400' : 'text-slate-400'}>
                                {delta >= 0 ? `+${delta}` : delta} UA
                                {pct !== null && <span className="text-[10px] font-normal ml-1">({pct >= 0 ? `+${pct}%` : `${pct}%`})</span>}
                              </span>
                            </td>
                            <td className="p-2.5 text-center">
                              {delta > 10 ? (
                                <span className="inline-flex items-center text-amber-400 text-[10px]">
                                  <ArrowUpRight size={14} /> Augmentation
                                </span>
                              ) : delta < -10 ? (
                                <span className="inline-flex items-center text-sky-400 text-[10px]">
                                  <ArrowDownRight size={14} /> Décharge
                                </span>
                              ) : (
                                <span className="text-slate-500 text-[10px]">≈ Équivalent</span>
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
        </div>
      )}

      {/* GRAPHIQUE INTERACTIF DE PROGRESSION HEBDOMADAIRE (RECHARTS) */}
      <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-5 shadow-xl backdrop-blur-md">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <TrendingUp size={16} className="text-blue-400" />
              <span>Progression Chronologique Hebdomadaire</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Évolution de la charge d'entraînement (UA) et des heures passées semaine par semaine.
            </p>
          </div>

          {/* Filtre rapide de qualité directement sur le graphique */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <Filter size={12} /> Qualité :
            </span>
            <select
              value={selectedQualityFilter}
              onChange={(e) => setSelectedQualityFilter(e.target.value)}
              className="bg-white/10 border border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-400"
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

        <div className="h-64 sm:h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
              <XAxis dataKey="label" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis yAxisId="left" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" stroke="#38bdf8" tick={{ fill: '#38bdf8', fontSize: 11 }} unit="h" />
              <Tooltip 
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
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
                }}
              />
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
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* SECTION DU BAS : VENTILATION DÉTAILLÉE PAR QUALITÉ PHYSIQUE AVEC TRI & FILTRES */}
      <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-5 shadow-xl backdrop-blur-md">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <Layers size={18} className="text-blue-400" />
              <h3 className="text-base font-bold text-white">
                Ventilation par Qualité Physique : {activeWeek.label}
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Classement et détails pour chaque filière d'entraînement sur la semaine sélectionnée.
            </p>
          </div>

          {/* BARRE D'OUTILS DE TRI ET DE FILTRE (DEMANDE UTILISATEUR) */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Filtre qualité */}
            <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-slate-300">
              <Filter size={13} className="text-slate-400" />
              <select
                value={selectedQualityFilter}
                onChange={(e) => setSelectedQualityFilter(e.target.value)}
                className="bg-transparent text-white font-medium focus:outline-none cursor-pointer"
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
            <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-slate-300">
              <ArrowUpDown size={13} className="text-slate-400" />
              <span className="text-slate-400">Trier par :</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as QualitySortField)}
                className="bg-transparent text-white font-medium focus:outline-none cursor-pointer"
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
              onClick={() => setSortDescending(prev => !prev)}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-all cursor-pointer"
              title={sortDescending ? "Tri décroissant (du plus grand au plus petit)" : "Tri croissant (du plus petit au plus grand)"}
            >
              {sortDescending ? <TrendingDown size={14} /> : <TrendingUp size={14} />}
            </button>
          </div>
        </div>

        {/* TABLEAU DES QUALITÉS AVEC JAUGE DE CHARGE HEBDOMADAIRE */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-white/5 border-y border-white/10 text-[10px] uppercase text-slate-400 font-mono tracking-wider">
                <th className="p-3">Qualité Physique</th>
                <th className="p-3 text-right">Charge Hebdo</th>
                <th className="p-3 w-48 hidden sm:table-cell">% de la Charge Semaine</th>
                <th className="p-3 text-right">Temps Passé</th>
                <th className="p-3 text-center">Séances</th>
                <th className="p-3 text-right">Évolution vs S-1</th>
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
                          <span className="text-[10px] text-slate-400 font-mono">
                            Direct: {item.directLoad} UA • Impact indirect: {item.secondaryLoad} UA
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Charge totale */}
                    <td className="p-3 text-right font-mono font-bold text-xs sm:text-sm">
                      <span className={item.totalLoad > 0 ? 'text-amber-300' : 'text-slate-500'}>
                        {item.totalLoad} <span className="text-[10px] font-normal text-slate-400">UA</span>
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
                        <span className="font-mono text-[10px] text-slate-400 w-10 text-right">
                          {item.percentOfTotalLoad}%
                        </span>
                      </div>
                    </td>

                    {/* Temps */}
                    <td className="p-3 text-right font-mono text-slate-300">
                      {formatMinutes(item.durationMinutes)}
                    </td>

                    {/* Séances */}
                    <td className="p-3 text-center font-mono">
                      <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                        item.sessionCount > 0 
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' 
                          : 'text-slate-600'
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
                          : 'text-slate-400'
                        }`}>
                          {item.percentChangeVsPrevWeek > 0 ? <ArrowUpRight size={13} /> : item.percentChangeVsPrevWeek < 0 ? <ArrowDownRight size={13} /> : null}
                          {item.percentChangeVsPrevWeek >= 0 ? `+${item.percentChangeVsPrevWeek}%` : `${item.percentChangeVsPrevWeek}%`}
                          <span className="text-[10px] text-slate-500 font-normal">
                            ({item.deltaLoadVsPrevWeek >= 0 ? `+${item.deltaLoadVsPrevWeek}` : item.deltaLoadVsPrevWeek} UA)
                          </span>
                        </span>
                      ) : item.totalLoad > 0 ? (
                        <span className="text-emerald-400 text-[11px]">+ Nouveau</span>
                      ) : (
                        <span className="text-slate-600">—</span>
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
  );
};
