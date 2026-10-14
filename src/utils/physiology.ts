import { calculateEMA, calculateExpDecay } from './mathHelpers';
import { getLocalYYYYMMDD, parseLocalDate, addDays } from './dateHelpers';
import { getDailyAthleteLoad, isPrimary, extractSessionLoad } from './loadHelpers';
import { isCardioQuality } from './qualities';
import { getTsbZone, calculateTsbPercent } from './zones';
import type { TsbZoneInfo } from './zones';
import type { SessionData, EventsByQuality } from '../types';

/** Métriques journalières par date (readiness, vfc, hrRest…). */
type DailyMetricsMap = Record<string, Record<string, number | undefined>>;
import type { TargetCompetition } from '../hooks/useMetricsState';
import { computeVfcAnalysis, computeHrRestAnalysis } from './vfcHelpers';

export { extractSessionLoad };

// ============================================================================
// INTERFACES & STRUCTURES TYPÉES
// ============================================================================

export interface QualityImpact {
  id: string;
  ratio: number;
  confidence?: 'estimé' | 'mesuré';
}

export interface QualityDefinition {
  id: string;
  name: string;
  g?: number;
  o?: number;
  retentionDays?: number;
  category?: 'cardio' | 'force' | 'mixte' | string;
  impacts?: QualityImpact[];
  isCustom?: boolean;
  [key: string]: unknown;
}

export interface SessionImpactContribution {
  load: number;
  loadCardio: number;
  loadMusc: number;
  ratio: number;
  parentName: string;
}

export interface DerivedSession {
  load: number;
  loadCardio: number;
  loadMusc: number;
  isSecondary: boolean;
  sport: string;
  duration: number;
  rpeMusc: number;
  rpeCardio: number;
  parentContributions?: Record<string, SessionImpactContribution>;
  parentQId?: string;
  originalLoad?: number;
  exercises?: SessionData['exercises'];
  [key: string]: unknown;
}

/** Forme minimale d'un bloc d'entraînement lue par les calculs (TrainingBlock ou équivalent). */
export interface BlockLike {
  name?: string;
  startDate?: string;
  endDate?: string;
  durationWeeks?: number;
  focusQualities?: string[];
  targetMultiplier?: number;
  maintenanceMultiplier?: number;
}

export interface BlockTemplate {
  id: string;
  name: string;
  durationWeeks: number;
  focusQualities: string[];
  description: string;
  targetMultiplier: number;
  maintenanceMultiplier: number;
  color: string;
  badge: string;
}

export interface BlockProgress {
  currentDay: number;
  totalDays: number;
  currentWeek: number;
  totalWeeks: number;
  remainingDays: number;
  percent: number;
  isActive: boolean;
  isUpcoming: boolean;
  isPast: boolean;
}

export interface TrainingRecommendation {
  quality: QualityDefinition;
  rank: number;
  isBlockFocus: boolean;
  isHardQuality: boolean;
  cellState: CellState;
  daysSinceLastSession: number | null;
  lastSessionData: SessionData | null;
  urgencyScore: number;
  urgencyLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'OPTIMAL' | 'REST';
  urgencyBadge: string;
  urgencyColor: string;
  reason: string;
  actionTip: string;
}

export interface CellStateLevel {
  status: 'green' | 'orange' | 'red';
  opacity: number;
  daysLeft: number;
  currentLevel: number;
}

export interface CellState {
  status: 'green' | 'orange' | 'red';
  opacity: number;
  daysLeft: number;
  currentLevel: number;
  tooltip: string;
  isBurnout: boolean;
  isAcuteFatigueHigh: boolean;
  blockStateInfo: {
    name: string;
    type: 'focus' | 'maintenance';
    label: string;
  } | null;
  mostRecentSessionDays: number | null;
  refLoad_q: number;
  physio: CellStateLevel;
  prescription: CellStateLevel;
}

// 1. Structure EMACalculation
export interface QualityEMASeriesPoint {
  dateStr: string;
  day: number;
  offset: number;
  load: number;
  isPrimarySession: boolean;
  ema3: number;
  ema7: number;
  ema21: number;
}

export interface QualityEMACurrentStats {
  load: number;
  ema3: number;
  ema7: number;
  ema21: number;
  prevEma3: number;
  prevEma7: number;
  prevEma21: number;
  prevPeriodEma3: number;
  prevPeriodEma7: number;
  prevPeriodEma21: number;
  prevWeekEma3: number;
  prevWeekEma7: number;
  prevWeekEma21: number;
  delta3: number;
  delta7: number;
  delta21: number;
  periodDelta3: number;
  periodDelta7: number;
  periodDelta21: number;
  weekDelta3: number;
  weekDelta7: number;
  weekDelta21: number;
  percent3: number;
  percent7: number;
  percent21: number;
  periodPercent3: number;
  periodPercent7: number;
  periodPercent21: number;
  weekPercent3: number;
  weekPercent7: number;
  weekPercent21: number;
  trend3: 'up' | 'down' | 'flat';
  trend7: 'up' | 'down' | 'flat';
  trend21: 'up' | 'down' | 'flat';
  acwr: number | null;
  trend: 'up' | 'down' | 'flat';
}

export interface EMACalculation {
  qualityId: string;
  series: QualityEMASeriesPoint[];
  current: QualityEMACurrentStats;
  sparkline: QualityEMASeriesPoint[];
}

export type QualityEMAData = EMACalculation;

// 2. Structure FosterLoad
export interface FosterDailyLoad {
  dateStr: string;
  load: number;
}

export interface FosterLoad {
  windowDays: number;
  dailyLoads: FosterDailyLoad[];
  totalLoad: number;
  meanLoad: number;
  stdDev: number;
  monotony: number;
  strain: number;
  riskLevel: 'OPTIMAL' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  riskBadge: string;
  riskColor: string;
  advice: string;
}

export type FosterMetricsResult = FosterLoad;

// 3. Structure BanisterParams & BanisterPerformanceResult
export interface BanisterParams {
  tauFatigue: number;
  tauFitness: number;
  daysHistory?: number;
  daysFuture?: number;
  initialCtl?: number | null;
  kFatigue?: number;
  kFitness?: number;
  p0?: number;
}

export interface BanisterPoint {
  dateStr: string;
  day: number;
  month: number;
  offset: number;
  isToday: boolean;
  isFuture: boolean;
  load: number;
  vfc: number | null;
  readiness: number | null;
  atl: number;
  ctl: number;
  tsb: number;
  tsbPercent: number | null;
  acwr: number;
  acwrUncoupled: number;
}

export interface BanisterPerformanceResult {
  tauFatigue: number;
  tauFitness: number;
  series: BanisterPoint[];
  current: BanisterPoint;
  todayIndex: number;
  futureSeries: BanisterPoint[];
  peakDay: BanisterPoint | null;
  historyDays: number;
  isWarmedUp: boolean;
  tsbZone: TsbZoneInfo;
}

// 4. Structure TaperingRecommendation
export interface TaperingRecommendation {
  targetCompetition: TargetCompetition;
  daysRemaining: number;
  banister: BanisterPerformanceResult;
  compDayData: BanisterPoint;
  targetTsb: number;
  targetTsbUnit: string;
  projectedTsb: number;
  projectedTsbPercent: number | null;
  tsbGap: number;
  tsbZone: TsbZoneInfo;
  foster: FosterLoad;
  futureSessionsCount: number;
  status: 'BUILD' | 'TAPER_START' | 'TAPER_OPTIMAL' | 'TAPER_PASSIVE' | 'TAPER_OVERREACHING' | 'PEAK' | 'POST';
  statusBadge: string;
  statusColor: string;
  advice: string;
}

export type TaperingAnalysisResult = TaperingRecommendation;

// 5. Structure Balance Cardio vs Musculaire
export interface CardioMuscularDailyItem {
  dateStr: string;
  day: number;
  cardioLoad: number;
  muscLoad: number;
  globalLoad: number;
  hasEccentric: boolean;
}

export interface CardioMuscularBalance {
  windowDays: number;
  dailyBreakdown: CardioMuscularDailyItem[];
  totalCardioLoad: number;
  totalMuscLoad: number;
  totalGlobalLoad: number;
  totalEccentricSessions: number;
  cardioPercent: number;
  muscPercent: number;
  asymmetryScore: number;
  tauCardio: number;
  tauMusc: number;
  atlCardio: number;
  atlMusc: number;
  state: 'BALANCED' | 'CARDIO_DOMINANT' | 'MUSCULAR_DOMINANT';
  badge: string;
  color: string;
  description: string;
  recommendation: string;
}

// 6. Structure Distribution Seiler
export interface IntensityDistribution {
  windowDays: number;
  totalSessions: number;
  totalMinutes: number;
  totalLoad: number;
  z1Minutes: number;
  z2Minutes: number;
  z3Minutes: number;
  z1TimePct: number;
  z2TimePct: number;
  z3TimePct: number;
  z1LoadPct: number;
  z2LoadPct: number;
  z3LoadPct: number;
  strengthSessionsCount: number;
  profile: 'EMPTY' | 'POLARIZED' | 'PYRAMIDAL' | 'THRESHOLD_DOMINANT' | 'HIGH_INTENSITY' | 'BASE_BUILDING' | 'BALANCED';
  badge: string;
  color: string;
  advice: string;
}

// 7. Structure Fatigue Perçue
export interface PerceivedFatigueAnalysis {
  count: number;
  meanFatigue: number | null;
  meanDiscrepancy: number;
  highStrainSessionsCount: number;
  status: 'initializing' | 'optimal' | 'elevated' | 'critical';
  badge: string;
  color: string;
  interpretation: string;
}

// ============================================================================
// QUALITÉS PAR DÉFAUT & IMPACTS SPORTIFS
// ============================================================================

