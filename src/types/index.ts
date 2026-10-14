/**
 * Types de domaine partagés (qualités, séances, EMA).
 */
import type { SessionExercise } from '../utils/muscleHelpers';
import type { CellState } from '../utils/physiology';

export interface QualityImpact {
  id: string;
  ratio: number;
}

export interface Quality {
  id: string;
  name: string;
  g?: number;
  o?: number;
  retentionDays?: number;
  category?: 'cardio' | 'force' | 'mixte' | string;
  impacts?: QualityImpact[];
  [key: string]: unknown;
}

export interface TrainingRecommendation {
  quality: Quality;
  rank: number;
  isBlockFocus: boolean;
  cellState: CellState;
  daysSinceLastSession: number | null;
  lastSessionData: SessionData | null;
  urgencyScore: number;
  urgencyLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'OPTIMAL' | 'REST' | string;
  urgencyBadge: string;
  urgencyColor: string;
  reason: string;
  actionTip: string;
}


export interface SecondaryContribution {
  load: number;
  loadCardio?: number;
  loadMusc?: number;
  ratio: number;
  parentName?: string;
}

export interface SubSession {
  id: string;
  name?: string;
  duration: number;
  rpeMusc?: number;
  rpeMusculaire?: number;
  rpeCardio?: number;
  fatigue?: number;
  load: number;
  loadCardio?: number;
  loadMusc?: number;
  sport?: string;
  isEccentric?: boolean;
  exercises?: SessionExercise[];
  notes?: string;
}

export interface SessionData {
  rpeMusc?: number;
  rpeMusculaire?: number;
  rpeCardio?: number;
  fatigue?: number;
  duration?: number;
  load: number;
  loadCardio?: number;
  loadMusc?: number;
  sport?: 'run' | 'bike' | 'muscu' | string;
  isEccentric?: boolean;
  isSecondary?: boolean;
  exercises?: SessionExercise[];
  subSessions?: SubSession[];
  parentQId?: string;
  parentContributions?: Record<string, SecondaryContribution>;
  originalLoad?: number;
  /** Charge d'origine conservée par la migration v1 -> v2. */
  loadLegacy?: number;
  /** Tonnage total (kg) des séances de musculation en direct. */
  tonnageKg?: number;
  isSimulated?: boolean;
  updatedAt?: number;
  notes?: string;
  type?: string;
}

export interface QualityEMASeriesPoint {
  dateStr: string;
  day: number;
  offset: number;
  load: number;
  ema3: number;
  ema7: number;
  ema21: number;
}

export interface QualityEMAData {
  qualityId: string;
  series: QualityEMASeriesPoint[];
  current: {
    load: number;
    ema3: number;
    ema7: number;
    ema21: number;
    prevEma3?: number;
    prevEma7?: number;
    prevEma21?: number;
    prevPeriodEma3?: number;
    prevPeriodEma7?: number;
    prevPeriodEma21?: number;
    prevWeekEma3?: number;
    prevWeekEma7?: number;
    prevWeekEma21?: number;
    delta3?: number;
    delta7?: number;
    delta21?: number;
    periodDelta3?: number;
    periodDelta7?: number;
    periodDelta21?: number;
    weekDelta3?: number;
    weekDelta7?: number;
    weekDelta21?: number;
    percent3?: number;
    percent7?: number;
    percent21?: number;
    periodPercent3?: number;
    periodPercent7?: number;
    periodPercent21?: number;
    weekPercent3?: number;
    weekPercent7?: number;
    weekPercent21?: number;
    trend3?: 'up' | 'down' | 'flat' | string;
    trend7?: 'up' | 'down' | 'flat' | string;
    trend21?: 'up' | 'down' | 'flat' | string;
    acwr: number;
    trend: 'up' | 'down' | 'flat' | string;
  };
  sparkline: QualityEMASeriesPoint[];
}

export type QualitiesEMAMap = Record<string, QualityEMAData>;

/** Séances d'une qualité, indexées par date `YYYY-MM-DD`. */
export type QualityEvents = Record<string, SessionData>;

/** Séances de toutes les qualités, indexées par id de qualité puis par date. */
export type EventsByQuality = Record<string, QualityEvents>;

/** Événements dont les séances peuvent être incomplètes (historique, imports, saisies partielles). */
export type PartialEventsByQuality = Record<string, Record<string, Partial<SessionData>>>;

/** Jour de la timeline affichée (grille, tableaux de bord). */
export interface GridDay {
  offset: number;
  dateStr: string;
  dateObj: Date;
  display: { prefix: string; date: string };
}

/** Clic sur une métrique journalière (readiness, VFC, FC repos). */
export type MetricClickHandler = (
  dateStr: string,
  type: 'readiness' | 'vfc' | 'hrRest',
  currentValue: number | string
) => void;

/** Famille d'un exercice de musculation (alignée sur MuscleGroup.category). */
export type ExerciseCategory = 'lower' | 'upper_push' | 'upper_pull' | 'core';

/** Exercice du catalogue (ou exercice personnalisé). */
export interface ExerciseDefinition {
  id: string;
  name: string;
  category: ExerciseCategory;
  /** Polyarticulaire (true) ou isolation (false). */
  isCompound: boolean;
  /** Répétitions par défaut pour estimer le volume. */
  defaultReps: number;
  /** Ratio d'activation par id de MUSCLE_GROUPS, dans ]0, 1]. */
  muscleRatios: Record<string, number>;
}

// Résultats des modèles physiologiques partagés entre vues (dérivés des calculateurs).
import type {
  getTaperingAnalysis,
  computeFosterMetrics,
  computeBanisterPerformance,
  computeCardioVsMuscularBalance
} from '../utils/physiology';
import type { PhysiologicalSettings } from '../hooks/useMetricsState';

export type TaperingAnalysis = ReturnType<typeof getTaperingAnalysis>;
export type FosterMetrics = ReturnType<typeof computeFosterMetrics>;
export type BanisterPerformance = ReturnType<typeof computeBanisterPerformance>;
export type CardioMuscularBalanceResult = ReturnType<typeof computeCardioVsMuscularBalance>;
export type { PhysiologicalSettings };
