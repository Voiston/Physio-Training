/**
 * Helpers et modélisation physiologique de la charge par groupe musculaire.
 * 
 * Basé sur les standards en sciences du sport (Schoenfeld 2010, 2019; Helms et al. 2014; Israetel et al. 2020) :
 * - Hard Sets (Séries effectives proches de l'échec) pondérées par le ratio d'implication musculaire.
 * - Repères de volume hebdomadaire par groupe musculaire :
 *     * MV (Maintenance Volume) : < 6 séries / semaine
 *     * MEV (Minimum Effective Volume) : 6 à 10 séries / semaine
 *     * MAV (Maximum Adaptive Volume) : 10 à 20 séries / semaine (zone optimale d'adaptation)
 *     * MRV (Maximum Recoverable Volume) : > 20-22 séries / semaine (seuil de saturation / surmenage local)
 * - Ratios d'équilibre :
 *     * H:Q ratio (Ischios / Quadriceps) : visée >= 0.60 (prévention LCA et santé fémoro-patellaire)
 *     * Pull:Push ratio (Tirage / Poussée) : visée >= 1.0 (centrage huméral et santé de la coiffe des rotateurs)
 */

import { getLocalYYYYMMDD, parseLocalDate, addDays } from './dateHelpers.js';

export interface MuscleGroup {
  id: string;
  name: string;
  category: 'lower' | 'upper_push' | 'upper_pull' | 'core';
  categoryLabel: string;
  color: string;
}

export const MUSCLE_GROUPS: Record<string, MuscleGroup> = {
  quadriceps: { id: 'quadriceps', name: 'Quadriceps', category: 'lower', categoryLabel: 'Bas du corps', color: '#38bdf8' },
  ischios: { id: 'ischios', name: 'Ischio-jambiers', category: 'lower', categoryLabel: 'Bas du corps', color: '#f59e0b' },
  glutes: { id: 'glutes', name: 'Fessiers', category: 'lower', categoryLabel: 'Bas du corps', color: '#ec4899' },
  mollets: { id: 'mollets', name: 'Mollets', category: 'lower', categoryLabel: 'Bas du corps', color: '#a855f7' },
  pectoraux: { id: 'pectoraux', name: 'Pectoraux', category: 'upper_push', categoryLabel: 'Haut du corps (Push)', color: '#ef4444' },
  deltoides_ant: { id: 'deltoides_ant', name: 'Épaules (Antérieur / Latéral)', category: 'upper_push', categoryLabel: 'Haut du corps (Push)', color: '#f97316' },
  deltoides_post: { id: 'deltoides_post', name: 'Deltoïdes Postérieurs', category: 'upper_pull', categoryLabel: 'Haut du corps (Pull)', color: '#0ea5e9' },
  triceps: { id: 'triceps', name: 'Triceps', category: 'upper_push', categoryLabel: 'Haut du corps (Push)', color: '#eab308' },
  dorsaux: { id: 'dorsaux', name: 'Grand Dorsal (Largeur dos)', category: 'upper_pull', categoryLabel: 'Haut du corps (Pull)', color: '#10b981' },
  trapezes: { id: 'trapezes', name: 'Trapèzes & Haut du dos', category: 'upper_pull', categoryLabel: 'Haut du corps (Pull)', color: '#14b8a6' },
  biceps: { id: 'biceps', name: 'Biceps / Fléchisseurs', category: 'upper_pull', categoryLabel: 'Haut du corps (Pull)', color: '#06b6d4' },
  abdos: { id: 'abdos', name: 'Sangle Abdominale & Gainage', category: 'core', categoryLabel: 'Tronc & Core', color: '#8b5cf6' },
  lombaires: { id: 'lombaires', name: 'Érecteurs du Rachis (Lombaires)', category: 'core', categoryLabel: 'Tronc & Core', color: '#64748b' },
};

export { EXERCISE_CATALOG, type ExerciseDefinition } from '../data/exerciseCatalog';
import { EXERCISE_CATALOG, ExerciseDefinition } from '../data/exerciseCatalog';


export interface SessionExercise {
  id: string;
  name: string;
  sets: number;
  reps?: number;
  rpe?: number;
  rir?: number; // Reps In Reserve (0 à 4+)
  weightKg?: number;
  customRatios?: Record<string, number>;
}

export interface MuscleBreakdownItem {
  muscleId: string;
  name: string;
  category: 'lower' | 'upper_push' | 'upper_pull' | 'core';
  categoryLabel: string;
  color: string;
  directSets: number;    // Séries où le ratio >= 0.8
  effectiveSets: number; // Somme des (séries * ratio)
  repsTotal: number;     // Somme des (séries * reps * ratio)
  estimatedLoad: number; // Indice de volume-charge : séries * reps * (rpe / 10) * ratio
  exercises: { name: string; sets: number; ratio: number }[];
}

export interface SessionMuscularAnalysis {
  muscleLoads: Record<string, MuscleBreakdownItem>;
  sortedMuscles: MuscleBreakdownItem[];
  totalSets: number;
  totalReps: number;
  weightedAvgRpe: number;
  suggestedDuration: number;
  suggestedRpeMusc: number;
}

/**
 * Calcule la décomposition musculaire détaillée d'une liste d'exercices d'une séance.
 */