export const DEFAULT_QUALITIES: QualityDefinition[] = [
  { id: 'vo2max', name: 'VO2max', g: 7, o: 4, retentionDays: 15, category: 'cardio', impacts: [{ id: 'seuil', ratio: 0.6, confidence: 'estimé' }, { id: 'ef', ratio: 0.4, confidence: 'estimé' }, { id: 'leg', ratio: 0.3, confidence: 'estimé' }, { id: 'co2', ratio: 0.4, confidence: 'estimé' }, { id: 'plyo', ratio: 0.3, confidence: 'estimé' }] },
  { id: 'seuil', name: 'Seuil', g: 8, o: 5, retentionDays: 18, category: 'cardio', impacts: [{ id: 'vo2max', ratio: 0.3, confidence: 'estimé' }, { id: 'ef', ratio: 0.4, confidence: 'estimé' }, { id: 'leg', ratio: 0.3, confidence: 'estimé' }, { id: 'co2', ratio: 0.3, confidence: 'estimé' }, { id: 'plyo', ratio: 0.2, confidence: 'estimé' }] },
  { id: 'ef', name: 'Endurance Fondamentale', g: 10, o: 6, retentionDays: 30, category: 'cardio', impacts: [{ id: 'leg', ratio: 0.2, confidence: 'estimé' }, { id: 'co2', ratio: 0.2, confidence: 'estimé' }] },
  { id: 'sprint', name: 'Sprint / Alactique', g: 5, o: 3, retentionDays: 5, category: 'mixte', impacts: [{ id: 'seuil', ratio: 0.2, confidence: 'estimé' }, { id: 'vo2max', ratio: 0.25, confidence: 'estimé' }, { id: 'ef', ratio: 0.15, confidence: 'estimé' }, { id: 'leg', ratio: 0.7, confidence: 'estimé' }, { id: 'plyo', ratio: 0.7, confidence: 'estimé' }, { id: 'co2', ratio: 0.4, confidence: 'estimé' }] },
  { id: 'pull', name: 'Musculation Pull', g: 8, o: 5, retentionDays: 30, category: 'force' },
  { id: 'push', name: 'Musculation Push', g: 8, o: 5, retentionDays: 30, category: 'force' },
  { id: 'isolation', name: 'Micro-séance / Isolation', g: 4, o: 2, retentionDays: 10, category: 'force' },
  { id: 'leg', name: 'Musculation Leg', g: 8, o: 5, retentionDays: 30, category: 'force', impacts: [{ id: 'sprint', ratio: 0.2, confidence: 'estimé' }] },
  { id: 'plyo', name: 'Plyométrie', g: 5, o: 3, retentionDays: 5, category: 'force', impacts: [{ id: 'leg', ratio: 0.4, confidence: 'estimé' }, { id: 'sprint', ratio: 0.2, confidence: 'estimé' }] },
  { id: 'co2', name: 'Tolérance CO2', g: 6, o: 4, retentionDays: 10, category: 'cardio' },
  { id: 'abdos', name: 'Protocole Abdos', g: 7, o: 4, retentionDays: 7, category: 'force' },
  { id: 'gut', name: 'Gut Training', g: 14, o: 7, retentionDays: 14, category: 'cardio' },
  { id: 'descente', name: 'Excentrique Descente', g: 16, o: 10, retentionDays: 21, category: 'force', impacts: [{ id: 'leg', ratio: 0.8, confidence: 'estimé' }] },
  { id: 'proprio', name: 'Proprioception', g: 5, o: 3, retentionDays: 7, category: 'force' }
];

export const SPORT_IMPACTS: Record<string, Record<string, QualityImpact[]>> = {
  vo2max: {
    run: [
      { id: 'seuil', ratio: 0.6, confidence: 'estimé' },
      { id: 'ef', ratio: 0.4, confidence: 'estimé' },
      { id: 'leg', ratio: 0.3, confidence: 'estimé' },
      { id: 'co2', ratio: 0.4, confidence: 'estimé' },
      { id: 'plyo', ratio: 0.3, confidence: 'estimé' }
    ],
    bike: [
      { id: 'seuil', ratio: 0.55, confidence: 'estimé' },
      { id: 'ef', ratio: 0.4, confidence: 'estimé' },
      { id: 'leg', ratio: 0.25, confidence: 'estimé' },
      { id: 'co2', ratio: 0.35, confidence: 'estimé' }
    ]
  },
  seuil: {
    run: [
      { id: 'vo2max', ratio: 0.3, confidence: 'estimé' },
      { id: 'ef', ratio: 0.4, confidence: 'estimé' },
      { id: 'leg', ratio: 0.3, confidence: 'estimé' },
      { id: 'co2', ratio: 0.3, confidence: 'estimé' },
      { id: 'plyo', ratio: 0.2, confidence: 'estimé' }
    ],
    bike: [
      { id: 'ef', ratio: 0.4, confidence: 'estimé' },
      { id: 'vo2max', ratio: 0.25, confidence: 'estimé' },
      { id: 'leg', ratio: 0.25, confidence: 'estimé' },
      { id: 'co2', ratio: 0.25, confidence: 'estimé' }
    ]
  },
  ef: {
    run: [
      { id: 'leg', ratio: 0.2, confidence: 'estimé' },
      { id: 'co2', ratio: 0.2, confidence: 'estimé' }
    ],
    bike: [
      { id: 'leg', ratio: 0.15, confidence: 'estimé' },
      { id: 'co2', ratio: 0.15, confidence: 'estimé' },
      { id: 'gut', ratio: 0.15, confidence: 'estimé' }
    ]
  },
  sprint: {
    run: [
      { id: 'leg', ratio: 0.7, confidence: 'estimé' },
      { id: 'plyo', ratio: 0.7, confidence: 'estimé' },
      { id: 'co2', ratio: 0.4, confidence: 'estimé' },
      { id: 'seuil', ratio: 0.2, confidence: 'estimé' },
      { id: 'vo2max', ratio: 0.25, confidence: 'estimé' },
      { id: 'ef', ratio: 0.15, confidence: 'estimé' }
    ],
    bike: [
      { id: 'leg', ratio: 0.6, confidence: 'estimé' },
      { id: 'co2', ratio: 0.35, confidence: 'estimé' },
      { id: 'seuil', ratio: 0.2, confidence: 'estimé' },
      { id: 'vo2max', ratio: 0.25, confidence: 'estimé' }
    ]
  }
};

export function getQualityImpacts(
  qualityId: string, 
  sport: string = 'run', 
  qualities: QualityDefinition[] = DEFAULT_QUALITIES
): QualityImpact[] {
  if (SPORT_IMPACTS[qualityId]) {
    const sportKey = sport === 'bike' ? 'bike' : 'run';
    return SPORT_IMPACTS[qualityId][sportKey] || [];
  }
  const found = qualities.find(q => q.id === qualityId);
  return found?.impacts || [];
}

/**
 * Calcule dynamiquement et à la lecture les impacts secondaires à partir des séances directes (primaires).
 */
export function computeDerivedEvents(
  primaryEvents: EventsByQuality | null | undefined, 
  qualities: QualityDefinition[] = DEFAULT_QUALITIES
): Record<string, Record<string, DerivedSession>> {
  const derived: Record<string, Record<string, DerivedSession>> = {};
  for (let i = 0; i < qualities.length; i++) {
    derived[qualities[i].id] = {};
  }

  // 1. Recenser les séances directes (non secondaires) par date
  const dateToPrimarySessions = new Map<string, Array<{ qId: string; session: SessionData }>>();
  const qKeys = Object.keys(primaryEvents || {});
  for (let i = 0; i < qKeys.length; i++) {
    const qId = qKeys[i];
    if (!derived[qId]) derived[qId] = {};
    const qDates = primaryEvents?.[qId] || {};
    const dateKeys = Object.keys(qDates);
    for (let j = 0; j < dateKeys.length; j++) {
      const dateStr = dateKeys[j];
      const session = qDates[dateStr];
      if (!session) continue;
      // Les séances marquées secondaires dans d'anciens jeux de données ne sont pas re-traitées comme primaires
      if (session.isSecondary) continue;

      // Inscription directe de la séance primaire
      // La séance primaire est conservée telle quelle (mêmes champs qu'avant, sans recalcul).
      derived[qId][dateStr] = session as DerivedSession;

      if (!dateToPrimarySessions.has(dateStr)) {
        dateToPrimarySessions.set(dateStr, []);
      }
      dateToPrimarySessions.get(dateStr)!.push({ qId, session });
    }
  }

  // 2. Calculer à la volée les impacts secondaires pour chaque date active
  for (const [dateStr, primaryList] of dateToPrimarySessions.entries()) {
    const primaryQIds = new Set(primaryList.map(p => p.qId));

    for (let i = 0; i < qualities.length; i++) {
      const targetQ = qualities[i];
      // Ne jamais écraser une séance principale existante
      if (primaryQIds.has(targetQ.id)) continue;

      const contributions: Record<string, SessionImpactContribution> = {};
      let totalSecLoad = 0;
      let totalSecCardio = 0;
      let totalSecMusc = 0;

      for (let j = 0; j < primaryList.length; j++) {
        const { qId: parentId, session: parentSession } = primaryList[j];
        const isParentCardio = isCardioQuality(parentId, qualities);
        const parentSport = parentSession.sport || (isParentCardio ? 'run' : 'muscu');
        const parentImpacts = getQualityImpacts(parentId, parentSport, qualities);
        const imp = parentImpacts ? parentImpacts.find(it => it.id === targetQ.id) : null;

        if (imp && imp.ratio > 0) {
          const pLoad = Number(parentSession.load) || 0;
          const pCardio = parentSession.loadCardio !== undefined ? Number(parentSession.loadCardio) : pLoad;
          const pMusc = parentSession.loadMusc !== undefined ? Number(parentSession.loadMusc) : pLoad;

          const calculatedSecLoad = Math.round(pLoad * imp.ratio);
          const calculatedSecCardio = Math.round(pCardio * imp.ratio);
          const calculatedSecMusc = Math.round(pMusc * imp.ratio);

          if (calculatedSecLoad > 0) {
            const parentDef = qualities.find(q => q.id === parentId);
            contributions[parentId] = {
              load: calculatedSecLoad,
              loadCardio: calculatedSecCardio,
              loadMusc: calculatedSecMusc,
              ratio: imp.ratio,
              parentName: parentDef?.name || parentId
            };
            totalSecLoad += calculatedSecLoad;
            totalSecCardio += calculatedSecCardio;
            totalSecMusc += calculatedSecMusc;
          }
        }
      }

      if (totalSecLoad > 0) {
        const isTargetCardio = isCardioQuality(targetQ.id, qualities);
        const parentQIds = Object.keys(contributions);
        derived[targetQ.id][dateStr] = {
          load: totalSecLoad,
          loadCardio: totalSecCardio,
          loadMusc: totalSecMusc,
          isSecondary: true,
          sport: isTargetCardio ? 'run' : 'muscu',
          duration: 0,
          rpeMusc: 0,
          rpeCardio: 0,
          parentContributions: contributions,
          parentQId: parentQIds[0],
          originalLoad: totalSecLoad
        };
      }
    }
  }

  return derived;
}

// ============================================================================
// BLOCS D'ENTRAÎNEMENT & PÉRIODISATION
// ============================================================================

export const BLOCK_PRESETS: BlockTemplate[] = [
  {
    id: 'force_max',
    name: 'Force max',
    durationWeeks: 4,
    focusQualities: ['pull', 'push', 'leg'],
    description: 'Renforcement musculaire intensif en fréquence de développement concentrée (x0.45, 2-3x/sem). Délais nominaux pour les autres qualités.',
    targetMultiplier: 0.45,
    maintenanceMultiplier: 1.0,
    color: '#ef4444',
    badge: '🏋️ Force'
  },
  {
    id: 'endurance_force',
    name: 'Endurance de force',
    durationWeeks: 4,
    focusQualities: ['leg', 'pull', 'push'],
    description: 'Répétition fréquente des séances de résistance musculaire (x0.45). Les autres qualités sont maintenues en délai nominal.',
    targetMultiplier: 0.45,
    maintenanceMultiplier: 1.0,
    color: '#f97316',
    badge: '⚡ Endur. Force'
  },
  {
    id: 'aerobie',
    name: 'Aérobie',
    durationWeeks: 6,
    focusQualities: ['ef', 'gut'],
    description: 'Développement du volume foncier et des capacités métaboliques (x0.45). Renforcement musculaire espacé en maintien.',
    targetMultiplier: 0.45,
    maintenanceMultiplier: 1.0,
    color: '#06b6d4',
    badge: '🫁 Aérobie'
  },
  {
    id: 'seuil_vma',
    name: 'Seuil / VMA',
    durationWeeks: 3,
    focusQualities: ['seuil', 'vo2max'],
    description: 'Forte sollicitation cardio-vasculaire à haute intensité (x0.45). Renforcement musculaire maintenu en délai nominal.',
    targetMultiplier: 0.45,
    maintenanceMultiplier: 1.0,
    color: '#8b5cf6',
    badge: '🔥 Seuil/VMA'
  },
  {
    id: 'explosivite_plyo',
    name: 'Explosivité / Plyométrie',
    durationWeeks: 3,
    focusQualities: ['plyo', 'sprint'],
    description: 'Vitesse de contraction, cycle étirement-détente et puissance des membres inférieurs (x0.45).',
    targetMultiplier: 0.45,
    maintenanceMultiplier: 1.0,
    color: '#ec4899',
    badge: '💥 Plyo/Vitesse'
  }
];

