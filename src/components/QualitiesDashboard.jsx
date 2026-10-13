import React, { useState, useMemo, memo } from 'react';
import { 
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { 
  AlertTriangle, Activity, Minus, ArrowUp, ArrowDown, Info, 
  Gauge, CheckCircle2, Search, X, Layers, BarChart3, Clock,
  Zap
} from 'lucide-react';
import { getLocalYYYYMMDD } from '../utils/dateHelpers';
import { computeCellState, extractSessionLoad } from '../utils/physiology';
import { isPrimary } from '../utils/loadHelpers';

function MiniSparkline({ data = [], color = '#38bdf8', height = 24, width = 76 }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const points = data.map((val, idx) => {
    const x = (idx / (data.length - 1)) * width;
    const y = height - ((val - min) / range) * (height - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  return (
    <svg width={width} height={height} className="shrink-0 overflow-visible opacity-75 hover:opacity-100 transition-opacity">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

/**
 * Mini-jauge circulaire de rémanence restante (SVG haute précision)
 */
function CircularRemanenceGauge({ percent = 0, size = 42, strokeWidth = 3.5, color = '#10b981' }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedPercent = Math.max(0, Math.min(100, percent));
  const offset = circumference - (clampedPercent / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255, 255, 255, 0.1)"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          fill="transparent"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[10px] font-black font-mono text-white">
          {clampedPercent}%
        </span>
      </div>
    </div>
  );
}

const CustomTooltip = memo(function CustomTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    const dataItem = payload[0]?.payload;
    return (
      <div className="bg-[#121216]/95 backdrop-blur-md p-3 border border-white/10 rounded-xl shadow-[0_4px_15px_rgba(0,0,0,0.5)] max-w-xs pointer-events-none select-none">
        <div className="flex items-center justify-between gap-3 mb-2 pb-1 border-b border-white/10">
          <span className="font-bold text-slate-100 uppercase text-[10px] tracking-wider font-mono">
            {dataItem?.dateStr || `Jour ${label}`}
          </span>
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
});

export default function QualitiesDashboard({
  events = {},
  qualities = [],
  qualitiesEMA = {},
  trainingBlocks = []
}) {
  const [selectedQualityId, setSelectedQualityId] = useState(qualities[0]?.id || 'vo2max');
  const [selectedCategory, setSelectedCategory] = useState('all'); // 'all' | 'cardio' | 'force' | 'specific' | 'active'
  const [hideZeroOnly, setHideZeroOnly] = useState(false);
  const [trendBasis, setTrendBasis] = useState('period'); // 'period' | 'daily' | 'week'
  const [qualitySearch, setQualitySearch] = useState('');
  const [remanenceFilter, setRemanenceFilter] = useState('all'); // 'all' | 'urgent' | 'recall' | 'optimal'

  const filteredQualities = useMemo(() => {
    let list = qualities;
    if (hideZeroOnly || selectedCategory === 'active') {
      list = list.filter(q => {
        const qEma = qualitiesEMA[q.id]?.current;
        return (qEma?.ema3 ?? 0) > 0 || (qEma?.ema7 ?? 0) > 0 || (qEma?.ema21 ?? 0) > 0;
      });
    }

    if (selectedCategory === 'cardio') {
      list = list.filter(q => ['vo2max', 'seuil', 'ef', 'co2', 'gut'].includes(q.id.toLowerCase()) || q.name.toLowerCase().includes('cardio') || q.name.toLowerCase().includes('endurance') || q.name.toLowerCase().includes('seuil') || q.name.toLowerCase().includes('vo2'));
    } else if (selectedCategory === 'force') {
      list = list.filter(q => ['pull', 'push', 'leg', 'abdos', 'descente'].includes(q.id.toLowerCase()) || q.name.toLowerCase().includes('force') || q.name.toLowerCase().includes('muscu'));
    } else if (selectedCategory === 'specific') {
      list = list.filter(q => ['sprint', 'plyo', 'proprio'].includes(q.id.toLowerCase()) || q.name.toLowerCase().includes('vitesse') || q.name.toLowerCase().includes('technique'));
    }

    if (!qualitySearch.trim()) return list;
    const query = qualitySearch.toLowerCase().trim();
    return list.filter(q => q.name.toLowerCase().includes(query) || q.id.toLowerCase().includes(query));
  }, [qualities, qualitySearch, selectedCategory, hideZeroOnly, qualitiesEMA]);

  const activeQualitiesCount = useMemo(() => {
    return qualities.filter(q => {
      const qEma = qualitiesEMA[q.id]?.current;
      return (qEma?.ema3 ?? 0) > 0 || (qEma?.ema7 ?? 0) > 0 || (qEma?.ema21 ?? 0) > 0;
    }).length;
  }, [qualities, qualitiesEMA]);

  // Ruban de rémanence immédiat unifié
  const remanenceStatusList = useMemo(() => {
    const today = new Date();
    const todayStr = getLocalYYYYMMDD(today);

    return qualities.map((q, index) => {
      const rank = index + 1;
      const qEvents = events[q.id] || {};
      const dates = Object.keys(qEvents)
        .filter(d => d <= todayStr && qEvents[d] && isPrimary(qEvents[d]) && extractSessionLoad(qEvents[d]) > 0)
        .sort();

      let lastDate = null;
      let daysSince = null;
      let lastSession = null;

      if (dates.length > 0) {
        lastDate = dates[dates.length - 1];
        lastSession = qEvents[lastDate];
        const diffMs = today.getTime() - new Date(lastDate).getTime();
        daysSince = Math.max(0, Math.floor(diffMs / (1000 * 3600 * 24)));
      }

      const cellState = computeCellState(q, todayStr, qEvents, 7, trainingBlocks || []);
      const remainingPercent = cellState.physio.currentLevel;

      const plateauDays = q.g || 4;
      const declineDays = q.o || 3;
      const totalRemanenceWindow = plateauDays + declineDays;

      let statusKey = 'decondition';
      let statusLabel = 'Rappel requis';
      let statusColor = 'text-rose-400';
      let statusBg = 'bg-rose-500/20 text-rose-300 border-rose-500/30';
      let statusIcon = AlertTriangle;
      let actionAdvice = 'Fenêtre dépassée : séance à programmer';

      if (daysSince === null) {
        statusKey = 'uninitialized';
        statusLabel = 'Non initialisée';
        statusColor = 'text-slate-400';
        statusBg = 'bg-white/5 text-slate-400 border-white/10';
        statusIcon = Clock;
        actionAdvice = 'À programmer selon vos objectifs';
      } else if (cellState.physio.status === 'green') {
        statusKey = 'optimal';
        statusLabel = daysSince === 0 ? "Travaillée aujourd'hui" : `En plateau (J+${daysSince})`;
        statusColor = 'text-emerald-400';
        statusBg = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
        statusIcon = CheckCircle2;
        const daysToRecall = Math.ceil(cellState.physio.daysLeft);
        actionAdvice = daysSince === 0 
          ? 'Assimilation en cours (J+0)' 
          : (daysToRecall <= 1 ? 'Fin de plateau : rappel demain' : `Acquis protégés encore ${daysToRecall}j`);
      } else if (cellState.physio.status === 'orange') {
        statusKey = 'recall';
        statusLabel = `Fenêtre de rappel (J+${daysSince})`;
        statusColor = 'text-amber-400';
        statusBg = 'bg-amber-500/20 text-amber-300 border-amber-500/30';
        statusIcon = Zap;
        const daysLeft = Math.ceil(cellState.physio.daysLeft);
        actionAdvice = `Rappel idéal sous ${daysLeft}j`;
      } else {
        statusKey = 'decondition';
        statusLabel = `Rappel requis (J+${daysSince})`;
        statusColor = 'text-rose-400';
        statusBg = 'bg-rose-500/20 text-rose-300 border-rose-500/30';
        statusIcon = AlertTriangle;
        actionAdvice = 'Fenêtre dépassée : séance à programmer';
      }

      const qEma = qualitiesEMA[q.id]?.current;
      const ema3 = qEma?.ema3 ?? 0;
      const ema7 = qEma?.ema7 ?? 0;
      const ema21 = qEma?.ema21 ?? 0;

      return {
        quality: q,
        rank,
        daysSince,
        lastDate,
        lastSession,
        plateauDays,
        declineDays,
        totalRemanenceWindow,
        remainingPercent,
        statusKey,
        statusLabel,
        statusColor,
        statusBg,
        statusIcon,
        actionAdvice,
        ema3,
        ema7,
        ema21,
        cellState
      };
    });
  }, [qualities, events, qualitiesEMA, trainingBlocks]);

  const urgentCount = useMemo(() => {
    return remanenceStatusList.filter(item => item.statusKey === 'decondition' || item.statusKey === 'decline').length;
  }, [remanenceStatusList]);

  const recallCount = useMemo(() => {
    return remanenceStatusList.filter(item => item.statusKey === 'recall').length;
  }, [remanenceStatusList]);

  const optimalCount = useMemo(() => {
    return remanenceStatusList.filter(item => item.statusKey === 'optimal').length;
  }, [remanenceStatusList]);

  const filteredRemanenceList = useMemo(() => {
    if (remanenceFilter === 'urgent') {
      return remanenceStatusList.filter(item => item.statusKey === 'decondition' || item.statusKey === 'decline');
    }
    if (remanenceFilter === 'recall') {
      return remanenceStatusList.filter(item => item.statusKey === 'recall');
    }
    if (remanenceFilter === 'optimal') {
      return remanenceStatusList.filter(item => item.statusKey === 'optimal');
    }
    return remanenceStatusList;
  }, [remanenceStatusList, remanenceFilter]);

  // Données de la qualité sélectionnée pour le graphique
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

  const hasQualityData = useMemo(() => {
    const series = activeQualityData?.series || [];
    if (!series || series.length === 0) return false;
    return series.some(d => (
      (Number(d.load) || 0) > 0 || 
      (Number(d.ema3) || 0) > 0.05 || 
      (Number(d.ema7) || 0) > 0.05 || 
      (Number(d.ema21) || 0) > 0.05
    ));
  }, [activeQualityData?.series]);

  const sparklineSeries = useMemo(() => {
    const series = activeQualityData.series || [];
    const recent = series.slice(-10);
    return {
      ema3: recent.map(d => d.ema3 || 0),
      ema7: recent.map(d => d.ema7 || 0),
      ema21: recent.map(d => d.ema21 || 0)
    };
  }, [activeQualityData.series]);

  const getTrendMagnitudeInfo = (delta, percent) => {
    const absD = Math.abs(delta);
    const absP = Math.abs(percent);

    const isUp = delta > 0.05;
    const isDown = delta < -0.05;

    let level = 0;
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

  const renderTrendIndicator = (delta, percent, prevVal, currentVal, mode = 'compact') => {
    const { isUp, isDown, level, label } = getTrendMagnitudeInfo(delta, percent);

    const periodRefName = 
      trendBasis === 'daily' ? 'jour précédent (J-1)' :
      trendBasis === 'week' ? 'semaine précédente (J-7)' :
      'période précédente';

    const tooltipText = isUp || isDown
      ? `${label} (${delta > 0 ? '+' : ''}${delta} | ${percent > 0 ? '+' : ''}${percent}%)\nPrécédente : ${prevVal} → Actuelle : ${currentVal} (${periodRefName})`
      : `Tendance stable (${delta} / 0%)\nPrécédente : ${prevVal} → Actuelle : ${currentVal} (${periodRefName})`;

    if (mode === 'card') {
      if (isUp) {
        return (
          <div className="inline-flex items-center gap-1.5" title={tooltipText}>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.15)]">
              <ArrowUp size={13} className="stroke-[3] text-emerald-400 shrink-0" />
              <span>+{delta}</span>
              <span className="text-[10px] opacity-80">({percent > 0 ? `+${percent}%` : `${percent}%`})</span>
            </span>
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

    // Mode compact pour les cellules du tableau
    if (isUp) {
      return (
        <span 
          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 whitespace-nowrap cursor-help hover:bg-emerald-500/25 transition-colors"
          title={tooltipText}
        >
          <ArrowUp size={11} className="stroke-[3] text-emerald-400 shrink-0" />
          <span>+{delta}</span>
          <span className="text-[9px] opacity-75 font-mono">({percent > 0 ? `+${percent}%` : `${percent}%`})</span>
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

  return (
    <section 
      aria-label="Tableau de bord des qualités d'entraînement et rémanence EMA" 
      className="p-4 md:p-6 w-full flex flex-col gap-6 pb-12"
    >
      {/* RUBAN DE STATUT DE RÉMANENCE IMMÉDIAT (« QUICK STATUS BAR ») */}
      <section 
        aria-labelledby="heading-remanence-bar"
        className="p-4 sm:p-5 rounded-2xl bg-slate-900/60 border border-white/10 space-y-3.5 shadow-xl"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30" aria-hidden="true">
                <Layers size={16} />
              </div>
              <h4 id="heading-remanence-bar" className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider m-0">
                Ruban de Statut de Rémanence Immédiat
              </h4>
              <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-bold border border-blue-500/30">
                {qualities.length} Filières
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1 mb-0">
              Surveillance en direct de l'effet résiduel, des paliers de stabilisation et des urgences de rappel
            </p>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap" role="toolbar" aria-label="Filtres de statut de rémanence">
            <button
              type="button"
              onClick={() => setRemanenceFilter('all')}
              className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                remanenceFilter === 'all'
                  ? 'bg-blue-600 text-white border-blue-400 shadow-sm font-bold'
                  : 'bg-white/5 text-slate-200 hover:text-white border-white/10'
              }`}
            >
              Toutes ({remanenceStatusList.length})
            </button>

            <button
              type="button"
              onClick={() => setRemanenceFilter('urgent')}
              className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer border flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 ${
                remanenceFilter === 'urgent'
                  ? 'bg-rose-600 text-white border-rose-400 shadow-sm font-bold'
                  : 'bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 border-rose-500/30'
              }`}
            >
              <span>🚨 Déclin & Urgence</span>
              <span className="px-1.5 py-0.5 rounded-full text-xs font-mono bg-black/40 font-bold">
                {urgentCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setRemanenceFilter('recall')}
              className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer border flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                remanenceFilter === 'recall'
                  ? 'bg-amber-600 text-white border-amber-400 shadow-sm font-bold'
                  : 'bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 border-amber-500/30'
              }`}
            >
              <span>⚡ Rappel (24-48h)</span>
              <span className="px-1.5 py-0.5 rounded-full text-xs font-mono bg-black/40 font-bold">
                {recallCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setRemanenceFilter('optimal')}
              className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer border flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                remanenceFilter === 'optimal'
                  ? 'bg-emerald-600 text-white border-emerald-400 shadow-sm font-bold'
                  : 'bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 border-emerald-500/30'
              }`}
            >
              <span>✅ Optimal</span>
              <span className="px-1.5 py-0.5 rounded-full text-xs font-mono bg-black/40 font-bold">
                {optimalCount}
              </span>
            </button>
          </div>
        </div>

        {/* Grille des cartes de statut de rémanence */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 max-h-[380px] overflow-y-auto custom-scrollbar pr-1">
          {filteredRemanenceList.map((item) => {
            const isSelected = item.quality.id === selectedQualityId;
            const IconComponent = item.statusIcon;
            const gaugeColor = 
              item.statusKey === 'optimal' ? '#10b981' :
              item.statusKey === 'recall' ? '#f59e0b' :
              item.statusKey === 'decline' ? '#f97316' :
              item.statusKey === 'decondition' ? '#ef4444' : '#64748b';

            return (
              <div
                key={item.quality.id}
                role="button"
                tabIndex={0}
                aria-pressed={isSelected}
                aria-label={`Filière ${item.quality.name}, statut : ${item.statusLabel}, rémanence : ${item.remainingPercent}%`}
                onClick={() => setSelectedQualityId(item.quality.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedQualityId(item.quality.id);
                  }
                }}
                className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                  isSelected
                    ? 'bg-blue-600/15 border-blue-500/60 shadow-lg shadow-blue-500/10'
                    : 'bg-black/30 hover:bg-white/[0.04] border-white/5'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="truncate">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono text-slate-500">#{item.rank}</span>
                      <span className={`text-xs font-bold truncate ${isSelected ? 'text-blue-300' : 'text-white'}`}>
                        {item.quality.name}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                      Plateau {item.plateauDays}j · Fenêtre {item.totalRemanenceWindow}j
                    </span>
                  </div>

                  <CircularRemanenceGauge 
                    percent={item.remainingPercent} 
                    color={gaugeColor} 
                    size={40} 
                    strokeWidth={3.5} 
                  />
                </div>

                <div className="mb-2">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold border ${item.statusBg}`}>
                    <IconComponent size={11} className="shrink-0" aria-hidden="true" />
                    <span className="truncate">{item.statusLabel}</span>
                  </span>
                </div>

                <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs font-mono text-slate-300">
                  <span>
                    {item.daysSince === null ? 'Jamais' : item.daysSince === 0 ? 'Aujourd\'hui' : `J-${item.daysSince}`}
                  </span>
                  <span className={`font-semibold ${
                    item.statusKey === 'optimal' ? 'text-emerald-400' :
                    item.statusKey === 'recall' ? 'text-amber-400 font-bold' :
                    item.statusKey === 'decline' ? 'text-orange-400 font-bold' :
                    'text-rose-400 font-bold'
                  }`}>
                    {item.actionAdvice}
                  </span>
                </div>
              </div>
            );
          })}

          {filteredRemanenceList.length === 0 && (
            <div className="w-full py-4 text-center text-xs text-slate-300 bg-white/[0.02] rounded-xl border border-white/5 col-span-full">
              Aucune qualité ne correspond à ce filtre de rémanence.
            </div>
          )}
        </div>
      </section>

      {/* FOCUS FILIÈRE INDIVIDUELLE */}
      <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-4 sm:p-5 flex flex-col gap-4 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Filière Active :</span>
              <span className="text-base sm:text-lg font-black font-mono text-blue-400 bg-blue-500/10 px-3 py-1 rounded-xl border border-blue-500/25">
                {activeQualityData.qDef?.name || selectedQualityId}
              </span>
            </div>

            <div className="flex items-center gap-1.5 bg-black/40 p-1.5 rounded-xl border border-white/10" role="radiogroup" aria-label="Base de comparaison temporelle">
              <span className="text-slate-300 px-1 text-xs font-semibold flex items-center gap-1">
                <Gauge size={13} className="text-blue-400" aria-hidden="true" />
                vs :
              </span>
              <button
                type="button"
                role="radio"
                aria-checked={trendBasis === 'period'}
                onClick={() => setTrendBasis('period')}
                className={`px-3 py-2 min-h-[44px] rounded-lg text-xs font-semibold transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                  trendBasis === 'period'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                    : 'text-slate-300 hover:text-white'
                }`}
                title="Comparer par rapport à la période caractéristique de chaque constante (J-3 pour 3j, J-7 pour 7j, J-21 pour 21j)"
              >
                Période (3/7/21j)
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={trendBasis === 'daily'}
                onClick={() => setTrendBasis('daily')}
                className={`px-3 py-2 min-h-[44px] rounded-lg text-xs font-semibold transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                  trendBasis === 'daily'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                    : 'text-slate-300 hover:text-white'
                }`}
                title="Comparer par rapport à la veille (J-1)"
              >
                Hier (J-1)
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={trendBasis === 'week'}
                onClick={() => setTrendBasis('week')}
                className={`px-3 py-2 min-h-[44px] rounded-lg text-xs font-semibold transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                  trendBasis === 'week'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                    : 'text-slate-300 hover:text-white'
                }`}
                title="Comparer par rapport à la semaine passée (J-7)"
              >
                Semaine (J-7)
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setHideZeroOnly(!hideZeroOnly)}
              className={`flex items-center gap-1.5 px-3.5 py-2 min-h-[44px] rounded-xl text-xs font-semibold transition-all cursor-pointer border focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                hideZeroOnly
                  ? 'bg-amber-500/20 text-amber-200 border-amber-500/40 shadow-sm font-bold'
                  : 'bg-white/5 text-slate-200 hover:text-white hover:bg-white/10 border-white/10'
              }`}
              title="Masquer les qualités dont les valeurs EMA sont toutes à zéro"
            >
              <span>🔥 Actives uniquement</span>
              <span className={`text-xs font-mono px-2 py-0.5 rounded-full ${hideZeroOnly ? 'bg-amber-400/25 text-amber-100 font-bold' : 'bg-white/10 text-slate-200'}`}>
                {activeQualitiesCount}/{qualities.length}
              </span>
            </button>
          </div>

          <div className="relative flex items-center min-w-[200px] sm:w-64" role="search">
            <label htmlFor="quality-search-field" className="sr-only">
              Rechercher une qualité physique
            </label>
            <Search size={15} className="absolute left-3 text-slate-400 pointer-events-none" aria-hidden="true" />
            <input
              id="quality-search-field"
              type="search"
              value={qualitySearch}
              onChange={(e) => setQualitySearch(e.target.value)}
              placeholder="Rechercher une qualité (VO2, seuil...)"
              className="w-full min-h-[44px] pl-9 pr-9 py-2 text-xs bg-slate-950/70 border border-white/15 rounded-xl text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-slate-900 transition-all shadow-inner"
            />
            {qualitySearch && (
              <button
                type="button"
                aria-label="Effacer la recherche de qualité"
                onClick={() => setQualitySearch('')}
                className="absolute right-2.5 text-slate-400 hover:text-white p-1 rounded-md cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                title="Effacer la recherche"
              >
                <X size={15} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        {/* Puces de sélection de la filière active */}
        <div className="flex flex-wrap gap-2 pt-0.5" role="toolbar" aria-label="Sélection rapide de la filière active">
          {filteredQualities.map(q => {
            const isSelected = q.id === selectedQualityId;
            const qEma = qualitiesEMA[q.id]?.current;
            const val3 = qEma?.ema3 ?? 0;

            return (
              <button
                key={q.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => setSelectedQualityId(q.id)}
                className={`group min-h-[44px] px-3.5 py-2 rounded-xl text-xs transition-all border cursor-pointer flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                  isSelected 
                    ? 'bg-blue-600 text-white border-blue-400 shadow-md shadow-blue-600/25 font-bold' 
                    : 'bg-white/5 hover:bg-white/10 text-slate-200 border-white/10 hover:border-white/20'
                }`}
              >
                <span>{q.name}</span>
                {val3 > 0 && (
                  <span className={`text-xs font-mono px-2 py-0.5 rounded font-bold ${
                    isSelected ? 'bg-black/30 text-blue-100' : 'bg-blue-500/20 text-blue-300'
                  }`}>
                    {val3}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* CARTES KPI EMA DE LA FILIÈRE ACTIVE */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* EMA 3j */}
          <article className="p-3.5 rounded-xl bg-slate-900/80 border border-sky-500/30 flex flex-col justify-between shadow-lg">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-sky-300 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-sky-400" /> EMA 3 Jours (Aiguë)
              </span>
              <MiniSparkline data={sparklineSeries.ema3} color="#38bdf8" />
            </div>
            <div className="flex items-baseline justify-between my-1">
              <span className="text-3xl font-black font-mono text-white">{curr.ema3}</span>
              {renderTrendIndicator(d3, p3, prevVal3, curr.ema3, 'card')}
            </div>
            <div className="pt-2 border-t border-white/5 text-xs text-slate-300 flex items-center justify-between">
              <span>Rappel court terme</span>
              <span className="font-mono text-slate-400">vs {periodLabel3}</span>
            </div>
          </article>

          {/* EMA 7j */}
          <article className="p-3.5 rounded-xl bg-slate-900/80 border border-blue-500/30 flex flex-col justify-between shadow-lg">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-blue-300 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-500" /> EMA 7 Jours (Récente)
              </span>
              <MiniSparkline data={sparklineSeries.ema7} color="#3b82f6" />
            </div>
            <div className="flex items-baseline justify-between my-1">
              <span className="text-3xl font-black font-mono text-white">{curr.ema7}</span>
              {renderTrendIndicator(d7, p7, prevVal7, curr.ema7, 'card')}
            </div>
            <div className="pt-2 border-t border-white/5 text-xs text-slate-300 flex items-center justify-between">
              <span>Charge hebdomadaire</span>
              <span className="font-mono text-slate-400">vs {periodLabel7}</span>
            </div>
          </article>

          {/* EMA 21j */}
          <article className="p-3.5 rounded-xl bg-slate-900/80 border border-indigo-500/30 flex flex-col justify-between shadow-lg">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-400" /> EMA 21 Jours (Fond)
              </span>
              <MiniSparkline data={sparklineSeries.ema21} color="#818cf8" />
            </div>
            <div className="flex items-baseline justify-between my-1">
              <span className="text-3xl font-black font-mono text-white">{curr.ema21}</span>
              {renderTrendIndicator(d21, p21, prevVal21, curr.ema21, 'card')}
            </div>
            <div className="pt-2 border-t border-white/5 text-xs text-slate-300 flex items-center justify-between">
              <span>Effet résiduel durable</span>
              <span className="font-mono text-slate-400">vs {periodLabel21}</span>
            </div>
          </article>

          {/* ACWR */}
          <article className="p-3.5 rounded-xl bg-slate-900/80 border border-white/10 flex flex-col justify-between shadow-lg">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Activity size={12} className="text-emerald-400" /> ACWR Spécifique
              </span>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                curr.acwr > 1.5 ? 'bg-red-500/20 text-red-300 border-red-500/40' :
                curr.acwr >= 1.3 ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' :
                curr.acwr >= 0.8 ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' :
                'bg-sky-500/20 text-sky-300 border-sky-500/30'
              }`}>
                {curr.acwr > 1.5 ? 'Alerte Surcharge' : curr.acwr >= 0.8 && curr.acwr <= 1.3 ? 'Sweet Spot' : 'Récupération'}
              </span>
            </div>
            <div className="flex items-baseline justify-between my-1">
              <span className="text-3xl font-black font-mono text-white">{curr.acwr !== null ? curr.acwr : '—'}</span>
              <span className="text-xs text-slate-300 font-mono">
                Zone d'équilibre : 0.8 - 1.3x
              </span>
            </div>
            <div className="pt-2 border-t border-white/5 text-xs text-slate-300 flex items-center justify-between">
              <span>Ratio Aigu / Chronique</span>
              <span className="text-slate-200 font-semibold">{curr.acwr !== null && curr.acwr >= 0.8 && curr.acwr <= 1.3 ? 'Équilibré' : 'Surveillance'}</span>
            </div>
          </article>
        </div>

        {/* ZONE GRAPHIQUE OU ÉTAT VIDE NEUTRE */}
        {!hasQualityData ? (
          <div className="h-[250px] w-full flex flex-col items-center justify-center p-6 rounded-2xl bg-black/40 border border-dashed border-white/15 text-center shadow-inner my-1">
            <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-400 mb-2.5 border border-blue-500/20 shadow-md shadow-blue-500/10">
              <BarChart3 size={24} className="opacity-90" />
            </div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono bg-white/5 text-slate-300 border border-white/10 mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              Aucune donnée enregistrée
            </div>
            <h5 className="text-sm sm:text-base font-bold text-white m-0 tracking-tight">
              Aucune séance pour « {activeQualityData.qDef?.name || selectedQualityId} » sur la période
            </h5>
            <p className="text-xs text-[#94A3B8] max-w-lg mt-1.5 mb-0 leading-relaxed">
              Les valeurs de charge et les dynamiques de rémanence EMA (3j, 7j, 21j) sont actuellement à zéro. Dès qu'une séance sera renseignée dans la grille de planification, la trajectoire physiologique s'affichera ici automatiquement.
            </p>
          </div>
        ) : (
          <div className="h-[250px] w-full min-h-[220px] relative">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={activeQualityData.series} margin={{ top: 5, right: 10, left: -25, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.2)" vertical={false} />
                <XAxis 
                  dataKey="dateStr" 
                  tickFormatter={(str) => {
                    if (!str) return '';
                    const parts = str.split('-');
                    if (parts.length < 3) return str;
                    return `${parts[2]}/${parts[1]}`;
                  }}
                  stroke="#64748b" 
                  tick={{ fontSize: 11, fill: '#f1f5f9', fontWeight: 600 }} 
                  tickLine={{ stroke: '#64748b', strokeWidth: 1.5 }} 
                  axisLine={{ stroke: '#64748b', strokeWidth: 1.5 }}
                  minTickGap={28}
                  dy={4}
                />
                <YAxis 
                  stroke="#64748b" 
                  tick={{ fontSize: 10, fill: '#cbd5e1', fontWeight: 500 }} 
                  tickLine={{ stroke: '#64748b' }} 
                  axisLine={{ stroke: '#64748b', strokeWidth: 1.2 }} 
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend verticalAlign="top" height={32} iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 600 }} />
                
                <Bar dataKey="load" name="Charge Quotidienne" fill="rgba(255,255,255,0.25)" radius={[3, 3, 0, 0]} maxBarSize={16} />
                <Line type="monotone" dataKey="ema3" name="EMA 3j (Court terme)" stroke="#38bdf8" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                <Line type="monotone" dataKey="ema7" name="EMA 7j (Moyen terme)" stroke="#3b82f6" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                <Line type="monotone" dataKey="ema21" name="EMA 21j (Fond durable)" stroke="#818cf8" strokeWidth={2} strokeDasharray="4 4" dot={false} activeDot={{ r: 4 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* TABLEAU RÉCAPITULATIF DE TOUTES LES QUALITÉS */}
        <section 
          aria-labelledby="heading-qualities-table"
          className="bg-black/30 border border-white/10 rounded-xl overflow-hidden mt-1"
        >
          <div className="p-3 border-b border-white/10 flex flex-wrap items-center justify-between gap-2">
            <h4 id="heading-qualities-table" className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2 m-0">
              <Activity size={14} className="text-blue-400" aria-hidden="true" />
              Tableau Comparatif : Valeurs EMA & Flèches de Tendance ({qualities.length} Qualités)
            </h4>
            <span className="text-xs text-slate-300 font-mono">
              Magnitudes calculées par rapport à la {trendBasis === 'daily' ? 'veille (J-1)' : trendBasis === 'week' ? 'semaine passée (J-7)' : 'période précédente (J-3/7/21)'}
            </span>
          </div>

          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-xs border-collapse">
              <caption className="sr-only">
                Tableau comparatif des dynamiques EMA 3j, 7j, 21j et ratio ACWR pour chaque qualité d'entraînement
              </caption>
              <thead>
                <tr className="bg-white/[0.04] text-xs uppercase text-slate-200 border-b border-white/10 font-semibold">
                  <th scope="col" className="p-2.5 pl-3">Rang & Qualité</th>
                  <th scope="col" className="p-2.5 text-center">EMA 3j (Aiguë)</th>
                  <th scope="col" className="p-2.5 text-center hidden sm:table-cell">EMA 7j (Récente)</th>
                  <th scope="col" className="p-2.5 text-center">EMA 21j (Chronique)</th>
                  <th scope="col" className="p-2.5 text-center">ACWR</th>
                  <th scope="col" className="p-2.5 pr-3 text-right">Tendance</th>
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

                  const isOverallUp = rowD3 > 0.05 || rowD7 > 0.05;
                  const isOverallDown = rowD3 < -0.05 && rowD7 < -0.05;
                  const maxMag = Math.max(Math.abs(rowP3), Math.abs(rowP7));

                  return (
                    <tr 
                      key={q.id}
                      role="button"
                      tabIndex={0}
                      aria-selected={isSelected}
                      aria-label={`Sélectionner la filière ${q.name}, EMA 3j : ${qInfo.ema3}, ACWR : ${qInfo.acwr}`}
                      onClick={() => setSelectedQualityId(q.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedQualityId(q.id);
                        }
                      }}
                      className={`transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                        isSelected 
                          ? 'bg-blue-500/15 font-medium' 
                          : 'hover:bg-white/[0.04]'
                      }`}
                    >
                      <td className="p-2.5 pl-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-slate-400">
                            #{idx + 1}
                          </span>
                          <span className={`font-semibold ${isSelected ? 'text-blue-300' : 'text-slate-200'}`}>
                            {q.name}
                          </span>
                        </div>
                      </td>

                      <td className="p-2.5 text-center">
                        <div className="flex items-center justify-center gap-1.5 font-mono">
                          <span className="font-bold text-slate-100">{qInfo.ema3}</span>
                          {renderTrendIndicator(rowD3, rowP3, rowPrev3, qInfo.ema3, 'compact')}
                        </div>
                      </td>

                      <td className="p-2.5 text-center hidden sm:table-cell">
                        <div className="flex items-center justify-center gap-1.5 font-mono">
                          <span className="font-bold text-slate-100">{qInfo.ema7}</span>
                          {renderTrendIndicator(rowD7, rowP7, rowPrev7, qInfo.ema7, 'compact')}
                        </div>
                      </td>

                      <td className="p-2.5 text-center">
                        <div className="flex items-center justify-center gap-1.5 font-mono">
                          <span className="font-bold text-slate-100">{qInfo.ema21}</span>
                          {renderTrendIndicator(rowD21, rowP21, rowPrev21, qInfo.ema21, 'compact')}
                        </div>
                      </td>

                      <td className="p-2.5 text-center">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold font-mono border ${
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

                      <td className="p-2.5 pr-3 text-right">
                        {isOverallUp ? (
                          <span className="text-xs font-bold text-emerald-400 inline-flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20">
                            <ArrowUp size={12} className="stroke-[3]" aria-hidden="true" />
                            <span>Progression</span>
                            <span className="text-xs opacity-80 font-mono hidden sm:inline">
                              ({maxMag >= 25 ? 'Forte' : maxMag >= 10 ? 'Modérée' : 'Légère'})
                            </span>
                          </span>
                        ) : isOverallDown ? (
                          <span className="text-xs font-bold text-red-400 inline-flex items-center gap-1 bg-red-500/10 px-2 py-0.5 rounded-lg border border-red-500/20">
                            <ArrowDown size={12} className="stroke-[3]" aria-hidden="true" />
                            <span>Déclin</span>
                            <span className="text-xs opacity-80 font-mono hidden sm:inline">
                              ({maxMag >= 25 ? 'Fort' : maxMag >= 10 ? 'Modéré' : 'Léger'})
                            </span>
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 font-mono inline-flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded-lg border border-white/5">
                            <Minus size={10} aria-hidden="true" />
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
        </section>

        {/* CADRE MÉTHODOLOGIQUE */}
        <details className="group p-4 rounded-2xl bg-slate-900/40 border border-white/10 text-slate-300 text-xs mt-6 cursor-pointer">
          <summary className="flex items-center justify-between font-bold text-slate-200 list-none select-none">
            <div className="flex items-center gap-2">
              <Info size={16} className="text-sky-400 shrink-0" aria-hidden="true" />
              <span>Cadre méthodologique & Indicateurs d'aide à la décision</span>
            </div>
            <span className="text-xs text-slate-400 font-mono group-open:rotate-180 transition-transform" aria-hidden="true">▼</span>
          </summary>
          <p className="text-xs leading-relaxed text-slate-300 mt-2.5 pt-2 border-t border-white/10 m-0">
            Les moyennes mobiles exponentielles (EMA 3j court terme, EMA 7j moyen terme, EMA 21j fond durable) et les ratios ACWR spécifiques permettent de piloter l'assimilation et d'anticiper le désentraînement (Mujika &amp; Padilla 2000, Issurin 2008). 
            Ces valeurs constituent des <strong>indicateurs d'aide à la décision d'entraînement</strong>. Fiez-vous toujours à vos sensations et consultez un professionnel de santé en cas de douleur persistante ou d'anomalie.
          </p>
        </details>
      </div>
    </section>
  );
}