export function computeSessionMuscularBreakdown(
  exercises: SessionExercise[] = [],
  customCatalog: ExerciseDefinition[] = [],
  isMicroSession: boolean = false
): SessionMuscularAnalysis {
  const muscleMap: Record<string, MuscleBreakdownItem> = {};
  const mergedCatalog = customCatalog.length > 0 ? [...customCatalog, ...EXERCISE_CATALOG] : EXERCISE_CATALOG;

  // Initialisation avec tous les muscles enregistrés
  Object.values(MUSCLE_GROUPS).forEach(m => {
    muscleMap[m.id] = {
      muscleId: m.id,
      name: m.name,
      category: m.category,
      categoryLabel: m.categoryLabel,
      color: m.color,
      directSets: 0,
      effectiveSets: 0,
      repsTotal: 0,
      estimatedLoad: 0,
      exercises: []
    };
  });

  let totalSets = 0;
  let totalReps = 0;
  let weightedRpeSum = 0;

  exercises.forEach(ex => {
    const sets = Math.max(0, Number(ex.sets) || 0);
    if (sets <= 0) return;

    // Retrouver la matrice d'activation
    const catalogItem = mergedCatalog.find(c => c.id === ex.id);

    // Détermination des répétitions (valeur explicite ou defaultReps pour estimer le volume)
    const reps = ex.reps !== undefined && ex.reps !== null && Number(ex.reps) > 0
      ? Number(ex.reps)
      : (catalogItem?.defaultReps || 8);

    // Intensité effective (RIR converti en RPE : RPE = 10 - RIR)
    const effectiveRpe = ex.rpe !== undefined && ex.rpe !== null && Number(ex.rpe) > 0
      ? Math.min(10, Math.max(1, Number(ex.rpe)))
      : (ex.rir !== undefined && ex.rir !== null ? Math.min(10, Math.max(1, 10 - Number(ex.rir))) : 8);

    const weight = Number(ex.weightKg) || 0;

    totalSets += sets;
    totalReps += sets * reps;
    weightedRpeSum += sets * effectiveRpe;

    // Résolution des ratios : snapshot customRatios en priorité, sinon le catalogue, sinon aucun ratio
    const ratios: Record<string, number> = (ex.customRatios && typeof ex.customRatios === 'object' && Object.keys(ex.customRatios).length > 0)
      ? ex.customRatios
      : (catalogItem?.muscleRatios && typeof catalogItem.muscleRatios === 'object' && Object.keys(catalogItem.muscleRatios).length > 0)
        ? catalogItem.muscleRatios
        : {};

    Object.entries(ratios).forEach(([muscleId, ratio]) => {
      if (!muscleMap[muscleId]) {
        muscleMap[muscleId] = {
          muscleId,
          name: muscleId,
          category: 'lower',
          categoryLabel: 'Autre',
          color: '#94a3b8',
          directSets: 0,
          effectiveSets: 0,
          repsTotal: 0,
          estimatedLoad: 0,
          exercises: []
        };
      }

      const m = muscleMap[muscleId];
      const effSets = Number((sets * ratio).toFixed(1));
      const effReps = Math.round(sets * reps * ratio);
      const estLoad = Math.round(sets * reps * (effectiveRpe / 10) * ratio);

      m.effectiveSets = Number((m.effectiveSets + effSets).toFixed(1));
      m.repsTotal += effReps;
      m.estimatedLoad += estLoad;

      if (ratio >= 0.75) {
        m.directSets += sets;
      }

      m.exercises.push({
        name: ex.name,
        sets,
        ratio
      });
    });
  });

  const weightedAvgRpe = totalSets > 0 ? Number((weightedRpeSum / totalSets).toFixed(1)) : 7;
  
  // Durée estimée : environ 3.5 min par série (séance classique) ou 2 min (micro-séance ciblée)
  // min 5 minutes pour micro-séance (au lieu de 15), max 150 minutes
  const setMultiplier = isMicroSession ? 2 : 3.5;
  const minDuration = isMicroSession ? 5 : 15;
  const defaultDuration = isMicroSession ? 10 : 45;
  const suggestedDuration = totalSets > 0 ? Math.min(150, Math.max(minDuration, Math.round(totalSets * setMultiplier))) : defaultDuration;
  const suggestedRpeMusc = Math.min(10, Math.max(1, Math.round(weightedAvgRpe)));

  // Liste triée par nombre de séries effectives décroissantes
  const sortedMuscles = Object.values(muscleMap)
    .filter(m => m.effectiveSets > 0)
    .sort((a, b) => b.effectiveSets - a.effectiveSets);

  return {
    muscleLoads: muscleMap,
    sortedMuscles,
    totalSets,
    totalReps,
    weightedAvgRpe,
    suggestedDuration,
    suggestedRpeMusc
  };
}

export type VolumeStatus = 'under' | 'mev' | 'mav' | 'mrv';

export interface WeeklyMuscleItem extends MuscleBreakdownItem {
  volumeStatus: VolumeStatus;
  statusLabel: string;
  statusBadgeColor: string;
}

export interface WeeklyMuscularSummary {
  weekId?: string;
  startDate?: string;
  endDate?: string;
  muscles: Record<string, WeeklyMuscleItem>;
  sortedMuscles: WeeklyMuscleItem[];
  totalSessionsWithExercises: number;
  totalSets: number;
  totalReps: number;
  totalEstimatedLoad: number;
  // Ratios d'équilibres fonctionnels
  hqRatio: number | null; // Ischios / Quadriceps
  pushPullRatio: number | null; // Pull / Push
  categorySets: {
    lower: number;
    upper_push: number;
    upper_pull: number;
    core: number;
  };
}

