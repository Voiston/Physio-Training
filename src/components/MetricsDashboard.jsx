import { useState, useMemo, useEffect, memo } from 'react';
import { 
  AreaChart, Area, ComposedChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer, ReferenceLine 
} from 'recharts';
import { 
  AlertTriangle, TrendingUp, TrendingDown, Activity, Sparkles, 
  Minus, ArrowUp, ArrowDown, Info, Gauge, Trophy, FileText, 
  ShieldAlert, Play, CheckCircle2, Sliders, Heart, Dumbbell, Flame,
  Search, X, Layers, SlidersHorizontal, BarChart3, Calendar, Clock,
  Pin, RotateCcw, Zap, Filter, ChevronLeft, ChevronRight, Target, Table as TableIcon
} from 'lucide-react';
import { calculateEMA, calculateExpDecay } from '../utils/mathHelpers';
import { getLocalYYYYMMDD } from '../utils/dateHelpers';
import { 
  computeCardioVsMuscularBalance, 
  computeCellState, 
  extractSessionLoad,
  computeIntensityDistribution,
  computePerceivedFatigueAnalysis
} from '../utils/physiology';
import { getDailyAthleteLoad, isPrimary } from '../utils/loadHelpers';
import { getTsbZone, calculateTsbPercent } from '../utils/zones';
import { computeVfcAnalysis, computeHrRestAnalysis } from '../utils/vfcHelpers';

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

/**
 * Formate une date YYYY-MM-DD en français complet pour l'inspection de séance
 */
function formatFullInspectionDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const weekdays = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  const months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  return `${weekdays[dt.getDay()]} ${d} ${months[m - 1]} ${y}`;
}

/**
 * Interprétation dynamique en langage clair du bilan Banister / Coggan PMC
 */
function getDynamicBanisterInterpretation(dayData, tauFatigue = 7, tauFitness = 28, historyDays = 30, hasInitialCtl = false) {
  if (!dayData) return null;
  const { tsb = 0, loadEMA7 = 0, loadEMA21 = 0 } = dayData;
  const atl = loadEMA7;
  const ctl = loadEMA21;
  const acwr = ctl > 0 ? (atl / ctl).toFixed(2) : '1.0';

  const zone = getTsbZone(ctl, atl, historyDays, tauFitness, hasInitialCtl);
  const tsbPercent = calculateTsbPercent(ctl, atl);

  let zoneColor = 'text-slate-200';
  let zoneBadge = 'bg-slate-700/30 text-slate-300 border-slate-600';
  if (zone.color === 'rose') {
    zoneColor = 'text-rose-400';
    zoneBadge = 'bg-rose-500/20 text-rose-300 border-rose-500/30';
  } else if (zone.color === 'amber') {
    zoneColor = 'text-amber-400';
    zoneBadge = 'bg-amber-500/20 text-amber-300 border-amber-500/30';
  } else if (zone.color === 'emerald') {
    zoneColor = 'text-emerald-400';
    zoneBadge = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
  } else if (zone.color === 'sky') {
    zoneColor = 'text-sky-400';
    zoneBadge = 'bg-sky-500/20 text-sky-300 border-sky-500/30';
  }

  return { 
    zoneTitle: zone.title, 
    zoneColor, 
    zoneBadge, 
    summary: zone.summary, 
    prescription: zone.prescription, 
    acwr,
    tsbPercent 
  };
}

/**
 * Tooltip hautement optimisé à l'échelle du module :
 * Évite d'être recréé à chaque re-render de MetricsDashboard et supprime les saccades Recharts
 */