export function computeBlockEndDate(startDateStr: string, durationWeeks: number): string {
  const [y, m, d] = startDateStr.split('-').map(Number);
  const start = new Date(y, m - 1, d);
  const totalDays = durationWeeks * 7 - 1;
  const end = new Date(start);
  end.setDate(start.getDate() + totalDays);
  return getLocalYYYYMMDD(end);
}

export function getActiveBlockForDate<B extends BlockLike>(dateStr: string, blocks: B[] = []): B | null {
  if (!blocks || !Array.isArray(blocks) || blocks.length === 0) return null;
  return blocks.find(b => {
    if (!b || !b.startDate || !b.endDate) return false;
    return dateStr >= b.startDate && dateStr <= b.endDate;
  }) || null;
}

export function getBlockProgress(block: (BlockLike & { durationWeeks: number }) | null | undefined, referenceDateStr?: string | null): BlockProgress | null {
  if (!block || !block.startDate || !block.endDate) return null;
  const refDate = referenceDateStr ? new Date(referenceDateStr) : new Date();
  const [sy, sm, sd] = block.startDate.split('-').map(Number);
  const [ey, em, ed] = block.endDate.split('-').map(Number);
  const start = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);

  const totalMs = end.getTime() - start.getTime();
  const totalDays = Math.round(totalMs / (1000 * 3600 * 24)) + 1;
  const elapsedMs = refDate.getTime() - start.getTime();
  const elapsedDays = Math.floor(elapsedMs / (1000 * 3600 * 24)) + 1;

  const currentDay = Math.max(1, Math.min(totalDays, elapsedDays));
  const currentWeek = Math.max(1, Math.min(block.durationWeeks, Math.ceil(currentDay / 7)));
  const remainingDays = Math.max(0, totalDays - currentDay);
  const percent = Math.max(0, Math.min(100, Math.round((currentDay / totalDays) * 100)));

  const isActive = elapsedDays >= 1 && elapsedDays <= totalDays;
  const isUpcoming = elapsedDays < 1;
  const isPast = elapsedDays > totalDays;

  return {
    currentDay,
    totalDays,
    currentWeek,
    totalWeeks: block.durationWeeks,
    remainingDays,
    percent,
    isActive,
    isUpcoming,
    isPast
  };
}

export function getSavedBlockTemplates(): BlockTemplate[] {
  try {
    const raw = localStorage.getItem('physio_block_templates');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(t => ({
          ...t,
          targetMultiplier: t.targetMultiplier === 0.75 ? 0.45 : (t.targetMultiplier ?? 0.45),
          maintenanceMultiplier: t.maintenanceMultiplier === 1.35 ? 1.0 : (t.maintenanceMultiplier ?? 1.0)
        }));
      }
    }
  } catch (err) { console.warn('[physiology] Modèles de blocs illisibles, préréglages utilisés', err); }
  return BLOCK_PRESETS;
}

export function saveBlockTemplates(templates: BlockTemplate[]): void {
  try {
    localStorage.setItem('physio_block_templates', JSON.stringify(templates));
  } catch (err) { console.warn('[physiology] Sauvegarde des modèles de blocs impossible', err); }
}

export function reorderQualitiesForBlock(qualities: QualityDefinition[], focusQualities: string[] = []): QualityDefinition[] {
  if (!focusQualities || focusQualities.length === 0) return qualities;
  const focused: QualityDefinition[] = [];
  const remaining: QualityDefinition[] = [];

  focusQualities.forEach(id => {
    const found = qualities.find(q => q.id === id);
    if (found) focused.push(found);
  });

  qualities.forEach(q => {
    if (!focusQualities.includes(q.id)) {
      remaining.push(q);
    }
  });

  return [...focused, ...remaining];
}

// ============================================================================
// CALCUL CELLULAIRE & RECOMMANDATIONS D'ENTRAÎNEMENT
// ============================================================================

// Cache WeakMap pour pré-indexer les dates de séances principales par qualité
const primaryDatesCache = new WeakMap<object, string[]>();
function getSortedPrimaryDates(eventsForQuality: Record<string, SessionData> | null | undefined): string[] {
  if (!eventsForQuality || typeof eventsForQuality !== 'object') return [];
  let cached = primaryDatesCache.get(eventsForQuality);
  if (!cached) {
    cached = Object.keys(eventsForQuality)
      .filter(k => isPrimary(eventsForQuality[k]) && extractSessionLoad(eventsForQuality[k]) > 0)
      .sort();
    primaryDatesCache.set(eventsForQuality, cached);
  }
  return cached;
}