/**
 * Évalue le statut de volume selon les repères scientifiques (Israetel / Schoenfeld).
 */
export function getVolumeLandmark(effectiveSets: number): {
  status: VolumeStatus;
  label: string;
  shortLabel: string;
  badgeColor: string;
  textColor: string;
  hexColor: string;
  gradientId: string;
} {
  const sets = Number(effectiveSets) || 0;
  if (sets < 6) {
    return {
      status: 'under',
      label: 'Maintien / Sous-stimulé (< 6 séries)',
      shortLabel: 'Maintien (< 6s)',
      badgeColor: 'bg-slate-800 text-slate-300 border-slate-700',
      textColor: 'text-slate-400',
      hexColor: sets === 0 ? '#1e293b' : '#475569',
      gradientId: sets === 0 ? 'grad-inactive' : 'grad-maintien'
    };
  }
  if (sets < 10) {
    return {
      status: 'mev',
      label: 'Volume Minimal Efficace (MEV : 6-9 séries)',
      shortLabel: 'MEV Minimal (6-9s)',
      badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      textColor: 'text-sky-400',
      hexColor: '#0284c7',
      gradientId: 'grad-mev'
    };
  }
  if (sets <= 20) {
    return {
      status: 'mav',
      label: 'Volume Adaptatif Optimal (MAV : 10-20 séries)',
      shortLabel: 'MAV Optimal (10-20s)',
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      textColor: 'text-emerald-400',
      hexColor: '#10b981',
      gradientId: 'grad-mav'
    };
  }
  return {
    status: 'mrv',
    label: 'Plafond Récupérable Dépassé (MRV : > 20 séries)',
    shortLabel: 'MRV Plafond (> 20s)',
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    textColor: 'text-amber-400',
    hexColor: '#f59e0b',
    gradientId: 'grad-mrv'
  };
}

/**
 * Agrège les données d'exercices de musculation de toutes les séances d'une semaine donnée.
 */
export function computeWeeklyMuscularSummary(
  events: Record<string, Record<string, any>> = {},
  startDateStr: string,
  endDateStr: string,
  customCatalog: ExerciseDefinition[] = []
): WeeklyMuscularSummary {
  const muscleMap: Record<string, WeeklyMuscleItem> = {};

  Object.values(MUSCLE_GROUPS).forEach(m => {
    muscleMap[m.id] = {
      muscleId: m.id,
      name: m.name,
      category: m.category,
      categoryLabel: m.categoryLabel,
      color: m.color,
      directSets: 0,
      effectiveSets: 0,
      repsTotal: 0,
      estimatedLoad: 0,
      exercises: [],
      volumeStatus: 'under',
      statusLabel: 'Maintien (< 6 séries)',
      statusBadgeColor: 'bg-slate-800 text-slate-300 border-slate-700'
    };
  });

  let totalSessionsWithExercises = 0;
  let totalSets = 0;
  let totalReps = 0;
  let totalEstimatedLoad = 0;

  // Parcourir toutes les qualités et séances dans l'intervalle [startDateStr, endDateStr]
  Object.values(events).forEach(qualityEvents => {
    if (!qualityEvents) return;

    Object.entries(qualityEvents).forEach(([dateStr, sessionData]) => {
      if (dateStr < startDateStr || dateStr > endDateStr) return;
      if (!sessionData || sessionData.isSecondary) return;

      const exercises: SessionExercise[] = sessionData.exercises;
      if (Array.isArray(exercises) && exercises.length > 0) {
        totalSessionsWithExercises += 1;
        const analysis = computeSessionMuscularBreakdown(exercises, customCatalog);

        totalSets += analysis.totalSets;
        totalReps += analysis.totalReps;

        Object.values(analysis.muscleLoads).forEach(item => {
          if (item.effectiveSets > 0) {
            const target = muscleMap[item.muscleId];
            if (target) {
              target.effectiveSets = Number((target.effectiveSets + item.effectiveSets).toFixed(1));
              target.directSets += item.directSets;
              target.repsTotal += item.repsTotal;
              target.estimatedLoad += item.estimatedLoad;
              totalEstimatedLoad += item.estimatedLoad;
              target.exercises.push(...item.exercises);
            }
          }
        });
      }
    });
  });

  // Calcul du statut de volume pour chaque muscle
  const categorySets = {
    lower: 0,
    upper_push: 0,
    upper_pull: 0,
    core: 0
  };

  Object.values(muscleMap).forEach(m => {
    const landmark = getVolumeLandmark(m.effectiveSets);
    m.volumeStatus = landmark.status;
    m.statusLabel = landmark.label;
    m.statusBadgeColor = landmark.badgeColor;

    if (m.category in categorySets) {
      categorySets[m.category] = Number((categorySets[m.category] + m.effectiveSets).toFixed(1));
    }
  });

  // Ratios d'équilibres
  const quadSets = muscleMap['quadriceps']?.effectiveSets || 0;
  const ischiosSets = muscleMap['ischios']?.effectiveSets || 0;
  const hqRatio = quadSets > 0 ? Number((ischiosSets / quadSets).toFixed(2)) : null;

  const pushSets = categorySets.upper_push;
  const pullSets = categorySets.upper_pull;
  const pushPullRatio = pushSets > 0 ? Number((pullSets / pushSets).toFixed(2)) : null;

  const sortedMuscles = Object.values(muscleMap)
    .filter(m => m.effectiveSets > 0)
    .sort((a, b) => b.effectiveSets - a.effectiveSets);

  return {
    muscles: muscleMap,
    sortedMuscles,
    totalSessionsWithExercises,
    totalSets,
    totalReps,
    totalEstimatedLoad,
    hqRatio,
    pushPullRatio,
    categorySets
  };
}