const CustomTooltip = memo(function CustomTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    const dataItem = payload[0]?.payload;
    const isFut = dataItem?.isFuture;
    const isTod = dataItem?.isToday;

    return (
      <div className="bg-[#121216]/95 backdrop-blur-md p-3 border border-white/10 rounded-xl shadow-[0_4px_15px_rgba(0,0,0,0.5)] max-w-xs pointer-events-none select-none">
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

        {/* Séances associées à cette date */}
        {dataItem?.sessions && dataItem.sessions.length > 0 && (
          <div className="mt-2 pt-2 border-t border-white/10">
            <span className="text-[10px] text-slate-400 font-semibold block mb-1">
              Séances du jour ({dataItem.sessions.length}) :
            </span>
            <div className="space-y-1">
              {dataItem.sessions.map((s, idx) => (
                <div key={idx} className="flex items-center justify-between gap-2 text-[10px] bg-white/5 px-1.5 py-0.5 rounded">
                  <span className="truncate max-w-[130px] font-medium text-slate-200">{s.qualityName}</span>
                  <span className="font-mono font-bold text-amber-300 shrink-0">{s.load} pts</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Biométrie du réveil */}
        {(dataItem?.vfc || dataItem?.hrRest || dataItem?.readiness) && (
          <div className="mt-2 pt-1.5 border-t border-white/10 flex items-center justify-between gap-2 text-[10px] font-mono">
            {dataItem.readiness && <span className="text-blue-300">Readiness : {dataItem.readiness}/10</span>}
            {dataItem.vfc && <span className="text-emerald-300">VFC : {dataItem.vfc} ms</span>}
            {dataItem.hrRest && <span className="text-rose-300">FC : {dataItem.hrRest} bpm</span>}
          </div>
        )}
      </div>
    );
  }
  return null;
});

export default function MetricsDashboard({ 
  events = {}, 
  dailyMetrics = {}, 
  qualities = [], 
  qualitiesEMA = {},
  fosterMetrics = null,
  banisterPerformance = null,
  taperingAnalysis = null,
  cardioMuscularBalance = null,
  intensityDistribution = null,
  perceivedFatigueAnalysis = null,
  isSimulationActive = false,
  physioSettings = null,
  trainingBlocks = [],
  viewMode = 'all', // 'all' | 'physiology' | 'qualities'
  onOpenCompetitionModal = null,
  onOpenReportModal = null,
  onOpenPhysioSettingsModal = null,
  onToggleSimulation = null
}) {
  const [selectedQualityId, setSelectedQualityId] = useState(qualities[0]?.id || 'vo2max');
  const [selectedCategory, setSelectedCategory] = useState('all'); // 'all' | 'cardio' | 'force' | 'specific' | 'active'
  const [hideZeroOnly, setHideZeroOnly] = useState(false);
  // 'period' = période caractéristique (J-3, J-7, J-21), 'daily' = hier (J-1), 'week' = semaine passée (J-7)
  const [trendBasis, setTrendBasis] = useState('period');
  const [qualitySearch, setQualitySearch] = useState('');
  const [activeTooltip, setActiveTooltip] = useState(null); // 'tsb' | 'atl' | 'ctl' | null
  const [banisterCurves, setBanisterCurves] = useState({ atl: true, ctl: true, tsb: true });
  const [vfcCurves, setVfcCurves] = useState({ vfc: true, ema3: true, ema7: true });

  // Nouveaux états d'interactivité : inspection d'un point Banister, affichage tableau accessible et filtre du ruban
  const [selectedBanisterDay, setSelectedBanisterDay] = useState(null);
  const [isDayPinned, setIsDayPinned] = useState(false);
  const [remanenceFilter, setRemanenceFilter] = useState('all'); // 'all' | 'urgent' | 'recall' | 'optimal'
  const [showDataTable, setShowDataTable] = useState(false);

  // Écouteur clavier pour fermeture accessible des infobulles scientifiques (Touche Escape - WCAG 2.1)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && activeTooltip) {
        setActiveTooltip(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTooltip]);

  const showPhysiology = viewMode === 'all' || viewMode === 'physiology';
  const showQualities = viewMode === 'all' || viewMode === 'qualities';

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

  const tauFatigue = physioSettings?.tauFatigue || 7;
  const tauFitness = physioSettings?.tauFitness || 28;

  // 1. Préparation des données globales Banister & VFC pour Recharts (avec projection future et sessions détaillées)
  const chartData = useMemo(() => {
    // Si banisterPerformance est injecté depuis useData, utiliser sa série échauffée (>=90j) comme source unique de vérité
    if (banisterPerformance && banisterPerformance.series && banisterPerformance.series.length > 0) {
      const vfcRaw = banisterPerformance.series.map(point => dailyMetrics[point.dateStr]?.vfc || null);
      const vfcEMA3 = calculateEMA(vfcRaw, 3, false);
      const vfcEMA7 = calculateEMA(vfcRaw, 7, false);

      return banisterPerformance.series.map((point, idx) => {
        const dateStr = point.dateStr;
        const vfc = dailyMetrics[dateStr]?.vfc || null;
        const hrRest = dailyMetrics[dateStr]?.hrRest ?? dailyMetrics[dateStr]?.rhr ?? null;
        const readiness = dailyMetrics[dateStr]?.readiness || null;
        
        const daySessions = [];
        Object.entries(events).forEach(([qualityId, qualityDates]) => {
          if (qualityDates && qualityDates[dateStr]) {
            const item = qualityDates[dateStr];
            const qDef = qualities.find(q => q.id === qualityId);
            let sLoad = 0;
            let duration = 0;
            let rpeM = 5;
            let rpeC = 5;
            let fatigue = null;
            let notes = '';
            let sessionType = '';

            if (typeof item === 'object' && item !== null) {
              sLoad = Number(item.load) || 0;
              duration = Number(item.duration) || 0;
              rpeM = item.rpeMusculaire ?? item.rpeMusc ?? 5;
              rpeC = item.rpeCardio ?? 5;
              fatigue = item.fatigue !== undefined && item.fatigue !== null ? Number(item.fatigue) : null;
              notes = item.notes || '';
              sessionType = item.type || '';
            } else if (typeof item === 'number') {
              sLoad = item * 5;
            }

            const isPrimarySession = isPrimary(item);
            if ((sLoad > 0 || duration > 0) && isPrimarySession) {
              daySessions.push({
                qualityId,
                qualityName: qDef?.name || qualityId,
                load: sLoad,
                duration,
                rpeM,
                rpeC,
                fatigue,
                notes,
                sessionType
              });
            }
          }
        });

        return {
          ...point,
          day: point.day,
          vfc,
          vfcEMA3: vfcEMA3[idx] ? Math.round(vfcEMA3[idx]) : null,
          vfcEMA7: vfcEMA7[idx] ? Math.round(vfcEMA7[idx]) : null,
          hrRest,
          readiness,
          loadEMA7: point.atl,
          loadEMA21: point.ctl,
          loadEMA3: point.load,
          tsb: point.tsb,
          tsbPercent: point.tsbPercent,
          sessions: daySessions
        };
      });
    }

    const today = new Date();
    const rawData = [];
    const futureDays = isSimulationActive ? 14 : (taperingAnalysis ? 7 : 0);
    
    // Historique des 30 derniers jours + projection future
    for (let i = -29; i <= futureDays; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const dateStr = getLocalYYYYMMDD(d);
      
      const vfc = dailyMetrics[dateStr]?.vfc || null;
      const hrRest = dailyMetrics[dateStr]?.hrRest ?? dailyMetrics[dateStr]?.rhr ?? null;
      const readiness = dailyMetrics[dateStr]?.readiness || null;
      let totalLoad = 0;
      const daySessions = [];
      
      Object.entries(events).forEach(([qualityId, qualityDates]) => {
        if (qualityDates && qualityDates[dateStr]) {
          const item = qualityDates[dateStr];
          const qDef = qualities.find(q => q.id === qualityId);
          let sLoad = 0;
          let duration = 0;
          let rpeM = 5;
          let rpeC = 5;
          let fatigue = null;
          let notes = '';
          let sessionType = '';

          if (typeof item === 'object' && item !== null) {
            sLoad = Number(item.load) || 0;
            duration = Number(item.duration) || 0;
            rpeM = item.rpeMusculaire ?? item.rpeMusc ?? 5;
            rpeC = item.rpeCardio ?? 5;
            fatigue = item.fatigue !== undefined && item.fatigue !== null ? Number(item.fatigue) : null;
            notes = item.notes || '';
            sessionType = item.type || '';
          } else if (typeof item === 'number') {
            sLoad = item * 5;
          }

          // Seules les séances principales réalisées par l'athlète contribuent à sa charge réelle du jour
          const isPrimarySession = isPrimary(item);
          if (isPrimarySession) {
            totalLoad += sLoad;
          }

          if ((sLoad > 0 || duration > 0) && isPrimarySession) {
            daySessions.push({
              qualityId,
              qualityName: qDef?.name || qualityId,
              load: sLoad,
              duration,
              rpeM,
              rpeC,
              fatigue,
              notes,
              sessionType
            });
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
        hrRest,
        readiness,
        load: totalLoad,
        sessions: daySessions
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
      const tsbPercent = calculateTsbPercent(ctl, atl);
      return {
        ...data,
        vfcEMA3: vfcEMA3[i] ? Math.round(vfcEMA3[i]) : null,
        vfcEMA7: vfcEMA7[i] ? Math.round(vfcEMA7[i]) : null,
        loadEMA3: Math.round(loadEMA3[i]),
        loadEMA7: atl,
        loadEMA21: ctl,
        tsb,
        tsbPercent,
        sessions: data.sessions || []
      };
    });
  }, [events, dailyMetrics, isSimulationActive, taperingAnalysis, tauFatigue, tauFitness, qualities, banisterPerformance]);

  // Jour inspecté actif (synchronisé par clic ou survol sur la courbe Banister)
  const currentInspectedDay = useMemo(() => {
    if (selectedBanisterDay) return selectedBanisterDay;
    const todayItem = chartData.find(d => d.isToday);
    if (todayItem) return todayItem;
    const nonFuture = chartData.filter(d => !d.isFuture);
    return nonFuture[nonFuture.length - 1] || chartData[chartData.length - 1] || null;
  }, [selectedBanisterDay, chartData]);

  // Contrôles de navigation séquentielle accessible (J-1 / J+1 / clavier)
  const currentDayIndex = useMemo(() => {
    if (!currentInspectedDay || !chartData.length) return -1;
    return chartData.findIndex(d => d.dateStr === currentInspectedDay.dateStr);
  }, [currentInspectedDay, chartData]);

  const canGoPrev = currentDayIndex > 0;
  const canGoNext = currentDayIndex >= 0 && currentDayIndex < chartData.length - 1;

  const handlePrevDay = () => {
    if (canGoPrev) {
      setSelectedBanisterDay(chartData[currentDayIndex - 1]);
      setIsDayPinned(true);
    }
  };

  const handleNextDay = () => {
    if (canGoNext) {
      setSelectedBanisterDay(chartData[currentDayIndex + 1]);
      setIsDayPinned(true);
    }
  };

  // Interprétation dynamique Banister pour le jour inspecté (avec garde CTL en construction)
  const banisterInterpretation = useMemo(() => {
    const dayOffset = currentInspectedDay?.offset ?? 0;
    const baseHistory = banisterPerformance?.historyDays ?? 30;
    const effectiveHistoryDays = Math.max(0, baseHistory + (dayOffset < 0 ? dayOffset : 0));
    const hasInitialCtl = Boolean(physioSettings?.initialCtl && Number(physioSettings.initialCtl) > 0);
    return getDynamicBanisterInterpretation(
      currentInspectedDay, 
      tauFatigue, 
      tauFitness, 
      effectiveHistoryDays,
      hasInitialCtl
    );
  }, [currentInspectedDay, tauFatigue, tauFitness, banisterPerformance?.historyDays, physioSettings?.initialCtl]);

  // Analyses personnalisées de VFC et FC Repos par rapport à la baseline individuelle
  const vfcAnalysis = useMemo(() => {
    return computeVfcAnalysis(dailyMetrics, currentInspectedDay?.dateStr || null);
  }, [dailyMetrics, currentInspectedDay?.dateStr]);

  const hrRestAnalysis = useMemo(() => {
    return computeHrRestAnalysis(dailyMetrics, currentInspectedDay?.dateStr || null);
  }, [dailyMetrics, currentInspectedDay?.dateStr]);

  // 1b. Calcul du ruban de rémanence immédiat unifié pour toutes les qualités
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

      // Modèle unifié avec computeCellState (dose-réponse, charge de référence et rémanence physiologique)
      const cellState = computeCellState(q, todayStr, qEvents, 7, trainingBlocks || []);
      const remainingPercent = cellState.physio.currentLevel;

      const plateauDays = q.g || 4; // Durée de gain / plateau (jours)
      const declineDays = q.o || 3; // Durée de déclin (jours)
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
        // Red : fenêtre dépassée, déclin progressif Coyle/Mujika
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

  // Détection de données réelles pour l'état vide propre (Empty State)
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

  // Échantillon récent (10 derniers jours) pour les miniatures sparklines des KPI
  const sparklineSeries = useMemo(() => {
    const series = activeQualityData.series || [];
    const recent = series.slice(-10);
    return {
      ema3: recent.map(d => d.ema3 || 0),
      ema7: recent.map(d => d.ema7 || 0),
      ema21: recent.map(d => d.ema21 || 0)
    };
  }, [activeQualityData.series]);

  const balance = useMemo(() => {
    return cardioMuscularBalance || computeCardioVsMuscularBalance(events);
  }, [cardioMuscularBalance, events]);

  const intensity = useMemo(() => {
    return intensityDistribution || computeIntensityDistribution(events, qualities);
  }, [intensityDistribution, events, qualities]);

  const fatigueReport = useMemo(() => {
    return perceivedFatigueAnalysis || computePerceivedFatigueAnalysis(events);
  }, [perceivedFatigueAnalysis, events]);

  // 2. Le Coach Virtuel (Analyse algorithmique des tendances)
  const coachInsights = useMemo(() => {
    if (chartData.length === 0) return [];
    // Ancrer impérativement l'analyse sur AUJOURD'HUI (J+0) et non sur une projection future à charge nulle
    const todayEntry = chartData.find(d => d.isToday) || chartData.filter(d => !d.isFuture).slice(-1)[0] || chartData[0];
    const insights = [];

    // Ratio ACWR Global (Aiguë vs Chronique - indicatif)
    const acwr = todayEntry.loadEMA21 > 5 ? (todayEntry.loadEMA7 / todayEntry.loadEMA21).toFixed(2) : null;
    
    if (acwr && Number(acwr) > 1.5) {
      insights.push({ 
        type: 'danger', 
        icon: <AlertTriangle size={18}/>, 
        text: `Augmentation rapide de la charge récente (Ratio charge aiguë/chronique : ${acwr}). Prudence recommandée : veillez à bien assimiler vos séances.` 
      });
    } else if (acwr && Number(acwr) > 1.2) {
      insights.push({ 
        type: 'warning', 
        icon: <TrendingUp size={18}/>, 
        text: `Dynamique de surcharge fonctionnelle (Ratio : ${acwr}). Stimulus d'entraînement efficace si vous êtes en bloc de développement.` 
      });
    } else if (acwr && Number(acwr) < 0.8 && todayEntry.loadEMA21 > 20) {
      insights.push({ 
        type: 'info', 
        icon: <TrendingDown size={18}/>, 
        text: `Charge récente inférieure au niveau chronique (Ratio : ${acwr}). Phase propice à la surcompensation ou à la régénération active.` 
      });
    }

    // Tendance VFC & FC repos basée sur computeVfcAnalysis et computeHrRestAnalysis
    if (vfcAnalysis && vfcAnalysis.status !== 'initializing') {
      if (vfcAnalysis.status === 'low') {
        insights.push({ 
          type: 'danger', 
          icon: <Activity size={18}/>, 
          text: `Fléchissement parasympathique significatif (VFC 7j : ${vfcAnalysis.baseline7d} ms, sous le corridor SWC de ${vfcAnalysis.corridorLower} ms). Privilégiez la régénération active ou le repos.` 
        });
      } else if (vfcAnalysis.status === 'high') {
        insights.push({ 
          type: 'good', 
          icon: <Activity size={18}/>, 
          text: `Excellente assimilation autonome (VFC 7j : ${vfcAnalysis.baseline7d} ms, au-dessus de la ligne de base). Fraîcheur propice aux séances qualitatives.` 
        });
      }
    }

    if (hrRestAnalysis && hrRestAnalysis.status === 'elevated') {
      insights.push({
        type: 'danger',
        icon: <Heart size={18}/>,
        text: `Élévation de la FC de repos (+${hrRestAnalysis.deltaBpm} bpm par rapport à la médiane 28j de ${hrRestAnalysis.median28d} bpm). Marqueur précoce de fatigue résiduelle ou de début d'infection.`
      });
    }

    if (fatigueReport && fatigueReport.count >= 3) {
      if (fatigueReport.status === 'critical') {
        insights.push({
          type: 'danger',
          icon: <ShieldAlert size={18}/>,
          text: `Surmenage perçu élevé (${fatigueReport.meanFatigue}/10 en moyenne sur ${fatigueReport.count} séances). ${fatigueReport.highStrainSessionsCount} séance(s) avec fatigue disproportionnée. Réduisez le volume global.`
        });
      } else if (fatigueReport.status === 'elevated') {
        insights.push({
          type: 'warning',
          icon: <AlertTriangle size={18}/>,
          text: `Coût interne élevé : la fatigue perçue dépasse la difficulté attendue (+${fatigueReport.meanDiscrepancy} pts vs RPE). Optimisez votre sommeil et l'apport glucidique.`
        });
      }
    }

    if (intensity && intensity.totalMinutes > 60) {
      if (intensity.profile === 'THRESHOLD_DOMINANT') {
        insights.push({
          type: 'warning',
          icon: <TrendingUp size={18}/>,
          text: `Polarisation à rééquilibrer : ${intensity.z2TimePct}% du temps passé en Zone 2 (Seuil). Privilégiez 80% en Zone 1 (Aérobie douce) pour maximiser les adaptations sans épuisement.`
        });
      } else if (intensity.profile === 'POLARIZED') {
        insights.push({
          type: 'good',
          icon: <Sparkles size={18}/>,
          text: `Excellente répartition d'intensité polarisée (${intensity.z1TimePct}% Z1 / ${intensity.z2TimePct}% Z2 / ${intensity.z3TimePct}% Z3), respectant le modèle Seiler 80/20.`
        });
      }
    }

    return insights;
  }, [chartData, vfcAnalysis, hrRestAnalysis, fatigueReport, intensity]);

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

  // Données synthétiques Banister du jour (TSB, ATL, CTL, ACWR, Rampe)
  const banisterSummary = useMemo(() => {
    if (chartData.length === 0) return null;
    const todayIndex = chartData.findIndex(d => d.isToday);
    const item = todayIndex >= 0 ? chartData[todayIndex] : chartData[chartData.length - 1];
    const atl = item?.loadEMA7 ?? 0;
    const ctl = item?.loadEMA21 ?? 0;
    const tsb = item?.tsb ?? (ctl - atl);
    
    const historyDays = banisterPerformance?.historyDays ?? 30;
    const hasInitialCtl = (physioSettings?.initialCtl !== undefined && physioSettings?.initialCtl !== null && Number(physioSettings.initialCtl) > 0);
    const tsbZone = getTsbZone(ctl, atl, historyDays, tauFitness, hasInitialCtl);
    const tsbPercent = tsbZone.isReliable ? calculateTsbPercent(ctl, atl) : null;
    const acwr = (ctl > 0 && tsbZone.isReliable) ? (atl / ctl).toFixed(2) : '1.0';

    // Rampe de progression CTL sur 7 jours (points et pourcentage relatif)
    const targetIdx = todayIndex >= 0 ? todayIndex : chartData.length - 1;
    const sevenDaysAgo = targetIdx >= 7 ? chartData[targetIdx - 7] : chartData[0];
    const ctlPast = sevenDaysAgo?.loadEMA21 ?? ctl;
    const ctlRamp = Math.round((ctl - ctlPast) * 10) / 10;
    const ctlRampPercent = ctlPast > 10 ? Math.round(((ctl - ctlPast) / ctlPast) * 1000) / 10 : null;

    return { atl, ctl, tsb, tsbPercent, tsbZone, acwr, ctlRamp, ctlRampPercent };
  }, [chartData, banisterPerformance?.historyDays, physioSettings?.initialCtl, tauFitness]);

  // Définitions détaillées, rôles physiologiques et seuils de normalité pour les infobulles (Tooltips)
  const physioTooltips = useMemo(() => {
    return {
      tsb: {
        id: 'tsb',
        name: 'TSB',
        fullTitle: 'Training Stress Balance (Forme & Fraîcheur)',
        formula: 'TSB = CTL − ATL (Condition durable − Fatigue aiguë, exprimé en % de la CTL)',
        color: '#10b981',
        role: "Indicateur central de performance et de fraîcheur neuromusculaire. Il reflète l'équilibre dynamique entre les adaptations physiques de fond acquises (CTL) et la fatigue résiduelle immédiate (ATL). Un TSB positif indique un organisme frais et dispo pour la compétition ; un TSB négatif traduit une phase d'assimilation de charge.",
        currentValue: banisterSummary ? `${banisterSummary.tsb > 0 ? `+${banisterSummary.tsb}` : banisterSummary.tsb} pts${banisterSummary.tsbPercent !== null ? ` (${banisterSummary.tsbPercent > 0 ? `+${banisterSummary.tsbPercent}` : banisterSummary.tsbPercent}% CTL)` : ''}` : '0',
        currentInterpretation: 
          !banisterSummary ? 'Données en cours de calcul' :
          banisterSummary.tsbZone.title,
        thresholds: [
          {
            zone: '> +25% CTL',
            title: 'Sur-affûtage / Perte de tonus',
            detail: 'Fraîcheur extrême mais risque d\'érosion de la condition si prolongé plus de 10 jours.',
            status: 'warning',
            tagClass: 'bg-amber-500/20 text-amber-300 border-amber-500/30'
          },
          {
            zone: '+5% à +25% CTL',
            title: 'Pic de Forme (Zone d\'Affûtage Compétition)',
            detail: 'Zone idéale pour le Jour J : fraîcheur maximale tout en conservant le moteur aérobie et le tonus neuromusculaire.',
            status: 'success',
            tagClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
          },
          {
            zone: '-10% à +5% CTL',
            title: 'Zone d\'Équilibre / Entretien',
            detail: 'Bonne disponibilité physique sans fatigue excessive, parfait pour les séances techniques ou les transitions.',
            status: 'info',
            tagClass: 'bg-sky-500/20 text-sky-300 border-sky-500/30'
          },
          {
            zone: '-35% à -10% CTL',
            title: 'Surcharge Fonctionnelle (Développement)',
            detail: 'Fatigue contrôlée indispensable pour provoquer les adaptations physiologiques au cœur d\'un bloc actif.',
            status: 'neutral',
            tagClass: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
          },
          {
            zone: '< -35% CTL',
            title: 'Fatigue Aiguë Élevée (Surcharge Critique)',
            detail: 'Fatigue aiguë très supérieure à votre base chronique. Risque de surmenage si ce niveau persiste. Repos requis.',
            status: 'danger',
            tagClass: 'bg-red-500/20 text-red-300 border-red-500/30'
          }
        ]
      },
      atl: {
        id: 'atl',
        name: 'ATL',
        fullTitle: 'Acute Training Load (Charge Aiguë / Fatigue)',
        formula: `Moyenne Mobile Exponentielle continue (τ = ${tauFatigue} jours)`,
        color:
          !banisterSummary ? '#38bdf8' :
          Number(banisterSummary.acwr) > 1.5 ? '#ef4444' :
          Number(banisterSummary.acwr) >= 1.3 ? '#f59e0b' :
          Number(banisterSummary.acwr) >= 0.8 ? '#10b981' :
          '#38bdf8',
        tagClass:
          !banisterSummary ? 'bg-sky-500/20 text-sky-300 border-sky-500/30' :
          Number(banisterSummary.acwr) > 1.5 ? 'bg-red-500/20 text-red-300 border-red-500/40' :
          Number(banisterSummary.acwr) >= 1.3 ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' :
          Number(banisterSummary.acwr) >= 0.8 ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' :
          'bg-sky-500/20 text-sky-300 border-sky-500/30',
        role: "Quantifie la charge et la fatigue neuromusculaire immédiate accumulée sur la dernière semaine. L'ATL monte très rapidement après des séances volumineuses ou intenses, et redescend selon la constante de dissipation.",
        currentValue: banisterSummary ? `${banisterSummary.atl} pts (Ratio aigu/chronique : ${banisterSummary.acwr}x)` : '0 pts',
        currentInterpretation:
          !banisterSummary ? 'Données en cours de calcul' :
          Number(banisterSummary.acwr) > 1.5 ? 'Zone d\'Accélération Rapide (> 1.5x)' :
          Number(banisterSummary.acwr) >= 1.3 ? 'Zone Soutenue (1.3 à 1.5x)' :
          Number(banisterSummary.acwr) >= 0.8 ? 'Zone Équilibrée (0.8 à 1.3x)' :
          'Sous-charge / Affûtage (< 0.8x)',
        thresholds: [
          {
            zone: 'Ratio < 0.8',
            title: 'Sous-charge / Affûtage',
            detail: 'Baisse de la charge récente par rapport au niveau chronique. Favorable en affûtage ou régénération.',
            status: 'info',
            tagClass: 'bg-sky-500/20 text-sky-300 border-sky-500/30'
          },
          {
            zone: 'Ratio 0.8 à 1.3',
            title: 'Plage Équilibrée (Progression Saine)',
            detail: 'Équilibre stable entre progression des charges et tolérance de l\'organisme.',
            status: 'success',
            tagClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
          },
          {
            zone: 'Ratio 1.3 à 1.5',
            title: 'Accélération de la Charge',
            detail: 'Montée rapide de la contrainte. Stimulus fort adapté aux stages ou microcycles de développement.',
            status: 'warning',
            tagClass: 'bg-amber-500/20 text-amber-300 border-amber-500/30'
          },
          {
            zone: 'Ratio > 1.5',
            title: 'Augmentation Rapide de Charge',
            detail: 'La charge aiguë dépasse de plus de 50% la base chronique. Vigilance accrue sur la récupération et le sommeil.',
            status: 'danger',
            tagClass: 'bg-red-500/20 text-red-300 border-red-500/30'
          }
        ]
      },
      ctl: {
        id: 'ctl',
        name: 'CTL',
        fullTitle: 'Chronic Training Load (Charge Chronique / Fitness)',
        formula: `Moyenne Mobile Exponentielle sur ${tauFitness} jours (Condition)`,
        color: '#38bdf8',
        role: "Représente votre condition physique de fond ('Fitness') et votre capacité à encaisser de gros volumes d'entraînement sans vous épuiser. La CTL se construit patiemment sur plusieurs semaines de travail continu.",
        currentValue: banisterSummary ? (
          banisterSummary.ctlRampPercent !== null
            ? `${banisterSummary.ctl} pts (${banisterSummary.ctlRampPercent >= 0 ? `+${banisterSummary.ctlRampPercent}` : banisterSummary.ctlRampPercent}%/sem)`
            : `${banisterSummary.ctl} pts (${banisterSummary.ctlRamp >= 0 ? `+${banisterSummary.ctlRamp}` : banisterSummary.ctlRamp} pts/sem)`
        ) : '0 pts',
        currentInterpretation:
          !banisterSummary ? 'Données en cours de calcul' :
          (banisterSummary.ctlRampPercent !== null ? (
            banisterSummary.ctlRampPercent > 12 ? 'Montée trop agressive (> +12%/sem)' :
            banisterSummary.ctlRampPercent >= 4 ? 'Progression optimale (+4% à +12%/sem)' :
            banisterSummary.ctlRampPercent >= -4 ? 'Stabilisation / Maintien (Plateau ±4%)' :
            'Désentraînement (Baisse de charge < -4%/sem)'
          ) : (
            banisterSummary.ctlRamp > 8 ? 'Montée rapide (> +8 pts/sem)' :
            banisterSummary.ctlRamp >= 3 ? 'Progression optimale (+3 à +7 pts/sem)' :
            banisterSummary.ctlRamp >= -2 ? 'Stabilisation / Maintien (Plateau)' :
            'Désentraînement (Baisse de condition)'
          )),
        thresholds: [
          {
            zone: '+4% à +12%/sem',
            title: 'Rampe de Progression Optimale',
            detail: 'Rythme idéal de montée en charge relative pour développer la cylindrée sans saturer l\'organisme.',
            status: 'success',
            tagClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
          },
          {
            zone: '> +12%/sem',
            title: 'Rampe Trop Agressive',
            detail: 'Augmentation trop brutale du volume hebdomadaire, risquant d\'induire une surcharge aiguë ou une blessure.',
            status: 'warning',
            tagClass: 'bg-amber-500/20 text-amber-300 border-amber-500/30'
          },
          {
            zone: 'Plateau stable (±4%/sem)',
            title: 'Phase de Stabilisation / Palier',
            detail: 'Permet à l\'organisme d\'assimiler un nouveau niveau de travail avant d\'engager un cycle supérieur.',
            status: 'info',
            tagClass: 'bg-sky-500/20 text-sky-300 border-sky-500/30'
          },
          {
            zone: 'Baisse < -4%/sem',
            title: 'Désentraînement / Perte de Fond',
            detail: 'Perte progressive de condition consécutive à une coupure ou une baisse d\'activité prolongée.',
            status: 'neutral',
            tagClass: 'bg-slate-700/60 text-slate-300 border-slate-600'
          }
        ]
      }
    };
  }, [banisterSummary, tauFatigue, tauFitness]);

  return (
    <main 
      role="region" 
      aria-label="Tableau de bord des métriques et dynamiques physiologiques" 
      className="p-4 md:p-6 w-full flex flex-col gap-6 pb-12"
    >
      
      {showPhysiology && (
        <>
          {/* BARRE D'ACTIONS SCIENTIFIQUES : SIMULATION, OBJECTIF & EXPORT */}
          <header 
            role="toolbar" 
            aria-label="Actions du tableau de bord physiologique"
            className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-900/60 border border-white/10 shadow-lg"
          >
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-blue-500/15 text-blue-400 border border-blue-500/20" aria-hidden="true">
                <Gauge size={16} />
              </div>
              <div>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider m-0">Tableau de Bord Physiologique</h3>
                <p className="text-xs text-slate-300 hidden sm:block mt-0.5 mb-0">Modèle PMC (Charge & Forme), Foster Monotony & Affûtage</p>
              </div>
            </div>

            {/* Standardisation : boutons adaptés mobile & desktop respectant 44px de cible tactile */}
            <div className="flex flex-wrap items-center gap-2">
              {onToggleSimulation && (
                <button
                  type="button"
                  onClick={() => onToggleSimulation()}
                  aria-pressed={isSimulationActive}
                  className={`flex items-center gap-2 min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 ${
                    isSimulationActive 
                      ? 'bg-purple-950/50 text-purple-200 border-purple-500/50 shadow-sm' 
                      : 'bg-white/5 hover:bg-white/10 text-slate-200 hover:text-white border-white/10'
                  }`}
                  title="Activer la simulation prédictive pour projeter les jours futurs"
                >
                  <Sparkles size={14} className={isSimulationActive ? 'text-purple-400' : 'text-slate-400'} aria-hidden="true" />
                  <span className="hidden sm:inline">{isSimulationActive ? 'Simulation Active' : 'Simulation'}</span>
                  <span className="sm:hidden">Simu</span>
                </button>
              )}

              {onOpenCompetitionModal && (
                <button
                  type="button"
                  onClick={onOpenCompetitionModal}
                  className="flex items-center gap-2 min-h-[44px] px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 hover:text-white text-xs font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                  title="Configurer une compétition ou un objectif de course"
                >
                  <Trophy size={14} className="text-slate-400" aria-hidden="true" />
                  <span>
                    {taperingAnalysis?.targetCompetition 
                      ? `${taperingAnalysis.targetCompetition.name} (J-${taperingAnalysis.daysRemaining})` 
                      : 'Objectif'}
                  </span>
                </button>
              )}

              {onOpenPhysioSettingsModal && (
                <button
                  type="button"
                  onClick={onOpenPhysioSettingsModal}
                  className="flex items-center gap-2 min-h-[44px] px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 hover:text-white text-xs font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                  title="Calibrer les constantes de rémanence Banister (tau fatigue et condition)"
                >
                  <Sliders size={14} className="text-slate-400" aria-hidden="true" />
                  <span className="hidden sm:inline">Calibrage (τ₁:{tauFatigue}j, τ₂:{tauFitness}j)</span>
                  <span className="sm:hidden font-mono">τ:{tauFatigue}/{tauFitness}j</span>
                </button>
              )}

              {onOpenReportModal && (
                <button
                  type="button"
                  onClick={onOpenReportModal}
                  className="flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 border border-blue-500/40 text-white text-xs font-bold transition-all shadow-md shadow-blue-600/25 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
                  title="Générer un bilan d'entraînement imprimable en PDF"
                >
                  <FileText size={14} className="text-white" aria-hidden="true" />
                  <span>Bilan PDF</span>
                </button>
              )}
            </div>
          </header>

          {/* SECTION TAPER / FOSTER / BALANCE : 3 WIDGETS PHYSIOLOGIQUES COMPLÉMENTAIRES */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            
            {/* CARTE 1 : AFFÛTAGE & PRÉDICTION COMPÉTITION */}
            <article 
              aria-label="Affûtage et prédiction compétition" 
              className="p-4 rounded-2xl bg-slate-900/60 border border-white/10 flex flex-col justify-between shadow-xl"
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-white/5 text-slate-300 border border-white/10" aria-hidden="true">
                    <Trophy size={16} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider m-0">
                      Affûtage & Objectif Compétition
                    </h4>
                    <p className="text-xs text-slate-300 mt-0.5 mb-0">
                      {taperingAnalysis?.targetCompetition 
                        ? taperingAnalysis.targetCompetition.name 
                        : 'Aucun objectif défini'}
                    </p>
                  </div>
                </div>

                {taperingAnalysis?.targetCompetition ? (
                  <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    {taperingAnalysis.daysRemaining >= 0 ? `J-${taperingAnalysis.daysRemaining}` : 'Terminé'}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={onOpenCompetitionModal}
                    className="min-h-[44px] px-3 inline-flex items-center text-xs font-bold text-amber-400 hover:text-amber-300 underline cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded-lg"
                  >
                    Définir
                  </button>
                )}
              </div>

              {taperingAnalysis ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2 rounded-xl bg-black/40 border border-white/5">
                      <span className="text-xs text-slate-300 block font-medium">Statut</span>
                      <span className="text-xs font-bold text-amber-300 truncate block mt-0.5">
                        {taperingAnalysis.statusBadge}
                      </span>
                    </div>
                    <div className="p-2 rounded-xl bg-black/40 border border-white/5">
                      <span className="text-xs text-slate-300 block font-medium">TSB Projeté Jour J</span>
                      <span className="text-xs font-bold font-mono text-emerald-400 block mt-0.5">
                        {taperingAnalysis.projectedTsbPercent !== null
                          ? (taperingAnalysis.projectedTsbPercent > 0 ? `+${taperingAnalysis.projectedTsbPercent}%` : `${taperingAnalysis.projectedTsbPercent}%`)
                          : (taperingAnalysis.projectedTsb > 0 ? `+${taperingAnalysis.projectedTsb} pts` : `${taperingAnalysis.projectedTsb} pts`)}
                      </span>
                      {taperingAnalysis.projectedTsbPercent !== null && (
                        <span className="text-xs font-mono text-slate-400 block">
                          ({taperingAnalysis.projectedTsb > 0 ? `+${taperingAnalysis.projectedTsb}` : taperingAnalysis.projectedTsb} pts)
                        </span>
                      )}
                    </div>
                    <div className="p-2 rounded-xl bg-black/40 border border-white/5">
                      <span className="text-xs text-slate-300 block font-medium">Cible d'Affûtage</span>
                      <span className="text-xs font-bold font-mono text-blue-300 block mt-0.5">
                        +{taperingAnalysis.targetTsb}{taperingAnalysis.targetTsbUnit === 'percent' ? '% CTL' : ' pts'}
                      </span>
                      <span className="text-xs text-slate-400 block font-sans">
                        {taperingAnalysis.targetTsbUnit === 'percent' ? 'Fraîcheur relative' : 'Score brut'}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed bg-white/5 p-2 rounded-lg border border-white/5 m-0">
                    {taperingAnalysis.advice}
                  </p>
                </div>
              ) : (
                <div className="text-xs text-slate-300 py-2">
                  Définissez la date de votre objectif pour calculer votre affûtage optimal et modéliser le pic TSB.
                </div>
              )}
            </article>

            {/* CARTE 2 : MONOTONIE DE FOSTER & STRAIN (PRÉVENTION DES BLESSURES & SURMENAGE) */}
            <article 
              aria-label="Monotonie de Foster et contrainte hebdomadaire" 
              className="p-4 rounded-2xl bg-slate-900/60 border border-white/10 flex flex-col justify-between shadow-xl"
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-white/5 text-slate-300 border border-white/10" aria-hidden="true">
                    <ShieldAlert size={16} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider m-0">
                      Monotonie de Foster & Strain
                    </h4>
                    <p className="text-xs text-slate-300 mt-0.5 mb-0">Variabilité des stimuli & protection immunitaire</p>
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
                      <span className="text-xs text-slate-300 block font-medium">Monotonie</span>
                      <span className={`text-xs font-bold font-mono block mt-0.5 ${
                        fosterMetrics.monotony > 2.0 ? 'text-red-400' : fosterMetrics.monotony > 1.5 ? 'text-amber-400' : 'text-emerald-400'
                      }`}>
                        {fosterMetrics.monotony} <span className="text-xs opacity-70">(&lt;1.5)</span>
                      </span>
                    </div>
                    <div className="p-2 rounded-xl bg-black/40 border border-white/5">
                      <span className="text-xs text-slate-300 block font-medium">Strain Hebdo</span>
                      <span className="text-xs font-bold font-mono text-purple-300 block mt-0.5">
                        {fosterMetrics.strain}
                      </span>
                    </div>
                    <div className="p-2 rounded-xl bg-black/40 border border-white/5">
                      <span className="text-xs text-slate-300 block font-medium">Écart-Type (Variabilité)</span>
                      <span className="text-xs font-bold font-mono text-slate-200 block mt-0.5">
                        {fosterMetrics.stdDev}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed bg-white/5 p-2 rounded-lg border border-white/5 m-0">
                    {fosterMetrics.advice}
                  </p>
                </div>
              )}
            </article>

            {/* CARTE 3 : TRIMP MULTI-FACTEURS (CARDIO VS MUSCULAIRE) */}
            <article 
              aria-label="Charge cardio versus musculaire" 
              className="p-4 rounded-2xl bg-slate-900/60 border border-white/10 flex flex-col justify-between shadow-xl"
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-white/5 text-slate-300 border border-white/10" aria-hidden="true">
                    <Heart size={16} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider m-0">
                      Charge Cardio vs Musculaire (RPE)
                    </h4>
                    <p className="text-xs text-slate-300 mt-0.5 mb-0">Asymétrie de fatigue & stress excentrique</p>
                  </div>
                </div>

                {balance && (
                  <span className={`px-2 py-0.5 rounded-lg text-xs font-bold border truncate max-w-[150px] ${
                    balance.state === 'CARDIO_DOMINANT'
                      ? 'bg-sky-500/20 text-sky-300 border-sky-500/30'
                      : balance.state === 'MUSCULAR_DOMINANT'
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  }`} title={balance.badge}>
                    {balance.badge}
                  </span>
                )}
              </div>

              {balance && (
                <div className="space-y-3">
                  {/* Barre de ratio visuelle avec sémantique accessible */}
                  <div>
                    <div 
                      role="meter"
                      aria-label="Répartition de la charge d'entraînement : Cardio vs Musculaire sur 7 jours"
                      aria-valuenow={balance.cardioPercent}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuetext={`Cardio : ${balance.cardioPercent}%, Musculaire : ${balance.muscPercent}%. Charge 7j : ${balance.totalCardioLoad} UA cardio contre ${balance.totalMuscLoad} UA musculaire.`}
                      className="w-full h-2.5 rounded-full overflow-hidden flex bg-white/10 shadow-inner mb-2"
                    >
                      <div 
                        className="bg-sky-400 h-full transition-all duration-500" 
                        style={{ width: `${balance.cardioPercent}%` }}
                        title={`Charge Cardio 7j: ${balance.totalCardioLoad}`}
                      />
                      <div 
                        className="bg-rose-400 h-full transition-all duration-500" 
                        style={{ width: `${balance.muscPercent}%` }}
                        title={`Charge Musculaire 7j: ${balance.totalMuscLoad}`}
                      />
                    </div>
                    {/* Légende centrée à contraste renforcé */}
                    <div className="flex items-center justify-between text-xs font-mono px-2 sm:px-2.5 py-1 bg-black/40 rounded-xl border border-white/5 gap-1">
                      <span className="text-sky-300 flex items-center gap-1 font-bold truncate">
                        <Heart size={12} className="text-sky-400 shrink-0" aria-hidden="true" /> Cardio : {balance.cardioPercent}%
                      </span>
                      <span className="text-slate-200 text-xs font-bold uppercase tracking-wider px-1.5 sm:px-2 py-0.5 rounded bg-white/10 shrink-0 hidden xs:inline-block">
                        Équilibre
                      </span>
                      <span className="text-rose-300 flex items-center gap-1 font-bold truncate">
                        Musc : {balance.muscPercent}% <Dumbbell size={12} className="text-rose-400 shrink-0" aria-hidden="true" />
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2 rounded-xl bg-black/40 border border-white/5">
                      <span className="text-xs text-slate-300 block font-medium">Cardio 7j</span>
                      <span className="text-xs font-bold font-mono text-sky-400 block mt-0.5">
                        {balance.totalCardioLoad}
                      </span>
                    </div>
                    <div className="p-2 rounded-xl bg-black/40 border border-white/5">
                      <span className="text-xs text-slate-300 block font-medium">Musculaire 7j</span>
                      <span className="text-xs font-bold font-mono text-rose-400 block mt-0.5">
                        {balance.totalMuscLoad}
                      </span>
                    </div>
                    <div className="p-2 rounded-xl bg-black/40 border border-white/5">
                      <span className="text-xs text-slate-300 block font-medium">Chocs Excentriques</span>
                      <span className="text-xs font-bold font-mono text-amber-300 block mt-0.5 flex items-center justify-center gap-1">
                        <Flame size={11} className="text-amber-400" aria-hidden="true" />
                        {balance.totalEccentricSessions} s.
                      </span>
                    </div>
                  </div>

                  <div className="text-xs text-slate-200 leading-relaxed bg-white/5 p-2 rounded-lg border border-white/5 m-0 space-y-1">
                    <p className="m-0 leading-tight">
                      <strong className="text-white">Diagnostic :</strong> {balance.description}
                    </p>
                    <p className="m-0 text-emerald-300 text-xs leading-tight flex items-center gap-1.5 font-medium">
                      <Target size={13} className="text-emerald-400 shrink-0" aria-hidden="true" />
                      <span>{balance.recommendation}</span>
                    </p>
                  </div>
                </div>
              )}
            </article>

          </div>

      {/* ENCART COACH VIRTUEL */}
      {coachInsights.length > 0 && (
        <section 
          aria-labelledby="coach-insights-heading"
          className="bg-white/5 p-4 rounded-2xl border border-white/10 shadow-lg"
        >
          <h4 id="coach-insights-heading" className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2 mb-3.5">
            <Sparkles size={16} className="text-blue-400" aria-hidden="true" />
            <span>Analyse Intelligente de Charge & Récupération ({coachInsights.length} recommandation{coachInsights.length > 1 ? 's' : ''})</span>
          </h4>
          <div className="space-y-2.5" role="list" aria-label="Recommandations physiologiques actives">
            {coachInsights.map((insight, i) => {
              let bClass = 'bg-white/5 border border-white/10 text-slate-200';
              if (insight.type === 'danger') bClass = 'bg-red-500/15 border border-red-500/30 text-red-100';
              else if (insight.type === 'warning') bClass = 'bg-amber-500/15 border border-amber-500/30 text-amber-100';
              else if (insight.type === 'good') bClass = 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-100';
              return (
                <div key={i} role="listitem" className={`flex items-start gap-3 p-3 rounded-xl text-xs sm:text-sm font-medium ${bClass}`}>
                  <div className="mt-0.5 opacity-90 shrink-0" aria-hidden="true">{insight.icon}</div>
                  <span className="leading-relaxed">{insight.text}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

          {/* BANDEAU KPI BANISTER : TSB · ATL · CTL AVEC INFOBULLES SCIENTIFIQUES AU SURVOL */}
          <div className="relative">
            <div className="flex items-center justify-between mb-2 px-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <Activity size={14} className="text-blue-400" aria-hidden="true" />
                  Indicateurs de Modélisation PMC (Jour J)
                </span>
                <span className="text-xs text-slate-300 font-mono hidden sm:inline">
                  (Survolez les indicateurs pour comprendre leur rôle et leurs seuils)
                </span>
              </div>
              <span className="text-xs font-mono text-slate-300">
                τ₁: {tauFatigue}j · τ₂: {tauFitness}j
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {['tsb', 'atl', 'ctl'].map((key) => {
                const info = physioTooltips[key];
                const isActive = activeTooltip === key;
                const isTsb = key === 'tsb';
                const isAtl = key === 'atl';
                const isCtl = key === 'ctl';

                let cardBorder = 'border-slate-800 bg-slate-900/60 hover:border-slate-700';
                let valueColor = 'text-white';
                let badgeClass = 'bg-white/10 text-slate-300 border-white/10';
                let mainNumber = '0';
                let unitLabel = '';
                let secondaryDetail = '';
                let shortFormula = '';
                let statusColor = 'text-slate-300';

                // Calculs spécifiques et positions de curseur pour les jauges visuelles
                let gaugePercent = 50;
                let gaugeSubtextLeft = '';
                let gaugeSubtextCenter = '';
                let gaugeSubtextRight = '';

                if (isTsb) {
                  const tsbVal = banisterSummary?.tsb ?? 0;
                  const tsbPct = banisterSummary?.tsbPercent;
                  const isInit = banisterSummary?.tsbZone?.zoneId === 'INITIALIZING';

                  if (isInit) {
                    mainNumber = tsbVal > 0 ? `+${tsbVal}` : `${tsbVal}`;
                    unitLabel = 'pts';
                    secondaryDetail = '(Étalonnage CTL)';
                    shortFormula = 'CTL − ATL';
                    gaugePercent = 50;
                    gaugeSubtextLeft = 'Calibration';
                    gaugeSubtextCenter = 'Convergence en cours';
                    gaugeSubtextRight = '30-45j';
                    cardBorder = 'border-slate-700/60 bg-gradient-to-b from-slate-900/60 to-slate-950/80';
                    valueColor = 'text-slate-300';
                    badgeClass = 'bg-slate-700/60 text-slate-300 border-slate-600';
                    statusColor = 'text-slate-400';
                  } else {
                    mainNumber = tsbPct !== null && tsbPct !== undefined ? (tsbPct > 0 ? `+${tsbPct}%` : `${tsbPct}%`) : (tsbVal > 0 ? `+${tsbVal}` : `${tsbVal}`);
                    unitLabel = 'CTL';
                    secondaryDetail = `(${tsbVal > 0 ? `+${tsbVal}` : tsbVal} pts)`;
                    shortFormula = 'Forme relative';

                    // Échelle TSB% : -50% à +30% (delta 80)
                    const clampPct = Math.max(-50, Math.min(30, tsbPct ?? tsbVal));
                    gaugePercent = Math.max(4, Math.min(96, ((clampPct + 50) / 80) * 100));
                    gaugeSubtextLeft = '-35% Surch.';
                    gaugeSubtextCenter = '+5% à +25% Pic';
                    gaugeSubtextRight = '>+25% Déclin';

                    if (banisterSummary?.tsbZone?.color === 'rose') {
                      cardBorder = 'border-red-500/40 bg-gradient-to-b from-red-950/25 to-slate-900/80 hover:border-red-400/60';
                      valueColor = 'text-red-400';
                      badgeClass = 'bg-red-500/20 text-red-300 border-red-500/30';
                      statusColor = 'text-red-400';
                    } else if (banisterSummary?.tsbZone?.color === 'amber') {
                      cardBorder = 'border-amber-500/35 bg-gradient-to-b from-amber-950/20 to-slate-900/80 hover:border-amber-400/50';
                      valueColor = 'text-amber-400';
                      badgeClass = 'bg-amber-500/20 text-amber-300 border-amber-500/30';
                      statusColor = 'text-amber-400';
                    } else if (banisterSummary?.tsbZone?.color === 'emerald') {
                      cardBorder = 'border-emerald-500/35 bg-gradient-to-b from-emerald-950/20 to-slate-900/80 hover:border-emerald-400/50';
                      valueColor = 'text-emerald-400';
                      badgeClass = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
                      statusColor = 'text-emerald-400';
                    } else {
                      cardBorder = 'border-sky-500/30 bg-gradient-to-b from-sky-950/20 to-slate-900/80 hover:border-sky-400/50';
                      valueColor = 'text-sky-300';
                      badgeClass = 'bg-sky-500/20 text-sky-300 border-sky-500/30';
                      statusColor = 'text-sky-300';
                    }
                  }
                } else if (isAtl) {
                  const atlVal = banisterSummary?.atl ?? 0;
                  const ctlVal = banisterSummary?.ctl ?? 0;
                  const isInit = banisterSummary?.tsbZone?.zoneId === 'INITIALIZING';
                  const acwrVal = (ctlVal > 0 && !isInit) ? (atlVal / ctlVal).toFixed(2) : null;
                  mainNumber = `${atlVal}`;
                  unitLabel = 'pts';
                  secondaryDetail = acwrVal !== null ? `(Ratio ATL/CTL : ${acwrVal}x)` : '(En étalonnage)';
                  shortFormula = `Fatigue Moyenne ${tauFatigue}j`;

                  // Échelle de ratio ATL/CTL harmonisée avec la grille TSB% :
                  // 1.0x = Équilibre (TSB 0), >1.35x = Surcharge aiguë (TSB% < -35%), <0.95x = Fraîcheur
                  const acwrNum = acwrVal !== null ? Number(acwrVal) : 1.0;
                  gaugePercent = Math.max(4, Math.min(96, ((Math.max(0.6, Math.min(1.6, acwrNum)) - 0.6) / 1.0) * 100));
                  gaugeSubtextLeft = '<0.95x Frais';
                  gaugeSubtextCenter = '1.0-1.35x Stimulus';
                  gaugeSubtextRight = '>1.35x Surch.';

                  // Alignement strict avec la couleur et le diagnostic de la zone TSB pour éliminer toute contradiction
                  if (banisterSummary?.tsbZone?.color === 'rose' || acwrNum > 1.35) {
                    cardBorder = 'border-red-500/50 bg-gradient-to-b from-red-950/30 to-slate-900/80 hover:border-red-400/70 shadow-red-500/10';
                    valueColor = 'text-red-400';
                    badgeClass = 'bg-red-500/20 text-red-300 border-red-500/40';
                    statusColor = 'text-red-400';
                  } else if (banisterSummary?.tsbZone?.color === 'emerald' || (acwrNum >= 1.10 && acwrNum <= 1.35)) {
                    cardBorder = 'border-emerald-500/35 bg-gradient-to-b from-emerald-950/20 to-slate-900/80 hover:border-emerald-400/50';
                    valueColor = 'text-emerald-400';
                    badgeClass = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
                    statusColor = 'text-emerald-400';
                  } else if (acwrNum < 0.95) {
                    cardBorder = 'border-sky-500/30 bg-gradient-to-b from-sky-950/20 to-slate-900/80 hover:border-sky-400/50';
                    valueColor = 'text-sky-300';
                    badgeClass = 'bg-sky-500/20 text-sky-300 border-sky-500/30';
                    statusColor = 'text-sky-300';
                  } else {
                    cardBorder = 'border-slate-700/60 bg-gradient-to-b from-slate-900/60 to-slate-950/80';
                    valueColor = 'text-slate-300';
                    badgeClass = 'bg-slate-700/60 text-slate-300 border-slate-600';
                    statusColor = 'text-slate-400';
                  }
                } else if (isCtl) {
                  const ctlVal = banisterSummary?.ctl ?? 0;
                  const rampVal = banisterSummary?.ctlRamp ?? 0;
                  const rampPct = banisterSummary?.ctlRampPercent;
                  mainNumber = `${ctlVal}`;
                  unitLabel = 'pts';
                  secondaryDetail = rampPct !== null && rampPct !== undefined 
                    ? `(${rampPct >= 0 ? `+${rampPct}` : rampPct}%/sem)` 
                    : `(${rampVal >= 0 ? `+${rampVal}` : rampVal} pts/sem)`;
                  shortFormula = `Moyenne ${tauFitness}j`;

                  // Échelle Rampe : -8% à +18%
                  const effectiveRamp = rampPct !== null && rampPct !== undefined ? rampPct : (rampVal * 1.5);
                  gaugePercent = Math.max(4, Math.min(96, ((Math.max(-8, Math.min(18, effectiveRamp)) + 8) / 26) * 100));
                  gaugeSubtextLeft = '-5% Déclin';
                  gaugeSubtextCenter = '+5% à +10% Idéal';
                  gaugeSubtextRight = '+15% Brutal';

                  if (effectiveRamp > 12) {
                    cardBorder = 'border-amber-500/35 bg-gradient-to-b from-amber-950/20 to-slate-900/80 hover:border-amber-400/50';
                    valueColor = 'text-amber-400';
                    badgeClass = 'bg-amber-500/20 text-amber-300 border-amber-500/30';
                    statusColor = 'text-amber-400';
                  } else if (effectiveRamp >= 4) {
                    cardBorder = 'border-emerald-500/35 bg-gradient-to-b from-emerald-950/20 to-slate-900/80 hover:border-emerald-400/50';
                    valueColor = 'text-emerald-400';
                    badgeClass = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
                    statusColor = 'text-emerald-400';
                  } else {
                    cardBorder = 'border-sky-500/30 bg-gradient-to-b from-sky-950/20 to-slate-900/80 hover:border-sky-400/50';
                    valueColor = 'text-sky-300';
                    badgeClass = 'bg-sky-500/20 text-sky-300 border-sky-500/30';
                    statusColor = 'text-sky-300';
                  }
                }

                return (
                  <article
                    key={key}
                    aria-labelledby={`kpi-heading-${key}`}
                    className={`relative p-4 rounded-2xl border transition-all shadow-xl ${cardBorder} ${isActive ? 'ring-2 ring-blue-500/50 scale-[1.01]' : ''}`}
                  >
                    {/* Header carte */}
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`px-2 py-0.5 rounded font-black font-mono text-xs border ${badgeClass}`}>
                          {info.name}
                        </span>
                        <h4 id={`kpi-heading-${key}`} className="text-xs font-bold text-slate-200 truncate m-0">
                          {key === 'tsb' ? 'Forme (TSB)' : key === 'atl' ? 'Fatigue Aiguë (ATL)' : 'Condition Durable (CTL)'}
                        </h4>
                      </div>
                      <button
                        type="button"
                        id={`kpi-info-btn-${key}`}
                        aria-haspopup="dialog"
                        aria-expanded={isActive}
                        aria-controls={`physio-tooltip-${key}`}
                        onClick={() => setActiveTooltip(activeTooltip === key ? null : key)}
                        aria-label={`Afficher le rôle et les seuils de normalité de ${info.name}`}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center -mr-2 -my-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 cursor-pointer"
                        title="Afficher le rôle et les seuils de normalité"
                      >
                        <Info size={18} className={isActive ? 'text-blue-400' : ''} aria-hidden="true" />
                      </button>
                    </div>

                    {/* Valeur principale agrandie et sous-formule lisible en gris slate-300 */}
                    <div className="flex items-baseline justify-between gap-2 mb-1.5 min-w-0">
                      <div className="flex items-baseline gap-1.5 min-w-0 flex-wrap">
                        <span className={`text-3xl sm:text-5xl font-black font-mono tracking-tight ${valueColor}`}>
                          {mainNumber}
                        </span>
                        <span className="text-sm sm:text-base font-bold font-sans text-slate-300 uppercase tracking-wide">
                          {unitLabel}
                        </span>
                        {secondaryDetail && (
                          <span className="text-xs font-mono font-medium text-slate-400 ml-1 truncate max-w-[130px] sm:max-w-none">
                            {secondaryDetail}
                          </span>
                        )}
                      </div>
                      <div 
                        className="text-xs font-mono font-semibold text-slate-300 bg-white/5 px-2 py-0.5 rounded-lg border border-white/10 shrink-0"
                        title={info.formula}
                      >
                        {shortFormula}
                      </div>
                    </div>

                    {/* Jauge visuelle avec rôle meter accessible et curseur dynamique de situation athlète */}
                    <div className="my-2.5">
                      <div 
                        role="meter"
                        aria-label={`Niveau et positionnement de ${info.name}`}
                        aria-valuenow={Math.round(gaugePercent)}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuetext={`${info.name} : ${mainNumber} ${unitLabel}, ${info.currentInterpretation}`}
                        className="relative w-full h-2.5 rounded-full overflow-hidden flex bg-white/10 shadow-inner"
                      >
                        {isTsb && (
                          <>
                            <div className="h-full bg-red-500/70" style={{ width: '18.75%' }} title="Surcharge critique (< -35% CTL)" />
                            <div className="h-full bg-indigo-500/70" style={{ width: '31.25%' }} title="Surcharge stimulante (-35% à -10% CTL)" />
                            <div className="h-full bg-sky-500/70" style={{ width: '18.75%' }} title="Neutre / Équilibre (-10% à +5% CTL)" />
                            <div className="h-full bg-emerald-500" style={{ width: '25%' }} title="Zone d'affûtage / Pic (+5% à +25% CTL)" />
                            <div className="h-full bg-amber-500/70" style={{ width: '6.25%' }} title="Sur-fraîcheur (> +25% CTL)" />
                          </>
                        )}
                        {isAtl && (
                          <>
                            <div className="h-full bg-sky-500/70" style={{ width: '35%' }} title="Frais / Récupération (< 0.95x)" />
                            <div className="h-full bg-slate-500/70" style={{ width: '15%' }} title="Maintien / Équilibre (0.95x à 1.10x)" />
                            <div className="h-full bg-emerald-500" style={{ width: '25%' }} title="Stimulus optimal (1.10x à 1.35x)" />
                            <div className="h-full bg-red-500" style={{ width: '25%' }} title="Surcharge aiguë (> 1.35x)" />
                          </>
                        )}
                        {isCtl && (
                          <>
                            <div className="h-full bg-slate-600" style={{ width: '20%' }} title="Déclin (< -3 pts/sem)" />
                            <div className="h-full bg-sky-500/70" style={{ width: '25%' }} title="Maintien (-2 à +2 pts/sem)" />
                            <div className="h-full bg-emerald-500" style={{ width: '35%' }} title="Progression optimale (+3 à +7 pts/sem)" />
                            <div className="h-full bg-amber-500" style={{ width: '20%' }} title="Montée trop rapide (> +8 pts/sem)" />
                          </>
                        )}
                      </div>
                      
                      {/* Curseur dynamique blanc net */}
                      <div className="relative w-full h-2.5 -mt-2.5 pointer-events-none">
                        <div 
                          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,1)] border-2 border-slate-900 transition-all duration-500"
                          style={{ left: `${gaugePercent}%` }}
                        />
                      </div>
                      
                      {/* Sous-titres de repères de la jauge sans chevauchement */}
                      <div className="flex items-center justify-between text-xs font-mono text-slate-300 mt-1.5 gap-1">
                        <span className="truncate max-w-[32%] text-left" title={gaugeSubtextLeft}>{gaugeSubtextLeft}</span>
                        <span className="text-emerald-400 font-bold truncate max-w-[36%] text-center shrink-0" title={gaugeSubtextCenter}>{gaugeSubtextCenter}</span>
                        <span className="truncate max-w-[32%] text-right" title={gaugeSubtextRight}>{gaugeSubtextRight}</span>
                      </div>
                    </div>

                    {/* Diagnostic textuel avec bouton accessible */}
                    <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs min-w-0 gap-2">
                      <span className={`font-semibold truncate min-w-0 ${statusColor}`}>
                        {info.currentInterpretation}
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveTooltip(activeTooltip === key ? null : key)}
                        aria-haspopup="dialog"
                        aria-expanded={isActive}
                        aria-controls={`physio-tooltip-${key}`}
                        className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1 shrink-0 p-1 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 cursor-pointer"
                      >
                        <span>Seuils & Rôle</span>
                        <Info size={12} aria-hidden="true" />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>

            {/* POPOVER / INFOBULLE DÉTAILLÉE FLOTTANTE AU SURVOL / CLIC */}
            {activeTooltip && physioTooltips[activeTooltip] && (
              <div 
                id={`physio-tooltip-${activeTooltip}`}
                role="dialog"
                aria-modal="true"
                tabIndex={-1}
                aria-label={physioTooltips[activeTooltip].fullTitle}
                className="absolute z-50 left-0 right-0 top-full mt-3 p-4 sm:p-5 bg-[#0f172a]/98 backdrop-blur-xl border border-white/15 rounded-2xl shadow-2xl animate-fadeIn text-slate-100 max-w-3xl mx-auto focus:outline-none focus:ring-2 focus:ring-blue-400"
                onMouseEnter={() => setActiveTooltip(activeTooltip)}
                onMouseLeave={() => setActiveTooltip(null)}
              >
                <div className="flex items-start justify-between gap-3 pb-3 border-b border-white/10 mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-black font-mono border ${physioTooltips[activeTooltip].bgColor} ${physioTooltips[activeTooltip].color}`}>
                        {physioTooltips[activeTooltip].name}
                      </span>
                      <h4 className="text-sm font-bold text-white m-0">
                        {physioTooltips[activeTooltip].fullTitle}
                      </h4>
                    </div>
                    <p className="text-xs text-blue-300 font-mono mt-1 flex items-center gap-1.5">
                      <SlidersHorizontal size={12} className="text-blue-400 shrink-0" />
                      <span>Formule : {physioTooltips[activeTooltip].formula}</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTooltip(null)}
                    aria-label="Fermer la fenêtre d'explication (ou touche Échap)"
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Section 1 : Rôle physiologique */}
                <div className="mb-4">
                  <h5 className="text-[11px] uppercase tracking-wider font-bold text-slate-400 mb-1 flex items-center gap-1.5">
                    <Activity size={12} className="text-blue-400" />
                    Rôle Physiologique & Mécanisme
                  </h5>
                  <p className="text-xs text-slate-200 leading-relaxed bg-white/5 p-3 rounded-xl border border-white/5 m-0">
                    {physioTooltips[activeTooltip].role}
                  </p>
                </div>

                {/* Section 2 : Seuils de normalité & Interprétation */}
                <div>
                  <h5 className="text-[11px] uppercase tracking-wider font-bold text-slate-400 mb-2 flex items-center gap-1.5">
                    <SlidersHorizontal size={12} className="text-blue-400" />
                    Seuils de Normalité & Zones d'Interprétation
                  </h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {physioTooltips[activeTooltip].thresholds.map((t, idx) => (
                      <div key={idx} className="p-2.5 rounded-xl bg-black/40 border border-white/5 flex flex-col justify-between gap-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${t.tagClass}`}>
                            {t.zone}
                          </span>
                          <span className="text-[11px] font-bold text-slate-200 truncate">
                            {t.title}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-snug m-0">
                          {t.detail}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Section 3 : Valeur actuelle de l'athlète */}
                <div className="mt-3.5 pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">Votre niveau aujourd'hui :</span>
                    <span className="font-bold text-white font-mono bg-white/10 px-2 py-0.5 rounded border border-white/10">
                      {physioTooltips[activeTooltip].currentValue}
                    </span>
                    <span className="text-blue-300 font-semibold">
                      ({physioTooltips[activeTooltip].currentInterpretation})
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 italic">
                    Cliquez en dehors ou appuyez sur Échap pour fermer
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* BARRE D'ACCESSIBILITÉ & NAVIGATION CLAVIER TEMPORELLE (WCAG 2.1 & 2.2) */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 p-3 rounded-2xl bg-slate-900/60 border border-white/10 shadow-lg">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar size={14} className="text-blue-400" />
                <span className="hidden sm:inline">Navigation temporelle accessible :</span>
                <span className="sm:hidden">Naviguer :</span>
              </span>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={!canGoPrev}
                  onClick={handlePrevDay}
                  className="min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none text-slate-200 border border-white/10 transition-all flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 cursor-pointer"
                  aria-label="Inspecter le jour précédent (J-1)"
                  title="Reculer d'un jour (J-1)"
                >
                  <ChevronLeft size={16} aria-hidden="true" />
                  <span>J-1</span>
                </button>

                {/* Sélecteur de date accessible au clavier */}
                <label htmlFor="banister-day-select" className="sr-only">Sélectionner une date à inspecter</label>
                <select
                  id="banister-day-select"
                  value={currentInspectedDay?.dateStr || ''}
                  onChange={(e) => {
                    const target = chartData.find(d => d.dateStr === e.target.value);
                    if (target) {
                      setSelectedBanisterDay(target);
                      setIsDayPinned(true);
                    }
                  }}
                  className="min-h-[44px] px-3 py-2 rounded-xl text-xs font-mono bg-slate-800 text-slate-200 border border-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 cursor-pointer"
                >
                  {chartData.map(d => (
                    <option key={d.dateStr} value={d.dateStr}>
                      {d.dateStr} {d.isToday ? '(Aujourd\'hui)' : d.isFuture ? `(+${d.offset}j)` : `(J${d.offset})`} — TSB: {d.tsb > 0 ? `+${d.tsb}` : d.tsb}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  disabled={!canGoNext}
                  onClick={handleNextDay}
                  className="min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none text-slate-200 border border-white/10 transition-all flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 cursor-pointer"
                  aria-label="Inspecter le jour suivant (J+1)"
                  title="Avancer d'un jour (J+1)"
                >
                  <span>J+1</span>
                  <ChevronRight size={16} aria-hidden="true" />
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowDataTable(prev => !prev)}
              aria-expanded={showDataTable}
              className="min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-slate-200 hover:text-white border border-white/10 transition-all flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 cursor-pointer"
              title="Afficher le tableau accessible des relevés Banister et VFC"
            >
              <TableIcon size={16} className="text-blue-400" aria-hidden="true" />
              <span>{showDataTable ? 'Masquer tableau' : 'Tableau de données (WCAG)'}</span>
            </button>
          </div>

          {/* TABLEAU ACCESSIBLE ALTERNATIF (WCAG 1.1.1 & 2.1.1) */}
          {showDataTable && (
            <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-4 overflow-hidden shadow-xl animate-fadeIn">
              <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
                <div className="flex items-center gap-2">
                  <TableIcon size={16} className="text-blue-400" aria-hidden="true" />
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider m-0">Tableau de Données Physiologiques (Modélisation Banister PMC & VFC)</h4>
                </div>
                <span className="text-[11px] text-slate-400 font-mono">
                  {chartData.length} jours répertoriés
                </span>
              </div>
              <div className="overflow-x-auto max-h-72">
                <table className="w-full text-left text-xs border-collapse">
                  <caption className="sr-only">Relevé chronologique des métriques Banister : charge quotidienne, fatigue aiguë ATL, condition CTL, forme TSB et VFC</caption>
                  <thead className="bg-white/5 text-slate-300 font-semibold sticky top-0 backdrop-blur-md">
                    <tr>
                      <th scope="col" className="p-2 border-b border-white/10 font-mono">Date</th>
                      <th scope="col" className="p-2 border-b border-white/10">Repère</th>
                      <th scope="col" className="p-2 border-b border-white/10 text-right">Charge</th>
                      <th scope="col" className="p-2 border-b border-white/10 text-right">ATL ({tauFatigue}j)</th>
                      <th scope="col" className="p-2 border-b border-white/10 text-right">CTL ({tauFitness}j)</th>
                      <th scope="col" className="p-2 border-b border-white/10 text-right">TSB Forme</th>
                      <th scope="col" className="p-2 border-b border-white/10 text-right">VFC</th>
                      <th scope="col" className="p-2 border-b border-white/10 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono">
                    {chartData.map((d) => {
                      const isSelected = d.dateStr === currentInspectedDay?.dateStr;
                      return (
                        <tr 
                          key={d.dateStr}
                          className={`hover:bg-white/5 transition-colors ${isSelected ? 'bg-blue-500/15 text-white font-bold' : 'text-slate-300'}`}
                        >
                          <td className="p-2">{d.dateStr}</td>
                          <td className="p-2 font-sans text-[11px]">
                            {d.isToday ? (
                              <span className="text-blue-400 font-bold">Aujourd'hui</span>
                            ) : d.isFuture ? (
                              <span className="text-purple-400">J+{d.offset}</span>
                            ) : (
                              <span className="text-slate-400">J{d.offset}</span>
                            )}
                          </td>
                          <td className="p-2 text-right text-amber-300 font-bold">{d.load}</td>
                          <td className="p-2 text-right text-rose-400">{d.loadEMA7}</td>
                          <td className="p-2 text-right text-sky-400">{d.loadEMA21}</td>
                          <td className="p-2 text-right">
                            <span className={d.tsb >= 5 ? 'text-emerald-400 font-bold' : d.tsb >= -10 ? 'text-sky-300' : 'text-rose-400'}>
                              {d.tsb > 0 ? `+${d.tsb}` : d.tsb}
                            </span>
                          </td>
                          <td className="p-2 text-right text-emerald-400">{d.vfc ? `${d.vfc} ms` : '-'}</td>
                          <td className="p-2 text-center font-sans">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedBanisterDay(d);
                                setIsDayPinned(true);
                              }}
                              className="min-h-[44px] px-3 py-1.5 rounded-lg text-xs font-bold bg-white/10 hover:bg-blue-600 text-white transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                              aria-label={`Inspecter la journée du ${d.dateStr}`}
                            >
                              Inspecter
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* GRAPHIQUES GLOBAUX BANISTER + VFC */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-0">
            
            {/* GRAPHIQUE 1 : Charge Globale (Banister) */}
            <section 
              aria-labelledby="heading-banister-pmc"
              className="flex flex-col h-[340px] sm:h-[380px] bg-slate-900/60 border border-white/10 rounded-2xl p-3.5 sm:p-4 min-h-0 relative shadow-xl"
            >
              <div className="sr-only">
                Graphique de modélisation Banister Performance Management Chart. Affiche les courbes de fatigue ATL ({tauFatigue} jours), condition CTL ({tauFitness} jours) et forme TSB. Jour inspecté : {currentInspectedDay?.dateStr || 'Aujourd\'hui'}.
              </div>

              <div className="flex items-center justify-between mb-2 shrink-0 flex-wrap gap-1.5 sm:gap-2">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <Activity size={13} className="text-blue-400 shrink-0" />
                  <h4 id="heading-banister-pmc" className="text-xs font-bold text-slate-200 uppercase tracking-wider m-0">
                    <span className="sm:hidden">Modèle PMC</span>
                    <span className="hidden sm:inline">Modélisation PMC (Charge & Forme)</span>
                  </h4>
                </div>
                
                {/* Légendes interactives avec cibles tactiles de 44px et aria-pressed */}
                <div className="flex items-center gap-1.5 flex-wrap" role="toolbar" aria-label="Affichage des courbes PMC">
                  <button
                    type="button"
                    onClick={() => setBanisterCurves(p => ({ ...p, atl: !p.atl }))}
                    aria-pressed={banisterCurves.atl}
                    className={`inline-flex items-center gap-1.5 min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 ${
                      banisterCurves.atl 
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-sm' 
                        : 'bg-white/5 text-slate-500 border-white/5 line-through opacity-50'
                    }`}
                    title="Cliquer pour afficher/masquer la courbe de fatigue ATL"
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-400" aria-hidden="true" />
                    <span>ATL <span className="hidden xs:inline">({tauFatigue}j)</span></span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBanisterCurves(p => ({ ...p, ctl: !p.ctl }))}
                    aria-pressed={banisterCurves.ctl}
                    className={`inline-flex items-center gap-1.5 min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
                      banisterCurves.ctl 
                        ? 'bg-sky-500/20 text-sky-300 border-sky-500/40 shadow-sm' 
                        : 'bg-white/5 text-slate-500 border-white/5 line-through opacity-50'
                    }`}
                    title="Cliquer pour afficher/masquer la courbe de condition CTL"
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-sky-400" aria-hidden="true" />
                    <span>CTL <span className="hidden xs:inline">({tauFitness}j)</span></span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBanisterCurves(p => ({ ...p, tsb: !p.tsb }))}
                    aria-pressed={banisterCurves.tsb}
                    className={`inline-flex items-center gap-1.5 min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                      banisterCurves.tsb 
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm' 
                        : 'bg-white/5 text-slate-500 border-white/5 line-through opacity-50'
                    }`}
                    title="Cliquer pour afficher/masquer la courbe de forme TSB"
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" aria-hidden="true" />
                    <span>TSB</span>
                  </button>

                  {isSimulationActive && (
                    <span className="text-[11px] font-bold px-2.5 py-1.5 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      Simu
                    </span>
                  )}
                </div>
              </div>

              <div className="flex-1 w-full min-h-[200px] relative">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart 
                    data={chartData} 
                    margin={{ top: 5, right: 8, left: -20, bottom: 0 }}
                    onClick={(e) => {
                      if (e && e.activePayload && e.activePayload[0]) {
                        setSelectedBanisterDay(e.activePayload[0].payload);
                        setIsDayPinned(true);
                      }
                    }}
                  >
                    <defs>
                      <linearGradient id="colorAigue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorChronique" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#38bdf8" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="day" stroke="#94a3b8" tick={{ fontSize: 11, fill: '#94a3b8' }} minTickGap={20} tickLine={false} axisLine={false} />
                    <YAxis stroke="#94a3b8" tick={{ fontSize: 11, fill: '#94a3b8' }} width={26} tickLine={false} axisLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    
                    {currentInspectedDay && (
                      <ReferenceLine 
                        x={currentInspectedDay.day} 
                        stroke="#38bdf8" 
                        strokeWidth={2} 
                        strokeDasharray="3 3" 
                      />
                    )}

                    {banisterCurves.atl && (
                      <Area type="monotone" dataKey="loadEMA7" name={`Fatigue Aiguë ATL (${tauFatigue}j)`} stroke="#f43f5e" strokeWidth={2} fillOpacity={1} fill="url(#colorAigue)" />
                    )}
                    {banisterCurves.ctl && (
                      <Area type="monotone" dataKey="loadEMA21" name={`Condition CTL (${tauFitness}j)`} stroke="#38bdf8" strokeWidth={2} fillOpacity={1} fill="url(#colorChronique)" />
                    )}
                    {banisterCurves.tsb && (
                      <Line type="monotone" dataKey="tsb" name="Forme TSB (Readiness)" stroke="#10b981" strokeWidth={2.5} dot={false} />
                    )}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* GRAPHIQUE 2 : Tendance VFC */}
            <section 
              aria-labelledby="heading-banister-vfc"
              className="flex flex-col min-h-[340px] bg-slate-900/60 border border-white/10 rounded-2xl p-3.5 sm:p-4 relative shadow-xl"
            >
              <div className="sr-only">
                Graphique de variabilité de fréquence cardiaque (VFC) et ligne de base. Analyse parasympathique et récupération autonome.
              </div>

              <div className="flex items-center justify-between mb-2 shrink-0 flex-wrap gap-1.5 sm:gap-2">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <Activity size={13} className="text-emerald-400 shrink-0" />
                  <h4 id="heading-banister-vfc" className="text-xs font-bold text-slate-200 uppercase tracking-wider m-0">
                    Variabilité Cardiaque (VFC)
                  </h4>
                </div>

                {/* Légendes interactives avec cibles tactiles de 44px et aria-pressed */}
                <div className="flex items-center gap-1.5 flex-wrap" role="toolbar" aria-label="Affichage des courbes VFC">
                  <button
                    type="button"
                    onClick={() => setVfcCurves(p => ({ ...p, vfc: !p.vfc }))}
                    aria-pressed={vfcCurves.vfc}
                    className={`inline-flex items-center gap-1.5 min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
                      vfcCurves.vfc 
                        ? 'bg-white/10 text-slate-200 border-white/20 shadow-sm' 
                        : 'bg-white/5 text-slate-500 border-white/5 line-through opacity-50'
                    }`}
                    title="Cliquer pour afficher/masquer la VFC quotidienne nette"
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-white/70" aria-hidden="true" />
                    <span>Nette</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setVfcCurves(p => ({ ...p, ema3: !p.ema3 }))}
                    aria-pressed={vfcCurves.ema3}
                    className={`inline-flex items-center gap-1.5 min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                      vfcCurves.ema3 
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm' 
                        : 'bg-white/5 text-slate-500 border-white/5 line-through opacity-50'
                    }`}
                    title="Cliquer pour afficher/masquer la VFC EMA 3j"
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" aria-hidden="true" />
                    <span>EMA 3j</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setVfcCurves(p => ({ ...p, ema7: !p.ema7 }))}
                    aria-pressed={vfcCurves.ema7}
                    className={`inline-flex items-center gap-1.5 min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-400 ${
                      vfcCurves.ema7 
                        ? 'bg-pink-500/20 text-pink-300 border-pink-500/40 shadow-sm' 
                        : 'bg-white/5 text-slate-500 border-white/5 line-through opacity-50'
                    }`}
                    title="Cliquer pour afficher/masquer la VFC Ligne de Base EMA 7j"
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-pink-400" aria-hidden="true" />
                    <span>Base 7j</span>
                  </button>
                </div>
              </div>

              <div className="h-[210px] sm:h-[240px] w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="day" stroke="#94a3b8" tick={{ fontSize: 11, fill: '#94a3b8' }} minTickGap={20} tickLine={false} axisLine={false} />
                    <YAxis stroke="#94a3b8" domain={['auto', 'auto']} tick={{ fontSize: 11, fill: '#94a3b8' }} width={26} tickLine={false} axisLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    
                    {vfcCurves.vfc && (
                      <Line type="monotone" dataKey="vfc" name="VFC Nette" stroke="rgba(255,255,255,0.3)" strokeWidth={1} dot={{ r: 2, fill: 'rgba(255,255,255,0.4)', strokeWidth: 0 }} connectNulls />
                    )}
                    {vfcCurves.ema3 && (
                      <Line type="monotone" dataKey="vfcEMA3" name="VFC EMA 3j" stroke="#10b981" strokeWidth={2} dot={false} />
                    )}
                    {vfcCurves.ema7 && (
                      <Line type="monotone" dataKey="vfcEMA7" name="VFC Ligne de Base (EMA 7j)" stroke="#ec4899" strokeWidth={1.5} dot={false} strokeDasharray="5 5" />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Analyse statistique personnalisée VFC (SWC Plews et al.) et FC de Repos */}
              {(vfcAnalysis || hrRestAnalysis) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-3 border-t border-white/10 text-xs">
                  {vfcAnalysis && (
                    <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-200">Variabilité Cardiaque (VFC)</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded border ${
                          vfcAnalysis.status === 'optimal' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' :
                          vfcAnalysis.status === 'low' ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' :
                          vfcAnalysis.status === 'high' ? 'bg-sky-500/20 text-sky-300 border-sky-500/30' :
                          'bg-slate-500/20 text-slate-300 border-slate-500/30'
                        }`}>
                          {vfcAnalysis.badge}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 m-0 leading-relaxed">
                        {vfcAnalysis.interpretation}
                      </p>
                      {vfcAnalysis.corridorLower !== null && vfcAnalysis.corridorUpper !== null && (
                        <div className="text-xs text-slate-300 font-mono">
                          Corridor SWC (0.5 SD) : {vfcAnalysis.corridorLower} – {vfcAnalysis.corridorUpper} ms • Base 7j : {vfcAnalysis.baseline7d} ms
                        </div>
                      )}
                    </div>
                  )}

                  {hrRestAnalysis && (
                    <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-200">FC de Repos au Réveil</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded border ${
                          hrRestAnalysis.status === 'optimal' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' :
                          hrRestAnalysis.status === 'elevated' ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' :
                          hrRestAnalysis.status === 'low' ? 'bg-sky-500/20 text-sky-300 border-sky-500/30' :
                          'bg-slate-500/20 text-slate-300 border-slate-500/30'
                        }`}>
                          {hrRestAnalysis.badge}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 m-0 leading-relaxed">
                        {hrRestAnalysis.interpretation}
                      </p>
                      {hrRestAnalysis.median28d !== null && (
                        <div className="text-xs text-slate-300 font-mono">
                          Médiane 28j : {hrRestAnalysis.median28d} bpm • Écart à date : {hrRestAnalysis.deltaBpm !== null && hrRestAnalysis.deltaBpm > 0 ? `+${hrRestAnalysis.deltaBpm}` : hrRestAnalysis.deltaBpm} bpm
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </section>

          </div>

          {/* POINT 4 : PANNEAU D'INSPECTION & DIAGNOSTIC DYNAMIQUE DE CHARGE BANISTER */}
          {currentInspectedDay && banisterInterpretation && (
            <section 
              id="banister-day-inspector"
              aria-label="Inspecteur physiologique du jour sélectionné"
              aria-live="polite"
              className="bg-slate-900/70 border border-white/10 rounded-2xl p-4 sm:p-5 flex flex-col gap-4 shadow-xl"
            >
              {/* En-tête avec date inspectée, badge temporel, état épinglé et bouton retour aujourd'hui */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <div className="p-2 rounded-xl bg-blue-500/15 text-blue-400 border border-blue-500/25" aria-hidden="true">
                    <Calendar size={16} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-white capitalize m-0">
                        {formatFullInspectionDate(currentInspectedDay.dateStr)}
                      </h4>
                      {currentInspectedDay.isToday ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-black bg-blue-500/25 text-blue-300 border border-blue-500/40">
                          Aujourd'hui (Jour J)
                        </span>
                      ) : currentInspectedDay.isFuture ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-black bg-purple-500/25 text-purple-300 border border-purple-500/40">
                          Projection (+{currentInspectedDay.offset}j)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-white/10 text-slate-200 border border-white/10">
                          J{currentInspectedDay.offset}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-300 mt-0.5 mb-0 hidden sm:block">
                      Cliquez sur la courbe Banister pour figer une date ou naviguez via la barre chronologique
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isDayPinned ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 px-3 py-1.5 rounded-xl">
                      <Pin size={13} className="text-amber-400" aria-hidden="true" /> Date Épinglée
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-slate-300 bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl font-mono">
                      Survol interactif
                    </span>
                  )}

                  {(!currentInspectedDay.isToday || isDayPinned) && (
                    <button
                      type="button"
                      onClick={() => {
                        const todayItem = chartData.find(d => d.isToday);
                        setSelectedBanisterDay(todayItem || null);
                        setIsDayPinned(false);
                      }}
                      className="flex items-center gap-1.5 min-h-[44px] px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-blue-300 hover:text-blue-200 border border-white/10 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                      title="Réinitialiser l'inspection sur la date d'aujourd'hui"
                    >
                      <RotateCcw size={13} aria-hidden="true" />
                      <span>Aujourd'hui</span>
                    </button>
                  )}
                </div>
              </div>

              {/* 4 Métriques Clés Instantanées du Jour Inspecté */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                {/* Forme TSB */}
                <div className="p-2.5 sm:p-3 rounded-xl bg-black/40 border border-white/10 flex flex-col justify-between">
                  <span className="text-xs uppercase font-bold tracking-wider text-slate-300 block truncate">
                    Forme (TSB)
                  </span>
                  <div className="flex items-baseline gap-2 my-1">
                    <span className={`text-xl sm:text-2xl font-black font-mono ${
                      currentInspectedDay.tsb >= 10 ? 'text-emerald-400' :
                      currentInspectedDay.tsb >= 0 ? 'text-sky-300' :
                      currentInspectedDay.tsb >= -25 ? 'text-indigo-300' : 'text-rose-400'
                    }`}>
                      {currentInspectedDay.tsb > 0 ? `+${currentInspectedDay.tsb}` : currentInspectedDay.tsb}
                    </span>
                  </div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded border inline-block truncate max-w-full ${banisterInterpretation.zoneBadge}`}>
                    {banisterInterpretation.zoneTitle}
                  </span>
                </div>

                {/* Fatigue Aiguë ATL */}
                <div className="p-2.5 sm:p-3 rounded-xl bg-black/40 border border-white/10 flex flex-col justify-between">
                  <span className="text-xs uppercase font-bold tracking-wider text-slate-300 block truncate">
                    Fatigue (ATL)
                  </span>
                  <div className="flex items-baseline gap-1.5 my-1">
                    <span className="text-xl sm:text-2xl font-black font-mono text-rose-400">
                      {currentInspectedDay.loadEMA7}
                    </span>
                    <span className="text-xs font-mono text-slate-300">pts</span>
                  </div>
                  <span className="text-xs font-mono text-slate-300 truncate">
                    Moyenne {tauFatigue}j
                  </span>
                </div>

                {/* Condition CTL */}
                <div className="p-2.5 sm:p-3 rounded-xl bg-black/40 border border-white/10 flex flex-col justify-between">
                  <span className="text-xs uppercase font-bold tracking-wider text-slate-300 block truncate">
                    Condition (CTL)
                  </span>
                  <div className="flex items-baseline gap-1.5 my-1">
                    <span className="text-xl sm:text-2xl font-black font-mono text-sky-400">
                      {currentInspectedDay.loadEMA21}
                    </span>
                    <span className="text-xs font-mono text-slate-300">pts</span>
                  </div>
                  <span className="text-xs font-mono text-slate-300 truncate">
                    Moyenne {tauFitness}j
                  </span>
                </div>

                {/* Charge Quotidienne */}
                <div className="p-2.5 sm:p-3 rounded-xl bg-black/40 border border-white/10 flex flex-col justify-between">
                  <span className="text-xs uppercase font-bold tracking-wider text-slate-300 block truncate">
                    Charge Jour
                  </span>
                  <div className="flex items-baseline gap-1.5 my-1">
                    <span className="text-xl sm:text-2xl font-black font-mono text-amber-300">
                      {currentInspectedDay.load}
                    </span>
                    <span className="text-xs font-mono text-slate-300">pts</span>
                  </div>
                  <span className="text-xs font-mono text-slate-300 truncate">
                    {currentInspectedDay.sessions?.length || 0} séance(s)
                  </span>
                </div>
              </div>

              {/* Explication Contextuelle Rédigée en Français Clair */}
              <div className="p-3.5 rounded-xl bg-black/30 border border-white/5 space-y-2">
                <div className="flex items-center gap-2">
                  <Sparkles size={14} className="text-blue-400 shrink-0" aria-hidden="true" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Diagnostic Physiologique & Recommandation
                  </span>
                </div>
                <p className="text-xs text-slate-200 leading-relaxed m-0">
                  {banisterInterpretation.summary}
                </p>
                <div className="text-xs text-emerald-300 font-medium bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-lg flex items-start gap-2">
                  <Target size={14} className="text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <strong className="text-emerald-200">Conseil d'entraînement :</strong> {banisterInterpretation.prescription}
                  </div>
                </div>

                {/* Triptyque Biométrique du Réveil (Readiness, VFC, FC de Repos) */}
                {(currentInspectedDay.readiness || currentInspectedDay.vfc || currentInspectedDay.hrRest) && (
                  <div className="mt-2 pt-2 border-t border-white/10 flex flex-wrap items-center gap-2 sm:gap-3 text-xs font-mono">
                    <span className="text-xs uppercase font-bold text-slate-300 font-sans">Biométrie du Réveil :</span>
                    {currentInspectedDay.readiness && (
                      <span className="inline-flex items-center gap-1.5 text-blue-300 bg-blue-500/10 px-2.5 py-1 rounded-lg border border-blue-500/20">
                        <Zap size={12} className="text-blue-400 shrink-0" aria-hidden="true" /> Readiness : <strong>{currentInspectedDay.readiness}/10</strong>
                      </span>
                    )}
                    {currentInspectedDay.vfc && (
                      <span className="inline-flex items-center gap-1.5 text-emerald-300 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                        <Activity size={12} className="text-emerald-400 shrink-0" aria-hidden="true" /> VFC : <strong>{currentInspectedDay.vfc} ms</strong>
                      </span>
                    )}
                    {currentInspectedDay.hrRest && (
                      <span className="inline-flex items-center gap-1.5 text-rose-300 bg-rose-500/10 px-2.5 py-1 rounded-lg border border-rose-500/20">
                        <Heart size={12} className="text-rose-400 shrink-0" aria-hidden="true" /> FC Repos : <strong>{currentInspectedDay.hrRest} bpm</strong>
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Séances Enregistrées Réalisées Ce Jour-Là */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs uppercase tracking-wider font-bold text-slate-200 flex items-center gap-1.5">
                    <Dumbbell size={14} className="text-blue-400" aria-hidden="true" />
                    Séances Réalisées Ce Jour ({currentInspectedDay.sessions?.length || 0})
                  </span>
                </div>

                {currentInspectedDay.sessions && currentInspectedDay.sessions.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    {currentInspectedDay.sessions.map((s, idx) => (
                      <div key={idx} className="p-2.5 rounded-xl bg-black/40 border border-white/5 flex flex-col justify-between gap-1 hover:border-blue-500/30 transition-all">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-white truncate">
                            {s.qualityName}
                          </span>
                          <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                            {s.load} pts
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs font-mono text-slate-300 mt-1">
                          <span className="flex items-center gap-1">
                            <Clock size={11} className="text-slate-300 shrink-0" aria-hidden="true" /> {s.duration} min
                          </span>
                          <span>RPE C:{s.rpeC} · M:{s.rpeM}{s.fatigue ? ` · Fat:${s.fatigue}/10` : ''}</span>
                        </div>
                        {s.notes && (
                          <p className="text-xs text-slate-300 italic line-clamp-1 m-0 pt-1 border-t border-white/5">
                            « {s.notes} »
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3.5 rounded-xl bg-white/[0.02] border border-dashed border-white/10 text-xs text-slate-300 flex items-center justify-center gap-2">
                    <Calendar size={14} className="text-emerald-400 shrink-0" aria-hidden="true" />
                    <span>Journée de repos (0 point de charge) — Favorable à l'abaissement de la fatigue aiguë ATL et au relèvement du TSB.</span>
                  </div>
                )}
              </div>
            </section>
          )}
        </>
      )}

      {/* FOCUS QUALITÉ INDIVIDUELLE : COURBES EMA 3 / 7 / 21 JOURS & TENDANCES */}
      {showQualities && qualities.length > 0 && (
        <div className="flex flex-col gap-6">
          {/* POINT 5 : RUBAN DE STATUT DE RÉMANENCE IMMÉDIAT (« QUICK STATUS BAR ») */}
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

              {/* Filtres rapides d'urgence du ruban avec min-h 44px */}
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
                  <span>✅ Consolidées</span>
                  <span className="px-1.5 py-0.5 rounded-full text-xs font-mono bg-black/40 font-bold">
                    {optimalCount}
                  </span>
                </button>
              </div>
            </div>

            {/* Défilement horizontal des cartes de rémanence express */}
            <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar pt-1" role="region" aria-label="Cartes de rémanence défilantes">
              {filteredRemanenceList.map(item => {
                const isSelected = item.quality.id === selectedQualityId;
                const IconComponent = item.statusIcon;

                // Couleur de jauge dynamique selon le % restant
                const gaugeColor = 
                  item.remainingPercent >= 70 ? '#10b981' :
                  item.remainingPercent >= 40 ? '#f59e0b' :
                  item.remainingPercent > 0 ? '#f97316' : '#ef4444';

                return (
                  <div
                    key={item.quality.id}
                    role="button"
                    tabIndex={0}
                    aria-pressed={isSelected}
                    aria-label={`Filière ${item.quality.name}, statut ${item.statusLabel}, rémanence ${item.remainingPercent}%`}
                    onClick={() => setSelectedQualityId(item.quality.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedQualityId(item.quality.id);
                      }
                    }}
                    className={`shrink-0 w-64 p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                      isSelected
                        ? 'bg-blue-950/60 border-blue-400 ring-2 ring-blue-500/60 shadow-lg shadow-blue-500/20'
                        : 'bg-slate-900/80 border-white/10 hover:border-white/20 hover:bg-slate-900'
                    }`}
                    title="Cliquer pour afficher les courbes EMA et l'historique complet de cette qualité"
                  >
                    {/* Header : Rang (#1, #2...) + Nom + Jauge circulaire */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-xs font-black font-mono px-1.5 py-0.5 rounded ${
                            isSelected ? 'bg-blue-500 text-white' : 'bg-white/10 text-slate-200'
                          }`}>
                            #{item.rank}
                          </span>
                          <span className="text-xs font-bold text-white truncate block">
                            {item.quality.name}
                          </span>
                        </div>
                        <span className="text-xs text-slate-300 font-mono mt-1 block">
                          Fenêtre : {item.plateauDays}j g + {item.declineDays}j o
                        </span>
                      </div>

                      {/* Mini-jauge circulaire SVG avec % exact */}
                      <CircularRemanenceGauge 
                        percent={item.remainingPercent} 
                        color={gaugeColor} 
                        size={40} 
                        strokeWidth={3.5} 
                      />
                    </div>

                    {/* Badge de statut immédiat */}
                    <div className="mb-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold border ${item.statusBg}`}>
                        <IconComponent size={11} className="shrink-0" aria-hidden="true" />
                        <span className="truncate">{item.statusLabel}</span>
                      </span>
                    </div>

                    {/* Ligne d'action & dernier rappel */}
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
                <div className="w-full py-4 text-center text-xs text-slate-300 bg-white/[0.02] rounded-xl border border-white/5">
                  Aucune qualité ne correspond à ce filtre de rémanence.
                </div>
              )}
            </div>
          </section>

          <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-4 sm:p-5 flex flex-col gap-4 shadow-xl">
          {/* EN-TÊTE ÉPURÉ : NOM DE LA FILIÈRE + SÉLECTEUR DE COMPARAISON IMMÉDIATEMENT ATTACHÉ */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Filière Active :</span>
                <span className="text-base sm:text-lg font-black font-mono text-blue-400 bg-blue-500/10 px-3 py-1 rounded-xl border border-blue-500/25">
                  {activeQualityData.qDef?.name || selectedQualityId}
                </span>
              </div>

              {/* Rapprochement des filtres temporels directement à côté de la filière active avec 44px touch target */}
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
                  title="Compare chaque EMA à sa fenêtre d'oscillation (3j/7j/21j)"
                >
                  Période (3j/7j/21j)
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
                  title="Compare l'EMA d'aujourd'hui à celle d'hier (J-1)"
                >
                  J-1 (Veille)
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
                  title="Compare l'EMA d'aujourd'hui à celle de la semaine passée (J-7)"
                >
                  J-7 (Semaine)
                </button>
              </div>
            </div>

            {/* Sémantique claire des tendances */}
            <div className="text-xs font-mono text-slate-300 flex items-center gap-2 bg-black/25 px-3 py-1.5 rounded-lg border border-white/5">
              <span className="flex items-center gap-1 text-emerald-400 font-bold">
                <ArrowUp size={12} className="stroke-[3]" aria-hidden="true" /> Hausse
              </span>
              <span className="text-slate-500">|</span>
              <span className="flex items-center gap-1 text-rose-400 font-bold">
                <ArrowDown size={12} className="stroke-[3]" aria-hidden="true" /> Baisse
              </span>
            </div>
          </div>

          {/* SÉLECTEUR DE FILIÈRES : GROUPEMENT PAR CATÉGORIES + RECHERCHE + BADGES ÉPURÉS SANS 0 */}
          <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Onglets de filtrage par catégorie physiologique avec cibles 44px */}
              <div className="flex items-center gap-2 flex-wrap" role="radiogroup" aria-label="Filtrer les qualités par catégorie">
                {[
                  { id: 'all', label: 'Toutes' },
                  { id: 'cardio', label: '🫀 Cardio' },
                  { id: 'force', label: '🏋️ Force' },
                  { id: 'specific', label: '⚡ Spécifique' }
                ].map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    role="radio"
                    aria-checked={selectedCategory === cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-3.5 py-2 min-h-[44px] rounded-xl text-xs font-semibold transition-all cursor-pointer border focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                      selectedCategory === cat.id
                        ? 'bg-blue-600 text-white border-blue-400 font-bold shadow-sm'
                        : 'bg-white/5 text-slate-200 hover:text-white hover:bg-white/10 border-white/10'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}

                {/* Bouton de bascule pour masquer les qualités à zéro */}
                <button
                  type="button"
                  aria-pressed={hideZeroOnly}
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

              {/* Barre de recherche fine */}
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

            {/* Puces de sélection avec min-h 44px et contrastes renforcés */}
            <div className="flex flex-wrap gap-2 pt-0.5" role="toolbar" aria-label="Sélection rapide de la filière active">
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
                    {/* LOGIQUE DE MASQUAGE AUTOMATIQUE : badge affiché UNIQUEMENT si valeur > 0 */}
                    {val3 > 0 ? (
                      <span className={`text-xs font-mono px-2 py-0.5 rounded font-bold ${
                        isSelected ? 'bg-black/30 text-blue-100' : 'bg-blue-500/20 text-blue-300'
                      }`}>
                        {val3}
                      </span>
                    ) : null}
                    {val3 > 0 && isUp && <ArrowUp size={12} className={`stroke-[3] ${isSelected ? 'text-emerald-200' : 'text-emerald-400'}`} aria-hidden="true" />}
                    {val3 > 0 && isDown && <ArrowDown size={12} className={`stroke-[3] ${isSelected ? 'text-rose-200' : 'text-rose-400'}`} aria-hidden="true" />}
                  </button>
                );
              })}

              {filteredQualities.length === 0 && (
                <div className="flex items-center justify-between w-full py-3 px-4 bg-white/5 rounded-xl border border-white/5 text-xs text-slate-300">
                  <span>Aucune filière ne correspond à vos critères de recherche.</span>
                  <button
                    type="button"
                    onClick={() => {
                      setQualitySearch('');
                      setSelectedCategory('all');
                      setHideZeroOnly(false);
                    }}
                    className="text-blue-400 hover:text-blue-300 underline font-semibold cursor-pointer"
                  >
                    Réinitialiser les filtres
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* CARTES KPI AVEC PALETTE MONOCHROMATIQUE (TEMPORALITÉ EN BLEU/INDIGO) & MINIATURES SPARKLINE */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* EMA 3j : BLEU CLAIR / CYAN */}
            <article 
              aria-label="EMA 3 jours, dynamique à court terme"
              className="bg-slate-900/80 border border-white/10 rounded-xl p-3.5 flex flex-col justify-between hover:border-sky-500/30 transition-all shadow-md"
            >
              <div className="flex items-center justify-between gap-1 mb-1">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-400" aria-hidden="true"></span>
                  <span className="text-xs text-slate-200 font-semibold">EMA 3j (Court terme)</span>
                </div>
                <span className="text-xs text-slate-300 font-mono">vs {periodLabel3}</span>
              </div>

              {/* Chiffre principal agrandi + Tendance + Sparkline intégrée */}
              <div className="flex items-center justify-between gap-2 my-2">
                <div className="flex items-center gap-2">
                  <span className="text-3xl font-black font-mono text-white tracking-tight">
                    {curr.ema3}
                  </span>
                  {renderTrendIndicator(d3, p3, prevVal3, curr.ema3, 'card', 'EMA 3j')}
                </div>
                {/* Miniature de tendance sparkline */}
                <MiniSparkline data={sparklineSeries.ema3} color="#38bdf8" />
              </div>

              <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs font-mono text-slate-300">
                <span>Réf. {periodLabel3} : <strong className="text-white">{prevVal3}</strong></span>
                <span className={d3 > 0.05 ? 'text-emerald-400 font-semibold' : d3 < -0.05 ? 'text-rose-400 font-semibold' : 'text-slate-300'}>
                  Δ {d3 > 0 ? `+${d3}` : d3}
                </span>
              </div>
            </article>

            {/* EMA 7j : BLEU COBALT */}
            <article 
              aria-label="EMA 7 jours, dynamique à moyen terme"
              className="bg-slate-900/80 border border-white/10 rounded-xl p-3.5 flex flex-col justify-between hover:border-blue-500/30 transition-all shadow-md"
            >
              <div className="flex items-center justify-between gap-1 mb-1">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500" aria-hidden="true"></span>
                  <span className="text-xs text-slate-200 font-semibold">EMA 7j (Moyen terme)</span>
                </div>
                <span className="text-xs text-slate-300 font-mono">vs {periodLabel7}</span>
              </div>

              {/* Chiffre principal agrandi + Tendance + Sparkline intégrée */}
              <div className="flex items-center justify-between gap-2 my-2">
                <div className="flex items-center gap-2">
                  <span className="text-3xl font-black font-mono text-white tracking-tight">
                    {curr.ema7}
                  </span>
                  {renderTrendIndicator(d7, p7, prevVal7, curr.ema7, 'card', 'EMA 7j')}
                </div>
                {/* Miniature de tendance sparkline */}
                <MiniSparkline data={sparklineSeries.ema7} color="#3b82f6" />
              </div>

              <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs font-mono text-slate-300">
                <span>Réf. {periodLabel7} : <strong className="text-white">{prevVal7}</strong></span>
                <span className={d7 > 0.05 ? 'text-emerald-400 font-semibold' : d7 < -0.05 ? 'text-rose-400 font-semibold' : 'text-slate-300'}>
                  Δ {d7 > 0 ? `+${d7}` : d7}
                </span>
              </div>
            </article>

            {/* EMA 21j : INDIGO FONCÉ */}
            <article 
              aria-label="EMA 21 jours, fond durable et charge chronique"
              className="bg-slate-900/80 border border-white/10 rounded-xl p-3.5 flex flex-col justify-between hover:border-indigo-500/30 transition-all shadow-md"
            >
              <div className="flex items-center justify-between gap-1 mb-1">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-400" aria-hidden="true"></span>
                  <span className="text-xs text-slate-200 font-semibold">EMA 21j (Fond durable)</span>
                </div>
                <span className="text-xs text-slate-300 font-mono">vs {periodLabel21}</span>
              </div>

              {/* Chiffre principal agrandi + Tendance + Sparkline intégrée */}
              <div className="flex items-center justify-between gap-2 my-2">
                <div className="flex items-center gap-2">
                  <span className="text-3xl font-black font-mono text-white tracking-tight">
                    {curr.ema21}
                  </span>
                  {renderTrendIndicator(d21, p21, prevVal21, curr.ema21, 'card', 'EMA 21j')}
                </div>
                {/* Miniature de tendance sparkline */}
                <MiniSparkline data={sparklineSeries.ema21} color="#818cf8" />
              </div>

              <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs font-mono text-slate-300">
                <span>Réf. {periodLabel21} : <strong className="text-white">{prevVal21}</strong></span>
                <span className={d21 > 0.05 ? 'text-emerald-400 font-semibold' : d21 < -0.05 ? 'text-rose-400 font-semibold' : 'text-slate-300'}>
                  Δ {d21 > 0 ? `+${d21}` : d21}
                </span>
              </div>
            </article>

            {/* Ratio ACWR */}
            <article 
              aria-label="Ratio de charge aiguë sur chronique ACWR"
              className="bg-slate-900/80 border border-white/10 rounded-xl p-3.5 flex flex-col justify-between hover:border-white/20 transition-all shadow-md"
            >
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className="text-xs text-slate-200 font-semibold">Ratio ACWR (7j / 21j)</span>
                <span className={`px-2 py-0.5 rounded text-xs font-bold border ${
                  curr.acwr > 1.5 
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                    : curr.acwr > 1.3
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                    : curr.acwr >= 0.8
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    : 'bg-sky-500/20 text-sky-300 border-sky-500/30'
                }`}>
                  {curr.acwr > 1.5 ? '⚠️ Surcharge' : curr.acwr >= 0.8 ? '✅ Optimal' : 'Sous-charge'}
                </span>
              </div>
              <div className="flex items-baseline justify-between mt-1">
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
          </div>

          {/* ZONE GRAPHIQUE OU ÉTAT VIDE NEUTRE (EMPTY STATE PROPRE) */}
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
                  {/* Quadrillage horizontal renforcé pour repérer facilement les paliers */}
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.2)" vertical={false} />
                  
                  {/* Axe X avec contraste élevé, repères nets et dates claires JJ/MM */}
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
                  
                  {/* Axe Y avec contraste renforcé */}
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

          {/* TABLEAU RÉCAPITULATIF DE TOUTES LES QUALITÉS (VALEURS EMA & FLÈCHES DE TENDANCE AVEC MAGNITUDE) */}
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

                    // Synthèse globale de progression / déclin
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
                        {/* Qualité */}
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

                        {/* EMA 3j + Flèche & Magnitude côte à côte */}
                        <td className="p-2.5 text-center">
                          <div className="flex items-center justify-center gap-1.5 font-mono">
                            <span className="font-bold text-slate-100">{qInfo.ema3}</span>
                            {renderTrendIndicator(rowD3, rowP3, rowPrev3, qInfo.ema3, 'compact', 'EMA 3j')}
                          </div>
                        </td>

                        {/* EMA 7j (masqué sur smartphone pour désengorger le tableau) */}
                        <td className="p-2.5 text-center hidden sm:table-cell">
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

                        {/* Tendance Globale */}
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

          {/* CADRE MÉTHODOLOGIQUE & AIDE À LA DÉCISION (REPLIABLE EN ACCORDÉON SUR MOBILE) */}
          <details className="group p-4 rounded-2xl bg-slate-900/40 border border-white/10 text-slate-300 text-xs mt-6 cursor-pointer">
            <summary className="flex items-center justify-between font-bold text-slate-200 list-none select-none">
              <div className="flex items-center gap-2">
                <Info size={16} className="text-sky-400 shrink-0" aria-hidden="true" />
                <span>Cadre méthodologique & Indicateurs d'aide à la décision</span>
              </div>
              <span className="text-xs text-slate-400 font-mono group-open:rotate-180 transition-transform" aria-hidden="true">▼</span>
            </summary>
            <p className="text-xs leading-relaxed text-slate-300 mt-2.5 pt-2 border-t border-white/10 m-0">
              Les métriques intégrées (Modèle PMC de Coggan avec filtres continus, Monotonie de Foster, RPE Différentiel, VFC en ln(rMSSD) selon Plews &amp; Buchheit, et Répartition Seiler) constituent des <strong>indicateurs d'aide à la décision d'entraînement</strong>. 
              Elles fournissent un repère quantifié pour piloter les cycles de charge et la fraîcheur. Elles ne constituent ni une prédiction médicale de blessure ni un avis médical. Fiez-vous toujours à vos sensations et consultez un professionnel de santé en cas de douleur persistante ou d'anomalie.
            </p>
          </details>

        </div>
      )}

    </main>
  );
}
