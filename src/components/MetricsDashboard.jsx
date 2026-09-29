import { useState, useMemo } from 'react';
import { 
  AreaChart, Area, ComposedChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer, ReferenceLine 
} from 'recharts';
import { 
  AlertTriangle, TrendingUp, TrendingDown, Activity, Sparkles, 
  Minus, ArrowUp, ArrowDown, Info, Gauge, Trophy, FileText, 
  ShieldAlert, Play, CheckCircle2, Sliders, Heart, Dumbbell, Flame,
  Search, X, Layers, SlidersHorizontal, BarChart3, Calendar, Clock,
  Pin, RotateCcw, Zap, Filter
} from 'lucide-react';
import { calculateEMA } from '../utils/mathHelpers';
import { getLocalYYYYMMDD } from '../utils/dateHelpers';
import { computeCardioVsMuscularBalance } from '../utils/physiology';

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
 * Interprétation dynamique en langage clair du bilan Banister
 */
function getDynamicBanisterInterpretation(dayData, tauFatigue = 7, tauFitness = 28) {
  if (!dayData) return null;
  const { tsb = 0, loadEMA7 = 0, loadEMA21 = 0, load = 0 } = dayData;
  const atl = loadEMA7;
  const ctl = loadEMA21;
  const acwr = ctl > 0 ? (atl / ctl).toFixed(2) : '1.0';

  let zoneTitle = '';
  let zoneColor = 'text-slate-200';
  let zoneBadge = 'bg-slate-700/30 text-slate-300 border-slate-600';
  let summary = '';
  let prescription = '';

  if (tsb > 25) {
    zoneTitle = 'Sur-affûtage / Repos Prolongé';
    zoneColor = 'text-amber-400';
    zoneBadge = 'bg-amber-500/20 text-amber-300 border-amber-500/30';
    summary = `Fraîcheur nerveuse maximale (TSB ${tsb > 0 ? `+${tsb}` : tsb}), mais risque de désentraînement amorcé si cette période dépasse 7 jours. La condition de fond CTL (${ctl} pts) commence à fléchir face au manque de stimulation.`;
    prescription = 'Programmer un rappel d\'intensité ou une reprise progressive pour relancer l\'adaptation sans accumuler de fatigue excessive.';
  } else if (tsb >= 10) {
    zoneTitle = 'Pic de Forme Idéal (Sweet Spot)';
    zoneColor = 'text-emerald-400';
    zoneBadge = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
    summary = `Équilibre optimal entre condition acquise (${ctl} pts) et dissipation de la fatigue aiguë (${atl} pts). Fenêtre privilégiée pour performer en compétition ou tester ses records.`;
    prescription = 'Maintien de la fraîcheur avec quelques intensités courtes et ciblées, sans volume épuisant.';
  } else if (tsb >= 0) {
    zoneTitle = 'Zone Neutre / Récupération Active';
    zoneColor = 'text-sky-400';
    zoneBadge = 'bg-sky-500/20 text-sky-300 border-sky-500/30';
    summary = `Fatigue aiguë et condition sont à l'équilibre (TSB ${tsb > 0 ? `+${tsb}` : tsb}). L'organisme a bien absorbé les charges récentes et reste disponible.`;
    prescription = 'Propice à une séance d\'entretien foncier ou au lancement d\'un nouveau microcycle.';
  } else if (tsb >= -15) {
    zoneTitle = 'Entraînement Productif Modéré';
    zoneColor = 'text-indigo-300';
    zoneBadge = 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';
    summary = `Charge stimulante bien absorbée. L'accumulation de fatigue aiguë (${atl} pts) prépare la future surcompensation de votre condition de fond (${ctl} pts). Ratio ACWR ${acwr}x.`;
    prescription = 'Poursuivre la progression en veillant au sommeil et aux délais de rémanence des filières.';
  } else if (tsb >= -30) {
    zoneTitle = 'Charge d\'Accumulation Intensive';
    zoneColor = 'text-purple-300';
    zoneBadge = 'bg-purple-500/20 text-purple-300 border-purple-500/30';
    summary = `Fatigue aiguë substantielle (TSB ${tsb}, ATL ${atl} pts). L'organisme subit un stress important nécessaire pour franchir un palier athlétique supérieur.`;
    prescription = 'Prévoir une phase d\'assimilation ou une journée allégée dans les 48 heures pour éviter la rupture.';
  } else {
    zoneTitle = 'Surcharge Aiguë Critique';
    zoneColor = 'text-rose-400';
    zoneBadge = 'bg-rose-500/20 text-rose-300 border-rose-500/30';
    summary = `Déficit de fraîcheur sévère (TSB ${tsb}, ATL ${atl} pts). Risque élevé de surmenage, d'immuno-dépression ou de blessure musculaire.`;
    prescription = 'Repos complet ou régénération active impérative. Interdiction de planifier des intensités maximales.';
  }

  return { zoneTitle, zoneColor, zoneBadge, summary, prescription, acwr };
}

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
  const [selectedCategory, setSelectedCategory] = useState('all'); // 'all' | 'cardio' | 'force' | 'specific' | 'active'
  const [hideZeroOnly, setHideZeroOnly] = useState(false);
  // 'period' = période caractéristique (J-3, J-7, J-21), 'daily' = hier (J-1), 'week' = semaine passée (J-7)
  const [trendBasis, setTrendBasis] = useState('period');
  const [qualitySearch, setQualitySearch] = useState('');
  const [activeTooltip, setActiveTooltip] = useState(null); // 'tsb' | 'atl' | 'ctl' | null
  const [banisterCurves, setBanisterCurves] = useState({ atl: true, ctl: true, tsb: true });
  const [vfcCurves, setVfcCurves] = useState({ vfc: true, ema3: true, ema7: true });

  // Nouveaux états d'interactivité : inspection d'un point Banister et filtre du ruban de rémanence
  const [selectedBanisterDay, setSelectedBanisterDay] = useState(null);
  const [isDayPinned, setIsDayPinned] = useState(false);
  const [remanenceFilter, setRemanenceFilter] = useState('all'); // 'all' | 'urgent' | 'recall' | 'optimal'

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
      const daySessions = [];
      
      Object.entries(events).forEach(([qualityId, qualityDates]) => {
        if (qualityDates && qualityDates[dateStr]) {
          const item = qualityDates[dateStr];
          const qDef = qualities.find(q => q.id === qualityId);
          let sLoad = 0;
          let duration = 0;
          let rpeM = 5;
          let rpeC = 5;
          let notes = '';
          let sessionType = '';

          if (typeof item === 'object' && item !== null) {
            sLoad = Number(item.load) || 0;
            duration = Number(item.duration) || 0;
            rpeM = item.rpeMusculaire ?? item.rpeMusc ?? 5;
            rpeC = item.rpeCardio ?? 5;
            notes = item.notes || '';
            sessionType = item.type || '';
          } else if (typeof item === 'number') {
            sLoad = item * 5;
          }

          totalLoad += sLoad;

          if (sLoad > 0 || duration > 0) {
            daySessions.push({
              qualityId,
              qualityName: qDef?.name || qualityId,
              load: sLoad,
              duration,
              rpeM,
              rpeC,
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
      return {
        ...data,
        vfcEMA3: vfcEMA3[i] ? Math.round(vfcEMA3[i]) : null,
        vfcEMA7: vfcEMA7[i] ? Math.round(vfcEMA7[i]) : null,
        loadEMA3: Math.round(loadEMA3[i]),
        loadEMA7: atl,
        loadEMA21: ctl,
        tsb,
        sessions: data.sessions || []
      };
    });
  }, [events, dailyMetrics, isSimulationActive, taperingAnalysis, tauFatigue, tauFitness, qualities]);

  // Jour inspecté actif (synchronisé par clic ou survol sur la courbe Banister)
  const currentInspectedDay = useMemo(() => {
    if (selectedBanisterDay) return selectedBanisterDay;
    const todayItem = chartData.find(d => d.isToday);
    if (todayItem) return todayItem;
    const nonFuture = chartData.filter(d => !d.isFuture);
    return nonFuture[nonFuture.length - 1] || chartData[chartData.length - 1] || null;
  }, [selectedBanisterDay, chartData]);

  // Interprétation dynamique Banister pour le jour inspecté
  const banisterInterpretation = useMemo(() => {
    return getDynamicBanisterInterpretation(currentInspectedDay, tauFatigue, tauFitness);
  }, [currentInspectedDay, tauFatigue, tauFitness]);

  // 1b. Calcul du ruban de rémanence immédiat pour toutes les qualités
  const remanenceStatusList = useMemo(() => {
    const today = new Date();
    const todayStr = getLocalYYYYMMDD(today);

    return qualities.map((q, index) => {
      const rank = index + 1;
      const qEvents = events[q.id] || {};
      const dates = Object.keys(qEvents)
        .filter(d => d <= todayStr && qEvents[d])
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

      const plateauDays = q.g || 4; // Durée de gain / plateau (jours)
      const declineDays = q.o || 3; // Durée de déclin (jours)
      const totalRemanenceWindow = plateauDays + declineDays;

      // Calcul de la jauge circulaire de rémanence restante (0% à 100%)
      let remainingPercent = 0;
      let statusKey = 'decondition';
      let statusLabel = 'Désentraînement';
      let statusColor = 'text-rose-400';
      let statusBg = 'bg-rose-500/15 text-rose-300 border-rose-500/30';
      let statusIcon = AlertTriangle;
      let actionAdvice = 'Séance de rappel nécessaire';

      if (daysSince === null) {
        remainingPercent = 0;
        statusKey = 'decondition';
        statusLabel = 'Non stimulée';
        statusColor = 'text-slate-400';
        statusBg = 'bg-white/5 text-slate-400 border-white/10';
        actionAdvice = 'Aucune séance enregistrée';
      } else if (daysSince === 0) {
        remainingPercent = 100;
        statusKey = 'optimal';
        statusLabel = 'Travaillée aujourd\'hui';
        statusColor = 'text-emerald-400';
        statusBg = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
        statusIcon = CheckCircle2;
        actionAdvice = 'Assimilation en cours (J+0)';
      } else if (daysSince <= plateauDays) {
        // En plateau : effet résiduel plein
        remainingPercent = Math.round(100 - (daysSince / plateauDays) * 20); // 100% -> 80%
        statusKey = 'optimal';
        statusLabel = `En plateau (J+${daysSince})`;
        statusColor = 'text-emerald-400';
        statusBg = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
        statusIcon = CheckCircle2;
        const daysToRecall = plateauDays - daysSince;
        actionAdvice = daysToRecall === 0 
          ? 'Fin de plateau : rappel demain' 
          : `Acquis protégés encore ${daysToRecall}j`;
      } else if (daysSince <= plateauDays + 2) {
        // Fenêtre de rappel critique
        remainingPercent = Math.round(75 - ((daysSince - plateauDays) / 2) * 35); // 75% -> 40%
        statusKey = 'recall';
        statusLabel = `Fenêtre de rappel (J+${daysSince})`;
        statusColor = 'text-amber-400';
        statusBg = 'bg-amber-500/20 text-amber-300 border-amber-500/30';
        statusIcon = Zap;
        actionAdvice = 'Rappel idéal sous 24h-48h';
      } else if (daysSince <= totalRemanenceWindow) {
        // Déclin amorcé
        const elapsedDecline = daysSince - plateauDays;
        remainingPercent = Math.max(10, Math.round(40 * (1 - elapsedDecline / declineDays)));
        statusKey = 'decline';
        statusLabel = `Déclin amorcé (J+${daysSince})`;
        statusColor = 'text-orange-400';
        statusBg = 'bg-orange-500/20 text-orange-300 border-orange-500/30';
        statusIcon = TrendingDown;
        actionAdvice = 'Dégradation des gains en cours';
      } else {
        // Désentraînement complet
        remainingPercent = 0;
        statusKey = 'decondition';
        statusLabel = `Désentraînement (J+${daysSince})`;
        statusColor = 'text-rose-400';
        statusBg = 'bg-rose-500/20 text-rose-300 border-rose-500/30';
        statusIcon = AlertTriangle;
        actionAdvice = 'Capacité désentraînée';
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
        ema21
      };
    });
  }, [qualities, events, qualitiesEMA]);

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
        <div className="bg-[#121216]/95 backdrop-blur-md p-3 border border-white/10 rounded-xl shadow-[0_4px_15px_rgba(0,0,0,0.5)] max-w-xs">
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
                🏋️ {dataItem.sessions.length} séance(s) réalisée(s) :
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

  // Données synthétiques Banister du jour (TSB, ATL, CTL, ACWR, Rampe)
  const banisterSummary = useMemo(() => {
    if (chartData.length === 0) return null;
    const todayIndex = chartData.findIndex(d => d.isToday);
    const item = todayIndex >= 0 ? chartData[todayIndex] : chartData[chartData.length - 1];
    const atl = item?.loadEMA7 ?? 0;
    const ctl = item?.loadEMA21 ?? 0;
    const tsb = item?.tsb ?? (ctl - atl);
    const acwr = ctl > 0 ? (atl / ctl).toFixed(2) : '1.0';

    // Rampe de progression CTL sur 7 jours
    const targetIdx = todayIndex >= 0 ? todayIndex : chartData.length - 1;
    const sevenDaysAgo = targetIdx >= 7 ? chartData[targetIdx - 7] : chartData[0];
    const ctlPast = sevenDaysAgo?.loadEMA21 ?? ctl;
    const ctlRamp = Math.round((ctl - ctlPast) * 10) / 10;

    return { atl, ctl, tsb, acwr, ctlRamp };
  }, [chartData]);

  // Définitions détaillées, rôles physiologiques et seuils de normalité pour les infobulles (Tooltips)
  const physioTooltips = useMemo(() => {
    return {
      tsb: {
        id: 'tsb',
        name: 'TSB',
        fullTitle: 'Training Stress Balance (Forme & Fraîcheur)',
        formula: 'TSB = CTL − ATL (Condition durable − Fatigue aiguë)',
        color: '#10b981',
        role: "Indicateur central de performance et de fraîcheur neuromusculaire. Il reflète l'équilibre dynamique entre les adaptations physiques de fond acquises (CTL) et la fatigue résiduelle immédiate (ATL). Un TSB positif indique un organisme frais et dispo pour la compétition ; un TSB négatif traduit une phase d'assimilation de charge.",
        currentValue: banisterSummary ? (banisterSummary.tsb > 0 ? `+${banisterSummary.tsb}` : `${banisterSummary.tsb}`) : '0',
        currentInterpretation: 
          !banisterSummary ? 'Données en cours de calcul' :
          banisterSummary.tsb > 25 ? 'Sur-affûtage (Risque de perte de rythme)' :
          banisterSummary.tsb >= 10 ? 'Pic de Forme / Compétition (Optimal)' :
          banisterSummary.tsb >= 0 ? 'Fraîcheur Neutre / Maintien' :
          banisterSummary.tsb >= -30 ? 'Entraînement Productif / Assimilation' :
          'Surcharge Critique / Risque Blessure',
        thresholds: [
          {
            zone: '> +25',
            title: 'Sur-affûtage / Perte de tonus',
            detail: 'Fraîcheur extrême mais risque d\'atrophie neuromusculaire si prolongé plus de 10 jours.',
            status: 'warning',
            tagClass: 'bg-amber-500/20 text-amber-300 border-amber-500/30'
          },
          {
            zone: '+10 à +25',
            title: 'Pic de Forme (Sweet Spot Compétition)',
            detail: 'Zone idéale pour le Jour J : fraîcheur maximale tout en conservant le moteur aérobie et le tonus.',
            status: 'success',
            tagClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
          },
          {
            zone: '0 à +10',
            title: 'Fraîcheur Neutre / Maintien',
            detail: 'Bonne disponibilité physique sans fatigue excessive, parfait pour les séances techniques ou de vitesse.',
            status: 'info',
            tagClass: 'bg-sky-500/20 text-sky-300 border-sky-500/30'
          },
          {
            zone: '-10 à -30',
            title: 'Entraînement Productif (Surcompensation)',
            detail: 'Fatigue contrôlée indispensable pour provoquer les adaptations physiologiques au cœur d\'un bloc.',
            status: 'neutral',
            tagClass: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
          },
          {
            zone: '< -30',
            title: 'Surcharge Critique / Risque de Surmenage',
            detail: 'Fatigue excessive. Risque de blessure tendino-musculaire accru et altération du sommeil. Repos requis.',
            status: 'danger',
            tagClass: 'bg-red-500/20 text-red-300 border-red-500/30'
          }
        ]
      },
      atl: {
        id: 'atl',
        name: 'ATL',
        fullTitle: 'Acute Training Load (Charge Aiguë / Fatigue)',
        formula: `Moyenne Mobile Exponentielle sur ${tauFatigue} jours (Fatigue)`,
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
        role: "Quantifie la charge et la fatigue neuromusculaire immédiate accumulée sur la dernière semaine. L'ATL monte très rapidement après des séances volumineuses ou intenses, et redescend en 4 à 7 jours de récupération.",
        currentValue: banisterSummary ? `${banisterSummary.atl} pts (Ratio ACWR: ${banisterSummary.acwr}x)` : '0 pts',
        currentInterpretation:
          !banisterSummary ? 'Données en cours de calcul' :
          Number(banisterSummary.acwr) > 1.5 ? 'Zone Danger (Surcharge > 1.5x)' :
          Number(banisterSummary.acwr) >= 1.3 ? 'Zone d\'Avertissement (1.3 à 1.5x)' :
          Number(banisterSummary.acwr) >= 0.8 ? 'Sweet Spot Sécuritaire (0.8 à 1.3x)' :
          'Sous-charge / Affûtage (< 0.8x)',
        thresholds: [
          {
            zone: 'ACWR < 0.8',
            title: 'Sous-charge / Affûtage',
            detail: 'Baisse rapide de la fatigue. Très favorable avant une compétition mais risque de désentraînement sur 2+ semaines.',
            status: 'info',
            tagClass: 'bg-sky-500/20 text-sky-300 border-sky-500/30'
          },
          {
            zone: 'ACWR 0.8 à 1.3',
            title: 'Sweet Spot (Zone Sécuritaire)',
            detail: 'Équilibre parfait entre progression des charges et minimisation du risque de blessure (modèle de Gabbett).',
            status: 'success',
            tagClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
          },
          {
            zone: 'ACWR 1.3 à 1.5',
            title: 'Zone d\'Avertissement',
            detail: 'Montée rapide de la charge. Stimulus fort tolérable sur 1 semaine de stage ou microcycle de choc.',
            status: 'warning',
            tagClass: 'bg-amber-500/20 text-amber-300 border-amber-500/30'
          },
          {
            zone: 'ACWR > 1.5',
            title: 'Zone Danger (Risque de Blessure Accru)',
            detail: 'Risque de blessure multiplié par 2 à 4. Décharge ou allègement impératif sur les 3 à 5 prochains jours.',
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
        currentValue: banisterSummary ? `${banisterSummary.ctl} pts (${banisterSummary.ctlRamp >= 0 ? `+${banisterSummary.ctlRamp}` : banisterSummary.ctlRamp} pts/sem)` : '0 pts',
        currentInterpretation:
          !banisterSummary ? 'Données en cours de calcul' :
          banisterSummary.ctlRamp > 8 ? 'Montée trop rapide (> +8 pts/sem)' :
          banisterSummary.ctlRamp >= 3 ? 'Progression optimale (+3 à +7 pts/sem)' :
          banisterSummary.ctlRamp >= -2 ? 'Stabilisation / Maintien (Plateau)' :
          'Désentraînement (Baisse de condition)',
        thresholds: [
          {
            zone: '+3 à +7 pts/sem',
            title: 'Rampe de Progression Optimale',
            detail: 'Rythme idéal de montée en charge pour développer la cylindrée aérobie et musculaire de manière saine.',
            status: 'success',
            tagClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
          },
          {
            zone: '> +8 à +10 pts/sem',
            title: 'Rampe Trop Agressive',
            detail: 'Augmentation trop brutale du volume, conduisant souvent à un effondrement immunitaire ou une blessure.',
            status: 'warning',
            tagClass: 'bg-amber-500/20 text-amber-300 border-amber-500/30'
          },
          {
            zone: 'Plateau stable (±2 pts)',
            title: 'Phase de Stabilisation / Palier',
            detail: 'Permet à l\'organisme d\'assimiler un nouveau niveau de travail avant d\'engager un cycle supérieur.',
            status: 'info',
            tagClass: 'bg-sky-500/20 text-sky-300 border-sky-500/30'
          },
          {
            zone: 'Baisse > -4 pts/sem',
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
    <div className="p-4 md:p-6 w-full flex flex-col gap-6">
      
      {showPhysiology && (
        <>
          {/* BARRE D'ACTIONS SCIENTIFIQUES : SIMULATION, OBJECTIF & EXPORT */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-900/60 border border-white/10 shadow-lg">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-blue-500/15 text-blue-400 border border-blue-500/20">
                <Gauge size={16} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Tableau de Bord Physiologique</h4>
                <p className="text-[11px] text-slate-400">Modèles Banister, Foster Monotony & Affûtage</p>
              </div>
            </div>

            {/* Standardisation : 3 boutons secondaires neutres + 1 accent principal (Bilan PDF) */}
            <div className="flex flex-wrap items-center gap-2">
              {onToggleSimulation && (
                <button
                  type="button"
                  onClick={() => onToggleSimulation()}
                  className={`flex items-center gap-1.5 h-8 px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer border ${
                    isSimulationActive 
                      ? 'bg-purple-950/40 text-purple-300 border-purple-500/40 shadow-sm' 
                      : 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border-white/10'
                  }`}
                  title="Activer la simulation prédictive pour projeter les jours futurs"
                >
                  <Sparkles size={13} className={isSimulationActive ? 'text-purple-400' : 'text-slate-400'} />
                  <span>{isSimulationActive ? 'Simulation Active' : 'Simulation'}</span>
                </button>
              )}

              {onOpenCompetitionModal && (
                <button
                  type="button"
                  onClick={onOpenCompetitionModal}
                  className="flex items-center gap-1.5 h-8 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-xs font-medium transition-colors cursor-pointer"
                  title="Configurer une compétition ou un objectif de course"
                >
                  <Trophy size={13} className="text-slate-400" />
                  <span>
                    {taperingAnalysis?.targetCompetition 
                      ? `${taperingAnalysis.targetCompetition.name} (J-${taperingAnalysis.daysRemaining})` 
                      : 'Course Objectif'}
                  </span>
                </button>
              )}

              {onOpenPhysioSettingsModal && (
                <button
                  type="button"
                  onClick={onOpenPhysioSettingsModal}
                  className="flex items-center gap-1.5 h-8 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-xs font-medium transition-colors cursor-pointer"
                  title="Calibrer les constantes de rémanence Banister (tau fatigue et condition)"
                >
                  <Sliders size={13} className="text-slate-400" />
                  <span>Calibrage (τ₁:{tauFatigue}j, τ₂:{tauFitness}j)</span>
                </button>
              )}

              {onOpenReportModal && (
                <button
                  type="button"
                  onClick={onOpenReportModal}
                  className="flex items-center gap-1.5 h-8 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 border border-blue-500/40 text-white text-xs font-bold transition-all shadow-md shadow-blue-600/25 cursor-pointer"
                  title="Générer un bilan d'entraînement imprimable en PDF"
                >
                  <FileText size={13} className="text-white" />
                  <span>Bilan PDF</span>
                </button>
              )}
            </div>
          </div>

          {/* SECTION TAPER / FOSTER / BALANCE : 3 WIDGETS PHYSIOLOGIQUES COMPLÉMENTAIRES */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            
            {/* CARTE 1 : AFFÛTAGE & PRÉDICTION COMPÉTITION (Fond standard sombre neutre, badge seul en jaune) */}
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/10 flex flex-col justify-between shadow-xl">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-white/5 text-slate-300 border border-white/10">
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
                  <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    {taperingAnalysis.daysRemaining >= 0 ? `J-${taperingAnalysis.daysRemaining}` : 'Terminé'}
                  </span>
                ) : (
                  <button
                    type="button"
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
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/10 flex flex-col justify-between shadow-xl">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-white/5 text-slate-300 border border-white/10">
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

            {/* CARTE 3 : TRIMP MULTI-FACTEURS (CARDIO VS MUSCULAIRE) */}
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/10 flex flex-col justify-between shadow-xl">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-white/5 text-slate-300 border border-white/10">
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
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
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
                    <div className="w-full h-2.5 rounded-full overflow-hidden flex bg-white/10 shadow-inner mb-2">
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
                    <div className="flex items-center justify-between text-xs font-mono px-2.5 py-1 bg-black/40 rounded-xl border border-white/5">
                      <span className="text-sky-300 flex items-center gap-1.5 font-bold">
                        <Heart size={12} className="text-sky-400" /> Cardio : {balance.cardioPercent}%
                      </span>
                      <span className="text-slate-300 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-white/10">
                        Équilibre
                      </span>
                      <span className="text-rose-300 flex items-center gap-1.5 font-bold">
                        Musculaire : {balance.muscPercent}% <Dumbbell size={12} className="text-rose-400" />
                      </span>
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
                      <span className="text-xs font-bold font-mono text-rose-400 block mt-0.5">
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

          {/* BANDEAU KPI BANISTER : TSB · ATL · CTL AVEC INFOBULLES SCIENTIFIQUES AU SURVOL */}
          <div className="relative">
            <div className="flex items-center justify-between mb-2 px-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <Activity size={14} className="text-blue-400" />
                  Indicateurs de Modélisation Banister (Jour J)
                </span>
                <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
                  (Survolez les indicateurs pour comprendre leur rôle et leurs seuils)
                </span>
              </div>
              <span className="text-[10px] font-mono text-slate-400">
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
                  mainNumber = tsbVal > 0 ? `+${tsbVal}` : `${tsbVal}`;
                  unitLabel = 'TSB';
                  secondaryDetail = '';
                  shortFormula = 'CTL − ATL';

                  // Échelle TSB : -40 à +30 (delta 70)
                  gaugePercent = Math.max(4, Math.min(96, ((Math.max(-40, Math.min(30, tsbVal)) + 40) / 70) * 100));
                  gaugeSubtextLeft = '-40 Surcharge';
                  gaugeSubtextCenter = 'Optimal +15';
                  gaugeSubtextRight = '+30 Repos';

                  if (tsbVal >= 10 && tsbVal <= 25) {
                    cardBorder = 'border-emerald-500/35 bg-gradient-to-b from-emerald-950/20 to-slate-900/80 hover:border-emerald-400/50';
                    valueColor = 'text-emerald-400';
                    badgeClass = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
                    statusColor = 'text-emerald-400';
                  } else if (tsbVal >= 0) {
                    cardBorder = 'border-sky-500/30 bg-gradient-to-b from-sky-950/20 to-slate-900/80 hover:border-sky-400/50';
                    valueColor = 'text-sky-300';
                    badgeClass = 'bg-sky-500/20 text-sky-300 border-sky-500/30';
                    statusColor = 'text-sky-300';
                  } else if (tsbVal >= -30) {
                    cardBorder = 'border-indigo-500/30 bg-gradient-to-b from-indigo-950/20 to-slate-900/80 hover:border-indigo-400/50';
                    valueColor = 'text-indigo-300';
                    badgeClass = 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';
                    statusColor = 'text-indigo-300';
                  } else {
                    // Surcharge critique
                    cardBorder = 'border-red-500/40 bg-gradient-to-b from-red-950/25 to-slate-900/80 hover:border-red-400/60';
                    valueColor = 'text-red-400';
                    badgeClass = 'bg-red-500/20 text-red-300 border-red-500/30';
                    statusColor = 'text-red-400';
                  }
                } else if (isAtl) {
                  const atlVal = banisterSummary?.atl ?? 0;
                  const acwrVal = Number(banisterSummary?.acwr ?? 1);
                  mainNumber = `${atlVal}`;
                  unitLabel = 'pts';
                  secondaryDetail = `(ACWR : ${acwrVal}x)`;
                  shortFormula = `Moyenne ${tauFatigue}j`;

                  // Échelle ACWR : 0.4 à 1.8 (delta 1.4)
                  gaugePercent = Math.max(4, Math.min(96, ((Math.max(0.4, Math.min(1.8, acwrVal)) - 0.4) / 1.4) * 100));
                  gaugeSubtextLeft = '0.5x Bas';
                  gaugeSubtextCenter = '0.8 - 1.3x Sweet Spot';
                  gaugeSubtextRight = '1.8x Danger';

                  // CORRECTION SÉMANTIQUE : Vert/Bleu dans la zone optimale, Rouge réservé UNIQUEMENT à ACWR > 1.5
                  if (acwrVal > 1.5) {
                    cardBorder = 'border-red-500/50 bg-gradient-to-b from-red-950/30 to-slate-900/80 hover:border-red-400/70 shadow-red-500/10';
                    valueColor = 'text-red-400';
                    badgeClass = 'bg-red-500/20 text-red-300 border-red-500/40';
                    statusColor = 'text-red-400';
                  } else if (acwrVal >= 1.3) {
                    cardBorder = 'border-amber-500/35 bg-gradient-to-b from-amber-950/20 to-slate-900/80 hover:border-amber-400/50';
                    valueColor = 'text-amber-400';
                    badgeClass = 'bg-amber-500/20 text-amber-300 border-amber-500/30';
                    statusColor = 'text-amber-400';
                  } else if (acwrVal >= 0.8) {
                    // Zone optimale / sécuritaire (Sweet Spot) : VERT / ÉMERAUDE
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
                } else if (isCtl) {
                  const ctlVal = banisterSummary?.ctl ?? 0;
                  const rampVal = banisterSummary?.ctlRamp ?? 0;
                  mainNumber = `${ctlVal}`;
                  unitLabel = 'pts';
                  secondaryDetail = `(${rampVal >= 0 ? `+${rampVal}` : rampVal} pts/sem)`;
                  shortFormula = `Moyenne ${tauFitness}j`;

                  // Échelle Rampe : -6 à +12 (delta 18)
                  gaugePercent = Math.max(4, Math.min(96, ((Math.max(-6, Math.min(12, rampVal)) + 6) / 18) * 100));
                  gaugeSubtextLeft = '-5 Déclin';
                  gaugeSubtextCenter = '+3 à +7 Idéal';
                  gaugeSubtextRight = '+12 Brutal';

                  if (rampVal > 8) {
                    cardBorder = 'border-amber-500/35 bg-gradient-to-b from-amber-950/20 to-slate-900/80 hover:border-amber-400/50';
                    valueColor = 'text-amber-400';
                    badgeClass = 'bg-amber-500/20 text-amber-300 border-amber-500/30';
                    statusColor = 'text-amber-400';
                  } else if (rampVal >= 3) {
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
                  <div
                    key={key}
                    onMouseEnter={() => setActiveTooltip(key)}
                    onMouseLeave={() => setActiveTooltip(null)}
                    onClick={() => setActiveTooltip(activeTooltip === key ? null : key)}
                    className={`relative p-4 rounded-2xl border transition-all cursor-pointer group shadow-xl ${cardBorder} ${isActive ? 'ring-2 ring-blue-500/50 scale-[1.01]' : ''}`}
                  >
                    {/* Header carte */}
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`px-2 py-0.5 rounded font-black font-mono text-xs border ${badgeClass}`}>
                          {info.name}
                        </span>
                        <span className="text-xs font-bold text-slate-200 truncate">
                          {key === 'tsb' ? 'Forme (TSB)' : key === 'atl' ? 'Fatigue Aiguë (ATL)' : 'Condition Durable (CTL)'}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                        title="Afficher le rôle et les seuils de normalité"
                      >
                        <Info size={14} className={isActive ? 'text-blue-400' : ''} />
                      </button>
                    </div>

                    {/* Valeur principale agrandie et sous-formule lisible en gris #94A3B8 */}
                    <div className="flex items-baseline justify-between gap-2 mb-1.5">
                      <div className="flex items-baseline gap-1.5 min-w-0">
                        <span className={`text-4xl sm:text-5xl font-black font-mono tracking-tight ${valueColor}`}>
                          {mainNumber}
                        </span>
                        <span className="text-sm sm:text-base font-bold font-sans text-slate-300 uppercase tracking-wide">
                          {unitLabel}
                        </span>
                        {secondaryDetail && (
                          <span className="text-xs font-mono font-medium text-slate-400 ml-1 truncate">
                            {secondaryDetail}
                          </span>
                        )}
                      </div>
                      <div 
                        className="text-xs font-mono font-semibold text-[#94A3B8] bg-white/5 px-2 py-0.5 rounded-lg border border-white/10 shrink-0"
                        title={info.formula}
                      >
                        {shortFormula}
                      </div>
                    </div>

                    {/* Jauge visuelle avec curseur dynamique de situation athlète */}
                    <div className="my-2.5">
                      <div className="relative w-full h-2.5 rounded-full overflow-hidden flex bg-white/10 shadow-inner">
                        {isTsb && (
                          <>
                            <div className="h-full bg-red-500/70" style={{ width: '20%' }} title="Surcharge (< -30)" />
                            <div className="h-full bg-indigo-500/70" style={{ width: '25%' }} title="Entraînement productif (-30 à 0)" />
                            <div className="h-full bg-sky-500/70" style={{ width: '15%' }} title="Neutre (0 à +10)" />
                            <div className="h-full bg-emerald-500" style={{ width: '25%' }} title="Pic de Forme (+10 à +25)" />
                            <div className="h-full bg-amber-500/70" style={{ width: '15%' }} title="Sur-affûtage (> +25)" />
                          </>
                        )}
                        {isAtl && (
                          <>
                            <div className="h-full bg-sky-500/70" style={{ width: '25%' }} title="Sous-charge (< 0.8x)" />
                            <div className="h-full bg-emerald-500" style={{ width: '45%' }} title="Sweet Spot (0.8 à 1.3x)" />
                            <div className="h-full bg-amber-500" style={{ width: '15%' }} title="Avertissement (1.3 à 1.5x)" />
                            <div className="h-full bg-red-500" style={{ width: '15%' }} title="Danger (> 1.5x)" />
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
                      
                      {/* Sous-titres de repères de la jauge avec contraste renforcé en #94A3B8 */}
                      <div className="flex justify-between text-[10px] font-mono text-[#94A3B8] mt-1.5">
                        <span>{gaugeSubtextLeft}</span>
                        <span className="text-emerald-400 font-bold">{gaugeSubtextCenter}</span>
                        <span>{gaugeSubtextRight}</span>
                      </div>
                    </div>

                    {/* Diagnostic textuel */}
                    <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px]">
                      <span className={`font-semibold truncate ${statusColor}`}>
                        {info.currentInterpretation}
                      </span>
                      <span className="text-[10px] text-blue-400 opacity-80 group-hover:opacity-100 group-hover:underline flex items-center gap-0.5 shrink-0 ml-1">
                        Seuils & Rôle <Info size={10} />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* POPOVER / INFOBULLE DÉTAILLÉE FLOTTANTE AU SURVOL / CLIC */}
            {activeTooltip && physioTooltips[activeTooltip] && (
              <div 
                className="absolute z-50 left-0 right-0 top-full mt-3 p-4 sm:p-5 bg-[#0f172a]/98 backdrop-blur-xl border border-white/15 rounded-2xl shadow-2xl animate-fadeIn text-slate-100 max-w-3xl mx-auto"
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
                    <p className="text-xs text-blue-300 font-mono mt-1">
                      📐 {physioTooltips[activeTooltip].formula}
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTooltip(null)}
                    className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    <X size={16} />
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
                    Cliquez en dehors pour fermer
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* GRAPHIQUES GLOBAUX BANISTER + VFC */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[340px] min-h-0">
            
            {/* GRAPHIQUE 1 : Charge Globale (Banister) */}
            <div className="flex flex-col h-full bg-slate-900/60 border border-white/10 rounded-2xl p-4 min-h-0 relative shadow-xl">
              <div className="flex items-center justify-between mb-2 shrink-0 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Activity size={13} className="text-blue-400" />
                  <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">Modélisation Banister</span>
                </div>
                
                {/* Légendes interactives compactes cliquables pour afficher/masquer */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setBanisterCurves(p => ({ ...p, atl: !p.atl }))}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold font-mono transition-all cursor-pointer border ${
                      banisterCurves.atl 
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-sm' 
                        : 'bg-white/5 text-slate-500 border-white/5 line-through opacity-50'
                    }`}
                    title="Cliquer pour afficher/masquer la courbe de fatigue ATL"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                    ATL ({tauFatigue}j)
                  </button>

                  <button
                    type="button"
                    onClick={() => setBanisterCurves(p => ({ ...p, ctl: !p.ctl }))}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold font-mono transition-all cursor-pointer border ${
                      banisterCurves.ctl 
                        ? 'bg-sky-500/20 text-sky-300 border-sky-500/40 shadow-sm' 
                        : 'bg-white/5 text-slate-500 border-white/5 line-through opacity-50'
                    }`}
                    title="Cliquer pour afficher/masquer la courbe de condition CTL"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                    CTL ({tauFitness}j)
                  </button>

                  <button
                    type="button"
                    onClick={() => setBanisterCurves(p => ({ ...p, tsb: !p.tsb }))}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold font-mono transition-all cursor-pointer border ${
                      banisterCurves.tsb 
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm' 
                        : 'bg-white/5 text-slate-500 border-white/5 line-through opacity-50'
                    }`}
                    title="Cliquer pour afficher/masquer la courbe de forme TSB"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    TSB
                  </button>

                  {isSimulationActive && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      +14j Simu
                    </span>
                  )}
                </div>
              </div>

              <div className="flex-1 w-full min-h-[220px] relative">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart 
                    data={chartData} 
                    margin={{ top: 5, right: 5, left: -25, bottom: 0 }}
                    onMouseMove={(e) => {
                      if (!isDayPinned && e && e.activePayload && e.activePayload[0]) {
                        setSelectedBanisterDay(e.activePayload[0].payload);
                      }
                    }}
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
                    <XAxis dataKey="day" stroke="#64748b" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis stroke="#64748b" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
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
            </div>

            {/* GRAPHIQUE 2 : Tendance VFC */}
            <div className="flex flex-col h-full bg-slate-900/60 border border-white/10 rounded-2xl p-4 min-h-0 relative shadow-xl">
              <div className="flex items-center justify-between mb-2 shrink-0 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Activity size={13} className="text-emerald-400" />
                  <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">Variabilité Cardiaque (VFC)</span>
                </div>

                {/* Légendes interactives compactes cliquables */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setVfcCurves(p => ({ ...p, vfc: !p.vfc }))}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold font-mono transition-all cursor-pointer border ${
                      vfcCurves.vfc 
                        ? 'bg-white/10 text-slate-200 border-white/20 shadow-sm' 
                        : 'bg-white/5 text-slate-500 border-white/5 line-through opacity-50'
                    }`}
                    title="Cliquer pour afficher/masquer la VFC quotidienne nette"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-white/70" />
                    Nette
                  </button>

                  <button
                    type="button"
                    onClick={() => setVfcCurves(p => ({ ...p, ema3: !p.ema3 }))}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold font-mono transition-all cursor-pointer border ${
                      vfcCurves.ema3 
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm' 
                        : 'bg-white/5 text-slate-500 border-white/5 line-through opacity-50'
                    }`}
                    title="Cliquer pour afficher/masquer la VFC EMA 3j"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    EMA 3j
                  </button>

                  <button
                    type="button"
                    onClick={() => setVfcCurves(p => ({ ...p, ema7: !p.ema7 }))}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold font-mono transition-all cursor-pointer border ${
                      vfcCurves.ema7 
                        ? 'bg-pink-500/20 text-pink-300 border-pink-500/40 shadow-sm' 
                        : 'bg-white/5 text-slate-500 border-white/5 line-through opacity-50'
                    }`}
                    title="Cliquer pour afficher/masquer la VFC Ligne de Base EMA 7j"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-pink-400" />
                    Base 7j
                  </button>
                </div>
              </div>

              <div className="flex-1 w-full min-h-[220px] relative">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="day" stroke="#64748b" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis stroke="#64748b" domain={['auto', 'auto']} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
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
            </div>

          </div>

          {/* POINT 4 : PANNEAU D'INSPECTION & DIAGNOSTIC DYNAMIQUE DE CHARGE BANISTER */}
          {currentInspectedDay && banisterInterpretation && (
            <div className="bg-slate-900/70 border border-white/10 rounded-2xl p-4 sm:p-5 flex flex-col gap-4 shadow-xl">
              {/* En-tête avec date inspectée, badge temporel, état épinglé et bouton retour aujourd'hui */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <div className="p-2 rounded-xl bg-blue-500/15 text-blue-400 border border-blue-500/25">
                    <Calendar size={16} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-white capitalize m-0">
                        {formatFullInspectionDate(currentInspectedDay.dateStr)}
                      </h4>
                      {currentInspectedDay.isToday ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-500/25 text-blue-300 border border-blue-500/40">
                          Aujourd'hui (Jour J)
                        </span>
                      ) : currentInspectedDay.isFuture ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-500/25 text-purple-300 border border-purple-500/40">
                          Projection (+{currentInspectedDay.offset}j)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-white/10 text-slate-300 border border-white/10">
                          J{currentInspectedDay.offset}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5 mb-0">
                      Cliquez sur la courbe Banister pour figer une date et inspecter l'impact de chaque entraînement
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isDayPinned ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2.5 py-1 rounded-xl">
                      <Pin size={12} className="text-amber-400" /> Date Épinglée
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 bg-white/5 border border-white/10 px-2.5 py-1 rounded-xl font-mono">
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
                      className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-blue-300 hover:text-blue-200 border border-white/10 transition-colors cursor-pointer"
                      title="Réinitialiser l'inspection sur la date d'aujourd'hui"
                    >
                      <RotateCcw size={12} />
                      <span>Aujourd'hui</span>
                    </button>
                  )}
                </div>
              </div>

              {/* 4 Métriques Clés Instantanées du Jour Inspecté */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* Forme TSB */}
                <div className="p-3 rounded-xl bg-black/40 border border-white/10 flex flex-col justify-between">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                    Forme (TSB)
                  </span>
                  <div className="flex items-baseline gap-2 my-1">
                    <span className={`text-2xl font-black font-mono ${
                      currentInspectedDay.tsb >= 10 ? 'text-emerald-400' :
                      currentInspectedDay.tsb >= 0 ? 'text-sky-300' :
                      currentInspectedDay.tsb >= -25 ? 'text-indigo-300' : 'text-rose-400'
                    }`}>
                      {currentInspectedDay.tsb > 0 ? `+${currentInspectedDay.tsb}` : currentInspectedDay.tsb}
                    </span>
                  </div>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border inline-block truncate ${banisterInterpretation.zoneBadge}`}>
                    {banisterInterpretation.zoneTitle}
                  </span>
                </div>

                {/* Fatigue Aiguë ATL */}
                <div className="p-3 rounded-xl bg-black/40 border border-white/10 flex flex-col justify-between">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                    Fatigue Aiguë (ATL)
                  </span>
                  <div className="flex items-baseline gap-2 my-1">
                    <span className="text-2xl font-black font-mono text-rose-400">
                      {currentInspectedDay.loadEMA7}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">pts</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">
                    Moyenne mobile {tauFatigue}j
                  </span>
                </div>

                {/* Condition CTL */}
                <div className="p-3 rounded-xl bg-black/40 border border-white/10 flex flex-col justify-between">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                    Condition Durable (CTL)
                  </span>
                  <div className="flex items-baseline gap-2 my-1">
                    <span className="text-2xl font-black font-mono text-sky-400">
                      {currentInspectedDay.loadEMA21}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">pts</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">
                    Moyenne mobile {tauFitness}j
                  </span>
                </div>

                {/* Charge Quotidienne */}
                <div className="p-3 rounded-xl bg-black/40 border border-white/10 flex flex-col justify-between">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                    Charge Quotidienne
                  </span>
                  <div className="flex items-baseline gap-2 my-1">
                    <span className="text-2xl font-black font-mono text-amber-300">
                      {currentInspectedDay.load}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">pts</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">
                    {currentInspectedDay.sessions?.length || 0} séance(s) ce jour
                  </span>
                </div>
              </div>

              {/* Explication Contextuelle Rédigée en Français Clair */}
              <div className="p-3.5 rounded-xl bg-black/30 border border-white/5 space-y-2">
                <div className="flex items-center gap-2">
                  <Sparkles size={14} className="text-blue-400 shrink-0" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Diagnostic Physiologique & Recommandation
                  </span>
                </div>
                <p className="text-xs text-slate-200 leading-relaxed m-0">
                  {banisterInterpretation.summary}
                </p>
                <p className="text-xs text-emerald-300 font-medium bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-lg m-0">
                  🎯 <strong>Conseil d'entraînement :</strong> {banisterInterpretation.prescription}
                </p>
              </div>

              {/* Séances Enregistrées Réalisées Ce Jour-Là */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] uppercase tracking-wider font-bold text-slate-300 flex items-center gap-1.5">
                    <Dumbbell size={13} className="text-blue-400" />
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
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                            {s.load} pts
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mt-1">
                          <span>⏱️ {s.duration} min</span>
                          <span>RPE Card: {s.rpeC}/10 · Musc: {s.rpeM}/10</span>
                        </div>
                        {s.notes && (
                          <p className="text-[10px] text-slate-400 italic line-clamp-1 m-0 pt-1 border-t border-white/5">
                            « {s.notes} »
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-dashed border-white/10 text-xs text-slate-400 text-center">
                    🌿 Journée de repos (0 point de charge) — Favorable à l'abaissement de la fatigue aiguë ATL et au relèvement du TSB.
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* FOCUS QUALITÉ INDIVIDUELLE : COURBES EMA 3 / 7 / 21 JOURS & TENDANCES */}
      {showQualities && qualities.length > 0 && (
        <div className="flex flex-col gap-6">
          {/* POINT 5 : RUBAN DE STATUT DE RÉMANENCE IMMÉDIAT (« QUICK STATUS BAR ») */}
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/60 border border-white/10 space-y-3.5 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30">
                    <Layers size={16} />
                  </div>
                  <h4 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider m-0">
                    Ruban de Statut de Rémanence Immédiat
                  </h4>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-bold border border-blue-500/30">
                    {qualities.length} Filières
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1 mb-0">
                  Surveillance en direct de l'effet résiduel, des paliers de stabilisation et des urgences de rappel
                </p>
              </div>

              {/* Filtres rapides d'urgence du ruban */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setRemanenceFilter('all')}
                  className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                    remanenceFilter === 'all'
                      ? 'bg-blue-600 text-white border-blue-400 shadow-sm font-bold'
                      : 'bg-white/5 text-slate-400 hover:text-white border-white/5'
                  }`}
                >
                  Toutes ({remanenceStatusList.length})
                </button>

                <button
                  type="button"
                  onClick={() => setRemanenceFilter('urgent')}
                  className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer border flex items-center gap-1.5 ${
                    remanenceFilter === 'urgent'
                      ? 'bg-rose-600 text-white border-rose-400 shadow-sm font-bold'
                      : 'bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 border-rose-500/30'
                  }`}
                >
                  <span>🚨 Déclin & Urgence</span>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-black/40 font-bold">
                    {urgentCount}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setRemanenceFilter('recall')}
                  className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer border flex items-center gap-1.5 ${
                    remanenceFilter === 'recall'
                      ? 'bg-amber-600 text-white border-amber-400 shadow-sm font-bold'
                      : 'bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 border-amber-500/30'
                  }`}
                >
                  <span>⚡ Rappel (24-48h)</span>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-black/40 font-bold">
                    {recallCount}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setRemanenceFilter('optimal')}
                  className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer border flex items-center gap-1.5 ${
                    remanenceFilter === 'optimal'
                      ? 'bg-emerald-600 text-white border-emerald-400 shadow-sm font-bold'
                      : 'bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 border-emerald-500/30'
                  }`}
                >
                  <span>✅ Consolidées</span>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-black/40 font-bold">
                    {optimalCount}
                  </span>
                </button>
              </div>
            </div>

            {/* Défilement horizontal des cartes de rémanence express */}
            <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar pt-1">
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
                    onClick={() => setSelectedQualityId(item.quality.id)}
                    className={`shrink-0 w-64 p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between select-none ${
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
                          <span className={`text-[10px] font-black font-mono px-1.5 py-0.5 rounded ${
                            isSelected ? 'bg-blue-500 text-white' : 'bg-white/10 text-slate-300'
                          }`}>
                            #{item.rank}
                          </span>
                          <span className="text-xs font-bold text-white truncate block">
                            {item.quality.name}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono mt-1 block">
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
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border ${item.statusBg}`}>
                        <IconComponent size={11} className="shrink-0" />
                        <span className="truncate">{item.statusLabel}</span>
                      </span>
                    </div>

                    {/* Ligne d'action & dernier rappel */}
                    <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[10px] font-mono text-slate-400">
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
                <div className="w-full py-4 text-center text-xs text-slate-400 bg-white/[0.02] rounded-xl border border-white/5">
                  Aucune qualité ne correspond à ce filtre de rémanence.
                </div>
              )}
            </div>
          </div>

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

              {/* Rapprochement des filtres temporels directement à côté de la filière active */}
              <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10 text-[11px]">
                <span className="text-[#94A3B8] px-1 text-[10px] font-semibold flex items-center gap-1">
                  <Gauge size={11} className="text-blue-400" />
                  vs :
                </span>
                <button
                  type="button"
                  onClick={() => setTrendBasis('period')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                    trendBasis === 'period'
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Compare chaque EMA à sa fenêtre d'oscillation (3j/7j/21j)"
                >
                  Période (3j/7j/21j)
                </button>
                <button
                  type="button"
                  onClick={() => setTrendBasis('daily')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                    trendBasis === 'daily'
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Compare l'EMA d'aujourd'hui à celle d'hier (J-1)"
                >
                  J-1 (Veille)
                </button>
                <button
                  type="button"
                  onClick={() => setTrendBasis('week')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                    trendBasis === 'week'
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Compare l'EMA d'aujourd'hui à celle de la semaine passée (J-7)"
                >
                  J-7 (Semaine)
                </button>
              </div>
            </div>

            {/* Sémantique claire des tendances */}
            <div className="text-[11px] font-mono text-[#94A3B8] flex items-center gap-1.5 bg-black/25 px-2.5 py-1 rounded-lg border border-white/5">
              <span className="flex items-center gap-1 text-emerald-400 font-bold">
                <ArrowUp size={11} className="stroke-[3]" /> Hausse
              </span>
              <span className="text-slate-600">|</span>
              <span className="flex items-center gap-1 text-rose-400 font-bold">
                <ArrowDown size={11} className="stroke-[3]" /> Baisse
              </span>
            </div>
          </div>

          {/* SÉLECTEUR DE FILIÈRES : GROUPEMENT PAR CATÉGORIES + RECHERCHE + BADGES ÉPURÉS SANS 0 */}
          <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              {/* Onglets de filtrage par catégorie physiologique */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {[
                  { id: 'all', label: 'Toutes' },
                  { id: 'cardio', label: '🫀 Cardio' },
                  { id: 'force', label: '🏋️ Force' },
                  { id: 'specific', label: '⚡ Spécifique' }
                ].map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                      selectedCategory === cat.id
                        ? 'bg-blue-600/30 text-blue-300 border-blue-500/40 font-bold shadow-sm'
                        : 'bg-white/5 text-slate-400 hover:text-white border-white/5'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}

                {/* Bouton de bascule pour masquer les qualités à zéro */}
                <button
                  type="button"
                  onClick={() => setHideZeroOnly(!hideZeroOnly)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                    hideZeroOnly
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                      : 'bg-white/5 text-slate-400 hover:text-white border-white/5'
                  }`}
                  title="Masquer les qualités dont les valeurs EMA sont toutes à zéro"
                >
                  <span>🔥 Actives uniquement</span>
                  <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${hideZeroOnly ? 'bg-amber-400/20 text-amber-200' : 'bg-white/10 text-slate-400'}`}>
                    {activeQualitiesCount}/{qualities.length}
                  </span>
                </button>
              </div>

              {/* Barre de recherche fine */}
              <div className="relative flex items-center min-w-[200px] sm:w-64">
                <Search size={13} className="absolute left-2.5 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={qualitySearch}
                  onChange={(e) => setQualitySearch(e.target.value)}
                  placeholder="Rechercher une qualité (VO2, seuil...)"
                  className="w-full pl-8 pr-7 py-1.5 text-xs bg-slate-950/70 border border-white/10 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:bg-slate-900 transition-all shadow-inner"
                />
                {qualitySearch && (
                  <button
                    type="button"
                    onClick={() => setQualitySearch('')}
                    className="absolute right-2.5 text-slate-400 hover:text-white cursor-pointer"
                    title="Effacer la recherche"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* Puces de sélection : masquage automatique des badges à zéro pour épurer l'interface */}
            <div className="flex flex-wrap gap-1.5 pt-0.5">
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
                    onClick={() => setSelectedQualityId(q.id)}
                    className={`group px-3 py-1.5 rounded-xl text-xs transition-all border cursor-pointer flex items-center gap-1.5 ${
                      isSelected 
                        ? 'bg-blue-600 text-white border-blue-400 shadow-md shadow-blue-600/25 font-bold' 
                        : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/5 hover:border-white/15'
                    }`}
                  >
                    <span>{q.name}</span>
                    {/* LOGIQUE DE MASQUAGE AUTOMATIQUE : badge affiché UNIQUEMENT si valeur > 0 */}
                    {val3 > 0 ? (
                      <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${
                        isSelected ? 'bg-black/30 text-blue-100' : 'bg-blue-500/20 text-blue-300'
                      }`}>
                        {val3}
                      </span>
                    ) : null}
                    {val3 > 0 && isUp && <ArrowUp size={11} className={`stroke-[3] ${isSelected ? 'text-emerald-200' : 'text-emerald-400'}`} />}
                    {val3 > 0 && isDown && <ArrowDown size={11} className={`stroke-[3] ${isSelected ? 'text-rose-200' : 'text-rose-400'}`} />}
                  </button>
                );
              })}

              {filteredQualities.length === 0 && (
                <div className="flex items-center justify-between w-full py-2.5 px-3 bg-white/5 rounded-xl border border-white/5 text-xs text-slate-400">
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
            <div className="bg-slate-900/80 border border-white/10 rounded-xl p-3.5 flex flex-col justify-between hover:border-sky-500/30 transition-all shadow-md">
              <div className="flex items-center justify-between gap-1 mb-1">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-400"></span>
                  <span className="text-xs text-slate-200 font-semibold">EMA 3j (Court terme)</span>
                </div>
                <span className="text-[10px] text-[#94A3B8] font-mono">vs {periodLabel3}</span>
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

              <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-[#94A3B8]">
                <span>Réf. {periodLabel3} : <strong className="text-slate-200">{prevVal3}</strong></span>
                <span className={d3 > 0.05 ? 'text-emerald-400 font-semibold' : d3 < -0.05 ? 'text-rose-400 font-semibold' : 'text-[#94A3B8]'}>
                  Δ {d3 > 0 ? `+${d3}` : d3}
                </span>
              </div>
            </div>

            {/* EMA 7j : BLEU COBALT */}
            <div className="bg-slate-900/80 border border-white/10 rounded-xl p-3.5 flex flex-col justify-between hover:border-blue-500/30 transition-all shadow-md">
              <div className="flex items-center justify-between gap-1 mb-1">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                  <span className="text-xs text-slate-200 font-semibold">EMA 7j (Moyen terme)</span>
                </div>
                <span className="text-[10px] text-[#94A3B8] font-mono">vs {periodLabel7}</span>
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

              <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-[#94A3B8]">
                <span>Réf. {periodLabel7} : <strong className="text-slate-200">{prevVal7}</strong></span>
                <span className={d7 > 0.05 ? 'text-emerald-400 font-semibold' : d7 < -0.05 ? 'text-rose-400 font-semibold' : 'text-[#94A3B8]'}>
                  Δ {d7 > 0 ? `+${d7}` : d7}
                </span>
              </div>
            </div>

            {/* EMA 21j : INDIGO FONCÉ */}
            <div className="bg-slate-900/80 border border-white/10 rounded-xl p-3.5 flex flex-col justify-between hover:border-indigo-500/30 transition-all shadow-md">
              <div className="flex items-center justify-between gap-1 mb-1">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-400"></span>
                  <span className="text-xs text-slate-200 font-semibold">EMA 21j (Fond durable)</span>
                </div>
                <span className="text-[10px] text-[#94A3B8] font-mono">vs {periodLabel21}</span>
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

              <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-[#94A3B8]">
                <span>Réf. {periodLabel21} : <strong className="text-slate-200">{prevVal21}</strong></span>
                <span className={d21 > 0.05 ? 'text-emerald-400 font-semibold' : d21 < -0.05 ? 'text-rose-400 font-semibold' : 'text-[#94A3B8]'}>
                  Δ {d21 > 0 ? `+${d21}` : d21}
                </span>
              </div>
            </div>

            {/* Ratio ACWR */}
            <div className="bg-slate-900/80 border border-white/10 rounded-xl p-3.5 flex flex-col justify-between hover:border-white/20 transition-all shadow-md">
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className="text-xs text-slate-200 font-semibold">Ratio ACWR (7j / 21j)</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
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
                <span className="text-3xl font-black font-mono text-white">{curr.acwr}</span>
                <span className="text-[11px] text-[#94A3B8] font-mono">
                  Sweet Spot : 0.8 - 1.3x
                </span>
              </div>
              <div className="pt-2 border-t border-white/5 text-[11px] text-[#94A3B8] flex items-center justify-between">
                <span>Modèle Gabbett & Banister</span>
                <span className="text-slate-400 font-semibold">{curr.acwr >= 0.8 && curr.acwr <= 1.3 ? 'Sécuritaire' : 'Surveillance'}</span>
              </div>
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
        </div>
      )}

    </div>
  );
}