// --- GESTION PERSISTANTE DES EXERCICES PERSONNALISÉS (FEATURE 5) ---

export interface CustomExercise extends ExerciseDefinition {
  isCustom: true;
  createdAt?: string;
}

export function getSavedCustomExercises(): CustomExercise[] {
  try {
    const raw = localStorage.getItem('physio_custom_exercises');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCustomExercise(exercise: Omit<CustomExercise, 'isCustom'>): CustomExercise[] {
  try {
    const list = getSavedCustomExercises();
    const item: CustomExercise = {
      ...exercise,
      isCustom: true,
      createdAt: new Date().toISOString()
    };
    const updated = [item, ...list.filter(e => e.id !== exercise.id)];
    localStorage.setItem('physio_custom_exercises', JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

export function deleteCustomExercise(id: string): CustomExercise[] {
  try {
    const list = getSavedCustomExercises();
    const updated = list.filter(e => e.id !== id);
    localStorage.setItem('physio_custom_exercises', JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

export function getAllExerciseCatalog(customExercises: CustomExercise[] = []): ExerciseDefinition[] {
  return [...customExercises, ...EXERCISE_CATALOG];
}

// --- SYSTÈME D'ALERTES & DIAGNOSTICS DE DÉSÉQUILIBRE MUSCULAIRE (FEATURE 4) ---

export interface MuscularAlert {
  id: string;
  type: 'danger' | 'warning' | 'info' | 'success';
  title: string;
  metric: string;
  message: string;
  recommendations: string[];
}

export function computeMuscularAlerts(summary: WeeklyMuscularSummary): MuscularAlert[] {
  const alerts: MuscularAlert[] = [];

  if (summary.totalSets === 0) return alerts;

  // 1. Ratio H:Q (Ischios / Quadriceps)
  if (summary.hqRatio !== null) {
    if (summary.hqRatio < 0.50) {
      alerts.push({
        id: 'hq_danger',
        type: 'danger',
        title: 'Déséquilibre Ischios/Quadriceps Critique (H:Q < 0.50)',
        metric: `Ratio H:Q = ${summary.hqRatio} (Norme ≥ 0.60)`,
        message: 'Le volume des ischios-jambiers est très inférieur aux quadriceps, augmentant fortement la contrainte sur le LCA et l\'articulation fémoro-patellaire.',
        recommendations: [
          'Ajouter 3 à 4 séries de Soulevé de terre roumain (RDL) ou Leg curl',
          'Intégrer du travail de chaîne postérieure (Hip-thrust, Good morning) en priorité'
        ]
      });
    } else if (summary.hqRatio < 0.60) {
      alerts.push({
        id: 'hq_warning',
        type: 'warning',
        title: 'Dominance Quadriceps Légère (H:Q < 0.60)',
        metric: `Ratio H:Q = ${summary.hqRatio} (Norme ≥ 0.60)`,
        message: 'La chaîne postérieure est en retrait par rapport à la chaîne antérieure cette semaine.',
        recommendations: [
          'Équilibrer la prochaine séance bas du corps avec du travail ciblé ischios'
        ]
      });
    } else {
      alerts.push({
        id: 'hq_ok',
        type: 'success',
        title: 'Ratio Ischios/Quadriceps Optimal',
        metric: `Ratio H:Q = ${summary.hqRatio} (Norme ≥ 0.60)`,
        message: 'Excellente balance entre extenseurs et fléchisseurs du genou.',
        recommendations: []
      });
    }
  }

  // 2. Ratio Tirage / Poussée (Pull / Push)
  if (summary.pushPullRatio !== null) {
    if (summary.pushPullRatio < 0.75) {
      alerts.push({
        id: 'pull_push_danger',
        type: 'danger',
        title: 'Dominance Poussée Excessive (Pull:Push < 0.75)',
        metric: `Ratio Pull:Push = ${summary.pushPullRatio} (Norme ≥ 1.00)`,
        message: 'Trop de poussée par rapport au tirage. Risque d\'antépulsion des épaules et de conflit sous-acromial.',
        recommendations: [
          'Rajouter 3 à 5 séries de Face pull, Tirage horizontal ou Tractions',
          'Veiller au renforcement des rotateurs externes et fixateurs d\'omoplate'
        ]
      });
    } else if (summary.pushPullRatio < 1.0) {
      alerts.push({
        id: 'pull_push_warning',
        type: 'warning',
        title: 'Léger Déficit de Tirage (Pull:Push < 1.00)',
        metric: `Ratio Pull:Push = ${summary.pushPullRatio} (Norme ≥ 1.00)`,
        message: 'Volume de tirage dorsal légèrement inférieur à la poussée.',
        recommendations: [
          'Privilégier un volume équivalent ou supérieur en tirage lors de la prochaine séance'
        ]
      });
    } else {
      alerts.push({
        id: 'pull_push_ok',
        type: 'success',
        title: 'Équilibre Poussée / Tirage Conforme',
        metric: `Ratio Pull:Push = ${summary.pushPullRatio} (Norme ≥ 1.00)`,
        message: 'Posture scapulaire et centrage huméral bien préservés.',
        recommendations: []
      });
    }
  }

  // 3. Détection des groupes en MRV (> 20 séries - fatigue locale aiguë)
  const overloaded = summary.sortedMuscles.filter(m => getVolumeLandmark(m.effectiveSets).status === 'mrv');
  if (overloaded.length > 0) {
    alerts.push({
      id: 'mrv_overload',
      type: 'warning',
      title: 'Plafond Récupérable Dépassé (MRV : > 20 séries)',
      metric: `${overloaded.map(m => `${m.name} (${m.effectiveSets}s)`).join(', ')}`,
      message: 'Volume supérieur à 20 séries effectives (> 20s). Risque de fatigue résiduelle prolongée ou surentraînement local.',
      recommendations: [
        'Réduire le volume direct sur ce groupe la semaine prochaine (semaine de décharge ou de maintien)'
      ]
    });
  }

  // 4. Détection des groupes sous-stimulés si d'autres sont travaillés
  if (summary.totalSets >= 12) {
    const understimulated = Object.values(summary.muscles).filter(
      m => m.effectiveSets === 0 && (m.category === 'lower' || m.category === 'upper_push' || m.category === 'upper_pull')
    );
    if (understimulated.length >= 3) {
      alerts.push({
        id: 'understimulated',
        type: 'info',
        title: 'Groupes Musculaires Non Sollicités',
        metric: `${understimulated.slice(0, 4).map(m => m.name).join(', ')}`,
        message: 'Ces zones n\'ont reçu aucun stimulus direct ou indirect cette semaine.',
        recommendations: [
          'Penser à programmer un rappel léger (2 à 4 séries) pour maintenir les acquis'
        ]
      });
    }
  }

  return alerts;
}

// ==========================================
// SUGGESTION AUTOMATIQUE DE CHARGE ADAPTATIVE
// (RIR & FATIGUE ACCUMULÉE)
// ==========================================

export interface LastExercisePerformance {
  date: string;
  qualityId: string;
  exercise: SessionExercise;
  sessionFatigue?: number;
}

export interface ExerciseProgressionSuggestion {
  hasHistory: boolean;
  lastDate?: string;
  lastQualityId?: string;
  lastSets?: number;
  lastReps?: number;
  lastWeightKg?: number;
  lastRir?: number;
  lastRpe?: number;
  lastSessionFatigue?: number;
  suggestedWeightKg?: number;
  suggestedReps?: number;
  suggestedRir: number;
  suggestedSets?: number;
  percentageDelta: number;
  weightDeltaKg: number;
  status: 'increase' | 'maintain' | 'decrease' | 'new';
  reason: string;
}

/**
 * Recherche la dernière performance d'un exercice donné à travers tout l'historique des séances (toutes filières confondues).
 */
export function findLastExercisePerformance(
  events: Record<string, Record<string, any>> | undefined | null,
  exerciseId: string,
  beforeDateStr?: string
): LastExercisePerformance | null {
  if (!events || !exerciseId) return null;

  const matches: LastExercisePerformance[] = [];

  for (const [qId, dateMap] of Object.entries(events)) {
    if (!dateMap || typeof dateMap !== 'object') continue;

    for (const [dateStr, session] of Object.entries(dateMap)) {
      if (!session || typeof session !== 'object') continue;
      if (!Array.isArray(session.exercises)) continue;

      // Filtrer par date antérieure si une date de référence est fournie
      if (beforeDateStr && dateStr >= beforeDateStr) continue;

      const foundEx = session.exercises.find(
        (ex: any) => ex && (ex.id === exerciseId || (ex.name && ex.name.toLowerCase() === exerciseId.toLowerCase()))
      );

      if (foundEx) {
        matches.push({
          date: dateStr,
          qualityId: qId,
          exercise: foundEx,
          sessionFatigue: session.fatigue !== undefined ? Number(session.fatigue) : undefined
        });
      }
    }
  }

  // Si aucune séance strictement antérieure n'est trouvée, chercher sur une autre date
  if (matches.length === 0 && beforeDateStr) {
    for (const [qId, dateMap] of Object.entries(events)) {
      if (!dateMap || typeof dateMap !== 'object') continue;

      for (const [dateStr, session] of Object.entries(dateMap)) {
        if (!session || typeof session !== 'object') continue;
        if (!Array.isArray(session.exercises)) continue;
        if (dateStr === beforeDateStr) continue;

        const foundEx = session.exercises.find(
          (ex: any) => ex && (ex.id === exerciseId || (ex.name && ex.name.toLowerCase() === exerciseId.toLowerCase()))
        );

        if (foundEx) {
          matches.push({
            date: dateStr,
            qualityId: qId,
            exercise: foundEx,
            sessionFatigue: session.fatigue !== undefined ? Number(session.fatigue) : undefined
          });
        }
      }
    }
  }

  if (matches.length === 0) return null;

  // Tri décroissant par date chronologique (la plus récente d'abord)
  matches.sort((a, b) => {
    const cmp = b.date.localeCompare(a.date);
    if (cmp !== 0) return cmp;
    const aW = (a.exercise.weightKg && a.exercise.weightKg > 0) ? 1 : 0;
    const bW = (b.exercise.weightKg && b.exercise.weightKg > 0) ? 1 : 0;
    return bW - aW;
  });

  return matches[0];
}

/**
 * Calcule la suggestion adaptative de charge selon le RIR de la séance précédente
 * et la fatigue globale accumulée, avec arrondi aux pas de matériel réalistes (0.5 kg).
 */
export function computeAdaptiveProgression(
  lastPerformance: LastExercisePerformance | null,
  currentFatigue?: number | string
): ExerciseProgressionSuggestion {
  if (!lastPerformance || !lastPerformance.exercise) {
    return {
      hasHistory: false,
      suggestedRir: 2,
      percentageDelta: 0,
      weightDeltaKg: 0,
      status: 'new',
      reason: 'Premier enregistrement pour cet exercice · Définissez votre charge de référence.'
    };
  }

  const ex = lastPerformance.exercise;
  const weight = ex.weightKg !== undefined && Number(ex.weightKg) > 0 ? Number(ex.weightKg) : 0;
  const reps = ex.reps !== undefined && Number(ex.reps) > 0 ? Number(ex.reps) : undefined;
  const sets = ex.sets !== undefined && Number(ex.sets) > 0 ? Number(ex.sets) : 4;
  
  const rir = ex.rir !== undefined && !isNaN(Number(ex.rir))
    ? Number(ex.rir)
    : (ex.rpe !== undefined ? Math.max(0, 10 - Number(ex.rpe)) : 2);

  const effectiveFatigue = currentFatigue !== undefined && currentFatigue !== '' && !isNaN(Number(currentFatigue)) && Number(currentFatigue) > 0
    ? Number(currentFatigue)
    : (lastPerformance.sessionFatigue !== undefined ? Number(lastPerformance.sessionFatigue) : 5);

  // 1. Delta de base selon le RIR
  let basePercent = 0;
  if (rir >= 4) {
    basePercent = 5.0; // Facile / Sous-maximal -> forte progression
  } else if (rir === 3) {
    basePercent = 3.5; // Modéré -> progression solide
  } else if (rir === 2) {
    basePercent = 2.0; // Optimal MAV -> progression continue
  } else if (rir === 1) {
    basePercent = 0.5; // Proche échec -> consolidation légère
  } else {
    basePercent = -2.5; // 0 RIR (échec absolu) -> décharge préventive
  }

  // 2. Modulation par la fatigue globale accumulée
  let fatigueDelta = 0;
  if (effectiveFatigue <= 3) {
    fatigueDelta = 1.0; // Très frais -> assimilation maximale
  } else if (effectiveFatigue === 4) {
    fatigueDelta = 0.5; // Bonne fraîcheur
  } else if (effectiveFatigue <= 6) {
    fatigueDelta = 0.0; // Fatigue normale
  } else if (effectiveFatigue <= 8) {
    fatigueDelta = -2.5; // Fatigue élevée -> régulation
  } else {
    fatigueDelta = -5.0; // Fatigue critique -> décharge marquée
  }

  const totalPercent = basePercent + fatigueDelta;

  let suggestedWeightKg: number | undefined = undefined;
  let suggestedReps: number | undefined = reps;
  let weightDeltaKg = 0;
  let percentageDelta = 0;
  let status: 'increase' | 'maintain' | 'decrease' = 'maintain';
  let reason = '';

  // Cas avec charge en kilos
  if (weight > 0) {
    const rawNewWeight = weight * (1 + totalPercent / 100);
    // Arrondi au pas standard d'équipement (0.5 kg)
    let newWeight = Math.round(rawNewWeight * 2) / 2;
    newWeight = Math.max(0.5, newWeight);

    // Ajustement de bordure si l'arrondi absorbe le delta
    if (totalPercent > 0 && newWeight === weight) {
      if (effectiveFatigue <= 4 || rir >= 3) {
        newWeight = weight + 0.5;
      } else if (reps) {
        suggestedReps = reps + 1;
      }
    } else if (totalPercent < 0 && newWeight === weight) {
      if (effectiveFatigue >= 7 || rir === 0) {
        newWeight = Math.max(0.5, weight - 0.5);
      }
    }

    suggestedWeightKg = Number(newWeight.toFixed(1));
    weightDeltaKg = Number((suggestedWeightKg - weight).toFixed(1));
    percentageDelta = Number(((weightDeltaKg / weight) * 100).toFixed(1));

    if (weightDeltaKg > 0 || (suggestedReps && reps && suggestedReps > reps)) {
      status = 'increase';
      const detailDelta = weightDeltaKg > 0 ? `+${weightDeltaKg} kg (${percentageDelta > 0 ? `+${percentageDelta}%` : ''})` : `+1 rep`;
      reason = `${detailDelta} · ${rir} RIR & ${effectiveFatigue <= 4 ? 'pleine fraîcheur' : 'bonne tolérance'}`;
    } else if (weightDeltaKg < 0 || (suggestedReps && reps && suggestedReps < reps)) {
      status = 'decrease';
      reason = `${weightDeltaKg} kg (${percentageDelta}%) · ${rir === 0 ? 'RIR 0 (échec)' : 'Régulation'} & fatigue ${effectiveFatigue}/10`;
    } else {
      status = 'maintain';
      reason = `Maintien (${weight} kg) · Consolidation technique (${rir} RIR · Fatigue ${effectiveFatigue}/10)`;
    }
  } else {
    // Cas sans charge externe (poids du corps : tractions, dips, pompes, abdos)
    if (reps) {
      if (totalPercent >= 2.0) {
        suggestedReps = reps + (rir >= 4 ? 2 : 1);
        status = 'increase';
        reason = `+${suggestedReps - reps} rep(s) · ${rir} RIR précédent & bonne fraîcheur`;
      } else if (totalPercent <= -2.0) {
        suggestedReps = Math.max(1, reps - 1);
        status = 'decrease';
        reason = `-1 rep · Régulation fatigue ${effectiveFatigue}/10 (RIR ${rir})`;
      } else {
        suggestedReps = reps;
        status = 'maintain';
        reason = `Maintien (${reps} reps) · RIR ${rir} & Fatigue ${effectiveFatigue}/10`;
      }
    } else {
      status = 'maintain';
      reason = `Maintien du format · RIR ${rir} & Fatigue ${effectiveFatigue}/10`;
    }
  }

  // RIR cible recommandé (2 = zone optimale d'hypertrophie / MAV)
  const suggestedRir = (rir === 0 && effectiveFatigue >= 8) ? 3 : 2;

  return {
    hasHistory: true,
    lastDate: lastPerformance.date,
    lastQualityId: lastPerformance.qualityId,
    lastSets: sets,
    lastReps: reps,
    lastWeightKg: weight > 0 ? weight : undefined,
    lastRir: rir,
    lastRpe: ex.rpe || (10 - rir),
    lastSessionFatigue: lastPerformance.sessionFatigue,
    suggestedWeightKg,
    suggestedReps,
    suggestedRir,
    suggestedSets: sets,
    percentageDelta,
    weightDeltaKg,
    status,
    reason
  };
}

export interface FrequentExerciseStats {
  exerciseId: string;
  name: string;
  count: number;
  recentCount: number;
  lastDate: string;
  category?: 'lower' | 'upper_push' | 'upper_pull' | 'core' | string;
  isCompound?: boolean;
}

export const LOCAL_STORAGE_EXERCISE_USAGE_KEY = 'physio_recent_exercise_usage';

let memoryUsageCache: Record<string, { count: number; lastUsed: string }> = {};

/**
 * Enregistre une utilisation d'exercice dans le cache rapide pour actualisation instantanée.
 */
export function recordExerciseUsage(exerciseId: string): void {
  if (!exerciseId) return;
  const today = getLocalYYYYMMDD(new Date());
  const prevMem = memoryUsageCache[exerciseId] || { count: 0, lastUsed: today };
  memoryUsageCache[exerciseId] = {
    count: (prevMem.count || 0) + 1,
    lastUsed: today
  };

  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(LOCAL_STORAGE_EXERCISE_USAGE_KEY);
      const data: Record<string, { count: number; lastUsed: string }> = raw ? JSON.parse(raw) : {};
      const prev = data[exerciseId] || { count: 0, lastUsed: today };
      data[exerciseId] = {
        count: (prev.count || 0) + 1,
        lastUsed: today
      };
      localStorage.setItem(LOCAL_STORAGE_EXERCISE_USAGE_KEY, JSON.stringify(data));
    }
  } catch (e) {
    // ignore
  }
}

/**
 * Récupère le dictionnaire des usages d'exercices depuis le cache local rapide.
 */
export function getLocalExerciseUsage(): Record<string, { count: number; lastUsed: string }> {
  let result: Record<string, { count: number; lastUsed: string }> = { ...memoryUsageCache };
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(LOCAL_STORAGE_EXERCISE_USAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        result = { ...result, ...parsed };
      }
    }
  } catch (e) {
    // ignore
  }
  return result;
}

/**
 * Calcule la liste ordonnée des exercices les plus souvent utilisés récemment
 * à partir de l'historique complet des séances (events) et du cache local.
 * Trié par :
 * 1. Fréquence d'utilisation récente (derniers 60 jours)
 * 2. Date de dernière utilisation la plus récente
 * 3. Nombre total d'utilisations historiques
 */
export function getFrequentRecentExercises(
  events: Record<string, Record<string, any>> | undefined | null,
  allAvailableExercises: ExerciseDefinition[] = EXERCISE_CATALOG,
  maxResults: number = 8,
  referenceDateStr?: string
): FrequentExerciseStats[] {
  const map: Map<string, {
    canonicalId: string;
    name: string;
    count: number;
    recentCount: number;
    lastDate: string;
    category?: string;
    isCompound?: boolean;
  }> = new Map();

  // Indexation rapide des exercices du catalogue & personnalisés
  const idToDef = new Map<string, ExerciseDefinition>();
  const nameToDef = new Map<string, ExerciseDefinition>();

  for (const def of allAvailableExercises) {
    idToDef.set(def.id, def);
    nameToDef.set(def.name.toLowerCase().trim(), def);
  }

  // Calcul du seuil de date récente (60 jours en arrière par rapport à la date de référence ou aujourd'hui)
  const refDate = parseLocalDate(referenceDateStr || new Date());
  const recentThreshold = getLocalYYYYMMDD(addDays(refDate, -60));

  // 1. Scanner l'historique de toutes les séances réelles dans events
  if (events && typeof events === 'object') {
    for (const [, dateMap] of Object.entries(events)) {
      if (!dateMap || typeof dateMap !== 'object') continue;

      for (const [dateStr, session] of Object.entries(dateMap)) {
        if (!session || typeof session !== 'object' || !Array.isArray(session.exercises)) continue;

        for (const ex of session.exercises) {
          if (!ex) continue;
          const rawId = ex.exerciseCatalogId || ex.id;
          const rawName = (ex.name || '').trim();

          // Retrouver la définition canonique
          let matchedDef: ExerciseDefinition | undefined;
          if (rawId && idToDef.has(rawId)) {
            matchedDef = idToDef.get(rawId);
          } else if (rawName && nameToDef.has(rawName.toLowerCase())) {
            matchedDef = nameToDef.get(rawName.toLowerCase());
          }

          const canonicalId = matchedDef ? matchedDef.id : (rawId || rawName);
          const canonicalName = matchedDef ? matchedDef.name : (rawName || rawId);
          if (!canonicalId) continue;

          const isRecent = !dateStr || dateStr >= recentThreshold;

          const existing = map.get(canonicalId);
          if (existing) {
            existing.count += 1;
            if (isRecent) existing.recentCount += 1;
            if (!existing.lastDate || (dateStr && dateStr > existing.lastDate)) {
              existing.lastDate = dateStr;
            }
          } else {
            map.set(canonicalId, {
              canonicalId,
              name: canonicalName,
              count: 1,
              recentCount: isRecent ? 1 : 0,
              lastDate: dateStr || '',
              category: matchedDef?.category,
              isCompound: matchedDef?.isCompound
            });
          }
        }
      }
    }
  }

  // 2. Compléter avec le cache local uniquement pour les exercices non encore présents dans events
  // (élimine tout double-comptage indéfini des exercices déjà enregistrés dans l'historique réel)
  const localUsage = getLocalExerciseUsage();
  for (const [exId, stats] of Object.entries(localUsage)) {
    if (!stats || !stats.count) continue;
    let matchedDef = idToDef.get(exId);
    if (!matchedDef) {
      matchedDef = nameToDef.get(exId.toLowerCase());
    }
    const canonicalId = matchedDef ? matchedDef.id : exId;
    const canonicalName = matchedDef ? matchedDef.name : exId;

    const existing = map.get(canonicalId);
    if (existing) {
      // Déjà présent dans l'historique réel : on conserve le décompte réel de events sans le doubler,
      // on met uniquement à jour la date de dernière séance si le cache est plus récent
      if (stats.lastUsed && (!existing.lastDate || stats.lastUsed > existing.lastDate)) {
        existing.lastDate = stats.lastUsed;
      }
    } else {
      map.set(canonicalId, {
        canonicalId,
        name: canonicalName,
        count: stats.count,
        recentCount: stats.count,
        lastDate: stats.lastUsed || '',
        category: matchedDef?.category,
        isCompound: matchedDef?.isCompound
      });
    }
  }

  // Trier par pertinence (fréquence récente, puis date récente, puis total)
  const results = Array.from(map.values())
    .filter(item => item.count > 0)
    .sort((a, b) => {
      // 1. Fréquence d'utilisation récente
      if (b.recentCount !== a.recentCount) {
        return b.recentCount - a.recentCount;
      }
      // 2. Date de dernière séance
      if (b.lastDate !== a.lastDate) {
        return b.lastDate.localeCompare(a.lastDate);
      }
      // 3. Total historique
      return b.count - a.count;
    })
    .slice(0, maxResults)
    .map(item => ({
      exerciseId: item.canonicalId,
      name: item.name,
      count: item.count,
      recentCount: item.recentCount,
      lastDate: item.lastDate,
      category: item.category,
      isCompound: item.isCompound
    }));

  return results;
}

/**
 * Détermine le groupe musculaire principal d'un exercice en trouvant le ratio le plus élevé dans muscleRatios.
 */
export function getExercisePrimaryMuscle(exercise?: { category?: string; muscleRatios?: Record<string, number>; customRatios?: Record<string, number> } | null): string {
  const ratios = (exercise?.customRatios && Object.keys(exercise.customRatios).length > 0)
    ? exercise.customRatios
    : exercise?.muscleRatios;

  if (!ratios || Object.keys(ratios).length === 0) {
    if (exercise?.category === 'lower') return 'quadriceps';
    if (exercise?.category === 'upper_push') return 'pectoraux';
    if (exercise?.category === 'upper_pull') return 'dorsaux';
    return 'abdos';
  }
  let bestMuscle = '';
  let highestRatio = -1;
  for (const [mId, ratio] of Object.entries(ratios)) {
    if (ratio > highestRatio) {
      highestRatio = ratio;
      bestMuscle = mId;
    }
  }
  return bestMuscle || (exercise?.category === 'lower' ? 'quadriceps' : exercise?.category === 'upper_push' ? 'pectoraux' : exercise?.category === 'upper_pull' ? 'dorsaux' : 'abdos');
}

/**
 * Ordre canonique d'affichage des muscles principaux avec étiquettes et catégories associées
 */
export const ORDERED_PRIMARY_MUSCLES = [
  { id: 'pectoraux', name: 'Pectoraux', category: 'upper_push' },
  { id: 'dorsaux', name: 'Grand Dorsal & Dos', category: 'upper_pull' },
  { id: 'deltoides_ant', name: 'Épaules (Antérieur / Latéral)', category: 'upper_push' },
  { id: 'deltoides_post', name: 'Deltoïdes Postérieurs', category: 'upper_pull' },
  { id: 'trapezes', name: 'Trapèzes & Haut du dos', category: 'upper_pull' },
  { id: 'biceps', name: 'Biceps & Fléchisseurs', category: 'upper_pull' },
  { id: 'triceps', name: 'Triceps', category: 'upper_push' },
  { id: 'quadriceps', name: 'Quadriceps (Cuisses)', category: 'lower' },
  { id: 'ischios', name: 'Ischio-jambiers', category: 'lower' },
  { id: 'glutes', name: 'Fessiers', category: 'lower' },
  { id: 'mollets', name: 'Mollets', category: 'lower' },
  { id: 'abdos', name: 'Sangle Abdominale & Gainage', category: 'core' },
  { id: 'lombaires', name: 'Érecteurs du Rachis (Lombaires)', category: 'core' },
] as const;

