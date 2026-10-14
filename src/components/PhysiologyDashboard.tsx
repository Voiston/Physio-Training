import { useState, useMemo, useEffect, memo } from 'react';
import { 
  ComposedChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, ReferenceLine 
} from 'recharts';
import { 
  AlertTriangle, TrendingUp, TrendingDown, Activity, Sparkles, 
  Info, Gauge, Trophy, FileText, 
  ShieldAlert, Sliders, Heart, Dumbbell, Flame,
  Calendar, Clock, Pin, Zap, ChevronLeft, ChevronRight, Target, Table as TableIcon
} from 'lucide-react';
import { calculateEMA } from '../utils/mathHelpers';
import { getLocalYYYYMMDD } from '../utils/dateHelpers';
import { 
  computeCardioVsMuscularBalance, 
  computeIntensityDistribution,
  computePerceivedFatigueAnalysis
} from '../utils/physiology';
import { isPrimary } from '../utils/loadHelpers';
import { getTsbZone, calculateTsbPercent } from '../utils/zones';
import { computeVfcAnalysis, computeHrRestAnalysis } from '../utils/vfcHelpers';
import type { TooltipContentProps, MouseHandlerDataParam } from 'recharts';
import type {
  BanisterPerformanceResult, FosterMetricsResult, TaperingAnalysisResult,
  CardioMuscularBalance, IntensityDistribution, PerceivedFatigueAnalysis
} from '../utils/physiology';
import type { Quality, EventsByQuality } from '../types';
import type { DailyMetrics, PhysiologicalSettings } from '../hooks/useMetricsState';

/** Séance agrégée affichée dans l'inspection d'un jour. */
interface DaySession {
  qualityId: string;
  qualityName: string;
  load: number;
  duration: number;
  rpeM: number;
  rpeC: number;
  fatigue: number | null;
  notes: string;
  sessionType: string;
}

/** Point de la série affichée (Banister / VFC). */
interface ChartDay {
  dateStr: string;
  day: number;
  offset: number;
  isToday: boolean;
  isFuture: boolean;
  vfc: number | null;
  hrRest: number | null;
  readiness: number | null;
  load: number;
  vfcEMA3: number | null;
  vfcEMA7: number | null;
  loadEMA3: number;
  loadEMA7: number;
  loadEMA21: number;
  tsb: number;
  tsbPercent: number | null;
  sessions: DaySession[];
  month?: number;
  atl?: number;
  ctl?: number;
  acwr?: number;
  acwrUncoupled?: number;
}

/** Valeurs minimales utilisées par l'interprétation Banister. */
interface BanisterDayInput {
  tsb?: number;
  loadEMA7?: number;
  loadEMA21?: number;
}

export interface PhysiologyDashboardProps {
  events?: EventsByQuality;
  dailyMetrics?: Record<string, DailyMetrics>;
  qualities?: Quality[];
  fosterMetrics?: FosterMetricsResult | null;
  banisterPerformance?: BanisterPerformanceResult | null;
  taperingAnalysis?: TaperingAnalysisResult | null;
  cardioMuscularBalance?: CardioMuscularBalance | null;
  intensityDistribution?: IntensityDistribution | null;
  perceivedFatigueAnalysis?: PerceivedFatigueAnalysis | null;
  isSimulationActive?: boolean;
  physioSettings?: PhysiologicalSettings | null;
  onOpenCompetitionModal?: (() => void) | null;
  onOpenReportModal?: (() => void) | null;
  onOpenPhysioSettingsModal?: (() => void) | null;
  onToggleSimulation?: (() => void) | null;
}

/**
 * Formate une date YYYY-MM-DD en français complet pour l'inspection de séance
 */