export function computeCellState(
  qDef: QualityDefinition, 
  targetDateStr: string, 
  eventsForQuality: Record<string, SessionData> | undefined | null, 
  readinessOrBlocks: number | BlockLike[] = 7, 
  maybeBlocks: BlockLike[] = []
): CellState {
  const blocks = Array.isArray(readinessOrBlocks) ? readinessOrBlocks : (maybeBlocks || []);
  const [ty, tm, td] = targetDateStr.split('-').map(Number);
  const targetDateObj = new Date(ty, tm - 1, td);
  const targetTime = targetDateObj.getTime();

  const activeBlock = getActiveBlockForDate(targetDateStr, blocks);
  const isFocus = Boolean(activeBlock && activeBlock.focusQualities?.includes(qDef.id));
  const prescriptionMultiplier = isFocus && activeBlock
    ? (activeBlock.targetMultiplier ?? 0.45) 
    : (activeBlock?.maintenanceMultiplier ?? 1.0);

  let bestStatusPrescription: 'green' | 'orange' | 'red' = 'red';
  let daysLeftPrescription = 0;
  let opacityPrescription = 1;
  let currentLevelPrescription = 0;

  let bestStatusPhysio: 'green' | 'orange' | 'red' = 'red';
  let daysLeftPhysio = 0;
  let opacityPhysio = 1;
  let currentLevelPhysio = 0;

  let recent3DaysLoad = 0;
  let total28dLoad = 0;
  let sessionCount28d = 0;

  const pastPrimaryLoads: number[] = [];
  const parsedSessions: Array<{ daysSince: number; load: number; isSec: boolean }> = [];

  if (eventsForQuality && typeof eventsForQuality === 'object') {
    const iterDate = new Date(targetDateObj);
    for (let daysSince = 0; daysSince <= 90; daysSince++) {
      if (daysSince > 0) {
        iterDate.setDate(iterDate.getDate() - 1);
      }
      const y = iterDate.getFullYear();
      const m = String(iterDate.getMonth() + 1).padStart(2, '0');
      const d = String(iterDate.getDate()).padStart(2, '0');
      const dateKey = `${y}-${m}-${d}`;

      const sessData = eventsForQuality[dateKey];
      if (!sessData) continue;

      const isPrim = isPrimary(sessData);
      const load = extractSessionLoad(sessData);

      if (isPrim && load > 0 && daysSince <= 60) {
        pastPrimaryLoads.push(load);
      }

      parsedSessions.push({ daysSince, load, isSec: !isPrim });
    }
  }

  let mostRecentSessionDays: number | null = null;
  const sortedPrimaryDates = getSortedPrimaryDates(eventsForQuality);
  if (sortedPrimaryDates.length > 0) {
    let low = 0;
    let high = sortedPrimaryDates.length - 1;
    let latestDateKey: string | null = null;
    while (low <= high) {
      const mid = (low + high) >> 1;
      if (sortedPrimaryDates[mid] <= targetDateStr) {
        latestDateKey = sortedPrimaryDates[mid];
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    if (latestDateKey) {
      const [ly, lm, ld] = latestDateKey.split('-').map(Number);
      const latestTime = new Date(ly, lm - 1, ld).getTime();
      mostRecentSessionDays = Math.round((targetTime - latestTime) / 86400000);
    }
  }

  pastPrimaryLoads.sort((a, b) => a - b);
  const defaultRefLoad = qDef.id === 'isolation' ? 80 : (qDef.category === 'force' ? 200 : (qDef.category === 'mixte' ? 180 : 250));
  const refLoad_q = pastPrimaryLoads.length > 0 ? pastPrimaryLoads[Math.floor(pastPrimaryLoads.length / 2)] : defaultRefLoad;

  for (let i = 0; i < parsedSessions.length; i++) {
    const { daysSince, load, isSec } = parsedSessions[i];

    if (daysSince <= 3) {
      recent3DaysLoad += load;
    }
    if (daysSince <= 28) {
      total28dLoad += load;
      if (load > 0) sessionCount28d++;
    }

    let doseScale = 0;
    if (load >= 15) {
      const ratio = load / refLoad_q;
      if (isSec) {
        doseScale = Math.min(0.35, 0.25 * Math.sqrt(Math.max(0, ratio)));
      } else {
        doseScale = Math.max(0.3, Math.min(1.3, 0.45 + 0.55 * Math.sqrt(Math.max(0, ratio))));
      }
    }

    if (doseScale > 0) {
      const gBase = qDef.g || (qDef.retentionDays ? Math.round(qDef.retentionDays * 0.6) : 6);
      const oBase = qDef.o || (qDef.retentionDays ? Math.round(qDef.retentionDays * 0.4) : 4);

      const gPhysio = gBase * doseScale;
      const oPhysio = oBase * doseScale;

      if (daysSince < gPhysio) {
        const dLeft = gPhysio - daysSince;
        if (bestStatusPhysio !== 'green' || dLeft > daysLeftPhysio) {
          bestStatusPhysio = 'green';
          daysLeftPhysio = Math.max(0.1, Math.round(dLeft * 10) / 10);
          opacityPhysio = 1 - (daysSince / gPhysio) * 0.4;
          currentLevelPhysio = Math.round(100 - (daysSince / gPhysio) * 30);
        }
      } else if (daysSince < (gPhysio + oPhysio) && bestStatusPhysio !== 'green') {
        const dLeft = (gPhysio + oPhysio) - daysSince;
        if (bestStatusPhysio !== 'orange' || dLeft > daysLeftPhysio) {
          bestStatusPhysio = 'orange';
          daysLeftPhysio = Math.max(0.1, Math.round(dLeft * 10) / 10);
          const progressOrange = (daysSince - gPhysio) / oPhysio;
          opacityPhysio = 0.6 - progressOrange * 0.3;
          currentLevelPhysio = Math.max(35, Math.round(70 - progressOrange * 35));
        }
      }

      const gPrescription = gPhysio * prescriptionMultiplier;
      const oPrescription = oPhysio * prescriptionMultiplier;

      if (daysSince < gPrescription) {
        const dLeft = gPrescription - daysSince;
        if (bestStatusPrescription !== 'green' || dLeft > daysLeftPrescription) {
          bestStatusPrescription = 'green';
          daysLeftPrescription = Math.max(0.1, Math.round(dLeft * 10) / 10);
          opacityPrescription = 1 - (daysSince / gPrescription) * 0.4;
          currentLevelPrescription = Math.round(100 - (daysSince / gPrescription) * 30);
        }
      } else if (daysSince < (gPrescription + oPrescription) && bestStatusPrescription !== 'green') {
        const dLeft = (gPrescription + oPrescription) - daysSince;
        if (bestStatusPrescription !== 'orange' || dLeft > daysLeftPrescription) {
          bestStatusPrescription = 'orange';
          daysLeftPrescription = Math.max(0.1, Math.round(dLeft * 10) / 10);
          const progressOrangePresc = (daysSince - gPrescription) / oPrescription;
          opacityPrescription = 0.6 - progressOrangePresc * 0.3;
          currentLevelPrescription = Math.max(30, Math.round(70 - progressOrangePresc * 40));
        }
      }
    }
  }

  const gBaseNominal = qDef.g || (qDef.retentionDays ? Math.round(qDef.retentionDays * 0.6) : 6);
  const oBaseNominal = qDef.o || (qDef.retentionDays ? Math.round(qDef.retentionDays * 0.4) : 4);
  const totalNominal = gBaseNominal + oBaseNominal;

  if (bestStatusPhysio === 'red' && mostRecentSessionDays !== null) {
    const daysOver = Math.max(0, mostRecentSessionDays - totalNominal);
    currentLevelPhysio = Math.max(0, Math.round(35 * Math.exp(-0.04 * daysOver)));
  }
  if (bestStatusPrescription === 'red' && mostRecentSessionDays !== null) {
    const totalPrescNominal = Math.round(totalNominal * prescriptionMultiplier);
    const daysOverPresc = Math.max(0, mostRecentSessionDays - totalPrescNominal);
    currentLevelPrescription = Math.max(0, Math.round(30 * Math.exp(-0.05 * daysOverPresc)));
  }

  const dailyAverage28d = sessionCount28d > 0 ? (total28dLoad / 28) : (refLoad_q / 7);
  const qualityOverloadThreshold = Math.max(refLoad_q * 2.5, dailyAverage28d * 3 * 1.8);
  const isAcuteFatigueHigh = recent3DaysLoad > qualityOverloadThreshold;
  const isBurnout = isAcuteFatigueHigh;

  let blockStateInfo: { name: string; type: 'focus' | 'maintenance'; label: string } | null = null;
  if (activeBlock) {
    blockStateInfo = {
      name: activeBlock.name ?? '',
      type: isFocus ? 'focus' : 'maintenance',
      label: isFocus ? 'Fréquence de développement (x0.45)' : 'Maintien nominal (x1.0)'
    };
  }

  let tooltip = mostRecentSessionDays === null 
    ? 'Filière non stimulée (aucune séance enregistrée)' 
    : `Fenêtre dépassée (J+${mostRecentSessionDays}) • Rappel recommandé`;
  if (bestStatusPrescription === 'green') {
    tooltip = isFocus 
      ? `Prescription bloc : prochaine séance sous ${daysLeftPrescription}j (maintien acquis : ${daysLeftPhysio}j)`
      : `Effet d'entraînement actif : reste ${daysLeftPhysio} jours de maintien résiduel`;
  }
  if (bestStatusPrescription === 'orange') {
    tooltip = `Fenêtre de rappel : piqûre recommandée sous ${daysLeftPrescription} jours`;
  }
  if (blockStateInfo) {
    tooltip += ` • [Bloc ${blockStateInfo.name} : ${blockStateInfo.label}]`;
  }
  if (isAcuteFatigueHigh) tooltip += ' ⚠️ FATIGUE AIGUË ÉLEVÉE (3 jours de charge intense)';

  return { 
    status: bestStatusPrescription, 
    opacity: opacityPrescription, 
    daysLeft: daysLeftPrescription, 
    currentLevel: Math.max(0, currentLevelPrescription), 
    tooltip, 
    isBurnout,
    isAcuteFatigueHigh,
    blockStateInfo,
    mostRecentSessionDays,
    refLoad_q,
    physio: {
      status: bestStatusPhysio,
      opacity: opacityPhysio,
      daysLeft: daysLeftPhysio,
      currentLevel: Math.max(0, currentLevelPhysio)
    },
    prescription: {
      status: bestStatusPrescription,
      opacity: opacityPrescription,
      daysLeft: daysLeftPrescription,
      currentLevel: Math.max(0, currentLevelPrescription)
    }
  };
}

export function getTrainingRecommendations(
  qualities: QualityDefinition[], 
  events: EventsByQuality | undefined | null, 
  dailyMetrics: DailyMetricsMap | undefined | null, 
  activeBlock: BlockLike | null = null, 
  referenceDateStr: string | null = null
): TrainingRecommendation[] {
  const refDate = referenceDateStr || getLocalYYYYMMDD(new Date());
  const readiness = dailyMetrics?.[refDate]?.readiness || 7;
  const numQualities = qualities.length || 1;

  const vfcAnalysis = computeVfcAnalysis(dailyMetrics || {}, refDate);
  const hrRestAnalysis = computeHrRestAnalysis(dailyMetrics || {}, refDate);
  const perceivedFatigueAnalysis = computePerceivedFatigueAnalysis(events || {}, refDate, 14);
  const cardioMuscBalance = computeCardioVsMuscularBalance(events || {}, refDate, 7);

  const hasSystemicFatigue = (vfcAnalysis.status === 'low') || 
                             (hrRestAnalysis.status === 'elevated') || 
                             (readiness <= 4) || 
                             (perceivedFatigueAnalysis.status === 'critical');
  const isReadinessOptimal = (readiness >= 8) && (vfcAnalysis.status === 'optimal' || vfcAnalysis.status === 'high') && (perceivedFatigueAnalysis.status !== 'elevated');

  const HARD_QUALITIES = new Set(['vo2max', 'seuil', 'sprint', 'pull', 'push', 'leg', 'plyo', 'descente']);

  const refDateObj = new Date(refDate);
  const yesterdayObj = new Date(refDateObj);
  yesterdayObj.setDate(yesterdayObj.getDate() - 1);
  const yesterdayStr = getLocalYYYYMMDD(yesterdayObj);

  let recentHardSessionDone = false;
  Object.entries(events || {}).forEach(([qId, dates]) => {
    if (dates?.[yesterdayStr] && isPrimary(dates[yesterdayStr]) && HARD_QUALITIES.has(qId) && extractSessionLoad(dates[yesterdayStr]) > 150) {
      recentHardSessionDone = true;
    }
    if (dates?.[refDate] && isPrimary(dates[refDate]) && HARD_QUALITIES.has(qId) && extractSessionLoad(dates[refDate]) > 150) {
      recentHardSessionDone = true;
    }
  });

  const list: TrainingRecommendation[] = qualities.map((q, idx) => {
    const rank = idx + 1;
    const rankWeight = 1 + ((numQualities - idx) / numQualities) * 1.5;

    const isBlockFocus = Boolean(activeBlock?.focusQualities?.includes(q.id));
    const blockWeight = isBlockFocus ? 1.6 : 1.0;
    const isHardQuality = HARD_QUALITIES.has(q.id);

    const cellState = computeCellState(q, refDate, events?.[q.id] || {}, readiness, activeBlock ? [activeBlock] : []);

    const qualityEvents = events?.[q.id] || {};
    const sessionDates = Object.keys(qualityEvents)
      .filter(d => d <= refDate && qualityEvents[d] && isPrimary(qualityEvents[d]) && extractSessionLoad(qualityEvents[d]) > 0)
      .sort();
    
    let daysSinceLastSession: number | null = null;
    let lastSessionData: SessionData | null = null;
    if (sessionDates.length > 0) {
      const lastDate = sessionDates[sessionDates.length - 1];
      lastSessionData = qualityEvents[lastDate];
      const diffMs = new Date(refDate).getTime() - new Date(lastDate).getTime();
      daysSinceLastSession = Math.max(0, Math.round(diffMs / (1000 * 3600 * 24)));
    }

    let urgencyScore = 0;
    let urgencyLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'OPTIMAL' | 'REST' = 'OPTIMAL';
    let urgencyBadge = '✅ Maintenu';
    let urgencyColor = 'emerald';
    let reason = '';
    let actionTip = '';

    if (cellState.isBurnout || cellState.isAcuteFatigueHigh) {
      urgencyLevel = 'REST';
      urgencyScore = -50;
      urgencyBadge = '🛑 Surcharge Aiguë';
      urgencyColor = 'rose';
      reason = 'Charge accumulée élevée sur 72h. Fatigue neuromusculaire aiguë.';
      actionTip = 'Privilégier le repos complet ou la régénération active très douce.';
    } else if (daysSinceLastSession === null) {
      if (isBlockFocus) {
        urgencyLevel = 'MEDIUM';
        urgencyScore = 60 * rankWeight * blockWeight;
        urgencyBadge = '⚡ Focus Bloc';
        urgencyColor = 'blue';
        reason = `Qualité prioritaire du bloc actif « ${activeBlock?.name} », sans séance enregistrée.`;
        actionTip = 'Programmer une première séance pour amorcer le bloc.';
      } else {
        urgencyLevel = 'LOW';
        urgencyScore = 15 * rankWeight;
        urgencyBadge = 'ℹ️ Non stimulée';
        urgencyColor = 'slate';
        reason = 'Aucune séance enregistrée pour cette filière à ce jour.';
        actionTip = 'Optionnel selon vos objectifs de saison.';
      }
    } else if (cellState.status === 'red') {
      const deconditionFactor = Math.min(daysSinceLastSession, 21);
      const baseScore = 75 + deconditionFactor * 1.5;
      urgencyScore = baseScore * rankWeight * blockWeight;

      if (rank <= 3 || isBlockFocus) {
        urgencyLevel = 'CRITICAL';
        urgencyBadge = '🚨 Rappel Recommandé';
        urgencyColor = 'red';
        reason = `Fenêtre de rémanence expirée (${daysSinceLastSession} j sans séance). Rang #${rank} dans votre profil${isBlockFocus ? ' • Focus du bloc actif' : ''}.`;
        actionTip = 'Séance clé à programmer sous 24-48h pour stimuler à nouveau cette filière.';
      } else {
        urgencyLevel = 'HIGH';
        urgencyBadge = '⚠️ Rétention Basse';
        urgencyColor = 'orange';
        reason = `Effet résiduel dissipé (${daysSinceLastSession} j depuis la dernière séance).`;
        actionTip = 'À stimuler prochainement pour entretenir la rémanence.';
      }
    } else if (cellState.status === 'orange') {
      const daysLeft = cellState.daysLeft || 1;
      const baseScore = 65 + (5 - Math.min(daysLeft, 5)) * 4;
      urgencyScore = baseScore * rankWeight * blockWeight;

      if (daysLeft <= 1.2) {
        urgencyLevel = 'HIGH';
        urgencyBadge = '⚡ Rappel sous 24h';
        urgencyColor = 'amber';
        reason = `Fenêtre de rappel critique : expire dans ${daysLeft} j avant déclin d'adaptation.`;
        actionTip = 'Séance de rappel recommandée sans tarder.';
      } else {
        urgencyLevel = 'MEDIUM';
        urgencyBadge = '⏳ Rappel actif';
        urgencyColor = 'yellow';
        reason = `En fenêtre de rappel optimale (reste ${daysLeft} j d'effet résiduel).`;
        actionTip = 'Séance de rappel idéale à caler dans les 24-48 heures.';
      }
    } else {
      const daysLeft = cellState.daysLeft || 1;
      urgencyScore = Math.max(5, (25 - daysLeft) * rankWeight);

      if (daysLeft <= 1.5) {
        urgencyLevel = 'LOW';
        urgencyBadge = '🟢 À surveiller';
        urgencyColor = 'blue';
        reason = `Effet actif encore valide (reste ${daysLeft} j avant fenêtre de rappel).`;
        actionTip = 'Qualité sous contrôle pour l’instant.';
      } else {
        urgencyLevel = 'OPTIMAL';
        urgencyBadge = '✅ Consolidé';
        urgencyColor = 'emerald';
        reason = `Effet résiduel solide (reste ${daysLeft} j de protection active).`;
        actionTip = 'Aucune séance requise pour cette qualité.';
      }
    }

    if (recentHardSessionDone && isHardQuality && urgencyScore > 0) {
      urgencyScore = Math.round(urgencyScore * 0.55);
      if (urgencyLevel === 'CRITICAL') urgencyLevel = 'HIGH';
      else if (urgencyLevel === 'HIGH') urgencyLevel = 'MEDIUM';
      reason += ' • [Vigilance alternance : séance intense récente, priorité à la régénération active]';
    } else if (recentHardSessionDone && !isHardQuality && urgencyScore > 0) {
      urgencyScore = Math.round(urgencyScore * 1.25);
    }

    if (hasSystemicFatigue) {
      if (isHardQuality && urgencyScore > 0) {
        urgencyScore = Math.round(urgencyScore * 0.45);
        if (urgencyLevel === 'CRITICAL') urgencyLevel = 'MEDIUM';
        else if (urgencyLevel === 'HIGH') urgencyLevel = 'LOW';
        urgencyBadge = '⚠️ Récup requise';
        urgencyColor = 'amber';
        const fatigueCause = [
          vfcAnalysis.status === 'low' ? 'VFC basse (< SWC)' : '',
          hrRestAnalysis.status === 'elevated' ? `FC repos +${hrRestAnalysis.deltaBpm} bpm` : '',
          readiness <= 4 ? `Readiness ${readiness}/10` : ''
        ].filter(Boolean).join(' · ');
        reason += ` • [Fatigue systémique : ${fatigueCause} -> séance intensive déconseillée]`;
        actionTip = 'Remplacer par une séance d\'Endurance Fondamentale (EF) très souple ou du repos.';
      } else if (q.id === 'ef' || q.id === 'proprio') {
        urgencyScore = Math.max(urgencyScore, 70);
        urgencyBadge = '🍃 Assimilation Active';
        urgencyColor = 'emerald';
        reason += ' • [Option privilégiée pour drainer la fatigue sans surcharger le système nerveux]';
        actionTip = 'Séance d\'assimilation idéale en zone 1/2.';
      }
    } else if (isReadinessOptimal && isHardQuality && urgencyScore >= 45) {
      reason += ' • [⚡ Excellente disponibilité autonome (VFC & Readiness favorables) : créneau idéal pour séance qualitative]';
    }

    if (cardioMuscBalance.state === 'MUSCULAR_DOMINANT' && (q.category === 'force' || q.id === 'descente' || q.id === 'plyo') && urgencyScore > 0) {
      urgencyScore = Math.round(urgencyScore * 0.7);
      reason += ' • [Fatigue musculaire résiduelle dominante : privilégier régénération ou travail aérobie sans impact]';
    } else if (cardioMuscBalance.state === 'CARDIO_DOMINANT' && (q.category === 'cardio' && q.id !== 'ef') && urgencyScore > 0) {
      urgencyScore = Math.round(urgencyScore * 0.75);
      reason += ' • [Stress cardiorespiratoire aigu élevé : privilégier renforcement ou travail technique]';
    }

    return {
      quality: q,
      rank,
      isBlockFocus,
      isHardQuality,
      cellState,
      daysSinceLastSession,
      lastSessionData,
      urgencyScore: Math.round(urgencyScore * 10) / 10,
      urgencyLevel,
      urgencyBadge,
      urgencyColor,
      reason,
      actionTip
    };
  });

  return list.sort((a, b) => b.urgencyScore - a.urgencyScore);
}

// ============================================================================
// MOYENNES MOBILES EXPONENTIELLES (EMA) & ACWR
// ============================================================================

export function computeQualityEMAData(
  qualityId: string, 
  eventsForQuality: Record<string, SessionData> | undefined | null, 
  daysHistory: number = 45, 
  daysFuture: number = 0
): EMACalculation {
  const today = parseLocalDate(new Date());
  const warmupDays = Math.max(90, daysHistory + 63);
  const fullRawData: Array<{
    dateStr: string;
    day: number;
    offset: number;
    load: number;
    isPrimarySession: boolean;
  }> = [];

  for (let i = -warmupDays; i <= daysFuture; i++) {
    const d = addDays(today, i);
    const dateStr = getLocalYYYYMMDD(d);
    
    let load = 0;
    let isPrimarySession = false;
    if (eventsForQuality && eventsForQuality[dateStr]) {
      const sess = eventsForQuality[dateStr];
      load = extractSessionLoad(sess);
      isPrimarySession = isPrimary(sess) && load > 0;
    }
    fullRawData.push({
      dateStr,
      day: d.getDate(),
      offset: i,
      load,
      isPrimarySession
    });
  }

  const loads = fullRawData.map(d => d.load);
  const ema3 = calculateEMA(loads, 3, true, 0);
  const ema7 = calculateEMA(loads, 7, true, 0);
  const ema21 = calculateEMA(loads, 21, true, 0);

  const fullSeries: QualityEMASeriesPoint[] = fullRawData.map((d, idx) => ({
    ...d,
    ema3: Math.round(ema3[idx] * 10) / 10,
    ema7: Math.round(ema7[idx] * 10) / 10,
    ema21: Math.round(ema21[idx] * 10) / 10,
  }));

  const todayIndex = fullSeries.findIndex(s => s.offset === 0);
  const current = todayIndex >= 0 ? fullSeries[todayIndex] : fullSeries[fullSeries.length - 1];
  const prev = todayIndex > 0 ? fullSeries[todayIndex - 1] : null;

  const deltaEma3 = prev ? Math.round((current.ema3 - prev.ema3) * 10) / 10 : 0;
  const deltaEma7 = prev ? Math.round((current.ema7 - prev.ema7) * 10) / 10 : 0;
  const deltaEma21 = prev ? Math.round((current.ema21 - prev.ema21) * 10) / 10 : 0;

  const prevPeriod3 = todayIndex >= 3 ? fullSeries[todayIndex - 3] : prev;
  const prevPeriod7 = todayIndex >= 7 ? fullSeries[todayIndex - 7] : prev;
  const prevPeriod21 = todayIndex >= 21 ? fullSeries[todayIndex - 21] : prev;

  const periodDelta3 = prevPeriod3 ? Math.round((current.ema3 - prevPeriod3.ema3) * 10) / 10 : deltaEma3;
  const periodDelta7 = prevPeriod7 ? Math.round((current.ema7 - prevPeriod7.ema7) * 10) / 10 : deltaEma7;
  const periodDelta21 = prevPeriod21 ? Math.round((current.ema21 - prevPeriod21.ema21) * 10) / 10 : deltaEma21;

  const prevWeek = todayIndex >= 7 ? fullSeries[todayIndex - 7] : prev;
  const weekDelta3 = prevWeek ? Math.round((current.ema3 - prevWeek.ema3) * 10) / 10 : deltaEma3;
  const weekDelta7 = prevWeek ? Math.round((current.ema7 - prevWeek.ema7) * 10) / 10 : deltaEma7;
  const weekDelta21 = prevWeek ? Math.round((current.ema21 - prevWeek.ema21) * 10) / 10 : deltaEma21;

  const percent3 = prev && prev.ema3 > 0 ? Math.round((deltaEma3 / prev.ema3) * 1000) / 10 : (deltaEma3 > 0 ? 100 : 0);
  const percent7 = prev && prev.ema7 > 0 ? Math.round((deltaEma7 / prev.ema7) * 1000) / 10 : (deltaEma7 > 0 ? 100 : 0);
  const percent21 = prev && prev.ema21 > 0 ? Math.round((deltaEma21 / prev.ema21) * 1000) / 10 : (deltaEma21 > 0 ? 100 : 0);

  const periodPercent3 = prevPeriod3 && prevPeriod3.ema3 > 0 ? Math.round((periodDelta3 / prevPeriod3.ema3) * 1000) / 10 : (periodDelta3 > 0 ? 100 : 0);
  const periodPercent7 = prevPeriod7 && prevPeriod7.ema7 > 0 ? Math.round((periodDelta7 / prevPeriod7.ema7) * 1000) / 10 : (periodDelta7 > 0 ? 100 : 0);
  const periodPercent21 = prevPeriod21 && prevPeriod21.ema21 > 0 ? Math.round((periodDelta21 / prevPeriod21.ema21) * 1000) / 10 : (periodDelta21 > 0 ? 100 : 0);

  const weekPercent3 = prevWeek && prevWeek.ema3 > 0 ? Math.round((weekDelta3 / prevWeek.ema3) * 1000) / 10 : (weekDelta3 > 0 ? 100 : 0);
  const weekPercent7 = prevWeek && prevWeek.ema7 > 0 ? Math.round((weekDelta7 / prevWeek.ema7) * 1000) / 10 : (weekDelta7 > 0 ? 100 : 0);
  const weekPercent21 = prevWeek && prevWeek.ema21 > 0 ? Math.round((weekDelta21 / prevWeek.ema21) * 1000) / 10 : (weekDelta21 > 0 ? 100 : 0);

  const recentSessionsCount28d = fullRawData
    .filter(d => d.offset <= 0 && d.offset >= -28)
    .filter(d => d.isPrimarySession).length;

  const isAcwrValid = recentSessionsCount28d >= 4 && current && current.ema21 > 5;
  const acwr = isAcwrValid 
    ? Math.round((current.ema7 / current.ema21) * 100) / 100 
    : null;

  const trend = prev 
    ? (current.ema3 > prev.ema3 + 0.5 ? 'up' : current.ema3 < prev.ema3 - 0.5 ? 'down' : 'flat') 
    : 'flat';

  const trend3: 'up' | 'down' | 'flat' = deltaEma3 > 0.1 ? 'up' : deltaEma3 < -0.1 ? 'down' : 'flat';
  const trend7: 'up' | 'down' | 'flat' = deltaEma7 > 0.1 ? 'up' : deltaEma7 < -0.1 ? 'down' : 'flat';
  const trend21: 'up' | 'down' | 'flat' = deltaEma21 > 0.1 ? 'up' : deltaEma21 < -0.1 ? 'down' : 'flat';

  const series = fullSeries.filter(s => s.offset >= -daysHistory);
  const seriesTodayIndex = series.findIndex(s => s.offset === 0);

  const sparklineStart = Math.max(0, seriesTodayIndex >= 0 ? seriesTodayIndex - 13 : series.length - 14);
  const sparklineEnd = seriesTodayIndex >= 0 ? seriesTodayIndex + 1 : series.length;
  const sparkline = series.slice(sparklineStart, sparklineEnd);

  return {
    qualityId,
    series,
    current: {
      load: current ? current.load : 0,
      ema3: current ? current.ema3 : 0,
      ema7: current ? current.ema7 : 0,
      ema21: current ? current.ema21 : 0,
      prevEma3: prev ? prev.ema3 : 0,
      prevEma7: prev ? prev.ema7 : 0,
      prevEma21: prev ? prev.ema21 : 0,
      prevPeriodEma3: prevPeriod3 ? prevPeriod3.ema3 : 0,
      prevPeriodEma7: prevPeriod7 ? prevPeriod7.ema7 : 0,
      prevPeriodEma21: prevPeriod21 ? prevPeriod21.ema21 : 0,
      prevWeekEma3: prevWeek ? prevWeek.ema3 : 0,
      prevWeekEma7: prevWeek ? prevWeek.ema7 : 0,
      prevWeekEma21: prevWeek ? prevWeek.ema21 : 0,
      delta3: deltaEma3,
      delta7: deltaEma7,
      delta21: deltaEma21,
      periodDelta3,
      periodDelta7,
      periodDelta21,
      weekDelta3,
      weekDelta7,
      weekDelta21,
      percent3,
      percent7,
      percent21,
      periodPercent3,
      periodPercent7,
      periodPercent21,
      weekPercent3,
      weekPercent7,
      weekPercent21,
      trend3,
      trend7,
      trend21,
      acwr,
      trend
    },
    sparkline
  };
}

export function computeAllQualitiesEMA(
  qualities: QualityDefinition[], 
  events: EventsByQuality | undefined | null, 
  daysHistory: number = 45, 
  daysFuture: number = 0
): Record<string, EMACalculation> {
  const result: Record<string, EMACalculation> = {};
  for (const q of qualities) {
    result[q.id] = computeQualityEMAData(q.id, events?.[q.id] || {}, daysHistory, daysFuture);
  }
  return result;
}

// ============================================================================
// CALCUL DE CHARGE & MONOTONIE DE FOSTER (7 JOURS)
// ============================================================================

export function computeFosterMetrics(
  events: EventsByQuality | undefined | null, 
  referenceDateStr: string | null = null, 
  windowDays: number = 7
): FosterLoad {
  const refDate = referenceDateStr ? new Date(referenceDateStr) : new Date();
  const todayStr = getLocalYYYYMMDD(new Date());
  const isEvaluatingToday = !referenceDateStr || referenceDateStr === todayStr;

  const todayLoad = getDailyAthleteLoad(events, todayStr);
  const offsetStart = (isEvaluatingToday && todayLoad === 0) ? 1 : 0;

  const dailyLoads: FosterDailyLoad[] = [];

  for (let i = windowDays - 1 + offsetStart; i >= offsetStart; i--) {
    const d = new Date(refDate);
    d.setDate(refDate.getDate() - i);
    const dateStr = getLocalYYYYMMDD(d);

    const load = getDailyAthleteLoad(events, dateStr);
    dailyLoads.push({ dateStr, load });
  }

  const totalLoad = dailyLoads.reduce((acc, d) => acc + d.load, 0);
  const exactMeanLoad = totalLoad / windowDays;
  const meanLoad = Math.round(exactMeanLoad);

  const variance = dailyLoads.reduce((acc, d) => acc + Math.pow(d.load - exactMeanLoad, 2), 0) / windowDays;
  const stdDev = Math.sqrt(variance);

  let monotony = 1.0;
  if (stdDev > 0) {
    monotony = Math.round((exactMeanLoad / stdDev) * 100) / 100;
  } else if (exactMeanLoad > 0) {
    monotony = 2.5;
  }

  const strain = Math.round(totalLoad * monotony);

  let riskLevel: 'OPTIMAL' | 'MODERATE' | 'HIGH' | 'CRITICAL' = 'OPTIMAL';
  let riskBadge = '✅ Équilibré';
  let riskColor = 'emerald';
  let advice = 'Excellente alternance entre séances stimulantes et régénération.';

  if (monotony > 2.0 || (totalLoad > 1800 && strain > totalLoad * 2.2) || strain > 6000) {
    riskLevel = 'CRITICAL';
    riskBadge = '⚠️ Monotonie Critique (> 2.0)';
    riskColor = 'red';
    advice = 'Monotonie critique (> 2.0). Répétition quotidienne de charges similaires sans alternance de régénération, signalant un risque accru de surmenage. Intégrez un jour de repos complet ou une décharge active.';
  } else if (monotony > 1.5 || (totalLoad > 1500 && strain > totalLoad * 1.8) || strain > 4200) {
    riskLevel = 'HIGH';
    riskBadge = '⚠️ Monotonie Élevée';
    riskColor = 'amber';
    advice = 'Les charges journalières se ressemblent trop. Variez les intensités (jours légers vs jours qualitatifs) pour stimuler la surcompensation.';
  } else if (monotony < 1.0 && totalLoad > 0) {
    riskLevel = 'OPTIMAL';
    riskBadge = '📊 Forte Dispersion (Séances Espacées)';
    riskColor = 'sky';
    advice = 'Forte variance des charges quotidiennes (séances espacées ou stimulus isolé). Veillez à une régularité suffisante pour ancrer les adaptations.';
  }

  return {
    windowDays,
    dailyLoads,
    totalLoad,
    meanLoad,
    stdDev: Math.round(stdDev * 10) / 10,
    monotony,
    strain,
    riskLevel,
    riskBadge,
    riskColor,
    advice
  };
}

// ============================================================================
// MODÈLE DE BANISTER ÉTENDU & PROJECTIONS FUTURES
// ============================================================================

export function computeBanisterPerformance(
  events: EventsByQuality | undefined | null, 
  dailyMetrics: DailyMetricsMap = {}, 
  daysHistory: number = 30, 
  daysFuture: number = 14,
  tauFatigue: number = 7,
  tauFitness: number = 28,
  initialCtl: number | null = null
): BanisterPerformanceResult {
  const today = parseLocalDate(new Date());

  let earliestSessionDate: Date | null = null;
  if (events && typeof events === 'object') {
    for (const qDates of Object.values(events)) {
      if (qDates && typeof qDates === 'object') {
        for (const [dateStr, session] of Object.entries(qDates)) {
          if (session && isPrimary(session) && extractSessionLoad(session) > 0) {
            const d = parseLocalDate(dateStr);
            if (!isNaN(d.getTime())) {
              if (!earliestSessionDate || d < earliestSessionDate) {
                earliestSessionDate = d;
              }
            }
          }
        }
      }
    }
  }

  const historyDays = earliestSessionDate !== null
    ? Math.max(0, Math.round((today.getTime() - earliestSessionDate.getTime()) / (1000 * 3600 * 24)))
    : 0;

  const warmupDays = Math.max(90, historyDays + 60, daysHistory + 60);
  const fullRawData: Array<{
    dateStr: string;
    day: number;
    month: number;
    offset: number;
    isToday: boolean;
    isFuture: boolean;
    load: number;
    vfc: number | null;
    readiness: number | null;
  }> = [];

  for (let i = -warmupDays; i <= daysFuture; i++) {
    const d = addDays(today, i);
    const dateStr = getLocalYYYYMMDD(d);

    const load = getDailyAthleteLoad(events, dateStr);
    const vfc = dailyMetrics?.[dateStr]?.vfc || null;
    const readiness = dailyMetrics?.[dateStr]?.readiness || null;

    fullRawData.push({
      dateStr,
      day: d.getDate(),
      month: d.getMonth() + 1,
      offset: i,
      isToday: i === 0,
      isFuture: i > 0,
      load,
      vfc,
      readiness
    });
  }

  const loads = fullRawData.map(d => d.load);
  
  let atlArray: number[];
  let ctlArray: number[];
  if (initialCtl !== null && Number(initialCtl) > 0) {
    const initCtlNum = Number(initialCtl);
    const firstSessionIdx = fullRawData.findIndex(d => d.offset === -historyDays);
    if (firstSessionIdx > 0 && firstSessionIdx < fullRawData.length) {
      const preLoads = loads.slice(0, firstSessionIdx);
      const preAtl = calculateExpDecay(preLoads, tauFatigue, { decayToZero: true });
      const preCtl = calculateExpDecay(preLoads, tauFitness, { decayToZero: true });
      const postLoads = loads.slice(firstSessionIdx);
      const postAtl = calculateExpDecay(postLoads, tauFatigue, { decayToZero: true, initialValue: initCtlNum });
      const postCtl = calculateExpDecay(postLoads, tauFitness, { decayToZero: true, initialValue: initCtlNum });
      atlArray = [...preAtl, ...postAtl];
      ctlArray = [...preCtl, ...postCtl];
    } else {
      atlArray = calculateExpDecay(loads, tauFatigue, { decayToZero: true, initialValue: initCtlNum });
      ctlArray = calculateExpDecay(loads, tauFitness, { decayToZero: true, initialValue: initCtlNum });
    }
  } else {
    atlArray = calculateExpDecay(loads, tauFatigue, { decayToZero: true });
    ctlArray = calculateExpDecay(loads, tauFitness, { decayToZero: true });
  }

  const hasInitialCtl = (initialCtl !== null && Number(initialCtl) > 0);
  const minWarmupThreshold = hasInitialCtl ? 0 : Math.max(84, Math.round(tauFitness * 3));
  const isWarmedUp = hasInitialCtl || (historyDays >= minWarmupThreshold);

  const fullSeries: BanisterPoint[] = fullRawData.map((d, idx) => {
    const atl = Math.round(atlArray[idx] * 10) / 10;
    const ctl = Math.round(ctlArray[idx] * 10) / 10;
    const tsb = Math.round((ctl - atl) * 10) / 10;
    const rawTsbPercent = calculateTsbPercent(ctl, atl);
    const tsbPercent = isWarmedUp ? rawTsbPercent : null;

    const acwr = (ctl > 0 && isWarmedUp) ? Math.round((atl / ctl) * 100) / 100 : 1;

    let acwrUncoupled = acwr;
    if (idx >= 27 && isWarmedUp) {
      const acuteLoads = loads.slice(idx - 6, idx + 1);
      const chronicLoads = loads.slice(idx - 27, idx - 6);
      const acuteMean = acuteLoads.reduce((a, b) => a + b, 0) / 7;
      const chronicMean = chronicLoads.reduce((a, b) => a + b, 0) / 21;
      if (chronicMean > 0) {
        acwrUncoupled = Math.round((acuteMean / chronicMean) * 100) / 100;
      }
    }

    return {
      ...d,
      atl,
      ctl,
      tsb,
      tsbPercent,
      acwr,
      acwrUncoupled
    };
  });

  const displayStartIndex = fullSeries.findIndex(s => s.offset === -daysHistory);
  const series = displayStartIndex >= 0 ? fullSeries.slice(displayStartIndex) : fullSeries;

  const todayIndex = series.findIndex(s => s.isToday);
  const current = todayIndex >= 0 ? series[todayIndex] : series[0];
  const futureSeries = series.filter(s => s.isFuture);

  let peakDay: BanisterPoint | null = null;
  if (futureSeries.length > 0) {
    let maxTsb = -999;
    futureSeries.forEach(s => {
      if (s.tsb > maxTsb) {
        maxTsb = s.tsb;
        peakDay = s;
      }
    });
  }

  const tsbZone = getTsbZone(current.ctl, current.atl, historyDays, tauFitness, hasInitialCtl);

  return {
    tauFatigue,
    tauFitness,
    series,
    current,
    todayIndex,
    futureSeries,
    peakDay,
    historyDays,
    isWarmedUp,
    tsbZone
  };
}

// ============================================================================
// ANALYSE D'AFFÛTAGE (TAPERING)
// ============================================================================

export function getTaperingAnalysis(
  targetCompetition: TargetCompetition | null | undefined, 
  events: EventsByQuality | undefined | null, 
  dailyMetrics: DailyMetricsMap = {},
  tauFatigue: number = 7,
  tauFitness: number = 28,
  initialCtl: number | null = null,
  existingBanister: BanisterPerformanceResult | null = null
): TaperingRecommendation | null {
  if (!targetCompetition || !targetCompetition.date) return null;

  const today = new Date();
  const [ty, tm, td] = targetCompetition.date.split('-').map(Number);
  const compDate = new Date(ty, tm - 1, td);

  const diffMs = compDate.getTime() - today.getTime();
  const daysRemaining = Math.ceil(diffMs / (1000 * 3600 * 24));

  const projectionDays = Math.max(7, Math.min(180, Math.max(0, daysRemaining) + 3));
  const banister: BanisterPerformanceResult = (existingBanister && existingBanister.series?.some((s) => s.dateStr === targetCompetition.date))
    ? existingBanister
    : computeBanisterPerformance(events, dailyMetrics, 30, projectionDays, tauFatigue, tauFitness, initialCtl);

  const compDayData = banister.series.find(s => s.dateStr === targetCompetition.date) || 
                      banister.futureSeries[banister.futureSeries.length - 1] || 
                      banister.current;

  const targetTsb = targetCompetition.targetTsb ?? 15;
  const targetTsbUnit = targetCompetition.targetTsbUnit || 'percent';
  const projectedTsb = compDayData?.tsb ?? 0;
  const projectedTsbPercent = calculateTsbPercent(compDayData?.ctl ?? 0, compDayData?.atl ?? 0);
  const tsbGap = targetTsbUnit === 'percent' && projectedTsbPercent !== null
    ? Math.round((projectedTsbPercent - targetTsb) * 10) / 10
    : Math.round((projectedTsb - targetTsb) * 10) / 10;
  const hasInitCtl = (initialCtl !== null && Number(initialCtl) > 0);
  const tsbZone = getTsbZone(compDayData?.ctl ?? 0, compDayData?.atl ?? 0, banister.historyDays, tauFitness, hasInitCtl);

  const foster = computeFosterMetrics(events);

  let status: 'BUILD' | 'TAPER_START' | 'TAPER_OPTIMAL' | 'TAPER_PASSIVE' | 'TAPER_OVERREACHING' | 'PEAK' | 'POST' = 'BUILD';
  let statusBadge = '🏋️ Phase de Développement';
  let statusColor = 'blue';
  let advice = '';

  let futureSessionsCount = 0;
  banister.series
    .filter(s => s.offset > 0 && s.dateStr <= targetCompetition.date)
    .forEach(s => {
      if (s.load > 0) futureSessionsCount += 1;
    });

  if (daysRemaining > 21) {
    status = 'BUILD';
    statusBadge = '⚡ Cycle de Charge';
    statusColor = 'blue';
    advice = 'Consolidez votre volume et votre charge chronique (CTL). Vous avez le temps d\'accumuler du travail sans risque immédiat pour le pic.';
  } else if (daysRemaining > 10) {
    status = 'TAPER_START';
    statusBadge = '📉 Début d\'Affûtage';
    statusColor = 'cyan';
    advice = 'Amorcez la réduction progressive du volume (-40% à -50%) tout en maintenant l\'intensité cible pour conserver le recrutement neuromusculaire.';
  } else if (daysRemaining > 0) {
    const isOptimalTsb = projectedTsbPercent !== null 
      ? (projectedTsbPercent >= 5 && projectedTsbPercent <= 25)
      : (projectedTsb >= 10 && projectedTsb <= 25);

    const isUnderTsb = projectedTsbPercent !== null
      ? (projectedTsbPercent < 5)
      : (projectedTsb < 10);

    if (isOptimalTsb) {
      if (futureSessionsCount === 0) {
        status = 'TAPER_PASSIVE';
        statusBadge = '💤 Repos Passif Projeté';
        statusColor = 'sky';
        advice = `Hypothèse de repos total jusqu'au Jour J (aucune séance future planifiée). TSB passif projeté : +${projectedTsb}${projectedTsbPercent !== null ? ` (+${projectedTsbPercent}% de la CTL)` : ''}. Planifiez vos rappels d'affûtage dans la grille pour une modélisation active.`;
      } else {
        status = 'TAPER_OPTIMAL';
        statusBadge = '🎯 Affûtage Actif (Pic de Forme)';
        statusColor = 'emerald';
        advice = `Planification d'affûtage active (${futureSessionsCount} séance(s) planifiée(s)). TSB prévu le Jour J : +${projectedTsb}${projectedTsbPercent !== null ? ` (+${projectedTsbPercent}% de la CTL)` : ''} (cible : +${targetTsb}).`;
      }
    } else if (isUnderTsb) {
      status = 'TAPER_OVERREACHING';
      statusBadge = '⚠️ Fatigue Résiduelle Élevée';
      statusColor = 'amber';
      advice = `Votre TSB prévu est bas (+${projectedTsb}${projectedTsbPercent !== null ? `, ${projectedTsbPercent}% CTL` : ''}). Réduisez le volume pour dissiper la fatigue aiguë (ATL) avant l'épreuve.`;
    } else {
      status = 'PEAK';
      statusBadge = '🕊️ Fraîcheur Élevée / Maintien Tonicité';
      statusColor = 'yellow';
      advice = `TSB très élevé (+${projectedTsb}${projectedTsbPercent !== null ? `, +${projectedTsbPercent}% CTL` : ''}). Pour éviter la perte de tonus neuromusculaire, placez une courte piqûre de rappel 48-72h avant.`;
    }
  } else if (daysRemaining === 0) {
    status = 'PEAK';
    statusBadge = '🏁 Jour J : Compétition !';
    statusColor = 'emerald';
    advice = `C'est le grand jour ! TSB actuel : ${banister.current.tsb}. Donnez le meilleur de vous-même.`;
  } else {
    status = 'POST';
    statusBadge = '🏅 Épreuve Terminée';
    statusColor = 'slate';
    advice = 'Phase de récupération post-effort active recommandée.';
  }

  return {
    targetCompetition,
    daysRemaining,
    banister,
    compDayData,
    targetTsb,
    targetTsbUnit,
    projectedTsb,
    projectedTsbPercent,
    tsbGap,
    tsbZone,
    foster,
    futureSessionsCount,
    status,
    statusBadge,
    statusColor,
    advice
  };
}

// ============================================================================
// BALANCE CARDIO VS MUSCULAIRE (RPE DIFFÉRENTIEL & TAU DÉCOUPLÉS)
// ============================================================================

export function computeCardioVsMuscularBalance(
  events: EventsByQuality | undefined | null, 
  referenceDateStr: string | null = null, 
  windowDays: number = 7
): CardioMuscularBalance {
  const refDate = referenceDateStr ? new Date(referenceDateStr) : new Date();
  const dailyBreakdown: CardioMuscularDailyItem[] = [];
  let totalCardioLoad = 0;
  let totalMuscLoad = 0;
  let totalGlobalLoad = 0;
  let totalEccentricSessions = 0;

  const filterHistoryDays = 56;
  const allCardioLoadsChronological: number[] = [];
  const allMuscLoadsChronological: number[] = [];

  for (let i = filterHistoryDays - 1; i >= 0; i--) {
    const d = new Date(refDate);
    d.setDate(refDate.getDate() - i);
    const dateStr = getLocalYYYYMMDD(d);

    let dayCardio = 0;
    let dayMusc = 0;
    let dayGlobal = 0;
    let dayHasEccentric = false;

    Object.values(events || {}).forEach(qEvents => {
      if (qEvents && qEvents[dateStr]) {
        const item = qEvents[dateStr];
        if (!isPrimary(item)) return;

        let cLoad = 0;
        let mLoad = 0;
        let gLoad = 0;

        if (typeof item === 'object') {
          gLoad = Number(item.load) || 0;
          const dur = Number(item.duration) || 0;
          const rpeC = Number(item.rpeCardio) || 0;
          const rpeM = Number(item.rpeMusc || item.rpeMusculaire) || 0;
          const isEcc = Boolean(item.isEccentric);

          if (item.loadCardio !== undefined) {
            cLoad = Number(item.loadCardio) || 0;
          } else if (dur > 0 && rpeC > 0) {
            cLoad = dur * rpeC;
          } else {
            cLoad = gLoad;
          }

          if (item.loadMusc !== undefined) {
            mLoad = Number(item.loadMusc) || 0;
          } else if (dur > 0 && rpeM > 0) {
            mLoad = Math.round(dur * rpeM * (isEcc ? 1.15 : 1.0));
          } else {
            mLoad = gLoad;
          }

          if (isEcc) {
            dayHasEccentric = true;
          }
        } else if (typeof item === 'number') {
          gLoad = Math.round(item * 45);
          cLoad = gLoad;
          mLoad = gLoad;
        }

        dayCardio += cLoad;
        dayMusc += mLoad;
        dayGlobal += gLoad;
      }
    });

    allCardioLoadsChronological.push(dayCardio);
    allMuscLoadsChronological.push(dayMusc);

    if (i < windowDays) {
      if (dayHasEccentric) totalEccentricSessions++;
      totalCardioLoad += dayCardio;
      totalMuscLoad += dayMusc;
      totalGlobalLoad += dayGlobal;

      dailyBreakdown.push({
        dateStr,
        day: d.getDate(),
        cardioLoad: dayCardio,
        muscLoad: dayMusc,
        globalLoad: dayGlobal,
        hasEccentric: dayHasEccentric
      });
    }
  }

  const tauCardio = 3;
  const tauMusc = 6;
  const expAtlCardio = calculateExpDecay(allCardioLoadsChronological, tauCardio, { decayToZero: true, initialValue: 0 });
  const expAtlMusc = calculateExpDecay(allMuscLoadsChronological, tauMusc, { decayToZero: true, initialValue: 0 });
  const currentAtlCardio = Math.round((expAtlCardio[expAtlCardio.length - 1] || 0) * 10) / 10;
  const currentAtlMusc = Math.round((expAtlMusc[expAtlMusc.length - 1] || 0) * 10) / 10;

  const combined = totalCardioLoad + totalMuscLoad;
  const cardioPercent = combined > 0 ? Math.round((totalCardioLoad / combined) * 100) : 50;
  const muscPercent = 100 - cardioPercent;

  const asymmetryScore = combined > 0 ? Math.round(((totalCardioLoad - totalMuscLoad) / combined) * 100) : 0;

  let state: 'BALANCED' | 'CARDIO_DOMINANT' | 'MUSCULAR_DOMINANT' = 'BALANCED';
  let badge = '⚖️ Équilibre Cardio-Musculaire';
  let color = 'emerald';
  let description = 'Charge harmonieusement répartie entre appareil cardiorespiratoire et chaîne musculo-squelettique.';
  let recommendation = 'Toutes les filières peuvent être abordées sans contre-indication de fatigue locale.';

  if (asymmetryScore >= 20 || currentAtlCardio > currentAtlMusc * 1.35) {
    state = 'CARDIO_DOMINANT';
    badge = '🫀 Jambes Fraîches / Cardio Sollicité';
    color = 'sky';
    description = 'Votre système cardiorespiratoire a absorbé l\'essentiel du stress récent (ATL Cardio: ' + currentAtlCardio + ' UA, tau 3j). Vos muscles et articulations restent relativement frais.';
    recommendation = 'Idéal pour : renforcement musculaire, force max, travail technique, pliométrie légère ou côtes courtes sans montée en zone rouge cardiaque.';
  } else if (asymmetryScore <= -20 || currentAtlMusc > currentAtlCardio * 1.35) {
    state = 'MUSCULAR_DOMINANT';
    badge = '🦵 Cardio Disponible / Jambes Lourdes';
    color = 'red';
    description = 'Tension mécanique et stress tissulaire résiduel élevés (ATL Musc: ' + currentAtlMusc + ' UA, tau 6j). Votre cœur et vos poumons sont disponibles mais vos fibres musculaires demandent de la régénération.';
    recommendation = 'Idéal pour : séance cardio portée à basse intensité (vélo, home-trainer, natation, marche inclinée) pour favoriser le drainage sans impacts articulaires.';
  }

  return {
    windowDays,
    dailyBreakdown,
    totalCardioLoad,
    totalMuscLoad,
    totalGlobalLoad,
    totalEccentricSessions,
    cardioPercent,
    muscPercent,
    asymmetryScore,
    tauCardio,
    tauMusc,
    atlCardio: currentAtlCardio,
    atlMusc: currentAtlMusc,
    state,
    badge,
    color,
    description,
    recommendation
  };
}

// ============================================================================
// DISTRIBUTION D'INTENSITÉ (STEPHEN SEILER 3 ZONES)
// ============================================================================

export function computeIntensityDistribution(
  events: EventsByQuality | undefined | null, 
  qualities: QualityDefinition[] = DEFAULT_QUALITIES, 
  referenceDateStr: string | null = null, 
  windowDays: number = 28
): IntensityDistribution {
  const refDate = parseLocalDate(referenceDateStr || new Date());
  let z1Minutes = 0;
  let z2Minutes = 0;
  let z3Minutes = 0;
  let z1Load = 0;
  let z2Load = 0;
  let z3Load = 0;
  let totalSessions = 0;
  let strengthSessionsCount = 0;

  for (let i = windowDays - 1; i >= 0; i--) {
    const d = addDays(refDate, -i);
    const dateStr = getLocalYYYYMMDD(d);

    Object.entries(events || {}).forEach(([qId, qDates]) => {
      if (qDates && qDates[dateStr]) {
        const item = qDates[dateStr];
        if (!isPrimary(item)) return;

        const dur = Number(item.duration) || 0;
        const load = extractSessionLoad(item);
        if (dur <= 0 && load <= 0) return;

        if (!isCardioQuality(qId, qualities)) {
          strengthSessionsCount++;
          return;
        }

        totalSessions++;
        const rpeC = Number(item.rpeCardio) || (Number(item.rpe) || 5);

        if (rpeC >= 7 || qId === 'vo2max') {
          z3Minutes += dur;
          z3Load += load;
        } else if (qId === 'seuil' || (rpeC >= 5 && rpeC <= 6)) {
          z2Minutes += dur;
          z2Load += load;
        } else {
          z1Minutes += dur;
          z1Load += load;
        }
      }
    });
  }

  const totalMinutes = z1Minutes + z2Minutes + z3Minutes;
  const totalLoad = z1Load + z2Load + z3Load;

  const z1TimePct = totalMinutes > 0 ? Math.round((z1Minutes / totalMinutes) * 100) : 0;
  const z2TimePct = totalMinutes > 0 ? Math.round((z2Minutes / totalMinutes) * 100) : 0;
  const z3TimePct = totalMinutes > 0 ? Math.round((z3Minutes / totalMinutes) * 100) : 0;

  const z1LoadPct = totalLoad > 0 ? Math.round((z1Load / totalLoad) * 100) : 0;
  const z2LoadPct = totalLoad > 0 ? Math.round((z2Load / totalLoad) * 100) : 0;
  const z3LoadPct = totalLoad > 0 ? Math.round((z3Load / totalLoad) * 100) : 0;

  let profile: 'EMPTY' | 'POLARIZED' | 'PYRAMIDAL' | 'THRESHOLD_DOMINANT' | 'HIGH_INTENSITY' | 'BASE_BUILDING' | 'BALANCED' = 'BALANCED';
  let badge = '⚖️ Mixte';
  let color = 'sky';
  let advice = '';

  if (totalMinutes === 0) {
    profile = 'EMPTY';
    badge = '⏳ Aucune donnée';
    color = 'slate';
    advice = 'Enregistrez vos premières séances pour analyser votre répartition d\'intensité Seiler.';
  } else if (z1TimePct >= 75 && z2TimePct <= 12 && z3TimePct >= 8) {
    profile = 'POLARIZED';
    badge = '🎯 Polarisé Optimal (Seiler 80/20)';
    color = 'emerald';
    advice = 'Excellente polarisation. Le gros du volume est validé en basse intensité (Z1) avec des piqûres qualitatives à haute intensité (Z3), évitant le piège de la zone grise (Z2).';
  } else if (z1TimePct >= 65 && z2TimePct >= z3TimePct) {
    profile = 'PYRAMIDAL';
    badge = '📐 Pyramidal Classique';
    color = 'blue';
    advice = 'Distribution pyramidale saine : socle aérobie dominant (Z1), part mesurée de seuil (Z2) et travail haute intensité ciblé (Z3).';
  } else if (z2TimePct >= 25) {
    profile = 'THRESHOLD_DOMINANT';
    badge = '⚠️ Surcharge Médiane (Trou Noir Z2)';
    color = 'amber';
    advice = 'Proportion de travail au seuil (Z2) trop élevée. L\'entraînement en intensité intermédiaire engendre une fatigue nerveuse disproportionnée par rapport aux gains d\'endurance de fond. Ralentissez vos footings (Z1) pour durcir vos séances clés (Z3).';
  } else if (z3TimePct >= 30) {
    profile = 'HIGH_INTENSITY';
    badge = '⚡ Dominance Haute Intensité (Z3)';
    color = 'rose';
    advice = 'Volume à haute intensité très important (> 30%). Risque de saturation neuromusculaire si ce bloc dure plus de 3 semaines.';
  } else {
    profile = 'BASE_BUILDING';
    badge = '🛡️ Développement Foncière (Z1)';
    color = 'emerald';
    advice = 'Prédominance de travail à basse intensité, idéal pour la construction mitochondriale et la capillarisation.';
  }

  return {
    windowDays,
    totalSessions,
    totalMinutes,
    totalLoad,
    z1Minutes,
    z2Minutes,
    z3Minutes,
    z1TimePct,
    z2TimePct,
    z3TimePct,
    z1LoadPct,
    z2LoadPct,
    z3LoadPct,
    strengthSessionsCount,
    profile,
    badge,
    color,
    advice
  };
}

// ============================================================================
// FATIGUE PERÇUE & COÛT INTERNE (EFFORT VS RÉPONSE)
// ============================================================================

export function computePerceivedFatigueAnalysis(
  events: EventsByQuality | undefined | null, 
  referenceDateStr: string | null = null, 
  windowDays: number = 28
): PerceivedFatigueAnalysis {
  const refDate = referenceDateStr ? new Date(referenceDateStr) : new Date();
  const sessionEntries: Array<{
    dateStr: string;
    qId: string;
    load: number;
    duration: number;
    maxRpe: number;
    fatigue: number;
    strainDiscrepancy: number;
  }> = [];

  for (let i = windowDays - 1; i >= 0; i--) {
    const d = new Date(refDate);
    d.setDate(refDate.getDate() - i);
    const dateStr = getLocalYYYYMMDD(d);

    Object.entries(events || {}).forEach(([qId, qDates]) => {
      if (qDates && qDates[dateStr]) {
        const item = qDates[dateStr];
        if (!isPrimary(item)) return;

        const fatigueVal = Number(item.fatigue);
        const load = extractSessionLoad(item);
        const dur = Number(item.duration) || 0;
        const rpeM = Number(item.rpeMusc || item.rpeMusculaire) || 5;
        const rpeC = Number(item.rpeCardio) || 5;
        const maxRpe = Math.max(rpeM, rpeC);

        if (!isNaN(fatigueVal) && fatigueVal > 0) {
          const strainDiscrepancy = fatigueVal - maxRpe;
          sessionEntries.push({
            dateStr,
            qId,
            load,
            duration: dur,
            maxRpe,
            fatigue: fatigueVal,
            strainDiscrepancy
          });
        }
      }
    });
  }

  const count = sessionEntries.length;
  if (count === 0) {
    return {
      count: 0,
      meanFatigue: null,
      meanDiscrepancy: 0,
      highStrainSessionsCount: 0,
      status: 'initializing',
      badge: '⏳ En attente de saisies',
      color: 'slate',
      interpretation: 'Renseignez le niveau de fatigue perçue (1-10) lors de vos séances pour calibrer votre tolérance individuelle à la charge.'
    };
  }

  const totalFatigue = sessionEntries.reduce((acc, s) => acc + s.fatigue, 0);
  const meanFatigue = Math.round((totalFatigue / count) * 10) / 10;
  const totalDiscrepancy = sessionEntries.reduce((acc, s) => acc + s.strainDiscrepancy, 0);
  const meanDiscrepancy = Math.round((totalDiscrepancy / count) * 10) / 10;
  const highStrainSessionsCount = sessionEntries.filter(s => s.fatigue >= 7 || s.strainDiscrepancy >= 2).length;

  let status: 'initializing' | 'optimal' | 'elevated' | 'critical' = 'optimal';
  let badge = '🟢 Excellente Tolérance';
  let color = 'emerald';
  let interpretation = 'Vos séances sont bien assimilées. Le niveau de fatigue ressentie est en parfaite adéquation avec la difficulté prescrite.';

  if (meanFatigue >= 7.5 || highStrainSessionsCount >= Math.max(2, Math.round(count * 0.4))) {
    status = 'critical';
    badge = '🚨 Fatigue Aiguë Élevée';
    color = 'rose';
    interpretation = `Fatigue perçue moyenne élevée (${meanFatigue}/10) avec ${highStrainSessionsCount} séance(s) en fatigue disproportionnée. Signal d'accumulation de fatigue résiduelle. Prévoyez une phase de décharge active ou réduisez temporairement les volumes.`;
  } else if (meanFatigue >= 6.2 || meanDiscrepancy >= 1.2) {
    status = 'elevated';
    badge = '⚠️ Fatigue Marquée';
    color = 'amber';
    interpretation = `L'effort coûte plus cher que prévu à l'organisme (écart moyen de +${meanDiscrepancy} pts par rapport au RPE). Surveillez votre sommeil et votre apport glucidique post-séance.`;
  } else if (meanFatigue <= 4.0) {
    status = 'optimal';
    badge = '✨ Fraîcheur & Récupération Rapide';
    color = 'emerald';
    interpretation = `Niveau de fatigue perçue très bas (${meanFatigue}/10). L'organisme encaisse remarquablement bien la charge actuelle.`;
  }

  return {
    count,
    meanFatigue,
    meanDiscrepancy,
    highStrainSessionsCount,
    status,
    badge,
    color,
    interpretation
  };
}
