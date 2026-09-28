import { useState, useMemo } from 'react';
import { 
  AreaChart, Area, ComposedChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { 
  AlertTriangle, TrendingUp, TrendingDown, Activity, Sparkles, 
  Minus, ArrowUp, ArrowDown, Info, Gauge, Trophy, FileText, 
  ShieldAlert, Play, CheckCircle2, Sliders, Heart, Dumbbell, Flame,
  Search, X, Layers, SlidersHorizontal
} from 'lucide-react';
import { calculateEMA } from '../utils/mathHelpers';
import { getLocalYYYYMMDD } from '../utils/dateHelpers';
import { computeCardioVsMuscularBalance } from '../utils/physiology';

export default function MetricsDashboard({ 
  events = {}, 
  dailyMetrics = {}, 
  qualities = [], 
  qualitiesEMA = {},
  fosterMetrics = null,
  taperingAnalysis = null,
  cardioMuscularBalance = null,
  isSimulationActive = false,
  physioSettings = null,
  viewMode = 'all', // 'all' | 'physiology' | 'qualities'
  onOpenCompetitionModal = null,
  onOpenReportModal = null,
  onOpenPhysioSettingsModal = null,
  onToggleSimulation = null
}) {
  const [selectedQualityId, setSelectedQualityId] = useState(qualities[0]?.id || 'vo2max');
  // 'period' = période caractéristique (J-3, J-7, J-21), 'daily' = hier (J-1), 'week' = semaine passée (J-7)
  const [trendBasis, setTrendBasis] = useState('period');
  const [qualitySearch, setQualitySearch] = useState('');

  const showPhysiology = viewMode === 'all' || viewMode === 'physiology';
  const showQualities = viewMode === 'all' || viewMode === 'qualities';

  const filteredQualities = useMemo(() => {
    if (!qualitySearch.trim()) return qualities;
    return qualities.filter(q => q.name.toLowerCase().includes(qualitySearch.toLowerCase()));
  }, [qualities, qualitySearch]);

  const tauFatigue = physioSettings?.tauFatigue || 7;
  const tauFitness = physioSettings?.tauFitness || 28;

  // 1. Préparation des données globales Banister & VFC pour Recharts (avec projection future)
  const chartData = useMemo(() => {
    const today = new Date();
    const rawData = [];
    const futureDays = isSimulationActive ? 14 : (taperingAnalysis ? 7 : 0);
    
    // Historique des 30 derniers jours + projection future
    for (let i = -29; i <= futureDays; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const dateStr = getLocalYYYYMMDD(d);
      
      const vfc = dailyMetrics[dateStr]?.vfc || null;
      let totalLoad = 0;
      
      Object.values(events).forEach(qualityDates => {
        if (qualityDates && qualityDates[dateStr]) {
          const item = qualityDates[dateStr];
          if (typeof item === 'object' && item.load !== undefined) {
            totalLoad += Number(item.load) || 0;
          } else if (typeof item === 'number') {
            totalLoad += item * 5;
          }
        }
      });

      rawData.push({ 
        dateStr, 
        day: d.getDate(), 
        offset: i,
        isToday: i === 0,
        isFuture: i > 0,
        vfc, 
        load: totalLoad 
      });
    }

    // Calcul des Moyennes Mobiles (EMA) globales
    const vfcRaw = rawData.map(d => d.vfc);
    const vfcEMA3 = calculateEMA(vfcRaw, 3, false);
    const vfcEMA7 = calculateEMA(vfcRaw, 7, false);

    const loadRaw = rawData.map(d => d.load);
    const loadEMA3 = calculateEMA(loadRaw, 3, true);
    const loadEMA7 = calculateEMA(loadRaw, tauFatigue, true);
    const loadEMA21 = calculateEMA(loadRaw, tauFitness, true);

    return rawData.map((data, i) => {
      const atl = Math.round(loadEMA7[i]);
      const ctl = Math.round(loadEMA21[i]);
      const tsb = ctl - atl;
      return {
        ...data,
        vfcEMA3: vfcEMA3[i] ? Math.round(vfcEMA3[i]) : null,
        vfcEMA7: vfcEMA7[i] ? Math.round(vfcEMA7[i]) : null,
        loadEMA3: Math.round(loadEMA3[i]),
        loadEMA7: atl,
        loadEMA21: ctl,
        tsb
      };
    });
  }, [events, dailyMetrics, isSimulationActive, taperingAnalysis, tauFatigue, tauFitness]);

  // Données de la qualité sélectionnée pour le graphique dédié EMA 3/7/21j
  const activeQualityData = useMemo(() => {
    const qInfo = qualitiesEMA[selectedQualityId];
    const qDef = qualities.find(q => q.id === selectedQualityId);
    return {
      qDef,
      series: qInfo?.series || [],
      current: qInfo?.current || { 
        ema3: 0, ema7: 0, ema21: 0, acwr: 1,
        prevEma3: 0, prevEma7: 0, prevEma21: 0,
        prevPeriodEma3: 0, prevPeriodEma7: 0, prevPeriodEma21: 0,
        prevWeekEma3: 0, prevWeekEma7: 0, prevWeekEma21: 0,
        delta3: 0, delta7: 0, delta21: 0,
        periodDelta3: 0, periodDelta7: 0, periodDelta21: 0,
        weekDelta3: 0, weekDelta7: 0, weekDelta21: 0,
        percent3: 0, percent7: 0, percent21: 0,
        periodPercent3: 0, periodPercent7: 0, periodPercent21: 0,
        weekPercent3: 0, weekPercent7: 0, weekPercent21: 0
      }
    };
  }, [qualitiesEMA, selectedQualityId, qualities]);

  // 2. Le Coach Virtuel (Analyse algorithmique des tendances)
  const coachInsights = useMemo(() => {
    if (chartData.length === 0) return [];
    const latest = chartData[chartData.length - 1];
    const insights = [];

    // Ratio ACWR Global (Aiguë vs Chronique)
    const acwr = latest.loadEMA21 > 0 ? (latest.loadEMA7 / latest.loadEMA21).toFixed(2) : 1;
    
    if (acwr > 1.5) {
      insights.push({ 
        type: 'danger', 
        icon: <AlertTriangle size={18}/>, 
        text: `Surcharge globale ! Votre charge récente (EMA 7) est de ${acwr}x votre niveau chronique (EMA 21). Risque accru de blessure ou de fatigue excessive.` 
      });
    } else if (acwr > 1.2) {
      insights.push({ 
        type: 'warning', 
        icon: <TrendingUp size={18}/>, 
        text: `Surcharge fonctionnelle ciblée (Ratio: ${acwr}). Stimulus d'entraînement efficace si vous êtes en bloc de développement.` 
      });
    } else if (acwr < 0.8 && latest.loadEMA21 > 0) {
      insights.push({ 
        type: 'info', 
        icon: <TrendingDown size={18}/>, 
        text: `Désentraînement ou phase d'affûtage (Ratio: ${acwr}). Parfait avant une compétition.` 
      });
    }

    // Tendance VFC
    if (latest.vfcEMA3 && latest.vfcEMA7) {
      if (latest.vfcEMA3 < latest.vfcEMA7 * 0.9) {
        insights.push({ 
          type: 'danger', 
          icon: <Activity size={18}/>, 
          text: `Système nerveux autonome fatigué. La VFC à court terme (EMA 3: ${latest.vfcEMA3}ms) a chuté sous la référence hebdomadaire (EMA 7: ${latest.vfcEMA7}ms).` 
        });
      } else if (latest.vfcEMA3 > latest.vfcEMA7 * 1.05) {
        insights.push({ 
          type: 'good', 
          icon: <Activity size={18}/>, 
          text: `Excellente récupération parasympathique. Le corps assimile positivement l'entraînement actuel.` 
        });
      }
    }

    return insights;
  }, [chartData]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const dataItem = payload[0]?.payload;
      const isFut = dataItem?.isFuture;
      const isTod = dataItem?.isToday;

      return (
        <div className="bg-[#121216]/95 backdrop-blur-md p-3 border border-white/10 rounded-xl shadow-[0_4px_15px_rgba(0,0,0,0.5)]">
          <div className="flex items-center justify-between gap-3 mb-2 pb-1 border-b border-white/10">
            <span className="font-bold text-slate-100 uppercase text-[10px] tracking-wider font-mono">
              {dataItem?.dateStr || `Jour ${label}`}
            </span>
            {isTod && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-500/20 text-blue-300">
                Aujourd'hui
              </span>
            )}
            {isFut && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-500/20 text-purple-300">
                Projection J+{dataItem.offset}
              </span>
            )}
          </div>
          {payload.map((p, i) => (
            <p key={i} style={{ color: p.color }} className="m-0 text-xs font-semibold py-0.5 flex justify-between gap-4">
              <span>{p.name} :</span>
              <span className="font-mono font-bold">{p.value}</span>
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  /**
   * Helper d'analyse de magnitude :
   * Détermine l'intensité (1 à 4 barres), le qualificatif (Légère, Modérée, Forte, Majeure)
   * et formate la tendance avec flèche verte / rouge.
   */
  const getTrendMagnitudeInfo = (delta, percent) => {
    const absD = Math.abs(delta);
    const absP = Math.abs(percent);

    const isUp = delta > 0.05;
    const isDown = delta < -0.05;

    let level = 0; // 0 = stable, 1 = faible, 2 = modéré, 3 = fort, 4 = majeur
    let label = 'Stable';

    if (isUp || isDown) {
      if (absP >= 35 || absD >= 15) {
        level = 4;
        label = isUp ? 'Progression majeure' : 'Déclin majeur';
      } else if (absP >= 15 || absD >= 8) {
        level = 3;
        label = isUp ? 'Forte progression' : 'Fort déclin';
      } else if (absP >= 5 || absD >= 2) {
        level = 2;
        label = isUp ? 'Progression modérée' : 'Déclin modéré';
      } else {
        level = 1;
        label = isUp ? 'Légère progression' : 'Léger déclin';
      }
    }

    return { isUp, isDown, level, label, absD, absP };
  };

  /**
   * Indicateur visuel (flèche verte/rouge) et magnitude
   * Conçu pour être affiché directement à côté de chaque valeur EMA.
   */
  const renderTrendIndicator = (delta, percent, prevVal, currentVal, mode = 'compact', metricName = '') => {
    const { isUp, isDown, level, label } = getTrendMagnitudeInfo(delta, percent);

    const periodRefName = 
      trendBasis === 'daily' ? 'jour précédent (J-1)' :
      trendBasis === 'week' ? 'semaine précédente (J-7)' :
      'période précédente';

    const tooltipText = isUp || isDown
      ? `${label} (${delta > 0 ? '+' : ''}${delta} | ${percent > 0 ? '+' : ''}${percent}%)\nPrécédente : ${prevVal} → Actuelle : ${currentVal} (${periodRefName})`
      : `Tendance stable (${delta} / 0%)\nPrécédente : ${prevVal} → Actuelle : ${currentVal} (${periodRefName})`;

    // Mode carte d'en-tête (mise en valeur maximale de la magnitude à côté de la valeur)
    if (mode === 'card') {
      if (isUp) {
        return (
          <div className="inline-flex items-center gap-1.5" title={tooltipText}>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.15)]">
              <ArrowUp size={13} className="stroke-[3] text-emerald-400 shrink-0" />
              <span>+{delta}</span>
              <span className="text-[10px] opacity-80">({percent > 0 ? `+${percent}%` : `${percent}%`})</span>
            </span>
            {/* Jauge visuelle de magnitude (4 barres) */}
            <div className="flex items-center gap-0.5" title={`Magnitude : ${label} (${level}/4)`}>
              {[1, 2, 3, 4].map(b => (
                <span 
                  key={b} 
                  className={`w-1 h-3 rounded-full transition-all ${
                    b <= level ? 'bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.5)]' : 'bg-white/10'
                  }`}
                />
              ))}
            </div>
          </div>
        );
      }
      if (isDown) {
        return (
          <div className="inline-flex items-center gap-1.5" title={tooltipText}>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold bg-red-500/20 text-red-300 border border-red-500/40 shadow-[0_0_10px_rgba(239,68,68,0.15)]">
              <ArrowDown size={13} className="stroke-[3] text-red-400 shrink-0" />
              <span>{delta}</span>
              <span className="text-[10px] opacity-80">({percent}%)</span>
            </span>
            {/* Jauge visuelle de magnitude */}
            <div className="flex items-center gap-0.5" title={`Magnitude : ${label} (${level}/4)`}>
              {[1, 2, 3, 4].map(b => (
                <span 
                  key={b} 
                  className={`w-1 h-3 rounded-full transition-all ${
                    b <= level ? 'bg-red-400 shadow-[0_0_4px_rgba(248,113,113,0.5)]' : 'bg-white/10'
                  }`}
                />
              ))}
            </div>
          </div>
        );
      }
      return (
        <span 
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-mono text-slate-400 bg-white/5 border border-white/10"
          title={tooltipText}
        >
          <Minus size={11} className="text-slate-500" />
          <span>0.0 (0%)</span>
        </span>
      );
    }

    // Mode compact (pour les cellules du tableau récapitulatif)
    if (isUp) {
      return (
        <span 
          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 whitespace-nowrap cursor-help hover:bg-emerald-500/25 transition-colors"
          title={tooltipText}
        >
          <ArrowUp size={11} className="stroke-[3] text-emerald-400 shrink-0" />
          <span>+{delta}</span>
          <span className="text-[9px] opacity-75 font-mono">({percent > 0 ? `+${percent}%` : `${percent}%`})</span>
          {/* Indicateur de force de magnitude */}
          {level >= 3 && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 ml-0.5 animate-pulse" title="Forte magnitude" />
          )}
        </span>
      );
    }
    if (isDown) {
      return (
        <span 
          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-500/15 text-red-300 border border-red-500/30 whitespace-nowrap cursor-help hover:bg-red-500/25 transition-colors"
          title={tooltipText}
        >
          <ArrowDown size={11} className="stroke-[3] text-red-400 shrink-0" />
          <span>{delta}</span>
          <span className="text-[9px] opacity-75 font-mono">({percent}%)</span>
          {/* Indicateur de force de magnitude */}
          {level >= 3 && (
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 ml-0.5 animate-pulse" title="Forte magnitude" />
          )}
        </span>
      );
    }
    return (
      <span 
        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono text-slate-500 bg-white/5 border border-white/5 whitespace-nowrap cursor-help"
        title={tooltipText}
      >
        <Minus size={9} />
        <span>0.0</span>
      </span>
    );
  };

  // Récupération des valeurs courantes pour la qualité active selon la base de calcul sélectionnée
  const curr = activeQualityData.current;

  const d3 = 
    trendBasis === 'daily' ? curr.delta3 ?? 0 :
    trendBasis === 'week' ? curr.weekDelta3 ?? 0 :
    curr.periodDelta3 ?? 0;

  const p3 = 
    trendBasis === 'daily' ? curr.percent3 ?? 0 :
    trendBasis === 'week' ? curr.weekPercent3 ?? 0 :
    curr.periodPercent3 ?? 0;

  const prevVal3 = 
    trendBasis === 'daily' ? curr.prevEma3 ?? 0 :
    trendBasis === 'week' ? curr.prevWeekEma3 ?? 0 :
    curr.prevPeriodEma3 ?? 0;

  const d7 = 
    trendBasis === 'daily' ? curr.delta7 ?? 0 :
    trendBasis === 'week' ? curr.weekDelta7 ?? 0 :
    curr.periodDelta7 ?? 0;

  const p7 = 
    trendBasis === 'daily' ? curr.percent7 ?? 0 :
    trendBasis === 'week' ? curr.weekPercent7 ?? 0 :
    curr.periodPercent7 ?? 0;

  const prevVal7 = 
    trendBasis === 'daily' ? curr.prevEma7 ?? 0 :
    trendBasis === 'week' ? curr.prevWeekEma7 ?? 0 :
    curr.prevPeriodEma7 ?? 0;

  const d21 = 
    trendBasis === 'daily' ? curr.delta21 ?? 0 :
    trendBasis === 'week' ? curr.weekDelta21 ?? 0 :
    curr.periodDelta21 ?? 0;

  const p21 = 
    trendBasis === 'daily' ? curr.percent21 ?? 0 :
    trendBasis === 'week' ? curr.weekPercent21 ?? 0 :
    curr.periodPercent21 ?? 0;

  const prevVal21 = 
    trendBasis === 'daily' ? curr.prevEma21 ?? 0 :
    trendBasis === 'week' ? curr.prevWeekEma21 ?? 0 :
    curr.prevPeriodEma21 ?? 0;

  const periodLabel3 = trendBasis === 'daily' ? 'veille (J-1)' : trendBasis === 'week' ? 'J-7' : 'J-3';
  const periodLabel7 = trendBasis === 'daily' ? 'veille (J-1)' : trendBasis === 'week' ? 'J-7' : 'J-7';
  const periodLabel21 = trendBasis === 'daily' ? 'veille (J-1)' : trendBasis === 'week' ? 'J-7' : 'J-21';

  const balance = useMemo(() => {
    return cardioMuscularBalance || computeCardioVsMuscularBalance(events);
  }, [cardioMuscularBalance, events]);

  return (
    <div className="p-4 md:p-6 w-full flex flex-col gap-6">
      
      {showPhysiology && (
        <>
          {/* BARRE D'ACTIONS SCIENTIFIQUES : SIMULATION, OBJECTIF & EXPORT */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-white/5 border border-white/10">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400">
            <Gauge size={16} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Tableau de Bord Physiologique</h4>
            <p className="text-[11px] text-slate-400">Modèles Banister, Foster Monotony & Affûtage</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onToggleSimulation && (
            <button
              onClick={() => onToggleSimulation()}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                isSimulationActive 
                  ? 'bg-purple-600 text-white border-purple-400/50 shadow-md shadow-purple-500/20' 
                  : 'bg-purple-600/20 text-purple-300 hover:bg-purple-600/30 border-purple-500/30'
              }`}
              title="Activer la simulation prédictive pour projeter les jours futurs"
            >
              <Sparkles size={13} className={isSimulationActive ? 'animate-spin-slow' : ''} />
              <span>{isSimulationActive ? 'Mode Simulation Actif' : 'Mode Simulation (What-If)'}</span>
            </button>
          )}

          {onOpenCompetitionModal && (
            <button
              onClick={onOpenCompetitionModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-semibold transition-colors cursor-pointer"
              title="Configurer une compétition ou un objectif de course"
            >
              <Trophy size={13} className="text-amber-400" />
              <span>
                {taperingAnalysis?.targetCompetition 
                  ? `${taperingAnalysis.targetCompetition.name} (J-${taperingAnalysis.daysRemaining})` 
                  : 'Objectif Compétition'}
              </span>
            </button>
          )}

          {onOpenPhysioSettingsModal && (
            <button
              onClick={onOpenPhysioSettingsModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-indigo-300 text-xs font-semibold transition-colors cursor-pointer"
              title="Calibrer les constantes de rémanence Banister (tau fatigue et condition)"
            >
              <Sliders size={13} className="text-indigo-400" />
              <span>Calibrage (τ₁:{tauFatigue}j, τ₂:{tauFitness}j)</span>
            </button>
          )}

          {onOpenReportModal && (
            <button
              onClick={onOpenReportModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 text-blue-300 text-xs font-semibold transition-colors cursor-pointer"
              title="Générer un bilan d'entraînement imprimable en PDF"
            >
              <FileText size={13} className="text-blue-400" />
              <span>Bilan PDF</span>
            </button>
          )}
        </div>
      </div>

      {/* SECTION TAPER / FOSTER / BALANCE : 3 WIDGETS PHYSIOLOGIQUES COMPLÉMENTAIRES */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        
        {/* CARTE 1 : AFFÛTAGE & PRÉDICTION COMPÉTITION */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-950/30 via-purple-950/20 to-black/40 border border-amber-500/25 flex flex-col justify-between">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <Trophy size={16} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  Affûtage & Objectif Compétition
                </h4>
                <p className="text-[11px] text-slate-400">
                  {taperingAnalysis?.targetCompetition 
                    ? taperingAnalysis.targetCompetition.name 
                    : 'Aucun objectif défini'}
                </p>
              </div>
            </div>

            {taperingAnalysis?.targetCompetition ? (
              <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {taperingAnalysis.daysRemaining >= 0 ? `J-${taperingAnalysis.daysRemaining}` : 'Terminé'}
              </span>
            ) : (
              <button
                onClick={onOpenCompetitionModal}
                className="text-[11px] font-bold text-amber-400 hover:text-amber-300 underline cursor-pointer"
              >
                Définir
              </button>
            )}
          </div>

          {taperingAnalysis ? (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded-xl bg-black/40 border border-white/5">
                  <span className="text-[10px] text-slate-400 block">Statut</span>
                  <span className="text-xs font-bold text-amber-300 truncate block mt-0.5">
                    {taperingAnalysis.statusBadge}
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-black/40 border border-white/5">
                  <span className="text-[10px] text-slate-400 block">TSB Projeté Jour J</span>
                  <span className="text-xs font-bold font-mono text-emerald-400 block mt-0.5">
                    {taperingAnalysis.projectedTsb > 0 ? `+${taperingAnalysis.projectedTsb}` : taperingAnalysis.projectedTsb}
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-black/40 border border-white/5">
                  <span className="text-[10px] text-slate-400 block">Cible Banister</span>
                  <span className="text-xs font-bold font-mono text-blue-300 block mt-0.5">
                    +{taperingAnalysis.targetTsb} TSB
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed bg-white/5 p-2 rounded-lg border border-white/5 m-0">
                {taperingAnalysis.advice}
              </p>
            </div>
          ) : (
            <div className="text-xs text-slate-400 py-2">
              Définissez la date de votre objectif pour calculer votre affûtage optimal et modéliser le pic TSB.
            </div>
          )}
        </div>

        {/* CARTE 2 : MONOTONIE DE FOSTER & STRAIN (PRÉVENTION DES BLESSURES & SURMENAGE) */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-950/30 via-slate-900/40 to-black/40 border border-blue-500/25 flex flex-col justify-between">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
                <ShieldAlert size={16} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  Monotonie de Foster & Strain
                </h4>
                <p className="text-[11px] text-slate-400">Variabilité des stimuli & protection immunitaire</p>
              </div>
            </div>

            {fosterMetrics && (
              <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                fosterMetrics.monotony > 2.0 
                  ? 'bg-red-500/20 text-red-300 border-red-500/30' 
                  : fosterMetrics.monotony > 1.5 
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' 
                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
              }`}>
                {fosterMetrics.riskBadge}
              </span>
            )}
          </div>

          {fosterMetrics && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded-xl bg-black/40 border border-white/5">
                  <span className="text-[10px] text-slate-400 block">Monotonie</span>
                  <span className={`text-xs font-bold font-mono block mt-0.5 ${
                    fosterMetrics.monotony > 2.0 ? 'text-red-400' : fosterMetrics.monotony > 1.5 ? 'text-amber-400' : 'text-emerald-400'
                  }`}>
                    {fosterMetrics.monotony} <span className="text-[10px] opacity-70">(&lt;1.5)</span>
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-black/40 border border-white/5">
                  <span className="text-[10px] text-slate-400 block">Strain Hebdo</span>
                  <span className="text-xs font-bold font-mono text-purple-300 block mt-0.5">
                    {fosterMetrics.strain}
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-black/40 border border-white/5">
                  <span className="text-[10px] text-slate-400 block">Écart-Type (Variabilité)</span>
                  <span className="text-xs font-bold font-mono text-slate-200 block mt-0.5">
                    {fosterMetrics.stdDev}
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed bg-white/5 p-2 rounded-lg border border-white/5 m-0">
                {fosterMetrics.advice}
              </p>
            </div>
          )}
        </div>

        {/* CARTE 3 : TRIMP MULTI-FACTEURS (CARDIO VS MUSCULAIRE VS EXCENTRIQUE) */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900/40 via-red-950/20 to-sky-950/30 border border-sky-500/25 flex flex-col justify-between">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30">
                <Heart size={16} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  TRIMP Cardio vs Musculaire
                </h4>
                <p className="text-[11px] text-slate-400">Asymétrie de fatigue & stress excentrique</p>
              </div>
            </div>

            {balance && (
              <span className={`px-2 py-0.5 rounded-lg text-[11px] font-bold border truncate max-w-[150px] ${
                balance.state === 'CARDIO_DOMINANT'
                  ? 'bg-sky-500/20 text-sky-300 border-sky-500/30'
                  : balance.state === 'MUSCULAR_DOMINANT'
                  ? 'bg-red-500/20 text-red-300 border-red-500/30'
                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
              }`} title={balance.badge}>
                {balance.badge}
              </span>
            )}
          </div>

          {balance && (
            <div className="space-y-3">
              {/* Barre de ratio visuelle */}
              <div>
                <div className="flex justify-between text-[11px] font-mono mb-1">
                  <span className="text-sky-400 flex items-center gap-1 font-bold">
                    <Heart size={11} /> Cardio {balance.cardioPercent}%
                  </span>
                  <span className="text-red-400 flex items-center gap-1 font-bold">
                    Musculaire {balance.muscPercent}% <Dumbbell size={11} />
                  </span>
                </div>
                <div className="w-full h-2 rounded-full overflow-hidden flex bg-white/10">
                  <div 
                    className="bg-sky-400 h-full transition-all duration-500" 
                    style={{ width: `${balance.cardioPercent}%` }}
                    title={`Charge Cardio 7j: ${balance.totalCardioLoad}`}
                  />
                  <div 
                    className="bg-red-400 h-full transition-all duration-500" 
                    style={{ width: `${balance.muscPercent}%` }}
                    title={`Charge Musculaire 7j: ${balance.totalMuscLoad}`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded-xl bg-black/40 border border-white/5">
                  <span className="text-[10px] text-slate-400 block">Cardio 7j</span>
                  <span className="text-xs font-bold font-mono text-sky-400 block mt-0.5">
                    {balance.totalCardioLoad}
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-black/40 border border-white/5">
                  <span className="text-[10px] text-slate-400 block">Musculaire 7j</span>
                  <span className="text-xs font-bold font-mono text-red-400 block mt-0.5">
                    {balance.totalMuscLoad}
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-black/40 border border-white/5">
                  <span className="text-[10px] text-slate-400 block">Chocs Excentriques</span>
                  <span className="text-xs font-bold font-mono text-amber-300 block mt-0.5 flex items-center justify-center gap-1">
                    <Flame size={11} className="text-amber-400" />
                    {balance.totalEccentricSessions} s.
                  </span>
                </div>
              </div>

              <div className="text-[11px] text-slate-300 leading-relaxed bg-white/5 p-2 rounded-lg border border-white/5 m-0 space-y-1">
                <p className="m-0 leading-tight">
                  <strong className="text-white">Diagnostic :</strong> {balance.description}
                </p>
                <p className="m-0 text-emerald-300 text-[10px] leading-tight">
                  🎯 {balance.recommendation}
                </p>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* ENCART COACH VIRTUEL */}
      {coachInsights.length > 0 && (
        <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2 mb-4">
            <Sparkles size={16} className="text-blue-400" /> Analyse Intelligente de Charge & Récupération
          </h4>
          <div className="space-y-3">
            {coachInsights.map((insight, i) => {
              let bClass = 'bg-white/5 border border-white/5 text-slate-300';
              if (insight.type === 'danger') bClass = 'bg-red-500/10 border border-red-500/20 text-red-200';
              else if (insight.type === 'warning') bClass = 'bg-amber-500/10 border border-amber-500/20 text-amber-200';
              else if (insight.type === 'good') bClass = 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-200';
              return (
                <div key={i} className={`flex items-start gap-3 p-3 rounded-xl text-sm ${bClass}`}>
                  <div className="mt-0.5 opacity-80 shrink-0">{insight.icon}</div>
                  <span className="leading-relaxed">{insight.text}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

          {/* GRAPHIQUES GLOBAUX BANISTER + VFC */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[300px] min-h-0">
            
            {/* GRAPHIQUE 1 : Charge Globale (Banister) */}
            <div className="flex flex-col h-full bg-white/5 border border-white/10 rounded-2xl p-4 min-h-0 relative">
              <div className="flex items-center justify-between mb-2 shrink-0">
                <div className="flex items-center gap-2">
                  <p className="text-[10px] text-slate-500 uppercase font-bold m-0 flex items-center gap-1.5">
                    <Activity size={12} className="text-blue-400" />
                    Charge Globale & Forme Banister (ATL, CTL, TSB)
                  </p>
                  {onOpenPhysioSettingsModal && (
                    <button
                      onClick={onOpenPhysioSettingsModal}
                      className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/30 transition-colors cursor-pointer"
                      title="Modifier les constantes de rémanence tau"
                    >
                      τ₁:{tauFatigue}j / τ₂:{tauFitness}j
                    </button>
                  )}
                </div>
                {isSimulationActive && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    Projection Future Active (+14j)
                  </span>
                )}
              </div>
              <div className="flex-1 w-full min-h-[180px] relative">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorAigue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorChronique" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#38bdf8" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="day" stroke="#64748b" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis stroke="#64748b" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend verticalAlign="top" height={32} iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
                    
                    <Area type="monotone" dataKey="loadEMA7" name={`Fatigue Aiguë ATL (${tauFatigue}j)`} stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorAigue)" />
                    <Area type="monotone" dataKey="loadEMA21" name={`Condition CTL (${tauFitness}j)`} stroke="#38bdf8" strokeWidth={2} fillOpacity={1} fill="url(#colorChronique)" />
                    <Line type="monotone" dataKey="tsb" name="Forme TSB (Readiness)" stroke="#10b981" strokeWidth={2.5} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* GRAPHIQUE 2 : Tendance VFC */}
            <div className="flex flex-col h-full bg-white/5 border border-white/10 rounded-2xl p-4 min-h-0 relative">
              <p className="text-[10px] text-slate-500 uppercase font-bold mb-2 shrink-0">
                Tendances de Récupération VFC (HRV)
              </p>
              <div className="flex-1 w-full min-h-[180px] relative">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="day" stroke="#64748b" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis stroke="#64748b" domain={['auto', 'auto']} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend verticalAlign="top" height={32} iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
                    
                    <Line type="monotone" dataKey="vfc" name="VFC Nette" stroke="rgba(255,255,255,0.2)" strokeWidth={1} dot={{ r: 2, fill: 'rgba(255,255,255,0.2)', strokeWidth: 0 }} connectNulls />
                    <Line type="monotone" dataKey="vfcEMA3" name="VFC EMA 3j" stroke="#10b981" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="vfcEMA7" name="VFC Ligne de Base (EMA 7j)" stroke="#ec4899" strokeWidth={1.5} dot={false} strokeDasharray="5 5" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>
        </>
      )}

      {/* FOCUS QUALITÉ INDIVIDUELLE : COURBES EMA 3 / 7 / 21 JOURS & TENDANCES */}
      {showQualities && qualities.length > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 sm:p-5 flex flex-col gap-5">
          {/* EN-TÊTE DE LA SECTION QUALITÉS & SÉLECTEUR DE TENDANCE */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                  Suivi Détaillé des Charges EMA & Dynamiques
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  Flèches & Magnitudes Actives
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2 m-0 mt-0.5">
                Courbes EMA & Tendances : <span className="text-blue-400">{activeQualityData.qDef?.name || selectedQualityId}</span>
              </h3>
            </div>

            {/* Sélecteur de base de comparaison de tendance */}
            <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10 text-[11px]">
              <span className="text-slate-400 px-1 text-[10px] font-semibold flex items-center gap-1">
                <Gauge size={11} className="text-blue-400" />
                Tendance vs :
              </span>
              <button
                onClick={() => setTrendBasis('period')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  trendBasis === 'period'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Compare chaque EMA à sa période caractéristique : EMA 3j vs J-3, EMA 7j vs J-7, EMA 21j vs J-21"
              >
                Période (3j/7j/21j)
              </button>
              <button
                onClick={() => setTrendBasis('daily')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  trendBasis === 'daily'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Compare l'EMA d'aujourd'hui à celle d'hier (J-1)"
              >
                J-1 (Veille)
              </button>
              <button
                onClick={() => setTrendBasis('week')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  trendBasis === 'week'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Compare l'EMA d'aujourd'hui à celle de la semaine passée (J-7)"
              >
                J-7 (Semaine)
              </button>
            </div>
          </div>

          {/* SÉLECTEUR DE QUALITÉS DÉDIÉ (PLEINE LARGEUR, TOUTES VISIBLES SANS DÉPASSEMENT) */}
          <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <Layers size={14} className="text-blue-400" />
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Sélectionnez une filière d'entraînement :
                </span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-white/5 text-slate-400 border border-white/5">
                  {filteredQualities.length}/{qualities.length}
                </span>
              </div>

              {/* Barre de recherche instantanée */}
              <div className="relative flex items-center min-w-[180px] max-w-xs">
                <Search size={13} className="absolute left-2.5 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={qualitySearch}
                  onChange={(e) => setQualitySearch(e.target.value)}
                  placeholder="Rechercher une qualité..."
                  className="w-full pl-8 pr-7 py-1 text-xs bg-white/5 border border-white/10 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:bg-white/10 transition-all"
                />
                {qualitySearch && (
                  <button
                    onClick={() => setQualitySearch('')}
                    className="absolute right-2 text-slate-400 hover:text-white cursor-pointer"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* Grille fluide / Pills de toutes les qualités avec retour à la ligne automatique */}
            <div className="flex flex-wrap gap-2 pt-1">
              {filteredQualities.map(q => {
                const isSelected = q.id === selectedQualityId;
                const qEma = qualitiesEMA[q.id]?.current;
                const d = trendBasis === 'daily' ? (qEma?.delta3 ?? 0) : trendBasis === 'week' ? (qEma?.weekDelta3 ?? 0) : (qEma?.periodDelta3 ?? 0);
                const isUp = d > 0.05;
                const isDown = d < -0.05;
                const val3 = qEma?.ema3 ?? 0;

                return (
                  <button
                    key={q.id}
                    onClick={() => setSelectedQualityId(q.id)}
                    className={`group px-3 py-1.5 rounded-xl text-xs transition-all border cursor-pointer flex items-center gap-2 ${
                      isSelected 
                        ? 'bg-blue-600 text-white border-blue-400 shadow-md shadow-blue-600/30 font-bold' 
                        : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/10 hover:border-white/20'
                    }`}
                  >
                    <span>{q.name}</span>
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                      isSelected ? 'bg-black/30 text-blue-100' : 'bg-black/40 text-slate-400'
                    }`}>
                      {val3}
                    </span>
                    {isUp && <ArrowUp size={11} className={`stroke-[3] ${isSelected ? 'text-emerald-300' : 'text-emerald-400'}`} />}
                    {isDown && <ArrowDown size={11} className={`stroke-[3] ${isSelected ? 'text-red-200' : 'text-red-400'}`} />}
                  </button>
                );
              })}

              {filteredQualities.length === 0 && (
                <div className="text-xs text-slate-400 py-2 italic w-full text-center">
                  Aucune qualité ne correspond à "{qualitySearch}".
                </div>
              )}
            </div>
          </div>

          {/* BANDEAU D'EXPLICATION DE LA BASE DE CALCUL SÉLECTIONNÉE */}
          <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-blue-500/5 border border-blue-500/15 text-xs text-slate-300">
            <div className="flex items-center gap-2">
              <Info size={14} className="text-blue-400 shrink-0" />
              <span>
                {trendBasis === 'period' && (
                  <span>
                    <strong>Mode Période Précédente :</strong> Chaque indicateur EMA est comparé à sa propre fenêtre d'oscillation (EMA 3j vs J-3, EMA 7j vs J-7, EMA 21j vs J-21).
                  </span>
                )}
                {trendBasis === 'daily' && (
                  <span>
                    <strong>Mode Veille (J-1) :</strong> Évolution dynamique sur les 24 dernières heures.
                  </span>
                )}
                {trendBasis === 'week' && (
                  <span>
                    <strong>Mode Semaine (J-7) :</strong> Évolution globale par rapport au même jour de la semaine passée.
                  </span>
                )}
              </span>
            </div>
            <span className="text-[11px] text-slate-400 font-mono shrink-0 hidden sm:inline">
              Vert = Progression | Rouge = Déclin
            </span>
          </div>

          {/* CARTES KPI AVEC FLÈCHE ET MAGNITUDE PLACÉES IMMÉDIATEMENT À CÔTÉ DE CHAQUE VALEUR EMA */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* EMA 3j */}
            <div className="bg-black/40 border border-white/10 rounded-xl p-3.5 flex flex-col justify-between hover:border-white/20 transition-all">
              <div className="flex items-center justify-between gap-1 mb-1">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                  <span className="text-xs text-slate-300 font-semibold">EMA 3j (Fatigue Aiguë)</span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">vs {periodLabel3}</span>
              </div>

              {/* Valeur EMA 3j avec flèche et magnitude immédiatement à côté */}
              <div className="flex items-center gap-2.5 my-1.5">
                <span className="text-2xl sm:text-3xl font-bold font-mono text-white tracking-tight">
                  {curr.ema3}
                </span>
                {renderTrendIndicator(d3, p3, prevVal3, curr.ema3, 'card', 'EMA 3j')}
              </div>

              <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                <span>Réf. {periodLabel3} : <strong className="text-slate-300">{prevVal3}</strong></span>
                <span className={d3 > 0.05 ? 'text-emerald-400 font-semibold' : d3 < -0.05 ? 'text-red-400 font-semibold' : 'text-slate-400'}>
                  Δ {d3 > 0 ? `+${d3}` : d3}
                </span>
              </div>
            </div>

            {/* EMA 7j */}
            <div className="bg-black/40 border border-white/10 rounded-xl p-3.5 flex flex-col justify-between hover:border-white/20 transition-all">
              <div className="flex items-center justify-between gap-1 mb-1">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                  <span className="text-xs text-slate-300 font-semibold">EMA 7j (Charge Récente)</span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">vs {periodLabel7}</span>
              </div>

              {/* Valeur EMA 7j avec flèche et magnitude immédiatement à côté */}
              <div className="flex items-center gap-2.5 my-1.5">
                <span className="text-2xl sm:text-3xl font-bold font-mono text-white tracking-tight">
                  {curr.ema7}
                </span>
                {renderTrendIndicator(d7, p7, prevVal7, curr.ema7, 'card', 'EMA 7j')}
              </div>

              <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                <span>Réf. {periodLabel7} : <strong className="text-slate-300">{prevVal7}</strong></span>
                <span className={d7 > 0.05 ? 'text-emerald-400 font-semibold' : d7 < -0.05 ? 'text-red-400 font-semibold' : 'text-slate-400'}>
                  Δ {d7 > 0 ? `+${d7}` : d7}
                </span>
              </div>
            </div>

            {/* EMA 21j */}
            <div className="bg-black/40 border border-white/10 rounded-xl p-3.5 flex flex-col justify-between hover:border-white/20 transition-all">
              <div className="flex items-center justify-between gap-1 mb-1">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-400"></span>
                  <span className="text-xs text-slate-300 font-semibold">EMA 21j (Fitness Durable)</span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">vs {periodLabel21}</span>
              </div>

              {/* Valeur EMA 21j avec flèche et magnitude immédiatement à côté */}
              <div className="flex items-center gap-2.5 my-1.5">
                <span className="text-2xl sm:text-3xl font-bold font-mono text-white tracking-tight">
                  {curr.ema21}
                </span>
                {renderTrendIndicator(d21, p21, prevVal21, curr.ema21, 'card', 'EMA 21j')}
              </div>

              <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                <span>Réf. {periodLabel21} : <strong className="text-slate-300">{prevVal21}</strong></span>
                <span className={d21 > 0.05 ? 'text-emerald-400 font-semibold' : d21 < -0.05 ? 'text-red-400 font-semibold' : 'text-slate-400'}>
                  Δ {d21 > 0 ? `+${d21}` : d21}
                </span>
              </div>
            </div>

            {/* Ratio ACWR */}
            <div className="bg-black/40 border border-white/10 rounded-xl p-3.5 flex flex-col justify-between hover:border-white/20 transition-all">
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className="text-xs text-slate-300 font-semibold">Ratio ACWR (7j / 21j)</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                  curr.acwr > 1.5 
                    ? 'bg-red-500/20 text-red-400 border-red-500/30'
                    : curr.acwr > 1.3
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                    : curr.acwr >= 0.8
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                    : 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                }`}>
                  {curr.acwr > 1.5 ? '⚠️ Surcharge' : curr.acwr >= 0.8 ? '✅ Optimal' : 'Sous-charge'}
                </span>
              </div>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-2xl sm:text-3xl font-bold font-mono text-white">{curr.acwr}</span>
                <span className="text-[10px] text-slate-400 font-mono">
                  Équilibre charge/fitness
                </span>
              </div>
              <div className="pt-2 border-t border-white/5 text-[10px] text-slate-400 flex items-center justify-between">
                <span>Zone idéale : 0.8 - 1.3</span>
                <span className="text-slate-500">Banister</span>
              </div>
            </div>
          </div>

          {/* Graphique de la qualité sélectionnée */}
          <div className="h-[220px] w-full min-h-[180px] relative">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={activeQualityData.series} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="day" stroke="#64748b" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend verticalAlign="top" height={32} iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
                
                <Bar dataKey="load" name="Charge Quotidienne" fill="rgba(255,255,255,0.15)" radius={[2, 2, 0, 0]} maxBarSize={16} />
                <Line type="monotone" dataKey="ema3" name="EMA 3j (Fatigue Aiguë)" stroke="#ef4444" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                <Line type="monotone" dataKey="ema7" name="EMA 7j (Charge Récente)" stroke="#f59e0b" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                <Line type="monotone" dataKey="ema21" name="EMA 21j (Capacité Chronique)" stroke="#38bdf8" strokeWidth={2} strokeDasharray="4 4" dot={false} activeDot={{ r: 4 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* TABLEAU RÉCAPITULATIF DE TOUTES LES QUALITÉS (VALEURS EMA & FLÈCHES DE TENDANCE AVEC MAGNITUDE) */}
          <div className="bg-black/30 border border-white/10 rounded-xl overflow-hidden mt-1">
            <div className="p-3 border-b border-white/10 flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Activity size={14} className="text-blue-400" />
                Tableau Comparatif : Valeurs EMA & Flèches de Tendance ({qualities.length} Qualités)
              </h4>
              <span className="text-[11px] text-slate-400 font-mono">
                Magnitudes calculées par rapport à la {trendBasis === 'daily' ? 'veille (J-1)' : trendBasis === 'week' ? 'semaine passée (J-7)' : 'période précédente (J-3/7/21)'}
              </span>
            </div>

            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-white/[0.02] text-[10px] uppercase text-slate-400 border-b border-white/5 font-semibold">
                    <th className="p-2.5 pl-3">Rang & Qualité</th>
                    <th className="p-2.5 text-center">EMA 3j (Aiguë)</th>
                    <th className="p-2.5 text-center">EMA 7j (Récente)</th>
                    <th className="p-2.5 text-center">EMA 21j (Chronique)</th>
                    <th className="p-2.5 text-center">ACWR</th>
                    <th className="p-2.5 pr-3 text-right">Tendance Globale & Magnitude</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredQualities.map((q, idx) => {
                    const qInfo = qualitiesEMA[q.id]?.current || { 
                      ema3: 0, ema7: 0, ema21: 0, acwr: 1, 
                      prevEma3: 0, prevEma7: 0, prevEma21: 0,
                      prevPeriodEma3: 0, prevPeriodEma7: 0, prevPeriodEma21: 0,
                      prevWeekEma3: 0, prevWeekEma7: 0, prevWeekEma21: 0,
                      delta3: 0, delta7: 0, delta21: 0, 
                      periodDelta3: 0, periodDelta7: 0, periodDelta21: 0,
                      weekDelta3: 0, weekDelta7: 0, weekDelta21: 0,
                      percent3: 0, percent7: 0, percent21: 0,
                      periodPercent3: 0, periodPercent7: 0, periodPercent21: 0,
                      weekPercent3: 0, weekPercent7: 0, weekPercent21: 0
                    };
                    const isSelected = q.id === selectedQualityId;

                    const rowD3 = trendBasis === 'daily' ? (qInfo.delta3 ?? 0) : trendBasis === 'week' ? (qInfo.weekDelta3 ?? 0) : (qInfo.periodDelta3 ?? 0);
                    const rowP3 = trendBasis === 'daily' ? (qInfo.percent3 ?? 0) : trendBasis === 'week' ? (qInfo.weekPercent3 ?? 0) : (qInfo.periodPercent3 ?? 0);
                    const rowPrev3 = trendBasis === 'daily' ? (qInfo.prevEma3 ?? 0) : trendBasis === 'week' ? (qInfo.prevWeekEma3 ?? 0) : (qInfo.prevPeriodEma3 ?? 0);

                    const rowD7 = trendBasis === 'daily' ? (qInfo.delta7 ?? 0) : trendBasis === 'week' ? (qInfo.weekDelta7 ?? 0) : (qInfo.periodDelta7 ?? 0);
                    const rowP7 = trendBasis === 'daily' ? (qInfo.percent7 ?? 0) : trendBasis === 'week' ? (qInfo.weekPercent7 ?? 0) : (qInfo.periodPercent7 ?? 0);
                    const rowPrev7 = trendBasis === 'daily' ? (qInfo.prevEma7 ?? 0) : trendBasis === 'week' ? (qInfo.prevWeekEma7 ?? 0) : (qInfo.prevPeriodEma7 ?? 0);

                    const rowD21 = trendBasis === 'daily' ? (qInfo.delta21 ?? 0) : trendBasis === 'week' ? (qInfo.weekDelta21 ?? 0) : (qInfo.periodDelta21 ?? 0);
                    const rowP21 = trendBasis === 'daily' ? (qInfo.percent21 ?? 0) : trendBasis === 'week' ? (qInfo.weekPercent21 ?? 0) : (qInfo.periodPercent21 ?? 0);
                    const rowPrev21 = trendBasis === 'daily' ? (qInfo.prevEma21 ?? 0) : trendBasis === 'week' ? (qInfo.prevWeekEma21 ?? 0) : (qInfo.prevPeriodEma21 ?? 0);

                    // Synthèse globale de progression / déclin
                    const isOverallUp = rowD3 > 0.05 || rowD7 > 0.05;
                    const isOverallDown = rowD3 < -0.05 && rowD7 < -0.05;
                    const maxMag = Math.max(Math.abs(rowP3), Math.abs(rowP7));

                    return (
                      <tr 
                        key={q.id}
                        onClick={() => setSelectedQualityId(q.id)}
                        className={`transition-colors cursor-pointer ${
                          isSelected 
                            ? 'bg-blue-500/10 font-medium' 
                            : 'hover:bg-white/[0.03]'
                        }`}
                      >
                        {/* Qualité */}
                        <td className="p-2.5 pl-3">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono font-bold text-slate-500">
                              #{idx + 1}
                            </span>
                            <span className={`font-semibold ${isSelected ? 'text-blue-300' : 'text-slate-200'}`}>
                              {q.name}
                            </span>
                          </div>
                        </td>

                        {/* EMA 3j + Flèche & Magnitude côte à côte */}
                        <td className="p-2.5 text-center">
                          <div className="flex items-center justify-center gap-1.5 font-mono">
                            <span className="font-bold text-slate-100">{qInfo.ema3}</span>
                            {renderTrendIndicator(rowD3, rowP3, rowPrev3, qInfo.ema3, 'compact', 'EMA 3j')}
                          </div>
                        </td>

                        {/* EMA 7j + Flèche & Magnitude côte à côte */}
                        <td className="p-2.5 text-center">
                          <div className="flex items-center justify-center gap-1.5 font-mono">
                            <span className="font-bold text-slate-100">{qInfo.ema7}</span>
                            {renderTrendIndicator(rowD7, rowP7, rowPrev7, qInfo.ema7, 'compact', 'EMA 7j')}
                          </div>
                        </td>

                        {/* EMA 21j + Flèche & Magnitude côte à côte */}
                        <td className="p-2.5 text-center">
                          <div className="flex items-center justify-center gap-1.5 font-mono">
                            <span className="font-bold text-slate-100">{qInfo.ema21}</span>
                            {renderTrendIndicator(rowD21, rowP21, rowPrev21, qInfo.ema21, 'compact', 'EMA 21j')}
                          </div>
                        </td>

                        {/* ACWR */}
                        <td className="p-2.5 text-center">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono border ${
                            qInfo.acwr > 1.5 
                              ? 'bg-red-500/20 text-red-400 border-red-500/30'
                              : qInfo.acwr > 1.3
                              ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                              : qInfo.acwr >= 0.8
                              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                              : 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                          }`}>
                            {qInfo.acwr}
                          </span>
                        </td>

                        {/* Tendance Globale & Magnitude */}
                        <td className="p-2.5 pr-3 text-right">
                          {isOverallUp ? (
                            <span className="text-[10px] font-bold text-emerald-400 inline-flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20">
                              <ArrowUp size={11} className="stroke-[3]" />
                              <span>Progression</span>
                              <span className="text-[9px] opacity-80 font-mono">
                                ({maxMag >= 25 ? 'Forte' : maxMag >= 10 ? 'Modérée' : 'Légère'})
                              </span>
                            </span>
                          ) : isOverallDown ? (
                            <span className="text-[10px] font-bold text-red-400 inline-flex items-center gap-1 bg-red-500/10 px-2 py-0.5 rounded-lg border border-red-500/20">
                              <ArrowDown size={11} className="stroke-[3]" />
                              <span>Déclin</span>
                              <span className="text-[9px] opacity-80 font-mono">
                                ({maxMag >= 25 ? 'Fort' : maxMag >= 10 ? 'Modéré' : 'Léger'})
                              </span>
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-500 font-mono inline-flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded-lg border border-white/5">
                              <Minus size={9} />
                              <span>Stable</span>
                            </span>
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
  );
}