function formatFullInspectionDate(dateStr: string | null | undefined): string {
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
function getDynamicBanisterInterpretation(
  dayData: BanisterDayInput | null | undefined,
  _tauFatigue: number = 7,
  tauFitness: number = 28,
  historyDays: number = 30,
  hasInitialCtl: boolean = false
) {
  if (!dayData) return null;
  const { loadEMA7 = 0, loadEMA21 = 0 } = dayData;
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
 * Tooltip hautement optimisé à l'échelle du module
 */
const CustomTooltip = memo(function CustomTooltip({ active, payload, label }: TooltipContentProps) {
  if (active && payload && payload.length) {
    const dataItem = payload[0]?.payload as ChartDay | undefined;
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

export default function PhysiologyDashboard({ 
  events = {}, 
  dailyMetrics = {}, 
  qualities = [], 
  fosterMetrics = null,
  banisterPerformance = null,
  taperingAnalysis = null,
  cardioMuscularBalance = null,
  intensityDistribution = null,
  perceivedFatigueAnalysis = null,
  isSimulationActive = false,
  physioSettings = null,
  onOpenCompetitionModal = null,
  onOpenReportModal = null,
  onOpenPhysioSettingsModal = null,
  onToggleSimulation = null
}: PhysiologyDashboardProps) {
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null); // 'tsb' | 'atl' | 'ctl' | null
  const [banisterCurves, setBanisterCurves] = useState({ atl: true, ctl: true, tsb: true });
  const [vfcCurves, setVfcCurves] = useState({ vfc: true, ema3: true, ema7: true });

  // Inspection d'un point Banister, affichage tableau accessible
  const [selectedBanisterDay, setSelectedBanisterDay] = useState<ChartDay | null>(null);
  const [isDayPinned, setIsDayPinned] = useState(false);
  const [showDataTable, setShowDataTable] = useState(false);

  // Écouteur clavier pour fermeture accessible des infobulles scientifiques (Touche Escape - WCAG 2.1)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activeTooltip) {
        setActiveTooltip(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTooltip]);

  const tauFatigue = physioSettings?.tauFatigue || 7;
  const tauFitness = physioSettings?.tauFitness || 28;

  // 1. Préparation des données globales Banister & VFC pour Recharts
  const chartData = useMemo<ChartDay[]>(() => {
    if (banisterPerformance && banisterPerformance.series && banisterPerformance.series.length > 0) {
      const vfcRaw = banisterPerformance.series.map(point => dailyMetrics[point.dateStr]?.vfc || null);
      const vfcEMA3 = calculateEMA(vfcRaw, 3, false);
      const vfcEMA7 = calculateEMA(vfcRaw, 7, false);

      return banisterPerformance.series.map((point, idx) => {
        const dateStr = point.dateStr;
        const vfc = dailyMetrics[dateStr]?.vfc || null;
        const hrRest = dailyMetrics[dateStr]?.hrRest ?? dailyMetrics[dateStr]?.rhr ?? null;
        const readiness = dailyMetrics[dateStr]?.readiness || null;
        
        const daySessions: DaySession[] = [];
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
    const rawData: Array<Pick<ChartDay, 'dateStr' | 'day' | 'offset' | 'isToday' | 'isFuture' | 'vfc' | 'hrRest' | 'readiness' | 'load' | 'sessions'>> = [];
    const futureDays = isSimulationActive ? 14 : (taperingAnalysis ? 7 : 0);
    
    for (let i = -29; i <= futureDays; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const dateStr = getLocalYYYYMMDD(d);
      
      const vfc = dailyMetrics[dateStr]?.vfc || null;
      const hrRest = dailyMetrics[dateStr]?.hrRest ?? dailyMetrics[dateStr]?.rhr ?? null;
      const readiness = dailyMetrics[dateStr]?.readiness || null;
      let totalLoad = 0;
      const daySessions: DaySession[] = [];
      
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

  // Contrôles de navigation séquentielle
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

  // Interprétation dynamique Banister pour le jour inspecté
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

  // Analyses personnalisées de VFC et FC Repos
  const vfcAnalysis = useMemo(() => {
    return computeVfcAnalysis(dailyMetrics, currentInspectedDay?.dateStr || null);
  }, [dailyMetrics, currentInspectedDay?.dateStr]);

  const hrRestAnalysis = useMemo(() => {
    return computeHrRestAnalysis(dailyMetrics, currentInspectedDay?.dateStr || null);
  }, [dailyMetrics, currentInspectedDay?.dateStr]);

  const balance = useMemo(() => {
    return cardioMuscularBalance || computeCardioVsMuscularBalance(events);
  }, [cardioMuscularBalance, events]);

  const intensity = useMemo(() => {
    return intensityDistribution || computeIntensityDistribution(events, qualities);
  }, [intensityDistribution, events, qualities]);

  const fatigueReport = useMemo(() => {
    return perceivedFatigueAnalysis || computePerceivedFatigueAnalysis(events);
  }, [perceivedFatigueAnalysis, events]);

  // Le Coach Virtuel (Analyse algorithmique des tendances)
  const coachInsights = useMemo(() => {
    if (chartData.length === 0) return [];
    const todayEntry = chartData.find(d => d.isToday) || chartData.filter(d => !d.isFuture).slice(-1)[0] || chartData[0];
    const insights = [];

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

  // Données synthétiques Banister du jour
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

    const targetIdx = todayIndex >= 0 ? todayIndex : chartData.length - 1;
    const sevenDaysAgo = targetIdx >= 7 ? chartData[targetIdx - 7] : chartData[0];
    const ctlPast = sevenDaysAgo?.loadEMA21 ?? ctl;
    const ctlRamp = Math.round((ctl - ctlPast) * 10) / 10;
    const ctlRampPercent = ctlPast > 10 ? Math.round(((ctl - ctlPast) / ctlPast) * 1000) / 10 : null;

    return { atl, ctl, tsb, tsbPercent, tsbZone, acwr, ctlRamp, ctlRampPercent };
  }, [chartData, banisterPerformance?.historyDays, physioSettings?.initialCtl, tauFitness]);

  // Définitions détaillées des infobulles scientifiques
  const physioTooltips = useMemo(() => {
    return {
      tsb: {
        id: 'tsb',
        name: 'TSB',
        fullTitle: 'Training Stress Balance (Forme & Fraîcheur)',
        formula: 'TSB = CTL − ATL (Condition durable − Fatigue aiguë, exprimé en % de la CTL)',
        color: '#10b981',
        tagClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
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
          !banisterSummary ? 'Calcul en cours' :
          Number(banisterSummary.acwr) > 1.5 ? 'Charge aiguë dangereuse (>1.5x CTL)' :
          Number(banisterSummary.acwr) >= 1.3 ? 'Surcharge aiguë stimulante (1.3-1.5x)' :
          Number(banisterSummary.acwr) >= 0.8 ? 'Assimilation équilibrée (0.8-1.3x)' :
          'Sous-charge aiguë / Récupération (<0.8x)',
        thresholds: [
          {
            zone: 'ACWR > 1.5x',
            title: 'Zone de Risque Blessure (Gabbett)',
            detail: 'Augmentation trop brutale de la charge aiguë. Vulnérabilité accrue aux lésions musculaires et tendineuses.',
            status: 'danger',
            tagClass: 'bg-red-500/20 text-red-300 border-red-500/30'
          },
          {
            zone: 'ACWR 1.3 à 1.5x',
            title: 'Zone Optimale de Développement',
            detail: 'Surcharge aiguë efficace provoquant une réponse adaptative puissante sans déborder les capacités.',
            status: 'warning',
            tagClass: 'bg-amber-500/20 text-amber-300 border-amber-500/30'
          },
          {
            zone: 'ACWR 0.8 à 1.3x',
            title: 'Zone de Sécurité & Assimilation (Sweet Spot)',
            detail: 'Charge aiguë en phase avec votre capacité chronique. Progression stable et risque minimal.',
            status: 'success',
            tagClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
          },
          {
            zone: 'ACWR < 0.8x',
            title: 'Phase de Régénération / Sous-charge',
            detail: 'Baisse volontaire pour dissiper la fatigue avant un objectif, ou désentraînement passif si involontaire.',
            status: 'info',
            tagClass: 'bg-sky-500/20 text-sky-300 border-sky-500/30'
          }
        ]
      },
      ctl: {
        id: 'ctl',
        name: 'CTL',
        fullTitle: 'Chronic Training Load (Condition Physique / Fond)',
        formula: `Moyenne Mobile Exponentielle continue (τ = ${tauFitness} jours)`,
        color: '#6366f1',
        tagClass: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
        role: "Reflète le capital d'entraînement durable (« la caisse » ou le moteur aérobie et musculaire de fond) accumulé sur les 4 à 6 dernières semaines. Elle progresse lentement mais s'érode aussi beaucoup plus lentement que la fatigue.",
        currentValue: banisterSummary ? `${banisterSummary.ctl} pts (Rampe 7j : ${banisterSummary.ctlRamp > 0 ? `+${banisterSummary.ctlRamp}` : banisterSummary.ctlRamp} pts${banisterSummary.ctlRampPercent !== null ? ` / ${banisterSummary.ctlRampPercent > 0 ? `+${banisterSummary.ctlRampPercent}%` : `${banisterSummary.ctlRampPercent}%`}` : ''})` : '0 pts',
        currentInterpretation: 
          !banisterSummary ? 'Calcul en cours' :
          banisterSummary.ctlRampPercent !== null && banisterSummary.ctlRampPercent > 12 ? 'Progression agressive (>12%/sem)' :
          banisterSummary.ctlRampPercent !== null && banisterSummary.ctlRampPercent >= 4 ? 'Rampe saine et durable (4-12%/sem)' :
          banisterSummary.ctlRampPercent !== null && banisterSummary.ctlRampPercent >= -4 ? 'Plateau stable (±4%/sem)' :
          'Déclin de condition de fond (< -4%/sem)',
        thresholds: [
          {
            zone: '+4% à +12%/sem',
            title: 'Rampe de Progression Idéale',
            detail: 'Rythme optimal de montée en charge chronique assurant des adaptations durables sans saturer l\'athlète.',
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
    <section 
      aria-label="Tableau de bord des métriques et dynamiques physiologiques" 
      className="p-4 md:p-6 w-full flex flex-col gap-6 pb-12"
    >
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
                onClick={onOpenCompetitionModal ?? undefined}
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

        {/* CARTE 2 : MONOTONIE DE FOSTER & STRAIN */}
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
          {(['tsb', 'atl', 'ctl'] as const).map((key) => {
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
                gaugePercent = 50;
                gaugeSubtextLeft = 'Calibration';
                gaugeSubtextCenter = 'Convergence en cours';
                gaugeSubtextRight = '30-45j';
                cardBorder = 'border-slate-700/60 bg-gradient-to-b from-slate-900/60 to-slate-950/80';
                valueColor = 'text-slate-300';
                badgeClass = 'bg-slate-700/60 text-slate-300 border-slate-600';
              } else {
                mainNumber = tsbPct !== null && tsbPct !== undefined ? (tsbPct > 0 ? `+${tsbPct}%` : `${tsbPct}%`) : (tsbVal > 0 ? `+${tsbVal}` : `${tsbVal}`);
                unitLabel = 'CTL';
                secondaryDetail = `(${tsbVal > 0 ? `+${tsbVal}` : tsbVal} pts)`;

                const clampPct = Math.max(-50, Math.min(30, tsbPct ?? tsbVal));
                gaugePercent = Math.max(4, Math.min(96, ((clampPct + 50) / 80) * 100));
                gaugeSubtextLeft = '-35% Surch.';
                gaugeSubtextCenter = '+5% à +25% Pic';
                gaugeSubtextRight = '>+25% Déclin';

                if (banisterSummary?.tsbZone?.color === 'rose') {
                  cardBorder = 'border-red-500/40 bg-gradient-to-b from-red-950/25 to-slate-900/80 hover:border-red-400/60';
                  valueColor = 'text-red-400';
                  badgeClass = 'bg-red-500/20 text-red-300 border-red-500/30';
                } else if (banisterSummary?.tsbZone?.color === 'amber') {
                  cardBorder = 'border-amber-500/35 bg-gradient-to-b from-amber-950/20 to-slate-900/80 hover:border-amber-400/50';
                  valueColor = 'text-amber-400';
                  badgeClass = 'bg-amber-500/20 text-amber-300 border-amber-500/30';
                } else if (banisterSummary?.tsbZone?.color === 'emerald') {
                  cardBorder = 'border-emerald-500/35 bg-gradient-to-b from-emerald-950/20 to-slate-900/80 hover:border-emerald-400/50';
                  valueColor = 'text-emerald-400';
                  badgeClass = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
                } else {
                  cardBorder = 'border-sky-500/30 bg-gradient-to-b from-sky-950/20 to-slate-900/80 hover:border-sky-400/50';
                  valueColor = 'text-sky-400';
                  badgeClass = 'bg-sky-500/20 text-sky-300 border-sky-500/30';
                }
              }
            } else if (isAtl) {
              const atlVal = banisterSummary?.atl ?? 0;
              const acwr = banisterSummary?.acwr;
              mainNumber = `${atlVal}`;
              unitLabel = 'pts';
              secondaryDetail = `(ACWR : ${acwr}x)`;

              const clampAcwr = Math.max(0.4, Math.min(2.0, Number(acwr) || 1.0));
              gaugePercent = Math.max(4, Math.min(96, ((clampAcwr - 0.4) / 1.6) * 100));
              gaugeSubtextLeft = '<0.8 Récup';
              gaugeSubtextCenter = '0.8-1.3 Sweet Spot';
              gaugeSubtextRight = '>1.5 Danger';

              if (Number(acwr) > 1.5) {
                cardBorder = 'border-red-500/40 bg-gradient-to-b from-red-950/25 to-slate-900/80 hover:border-red-400/60';
                valueColor = 'text-red-400';
                badgeClass = 'bg-red-500/20 text-red-300 border-red-500/40';
              } else if (Number(acwr) >= 1.3) {
                cardBorder = 'border-amber-500/35 bg-gradient-to-b from-amber-950/20 to-slate-900/80 hover:border-amber-400/50';
                valueColor = 'text-amber-400';
                badgeClass = 'bg-amber-500/20 text-amber-300 border-amber-500/30';
              } else if (Number(acwr) >= 0.8) {
                cardBorder = 'border-emerald-500/35 bg-gradient-to-b from-emerald-950/20 to-slate-900/80 hover:border-emerald-400/50';
                valueColor = 'text-emerald-400';
                badgeClass = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
              } else {
                cardBorder = 'border-sky-500/30 bg-gradient-to-b from-sky-950/20 to-slate-900/80 hover:border-sky-400/50';
                valueColor = 'text-sky-400';
                badgeClass = 'bg-sky-500/20 text-sky-300 border-sky-500/30';
              }
            } else if (isCtl) {
              const ctlVal = banisterSummary?.ctl ?? 0;
              const ramp = banisterSummary?.ctlRamp ?? 0;
              const rampPct = banisterSummary?.ctlRampPercent;
              mainNumber = `${ctlVal}`;
              unitLabel = 'pts';
              secondaryDetail = `(${ramp > 0 ? `+${ramp}` : ramp} pts/sem)`;

              const pctVal = rampPct ?? (ramp * 2);
              const clampRamp = Math.max(-10, Math.min(20, pctVal));
              gaugePercent = Math.max(4, Math.min(96, ((clampRamp + 10) / 30) * 100));
              gaugeSubtextLeft = '<-4% Perte';
              gaugeSubtextCenter = '+4 à +12% Optimal';
              gaugeSubtextRight = '>+12% Brutal';

              cardBorder = 'border-indigo-500/35 bg-gradient-to-b from-indigo-950/20 to-slate-900/80 hover:border-indigo-400/50';
              valueColor = 'text-indigo-300';
              badgeClass = 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';
            }

            return (
              <div
                key={key}
                onMouseEnter={() => setActiveTooltip(key)}
                onMouseLeave={() => setActiveTooltip(null)}
                className={`relative p-4 rounded-2xl border transition-all duration-300 cursor-help shadow-lg flex flex-col justify-between ${cardBorder}`}
                role="region"
                aria-label={`Indicateur physiologique ${info.name}`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black font-mono tracking-wider text-slate-300 uppercase">
                        {info.name}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveTooltip(isActive ? null : key);
                        }}
                        aria-expanded={isActive}
                        aria-label={`Comprendre le rôle de ${info.name}`}
                        className="text-slate-400 hover:text-white p-0.5 rounded transition-colors focus:outline-none focus:ring-1 focus:ring-blue-400"
                      >
                        <Info size={13} aria-hidden="true" />
                      </button>
                    </div>

                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${badgeClass} font-semibold truncate max-w-[170px]`}>
                      {info.currentInterpretation}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-400 mb-2 truncate" title={info.fullTitle}>
                    {info.fullTitle}
                  </p>

                  <div className="flex items-baseline gap-2 mb-2">
                    <span className={`text-3xl font-black font-mono tracking-tight ${valueColor}`}>
                      {mainNumber}
                    </span>
                    {unitLabel && (
                      <span className="text-xs font-mono font-bold text-slate-400">
                        {unitLabel}
                      </span>
                    )}
                    {secondaryDetail && (
                      <span className="text-xs font-mono text-slate-400">
                        {secondaryDetail}
                      </span>
                    )}
                  </div>
                </div>

                <div className="pt-2 border-t border-white/5 space-y-1">
                  <div className="w-full h-1.5 bg-black/50 rounded-full overflow-hidden relative border border-white/10">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        isTsb ? 'bg-gradient-to-r from-red-500 via-amber-400 via-emerald-400 to-sky-400' :
                        isAtl ? 'bg-gradient-to-r from-sky-400 via-emerald-400 via-amber-400 to-red-500' :
                        'bg-gradient-to-r from-slate-500 via-sky-400 via-emerald-400 to-amber-500'
                      }`}
                      style={{ width: '100%' }}
                    />
                    <div 
                      className="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_6px_rgba(255,255,255,0.9)] transform -translate-x-1/2"
                      style={{ left: `${gaugePercent}%` }}
                      title={`Position actuelle : ${gaugePercent.toFixed(0)}% de l'échelle`}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[9px] font-mono text-slate-400 px-0.5">
                    <span>{gaugeSubtextLeft}</span>
                    <span className="font-bold text-slate-300">{gaugeSubtextCenter}</span>
                    <span>{gaugeSubtextRight}</span>
                  </div>
                </div>

                {/* Bulle explicative accessible */}
                {isActive && (
                  <div 
                    role="tooltip"
                    className="absolute z-50 bottom-full left-0 right-0 sm:left-auto sm:right-auto sm:w-96 mb-2 p-4 rounded-2xl bg-slate-950/95 border border-white/20 shadow-2xl backdrop-blur-xl text-xs space-y-2.5 animate-fadeIn pointer-events-auto"
                  >
                    <div className="flex items-center justify-between border-b border-white/10 pb-2">
                      <div>
                        <span className="font-bold text-white text-xs block">{info.fullTitle}</span>
                        <span className="text-[10px] font-mono text-slate-400">{info.formula}</span>
                      </div>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${info.tagClass} font-bold`}>
                        {info.name}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-300 leading-relaxed m-0">
                      {info.role}
                    </p>

                    <div className="border-t border-white/10 pt-2 space-y-1.5">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                        Seuils de Normalité & Zones Cibles :
                      </span>
                      <div className="space-y-1">
                        {info.thresholds.map((th, tidx) => (
                          <div key={tidx} className="flex items-start justify-between gap-2 p-1.5 rounded-lg bg-white/5 text-[10px]">
                            <div className="flex items-center gap-1.5 font-mono font-bold shrink-0">
                              <span className={`w-1.5 h-1.5 rounded-full ${th.status === 'danger' ? 'bg-red-400' : th.status === 'warning' ? 'bg-amber-400' : th.status === 'success' ? 'bg-emerald-400' : 'bg-sky-400'}`} />
                              <span className="text-slate-200">{th.zone}</span>
                            </div>
                            <div className="text-right">
                              <span className="font-semibold text-slate-300 block">{th.title}</span>
                              <span className="text-[9px] text-slate-400">{th.detail}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION BANISTER PMC : COURBES DE CHARGE, FATIGUE ET FORME */}
      <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-4 sm:p-5 flex flex-col gap-4 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/15 text-blue-400 border border-blue-500/20" aria-hidden="true">
              <Activity size={16} />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider m-0">
                Performance Management Chart (Modèle Banister PMC)
              </h4>
              <p className="text-xs text-slate-300 mt-0.5 mb-0">
                Charge aiguë (ATL · 7j), condition chronique (CTL · 28j) et balance de forme (TSB)
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setBanisterCurves(p => ({ ...p, atl: !p.atl }))}
              aria-pressed={banisterCurves.atl}
              className={`inline-flex items-center gap-1.5 min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
                banisterCurves.atl 
                  ? 'bg-sky-500/20 text-sky-300 border-sky-500/40 shadow-sm' 
                  : 'bg-white/5 text-slate-500 border-white/5 line-through opacity-50'
              }`}
              title="Cliquer pour afficher/masquer la courbe de fatigue aiguë (ATL 7j)"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-sky-400" aria-hidden="true" />
              <span>ATL (Fatigue {tauFatigue}j)</span>
            </button>

            <button
              type="button"
              onClick={() => setBanisterCurves(p => ({ ...p, ctl: !p.ctl }))}
              aria-pressed={banisterCurves.ctl}
              className={`inline-flex items-center gap-1.5 min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
                banisterCurves.ctl 
                  ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40 shadow-sm' 
                  : 'bg-white/5 text-slate-500 border-white/5 line-through opacity-50'
              }`}
              title="Cliquer pour afficher/masquer la courbe de condition de fond (CTL 28j)"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-400" aria-hidden="true" />
              <span>CTL (Fond {tauFitness}j)</span>
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
              title="Cliquer pour afficher/masquer la balance de forme (TSB = CTL - ATL)"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" aria-hidden="true" />
              <span>TSB (Forme)</span>
            </button>

            <button
              type="button"
              onClick={() => setShowDataTable(!showDataTable)}
              aria-pressed={showDataTable}
              className={`inline-flex items-center gap-1.5 min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                showDataTable 
                  ? 'bg-blue-600 text-white border-blue-400 shadow-sm font-bold' 
                  : 'bg-white/5 text-slate-300 hover:text-white border-white/10'
              }`}
              title="Afficher les données sous forme de tableau accessible (WCAG 2.1)"
            >
              <TableIcon size={14} aria-hidden="true" />
              <span className="hidden sm:inline">{showDataTable ? 'Masquer Tableau' : 'Tableau Accessible'}</span>
              <span className="sm:hidden">Tab</span>
            </button>
          </div>
        </div>

        {/* Graphique Banister PMC Recharts */}
        <div className="h-[280px] sm:h-[320px] w-full relative">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart 
              data={chartData} 
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              onClick={(state: MouseHandlerDataParam) => {
                // recharts 3 : l'état de clic expose activeIndex / activeLabel (plus d'activePayload).
                const index = state.activeIndex === null || state.activeIndex === undefined ? NaN : Number(state.activeIndex);
                const clickedDay = (Number.isInteger(index) ? chartData[index] : undefined)
                  ?? chartData.find(d => d.dateStr === state.activeLabel);
                if (clickedDay) {
                  setSelectedBanisterDay(clickedDay);
                  setIsDayPinned(true);
                }
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis 
                dataKey="dateStr" 
                tickFormatter={(str) => {
                  if (!str) return '';
                  const parts = str.split('-');
                  if (parts.length < 3) return str;
                  return `${parts[2]}/${parts[1]}`;
                }}
                stroke="#64748b" 
                tick={{ fontSize: 11, fill: '#64748b' }} 
                minTickGap={24}
                tickLine={false}
                axisLine={false}
              />
              <YAxis stroke="#64748b" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
              <Tooltip content={CustomTooltip} />
              <ReferenceLine y={0} stroke="#475569" strokeDasharray="2 2" />

              <Bar 
                dataKey="load" 
                name="Charge Quotidienne" 
                fill="#3b82f6" 
                opacity={0.3} 
                radius={[3, 3, 0, 0]} 
                maxBarSize={14}
              />

              {banisterCurves.atl && (
                <Line 
                  type="monotone" 
                  dataKey="loadEMA7" 
                  name={`ATL (Fatigue ${tauFatigue}j)`} 
                  stroke="#38bdf8" 
                  strokeWidth={2.5} 
                  dot={false}
                  activeDot={{ r: 5 }}
                />
              )}

              {banisterCurves.ctl && (
                <Line 
                  type="monotone" 
                  dataKey="loadEMA21" 
                  name={`CTL (Fond ${tauFitness}j)`} 
                  stroke="#6366f1" 
                  strokeWidth={2} 
                  strokeDasharray="4 4" 
                  dot={false}
                  activeDot={{ r: 5 }}
                />
              )}

              {banisterCurves.tsb && (
                <Line 
                  type="monotone" 
                  dataKey="tsb" 
                  name="TSB (Forme relative)" 
                  stroke="#10b981" 
                  strokeWidth={2} 
                  dot={false}
                  activeDot={{ r: 5 }}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Tableau de données accessible (WCAG 2.1) */}
        {showDataTable && (
          <div className="overflow-x-auto border-t border-white/10 pt-3">
            <table className="w-full text-xs text-left text-slate-300 font-mono">
              <thead className="bg-white/5 uppercase text-slate-400">
                <tr>
                  <th className="p-2">Date</th>
                  <th className="p-2">Charge</th>
                  <th className="p-2">ATL ({tauFatigue}j)</th>
                  <th className="p-2">CTL ({tauFitness}j)</th>
                  <th className="p-2">TSB</th>
                  <th className="p-2">VFC (ms)</th>
                  <th className="p-2">FC Repos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {chartData.map((d) => (
                  <tr key={d.dateStr} className={d.isToday ? 'bg-blue-600/10 font-bold' : ''}>
                    <td className="p-2">{d.dateStr} {d.isToday ? '(Aujourd\'hui)' : ''}</td>
                    <td className="p-2">{d.load} pts</td>
                    <td className="p-2 text-sky-400">{d.loadEMA7}</td>
                    <td className="p-2 text-indigo-400">{d.loadEMA21}</td>
                    <td className={`p-2 ${d.tsb >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{d.tsb > 0 ? `+${d.tsb}` : d.tsb}</td>
                    <td className="p-2 text-emerald-400">{d.vfc || '—'}</td>
                    <td className="p-2 text-rose-400">{d.hrRest || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* SECTION VFC & FC DE REPOS */}
        <section aria-labelledby="vfc-heading" className="pt-4 border-t border-white/10">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div>
              <h5 id="vfc-heading" className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider m-0">
                Variabilité Cardiaque (VFC) & FC de Repos
              </h5>
              <p className="text-xs text-slate-300 mt-0.5 mb-0">
                Ligne de base en ln(rMSSD), couloir de variation normale (SWC) et alertes parasympathiques
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setVfcCurves(p => ({ ...p, vfc: !p.vfc }))}
                aria-pressed={vfcCurves.vfc}
                className={`inline-flex items-center gap-1.5 min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
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
                <Tooltip content={CustomTooltip} />
                
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

          {/* Analyse statistique personnalisée VFC et FC de Repos */}
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

      {/* PANNEAU D'INSPECTION & DIAGNOSTIC DYNAMIQUE DE CHARGE BANISTER */}
      {currentInspectedDay && banisterInterpretation && (
        <section 
          id="banister-day-inspector"
          aria-label="Inspecteur physiologique du jour sélectionné"
          aria-live="polite"
          className="bg-slate-900/70 border border-white/10 rounded-2xl p-4 sm:p-5 flex flex-col gap-4 shadow-xl"
        >
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
                  Cliquez sur la courbe Banister pour figer une date ou naviguez via les boutons
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
                    if (todayItem) {
                      setSelectedBanisterDay(todayItem);
                      setIsDayPinned(false);
                    }
                  }}
                  className="min-h-[44px] px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-colors cursor-pointer"
                >
                  Revenir à Aujourd'hui
                </button>
              )}

              <div className="flex items-center gap-1 ml-1">
                <button
                  type="button"
                  disabled={!canGoPrev}
                  onClick={handlePrevDay}
                  aria-label="Jour précédent"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed border border-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  type="button"
                  disabled={!canGoNext}
                  onClick={handleNextDay}
                  aria-label="Jour suivant"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed border border-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* Grille métriques du jour inspecté */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-2.5 sm:p-3 rounded-xl bg-black/40 border border-white/10 flex flex-col justify-between">
              <span className="text-xs uppercase font-bold tracking-wider text-slate-300 block truncate">
                TSB (Forme)
              </span>
              <div className="flex items-baseline gap-1.5 my-1">
                <span className={`text-xl sm:text-2xl font-black font-mono ${banisterInterpretation.zoneColor}`}>
                  {currentInspectedDay.tsb > 0 ? `+${currentInspectedDay.tsb}` : currentInspectedDay.tsb}
                </span>
                {currentInspectedDay.tsbPercent !== null && (
                  <span className="text-xs font-mono text-slate-400">
                    ({currentInspectedDay.tsbPercent > 0 ? `+${currentInspectedDay.tsbPercent}%` : `${currentInspectedDay.tsbPercent}%`})
                  </span>
                )}
              </div>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${banisterInterpretation.zoneBadge} truncate block text-center font-bold`}>
                {banisterInterpretation.zoneTitle}
              </span>
            </div>

            <div className="p-2.5 sm:p-3 rounded-xl bg-black/40 border border-white/10 flex flex-col justify-between">
              <span className="text-xs uppercase font-bold tracking-wider text-slate-300 block truncate">
                ATL (Fatigue)
              </span>
              <div className="flex items-baseline gap-1.5 my-1">
                <span className="text-xl sm:text-2xl font-black font-mono text-sky-400">
                  {currentInspectedDay.loadEMA7}
                </span>
                <span className="text-xs font-mono text-slate-300">pts</span>
              </div>
              <span className="text-xs font-mono text-slate-300 truncate">
                Moyenne {tauFatigue}j
              </span>
            </div>

            <div className="p-2.5 sm:p-3 rounded-xl bg-black/40 border border-white/10 flex flex-col justify-between">
              <span className="text-xs uppercase font-bold tracking-wider text-slate-300 block truncate">
                CTL (Fond)
              </span>
              <div className="flex items-baseline gap-1.5 my-1">
                <span className="text-xl sm:text-2xl font-black font-mono text-indigo-400">
                  {currentInspectedDay.loadEMA21}
                </span>
                <span className="text-xs font-mono text-slate-300">pts</span>
              </div>
              <span className="text-xs font-mono text-slate-300 truncate">
                Moyenne {tauFitness}j
              </span>
            </div>

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

          {/* Séances Réalisées Ce Jour-Là */}
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
                      <span className="font-semibold text-slate-100 truncate text-xs">{s.qualityName}</span>
                      <span className="font-bold font-mono text-amber-300 text-xs">
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

      {/* CADRE MÉTHODOLOGIQUE */}
      <details className="group p-4 rounded-2xl bg-slate-900/40 border border-white/10 text-slate-300 text-xs mt-2 cursor-pointer">
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
    </section>
  );
}
